/**
 * Scheduler - Manages recurring background tasks
 * - Daily ML model retraining
 * - Auto-check facility risks and create alerts
 * - Report generation
 */

const cron = require('node-cron');
const path = require('path');
const { spawn } = require('child_process');
const alertService = require('./services/alerts');
const RiskPredictionModel = require('./ml/risk-model');

class Scheduler {
  constructor() {
    this.jobs = [];
    this.riskModel = new RiskPredictionModel();
    this.isRetraining = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log('📅 Scheduler: Starting scheduled tasks...');

    // Job 1: Daily ML Model Retraining at 02:00 UTC
    this.scheduleMLRetraining();

    // Job 2: Every 4 hours - Auto-check facility risks
    this.scheduleRiskMonitoring();

    // Job 3: Weekly report generation (Sundays 03:00)
    this.scheduleReportGeneration();

    console.log(`✓ Scheduler: ${this.jobs.length} jobs registered`);
  }

  /**
   * Schedule daily ML pipeline retraining
   * Runs at 02:00 UTC (03:00 CET during winter)
   */
  scheduleMLRetraining() {
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('\n🤖 [SCHEDULER] Starting ML model retraining...');
      
      if (this.isRetraining) {
        console.log('⏸️  [SCHEDULER] Retraining already in progress, skipping...');
        return;
      }

      this.isRetraining = true;
      const startTime = Date.now();

      try {
        // Run ML pipeline in child process to avoid blocking
        await this.runMLPipeline();

        // Reload model in main process
        const modelPath = path.join(__dirname, 'data/risk-model.json');
        this.riskModel.load(modelPath);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✓ [SCHEDULER] ML retraining completed in ${duration}s`);
        console.log(`📊 [SCHEDULER] Model updated with latest training data`);

      } catch (error) {
        console.error(`✗ [SCHEDULER] ML retraining failed:`, error.message);
      } finally {
        this.isRetraining = false;
      }
    });

    this.jobs.push({ name: 'ML Retraining (02:00 UTC)', job });
  }

  /**
   * Execute ML pipeline in child process
   */
  async runMLPipeline() {
    return new Promise((resolve, reject) => {
      const pipelinePath = path.join(__dirname, 'ml/pipeline.js');
      const child = spawn('node', [pipelinePath], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(stdout);
          resolve();
        } else {
          reject(new Error(`Pipeline exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Schedule automatic risk monitoring
   * Runs every 4 hours to check and update facility risks
   * Creates alerts if risk increases significantly
   */
  scheduleRiskMonitoring() {
    const job = cron.schedule('0 */4 * * *', async () => {
      console.log('\n📡 [SCHEDULER] Starting facility risk monitoring...');

      try {
        // Get all facilities (mock data for now, would fetch from DB in production)
        const facilities = this.getFacilitiesForMonitoring();

        if (facilities.length === 0) {
          console.log('⚠️  [SCHEDULER] No facilities found for monitoring');
          return;
        }

        let alertsCreated = 0;

        for (const facility of facilities) {
          for (const disease of ['ISA', 'PD', 'PRV', 'SRS']) {
            try {
              // Simulate vessel contacts (would come from AIS data in production)
              const vesselContacts = Math.floor(Math.random() * 5);

              // Get risk prediction
              const prediction = this.riskModel.predictRisk({
                diseaseCode: disease,
                vesselContactCount: vesselContacts,
                latitude: facility.latitude,
                longitude: facility.longitude
              });

              // Check if alert should be created
              const alert = alertService.checkAndCreateAlert(
                facility.id,
                prediction.riskScore,
                disease,
                {
                  vesselContactCount: vesselContacts,
                  latitude: facility.latitude,
                  longitude: facility.longitude,
                  facilityName: facility.name,
                  source: 'SCHEDULED_MONITORING'
                }
              );

              if (alert) {
                alertsCreated++;
                console.log(`  ⚠️  Created alert for ${facility.name}: ${disease} (${alert.riskLevel})`);
              }

            } catch (err) {
              console.error(`  ✗ Error checking risk for ${facility.name}/${disease}:`, err.message);
            }
          }
        }

        console.log(`✓ [SCHEDULER] Risk monitoring completed: ${alertsCreated} alerts created`);

      } catch (error) {
        console.error(`✗ [SCHEDULER] Risk monitoring failed:`, error.message);
      }
    });

    this.jobs.push({ name: 'Risk Monitoring (every 4h)', job });
  }

  /**
   * Schedule weekly report generation
   * Runs every Sunday at 03:00 UTC
   */
  scheduleReportGeneration() {
    const job = cron.schedule('0 3 * * 0', async () => {
      console.log('\n📋 [SCHEDULER] Generating weekly report...');

      try {
        const stats = alertService.getAlertStats();
        const timestamp = new Date().toISOString();

        const report = {
          period: 'weekly',
          generatedAt: timestamp,
          week: `Week ${new Date().getWeek()} of ${new Date().getFullYear()}`,
          alerts: {
            total: stats.total,
            active: stats.pending + stats.sent,
            critical: stats.critical,
            acknowledged: stats.acknowledged,
            resolved: stats.resolved
          },
          model: {
            lastTrained: new Date().toISOString(),
            diseases: 4,
            trainingSize: 150
          }
        };

        console.log(`✓ [SCHEDULER] Weekly report generated:`);
        console.log(`  - Total alerts: ${report.alerts.total}`);
        console.log(`  - Critical: ${report.alerts.critical}`);
        console.log(`  - Resolved: ${report.alerts.resolved}`);

      } catch (error) {
        console.error(`✗ [SCHEDULER] Report generation failed:`, error.message);
      }
    });

    this.jobs.push({ name: 'Report Generation (03:00 Sundays)', job });
  }

  /**
   * Get facilities for monitoring (mock data)
   * In production, this would fetch from database
   */
  getFacilitiesForMonitoring() {
    return [
      {
        id: 'FARM-001',
        name: 'Anlegg Nord-Trøndelag',
        region: 'Nord-Trøndelag',
        latitude: 64.1466,
        longitude: 11.4871
      },
      {
        id: 'FARM-002',
        name: 'Anlegg Troms',
        region: 'Troms & Finnmark',
        latitude: 69.6492,
        longitude: 18.9553
      },
      {
        id: 'FARM-003',
        name: 'Anlegg Hordaland',
        region: 'Hordaland',
        latitude: 60.9711,
        longitude: 5.1913
      },
      {
        id: 'FARM-004',
        name: 'Anlegg Sogn',
        region: 'Sogn & Fjordane',
        latitude: 60.8894,
        longitude: 6.2231
      },
      {
        id: 'FARM-005',
        name: 'Anlegg Møre',
        region: 'Møre og Romsdal',
        latitude: 61.9273,
        longitude: 5.8663
      }
    ];
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('🛑 Stopping scheduler...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      job.destroy();
      console.log(`  ✓ Stopped: ${name}`);
    });
    this.jobs = [];
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.jobs.length > 0,
      jobs: this.jobs.map(j => j.name),
      isRetraining: this.isRetraining,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new Scheduler();

// Add helper method to Date for week calculation
Date.prototype.getWeek = function () {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};
