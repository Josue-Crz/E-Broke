const { Pool } = require('pg');

// One shared connection pool for the whole app.
// DO Managed PostgreSQL requires SSL; local dev Postgres doesn't speak it.
// SSL turns on in production OR when the URL itself demands it (sslmode=require),
// so migrate/seed can target the managed DB from a dev machine.
const needsSsl =
  process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
