import { z } from 'zod';
import { es, INDEX } from './es';
import { embed, embedOne } from './embeddings';

const stringList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')))
  .transform((v) => v.map((s) => s.trim()).filter(Boolean));

export const NewMovie = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().default(''),
  year: z.coerce.number().int().min(1870).max(2100).optional(),
  description: z.string().trim().default(''),
  main_actors: stringList.default([]),
  genre: stringList.default([]),
  is_seen: z.boolean().default(false),
});

export const MovieFilter = z.object({
  is_seen: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  genre: z.string().trim().optional(),
  actor: z.string().trim().optional(),
  q: z.string().trim().optional(),
  year_from: z.coerce.number().int().optional(),
  year_to: z.coerce.number().int().optional(),
}).refine((f) => f.year_from === undefined || f.year_to === undefined || f.year_from <= f.year_to, {
  message: 'year_from must not be after year_to',
  path: ['year_from'],
});

export type NewMovie = z.infer<typeof NewMovie>;
export type MovieFilter = z.infer<typeof MovieFilter>;
export type Movie = NewMovie & { id: string; created_at: string };

// Minimum cosine similarity for the duplicate warning (same year only), measured with LaBSE:
// literal translations scored >= 0.72. Unrelated titles can score higher across a whole
// catalogue, so this is only used together with the same-year filter, and only warns.
const SIMILAR_TITLE = 0.7;

// Search compares against every movie, so it only takes the single best title, and only if it is
// clearly ahead: "Der Pate" → The Godfather 0.89 vs runner-up 0.75; a wrong best match tends to
// lead by < 0.01 (千と千尋の神隠し → Shawshank 0.786 vs 0.780).
const SEARCH_MIN = 0.75;
const SEARCH_LEAD = 0.03;

// Vectors are only for searching; never send them back in API responses.
const source = { excludes: ['title_vector'] };
type Hit = { _id?: string; _source?: Omit<Movie, 'id'> };
const toMovie = (h: Hit): Movie => ({ id: h._id!, ...h._source! });

/** What makes two movies "the same" for duplicate checks. */
export type MovieKey = { title: string; year?: number; author: string };

// `.folded` fields ignore case and accents, so "Amelie" matches "Amélie".
const same = (field: string, value: string) => ({ term: { [`${field}.folded`]: value } });
const missing = (field: string) => ({ bool: { must_not: { exists: { field } } } });

/** Matches movies with the same title, year and author. A missing year/author only matches a missing one. */
function sameMovieQuery(m: MovieKey) {
  return {
    bool: {
      filter: [
        same('title', m.title),
        m.year === undefined ? missing('year') : { term: { year: m.year } },
        m.author
          ? same('author', m.author)
          : { bool: { should: [same('author', ''), missing('author')], minimum_should_match: 1 } },
      ],
    },
  };
}

/** Stored movies with the same title + year + author as `movie`. */
export async function findExisting(movie: MovieKey): Promise<Movie[]> {
  const res = await es.search<Omit<Movie, 'id'>>({ index: INDEX, size: 100, query: sameMovieQuery(movie), _source: source });
  return res.hits.hits.map(toMovie);
}

/**
 * Stored movies from the same year whose title means the same, possibly in another language
 * ("Il Padrino" for "The Godfather"). Skipped when there is no year, since sequels and
 * remakes have near-identical titles. Returns [] if the model is unavailable.
 */
export async function findSimilarTitle(movie: MovieKey): Promise<Movie[]> {
  if (movie.year === undefined) return [];
  const vector = await titleVector(movie.title);
  if (!vector) return [];
  const res = await es.search<Omit<Movie, 'id'>>({
    index: INDEX,
    knn: {
      field: 'title_vector',
      query_vector: vector,
      k: 10,
      num_candidates: 100,
      similarity: SIMILAR_TITLE,
      filter: { term: { year: movie.year } },
    },
    _source: source,
  });
  return res.hits.hits.map(toMovie);
}

/** For each movie, whether one with the same title + year + author is stored. One request for all. */
export async function existsEach(movies: MovieKey[]): Promise<boolean[]> {
  if (movies.length === 0) return [];
  const res = await es.msearch({
    index: INDEX,
    searches: movies.flatMap((m) => [{}, { size: 0, track_total_hits: 1, query: sameMovieQuery(m) }]),
  });
  return res.responses.map((r) => {
    if ('error' in r) throw new Error(`Duplicate check failed: ${r.error.reason}`);
    const total = r.hits.total;
    return (typeof total === 'number' ? total : (total?.value ?? 0)) > 0;
  });
}

