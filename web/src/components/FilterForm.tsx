import { useState, type FormEvent } from 'react';
import type { Filters } from '../types';

export const emptyFilters: Filters = { q: '', genre: '', actor: '', year_from: '', year_to: '', unseenOnly: true };

/** Edits a draft locally; filters only apply when Search or Reset is pressed. */
export function FilterForm({ onSearch }: { onSearch: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);

  const set = (key: Exclude<keyof Filters, 'unseenOnly'>) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    onSearch({ ...draft });
  }

  function reset() {
    setDraft(emptyFilters);
    onSearch({ ...emptyFilters });
  }

  return (
    <form onSubmit={submit}>
      <label>
        Search <input type="text" placeholder="title, author, actor, description" value={draft.q} onChange={set('q')} />
      </label>
      <div className="grid" style={{ marginTop: 10 }}>
        <label>Genre <input type="text" value={draft.genre} onChange={set('genre')} /></label>
        <label>Actor <input type="text" value={draft.actor} onChange={set('actor')} /></label>
        <label>
          Year from <input type="number" min={1870} max={2100} value={draft.year_from} onChange={set('year_from')} />
        </label>
        <label>
          Year to <input type="number" min={1870} max={2100} value={draft.year_to} onChange={set('year_to')} />
        </label>
      </div>
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={draft.unseenOnly}
            onChange={(e) => setDraft((d) => ({ ...d, unseenOnly: e.target.checked }))}
          />{' '}
          Only movies I haven't seen
        </label>
        <button type="submit">Search</button>
        <button type="button" className="ghost" onClick={reset}>Reset</button>
      </div>
    </form>
  );
}
