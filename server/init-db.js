/**
 * Database Schema Initialization
 * Run this once to create tables
 */

const pool = require('./database');
require('dotenv').config();

async function initDatabase() {
  console.log('[Init DB] Starting schema initialization...');

  try {
    // Create alerts_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts_history (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(50) UNIQUE NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        facility_id VARCHAR(100) NOT NULL,
        disease_type VARCHAR(100),
        severity VARCHAR(50),
        region VARCHAR(100),
        title VARCHAR(255),
        risk_score INTEGER,
        alert_triggered BOOLEAN DEFAULT true,
        outbreak_confirmed BOOLEAN,
        vessel_traffic_nearby JSONB DEFAULT '[]',
        environmental_data JSONB DEFAULT '{}',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Init DB] ✓ Created alerts_history table');

    // Create vessel_movements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vessel_movements (
        id SERIAL PRIMARY KEY,
        vessel_id VARCHAR(50) UNIQUE NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mmsi VARCHAR(20),
        vessel_name VARCHAR(255),
        lat NUMERIC(10, 6),
        lon NUMERIC(10, 6),
        nearest_facility VARCHAR(100),
        distance_km NUMERIC(10, 2),
        heading INTEGER,
        speed_knots NUMERIC(8, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Init DB] ✓ Created vessel_movements table');

    // Create indices for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_facility ON alerts_history(facility_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_disease ON alerts_history(disease_type);
      CREATE INDEX IF NOT EXISTS idx_alerts_confirmed ON alerts_history(outbreak_confirmed);
      CREATE INDEX IF NOT EXISTS idx_vessel_facility ON vessel_movements(nearest_facility);
      CREATE INDEX IF NOT EXISTS idx_vessel_timestamp ON vessel_movements(timestamp);
      CREATE INDEX IF NOT EXISTS idx_vessel_mmsi ON vessel_movements(mmsi);
    `);
    console.log('[Init DB] ✓ Created indices');

    console.log('[Init DB] ✓ Schema initialization complete');
    process.exit(0);

  } catch (err) {
    console.error('[Init DB] ERROR:', err.message);
    console.error('[Init DB] Make sure PostgreSQL is running and credentials are correct');
    process.exit(1);
  }
}

// Run initialization
initDatabase();
