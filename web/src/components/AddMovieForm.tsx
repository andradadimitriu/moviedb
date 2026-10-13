import { useState, type FormEvent } from 'react';
import { addMovie } from '../api';

const empty = { title: '', author: '', year: '', main_actors: '', genre: '', description: '', is_seen: false };

export function AddMovieForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await addMovie({ ...form, year: form.year ? Number(form.year) : undefined });
      setForm(empty);
      setStatus({ ok: true, text: 'Added ✓' });
      onAdded();
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    }
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
        <button type="submit">Add movie</button>
        {status && <span className={status.ok ? 'hint' : 'error'}>{status.text}</span>}
      </div>
    </form>
  );
}