/** The title's embedding, or undefined if the model can't run (the movie is then saved without one). */
async function titleVector(title: string): Promise<number[] | undefined> {
  try {
    return await embedOne(title);
  } catch (err) {
    console.error('Could not compute title embedding:', (err as Error).message);
    return undefined;
  }
}

export async function addMovie(input: NewMovie): Promise<Movie> {
  const doc = { ...input, created_at: new Date().toISOString() };
  const title_vector = await titleVector(input.title);
  const res = await es.index({ index: INDEX, document: { ...doc, title_vector }, refresh: 'wait_for' });
  return { id: res._id, ...doc };
}

/** Computes title_vector for movies that don't have one yet (older movies, seeds, failed embeddings). */
export async function backfillTitleVectors(): Promise<number> {
  const res = await es.search<{ title: string }>({
    index: INDEX,
    size: 10_000,
    query: { bool: { must_not: { exists: { field: 'title_vector' } } } },
    _source: ['title'],
  });
  const hits = res.hits.hits;
  if (hits.length === 0) return 0;

  const vectors = await embed(hits.map((h) => h._source!.title));
  const bulk = await es.bulk({
    index: INDEX,
    refresh: 'wait_for',
    operations: hits.flatMap((h, i) => [{ update: { _id: h._id! } }, { doc: { title_vector: vectors[i] } }]),
  });
  if (bulk.errors) throw new Error('Some title vectors failed to save');
  return hits.length;
}

/** Returns false if the movie does not exist. */
export async function setSeen(id: string, isSeen: boolean): Promise<boolean> {
  try {
    await es.update({ index: INDEX, id, doc: { is_seen: isSeen }, refresh: 'wait_for' });
    return true;
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) return false;
    throw err;
  }
}

/** The id of the one movie whose title clearly means the same as `text` (see SEARCH_MIN/SEARCH_LEAD), if any. */
async function bestTitleMatch(text: string, filters: object[]): Promise<string | undefined> {
  const vector = await titleVector(text);
  if (!vector) return undefined;
  const res = await es.search({
    index: INDEX,
    knn: { field: 'title_vector', query_vector: vector, k: 2, num_candidates: 100, filter: filters },
    _source: false,
  });
  // For cosine, Elasticsearch scores (1 + similarity) / 2; convert back.
  const [best, second] = res.hits.hits.map((h) => ({ id: h._id!, similarity: 2 * (h._score ?? 0) - 1 }));
  if (!best || best.similarity < SEARCH_MIN) return undefined;
  if (second && best.similarity - second.similarity < SEARCH_LEAD) return undefined;
  return best.id;
}

export async function findMovies(filter: MovieFilter): Promise<Movie[]> {
  const must: object[] = [];
  const filters: object[] = [];

  if (filter.is_seen !== undefined) filters.push({ term: { is_seen: filter.is_seen } });
  if (filter.genre) filters.push({ term: { genre: filter.genre } });
  if (filter.year_from !== undefined || filter.year_to !== undefined) {
    filters.push({ range: { year: { gte: filter.year_from, lte: filter.year_to } } });
  }
  if (filter.actor) {
    must.push({ match: { main_actors: { query: filter.actor, operator: 'and' } } });
  }
  if (filter.q) {
    const text = { multi_match: { query: filter.q, fields: ['title^2', 'author', 'main_actors', 'description'] } };
    // Also match a title by meaning, across languages ("Il Padrino" finds "The Godfather").
    const bestId = await bestTitleMatch(filter.q, filters);
    must.push(bestId ? { bool: { should: [text, { ids: { values: [bestId] } }], minimum_should_match: 1 } } : text);
  }

  const hasScoring = must.length > 0;
  const res = await es.search<Omit<Movie, 'id'>>({
    index: INDEX,
    size: 200,
    query: { bool: { must, filter: filters } },
    sort: hasScoring ? ['_score', { 'title.keyword': 'asc' }] : [{ 'title.keyword': 'asc' }],
    _source: source,
  });

  return res.hits.hits.map(toMovie);
}
