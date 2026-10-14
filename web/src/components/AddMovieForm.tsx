import { useState, type FormEvent } from 'react';
import { addMovie, DuplicateMovieError } from '../api';
import type { Movie } from '../types';

const empty = { title: '', author: '', year: '', main_actors: '', genre: '', description: '', is_seen: false };

export function AddMovieForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // Set when the server reports a movie with the same title + year + author; asks before adding anyway.
  const [duplicates, setDuplicates] = useState<Movie[] | null>(null);

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setDuplicates(null);
  };

  async function save(force: boolean) {
    try {
      await addMovie({ ...form, year: form.year ? Number(form.year) : undefined }, force);
      setForm(empty);
      setDuplicates(null);
      setStatus({ ok: true, text: 'Added ✓' });
      onAdded();
    } catch (err) {
      if (err instanceof DuplicateMovieError) {
        setDuplicates(err.duplicates);
        setStatus(null);
      } else {
        setStatus({ ok: false, text: (err as Error).message });
      }
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  return (
    <form onSubmit={submit}>
      <div className="grid">
        <label>Title <input type="text" required value={form.title} onChange={set('title')} /></label>
        <label>Author / director <input type="text" value={form.author} onChange={set('author')} /></label>
        <label>
          Year <input type="number" min={1870} max={2100} placeholder="e.g. 2010" value={form.year} onChange={set('year')} />
        </label>
        <label>
          Main actors <input type="text" placeholder="comma separated" value={form.main_actors} onChange={set('main_actors')} />
        </label>
        <label>
          Genre <input type="text" placeholder="e.g. drama, thriller" value={form.genre} onChange={set('genre')} />
        </label>
      </div>
      <label className="full">
        Description <textarea rows={2} value={form.description} onChange={set('description')} />
      </label>
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={form.is_seen}
            onChange={(e) => setForm((f) => ({ ...f, is_seen: e.target.checked }))}
          />{' '}
          Already seen
        </label>
        <button type="submit" disabled={duplicates !== null}>Add movie</button>
        {status && <span className={status.ok ? 'hint' : 'error'}>{status.text}</span>}
      </div>
      {duplicates && (
        <div className="warning" role="alert">
          <strong>This movie may already be in your list.</strong> Same title, year and author as:
          <ul>
            {duplicates.map((m) => (
              <li key={m.id}>
                {m.title}
                {m.year && ` (${m.year})`}
                {m.author && ` · ${m.author}`}
                {m.is_seen && ' · seen'}
              </li>
            ))}
          </ul>
          Are you sure you want to add it again?
          <div className="row">
            <button type="button" onClick={() => void save(true)}>Add anyway</button>
            <button type="button" className="ghost" onClick={() => setDuplicates(null)}>Cancel</button>
          </div>
        </div>
      )}
    </form>
  );
}
