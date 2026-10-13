import { useState } from 'react';
import { markSeen } from '../api';
import type { Movie } from '../types';

export function MovieList({ movies, onChanged }: { movies: Movie[]; onChanged: () => void }) {
  if (movies.length === 0) return <p className="hint">No movies match.</p>;

  return (
    <ul>
      {movies.map((m) => (
        <MovieItem key={m.id} movie={m} onChanged={onChanged} />
      ))}
    </ul>
  );
}

function MovieItem({ movie: m, onChanged }: { movie: Movie; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleMarkSeen() {
    setBusy(true);
    try {
      await markSeen(m.id);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <li>
      <div>
        <div className="title">
          {m.title} {m.year && <span className="meta">({m.year})</span>}
        </div>
        <div className="meta">
          {m.author && `${m.author} · `}
          {m.main_actors.join(', ')}
        </div>
        {m.description && <div className="desc">{m.description}</div>}
        <div>
          {m.genre.map((g) => (
            <span key={g} className="tag">{g}</span>
          ))}
        </div>
      </div>
      {m.is_seen ? (
        <span className="seen">✓ Seen</span>
      ) : (
        <button onClick={handleMarkSeen} disabled={busy}>Mark as seen</button>
      )}
    </li>
  );
}
