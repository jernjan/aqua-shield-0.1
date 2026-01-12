/**
 * Risk Forecast Engine
 * Predicts 7-day risk trajectory based on current trends
 */

/**
 * Calculate 7-day forecast for a facility
 * Simple trend-based: if lice/disease increasing, risk will increase
 * If stable, risk stays same
 * If decreasing, risk decreases
 */
function forecast7Day(facility, historicalData = []) {
  const current = {
    ownRisk: facility.ownRisk || 50,
    liceCount: facility.liceCount || 0,
    diseaseStatus: facility.diseaseStatus || 'none'
  };

  // If no historical data, assume stable
  if (!historicalData || historicalData.length === 0) {
    return {
      current: current.ownRisk,
      forecast7d: current.ownRisk,
      trend: 'stable',
      daysToAlert: current.ownRisk >= 70 ? 0 : Math.ceil((70 - current.ownRisk) / 2)
    };
  }

  // Analyze trend from last 7 days of historical data
  const last7 = historicalData.slice(-7);
  if (last7.length < 2) {
    return {
      current: current.ownRisk,
      forecast7d: current.ownRisk,
      trend: 'stable',
      daysToAlert: current.ownRisk >= 70 ? 0 : Math.ceil((70 - current.ownRisk) / 2)
    };
  }

  // Calculate trend
  const first = last7[0].ownRisk || 50;
  const last = last7[last7.length - 1].ownRisk || 50;
  const trendSlope = (last - first) / last7.length; // Risk change per day

  let trend = 'stable';
  if (trendSlope > 2) trend = 'increasing';
  else if (trendSlope < -2) trend = 'decreasing';

  // Forecast: continue trend for 7 days
  let forecast7d = current.ownRisk + (trendSlope * 7);
  
  // Cap at 0-100
  forecast7d = Math.max(0, Math.min(100, forecast7d));

  // Calculate when risk crosses 70% threshold
  let daysToAlert = -1;
  if (current.ownRisk >= 70) {
    daysToAlert = 0; // Already at risk
  } else if (forecast7d >= 70 && trendSlope > 0) {
    daysToAlert = Math.ceil((70 - current.ownRisk) / Math.max(trendSlope, 0.1));
  }

  return {
    current: Math.round(current.ownRisk),
    forecast7d: Math.round(forecast7d),
    trend,
    daysToAlert,
    trendSlope: Math.round(trendSlope * 100) / 100
  };
}

/**
 * Determine if facility should get daily alert
 * Alert if: current risk >= 50% (lowered for faster data collection)
 */
function shouldSendAlert(facility) {
  return (facility.ownRisk || 0) >= 50;
}

/**
 * Generate alert message for farmer
 */
function generateAlertMessage(facility, forecast) {
  const riskLevel = facility.ownRisk >= 85 ? 'KRITISK' :
                     facility.ownRisk >= 75 ? 'HØY' : 'MEDIUM';
  
  let recommendation = '';
  if (facility.ownRisk >= 85) {
    recommendation = 'Økt overvåking og lusekontroll må prioriteres UMIDDELBART';
  } else if (facility.ownRisk >= 75) {
    recommendation = 'Planlegg intensivert lusekontroll eller smoltinnsats';
  } else {
    recommendation = 'Fortsett ordinær overvåking';
  }

  return {
    subjectLine: `Risikouppdatering: ${facility.name} - ${riskLevel} (${facility.ownRisk}%)`,
    summary: `Nåværende risiko på ${facility.name}: ${facility.ownRisk}%`,
    forecast: `7-dager prognose: ${forecast.forecast7d}% (${forecast.trend})`,
    recommendation,
    daysToAlert: forecast.daysToAlert >= 0 ? 
      `Trenger handling om ~${forecast.daysToAlert} dager` : 
      'Fortsatt trygg for 7 dager'
  };
}

/**
 * Forecast with validation tracking
 * Saves forecast to history for later validation against BarentsWatch
 */
function forecast7DayWithTracking(facility, historicalData, db) {
  const forecast = forecast7Day(facility, historicalData);
  
  // Save to forecast_history for validation
  if (db && db.forecast_history !== undefined) {
    const validation = require('./validation');
    validation.saveForecast(db, facility, forecast);
  }
  
  return forecast;
}

module.exports = {
  forecast7Day,
  forecast7DayWithTracking,
  shouldSendAlert,
  generateAlertMessage
};
