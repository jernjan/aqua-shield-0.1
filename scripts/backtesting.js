#!/usr/bin/env node

/**
 * Backtesting CLI Tool
 * Usage:
 *   node scripts/backtesting.js --start 2024-01-01 --end 2024-12-31 --interval week
 *   node scripts/backtesting.js --help
 */

const path = require('path');
const { readDB } = require('../server/db');
const { runBacktest, generateBacktestReport } = require('../server/utils/backtesting');

const args = process.argv.slice(2);

// Parse arguments
let startDate = new Date('2024-01-01');
let endDate = new Date('2024-12-31');
let interval = 'week';
let outputFile = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--start' && args[i + 1]) startDate = new Date(args[i + 1]);
  if (arg === '--end' && args[i + 1]) endDate = new Date(args[i + 1]);
  if (arg === '--interval' && args[i + 1]) interval = args[i + 1];
  if (arg === '--output' && args[i + 1]) outputFile = args[i + 1];
  if (arg === '--help') {
    console.log(`
🔬 Backtesting CLI

Usage: node scripts/backtesting.js [options]

Options:
  --start <date>      Start date (YYYY-MM-DD), default: 2024-01-01
  --end <date>        End date (YYYY-MM-DD), default: 2024-12-31
  --interval <type>   Simulation interval: day, week, month (default: week)
  --output <file>     Save JSON report to file
  --help              Show this help message

Examples:
  # Full year 2024 with weekly intervals
  node scripts/backtesting.js

  # March 2024 with daily intervals
  node scripts/backtesting.js --start 2024-03-01 --end 2024-03-31 --interval day

  # Save results to file
  node scripts/backtesting.js --output results.json
    `);
    process.exit(0);
  }
}

// Main execution
(async () => {
  try {
    console.log('🔄 Loading database...');
    const db = await readDB();

    console.log('🚀 Starting backtesting...\n');

    const results = await runBacktest(db, startDate, endDate, {
      interval,
      verbose: true
    });

    if (outputFile) {
      const fullPath = path.join(process.cwd(), outputFile);
      generateBacktestReport(results, fullPath);
    }

    // Exit with success
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Backtesting failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
