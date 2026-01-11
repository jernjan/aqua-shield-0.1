/**
 * Alert Service - Monitors facility risk and triggers alerts
 * Alerts go directly to anleggene (facilities), not authorities
 */

const fs = require('fs');
const path = require('path');

const ALERTS_FILE = path.join(__dirname, '../data/alerts-history.json');
const ALERT_THRESHOLDS = {
  HIGH: 50,      // Yellow alert
  CRITICAL: 70   // Red alert
};

const ALERT_STATES = {
  LOW: 'LAV',           // 0-29
  MODERATE: 'MODERAT',  // 30-49
  HIGH: 'HØY',          // 50-69
  CRITICAL: 'KRITISK'   // 70+
};

class AlertService {
  constructor() {
    this.alerts = this.loadAlerts();
    this.facilityRiskHistory = {}; // Track previous risk levels
  }

  /**
   * Load alerts from persistent storage
   */
  loadAlerts() {
    try {
      if (fs.existsSync(ALERTS_FILE)) {
        const data = fs.readFileSync(ALERTS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading alerts:', error.message);
    }
    return [];
  }

  /**
   * Save alerts to persistent storage
   */
  saveAlerts() {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      console.error('Error saving alerts:', error.message);
    }
  }

  /**
   * Check if facility should be alerted based on risk prediction
   * @param {string} facilityId - Facility identifier
   * @param {number} riskScore - Current risk score (0-100)
   * @param {string} disease - Disease name
   * @param {object} metadata - Additional context
   * @returns {object} Alert data if alert should be sent, null otherwise
   */
  checkAndCreateAlert(facilityId, riskScore, disease, metadata = {}) {
    const previousRisk = this.facilityRiskHistory[facilityId] || { score: 0, disease: disease };
    const riskLevel = this.getRiskLevel(riskScore);
    const previousLevel = this.getRiskLevel(previousRisk.score);
    
    // Conditions for alerting:
    // 1. Risk increased to HIGH or higher
    // 2. Disease changed while risk is HIGH or higher
    // 3. Risk transitioned to CRITICAL
    const shouldAlert = 
      (riskScore >= ALERT_THRESHOLDS.HIGH && previousRisk.score < ALERT_THRESHOLDS.HIGH) ||
      (disease !== previousRisk.disease && riskScore >= ALERT_THRESHOLDS.HIGH) ||
      (riskScore >= ALERT_THRESHOLDS.CRITICAL && previousRisk.score < ALERT_THRESHOLDS.CRITICAL);

    // Update history for next check
    this.facilityRiskHistory[facilityId] = { score: riskScore, disease: disease };

    if (shouldAlert) {
      const alert = {
        id: this.generateAlertId(),
        facilityId: facilityId,
        timestamp: new Date().toISOString(),
        riskScore: riskScore,
        riskLevel: riskLevel,
        disease: disease,
        previousRiskLevel: previousLevel,
        severity: riskScore >= ALERT_THRESHOLDS.CRITICAL ? 'CRITICAL' : 'HIGH',
        status: 'PENDING', // PENDING, SENT, ACKNOWLEDGED, RESOLVED
        sentTo: [],
        metadata: metadata,
        message: this.generateAlertMessage(disease, riskLevel, riskScore, metadata)
      };

      this.alerts.push(alert);
      this.saveAlerts();
      return alert;
    }

    return null;
  }

  /**
   * Determine risk level from score
   */
  getRiskLevel(score) {
    if (score >= 70) return ALERT_STATES.CRITICAL;
    if (score >= 50) return ALERT_STATES.HIGH;
    if (score >= 30) return ALERT_STATES.MODERATE;
    return ALERT_STATES.LOW;
  }

  /**
   * Generate human-readable alert message in Norwegian
   */
  generateAlertMessage(disease, riskLevel, riskScore, metadata) {
    const diseaseNames = {
      'ISA': 'Infeksiøs lakseanemi',
      'PD': 'Pankreas sjukdom',
      'PRV': 'Pankreas- og nyreskade virus',
      'SRS': 'Saltvannsiktsyndrom'
    };

    const levelEmojis = {
      'HØY': '🟠',
      'KRITISK': '🔴',
      'MODERAT': '🟡',
      'LAV': '🟢'
    };

    const diseaseName = diseaseNames[disease] || disease;
    const emoji = levelEmojis[riskLevel] || '⚠️';

    return `${emoji} Risikovarsel: Økt fare for ${diseaseName}. Risiko: ${riskLevel} (${riskScore}/100). Ta forebyggende tiltak nå.`;
  }

  /**
   * Mark alert as sent
   */
  markAlertSent(alertId, sentToEmail) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.sentTo = alert.sentTo || [];
      alert.sentTo.push({
        email: sentToEmail,
        sentAt: new Date().toISOString()
      });
      alert.status = 'SENT';
      this.saveAlerts();
      return alert;
    }
    return null;
  }

  /**
   * Mark alert as acknowledged by facility
   */
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
      this.saveAlerts();
      return alert;
    }
    return null;
  }

  /**
   * Resolve alert (risk returned to safe levels)
   */
  resolveAlert(alertId, resolvedAt = new Date().toISOString()) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'RESOLVED';
      alert.resolvedAt = resolvedAt;
      this.saveAlerts();
      return alert;
    }
    return null;
  }

  /**
   * Get alerts for a specific facility
   */
  getAlertsForFacility(facilityId, limit = 50) {
    return this.alerts
      .filter(a => a.facilityId === facilityId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts() {
    return this.alerts
      .filter(a => a.status === 'PENDING' || a.status === 'SENT')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const stats = {
      total: this.alerts.length,
      pending: 0,
      sent: 0,
      acknowledged: 0,
      resolved: 0,
      critical: 0,
      high: 0,
      lastAlert: null
    };

    this.alerts.forEach(alert => {
      stats[alert.status.toLowerCase()]++;
      if (alert.severity === 'CRITICAL') stats.critical++;
      if (alert.severity === 'HIGH') stats.high++;
    });

    if (this.alerts.length > 0) {
      stats.lastAlert = this.alerts.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];
    }

    return stats;
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export alerts for reporting
   */
  exportAlerts(facilityId = null) {
    let data = this.alerts;
    if (facilityId) {
      data = data.filter(a => a.facilityId === facilityId);
    }
    return data;
  }
}

module.exports = new AlertService();
