/**
 * Backtesting Engine
 * Validates contamination & risk models against historical data
 * Generates metrics: Sensitivity, Specificity, F1, Lead Time
 */

const {
  getFacilityDataForDate,
  getVesselPositionsForDate,
  getDiseaseEventsForDate,
  getDateRange
} = require('./historical-data');

const { annotateFacilityRisk } = require('./risk');
const { processVesselVisitsForContamination, getContaminatedVesselsNearFacility } = require('./contamination');

/**
 * Run backtesting simulation
 * @param {Object} db - Database with facilities and vessels
 * @param {Date} startDate - Start of simulation (e.g., 2024-01-01)
 * @param {Date} endDate - End of simulation
 * @param {Object} options - { interval: 'day'|'week'|'month', step: number (hours) }
 * @returns {Object} Backtesting results with metrics
 */
async function runBacktest(db, startDate, endDate, options = {}) {
  const {
    interval = 'week',
    step = 24, // hours between simulations
    verbose = true,
    targetThreshold = 60
  } = options;

  if (verbose) {
    console.log('\n📊 BACKTESTING ENGINE');
    console.log(`   Period: ${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`);
    console.log(`   Interval: ${interval} | Step: ${step}h`);
    console.log(`   Facilities: ${(db.facilities || []).length} | Vessels: ${(db.vessels || []).length}`);
  }

  // Metrics collection
  const metrics = {
    totalDates: 0,
    predictions: {
      contaminationEvents: 0,
      correctPredictions: 0,
      falsePredictions: 0,
      missedEvents: 0
    },
    perDate: [],
    summary: {
      sensitivity: 0,
      specificity: 0,
      f1Score: 0,
      precision: 0,
      accuracy: 0,
      avgLeadTime: 0
    }
  };

  const dates = getDateRange(startDate, endDate, interval);
  const facilities = db.facilities || [];
  const vessels = db.vessels || [];

  if (verbose) {
    console.log(`   Simulating ${dates.length} dates...\n`);
  }

  // For each date in range
  for (const currentDate of dates) {
    // 1. Get historical data snapshot
    const facilitySnapshot = getFacilityDataForDate(facilities, currentDate);
    const vesselSnapshot = getVesselPositionsForDate(vessels, currentDate);
    const actualEvents = getDiseaseEventsForDate(facilitySnapshot, vesselSnapshot, currentDate);

    // 2. Run risk annotation (our model)
    const annotatedFacilities = annotateFacilityRisk(facilitySnapshot, vesselSnapshot, db, {
      verbose: false
    });

    // 3. Mark contaminated vessels based on this day's conditions
    processVesselVisitsForContamination(db, annotatedFacilities);

    // 4. Compare predictions vs reality
    const dayMetrics = validatePredictions(
      annotatedFacilities,
      actualEvents,
      targetThreshold
    );

    metrics.perDate.push({
      date: currentDate.toISOString().split('T')[0],
      predictions: dayMetrics.predictions,
      actual: dayMetrics.actual,
      correct: dayMetrics.correct,
      false: dayMetrics.false,
      missed: dayMetrics.missed
    });

    metrics.totalDates++;
    metrics.predictions.contaminationEvents += dayMetrics.predictions;
    metrics.predictions.correctPredictions += dayMetrics.correct;
    metrics.predictions.falsePredictions += dayMetrics.false;
    metrics.predictions.missedEvents += dayMetrics.missed;

    if (verbose && dates.indexOf(currentDate) % 5 === 0) {
      console.log(
        `   ✓ ${currentDate.toLocaleDateString()}: ` +
        `Pred=${dayMetrics.predictions} | Correct=${dayMetrics.correct} | False=${dayMetrics.false} | Missed=${dayMetrics.missed}`
      );
    }
  }

  // 5. Calculate aggregate metrics
  const { predictions } = metrics;
  
  // Sensitivity (True Positive Rate): Correctly predicted events / All actual events
  metrics.summary.sensitivity = predictions.correctPredictions > 0 
    ? predictions.correctPredictions / (predictions.correctPredictions + predictions.missedEvents)
    : 0;

  // Specificity (True Negative Rate): Correctly predicted no event / All non-events
  // For this, we need total possible predictions
  const totalPossible = metrics.totalDates * facilities.length;
  const correctNegatives = totalPossible - predictions.contaminationEvents;
  metrics.summary.specificity = correctNegatives / totalPossible;

  // Precision (Positive Predictive Value)
  metrics.summary.precision = predictions.contaminationEvents > 0
    ? predictions.correctPredictions / predictions.contaminationEvents
    : 1;

  // F1 Score: Harmonic mean of precision and recall (sensitivity)
  const recall = metrics.summary.sensitivity;
  metrics.summary.f1Score = 
    (2 * metrics.summary.precision * recall) / (metrics.summary.precision + recall) || 0;

  // Accuracy
  metrics.summary.accuracy =
    (predictions.correctPredictions + correctNegatives) / totalPossible;

  // Average lead time (days between prediction and actual event)
  metrics.summary.avgLeadTime = predictions.correctPredictions > 0
    ? 0 // Would need timestamp tracking for actual lead time
    : 0;

  if (verbose) {
    console.log('\n📈 BACKTESTING RESULTS:');
    console.log(`   Total Predictions: ${predictions.contaminationEvents}`);
    console.log(`   Correct: ${predictions.correctPredictions} | False: ${predictions.falsePredictions} | Missed: ${predictions.missedEvents}`);
    console.log('\n   Metrics:');
    console.log(`   ├─ Sensitivity (Recall): ${(metrics.summary.sensitivity * 100).toFixed(1)}% (caught actual events)`);
    console.log(`   ├─ Specificity: ${(metrics.summary.specificity * 100).toFixed(1)}% (correct no-events)`);
    console.log(`   ├─ Precision: ${(metrics.summary.precision * 100).toFixed(1)}% (trustworthiness of alerts)`);
    console.log(`   ├─ F1-Score: ${(metrics.summary.f1Score * 100).toFixed(1)}% (overall quality)`);
    console.log(`   └─ Accuracy: ${(metrics.summary.accuracy * 100).toFixed(1)}%\n`);
  }

  return metrics;
}

