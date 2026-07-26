# CourtCraft backend

A small, public, read-only REST API that serves NBA player bios, stats and
training programs **per season** (e.g. `2025-2026`, `2026-2027`), so the
CourtCraft frontend isn't limited to one hardcoded snapshot in time.

GitHub Pages (where `index.html` is hosted) only serves static files, so this
API is designed to run separately — either locally, or deployed for free to
Vercel/Netlify — and is called from the frontend over `fetch()`.

## Layout

```
backend/
  data/
    roster.json              season-independent player bios (team, position, achievements, philosophy, ...)
    training-templates.json  the 3 position-based training templates (GUARD / WING / BIG)
    seasons/
      index.json             which seasons exist + which is "current"
      2025-2026.json          baseline season: real stats snapshot the site shipped with
      2026-2027.json          generated season: projected stats + training focus
  lib/
    store.js                 reads + caches the JSON data files
    seasonEngine.js           the projection logic used to generate a new season
    handlers.js               request handlers shared by the Express server and the API routes
    cors.js                   public CORS headers
  scripts/
    build-roster.js          one-time: splits the original static data into roster.json + baseline season
    generate-season.js       generates the next season from the latest one
  server.js                  local Express dev server
```

The actual HTTP endpoints live in `/api` at the repo root (Vercel's
file-based routing convention), and just call into `backend/lib/handlers.js`.

## Running locally

```
npm install
npm start          # http://localhost:4000
```

Endpoints:

- `GET /api/health`
- `GET /api/roster` — season-independent player bios
- `GET /api/seasons` — `{ seasons: [...], current: "2026-2027" }`
- `GET /api/seasons/:season/players` — every player's stats + training focus for that season
- `GET /api/seasons/:season/players/:id` — one player's full detail, including the season's training program

All responses are public JSON, `Access-Control-Allow-Origin: *`.

## Adding a new season

Stats aren't hand-typed per player — they're **projected** from the previous
season by `lib/seasonEngine.js`, using an aging curve keyed off each player's
years of experience (young players trend up, veterans trend down), and the
training focus is derived from whichever stat category is projected to move
the most unfavorably. This keeps `git diff` reviewable: a season is one
generated JSON file, not 100 hand-edited player blocks.

```
node backend/scripts/generate-season.js 2027-2028
```

This reads `data/seasons/index.json` to find the latest season, projects the
next one, writes `data/seasons/2027-2028.json`, and marks it `current`.
Commit the result — the frontend picks up new seasons automatically from
`GET /api/seasons`.

To correct a projection with real reported stats once a season actually
happens, just hand-edit that season's JSON file directly; the engine is only
used for seasons that haven't happened yet.

## Deploying

Any static-file + serverless host works out of the box because of the `/api`
folder convention:

- **Vercel**: import the repo, no config needed beyond `vercel.json` already in the repo.
- **Netlify**: point Netlify Functions at `/api` (adjust `netlify.toml` if you
  prefer Netlify's own functions folder convention).

Once deployed, set `window.COURTCRAFT_API_BASE` (see `index.html`) to the
deployed URL so the frontend calls it instead of same-origin `/api`.
