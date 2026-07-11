const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Shared limiter for every endpoint that calls Gradient (vision, embeddings).
// Keyed per logged-in user, falling back to IP for anonymous requests.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.session && req.session.userId ? `user:${req.session.userId}` : ipKeyGenerator(req.ip),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests — try again in a few minutes' } },
});

module.exports = { aiLimiter };