/**
 * Validate predictions against actual disease events
 * @param {Array} annotatedFacilities - Facilities with predicted risk
 * @param {Array} actualEvents - Actual disease events
 * @param {Number} threshold - Risk threshold (default 60%)
 * @returns {Object} { predictions, correct, false, missed }
 */
function validatePredictions(annotatedFacilities, actualEvents, threshold = 60) {
  let predictions = 0;
  let correct = 0;
  let falsePredictions = 0;
  let missed = 0;

  // Facilities we predicted would have problems (risk >= threshold)
  const predicted = annotatedFacilities.filter(f => (f.riskScore || 0) >= threshold);
  predictions = predicted.length;

  // Check if predicted facilities match actual events
  const actualFacilityIds = new Set(actualEvents.map(e => e.facilityId));

  predicted.forEach(f => {
    if (actualFacilityIds.has(f.id)) {
      correct++;
    } else {
      falsePredictions++;
    }
  });

  // Events we missed (actual events we didn't predict)
  actualEvents.forEach(event => {
    const wasPredicted = predicted.some(f => f.id === event.facilityId);
    if (!wasPredicted) {
      missed++;
    }
  });

  return {
    predictions,
    correct,
    false: falsePredictions,
    missed
  };
}

/**
 * Generate readable report from backtesting results
 */
function generateBacktestReport(metrics, outputPath) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: metrics.summary,
    predictions: metrics.predictions,
    perDate: metrics.perDate.slice(0, 10) // First 10 dates for report
  };

  if (outputPath) {
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to ${outputPath}`);
  }

  return report;
}

module.exports = {
  runBacktest,
  validatePredictions,
  generateBacktestReport
};
