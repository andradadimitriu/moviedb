import type { Filters, Movie, NewMovie } from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: any) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.issues?.[0]?.message ?? data.error ?? res.statusText, res.status, data);
  return data as T;
}

export function fetchMovies(filters: Filters): Promise<Movie[]> {
  const params = new URLSearchParams();
  for (const key of ['q', 'genre', 'actor', 'year_from', 'year_to'] as const) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  if (filters.unseenOnly) params.set('is_seen', 'false');
  return request<Movie[]>(`/api/movies?${params}`);
}

/** Throws DuplicateMovieError if the movie may already exist (see the server's POST /api/movies), unless force is true. */
export async function addMovie(movie: NewMovie, force = false): Promise<Movie> {
  try {
    return await request<Movie>('/api/movies', { method: 'POST', body: { ...movie, force } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) throw new DuplicateMovieError(err.data.duplicates, err.data.similar ?? []);
    throw err;
  }
}

export class DuplicateMovieError extends Error {
  /** duplicates: same title + year + author. similar: same year, title with the same meaning in any language. */
  constructor(readonly duplicates: Movie[], readonly similar: Movie[]) {
    super('This movie may already exist');
  }
}

export function markSeen(id: string): Promise<void> {
  return request(`/api/movies/${encodeURIComponent(id)}/seen`, { method: 'PATCH', body: { is_seen: true } });
}
