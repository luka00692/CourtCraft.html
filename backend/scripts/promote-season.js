// Promotes a season to `current` — the one the site shows by default.
// Refuses to promote a season still marked "projected", since that would
// make placeholder/aging-curve numbers look like real reported stats.
// Once you've edited data/seasons/<season>.json with real reported stats
// and changed its "status" to "in-progress" or "completed", run:
//
//   node backend/scripts/promote-season.js 2026-2027
//
// Pass --force to promote a still-projected season anyway (rare — e.g. you
// deliberately want to preview projections site-wide).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const label = process.argv[2];
const force = process.argv.includes('--force');
if (!label || !/^\d{4}-\d{4}$/.test(label)) {
  console.error('Usage: node backend/scripts/promote-season.js <YYYY-YYYY> [--force]');
  process.exit(1);
}

const seasonsIndexPath = path.join(DATA_DIR, 'seasons', 'index.json');
const seasonPath = path.join(DATA_DIR, 'seasons', `${label}.json`);

const seasonsIndex = JSON.parse(fs.readFileSync(seasonsIndexPath, 'utf8'));
if (!seasonsIndex.seasons.includes(label)) {
  console.error(`Unknown season "${label}" — generate it first with generate-season.js`);
  process.exit(1);
}

const season = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
if (season.status === 'projected' && !force) {
  console.error(
    `Refusing to promote ${label}: its status is still "projected" (placeholder stats).\n` +
      `Replace data/seasons/${label}.json's stats with real reported numbers, set "status" to\n` +
      `"in-progress" or "completed", then re-run this script. Or pass --force to override.`
  );
  process.exit(1);
}

seasonsIndex.current = label;
fs.writeFileSync(seasonsIndexPath, JSON.stringify(seasonsIndex, null, 2));
console.log(`Promoted ${label} to current. The site will now default to it.`);
