/**
 * DataLogger - Historisk logging av varsler og båttrafikk
 * Phase 2: PostgreSQL storage with in-memory fallback
 * Phase 3: ML training data export
 */

const { pool, useInMemory } = require('./database');

class DataLogger {
  constructor() {
    this.pool = pool;
    this.useInMemory = useInMemory;
    
    // In-memory fallback storage
    this.alerts_history = [];
    this.vessel_movements = [];
    this.id_counter = 0;
    
    if (this.useInMemory) {
      console.log('[DataLogger] Using in-memory storage (install PostgreSQL for persistence)');
    }
  }

  /**
   * Log an alert with all context
   * @param {Object} data - Alert data
   * @param {string} data.facility_id - Facility ID
   * @param {string} data.disease_type - 'Sea Lice', 'IPN', 'FAS', etc
   * @param {string} data.severity - 'risikofylt', 'høy oppmerksomhet', 'moderat'
   * @param {string} data.region - Region name
   * @param {string} data.title - Alert title
   * @param {number} data.risk_score - 0-100
   */
  async logAlert(data) {
    const alert_id = `alert_${++this.id_counter}_${Date.now()}`;
    
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        const result = await this.pool.query(
          `INSERT INTO alerts_history 
           (alert_id, facility_id, disease_type, severity, region, title, risk_score, 
            vessel_traffic_nearby, environmental_data, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            alert_id,
            data.facility_id,
            data.disease_type,
            data.severity,
            data.region,
            data.title,
            data.risk_score,
            JSON.stringify(data.vessel_traffic_nearby || []),
            JSON.stringify(data.environmental_data || {}),
            data.notes || ''
          ]
        );

        console.log(`[DataLogger] Alert logged: ${alert_id}`);
        return result.rows[0];
      } catch (err) {
        console.error('[DataLogger] Error logging alert to DB:', err.message);
        console.log('[DataLogger] Falling back to in-memory storage');
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory storage
    const alert = {
      id: alert_id,
      alert_id: alert_id,
      timestamp: new Date().toISOString(),
      facility_id: data.facility_id,
      disease_type: data.disease_type,
      severity: data.severity,
      region: data.region,
      title: data.title,
      risk_score: data.risk_score,
      alert_triggered: true,
      outbreak_confirmed: null,
      vessel_traffic_nearby: data.vessel_traffic_nearby || [],
      environmental_data: data.environmental_data || {},
      notes: data.notes || ''
    };

    this.alerts_history.push(alert);
    console.log(`[DataLogger] Alert logged (in-memory): ${alert_id}`);
    return alert;
  }

  /**
   * Log vessel position from AIS
   * @param {Object} data - Vessel position
   * @param {string} data.mmsi - Maritime Mobile Service Identity
   * @param {string} data.vessel_name - Ship name
   * @param {number} data.lat - Latitude
   * @param {number} data.lon - Longitude
   * @param {string} data.nearest_facility - Nearest facility ID
   * @param {number} data.distance_km - Distance to facility
   */
  async logVesselPosition(data) {
    const vessel_id = `vessel_${data.mmsi}_${Date.now()}`;
    
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        const result = await this.pool.query(
          `INSERT INTO vessel_movements 
           (vessel_id, mmsi, vessel_name, lat, lon, nearest_facility, distance_km, heading, speed_knots)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            vessel_id,
            data.mmsi,
            data.vessel_name,
            data.lat,
            data.lon,
            data.nearest_facility,
            data.distance_km,
            data.heading || null,
            data.speed_knots || null
          ]
        );

