// Public, read-only API — allow any origin so the GitHub Pages frontend
// (or anyone else) can call it directly.
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');
}

function send(res, { status, body }) {
  res.status(status).json(body);
}

module.exports = { applyCors, send };
