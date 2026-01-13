#!/usr/bin/env node
/**
 * Simple Backtesting Monitor
 * Standalone monitor for checking backtesting job status
 */

const http = require('http');

const jobId = process.argv[2] || '33c66767-92b6-4ac3-bb49-23b718d67c21';

function checkStatus() {
  const url = `http://localhost:3001/api/admin/backtest/status/${jobId}`;
  
  http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        const ts = new Date().toLocaleTimeString('no-NO');
        
        if (status.status === 'running') {
          console.log(`[${ts}] 🔄 Running... Progress: ${status.progress}% | Date: ${status.currentDate}`);
        } else if (status.status === 'completed') {
          console.log(`[${ts}] ✅ BACKTEST COMPLETED!`);
          console.log(`  F1 Score: ${status.result.f1.toFixed(3)}`);
          console.log(`  Sensitivity: ${(status.result.sensitivity * 100).toFixed(1)}%`);
          console.log(`  Specificity: ${(status.result.specificity * 100).toFixed(1)}%`);
          console.log(`  Precision: ${(status.result.precision * 100).toFixed(1)}%`);
          console.log(`  TP=${status.result.truePositives} FP=${status.result.falsePositives} FN=${status.result.falseNegatives} TN=${status.result.trueNegatives}`);
          process.exit(0);
        } else {
          console.log(`[${ts}] Status: ${status.status}`);
        }
      } catch (e) {
        console.log('Could not parse response:', data.substring(0, 100));
      }
    });
  }).on('error', (e) => {
    console.log('Error connecting to server:', e.message);
  });
}

console.log(`🔍 Monitoring backtest job: ${jobId}`);
checkStatus();

const interval = setInterval(() => {
  checkStatus();
}, 20000); // Check every 20 seconds
