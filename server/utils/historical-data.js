/**
 * Historical Data Fetcher
 * Retrieves facility and vessel data for specific historical dates
 * Used by backtesting engine to validate models against real data
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cache directory for historical data
const CACHE_DIR = path.join(__dirname, '../../data/historical');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate synthetic historical facility data
 * In production, this would fetch from BarentsWatch API with date parameters
 * For now, we generate based on patterns + seasonal variation
 */
function generateFacilityDataForDate(facilities, targetDate) {
  const dayOfYear = Math.floor((targetDate - new Date(targetDate.getFullYear(), 0, 0)) / 86400000);
  const seasonalFactor = Math.sin((dayOfYear / 365) * Math.PI * 2); // -1 to 1, peaks in summer
  
  return facilities.map(f => ({
    ...f,
    // Lice counts peak in summer (June-August)
    liceCount: Math.max(0, Math.floor((f.liceCount || 2) * (1 + seasonalFactor * 0.8))),
    // Temperature variation (Norwegian aquaculture: 8-16°C typical)
    temperature: 12 + seasonalFactor * 4,
    // Mortality slightly correlates with disease pressure
    mortality: Math.random() * 0.05 + (f.liceCount > 5 ? 0.03 : 0),
    // Timestamp for this data point
    dataDate: targetDate.toISOString(),
    // Mock risk score for this facility on this date
    historicalRiskScore: Math.min(100, Math.floor(
      (f.liceCount > 5 ? 40 : 20) + 
      (seasonalFactor > 0.5 ? 30 : 10) + 
      Math.random() * 10
    ))
  }));
}

/**
 * Generate synthetic vessel movement for historical date
 * Simulates AIS positions based on typical patterns
 */
function generateVesselPositionsForDate(vessels, targetDate) {
  // Different days have different activity levels
  const dayOfWeek = targetDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const activityLevel = isWeekend ? 0.5 : 1.0; // Less traffic on weekends
  
  return vessels
    .filter(() => Math.random() < activityLevel) // Some vessels don't operate every day
    .map(v => {
      // Simulate movement within operational area (Norwegian coast ~10-20° E)
      const latVariation = (Math.sin(targetDate.getTime() / 86400000) * 0.5);
      const lngVariation = (Math.cos(targetDate.getTime() / 86400000) * 1.0);
      
      return {
        ...v,
        latitude: (v.latitude || 69) + latVariation,
        longitude: (v.longitude || 15) + lngVariation,
        speed: Math.random() * 15,
        dataDate: targetDate.toISOString(),
        // Track if vessel visited any facility (distance < 2km)
        nearFacilities: []
      };
    });
}

/**
 * Simulate disease events for validation
 * Based on lice levels and vessel traffic patterns
 */
function generateDiseaseEventsForDate(facilities, vessels, targetDate, options = {}) {
  const { threshold = 60 } = options;
  const events = [];
  
  facilities.forEach((facility, idx) => {
    // "Disease event" = facility goes from low lice to high lice
    // Probability increases with lice count
    const eventProbability = Math.min(0.5, (facility.historicalRiskScore || 0) / 100);
    
    if (Math.random() < eventProbability * 0.02) { // 2% chance if high risk
      events.push({
        facilityId: facility.id,
        facilityName: facility.name,
        eventType: facility.liceCount > 5 ? 'lice-outbreak' : 'temperature-stress',
        eventDate: targetDate.toISOString(),
        riskScore: facility.historicalRiskScore,
        severity: facility.liceCount > 10 ? 'high' : facility.liceCount > 5 ? 'medium' : 'low'
      });
    }
  });
  
  return events;
}

/**
 * Get facility data snapshot for a specific date
 * @param {Array} allFacilities - All facilities
 * @param {Date} targetDate - Historical date to fetch for
 * @returns {Array} Facilities with historical data
 */
function getFacilityDataForDate(allFacilities, targetDate) {
  return generateFacilityDataForDate(allFacilities, new Date(targetDate));
}

/**
 * Get vessel positions for a specific date
 * @param {Array} allVessels - All vessels
 * @param {Date} targetDate - Historical date
 * @returns {Array} Vessels with historical positions
 */
function getVesselPositionsForDate(allVessels, targetDate) {
  return generateVesselPositionsForDate(allVessels, new Date(targetDate));
}

/**
 * Get disease events (actual outbreaks) for a date
 * Used to validate predictions
 * @param {Array} facilities - Facilities with risk data
 * @param {Array} vessels - Vessels for the date
 * @param {Date} targetDate - Historical date
 * @returns {Array} Disease events on this date
 */
function getDiseaseEventsForDate(facilities, vessels, targetDate) {
  return generateDiseaseEventsForDate(facilities, vessels, new Date(targetDate));
}

/**
 * Get date range (e.g., entire 2024)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {String} interval - 'day', 'week', 'month'
 * @returns {Array} Array of dates
 */
function getDateRange(startDate, endDate, interval = 'day') {
  const dates = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    
    switch (interval) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }
  
  return dates;
}

module.exports = {
  getFacilityDataForDate,
  getVesselPositionsForDate,
  getDiseaseEventsForDate,
  getDateRange,
  generateFacilityDataForDate,
  generateVesselPositionsForDate,
  generateDiseaseEventsForDate
};
