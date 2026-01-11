/**
 * Risk Prediction Model
 * Predicts outbreak risk based on historical data patterns
 */

const fs = require('fs');
const path = require('path');

class RiskPredictionModel {
  constructor() {
    this.trainingData = [];
    this.model = null;
    this.statistics = {
      avgDurationByDisease: {},
      avgSeverityByDisease: {},
      avgVesselContactByDisease: {},
      diseaseDistribution: {}
    };
  }

  /**
   * Load training data from CSV
   */
  loadTrainingData(csvPath) {
    console.log(`📖 Loading training data from ${csvPath}...`);
    
    if (!fs.existsSync(csvPath)) {
      console.warn(`⚠️  File not found: ${csvPath}`);
      return false;
    }

    try {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        console.warn('⚠️  CSV file is empty');
        return false;
      }

      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const record = {};
        
        for (let j = 0; j < headers.length; j++) {
          record[headers[j].trim()] = values[j] ? values[j].trim() : null;
        }

        this.trainingData.push(record);
      }

      console.log(`✓ Loaded ${this.trainingData.length} training examples`);
      return true;
    } catch (err) {
      console.error('❌ Failed to load training data:', err.message);
      return false;
    }
  }

  /**
   * Train model (calculate statistics from data)
   */
  train() {
    console.log('🧠 Training model...');

    if (this.trainingData.length === 0) {
      console.warn('⚠️  No training data loaded');
      return false;
    }

    // Calculate statistics by disease
    for (const record of this.trainingData) {
      const disease = record.diseaseCode || 'UNKNOWN';
      
      if (!this.statistics.avgDurationByDisease[disease]) {
        this.statistics.avgDurationByDisease[disease] = [];
        this.statistics.avgSeverityByDisease[disease] = [];
        this.statistics.avgVesselContactByDisease[disease] = [];
        this.statistics.diseaseDistribution[disease] = 0;
      }

      if (record.durationDays) {
        this.statistics.avgDurationByDisease[disease].push(parseInt(record.durationDays));
      }
      
      this.statistics.avgSeverityByDisease[disease].push(record.severity || 'unknown');
      
      if (record.vesselContactCount) {
        this.statistics.avgVesselContactByDisease[disease].push(parseInt(record.vesselContactCount));
      }

      this.statistics.diseaseDistribution[disease]++;
    }

    // Calculate averages
    const model = {
      trainingSize: this.trainingData.length,
      timestamp: new Date().toISOString(),
      diseases: {}
    };

    for (const disease in this.statistics.avgDurationByDisease) {
      const durations = this.statistics.avgDurationByDisease[disease];
      const contacts = this.statistics.avgVesselContactByDisease[disease];
      
      model.diseases[disease] = {
        count: this.statistics.diseaseDistribution[disease],
        avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        avgVesselContact: contacts.length > 0 ? (contacts.reduce((a, b) => a + b) / contacts.length).toFixed(1) : 0,
        prevalence: (this.statistics.diseaseDistribution[disease] / this.trainingData.length * 100).toFixed(1) + '%'
      };
    }

    this.model = model;
    console.log(`✓ Model trained on ${this.trainingData.length} examples`);
    console.log(`✓ Identified ${Object.keys(model.diseases).length} diseases`);
    
    return true;
  }

  /**
   * Predict risk for a facility
   */
  predictRisk(facilityData) {
    if (!this.model) {
      console.warn('⚠️  Model not trained yet');
      return null;
    }

    const { diseaseCode, vesselContactCount = 0, latitude, longitude } = facilityData;
    
    if (!diseaseCode || !this.model.diseases[diseaseCode]) {
      return {
        risk: 'unknown',
        confidence: 0,
        reason: 'Disease not in model'
      };
    }

    const diseaseStats = this.model.diseases[diseaseCode];
    
    // Calculate risk score (0-100)
    let riskScore = 0;
    
    // Factor 1: Historical prevalence (0-30 points)
    const prevalence = parseInt(diseaseStats.prevalence);
    riskScore += prevalence * 0.3;
    
    // Factor 2: Vessel contact correlation (0-40 points)
    const avgContact = parseFloat(diseaseStats.avgVesselContact);
    if (avgContact > 0) {
      const contactRatio = Math.min(vesselContactCount / avgContact, 1);
      riskScore += contactRatio * 40;
    }
    
    // Factor 3: Historical severity (0-30 points)
    const severityMap = { 'kritisk': 30, 'høy': 20, 'moderat': 10, 'lav': 5, 'unknown': 0 };
    const avgSeverity = this.statistics.avgSeverityByDisease[diseaseCode][0] || 'unknown';
    riskScore += severityMap[avgSeverity] || 0;

    // Determine risk level
    let riskLevel = 'lav';
    if (riskScore >= 70) riskLevel = 'kritisk';
    else if (riskScore >= 50) riskLevel = 'høy';
    else if (riskScore >= 30) riskLevel = 'moderat';

    return {
      risk: riskLevel,
      riskScore: Math.round(riskScore),
      confidence: Math.min((diseaseStats.count / 10) * 100, 95),
      historicalDuration: diseaseStats.avgDuration,
      prevalence: diseaseStats.prevalence,
      avgVesselContact: diseaseStats.avgVesselContact,
      details: {
        disease: diseaseCode,
        vesselContact: vesselContactCount,
        latitude,
        longitude
      }
    };
  }

  /**
   * Get model summary
   */
  getSummary() {
    if (!this.model) {
      return { error: 'Model not trained' };
    }

    return {
      trainingSize: this.model.trainingSize,
      diseaseCount: Object.keys(this.model.diseases).length,
      timestamp: this.model.timestamp,
      diseases: this.model.diseases
    };
  }

  /**
   * Save model to file
   */
  save(modelPath) {
    if (!this.model) {
      console.warn('⚠️  No model to save');
      return false;
    }

    try {
      const dir = path.dirname(modelPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(modelPath, JSON.stringify(this.model, null, 2), 'utf-8');
      console.log(`✓ Model saved to ${modelPath}`);
      return true;
    } catch (err) {
      console.error('❌ Failed to save model:', err.message);
      return false;
    }
  }

  /**
   * Load model from file
   */
  load(modelPath) {
    if (!fs.existsSync(modelPath)) {
      console.warn(`⚠️  Model file not found: ${modelPath}`);
      return false;
    }

    try {
      const content = fs.readFileSync(modelPath, 'utf-8');
      this.model = JSON.parse(content);
      console.log(`✓ Model loaded from ${modelPath}`);
      return true;
    } catch (err) {
      console.error('❌ Failed to load model:', err.message);
      return false;
    }
  }
}

module.exports = RiskPredictionModel;

// Example usage
if (require.main === module) {
  const model = new RiskPredictionModel();
  
  const dataPath = path.join(__dirname, '../data/ml-training-data.csv');
  const modelPath = path.join(__dirname, '../data/risk-model.json');

  if (model.loadTrainingData(dataPath)) {
    if (model.train()) {
      console.log('');
      console.log('📊 Model Summary:');
      console.log(JSON.stringify(model.getSummary(), null, 2));
      
      model.save(modelPath);

      // Test prediction
      console.log('');
      console.log('🔮 Test Prediction:');
      const testPrediction = model.predictRisk({
        diseaseCode: 'ISA',
        vesselContactCount: 3,
        latitude: 65.0,
        longitude: 12.0
      });
      console.log(JSON.stringify(testPrediction, null, 2));
    }
  }
}
