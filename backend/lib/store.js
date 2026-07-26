const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, relPath), 'utf8'));
}

// Cache in memory: data files only change via the generate-season script
// (i.e. a new deploy), never at request time.
let _roster, _templates, _seasonsIndex;
const _seasonCache = {};

function roster() {
  if (!_roster) _roster = readJSON('roster.json');
  return _roster;
}

function trainingTemplates() {
  if (!_templates) _templates = readJSON('training-templates.json');
  return _templates;
}

function seasonsIndex() {
  if (!_seasonsIndex) _seasonsIndex = readJSON('seasons/index.json');
  return _seasonsIndex;
}

function seasonExists(season) {
  return seasonsIndex().seasons.includes(season);
}

function seasonData(season) {
  if (!seasonExists(season)) return null;
  if (!_seasonCache[season]) _seasonCache[season] = readJSON(`seasons/${season}.json`);
  return _seasonCache[season];
}

module.exports = { roster, trainingTemplates, seasonsIndex, seasonExists, seasonData, DATA_DIR };
