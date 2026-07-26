// One-time (re-runnable) transform: splits the extracted static player data
// into a season-independent roster and a baseline season stats snapshot.
// Run with: node backend/scripts/build-roster.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BASELINE_SEASON = '2025-2026';

const players = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'players-extracted.json'), 'utf8'));

const roster = [];
const stats = {};
const trainingFocus = {};

for (const p of players) {
  roster.push({
    id: p.id,
    name: p.name,
    first: p.first,
    team: p.team,
    position: p.position,
    number: p.number,
    height: p.height,
    weight: p.weight,
    accent: p.accent,
    achievements: p.ach,
    philosophy: p.phil,
    trainTemplate: p.train, // "GUARD" | "WING" | "BIG"
    exp: p.exp,
  });

  stats[p.id] = {
    ppg: p.ppg,
    rpg: p.rpg,
    apg: p.apg,
    spg: p.spg,
    fg: p.fg,
    tp: p.tp,
    ft: p.ft,
  };

  trainingFocus[p.id] = {
    headline: 'Baseline season on record.',
    note: 'This is the most recent completed-season snapshot used as the projection baseline for future seasons.',
  };
}

fs.writeFileSync(path.join(DATA_DIR, 'roster.json'), JSON.stringify(roster, null, 2));

fs.writeFileSync(
  path.join(DATA_DIR, 'seasons', `${BASELINE_SEASON}.json`),
  JSON.stringify({ season: BASELINE_SEASON, status: 'completed', generatedBy: 'baseline', stats, trainingFocus }, null, 2)
);

fs.writeFileSync(
  path.join(DATA_DIR, 'seasons', 'index.json'),
  JSON.stringify({ seasons: [BASELINE_SEASON], current: BASELINE_SEASON }, null, 2)
);

console.log(`Wrote roster.json (${roster.length} players) and seasons/${BASELINE_SEASON}.json`);
