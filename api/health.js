const { applyCors } = require('../backend/lib/cors');

module.exports = (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.status(200).json({ ok: true, service: 'courtcraft-api' });
};
