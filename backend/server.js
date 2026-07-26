// Local dev server — same handlers the Vercel functions in /api use, so
// behavior matches production. Run with: npm start (from repo root) or
// node backend/server.js. Defaults to http://localhost:4000.
const express = require('express');
const { applyCors, send } = require('./lib/cors');
const { listSeasons, getRoster, listPlayersForSeason, getPlayerForSeason } = require('./lib/handlers');

const app = express();
const PORT = process.env.PORT || 4000;

app.use((req, res, next) => {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'courtcraft-api' }));
app.get('/api/roster', (req, res) => send(res, getRoster()));
app.get('/api/seasons', (req, res) => send(res, listSeasons()));
app.get('/api/seasons/:season/players', (req, res) => send(res, listPlayersForSeason(req.params.season)));
app.get('/api/seasons/:season/players/:id', (req, res) => send(res, getPlayerForSeason(req.params.season, req.params.id)));

app.listen(PORT, () => console.log(`CourtCraft API listening on http://localhost:${PORT}`));
