/**
 * PostgreSQL Database Connection Pool
 * Phase 2: Database setup
 * 
 * Fallback to in-memory if PostgreSQL unavailable (for MVP testing)
 */

const { Pool } = require('pg');
require('dotenv').config();

let pool;
let useInMemory = false;

try {
  // Create connection pool
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'aquashield_dev',
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  // Handle pool errors
  pool.on('error', (err, client) => {
    console.error('[DB] Unexpected error on idle client', err);
  });

  // Test connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.warn('[DB] PostgreSQL connection failed:', err.message);
      console.warn('[DB] ⚠️  Falling back to in-memory storage (data will be lost on restart)');
      useInMemory = true;
      pool = null;
    } else {
      console.log('[DB] ✓ Connected to PostgreSQL');
    }
  });
} catch (err) {
  console.warn('[DB] Failed to initialize PostgreSQL:', err.message);
  console.warn('[DB] ⚠️  Using in-memory storage instead (install PostgreSQL for persistence)');
  useInMemory = true;
  pool = null;
}

module.exports = { pool, useInMemory };