        console.log(`[DataLogger] Vessel logged: ${data.mmsi} - ${data.distance_km}km from ${data.nearest_facility}`);
        return result.rows[0];
      } catch (err) {
        console.error('[DataLogger] Error logging vessel to DB:', err.message);
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory storage
    const movement = {
      id: vessel_id,
      vessel_id: vessel_id,
      timestamp: new Date().toISOString(),
      mmsi: data.mmsi,
      vessel_name: data.vessel_name,
      lat: data.lat,
      lon: data.lon,
      nearest_facility: data.nearest_facility,
      distance_km: data.distance_km,
      heading: data.heading || null,
      speed_knots: data.speed_knots || null
    };

    this.vessel_movements.push(movement);
    console.log(`[DataLogger] Vessel logged (in-memory): ${data.mmsi} - ${data.distance_km}km from ${data.nearest_facility}`);
    return movement;
  }

  /**
   * Get alerts history with optional filtering
   * @param {Object} filters - Optional filters
   * @param {string} filters.facility_id - Filter by facility
   * @param {string} filters.disease_type - Filter by disease
   * @param {number} filters.days - Last N days
   */
  async getAlertsHistory(filters = {}) {
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        let query = 'SELECT * FROM alerts_history WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (filters.facility_id) {
          query += ` AND facility_id = $${paramCount++}`;
          params.push(filters.facility_id);
        }

        if (filters.disease_type) {
          query += ` AND disease_type = $${paramCount++}`;
          params.push(filters.disease_type);
        }

        if (filters.days) {
          query += ` AND timestamp > NOW() - INTERVAL '${filters.days} days'`;
        }

        query += ' ORDER BY timestamp DESC';

        const result = await this.pool.query(query, params);
        return result.rows;
      } catch (err) {
        console.error('[DataLogger] Error fetching alerts from DB:', err.message);
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory
    let results = [...this.alerts_history];

    if (filters.facility_id) {
      results = results.filter(a => a.facility_id === filters.facility_id);
    }

    if (filters.disease_type) {
      results = results.filter(a => a.disease_type === filters.disease_type);
    }

    if (filters.days) {
      const cutoff = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
      results = results.filter(a => new Date(a.timestamp) > cutoff);
    }

    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get vessel movements history
   * @param {Object} filters - Optional filters
   * @param {string} filters.mmsi - Filter by MMSI
   * @param {string} filters.facility_id - Filter by facility
   * @param {number} filters.days - Last N days
   */
  async getVesselMovements(filters = {}) {
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        let query = 'SELECT * FROM vessel_movements WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (filters.mmsi) {
          query += ` AND mmsi = $${paramCount++}`;
          params.push(filters.mmsi);
        }

        if (filters.facility_id) {
          query += ` AND nearest_facility = $${paramCount++}`;
          params.push(filters.facility_id);
        }

        if (filters.days) {
          query += ` AND timestamp > NOW() - INTERVAL '${filters.days} days'`;
        }

        query += ' ORDER BY timestamp DESC';

        const result = await this.pool.query(query, params);
        return result.rows;
      } catch (err) {
        console.error('[DataLogger] Error fetching vessels from DB:', err.message);
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory
    let results = [...this.vessel_movements];

    if (filters.mmsi) {
      results = results.filter(m => m.mmsi === filters.mmsi);
    }

    if (filters.facility_id) {
      results = results.filter(m => m.nearest_facility === filters.facility_id);
    }

    if (filters.days) {
      const cutoff = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
      results = results.filter(m => new Date(m.timestamp) > cutoff);
    }

    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Confirm or deny an alert outbreak
   * Used for training data - mark actual vs false positive
   */
  async updateAlertOutbreak(alertId, confirmed, notes = '') {
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        const result = await this.pool.query(
          `UPDATE alerts_history 
           SET outbreak_confirmed = $1, notes = $2, updated_at = NOW()
           WHERE alert_id = $3
           RETURNING *`,
          [confirmed, notes, alertId]
        );

        if (result.rows.length === 0) {
          console.log(`[DataLogger] Alert ${alertId} not found in DB`);
          // Try in-memory fallback
          this.useInMemory = true;
        } else {
          console.log(`[DataLogger] Alert ${alertId} outbreak marked as: ${confirmed}`);
          return result.rows[0];
        }
      } catch (err) {
        console.error('[DataLogger] Error updating alert in DB:', err.message);
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory
    const alert = this.alerts_history.find(a => a.alert_id === alertId || a.id === alertId);
    if (alert) {
      alert.outbreak_confirmed = confirmed;
      alert.notes = notes;
      console.log(`[DataLogger] Alert ${alertId} outbreak marked as: ${confirmed} (in-memory)`);
      return alert;
    }
    
    console.log(`[DataLogger] Alert ${alertId} not found`);
    return null;
  }

  /**
   * Export data for ML training
   * Returns alerts with vessel proximity data joined
   */
  async exportTrainingData(filters = {}) {
    try {
      const alerts = await this.getAlertsHistory(filters);
      const movements = await this.getVesselMovements(filters);

      // Join alerts with nearby vessel movements
      const trainingData = alerts.map(alert => {
        const alertTimestamp = alert.timestamp || new Date().toISOString();
        const nearbyVessels = movements.filter(m => {
          const movementTimestamp = m.timestamp || new Date().toISOString();
          return m.nearest_facility === alert.facility_id &&
            Math.abs(new Date(movementTimestamp) - new Date(alertTimestamp)) < 24 * 60 * 60 * 1000 // 24h window
        });

        return {
          ...alert,
          nearby_vessel_traffic: nearbyVessels
        };
      });

      return {
        total_alerts: trainingData.length,
        confirmed_outbreaks: trainingData.filter(a => a.outbreak_confirmed === true).length,
        false_positives: trainingData.filter(a => a.outbreak_confirmed === false).length,
        pending_review: trainingData.filter(a => a.outbreak_confirmed === null).length,
        data: trainingData
      };
    } catch (err) {
      console.error('[DataLogger] Error exporting training data:', err.message);
      throw err;
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    // Use PostgreSQL if available, otherwise in-memory
    if (!this.useInMemory && this.pool) {
      try {
        const result = await this.pool.query(`
          SELECT
            COUNT(*) as total_alerts_logged,
            SUM(CASE WHEN outbreak_confirmed = true THEN 1 ELSE 0 END) as confirmed_outbreaks,
            SUM(CASE WHEN outbreak_confirmed = false THEN 1 ELSE 0 END) as false_positives,
            SUM(CASE WHEN outbreak_confirmed IS NULL THEN 1 ELSE 0 END) as pending_review,
            (SELECT COUNT(*) FROM vessel_movements) as total_vessel_movements,
            MAX(timestamp) as last_alert,
            (SELECT MAX(timestamp) FROM vessel_movements) as last_vessel
          FROM alerts_history
        `);

        const stats = result.rows[0];

        // Get disease breakdown
        const diseaseResult = await this.pool.query(`
          SELECT disease_type, COUNT(*) as count
          FROM alerts_history
          GROUP BY disease_type
          ORDER BY count DESC
        `);

        const disease_breakdown = {};
        diseaseResult.rows.forEach(row => {
          disease_breakdown[row.disease_type] = parseInt(row.count);
        });

        return {
          total_alerts_logged: parseInt(stats.total_alerts_logged),
          confirmed_outbreaks: parseInt(stats.confirmed_outbreaks) || 0,
          false_positives: parseInt(stats.false_positives) || 0,
          pending_review: parseInt(stats.pending_review) || 0,
          total_vessel_movements: parseInt(stats.total_vessel_movements),
          disease_breakdown: disease_breakdown,
          last_alert: stats.last_alert,
          last_vessel: stats.last_vessel
        };
      } catch (err) {
        console.error('[DataLogger] Error getting stats from DB:', err.message);
        this.useInMemory = true;
      }
    }
    
    // Fallback: in-memory
    const allAlerts = this.alerts_history;
    const confirmed = allAlerts.filter(a => a.outbreak_confirmed === true).length;
    const falsePos = allAlerts.filter(a => a.outbreak_confirmed === false).length;
    const pending = allAlerts.filter(a => a.outbreak_confirmed === null).length;

    const diseaseBreakdown = {};
    allAlerts.forEach(a => {
      diseaseBreakdown[a.disease_type] = (diseaseBreakdown[a.disease_type] || 0) + 1;
    });

    return {
      total_alerts_logged: allAlerts.length,
      confirmed_outbreaks: confirmed,
      false_positives: falsePos,
      pending_review: pending,
      total_vessel_movements: this.vessel_movements.length,
      disease_breakdown: diseaseBreakdown,
      last_alert: allAlerts.length > 0 ? allAlerts[0].timestamp : null,
      last_vessel: this.vessel_movements.length > 0 ? this.vessel_movements[0].timestamp : null
    };
  }
}

// Singleton instance
const logger = new DataLogger();

module.exports = logger;
