import { useCallback, useEffect, useState } from 'react';
import { fetchMovies } from './api';
import { AddMovieForm } from './components/AddMovieForm';
import { FilterForm, emptyFilters } from './components/FilterForm';
import { MovieList } from './components/MovieList';
import type { Filters, Movie } from './types';

export function App() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMovies(await fetchMovies(filters));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main>
      <h1>🎬 MovieDB</h1>

      <section>
        <h2>Add a movie</h2>
        <AddMovieForm onAdded={reload} />
      </section>

      <section>
        <h2>Find movies</h2>
        <FilterForm onSearch={setFilters} />
      </section>

      <section>
        <h2>{filters.unseenOnly ? "Movies I haven't seen" : 'All movies'}</h2>
        {error ? <p className="error">{error}</p> : <MovieList movies={movies} onChanged={reload} />}
      </section>
    </main>
  );
}
