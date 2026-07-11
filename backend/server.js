require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const PgSession = require('connect-pg-simple')(session);
const pool = require('./db/pool');
const { HttpError } = require('./utils/errors');

const PORT = process.env.PORT || 3000;

const app = express();

// App Platform runs behind a proxy; needed for secure cookies in production.
app.set('trust proxy', 1);

// Frontend runs on its own origin — cookies require credentials + exact origin.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Session-based auth (team decision — no JWT). Sessions live in Postgres via
// connect-pg-simple, so they survive restarts and work on App Platform.
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  })
);

app.use('/auth', require('./routes/auth'));
app.use('/listings', require('./routes/router'));
app.use('/', require('./routes/misc'));

// Locally-stored listing photos (fallback when DO Spaces isn't configured).
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } });
});

// Catch-all error handler — every thrown/rejected error funnels here.
// Consistent shape: { error: { code, message } }.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
