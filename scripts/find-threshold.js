/**
 * Adaptive Threshold Finder
 * Tests different risk thresholds to find optimal balance between Sensitivity and Precision
 */

const { readDB } = require('../server/db');
const { runBacktest } = require('../server/utils/backtesting');

async function findOptimalThreshold() {
  console.log('\n🔍 FINDING OPTIMAL RISK THRESHOLD\n');

  const db = await readDB();
  const thresholds = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
  const results = [];

  for (const threshold of thresholds) {
    console.log(`Testing threshold: ${threshold}%...`);

    const metrics = await runBacktest(
      db,
      new Date('2024-01-01'),
      new Date('2024-12-31'),
      {
        interval: 'week',
        verbose: false,
        targetThreshold: threshold
      }
    );

    results.push({
      threshold,
      sensitivity: (metrics.summary.sensitivity * 100).toFixed(1),
      specificity: (metrics.summary.specificity * 100).toFixed(1),
      precision: (metrics.summary.precision * 100).toFixed(1),
      f1Score: (metrics.summary.f1Score * 100).toFixed(1),
      predictions: metrics.predictions.contaminationEvents,
      correct: metrics.predictions.correctPredictions,
      false: metrics.predictions.falsePredictions,
      missed: metrics.predictions.missedEvents
    });
  }

  // Display results
  console.log('\n📊 THRESHOLD ANALYSIS RESULTS:');
  console.log('═'.repeat(120));
  console.log('Threshold | Sensitivity | Specificity | Precision | F1-Score | Predictions | Correct | False | Missed');
  console.log('─'.repeat(120));

  results.forEach(r => {
    console.log(
      `${r.threshold.toString().padEnd(9)} | ${r.sensitivity.padEnd(11)}% | ${r.specificity.padEnd(10)}% | ${r.precision.padEnd(8)}% | ${r.f1Score.padEnd(7)}% | ${r.predictions.toString().padEnd(11)} | ${r.correct.toString().padEnd(7)} | ${r.false.toString().padEnd(5)} | ${r.missed}`
    );
  });

  // Find best F1 score
  const bestF1 = results.reduce((best, current) =>
    parseFloat(current.f1Score) > parseFloat(best.f1Score) ? current : best
  );

  // Find best balance (highest sensitivity with acceptable precision)
  const bestBalance = results.reduce((best, current) => {
    const currentBalance = (parseFloat(current.sensitivity) + parseFloat(current.precision)) / 2;
    const bestScore = (parseFloat(best.sensitivity) + parseFloat(best.precision)) / 2;
    return currentBalance > bestScore ? current : best;
  });

  console.log('═'.repeat(120));
  console.log(`\n✨ RECOMMENDATIONS:`);
  console.log(`  Best F1-Score: ${bestF1.threshold}% (F1=${bestF1.f1Score})`);
  console.log(`  Best Balance: ${bestBalance.threshold}% (Sensitivity=${bestBalance.sensitivity}%, Precision=${bestBalance.precision}%)`);
  console.log(`\n💡 Suggestion: Use ${bestBalance.threshold}% threshold for optimal balance\n`);

  return results;
}

findOptimalThreshold().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
