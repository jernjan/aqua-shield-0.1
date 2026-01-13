/**
 * Data Collection & Snapshots
 * Store daily snapshots of facility risk data for ML training
 */

const { readDB, writeDB } = require('../db');
const { assessAllRisks } = require('./risk');

/**
 * Create daily snapshot of all facilities with their risk scores
 */
async function createDailySnapshot() {
  try {
    const db = await readDB();
    
    if (!db.facilities || db.facilities.length === 0) {
      console.log('⚠️  No facilities to snapshot');
      return null;
    }

    // Calculate risk for all facilities
    const facilitiesWithRisk = await assessAllRisks(db.facilities, db.vessels || []);
    
    const snapshot = {
      id: `snapshot_${Date.now()}`,
      timestamp: new Date().toISOString(),
      facilityCount: facilitiesWithRisk.length,
      criticalCount: facilitiesWithRisk.filter(f => f.riskScore >= 70).length,
      highCount: facilitiesWithRisk.filter(f => f.riskScore >= 50 && f.riskScore < 70).length,
      mediumCount: facilitiesWithRisk.filter(f => f.riskScore >= 30 && f.riskScore < 50).length,
      lowCount: facilitiesWithRisk.filter(f => f.riskScore < 30).length,
      facilities: facilitiesWithRisk,
      avgRiskScore: Math.round(
        facilitiesWithRisk.reduce((sum, f) => sum + f.riskScore, 0) / facilitiesWithRisk.length
      )
    };

    // Store snapshot in history
    if (!db.snapshots) db.snapshots = [];
    db.snapshots.push(snapshot);
    
    // Keep only last 30 days of snapshots
    if (db.snapshots.length > 30) {
      db.snapshots = db.snapshots.slice(-30);
    }

    await writeDB(db);
    
    console.log(`✅ Snapshot created: ${snapshot.facilityCount} facilities, Avg risk: ${snapshot.avgRiskScore}%`);
    return snapshot;

  } catch (err) {
    console.error('❌ Error creating snapshot:', err.message);
    return null;
  }
}

/**
 * Get latest snapshot
 */
async function getLatestSnapshot() {
  try {
    const db = await readDB();
    if (!db.snapshots || db.snapshots.length === 0) return null;
    return db.snapshots[db.snapshots.length - 1];
  } catch (err) {
    console.error('Error getting snapshot:', err);
    return null;
  }
}

/**
 * Get snapshot history (last N days)
 */
async function getSnapshotHistory(days = 7) {
  try {
    const db = await readDB();
    if (!db.snapshots) return [];
    
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.snapshots.filter(s => new Date(s.timestamp) > cutoff);
  } catch (err) {
    console.error('Error getting history:', err);
    return [];
  }
}

module.exports = {
  createDailySnapshot,
  getLatestSnapshot,
  getSnapshotHistory
};
