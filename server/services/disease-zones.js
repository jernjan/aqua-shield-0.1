/**
 * Disease Zone Service
 * Henter og lagrer ILA/PD-kontrollsoner fra BarentsWatch
 * Brukes for å vise røde soner til yrkesfiskere
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DiseaseZoneService {
  constructor() {
    this.zones = [];
    this.lastUpdate = null;
    this.cacheFile = path.join(__dirname, '../data/disease-zones-cache.json');
  }

  /**
   * Fetch ILA (ISA) protection and surveillance zones
   */
  async fetchILAZones(year, week) {
    try {
      console.log(`📡 Fetching ILA zones for week ${week}/${year}...`);
      
      const [protectionResponse, surveillanceResponse] = await Promise.all([
        axios.get(`https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/ilaprotectionzone/${year}/${week}`, {
          headers: { 'User-Agent': 'AquaShield-Fisher/0.1' },
          timeout: 10000
        }),
        axios.get(`https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/ilasurveillancezone/${year}/${week}`, {
          headers: { 'User-Agent': 'AquaShield-Fisher/0.1' },
          timeout: 10000
        })
      ]);

      const protectionZones = (protectionResponse.data || []).map(zone => ({
        ...zone,
        type: 'ILA_PROTECTION',
        severity: 'CRITICAL',
        disease: 'ISA',
        color: '#dc2626' // Red
      }));

      const surveillanceZones = (surveillanceResponse.data || []).map(zone => ({
        ...zone,
        type: 'ILA_SURVEILLANCE',
        severity: 'WARNING',
        disease: 'ISA',
        color: '#ea580c' // Orange
      }));

      return [...protectionZones, ...surveillanceZones];
    } catch (err) {
      console.warn(`⚠️  Failed to fetch ILA zones: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetch PD (Pancreatic Disease) protection and surveillance zones
   */
  async fetchPDZones(year, week) {
    try {
      console.log(`📡 Fetching PD zones for week ${week}/${year}...`);
      
      const [protectionResponse, surveillanceResponse] = await Promise.all([
        axios.get(`https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/pdprotectionzone/${year}/${week}`, {
          headers: { 'User-Agent': 'AquaShield-Fisher/0.1' },
          timeout: 10000
        }),
        axios.get(`https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/pdsurveillancezone/${year}/${week}`, {
          headers: { 'User-Agent': 'AquaShield-Fisher/0.1' },
          timeout: 10000
        })
      ]);

      const protectionZones = (protectionResponse.data || []).map(zone => ({
        ...zone,
        type: 'PD_PROTECTION',
        severity: 'CRITICAL',
        disease: 'PD',
        color: '#f59e0b' // Amber
      }));

      const surveillanceZones = (surveillanceResponse.data || []).map(zone => ({
        ...zone,
        type: 'PD_SURVEILLANCE',
        severity: 'WARNING',
        disease: 'PD',
        color: '#fbbf24' // Yellow
      }));

      return [...protectionZones, ...surveillanceZones];
    } catch (err) {
      console.warn(`⚠️  Failed to fetch PD zones: ${err.message}`);
      return [];
    }
  }

  /**
   * Get all current disease zones for both ILA and PD
   */
  async getAllZones(year = null, week = null) {
    // Use current week if not specified
    if (!year || !week) {
      const now = new Date();
      const yearNow = now.getFullYear();
      const weekNow = this.getWeek(now);
      year = year || yearNow;
      week = week || weekNow;
    }

    try {
      const ilaZones = await this.fetchILAZones(year, week);
      const pdZones = await this.fetchPDZones(year, week);
      
      this.zones = [...ilaZones, ...pdZones];
      this.lastUpdate = new Date().toISOString();

      // Cache to file
      this.saveCache();

      console.log(`✓ Loaded ${this.zones.length} disease zones`);
      return this.zones;
    } catch (err) {
      console.error('Error fetching zones:', err.message);
      // Return cached data if available
      return this.loadCache();
    }
  }

  /**
   * Get zones near a specific location (lat/lon)
   * Returns zones within specified radius (km)
   */
  getNearbyZones(latitude, longitude, radiusKm = 50) {
    return this.zones.filter(zone => {
      const distance = this.calculateDistance(
        latitude, 
        longitude, 
        zone.geometry?.coordinates?.[1] || 0,
        zone.geometry?.coordinates?.[0] || 0
      );
      return distance <= radiusKm;
    }).sort((a, b) => {
      const distA = this.calculateDistance(latitude, longitude, a.geometry?.coordinates?.[1], a.geometry?.coordinates?.[0]);
      const distB = this.calculateDistance(latitude, longitude, b.geometry?.coordinates?.[1], b.geometry?.coordinates?.[0]);
      return distA - distB;
    });
  }

  /**
   * Check if vessel is in a disease zone
   */
  isInZone(latitude, longitude, zoneId = null) {
    // Simplified: check if point is within bounding box
    // Full implementation would use polygon containment
    const nearbyZones = this.getNearbyZones(latitude, longitude, 5); // 5km radius
    
    if (zoneId) {
      return nearbyZones.some(z => z.id === zoneId);
    }
    
    return nearbyZones.length > 0;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get ISO week number
   */
  getWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Cache zones to file
   */
  saveCache() {
    try {
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify({
        zones: this.zones,
        lastUpdate: this.lastUpdate
      }, null, 2));
    } catch (err) {
      console.error('Failed to save zone cache:', err.message);
    }
  }

  /**
   * Load zones from cache
   */
  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.zones = data.zones || [];
        this.lastUpdate = data.lastUpdate;
        return this.zones;
      }
    } catch (err) {
      console.error('Failed to load zone cache:', err.message);
    }
    return [];
  }

  /**
   * Get zone statistics
   */
  getStats() {
    return {
      total: this.zones.length,
      ilaProtection: this.zones.filter(z => z.type === 'ILA_PROTECTION').length,
      ilaSurveillance: this.zones.filter(z => z.type === 'ILA_SURVEILLANCE').length,
      pdProtection: this.zones.filter(z => z.type === 'PD_PROTECTION').length,
      pdSurveillance: this.zones.filter(z => z.type === 'PD_SURVEILLANCE').length,
      lastUpdate: this.lastUpdate
    };
  }
}

module.exports = new DiseaseZoneService();
