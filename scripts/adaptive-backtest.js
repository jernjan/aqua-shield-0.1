#!/usr/bin/env node

/**
 * Adaptive Backtesting CLI
 * Finds optimal risk threshold by testing multiple values
 * Usage: node scripts/adaptive-backtest.js --start 2024-01-01 --end 2024-12-31
 */

const path = require('path');
const { readDB } = require('../server/db');
const { findOptimalThreshold } = require('../server/utils/adaptive-backtesting');

const args = process.argv.slice(2);

let startDate = new Date('2024-01-01');
let endDate = new Date('2024-12-31');
let thresholds = [10, 20, 30, 40, 50, 60, 70, 80];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--start' && args[i + 1]) startDate = new Date(args[i + 1]);
  if (arg === '--end' && args[i + 1]) endDate = new Date(args[i + 1]);
  if (arg === '--thresholds' && args[i + 1]) {
    thresholds = args[i + 1].split(',').map(x => parseInt(x.trim()));
  }
  if (arg === '--help') {
    console.log(`
🧪 Adaptive Backtesting CLI

Finds optimal risk threshold by testing multiple values against historical data.

Usage: node scripts/adaptive-backtest.js [options]

Options:
  --start <date>         Start date (YYYY-MM-DD), default: 2024-01-01
  --end <date>           End date (YYYY-MM-DD), default: 2024-12-31
  --thresholds <list>    Comma-separated thresholds to test (default: 10,20,30,40,50,60,70,80)
  --help                 Show this help message

Examples:
  # Find best threshold for full year 2024
  node scripts/adaptive-backtest.js

  # Test specific thresholds
  node scripts/adaptive-backtest.js --thresholds 25,35,45,55,65

  # Test Q2 2024 only
  node scripts/adaptive-backtest.js --start 2024-04-01 --end 2024-06-30
    `);
    process.exit(0);
  }
}

// Main execution
(async () => {
  try {
    console.log('🔄 Loading database...');
    const db = await readDB();

    const result = await findOptimalThreshold(db, startDate, endDate, thresholds);

    console.log('🎯 Summary:');
    console.log(`   Recommended threshold: ${result.recommendedThreshold}%`);
    console.log(`   F1-Score: ${(result.bestMetrics.f1Score * 100).toFixed(1)}%`);
    console.log(`   Use this to update: server/utils/contamination.js line 7\n`);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Adaptive backtesting failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
