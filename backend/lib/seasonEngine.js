// Deterministic season-to-season projection logic.
// Given one season's stats, produces next season's stats + a data-driven
// training focus, based on an aging curve keyed off years of experience.
// No randomness: same input always produces the same output, so results
// are reproducible and reviewable in a PR diff.

const AGING_CURVE = [
  { maxYears: 3, countingGrowth: 0.06, shootingGrowth: 1.5 }, // rising rookies/sophomores
  { maxYears: 7, countingGrowth: 0.03, shootingGrowth: 0.8 }, // ascending
  { maxYears: 12, countingGrowth: 0.01, shootingGrowth: 0.3 }, // prime
  { maxYears: 16, countingGrowth: -0.02, shootingGrowth: -0.5 }, // veteran decline
  { maxYears: Infinity, countingGrowth: -0.05, shootingGrowth: -1.5 }, // late-career decline
];

function parseYears(expLabel) {
  const n = parseInt(expLabel, 10);
  return Number.isFinite(n) ? n : 1;
}

function curveFor(years) {
  return AGING_CURVE.find((c) => years <= c.maxYears);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function projectCounting(value, growth) {
  const n = parseFloat(value);
  return (Math.round(n * (1 + growth) * 10) / 10).toFixed(1);
}

function projectShooting(value, growthPoints) {
  return clamp(Math.round(value + growthPoints), 20, 99);
}

function regressCounting(value, growth) {
  const n = parseFloat(value);
  return (Math.round((n / (1 + growth)) * 10) / 10).toFixed(1);
}

function regressShooting(value, growthPoints) {
  return clamp(Math.round(value - growthPoints), 20, 99);
}

// Deterministic, reproducible "games played" filler (0-82, NBA regular season
// length) — there's no real box-score feed behind this site, so this stands
// in for it the same way the rest of the stats do. Seeded off the player id
// + season so it's stable across regenerations, and varies per season rather
// than repeating the same number every year.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function computeGamesPlayed(playerId, seasonLabel) {
  const seed = hashSeed(`${playerId}:${seasonLabel}`);
  return 82 - (seed % 19); // 64-82 games: healthy-to-load-managed range
}

const STAT_LABELS = {
  ppg: 'scoring',
  rpg: 'rebounding',
  apg: 'playmaking',
  spg: 'perimeter defense',
  fg: 'finishing efficiency',
  tp: 'three-point shooting',
  ft: 'free-throw shooting',
};

const STAT_EXERCISES = {
  ppg: [
    { name: 'Game-speed scoring reps', prescription: '6 × 8', note: 'Combine footwork, one dribble and a finish at full pace.' },
    { name: 'Shot-selection film + reps', prescription: '20 min + 4 × 10', note: 'Rehearse the shots the season plan calls for most.' },
  ],
  rpg: [
    { name: 'Box-out & pursuit drills', prescription: '5 × 6', note: 'Contact, seal, and go get the ball off the rim.' },
    { name: 'Anticipation rebounding', prescription: '4 × 10', note: 'React off missed-shot angles, not just position.' },
  ],
  apg: [
    { name: 'Live-read passing series', prescription: '5 × 10', note: 'Advantage creation into a live decision, not a script.' },
    { name: 'Pick-and-roll manipulation', prescription: '5 × 8', note: 'Change speeds and angles to open a passing window.' },
  ],
  spg: [
    { name: 'Passing-lane anticipation', prescription: '5 × 30s', note: 'Read the ball-handler’s eyes and hips to jump the lane.' },
    { name: 'Closeout-to-strip drills', prescription: '4 × 8', note: 'Controlled closeouts that end in a strip, not a foul.' },
  ],
  fg: [
    { name: 'Contact finishing at the rim', prescription: '5 × 8', note: 'Absorb the bump, finish with either hand.' },
    { name: 'Footwork-first post/drive reps', prescription: '4 × 10', note: 'Clean footwork before touch — speed comes second.' },
  ],
  tp: [
    { name: 'Form shooting reset', prescription: '3 × 25 makes', note: 'Rebuild the base, elbow alignment and follow-through.' },
    { name: 'Catch-and-shoot volume', prescription: '200 makes', note: 'High-rep, game-spot repetition to rebuild rhythm.' },
  ],
  ft: [
    { name: 'Routine-locked free throws', prescription: '10 × 10', note: 'Same pre-shot routine every rep, under mild fatigue.' },
  ],
};

/**
 * Projects next season's stats for one player from their previous-season stats.
 */
function projectPlayerStats(prevStats, expLabel, seasonLabel, playerId) {
  const years = parseYears(expLabel);
  const curve = curveFor(years);
  return {
    ppg: projectCounting(prevStats.ppg, curve.countingGrowth),
    rpg: projectCounting(prevStats.rpg, curve.countingGrowth),
    apg: projectCounting(prevStats.apg, curve.countingGrowth),
    spg: projectCounting(prevStats.spg, curve.countingGrowth),
    fg: projectShooting(prevStats.fg, curve.shootingGrowth),
    tp: projectShooting(prevStats.tp, curve.shootingGrowth),
    ft: projectShooting(prevStats.ft, curve.shootingGrowth),
    gp: computeGamesPlayed(playerId, seasonLabel),
  };
}

