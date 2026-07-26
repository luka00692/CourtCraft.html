const { applyCors, send } = require('../../../../backend/lib/cors');
const { getPlayerForSeason } = require('../../../../backend/lib/handlers');

module.exports = (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  send(res, getPlayerForSeason(req.query.season, req.query.id));
};
