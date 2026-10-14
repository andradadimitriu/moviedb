import { Client } from '@elastic/elasticsearch';

export const INDEX = process.env.ES_INDEX ?? 'movies';

function auth() {
  if (process.env.ES_API_KEY) return { apiKey: process.env.ES_API_KEY };
  if (process.env.ES_USERNAME && process.env.ES_PASSWORD) {
    return { username: process.env.ES_USERNAME, password: process.env.ES_PASSWORD };
  }
  return undefined;
}

export const es = new Client({
  node: process.env.ES_URL ?? 'http://localhost:9200',
  auth: auth(),
});

// `.folded` = whole value, lowercased and without accents ("Amélie" → "amelie"); used for duplicate checks.
const textWithFolded = {
  type: 'text',
  fields: { keyword: { type: 'keyword' }, folded: { type: 'keyword', normalizer: 'lowercase' } },
} as const;

const properties = {
  title: textWithFolded,
  author: textWithFolded,
  year: { type: 'integer' },
  description: { type: 'text' },
  // Actors are full-text so "dicaprio" matches "Leonardo DiCaprio".
  main_actors: { type: 'text', fields: { keyword: { type: 'keyword' } } },
  // Genres are exact-match, case-insensitive.
  genre: { type: 'keyword', normalizer: 'lowercase' },
  is_seen: { type: 'boolean' },
  created_at: { type: 'date' },
} as const;

export async function ensureIndex(): Promise<void> {
  if (await es.indices.exists({ index: INDEX })) {
    // Adds any fields introduced since the index was created; fails if an existing field changed type.
    await es.indices.putMapping({ index: INDEX, properties });
    await reindexMissing('title.folded');
    return;
  }

  await es.indices.create({
    index: INDEX,
    settings: {
      analysis: {
        normalizer: {
          lowercase: { type: 'custom', filter: ['lowercase', 'asciifolding'] },
        },
      },
    },
    mappings: { properties },
  });
}

/**
 * New sub-fields only apply to movies saved after they were added. Re-save (in place) the
 * movies that are missing `field` so they get it. Does nothing once every movie has it.
 */
async function reindexMissing(field: string): Promise<void> {
  const query = { bool: { must_not: { exists: { field } } } };
  const { count } = await es.count({ index: INDEX, query });
  if (count === 0) return;
  const res = await es.updateByQuery({ index: INDEX, query, refresh: true, conflicts: 'proceed' });
  console.log(`Re-indexed ${res.updated} movies to add ${field}.`);
}
