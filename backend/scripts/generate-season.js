// Generates the next season's stats + training focus from the latest known
// season, using the aging-curve projection in lib/seasonEngine.js, and
// registers it in data/seasons/index.json.
//
// Usage: node backend/scripts/generate-season.js 2026-2027
const fs = require('fs');
const path = require('path');
const { projectSeason } = require('../lib/seasonEngine');

const DATA_DIR = path.join(__dirname, '..', 'data');

const nextSeasonLabel = process.argv[2];
if (!nextSeasonLabel || !/^\d{4}-\d{4}$/.test(nextSeasonLabel)) {
  console.error('Usage: node backend/scripts/generate-season.js <YYYY-YYYY>, e.g. 2026-2027');
  process.exit(1);
}

const roster = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'roster.json'), 'utf8'));
const seasonsIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seasons', 'index.json'), 'utf8'));

if (seasonsIndex.seasons.includes(nextSeasonLabel)) {
  console.error(`Season ${nextSeasonLabel} already exists in seasons/index.json`);
  process.exit(1);
}

const latestLabel = seasonsIndex.seasons[seasonsIndex.seasons.length - 1];
const latestSeason = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seasons', `${latestLabel}.json`), 'utf8'));

const next = projectSeason(latestSeason, roster, nextSeasonLabel);

fs.writeFileSync(path.join(DATA_DIR, 'seasons', `${nextSeasonLabel}.json`), JSON.stringify(next, null, 2));

// Deliberately NOT promoted to `current`: this season's stats are a
// projection (status: "projected"), not real reported numbers, so the site
// must keep defaulting to the last real season until someone replaces the
// projection with actual stats and promotes it — see
// backend/README.md#promoting-a-season.
seasonsIndex.seasons.push(nextSeasonLabel);
fs.writeFileSync(path.join(DATA_DIR, 'seasons', 'index.json'), JSON.stringify(seasonsIndex, null, 2));

console.log(`Generated data/seasons/${nextSeasonLabel}.json from ${latestLabel} (projected, not yet current).`);
console.log(`It's selectable in the dropdown, but the site keeps defaulting to "${seasonsIndex.current}" until you promote it — see backend/README.md#promoting-a-season.`);
