import { z } from 'zod';
import { es, INDEX } from './es';

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

export async function addMovie(input: NewMovie): Promise<Movie> {
  const doc = { ...input, created_at: new Date().toISOString() };
  const res = await es.index({ index: INDEX, document: doc, refresh: 'wait_for' });
  return { id: res._id, ...doc };
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
    must.push({
      multi_match: { query: filter.q, fields: ['title^2', 'author', 'main_actors', 'description'] },
    });
  }

  const hasScoring = must.length > 0;
  const res = await es.search<Omit<Movie, 'id'>>({
    index: INDEX,
    size: 200,
    query: { bool: { must, filter: filters } },
    sort: hasScoring ? ['_score', { 'title.keyword': 'asc' }] : [{ 'title.keyword': 'asc' }],
  });

  return res.hits.hits.map((h) => ({ id: h._id!, ...h._source! }));
}
