/**
 * ML Training Data Collector
 * Henter historikk fra BarentsWatch Fishhealth API for å bygge ML-treningsdata
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const WEEKS_TO_FETCH = 52 * 10; // 10 years
const BATCH_SIZE = 100;
const API_DELAY = 500; // ms between requests to avoid rate limiting

class HistoryCrawler {
  constructor() {
    this.outbreaks = [];
    this.vessels = [];
    this.errors = [];
    this.startDate = new Date();
    this.startDate.setFullYear(this.startDate.getFullYear() - 10);
  }

  /**
   * Sleep helper for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch outbreak history from BarentsWatch
   */
  async fetchOutbreakHistory() {
    console.log('🔄 Fetching outbreak history from BarentsWatch...');
    
    try {
      const response = await axios.get('https://www.barentswatch.no/bwapi/v2/fishhealth/disease', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AquaShield-MLTrainer/0.1'
        },
        timeout: 15000
      });

      const data = Array.isArray(response.data) ? response.data : response.data.items || [];
      
      console.log(`✓ Fetched ${data.length} disease records`);
      
      this.outbreaks = data.map((item, idx) => ({
        id: `outbreak_${item.localityNo}_${item.reportDate}`,
        facilityNo: item.localityNo,
        facilityName: item.localityName || `Anlegg ${item.localityNo}`,
        diseaseCode: item.diseaseCode,
        diseaseName: this.getDiseaseNameFromCode(item.diseaseCode),
        startDate: item.startDate,
        reportDate: item.reportDate,
        endDate: item.endDate,
        durationDays: item.endDate ? Math.floor((new Date(item.endDate) - new Date(item.startDate)) / (1000 * 60 * 60 * 24)) : null,
        severity: this.calculateSeverity(item),
        latitude: item.latitude,
        longitude: item.longitude,
        productionArea: item.productionAreaId,
        status: item.status,
        source: 'BarentsWatch_Fishhealth',
        recordIndex: idx
      }));

      return this.outbreaks;
    } catch (err) {
      const msg = `Failed to fetch outbreak history: ${err.message}`;
      console.error('❌', msg);
      console.log('⚠️  Using synthetic training data instead...');
      this.errors.push(msg);
      
      // Fallback: Generate synthetic historical data for demonstration
      return this.generateSyntheticOutbreaks();
    }
  }

  /**
   * Generate synthetic outbreak data (for testing)
   */
  generateSyntheticOutbreaks() {
    console.log('📝 Generating synthetic outbreak data...');
    
    const diseases = ['ISA', 'PD', 'PRV', 'SRS'];
    const regions = [
      { name: 'Nord-Trøndelag', lat: 65.0, lng: 11.5 },
      { name: 'Troms', lat: 68.5, lng: 17.0 },
      { name: 'Hordaland', lat: 60.0, lng: 5.5 },
      { name: 'Sogn', lat: 61.0, lng: 6.0 },
      { name: 'Møre', lat: 62.0, lng: 5.5 }
    ];

    const outbreaks = [];
    const today = new Date();

    // Generate 150 synthetic outbreaks over past 10 years
    for (let i = 0; i < 150; i++) {
      const daysAgo = Math.floor(Math.random() * 365 * 10);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysAgo);
      
      const duration = Math.floor(Math.random() * 90) + 5; // 5-95 days
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration);

      const disease = diseases[Math.floor(Math.random() * diseases.length)];
      const region = regions[Math.floor(Math.random() * regions.length)];

      outbreaks.push({
        id: `outbreak_synthetic_${i}`,
        facilityNo: 1000 + i,
        facilityName: `${region.name} Anlegg ${i}`,
        diseaseCode: disease,
        diseaseName: this.getDiseaseNameFromCode(disease),
        startDate: startDate.toISOString(),
        reportDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationDays: duration,
        severity: this.calculateSeverity({ startDate: startDate.toISOString(), diseaseCode: disease }),
        latitude: region.lat + (Math.random() - 0.5) * 2,
        longitude: region.lng + (Math.random() - 0.5) * 2,
        productionArea: `Area_${Math.floor(Math.random() * 10)}`,
        status: daysAgo < 90 ? 'active' : 'resolved',
        source: 'Synthetic_Training_Data',
        recordIndex: i
      });
    }

    console.log(`✓ Generated ${outbreaks.length} synthetic outbreaks`);
    this.outbreaks = outbreaks;
    return outbreaks;
  }

  /**
   * Fetch vessel movements during outbreak periods
   */
  async fetchVesselMovementsDuringOutbreaks() {
    console.log('🚢 Analyzing vessel movements during outbreak periods...');
    
    if (this.outbreaks.length === 0) {
      console.warn('⚠️  No outbreaks to analyze');
      return [];
    }

    // For now, create synthetic vessel data based on outbreak patterns
    // In production, this would query actual AIS data
    const movements = [];

    for (const outbreak of this.outbreaks) {
      if (!outbreak.startDate) continue;
      
      const outbreakStart = new Date(outbreak.startDate);
      const outbreakEnd = outbreak.endDate ? new Date(outbreak.endDate) : new Date(outbreakStart.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate synthetic vessel positions
      const vesselCount = Math.floor(Math.random() * 5) + 1;
      
      for (let i = 0; i < vesselCount; i++) {
        movements.push({
          vesselId: `vessel_${outbreak.facilityNo}_${i}`,
          outbreakId: outbreak.id,
          facilityNo: outbreak.facilityNo,
          facilityName: outbreak.facilityName,
          timestamp: new Date(outbreakStart.getTime() + Math.random() * (outbreakEnd - outbreakStart)),
          latitude: outbreak.latitude + (Math.random() - 0.5) * 0.1,
          longitude: outbreak.longitude + (Math.random() - 0.5) * 0.1,
          distanceToFacility: Math.random() * 50,
          daysBeforeOutbreak: Math.floor(Math.random() * 60) - 30,
          daysIntoOutbreak: Math.floor(Math.random() * outbreak.durationDays || 30),
          diseasePresent: outbreak.diseaseCode,
          diseaseSeverity: outbreak.severity
        });
      }

      await this.sleep(API_DELAY);
    }

    this.vessels = movements;
    console.log(`✓ Generated ${movements.length} vessel movement records`);
    return movements;
  }

  /**
   * Generate training dataset CSV
   */
  generateTrainingData() {
    console.log('📊 Generating training dataset...');

    const trainingData = [];

    for (const outbreak of this.outbreaks) {
      // Get vessel movements for this outbreak
      const vesselDuringOutbreak = this.vessels.filter(v => v.outbreakId === outbreak.id);
      
      // Calculate statistics
      const avgDistance = vesselDuringOutbreak.length > 0 
        ? vesselDuringOutbreak.reduce((sum, v) => sum + v.distanceToFacility, 0) / vesselDuringOutbreak.length
        : null;

      const vesselCount = new Set(vesselDuringOutbreak.map(v => v.vesselId)).size;

      trainingData.push({
        outbreakId: outbreak.id,
        facilityNo: outbreak.facilityNo,
        facilityName: outbreak.facilityName,
        diseaseCode: outbreak.diseaseCode,
        diseaseName: outbreak.diseaseName,
        startDate: outbreak.startDate,
        endDate: outbreak.endDate,
        durationDays: outbreak.durationDays,
        severity: outbreak.severity,
        latitude: outbreak.latitude,
        longitude: outbreak.longitude,
        productionArea: outbreak.productionArea,
        vesselContactCount: vesselCount,
        avgVesselDistance: avgDistance ? avgDistance.toFixed(2) : null,
        recordsCount: vesselDuringOutbreak.length,
        status: outbreak.status
      });
    }

    console.log(`✓ Generated ${trainingData.length} training examples`);
    return trainingData;
  }

  /**
   * Export to CSV
   */
  exportToCSV(data, filename) {
    if (data.length === 0) {
      console.warn('⚠️  No data to export');
      return;
    }

    // Get headers from first record
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    
    for (const record of data) {
      const values = headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    }

    // Ensure directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filename, csv, 'utf-8');
    console.log(`✓ Exported to ${filename}`);
  }

  /**
   * Helper: Convert disease code to name
   */
  getDiseaseNameFromCode(code) {
    const diseases = {
      'ISA': 'Infectious Salmon Anaemia',
      'PD': 'Pancreatic Disease',
      'PRV': 'Piscine Reovirus',
      'SRS': 'Salmon Rickettsial Septicaemia',
      'CMS': 'Cardiomyopathy Syndrome',
      'HVS': 'Hitra Virus Syndrome',
      'IPN': 'Infectious Pancreatic Necrosis',
      'VHS': 'Viral Haemorrhagic Septicaemia'
    };
    return diseases[code] || code || 'Unknown Disease';
  }

  /**
   * Helper: Calculate severity
   */
  calculateSeverity(item) {
    if (!item || !item.startDate) return 'unknown';
    
    const startDate = new Date(item.startDate);
    const now = new Date();
    const daysActive = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    
    if (item.diseaseCode === 'ISA' || daysActive > 60) return 'kritisk';
    if (daysActive > 30) return 'høy';
    if (daysActive > 14) return 'moderat';
    return 'lav';
  }

  /**
   * Run full pipeline
   */
  async run() {
    console.log('🚀 Starting ML Training Data Collection Pipeline');
    console.log(`📅 Period: ${this.startDate.toLocaleDateString('no-NO')} - ${new Date().toLocaleDateString('no-NO')}`);
    console.log('');

    try {
      // Step 1: Fetch outbreak history
      await this.fetchOutbreakHistory();
      
      // Step 2: Fetch vessel movements
      await this.fetchVesselMovementsDuringOutbreaks();
      
      // Step 3: Generate training data
      const trainingData = this.generateTrainingData();
      
      // Step 4: Export
      const outputDir = path.join(__dirname, '../data');
      this.exportToCSV(this.outbreaks, path.join(outputDir, 'ml-outbreaks-history.csv'));
      this.exportToCSV(this.vessels, path.join(outputDir, 'ml-vessel-movements.csv'));
      this.exportToCSV(trainingData, path.join(outputDir, 'ml-training-data.csv'));

      console.log('');
      console.log('✅ Pipeline complete!');
      console.log(`   Outbreaks: ${this.outbreaks.length}`);
      console.log(`   Vessel movements: ${this.vessels.length}`);
      console.log(`   Training examples: ${trainingData.length}`);
      console.log(`   Errors: ${this.errors.length}`);

      return {
        success: true,
        outbreakCount: this.outbreaks.length,
        vesselCount: this.vessels.length,
        trainingExamples: trainingData.length,
        errors: this.errors
      };
    } catch (err) {
      console.error('❌ Pipeline failed:', err.message);
      return {
        success: false,
        error: err.message,
        errors: this.errors
      };
    }
  }
}

// Export for use
module.exports = HistoryCrawler;

// Run if called directly
if (require.main === module) {
  const crawler = new HistoryCrawler();
  crawler.run().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
