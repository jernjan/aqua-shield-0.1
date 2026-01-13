#!/usr/bin/env node

/**
 * Backtesting Analysis Dashboard
 * Generates comprehensive HTML report with visualizations
 * Usage: node scripts/backtest-dashboard.js
 */

const fs = require('fs');
const path = require('path');
const { readDB } = require('../server/db');
const { runBacktest } = require('../server/utils/backtesting');

async function generateDashboard() {
  console.log('📊 Generating backtesting analysis dashboard...\n');

  const db = await readDB();
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  // Run single backtest with current settings
  const metrics = await runBacktest(db, startDate, endDate, {
    interval: 'month',
    verbose: true
  });

  // Generate HTML report
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AquaShield Backtesting Report - 2024</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: #7f8c8d;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      border-radius: 8px;
      color: white;
      text-align: center;
    }
    .metric-value {
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .metric-description {
      font-size: 11px;
      margin-top: 8px;
      opacity: 0.8;
    }
    .chart-container {
      position: relative;
      height: 300px;
      margin-bottom: 40px;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    .recommendations {
      background: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 20px;
      border-radius: 4px;
      margin-top: 40px;
    }
    .recommendations h3 {
      color: #2c3e50;
      margin-bottom: 12px;
    }
    .recommendations ul {
      list-style: none;
      padding-left: 0;
    }
    .recommendations li {
      padding: 8px 0;
      color: #34495e;
      display: flex;
      align-items: center;
    }
    .recommendations li:before {
      content: "✓";
      margin-right: 12px;
      color: #27ae60;
      font-weight: bold;
    }
    .timestamp {
      color: #95a5a6;
      font-size: 12px;
      margin-top: 20px;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 AquaShield Backtesting Report</h1>
    <p class="subtitle">Validation of contamination model against 2024 historical data</p>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Sensitivity (Recall)</div>
        <div class="metric-value">${(metrics.summary.sensitivity * 100).toFixed(1)}%</div>
        <div class="metric-description">% of actual disease events we caught</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Specificity</div>
        <div class="metric-value">${(metrics.summary.specificity * 100).toFixed(1)}%</div>
        <div class="metric-description">% of correct no-event predictions</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Precision</div>
        <div class="metric-value">${(metrics.summary.precision * 100).toFixed(1)}%</div>
        <div class="metric-description">Trustworthiness of alerts</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">F1-Score</div>
        <div class="metric-value">${(metrics.summary.f1Score * 100).toFixed(1)}%</div>
        <div class="metric-description">Overall model quality</div>
      </div>
    </div>

    <div class="chart-container">
      <canvas id="performanceChart"></canvas>
    </div>

    <div class="chart-container">
      <canvas id="predictionsChart"></canvas>
    </div>

    <div class="recommendations">
      <h3>📌 Key Findings</h3>
      <ul>
        <li>Tested ${metrics.totalDates} dates across 2024</li>
        <li>Made ${metrics.predictions.contaminationEvents} contamination predictions</li>
        <li>Correctly identified ${metrics.predictions.correctPredictions} disease events</li>
        <li>False alarms: ${metrics.predictions.falsePredictions}</li>
        <li>Missed events: ${metrics.predictions.missedEvents}</li>
      </ul>
    </div>

    <div class="recommendations">
      <h3>🎯 Next Steps</h3>
      <ul>
        <li>Run adaptive backtesting to find optimal risk threshold</li>
        <li>Collect more historical disease event data (ISA, IPN, etc.)</li>
        <li>Validate against actual Mattilsynet outbreak reports</li>
        <li>Tune seasonal factors in contamination model</li>
        <li>Implement feedback loop with farmers for accuracy improvement</li>
      </ul>
    </div>

    <p class="timestamp">Generated: ${new Date().toISOString()}</p>
  </div>

  <script>
    // Performance metrics chart
    const perfCtx = document.getElementById('performanceChart').getContext('2d');
    new Chart(perfCtx, {
      type: 'radar',
      data: {
        labels: ['Sensitivity', 'Specificity', 'Precision', 'F1-Score', 'Accuracy'],
        datasets: [{
          label: 'Model Performance',
          data: [
            ${metrics.summary.sensitivity * 100},
            ${metrics.summary.specificity * 100},
            ${metrics.summary.precision * 100},
            ${metrics.summary.f1Score * 100},
            ${metrics.summary.accuracy * 100}
          ],
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderColor: 'rgba(102, 126, 234, 1)',
          pointBackgroundColor: 'rgba(102, 126, 234, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(102, 126, 234, 1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'Model Performance Metrics'
          }
        }
      }
    });

    // Predictions chart
    const predCtx = document.getElementById('predictionsChart').getContext('2d');
    new Chart(predCtx, {
      type: 'bar',
      data: {
        labels: ['Total Predictions', 'Correct', 'False Alarms', 'Missed'],
        datasets: [{
          label: 'Predictions',
          data: [
            ${metrics.predictions.contaminationEvents},
            ${metrics.predictions.correctPredictions},
            ${metrics.predictions.falsePredictions},
            ${metrics.predictions.missedEvents}
          ],
          backgroundColor: [
            'rgba(52, 152, 219, 0.8)',
            'rgba(39, 174, 96, 0.8)',
            'rgba(231, 76, 60, 0.8)',
            'rgba(241, 196, 15, 0.8)'
          ],
          borderColor: [
            'rgb(52, 152, 219)',
            'rgb(39, 174, 96)',
            'rgb(231, 76, 60)',
            'rgb(241, 196, 15)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Prediction Results (2024)'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  </script>
</body>
</html>
  `;

  const outputPath = path.join(process.cwd(), 'backtest-dashboard.html');
  fs.writeFileSync(outputPath, html);
  
  console.log(`\n✅ Dashboard generated: ${outputPath}`);
  console.log('   Open in browser to view interactive report\n');
}

generateDashboard().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
