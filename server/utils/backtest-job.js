/**
 * Background Backtesting Job Manager
 * Runs backtesting asynchronously and tracks progress
 */

const { runBacktest } = require('./backtesting');

// Global job state
let currentJob = null;

class BacktestJob {
  constructor(db, startDate, endDate, step = '1day') {
    this.id = Date.now();
    this.db = db;
    this.startDate = startDate;
    this.endDate = endDate;
    this.step = step;
    this.status = 'pending'; // pending, running, completed, failed
    this.progress = 0; // 0-100
    this.currentDate = null;
    this.result = null;
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;
  }

  async run() {
    try {
      this.status = 'running';
      this.startedAt = new Date().toISOString();
      this.currentDate = this.startDate;

      console.log(`🔄 Starting backtest job ${this.id}`);
      console.log(`   Period: ${this.startDate} to ${this.endDate}`);
      console.log(`   Step: ${this.step}`);

      // Create progress callback
      const onProgress = (current, total) => {
        this.progress = Math.round((current / total) * 100);
        this.currentDate = current;
      };

      // Run the backtest with database
      // runBacktest(db, startDate, endDate, options)
      const parseStep = (step) => {
        if (step === '1day') return { interval: 'day', step: 24 };
        if (step === '7days') return { interval: 'week', step: 168 };
        if (step === '14days') return { interval: 'fortnight', step: 336 };
        return { interval: 'week', step: 168 };
      };

      const stepOptions = parseStep(this.step);
      
      this.result = await runBacktest(
        this.db,
        new Date(this.startDate),
        new Date(this.endDate),
        { ...stepOptions, verbose: true, onProgress }
      );

      this.status = 'completed';
      this.progress = 100;
      this.completedAt = new Date().toISOString();
      
      console.log(`✅ Backtest job ${this.id} completed`);
      console.log(`   Results: TP=${this.result.truePositives}, FP=${this.result.falsePositives}, FN=${this.result.falseNegatives}`);
      console.log(`   F1: ${this.result.f1.toFixed(3)}`);

      return this.result;
    } catch (err) {
      this.status = 'failed';
      this.error = err.message;
      this.completedAt = new Date().toISOString();
      
      console.error(`❌ Backtest job ${this.id} failed:`, err.message);
      throw err;
    }
  }

  getStatus() {
    return {
      id: this.id,
      status: this.status,
      progress: this.progress,
      currentDate: this.currentDate,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      startDate: this.startDate,
      endDate: this.endDate,
      step: this.step,
      error: this.error,
      result: this.result && this.status === 'completed' ? {
        sensitivity: this.result.sensitivity,
        specificity: this.result.specificity,
        f1: this.result.f1,
        precision: this.result.precision,
        truePositives: this.result.truePositives,
        falsePositives: this.result.falsePositives,
        falseNegatives: this.result.falseNegatives,
        trueNegatives: this.result.trueNegatives
      } : null
    };
  }
}

/**
 * Start a new backtest job
 */
function startBacktestJob(db, startDate, endDate, step = '1day') {
  // Kill previous job if still running
  if (currentJob && currentJob.status === 'running') {
    console.warn('⚠️ Previous backtest job still running, will replace');
  }

  const job = new BacktestJob(db, startDate, endDate, step);
  currentJob = job;

  // Run asynchronously (don't await)
  job.run().catch(err => {
    console.error('Job error:', err);
  });

  return job.id;
}

/**
 * Get current job status
 */
function getJobStatus(jobId = null) {
  if (!currentJob) {
    return null;
  }

  if (jobId && currentJob.id !== jobId) {
    return null; // Job not found
  }

  return currentJob.getStatus();
}

/**
 * Get current job result (only if completed)
 */
function getJobResult(jobId = null) {
  if (!currentJob) {
    return null;
  }

  if (jobId && currentJob.id !== jobId) {
    return null;
  }

  if (currentJob.status !== 'completed') {
    return null;
  }

  return currentJob.result;
}

module.exports = {
  BacktestJob,
  startBacktestJob,
  getJobStatus,
  getJobResult
};
