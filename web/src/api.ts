import type { Filters, Movie, NewMovie } from './types';

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.issues?.[0]?.message ?? data.error ?? res.statusText);
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

export function addMovie(movie: NewMovie): Promise<Movie> {
  return request<Movie>('/api/movies', { method: 'POST', body: movie });
}

export function markSeen(id: string): Promise<void> {
  return request(`/api/movies/${encodeURIComponent(id)}/seen`, { method: 'PATCH', body: { is_seen: true } });
}
