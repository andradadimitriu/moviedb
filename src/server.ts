import http from 'node:http';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { ensureIndex } from './es';
import { addMovie, findExisting, findMovies, MovieFilter, NewMovie, setSeen } from './movies';

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

// Refuses with 409 if a movie with the same title + year + author exists, unless the body has "force": true.
app.post('/api/movies', async (req, res) => {
  const input = NewMovie.parse(req.body);
  const { force } = z.object({ force: z.boolean().default(false) }).parse(req.body);
  if (!force) {
    const duplicates = await findExisting(input);
    if (duplicates.length > 0) {
      return void res.status(409).json({ error: 'A movie with the same title, year and author already exists', duplicates });
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
}

void start();
