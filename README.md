# MovieDB

Node + TypeScript backend storing movies in Elasticsearch, with a React + TypeScript frontend.

## Run

Requires a running Elasticsearch 9 (e.g. Elastic's start-local on http://localhost:9200).

```sh
npm install
cp .env.example .env   # then fill in your Elasticsearch URL and credentials
npm run dev            # API + UI on http://localhost:3000 (UI hot-reloads via Vite)
npm run seed           # optional: add ~30 sample movies (skips ones whose title + year + author exist)
```

Production: `npm run build && npm start` (serves the built UI from `dist/web`).

Configure via env vars (see `.env.example`): `ES_URL`, `ES_INDEX`, `ES_USERNAME`/`ES_PASSWORD` or `ES_API_KEY`, `PORT`.

## Multilingual titles

Titles are embedded with [LaBSE](https://huggingface.co/Xenova/LaBSE) (run in Node via transformers.js; ~480 MB, downloaded on first use to `.cache/models`) and stored in the `title_vector` field. Used for the duplicate warning and search. Works for literal translations ("Il Padrino", "Der Pate" → The Godfather); not for titles that aren't translations (e.g. 千と千尋の神隠し → Spirited Away). Movies without a vector get one when the server starts.

## Layout

- `src/` – backend: `server.ts` (routes, entry point), `movies.ts` (queries), `es.ts` (Elasticsearch client + index), `seed.ts` (sample data), `embeddings.ts` (title embeddings)
- `web/` – frontend: `index.html` → `src/main.tsx` → `App.tsx` and `components/`; `api.ts` wraps the backend calls

## API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/movies` | Add a movie: `{ title, author?, year?, description?, main_actors?, genre?, is_seen? }`. `main_actors`/`genre` accept an array or a comma-separated string. Returns `409` if the movie may already exist: `duplicates` (same title + year + author, ignoring case and accents) and `similar` (same year, title with the same meaning in any language). Resend with `"force": true` to add it anyway. |
| `PATCH` | `/api/movies/:id/seen` | Mark as seen. Optional body `{ "is_seen": false }` to undo. |
| `GET` | `/api/movies` | List movies. Query: `is_seen=true\|false`, `genre`, `actor`, `q` (free text over title, author, actors, description, plus the one title that clearly means the same in another language), `year_from`, `year_to` (inclusive, either optional). |
| `GET` | `/api/movies/unseen` | Same filters, restricted to movies not seen yet. |

Matching: `genre` is exact but case-insensitive (`SCI-FI` = `sci-fi`); `actor` is full-text (`dicaprio` matches "Leonardo DiCaprio").
