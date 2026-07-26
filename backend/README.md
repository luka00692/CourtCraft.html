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
      2021-2022.json          historical: regressed backward from the baseline
      2022-2023.json          historical: regressed backward from the baseline
      2023-2024.json          historical: regressed backward from the baseline
      2024-2025.json          historical: regressed backward from the baseline
      2025-2026.json          baseline season: real stats snapshot the site shipped with
      2026-2027.json          generated season: projected stats + training focus
  lib/
    store.js                 reads + caches the JSON data files
    seasonEngine.js           the projection/regression logic used to generate seasons
    handlers.js               request handlers shared by the Express server and the API routes
    cors.js                   public CORS headers
  scripts/
    build-roster.js                    one-time: splits the original static data into roster.json + baseline season
    generate-season.js                 generates the next (future) season from the latest one
    generate-historical-seasons.js     backfills seasons before the earliest known one
    promote-season.js                  makes a season the site's default, once it has real stats
    add-players.js                     adds new players to the roster + every existing season
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

Per-season player stats include `gp` (games played, 0-82) alongside `ppg` /
`rpg` / `apg` / `spg` / `fg` / `tp` / `ft`. A player not yet in the league
that season (e.g. a 2024 rookie has no `2021-2022` season) gets `stats: null`
in the response instead of fabricated numbers — the frontend hides them for
that season rather than showing a stat line that never happened.

## Adding players

New players need bio info (`roster.json`), a baseline season stat line, and
projected/historical stats for every other season — `add-players.js` does
all three in one pass, given just their bio + 2025-2026 stats:

```
node backend/scripts/add-players.js path/to/new-players.json
```

Input is a JSON array of objects shaped like:

```json
{
  "id": "kebab-case-unique-slug",
  "name": "Full Name", "first": "First", "team": "Team Name",
  "position": "Guard" | "Forward" | "Center",
  "number": "0", "height": "6'5\"", "weight": "200 lb",
  "exp": "5 seasons",
  "accentKey": "G" | "D" | "M6" | "M4" | "M7" | "M3",
  "achievements": [{ "c": "1", "l": "All-Star" }],
  "philosophy": "...",
  "trainTemplate": "GUARD" | "WING" | "BIG",
  "stats2025_2026": { "ppg": "20.0", "rpg": "5.0", "apg": "5.0", "spg": "1.0", "fg": 47, "tp": 36, "ft": 80 }
}
```

It refuses to run if any `id` already exists in `roster.json`. New players
also need adding to the frontend's static `PLAYERS` array in `index.html`
(bio + baseline stats, in the same shape as the existing entries) — the API
only supplies the season-specific overlay for ids the frontend already knows
about.

## Historical seasons

```
node backend/scripts/generate-historical-seasons.js 4
```

Backfills seasons before the earliest one currently in `seasons/index.json`
by running the aging curve **in reverse** off the earliest known season —
same engine as forward projection, just inverted, so a player's stats trend
down the further back you go (and up if projecting forward). A player whose
regressed experience would drop below 1 season is left out of that season
entirely, the same way a rookie has no NBA stats from before they were
drafted.

These are also placeholder/illustrative numbers, same as the projected
season — not real historical box scores. If you have real historical stats
for a season, hand-edit that season's JSON file directly and change its
`"status"` from `"historical"` to `"completed"`.

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
next one, and writes `data/seasons/2027-2028.json` with `"status": "projected"`.
It does **not** touch `current` — see below.

## Promoting a season

`seasons/index.json`'s `current` field is what the site defaults to for every
visitor, so it must only ever point at a season with **real** stats — never
a projection, even after that season has technically tipped off. Showing
placeholder aging-curve numbers as if they were this year's actual stats
would be misleading.

So the flow for a new season is two steps, done at two different times:

1. **Right away** (offseason): `generate-season.js` creates the projection.
   It's immediately selectable in the site's season dropdown, clearly marked
   "projected" — but it is not the default.
2. **Once real games have been played and real stats are known**: hand-edit
   that season's `data/seasons/<season>.json` — replace the projected `stats`
   and `trainingFocus` with real reported numbers, and change `"status"` from
   `"projected"` to `"in-progress"` or `"completed"`. Then run:

   ```
   node backend/scripts/promote-season.js 2026-2027
   ```

   This refuses to run (on purpose) if the season's `status` is still
   `"projected"`, so a season can't accidentally go live with placeholder
   numbers. Commit the result — the frontend picks up the new default
   automatically from `GET /api/seasons`.

## Deploying

Any static-file + serverless host works out of the box because of the `/api`
folder convention:

- **Vercel**: import the repo, no config needed beyond `vercel.json` already in the repo.
- **Netlify**: point Netlify Functions at `/api` (adjust `netlify.toml` if you
  prefer Netlify's own functions folder convention).

Once deployed, set `window.COURTCRAFT_API_BASE` (see `index.html`) to the
deployed URL so the frontend calls it instead of same-origin `/api`.
