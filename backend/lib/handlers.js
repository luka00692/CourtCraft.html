// Framework-agnostic request handlers, shared by the local Express server
// (server.js) and the Vercel serverless functions (/api/**). Each returns
// { status, body } so both hosts can adapt it to their own response API.
const { roster, trainingTemplates, seasonsIndex, seasonExists, seasonData } = require('./store');

function publicBio(p) {
  const { id, name, first, team, position, number, height, weight, accent, achievements, philosophy } = p;
  return { id, name, first, team, position, number, height, weight, accent, achievements, philosophy };
}

function notFound(message) {
  return { status: 404, body: { error: message } };
}

function listSeasons() {
  return { status: 200, body: seasonsIndex() };
}

function getRoster() {
  return { status: 200, body: { players: roster() } };
}

function listPlayersForSeason(season) {
  if (!seasonExists(season)) return notFound(`Unknown season "${season}"`);
  const data = seasonData(season);
  const players = roster().map((p) => ({
    ...publicBio(p),
    season: data.season,
    seasonStatus: data.status,
    exp: (data.expByPlayer && data.expByPlayer[p.id]) || p.exp,
    stats: data.stats[p.id] || null,
    trainingFocus: data.trainingFocus[p.id] || null,
  }));
  return { status: 200, body: { season: data.season, status: data.status, players } };
}

function getPlayerForSeason(season, id) {
  if (!seasonExists(season)) return notFound(`Unknown season "${season}"`);
  const p = roster().find((r) => r.id === id);
  if (!p) return notFound(`Unknown player "${id}"`);
  const data = seasonData(season);
  const templates = trainingTemplates();
  const focus = data.trainingFocus[id] || null;
  const priorityBlock = focus
    ? { title: `Season priority — ${data.season}`, focus: focus.headline, day: 'Priority', exercises: focus.exercises }
    : null;
  const baseTraining = templates[p.trainTemplate] || [];

  return {
    status: 200,
    body: {
      ...publicBio(p),
      season: data.season,
      seasonStatus: data.status,
      exp: (data.expByPlayer && data.expByPlayer[id]) || p.exp,
      stats: data.stats[id] || null,
      trainingFocus: focus,
      training: priorityBlock ? [priorityBlock, ...baseTraining] : baseTraining,
    },
  };
}

module.exports = { listSeasons, getRoster, listPlayersForSeason, getPlayerForSeason };