/**
 * Regresses one season back: given the stats a player had in the LATER
 * season, and their experience as of the EARLIER (target) season, derives
 * what their earlier-season stats would have been — the inverse of
 * projectPlayerStats. Used to backfill historical seasons before the site's
 * baseline snapshot.
 */
function regressPlayerStats(laterStats, earlierExpLabel, earlierSeasonLabel, playerId) {
  const years = parseYears(earlierExpLabel);
  const curve = curveFor(years);
  return {
    ppg: regressCounting(laterStats.ppg, curve.countingGrowth),
    rpg: regressCounting(laterStats.rpg, curve.countingGrowth),
    apg: regressCounting(laterStats.apg, curve.countingGrowth),
    spg: regressCounting(laterStats.spg, curve.countingGrowth),
    fg: regressShooting(laterStats.fg, curve.shootingGrowth),
    tp: regressShooting(laterStats.tp, curve.shootingGrowth),
    ft: regressShooting(laterStats.ft, curve.shootingGrowth),
    gp: computeGamesPlayed(playerId, earlierSeasonLabel),
  };
}

function incrementExp(expLabel) {
  const years = parseYears(expLabel) + 1;
  return `${years} season${years === 1 ? '' : 's'}`;
}

function decrementExp(expLabel) {
  const years = parseYears(expLabel) - 1;
  return years;
}

/**
 * Builds a data-driven training focus by comparing projected vs. previous
 * stats and identifying the category with the weakest (or least-improved) trend.
 */
function buildTrainingFocus(prevStats, nextStats, season) {
  const deltas = Object.keys(STAT_LABELS).map((key) => {
    const before = parseFloat(prevStats[key]);
    const after = parseFloat(nextStats[key]);
    return { key, delta: after - before, relDelta: (after - before) / (before || 1) };
  });
  deltas.sort((a, b) => a.relDelta - b.relDelta);
  const weakest = deltas[0];
  const label = STAT_LABELS[weakest.key];
  const trend = weakest.relDelta < 0 ? 'reverse a projected dip' : 'keep pushing a modest gain';

  return {
    headline: `${season} priority: ${label}`,
    note: `Season projection flags ${label} as the area to ${trend} in — training below is weighted toward it.`,
    priorityStat: weakest.key,
    exercises: STAT_EXERCISES[weakest.key],
  };
}

/**
 * Projects a full season file (stats + trainingFocus for every player) from
 * the previous season's file and the roster (for exp/position lookups).
 */
function projectSeason(prevSeasonData, roster, nextSeasonLabel) {
  const stats = {};
  const trainingFocus = {};
  const expByPlayer = {};

  for (const p of roster) {
    const prev = prevSeasonData.stats[p.id];
    if (!prev) continue;
    const nextStats = projectPlayerStats(prev, p.exp, nextSeasonLabel, p.id);
    stats[p.id] = nextStats;
    trainingFocus[p.id] = buildTrainingFocus(prev, nextStats, nextSeasonLabel);
    expByPlayer[p.id] = incrementExp(p.exp);
  }

  return {
    season: nextSeasonLabel,
    status: 'projected',
    generatedBy: `engine:v1 from ${prevSeasonData.season}`,
    stats,
    trainingFocus,
    expByPlayer,
  };
}

/**
 * Regresses a full season file backward from the next-known season, for
 * backfilling seasons before the site's baseline. Players not yet in the
 * league that far back (years of experience would be < 1) are omitted
 * entirely — they simply have no data for that season, same as in reality.
 */
function regressSeason(laterSeasonData, roster, earlierSeasonLabel) {
  const stats = {};
  const expByPlayer = {};

  for (const p of roster) {
    const later = laterSeasonData.stats[p.id];
    if (!later) continue;
    const laterYears = laterSeasonData.expByPlayer ? parseYears(laterSeasonData.expByPlayer[p.id]) : parseYears(p.exp);
    const earlierYears = laterYears - 1;
    if (earlierYears < 1) continue; // wasn't in the league yet
    const earlierExpLabel = `${earlierYears} season${earlierYears === 1 ? '' : 's'}`;
    stats[p.id] = regressPlayerStats(later, earlierExpLabel, earlierSeasonLabel, p.id);
    expByPlayer[p.id] = earlierExpLabel;
  }

  return {
    season: earlierSeasonLabel,
    status: 'historical',
    generatedBy: `engine:v1 (regressed) from ${laterSeasonData.season}`,
    stats,
    trainingFocus: {},
    expByPlayer,
  };
}

module.exports = {
  projectSeason,
  regressSeason,
  projectPlayerStats,
  regressPlayerStats,
  buildTrainingFocus,
  incrementExp,
  decrementExp,
  computeGamesPlayed,
};
