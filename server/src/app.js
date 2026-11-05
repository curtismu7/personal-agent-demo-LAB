// One Express app. /api = health, the story, the pattern diagrams, and the held-request decision, which is the only server state
// and is kept per workspace id (X-Workspace) so one visitor's Approve or Reset never touches another's.
// Loopback Host check and same-origin writes on everything. Serves web/dist when it exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { hostCheck, sameOriginWrites } from './safety.js';
import { createHealth } from './health.js';
import { buildFlow, loadCast } from './flow.js';
import { hostedFrom, modeFrom } from './config.js';
import { PATHS, buildPattern } from './patternData.js';
import { createWorkspaces, workspaceFrom } from './workspaces.js';
import { shelfInfo } from './shelfLink.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.WEB_DIST || path.resolve(HERE, '../../web/dist');
const CONFIG = process.env.CUSTOMER_CONFIG || path.resolve(HERE, '../../customer.config.json');

export function createApp({ health = createHealth(), configFile = CONFIG, hosted = false, workspaces = createWorkspaces() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(hostCheck);
  app.use(sameOriginWrites);
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });

  const api = express.Router();
  api.use(express.json({ limit: '1kb' }));
  api.use('/health', health.router);
  // Read on every request so editing customer.config.json shows up on reload.
  api.get('/flow', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ ...buildFlow(loadCast(configFile)), hosted }); });
  api.get('/pattern', (req, res) => { res.set('Cache-Control', 'no-store'); const id = PATHS.some((p) => p.id === req.query.path) ? req.query.path : 'privilege'; res.json(buildPattern(id)); });
  // What this build is, for the banner and for verifying a deploy by content (not by a 200).
  api.get('/info', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ mode: modeFrom(), simulated: true, hosted, source: 'mock', realAvailable: false }); });
  // Rule 19: the Mock/Real toggle. Only MODE=mock exists (config.js refuses anything else), so Real is never
  // available: the switch keeps Mock and Real is refused with the reason.
  api.post('/mode', (req, res) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).length !== 1 || !['mock', 'real'].includes(b.source)) return res.status(400).json({ error: 'bad_request', message: 'body must be exactly {source: "mock" or "real"}' });
    if (b.source === 'real') return res.status(409).json({ error: 'conflict', message: 'Real is not available: this app has a mock mode only. A live side is not implemented.' });
    return res.status(200).json({ mode: modeFrom(), simulated: true, hosted, source: 'mock', realAvailable: false });
  });
  // Held request (simulated approval): per-workspace decision. A bad workspace id is refused, never defaulted.
  const withWorkspace = (handler) => (req, res) => {
    const ws = workspaceFrom(req);
    if (!ws) return res.status(400).json({ error: 'bad_workspace' });
    res.set('Cache-Control', 'no-store');
    return handler(ws, req, res);
  };
  api.get('/hold', withWorkspace((ws, _req, res) => res.json(workspaces.get(ws))));
  api.post('/hold/decision', withWorkspace((ws, req, res) => {
    const decision = req.body && req.body.decision;
    if (decision !== 'approved' && decision !== 'declined') return res.status(400).json({ error: 'bad_decision' });
    return res.json(workspaces.decide(ws, decision));
  }));
  // Reset clears this workspace's decision only; the walkthrough itself lives in the browser.
  api.post('/reset', withWorkspace((ws, _req, res) => { workspaces.reset(ws); res.json({ reset: 'ok', workspace: ws }); }));
  api.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.get('/api/shelf', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json(shelfInfo()); }); // the header "Shelf" button
  app.use('/api', api);
  // Errors become short JSON. Express's default handler would send an HTML stack trace with absolute file paths.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode);
    if (status === 413) return res.status(413).json({ error: 'payload_too_large' });
    if (status >= 400 && status < 500) return res.status(status).json({ error: 'bad_request' });
    return res.status(500).json({ error: 'internal_error' });
  });

  if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    app.use(express.static(WEB_DIST));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }
  return app;
}

export function startHttpServer({ port, host, app = createApp() } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}/` }));
    server.once('error', reject);
  });
}
