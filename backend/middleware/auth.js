const pool = require('../db/pool');

// Logged in at all (session cookie present and valid).
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Log in first' } });
  }
  next();
}

// Logged in AND email-verified — required for posting, claiming, messaging.
async function requireVerified(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Log in first' } });
  }
  const { rows } = await pool.query('SELECT verified_at FROM users WHERE id = $1', [req.session.userId]);
  if (!rows[0]) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Account no longer exists' } });
  }
  if (!rows[0].verified_at) {
    return res.status(403).json({
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your @sfsu.edu email before doing this' },
    });
  }
  next();
}

module.exports = { requireAuth, requireVerified };
