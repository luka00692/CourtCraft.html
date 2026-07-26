// Backfills seasons before the site's baseline by chaining regressSeason()
// backward from it. Players not yet in the league that far back (their
// experience would regress below 1 season) are simply omitted from that
// season's stats — same as in reality, a rookie has no stats from before
// they were drafted.
//
// Usage: node backend/scripts/generate-historical-seasons.js 4
// (generates the 4 seasons immediately before the current earliest one)
const fs = require('fs');
const path = require('path');
const { regressSeason } = require('../lib/seasonEngine');

const DATA_DIR = path.join(__dirname, '..', 'data');

const count = parseInt(process.argv[2], 10) || 4;

const roster = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'roster.json'), 'utf8'));
const seasonsIndexPath = path.join(DATA_DIR, 'seasons', 'index.json');
const seasonsIndex = JSON.parse(fs.readFileSync(seasonsIndexPath, 'utf8'));

function seasonLabelBefore(label) {
  const [start] = label.split('-').map(Number);
  const prevStart = start - 1;
  return `${prevStart}-${prevStart + 1}`;
}

let cursorLabel = seasonsIndex.seasons[0]; // earliest known season so far
let cursorData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seasons', `${cursorLabel}.json`), 'utf8'));

const generated = [];
for (let i = 0; i < count; i++) {
  const earlierLabel = seasonLabelBefore(cursorLabel);
  const earlierData = regressSeason(cursorData, roster, earlierLabel);
  fs.writeFileSync(path.join(DATA_DIR, 'seasons', `${earlierLabel}.json`), JSON.stringify(earlierData, null, 2));
  generated.push(earlierLabel);
  cursorLabel = earlierLabel;
  cursorData = earlierData;
}

seasonsIndex.seasons = [...generated.reverse(), ...seasonsIndex.seasons];
fs.writeFileSync(seasonsIndexPath, JSON.stringify(seasonsIndex, null, 2));

console.log(`Generated ${generated.length} historical seasons: ${generated.slice().reverse().join(', ')}`);
