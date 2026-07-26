const { applyCors, send } = require('../../../../backend/lib/cors');
const { listPlayersForSeason } = require('../../../../backend/lib/handlers');

module.exports = (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  send(res, listPlayersForSeason(req.query.season));
};
