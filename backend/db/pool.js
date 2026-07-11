const { Pool } = require('pg');

// One shared connection pool for the whole app.
// DO Managed PostgreSQL requires SSL; local dev Postgres doesn't speak it.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
