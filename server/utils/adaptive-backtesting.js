/**
 * Adaptive Backtesting
 * Finds optimal risk threshold by testing multiple values
 * and selecting the one with highest F1-score
 */

const { runBacktest } = require('./backtesting');

/**
 * Test multiple thresholds to find optimal
 * @param {Object} db - Database
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Array} thresholdsToTest - [20, 30, 40, 50, 60, 70, ...]
 * @returns {Object} Results with recommended threshold
 */
async function findOptimalThreshold(db, startDate, endDate, thresholdsToTest = [10, 20, 30, 40, 50, 60]) {
  console.log('\n🔍 ADAPTIVE THRESHOLD TUNING');
  console.log(`   Testing thresholds: ${thresholdsToTest.join(', ')}\n`);

  const results = [];

  for (const threshold of thresholdsToTest) {
    console.log(`   Testing threshold: ${threshold}%...`);
    
    const metrics = await runBacktest(db, startDate, endDate, {
      interval: 'month',
      verbose: false,
      targetThreshold: threshold
    });

    results.push({
      threshold,
      f1Score: metrics.summary.f1Score,
      sensitivity: metrics.summary.sensitivity,
      specificity: metrics.summary.specificity,
      precision: metrics.summary.precision,
      accuracy: metrics.summary.accuracy,
      predictions: metrics.predictions
    });
  }

  // Find best F1 score
  const best = results.reduce((prev, curr) =>
    (curr.f1Score > prev.f1Score) ? curr : prev
  );

  console.log('\n📊 THRESHOLD ANALYSIS RESULTS:\n');
  console.log('Threshold | F1-Score | Sensitivity | Specificity | Precision | Predictions');
  console.log('-----------|----------|-------------|-------------|-----------|-------------');
  
  results.forEach(r => {
    const marker = r.threshold === best.threshold ? ' ← BEST' : '';
    console.log(
      `${r.threshold.toString().padEnd(9)} | ${(r.f1Score * 100).toFixed(1).padEnd(8)}% | ` +
      `${(r.sensitivity * 100).toFixed(1).padEnd(11)}% | ` +
      `${(r.specificity * 100).toFixed(1).padEnd(11)}% | ` +
      `${(r.precision * 100).toFixed(1).padEnd(9)}% | ` +
      `${r.predictions.contaminationEvents}${marker}`
    );
  });

  console.log(`\n✅ RECOMMENDED: ${best.threshold}% threshold`);
  console.log(`   F1-Score: ${(best.f1Score * 100).toFixed(1)}%`);
  console.log(`   Sensitivity: ${(best.sensitivity * 100).toFixed(1)}% (catch disease)`);
  console.log(`   Precision: ${(best.precision * 100).toFixed(1)}% (minimize false alarms)\n`);

  return {
    recommendedThreshold: best.threshold,
    allResults: results,
    bestMetrics: best
  };
}

module.exports = {
  findOptimalThreshold
};
