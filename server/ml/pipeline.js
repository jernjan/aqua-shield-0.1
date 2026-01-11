#!/usr/bin/env node

/**
 * ML Pipeline Orchestrator
 * Runs the complete ML workflow: data collection → training → model generation
 */

const path = require('path');
const fs = require('fs');
const HistoryCrawler = require('./history-crawler');
const RiskPredictionModel = require('./risk-model');

class MLPipelineOrchestrator {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.resultsDir = path.join(__dirname, '../data/ml-results');
  }

  /**
   * Ensure directories exist
   */
  setupDirectories() {
    [this.dataDir, this.resultsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      }
    });
  }

  /**
   * Run complete pipeline
   */
  async runPipeline() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🤖 ML TRAINING PIPELINE - AQUA SHIELD');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    const startTime = Date.now();

    try {
      // Setup
      this.setupDirectories();
      console.log('');

      // Step 1: Data Collection
      console.log('STEP 1: DATA COLLECTION');
      console.log('───────────────────────────────────────────────────────────');
      const crawler = new HistoryCrawler();
      const crawlResult = await crawler.run();
      
      if (!crawlResult.success) {
        throw new Error('Data collection failed');
      }
      console.log('');

      // Step 2: Model Training
      console.log('STEP 2: MODEL TRAINING');
      console.log('───────────────────────────────────────────────────────────');
      const model = new RiskPredictionModel();
      const trainingDataPath = path.join(this.dataDir, 'ml-training-data.csv');
      
      if (!model.loadTrainingData(trainingDataPath)) {
        throw new Error('Failed to load training data');
      }

      if (!model.train()) {
        throw new Error('Model training failed');
      }
      console.log('');

      // Step 3: Model Evaluation
      console.log('STEP 3: MODEL EVALUATION');
      console.log('───────────────────────────────────────────────────────────');
      const summary = model.getSummary();
      console.log('Model Summary:');
      console.log(JSON.stringify(summary, null, 2));
      console.log('');

      // Step 4: Test Predictions
      console.log('STEP 4: TEST PREDICTIONS');
      console.log('───────────────────────────────────────────────────────────');
      const testCases = [
        { diseaseCode: 'ISA', vesselContactCount: 3, latitude: 65.0, longitude: 12.0, name: 'ISA + high vessel contact' },
        { diseaseCode: 'PD', vesselContactCount: 1, latitude: 65.5, longitude: 11.5, name: 'PD + low vessel contact' },
        { diseaseCode: 'ISA', vesselContactCount: 0, latitude: 64.5, longitude: 13.0, name: 'ISA + no vessel contact' }
      ];

      for (const testCase of testCases) {
        const pred = model.predictRisk(testCase);
        console.log(`\n📍 ${testCase.name}:`);
        console.log(`   Risk Level: ${pred.risk.toUpperCase()}`);
        console.log(`   Risk Score: ${pred.riskScore}/100`);
        console.log(`   Confidence: ${pred.confidence.toFixed(1)}%`);
      }
      console.log('');

      // Step 5: Save Model
      console.log('STEP 5: MODEL EXPORT');
      console.log('───────────────────────────────────────────────────────────');
      const modelPath = path.join(this.dataDir, 'risk-model.json');
      model.save(modelPath);

      // Save summary report
      const reportPath = path.join(this.resultsDir, `report-${new Date().toISOString().split('T')[0]}.json`);
      const report = {
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        data_collection: crawlResult,
        model_summary: summary,
        test_results: testCases.map(tc => ({
          case: tc.name,
          prediction: model.predictRisk(tc)
        }))
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`✓ Report saved to ${reportPath}`);
      console.log('');

      // Final summary
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  ✅ ML PIPELINE COMPLETE');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Duration: ${(Date.now() - startTime) / 1000}s`);
      console.log(`Data collected: ${crawlResult.outbreakCount} outbreaks`);
      console.log(`Training examples: ${crawlResult.trainingExamples}`);
      console.log(`Model diseases: ${Object.keys(summary.diseases).length}`);
      console.log('');
      console.log('Output files:');
      console.log(`  📄 ${trainingDataPath}`);
      console.log(`  🤖 ${modelPath}`);
      console.log(`  📊 ${reportPath}`);
      console.log('');

      return { success: true, report };

    } catch (err) {
      console.error('❌ PIPELINE FAILED:', err.message);
      console.log('');
      return { success: false, error: err.message };
    }
  }
}

// Run if called directly
if (require.main === module) {
  const orchestrator = new MLPipelineOrchestrator();
  orchestrator.runPipeline().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = MLPipelineOrchestrator;
