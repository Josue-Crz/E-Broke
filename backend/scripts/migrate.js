// Programmatic migration runner used by the App Platform run command.
// Same as `npm run migrate`, but passes explicit SSL config: DO Managed PG
// uses a self-signed cert chain, which the node-pg-migrate CLI rejects when
// it parses sslmode=require from DATABASE_URL on its own.
require('dotenv').config();

const { runner } = require('node-pg-migrate');

const needsSsl =
  process.env.NODE_ENV === 'production' || /sslmode=require/.test(process.env.DATABASE_URL || '');

runner({
  databaseUrl: {
    connectionString: process.env.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  },
  dir: 'migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
})
  .then((migrations) => {
    console.log(`migrations complete (${migrations.length} applied)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('migration failed:', err.message);
    process.exit(1);
  });
