// One-off migration: refreshes the "exercises" array stored in every season
// file's trainingFocus entries from the current STAT_EXERCISES text in
// seasonEngine.js (e.g. after editing exercise descriptions), without
// touching any stats.
const fs = require('fs');
const path = require('path');
const { buildTrainingFocus } = require('../lib/seasonEngine');

const DATA_DIR = path.join(__dirname, '..', 'data');

function exercisesFor(priorityStat) {
  const countingStats = ['ppg', 'rpg', 'apg', 'spg'];
  const dummyPrev = { ppg: '10.0', rpg: '5.0', apg: '5.0', spg: '1.0', fg: 45, tp: 35, ft: 75 };
  const dummyNext = { ...dummyPrev };
  dummyNext[priorityStat] = countingStats.includes(priorityStat)
    ? (parseFloat(dummyPrev[priorityStat]) * 0.5).toFixed(1)
    : Math.round(dummyPrev[priorityStat] * 0.5);
  return buildTrainingFocus(dummyPrev, dummyNext, 'x').exercises;
}

const seasonsDir = path.join(DATA_DIR, 'seasons');
const files = fs.readdirSync(seasonsDir).filter((f) => f.endsWith('.json') && f !== 'index.json');

let totalUpdated = 0;
for (const file of files) {
  const filePath = path.join(seasonsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;
  for (const id of Object.keys(data.trainingFocus || {})) {
    const tf = data.trainingFocus[id];
    if (tf && tf.priorityStat) {
      tf.exercises = exercisesFor(tf.priorityStat);
      changed = true;
      totalUpdated++;
    }
  }
  if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
console.log(`Refreshed exercises for ${totalUpdated} trainingFocus entries across ${files.length} season files.`);
