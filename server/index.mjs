import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Phase-1 web service: serves the built SPA. This is the single Render
 * service the brief calls for — phase 2 adds the API routes (Postgres-backed
 * DataLayer, magic-link auth) and phase 3 adds the cron-triggered send
 * worker alongside, all in this one deployable.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT ?? 3000);

const app = express();
app.disable('x-powered-by');

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use(express.static(dist, { index: false, maxAge: '1h' }));

// SPA fallback — client-side routing owns every other path.
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, () => {
  console.log(`post-purchase comms listening on :${port}`);
});
