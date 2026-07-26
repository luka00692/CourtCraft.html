// Run with: node --test backend/test
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listSeasons,
  getRoster,
  listPlayersForSeason,
  getPlayerForSeason,
} = require('../lib/handlers');
const { seasonsIndex, roster } = require('../lib/store');

test('listSeasons returns the registered seasons and a current pointer', () => {
  const { status, body } = listSeasons();
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.seasons) && body.seasons.length > 0);
  assert.ok(body.seasons.includes(body.current));
});

test('getRoster returns every player with a bio', () => {
  const { status, body } = getRoster();
  assert.equal(status, 200);
  assert.equal(body.players.length, roster().length);
  const first = body.players[0];
  assert.ok(first.id && first.name && first.team && first.position);
});

test('listPlayersForSeason 404s on an unknown season', () => {
  const { status, body } = listPlayersForSeason('1999-2000');
  assert.equal(status, 404);
  assert.match(body.error, /Unknown season/);
});

test('listPlayersForSeason returns every roster player, with stats:null for those not yet in the league', () => {
  const seasons = seasonsIndex().seasons;
  const earliest = seasons[0];
  const { status, body } = listPlayersForSeason(earliest);
  assert.equal(status, 200);
  assert.equal(body.players.length, roster().length);
  const withStats = body.players.filter((p) => p.stats);
  const withoutStats = body.players.filter((p) => !p.stats);
  assert.ok(withStats.length > 0, 'at least some players should have stats in the earliest season');
  // Every player without stats should also have no training focus for that season
  for (const p of withoutStats) assert.equal(p.trainingFocus, null);
});

test('getPlayerForSeason 404s on an unknown player id', () => {
  const seasons = seasonsIndex().seasons;
  const { status, body } = getPlayerForSeason(seasons[seasons.length - 1], 'not-a-real-player');
  assert.equal(status, 404);
  assert.match(body.error, /Unknown player/);
});

test('getPlayerForSeason 404s on an unknown season', () => {
  const { status } = getPlayerForSeason('1999-2000', 'lebron');
  assert.equal(status, 404);
});

test('getPlayerForSeason includes a season-priority training block first when stats exist', () => {
  const seasons = seasonsIndex().seasons;
  const current = seasonsIndex().current;
  const { status, body } = getPlayerForSeason(current, 'lebron');
  assert.equal(status, 200);
  assert.ok(body.stats, 'lebron should have stats in the current season');
  assert.ok(Array.isArray(body.training) && body.training.length > 0);
  assert.match(body.training[0].title, /Season priority/);
});

test('getPlayerForSeason returns no training-priority block and null stats for a player not yet in the league that season', () => {
  const seasons = seasonsIndex().seasons;
  const earliest = seasons[0];
  const { body: list } = listPlayersForSeason(earliest);
  const missing = list.players.find((p) => !p.stats);
  assert.ok(missing, 'expected at least one player missing from the earliest season to test against');
  const { status, body } = getPlayerForSeason(earliest, missing.id);
  assert.equal(status, 200);
  assert.equal(body.stats, null);
  assert.ok(Array.isArray(body.training));
  assert.ok(!body.training[0] || !/Season priority/.test(body.training[0].title));
});
