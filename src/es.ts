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

const properties = {
  title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
  author: { type: 'text', fields: { keyword: { type: 'keyword' } } },
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
