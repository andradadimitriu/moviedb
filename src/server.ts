import http from 'node:http';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { ensureIndex } from './es';
import { addMovie, backfillTitleVectors, findExisting, findMovies, findSimilarTitle, MovieFilter, NewMovie, setSeen } from './movies';

const app = express();
app.use(express.json());

// List / search movies. Example: GET /api/movies?is_seen=false&genre=drama&actor=dicaprio
app.get('/api/movies', async (req, res) => {
  const filter = MovieFilter.parse(req.query);
  res.json(await findMovies(filter));
});

// Shortcut for "movies I have not seen" with the same genre/actor/q filters.
app.get('/api/movies/unseen', async (req, res) => {
  const filter = MovieFilter.parse(req.query);
  res.json(await findMovies({ ...filter, is_seen: false }));
});

// Refuses with 409 if the movie may already exist, unless the body has "force": true:
// `duplicates` = same title + year + author; `similar` = same year, title with the same meaning (any language).
app.post('/api/movies', async (req, res) => {
  const input = NewMovie.parse(req.body);
  const { force } = z.object({ force: z.boolean().default(false) }).parse(req.body);
  if (!force) {
    const [duplicates, sameMeaning] = await Promise.all([findExisting(input), findSimilarTitle(input)]);
    const similar = sameMeaning.filter((m) => !duplicates.some((d) => d.id === m.id));
    if (duplicates.length > 0 || similar.length > 0) {
      return void res.status(409).json({ error: 'This movie may already exist', duplicates, similar });
    }
  }
  res.status(201).json(await addMovie(input));
});

// Mark as seen. Body is optional; send { "is_seen": false } to undo.
app.patch('/api/movies/:id/seen', async (req, res) => {
  const { is_seen } = z.object({ is_seen: z.boolean().default(true) }).parse(req.body ?? {});
  const found = await setSeen(req.params.id, is_seen);
  if (!found) return void res.status(404).json({ error: 'Movie not found' });
  res.json({ id: req.params.id, is_seen });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return void res.status(400).json({ error: 'Invalid request', issues: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

const ROOT = path.resolve(__dirname, '..');

// Development: Vite compiles the React app on the fly (with hot reload) on this same port.
// Production: serve the output of `vite build`.
async function mountFrontend(server: http.Server) {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(ROOT, 'dist', 'web')));
    return;
  }
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(ROOT, 'vite.config.mts'),
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

async function start() {
  try {
    await ensureIndex();
  } catch (err) {
    console.error('Could not connect to Elasticsearch:', (err as Error).message);
    process.exit(1);
  }

  const server = http.createServer(app);
  await mountFrontend(server);
  app.use(errorHandler);

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`moviedb listening on http://localhost:${port}`));

  // In the background: load the embedding model and add title vectors to movies missing one.
  backfillTitleVectors()
    .then((n) => n > 0 && console.log(`Added title vectors to ${n} movies.`))
    .catch((err) => console.error('Title vector backfill failed:', err.message));
}

void start();
