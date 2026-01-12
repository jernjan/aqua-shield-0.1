/**
 * Validation Engine
 * Compares forecasts against actual BarentsWatch data
 * Calculates True Positive, False Positive, True Negative rates
 */

/**
 * Save a forecast to history for later validation
 * Called when risk is assessed
 */
function saveForecast(db, facility, forecast) {
  if (!db.forecast_history) db.forecast_history = [];
  
  const entry = {
    id: `forecast_${Date.now()}_${facility.locId}`,
    facilityId: facility.locId,
    facilityName: facility.name,
    municipality: facility.municipality,
    createdAt: new Date().toISOString(),
    
    // Forecast data (what we predicted)
    forecastRisk: forecast.forecast7d,
    forecastTrend: forecast.trend,
    daysToAlert: forecast.daysToAlert,
    currentRisk: forecast.current,
    
    // Risk drivers (why we predicted this)
    liceCount: facility.liceCount || 0,
    diseaseStatus: facility.diseaseStatus || 'none',
    
    // Validation (filled in later)
    validatedAt: null,
    actualRisk: null,
    actualLiceCount: null,
    actualDiseaseStatus: null,
    validated: false,
    result: null // 'TP' (true positive), 'FP' (false positive), 'TN' (true negative), 'FN' (false negative)
  };
  
  db.forecast_history.push(entry);
  return entry;
}

/**
 * Validate a forecast against actual BarentsWatch data
 * Should be called several days after forecast was made
 */
function validateForecast(entry, actualData) {
  const ALERT_THRESHOLD = 50; // Match forecast.js threshold
  const forecastedRiskAbove = entry.forecastRisk >= ALERT_THRESHOLD;
  const actualRiskAbove = (actualData.ownRisk || 0) >= ALERT_THRESHOLD;
  
  // Determine outcome
  let result = null;
  if (forecastedRiskAbove && actualRiskAbove) {
    result = 'TP'; // True Positive: predicted alert, was alert
  } else if (forecastedRiskAbove && !actualRiskAbove) {
    result = 'FP'; // False Positive: predicted alert, was not
  } else if (!forecastedRiskAbove && actualRiskAbove) {
    result = 'FN'; // False Negative: predicted safe, was alert
  } else {
    result = 'TN'; // True Negative: predicted safe, was safe
  }
  
  entry.validatedAt = new Date().toISOString();
  entry.actualRisk = actualData.ownRisk || 0;
  entry.actualLiceCount = actualData.liceCount || 0;
  entry.actualDiseaseStatus = actualData.diseaseStatus || 'none';
  entry.validated = true;
  entry.result = result;
  
  return entry;
}

/**
 * Get validation metrics across all forecasts
 */
function getValidationMetrics(db) {
  if (!db.forecast_history || db.forecast_history.length === 0) {
    return {
      totalForecasts: 0,
      validatedForecasts: 0,
      pendingValidation: 0,
      accuracy: 0,
      precision: 0, // TP / (TP + FP)
      recall: 0,    // TP / (TP + FN)
      falsePositiveRate: 0,
      results: {
        TP: 0,
        FP: 0,
        TN: 0,
        FN: 0
      }
    };
  }
  
  const validated = db.forecast_history.filter(f => f.validated);
  const counts = {
    TP: 0,
    FP: 0,
    TN: 0,
    FN: 0
  };
  
  validated.forEach(f => {
    if (counts[f.result] !== undefined) counts[f.result]++;
  });
  
  const totalValidated = validated.length;
  const TP = counts.TP;
  const FP = counts.FP;
  const TN = counts.TN;
  const FN = counts.FN;
  
  return {
    totalForecasts: db.forecast_history.length,
    validatedForecasts: validated.length,
    pendingValidation: db.forecast_history.length - validated.length,
    
    // Metrics
    accuracy: totalValidated > 0 ? ((TP + TN) / totalValidated * 100).toFixed(1) : 0,
    precision: (TP + FP) > 0 ? (TP / (TP + FP) * 100).toFixed(1) : 0, // When we predict high, how often right?
    recall: (TP + FN) > 0 ? (TP / (TP + FN) * 100).toFixed(1) : 0, // How many actual events did we catch?
    falsePositiveRate: (FP + TN) > 0 ? (FP / (FP + TN) * 100).toFixed(1) : 0, // False alarms
    
    results: counts
  };
}

/**
 * Get forecasts pending validation (older than X days)
 * Used to identify which forecasts should be validated now
 */
function getPendingValidation(db, minAgeHours = 24) {
  if (!db.forecast_history) return [];
  
  const now = new Date();
  return db.forecast_history.filter(f => {
    if (f.validated) return false;
    const createdAt = new Date(f.createdAt);
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    return ageHours >= minAgeHours;
  });
}

/**
 * Get forecast history for a specific facility
 */
function getFacilityForecastHistory(db, facilityId) {
  if (!db.forecast_history) return [];
  return db.forecast_history.filter(f => f.facilityId === facilityId);
}

module.exports = {
  saveForecast,
  validateForecast,
  getValidationMetrics,
  getPendingValidation,
  getFacilityForecastHistory
};
