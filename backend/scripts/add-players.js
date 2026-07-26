// Merges a batch of new players (bio + 2025-2026 baseline stats) into
// roster.json and every existing season file — projecting 2026-2027 forward
// and regressing 2021-2022..2024-2025 backward for each new player, exactly
// like the rest of the roster, so no season is left with gaps.
//
// Usage: node backend/scripts/add-players.js path/to/new-players.json
// Input shape: array of {
//   id,name,first,team,position,number,height,weight,exp,accentKey,
//   achievements,philosophy,trainTemplate,stats2025_2026:{ppg,rpg,apg,spg,fg,tp,ft}
// }
const fs = require('fs');
const path = require('path');
const {
  projectPlayerStats,
  regressPlayerStats,
  buildTrainingFocus,
  incrementExp,
  computeGamesPlayed,
} = require('../lib/seasonEngine');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BASELINE_SEASON = '2025-2026';

const ACCENTS = { G: '#006F9B', D: '#003040', M6: '#005C81', M4: '#2284AC', M7: '#004A68', M3: '#4F9DBF' };

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node backend/scripts/add-players.js <path-to-new-players.json>');
  process.exit(1);
}

const newPlayers = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const roster = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'roster.json'), 'utf8'));
const existingIds = new Set(roster.map((p) => p.id));

const duplicates = newPlayers.filter((p) => existingIds.has(p.id));
if (duplicates.length) {
  console.error('Refusing to run: these ids already exist in roster.json:', duplicates.map((p) => p.id));
  process.exit(1);
}

function parseYears(expLabel) {
  const n = parseInt(expLabel, 10);
  return Number.isFinite(n) ? n : 1;
}

// 1. Append to roster.json
for (const p of newPlayers) {
  roster.push({
    id: p.id,
    name: p.name,
    first: p.first,
    team: p.team,
    position: p.position,
    number: p.number,
    height: p.height,
    weight: p.weight,
    accent: ACCENTS[p.accentKey] || ACCENTS.G,
    achievements: p.achievements,
    philosophy: p.philosophy,
    trainTemplate: p.trainTemplate,
    exp: p.exp,
  });
}
fs.writeFileSync(path.join(DATA_DIR, 'roster.json'), JSON.stringify(roster, null, 2));

// 2. Append to the baseline season (2025-2026)
const baselinePath = path.join(DATA_DIR, 'seasons', `${BASELINE_SEASON}.json`);
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
for (const p of newPlayers) {
  baseline.stats[p.id] = { ...p.stats2025_2026, gp: computeGamesPlayed(p.id, BASELINE_SEASON) };
  baseline.trainingFocus[p.id] = {
    headline: 'Baseline season on record.',
    note: 'This is the most recent completed-season snapshot used as the projection baseline for future seasons.',
  };
}
fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

// 3. Project forward into 2026-2027 (if it exists)
const projectedPath = path.join(DATA_DIR, 'seasons', '2026-2027.json');
if (fs.existsSync(projectedPath)) {
  const projected = JSON.parse(fs.readFileSync(projectedPath, 'utf8'));
  for (const p of newPlayers) {
    const prev = baseline.stats[p.id];
    const nextStats = projectPlayerStats(prev, p.exp, projected.season, p.id);
    projected.stats[p.id] = nextStats;
    projected.trainingFocus[p.id] = buildTrainingFocus(prev, nextStats, projected.season);
    projected.expByPlayer[p.id] = incrementExp(p.exp);
  }
  fs.writeFileSync(projectedPath, JSON.stringify(projected, null, 2));
}

// 4. Regress backward through each historical season, oldest last, skipping
// players not yet in the league that far back (same rule as generate-historical-seasons.js)
const seasonsIndexPath = path.join(DATA_DIR, 'seasons', 'index.json');
const seasonsIndex = JSON.parse(fs.readFileSync(seasonsIndexPath, 'utf8'));
const historicalSeasons = seasonsIndex.seasons.filter((s) => s < BASELINE_SEASON).sort().reverse(); // newest historical first

let cursorStats = baseline.stats; // keyed by id, this season's stats
let cursorYears = {};
for (const p of newPlayers) cursorYears[p.id] = parseYears(p.exp);

for (const label of historicalSeasons) {
  const seasonPath = path.join(DATA_DIR, 'seasons', `${label}.json`);
  const season = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
  const nextCursorStats = {};
  const nextCursorYears = {};
  for (const p of newPlayers) {
    if (cursorYears[p.id] === undefined) continue; // already dropped out in an earlier (later-season) iteration
    const laterYears = cursorYears[p.id];
    const earlierYears = laterYears - 1;
    if (earlierYears < 1) continue; // wasn't in the league yet
    const earlierExpLabel = `${earlierYears} season${earlierYears === 1 ? '' : 's'}`;
    const laterStats = cursorStats[p.id];
    season.stats[p.id] = regressPlayerStats(laterStats, earlierExpLabel, label, p.id);
    season.expByPlayer[p.id] = earlierExpLabel;
    nextCursorStats[p.id] = season.stats[p.id];
    nextCursorYears[p.id] = earlierYears;
  }
  fs.writeFileSync(seasonPath, JSON.stringify(season, null, 2));
  cursorStats = nextCursorStats;
  cursorYears = nextCursorYears;
}

console.log(`Added ${newPlayers.length} players to roster.json and all ${1 + (fs.existsSync(projectedPath) ? 1 : 0) + historicalSeasons.length} season files.`);
