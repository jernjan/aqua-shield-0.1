// facility-data.js - Data fetching and management

// Auto-detect API base URL: Render vs localhost
const API_BASE = window.location.hostname.includes('render.com') 
  ? 'https://kyst-api.render.com'
  : 'http://localhost:8000';

const FacilityData = {
  facilities: [],
  diseaseSpreadData: null,
  auditLog: [],
  vessels: [],
  lastVesselsFetch: 0,
  vesselErrorBackoffMs: 5 * 60 * 1000,
  vesselsSource: 'unknown',
  vesselsError: null,
  confirmedPlans: [],
  lastPlansFetch: 0,
  currentOceanData: null,
  oceanCurrentCache: {},
  quarantineCache: {},
  quarantineAnalysisData: {},
  lastQuarantineAnalysisFetch: 0,
  lastQuarantineFetch: {},
  activeQuarantines: [],
  lastProximityCheck: 0,
  proximityCheckInterval: 5 * 60 * 1000, // 5 minutes
  debugRiskMatching: false,
  facilitiesLoaded: false, // Flag to track when facilities are ready
  riskByCode: {},
  riskByName: {},
  _vesselGeoKey: null, // tracks last geo-filter so cache invalidates on facility change
  _fdirEnriched: false, // deferred: FDIR runs once on first facility select, not at startup
  _proximityTimeoutLogged: false,
  _activeQuarantineTimeoutLogged: false,
  
  // Initialize and load all data
  async init() {
    try {
      // Try the fast BFF snapshot first (single request — includes FDIR + disease-spread)
      const snapshotOk = await this.loadFromSnapshot();

      if (!snapshotOk) {
        // Fallback: paginated facility load + background disease-spread
        await this.loadFacilities();
        this.loadDiseaseSpreadData().catch(e =>
          console.warn('⚠️ Background disease-spread load failed:', e.message)
        );
      }

      // NOTE: visits/audit log are loaded on-demand when a facility is selected
      
      return true;
    } catch (error) {
      console.error('Failed to load facility data:', error);
      return false;
    }
  },

  /**
   * Load facility data from the pre-aggregated backend snapshot.
   * One request replaces ~30 paginated /api/facilities calls + a separate FDIR round-trip.
   * Returns true on success, false if the snapshot is unavailable (triggers fallback).
   */
  async loadFromSnapshot() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);

      const res = await fetch(`${API_BASE}/api/facility-dashboard/snapshot`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.warn(`⚠️ Snapshot endpoint returned ${res.status} — falling back`);
        return false;
      }

      const snap = await res.json();
      const rawFacilities = snap.facilities || [];

      this.facilities = rawFacilities.map(f => ({
        ...f,
        latitude: this.parseCoordinate(f.latitude),
        longitude: this.parseCoordinate(f.longitude),
      }));

      // FDIR is fetched lazily on first facility select — let the normal
      // _enrichWithFdir() flow handle it via the fast /fdir/indexed endpoint.
      // this._fdirEnriched stays false so lazy enrichment still runs.

      const age = snap.snapshot_age_seconds ?? '?';
      

      // Persist for offline fallback
      try {
        localStorage.setItem('facilityDashboardFacilitiesCacheV1', JSON.stringify({
          ts: Date.now(),
          facilities: this.facilities,
        }));
      } catch (_) {}

      // Process disease-spread data bundled in the snapshot
      if (snap.disease_spread) {
        this.diseaseSpreadData = snap.disease_spread;
        this.rebuildRiskIndex();
        this._mergeDiseaseSpreadFacilities(snap.disease_spread);
        
        // Refresh map once disease data is available
        if (typeof FacilityMap !== 'undefined' && typeof FacilityMap.displayAllFacilities === 'function') {
          if (!FacilityMap.selectedFacilityMarker) {
            setTimeout(() => {
              try { FacilityMap.displayAllFacilities(); } catch (_) {}
            }, 0);
          }
        }
      } else {
        // Snapshot had no disease-spread cache — fetch it in the background
        this.loadDiseaseSpreadData().catch(e =>
          console.warn('⚠️ Background disease-spread load failed:', e.message)
        );
      }

      return true;
    } catch (err) {
      console.warn('⚠️ Snapshot load failed, using fallback:', err.message);
      return false;
    }
  },

  /** Merge confirmed diseased facilities from disease-spread data into this.facilities. */
  _mergeDiseaseSpreadFacilities(data) {
    if (!data?.confirmed_diseased_facilities?.length) return;
    data.confirmed_diseased_facilities.forEach(diseased => {
      let existing = this.facilities.find(f =>
        this.fuzzyNameMatch(f.name, diseased.facility_name) ||
        f.localityNo === diseased.facility_code
      );
      if (!existing && diseased.latitude && diseased.longitude) {
        existing = this.facilities.find(f => {
          if (!f.latitude || !f.longitude) return false;
          return this.calculateDistance(f.latitude, f.longitude, diseased.latitude, diseased.longitude) < 2;
        });
      }
      if (existing) {
        existing.diseases = diseased.diseases;
        existing.latitude = diseased.latitude;
        existing.longitude = diseased.longitude;
      } else {
        this.facilities.push({
          name: diseased.facility_name,
          localityNo: diseased.facility_code,
          latitude: diseased.latitude,
          longitude: diseased.longitude,
          diseases: diseased.diseases,
        });
      }
    });
  },

  async _fetchFacilitiesPaged({ includeFdirMetadata = false, timeoutMs = 60000 } = {}) {
    const limit = 500;
    let skip = 0;
    const allFacilities = [];

    while (true) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);

      const query = new URLSearchParams({
        limit: String(limit),
        skip: String(skip)
      });
      if (includeFdirMetadata) query.set('include_fdir_metadata', 'true');

      const response = await fetch(`${API_BASE}/api/facilities?${query.toString()}`, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const pageFacilities = data.facilities || [];
      allFacilities.push(...pageFacilities);

      if (pageFacilities.length < limit) break;
      skip += limit;
      if (skip > 10000) break;
    }

    return allFacilities;
  },
  
  // Load facilities from API
  async loadFacilities() {
    try {
      // Load all facilities (paginated) so BW zones can match across entire map
      const rawFacilities = await this._fetchFacilitiesPaged({
        includeFdirMetadata: false,
        timeoutMs: 60000
      });
      this.facilities = rawFacilities.map((facility) => ({
        ...facility,
        latitude: this.parseCoordinate(facility.latitude),
        longitude: this.parseCoordinate(facility.longitude)
      }));
      

      try {
        localStorage.setItem('facilityDashboardFacilitiesCacheV1', JSON.stringify({
          ts: Date.now(),
          facilities: this.facilities
        }));
      } catch (_) {
        // Ignore storage errors
      }

      // NOTE: FDIR enrichment is deferred until the first facility is selected (see updateDashboard in app.js)
    } catch (error) {
      console.warn('Failed to load facilities:', error);
      try {
        const cached = localStorage.getItem('facilityDashboardFacilitiesCacheV1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.facilities) && parsed.facilities.length > 0) {
            this.facilities = parsed.facilities;
            
            return;
          }
        }
      } catch (_) {
        // Ignore cache read errors
      }
      this.facilities = [];
    }
  },

  // Background enrichment with FDIR metadata (non-blocking) — called once on first facility select.
  // Uses a SINGLE request to /api/facilities/fdir/indexed which returns the full FDIR dict keyed
  // by localityNo. The backend serves this from its 12-hour in-memory cache (pre-warmed at startup).
  async _enrichWithFdir() {
    if (this._fdirEnriched) return; // already done or in progress
    this._fdirEnriched = true;    // guard: prevent duplicate calls
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(`${API_BASE}/api/facilities/fdir/indexed`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { fdir_map } = await res.json();
      let updated = 0;
      this.facilities.forEach(f => {
        const key = String(f.localityNo ?? '');
        if (key && fdir_map[key]) {
          f.fdir = fdir_map[key];
          updated++;
        }
      });
      
    } catch (e) {
      console.info('ℹ️ FDIR-berikelse hoppet over (timeout/offline):', e.message);
    }
  },
  
  // Load disease-spread data from API
  async loadDiseaseSpreadData() {
    try {
      const cacheBust = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout (API can be slow with GeoJSON processing)
      
      
      const response = await fetch(`${API_BASE}/api/facilities/disease-spread?ts=${cacheBust}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`❌ Disease-spread endpoint returned ${response.status}`);
        this.diseaseSpreadData = { confirmed_diseased_facilities: [], all_at_risk_facilities: [] };
        return;
      }
      
      const data = await response.json();
      this.diseaseSpreadData = data;
      this.rebuildRiskIndex();
      
      
      

      this._mergeDiseaseSpreadFacilities(data);
      

      
        // Re-render map markers when disease status is known.
        // If user already has a selected facility view, skip heavy full overview redraw.
        if (typeof FacilityMap !== 'undefined' && typeof FacilityMap.displayAllFacilities === 'function') {
          if (FacilityMap.selectedFacilityMarker) {
            
          } else {
            
            setTimeout(() => {
              try {
                FacilityMap.displayAllFacilities();
              } catch (e) {
                console.warn('⚠️ Deferred map refresh failed:', e?.message || e);
              }
            }, 0);
          }
        }
    } catch (error) {
      console.warn('⚠️ Failed to load disease-spread data:', error.message);
      // Set empty data structure so app can continue without BarentsWatch data
      this.diseaseSpreadData = { confirmed_diseased_facilities: [], all_at_risk_facilities: [] };
      this.rebuildRiskIndex();
    }
  },

  rebuildRiskIndex() {
    const list = this.diseaseSpreadData?.all_at_risk_facilities;
    this.riskByCode = {};
    this.riskByName = {};

    if (!Array.isArray(list) || list.length === 0) return;

    list.forEach((risk) => {
      const code = risk?.facility_code;
      if (code !== undefined && code !== null && String(code).trim() !== '') {
        this.riskByCode[String(code)] = risk;
      }

      const name = String(risk?.facility_name || '').trim().toLowerCase();
      if (!name) return;
      if (!this.riskByName[name]) this.riskByName[name] = [];
      this.riskByName[name].push(risk);
    });
  },
  
  // Load audit log (visits)
  async loadAuditLog() {
    try {
      const response = await fetch(`${API_BASE}/api/audit/visits-log`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.auditLog = data.visits || data.entries || [];
      
    } catch (error) {
      console.warn('Failed to load audit log:', error);
      this.auditLog = [];
    }
  },

  // Load AIS vessels (cached for 5 minutes).
  // Optional: pass { lat, lon, radiusKm } to only keep vessels within that circle.
  async loadVessels(limit = 10000, { lat = null, lon = null, radiusKm = null } = {}) {
    const now = Date.now();
    const cacheMs = 5 * 60 * 1000;

    // Use cached vessels if fresh — but re-filter when a different facility/radius is requested
    const geoKey = (lat != null && lon != null && radiusKm != null)
      ? `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`
      : null;
    if (this.vessels.length > 0 && (now - this.lastVesselsFetch) < cacheMs && this._vesselGeoKey === geoKey) {
      return this.vessels;
    }

    if (this.vesselsSource === 'error' && (now - this.lastVesselsFetch) < this.vesselErrorBackoffMs) {
      
      return [];
    }

    try {
      
      const response = await fetch(`${API_BASE}/api/vessels?limit=${limit}`);
      
      
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      
      
      
      let vessels = data.vessels || [];

      // Client-side geo-filter: only keep vessels within the requested radius
      if (lat != null && lon != null && radiusKm != null && vessels.length > 0) {
        const R = 6371; // Earth radius km
        const toRad = (d) => (d * Math.PI) / 180;
        vessels = vessels.filter((v) => {
          const vLat = parseFloat(v.latitude);
          const vLon = parseFloat(v.longitude);
          if (isNaN(vLat) || isNaN(vLon)) return false;
          const dLat = toRad(vLat - lat);
          const dLon = toRad(vLon - lon);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) * Math.cos(toRad(vLat)) * Math.sin(dLon / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(a)) <= radiusKm;
        });
        
      }

      this.vessels = vessels;
      this._vesselGeoKey = geoKey;
      this.vesselsSource = data.source || 'ais';
      this.vesselsError = data.error || null;
      this.lastVesselsFetch = now;
      
      
      if (this.velocityError) {
        console.warn(`⚠️ API error flag: ${this.vesselsError}`);
      }
      
      // Load quarantine analysis in parallel (non-blocking)
      this.loadQuarantineAnalysisData().catch(err => {
        console.warn('⚠️ Could not load quarantine analysis:', err);
      });
      
      return this.vessels;
    } catch (error) {
      console.warn('❌ Failed to load AIS vessels:', error);
      
      this.vessels = [];
      this.vesselsSource = 'error';
      this.vesselsError = error.message || String(error);
      this.lastVesselsFetch = now;
      return [];
    }
  },

  async loadQuarantineAnalysisData() {
    const now = Date.now();
    const cacheMs = 5 * 60 * 1000; // 5 minute cache

    if (Object.keys(this.quarantineAnalysisData).length > 0 && (now - this.lastQuarantineAnalysisFetch) < cacheMs) {
      return this.quarantineAnalysisData;
    }

    try {
      const response = await fetch(`${API_BASE}/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7`, {
        timeout: 30000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const vessels = data.vessels || [];
      
      // Build MMSI -> quarantine_analysis map
      const analysisMap = {};
      vessels.forEach(vessel => {
        const mmsi = String(vessel.mmsi);
        if (vessel.quarantine_analysis) {
          analysisMap[mmsi] = vessel.quarantine_analysis;
        }
      });
      
      this.quarantineAnalysisData = analysisMap;
      this.lastQuarantineAnalysisFetch = now;
      
      
      
      return this.quarantineAnalysisData;
    } catch (error) {
      console.warn('⚠️ Failed to load quarantine analysis:', error);
      return {};
    }
  },

  // Load confirmed boat plans (cached for 5 minutes)
  async loadConfirmedPlans() {
    const now = Date.now();
    const cacheMs = 5 * 60 * 1000;

    if (this.confirmedPlans.length > 0 && (now - this.lastPlansFetch) < cacheMs) {
      return this.confirmedPlans;
    }

    try {
      const response = await fetch(`${API_BASE}/api/boat/plan/confirmed`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.confirmedPlans = data.plans || [];
      this.lastPlansFetch = now;
      
      return this.confirmedPlans;
    } catch (error) {
      console.warn('Failed to load confirmed boat plans:', error);
      this.confirmedPlans = [];
      return [];
    }
  },

  // Load ocean current data (cached for 1 hour)
  async loadOceanCurrent(latitude, longitude) {
    const data = await this.getOceanCurrentAt(latitude, longitude);
    this.currentOceanData = data;
    return data;
  },

  // Get ocean current data at a specific location without mutating currentOceanData
  async getOceanCurrentAt(latitude, longitude) {
    const cacheKey = `current_${latitude}_${longitude}`;
    const now = Date.now();
    const cacheMs = 60 * 60 * 1000; // 1 hour cache

    if (this.oceanCurrentCache && this.oceanCurrentCache[cacheKey] && 
        (now - this.oceanCurrentCache[cacheKey].timestamp) < cacheMs) {
      return this.oceanCurrentCache[cacheKey].data;
    }

    if (!this.oceanCurrentCache) {
      this.oceanCurrentCache = {};
    }

    try {
      const response = await fetch(`${API_BASE}/api/ocean/current?lat=${latitude}&lon=${longitude}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.oceanCurrentCache[cacheKey] = { data, timestamp: now };
      
      return data;
    } catch (error) {
      console.warn('Failed to load ocean current:', error);
      return null;
    }
  },

  // Check proximity to infected facilities and auto-register vessels
  async checkProximityToInfectedFacilities() {
    try {
      const response = await fetch(
        `${API_BASE}/api/vessel/auto-register/check-proximity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000)
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (result.count > 0) {
        
      }
      return result;
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || String(error?.message || '').toLowerCase().includes('timed out');
      if (isTimeout) {
        if (!this._proximityTimeoutLogged) {
          console.info('ℹ️ Proximity check timed out (optional), continuing without auto-register update.');
          this._proximityTimeoutLogged = true;
        }
      } else {
        console.warn('⚠️ Proximity check failed:', error);
      }
      return { newly_registered: [], count: 0 };
    }
  },

  // Load all active quarantines (boats in quarantine)
  async loadActiveQuarantines() {
    try {
      const response = await fetch(
        `${API_BASE}/api/vessel/quarantines/active`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.activeQuarantines = data.active_quarantines || [];
      if (this.activeQuarantines.length > 0) {
        
      }
      return this.activeQuarantines;
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || String(error?.message || '').toLowerCase().includes('timed out');
      if (isTimeout) {
        if (!this._activeQuarantineTimeoutLogged) {
          console.info('ℹ️ Active quarantines request timed out (optional), using empty list for now.');
          this._activeQuarantineTimeoutLogged = true;
        }
      } else {
        console.warn('⚠️ Failed to load active quarantines:', error);
      }
      this.activeQuarantines = [];
      return [];
    }
  },
  
  // Get facility by ID or name
  getFacility(idOrName) {
    // First, try exact numerical match (localityNo or id)
    const byId = this.facilities.find(f => 
      f.localityNo === idOrName || 
      f.id === idOrName
    );
    if (byId) return byId;
    
    // For name matches, if there are multiple results, prefer infected facilities
    const matches = this.facilities.filter(f => f.name === idOrName);
    
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    
    // Multiple matches: prefer infected facility (has diseases)
    const infected = matches.find(f => {
      const diseases = f.diseases || f.diseaseInfo?.diseases || [];
      return Array.isArray(diseases) && diseases.length > 0;
    });
    if (infected) return infected;
    
    // If no infected facility, return the first match (original behavior)
    return matches[0];
  },
  
  // Get risk data for a specific facility
  getFacilityRiskData(facility, options = {}) {
    const skipGeo = options?.skipGeo === true;
    if (!this.diseaseSpreadData || !this.diseaseSpreadData.all_at_risk_facilities) {
      return null;
    }

    const riskList = this.diseaseSpreadData.all_at_risk_facilities;

    const recordMatch = (risk, method, detail) => {
      if (facility && typeof facility === 'object') {
        facility.bwMatchMethod = method;
      }
      if (this.debugRiskMatching) {
        const facilityName = facility?.name || facility?.facility_name || String(facility || '');
        
      }
      return { ...risk, _match_method: method };
    };

    if (facility && typeof facility === 'object') {
      const facilityCode = facility.localityNo ?? facility.facility_code ?? facility.code ?? facility.id;
      if (facilityCode !== undefined && facilityCode !== null) {
        const matchedByCode = this.riskByCode[String(facilityCode)] || null;
        if (matchedByCode) {
          return recordMatch(matchedByCode, 'code', `code=${facilityCode}`);
        }
      }

      const facilityName = facility.name || facility.facility_name;
      if (facilityName) {
        const normName = facilityName.toLowerCase().trim();
        const nameMatches = this.riskByName[normName] || [];
        if (nameMatches.length === 1) {
          return recordMatch(nameMatches[0], 'name');
        }
      }

      if (!skipGeo && facility.latitude && facility.longitude) {
        const closeMatch = riskList.find(risk => {
          const pos = risk.position || {};
          if (!pos.latitude || !pos.longitude) return false;
          const dist = this.calculateDistance(
            facility.latitude,
            facility.longitude,
            pos.latitude,
            pos.longitude
          );
          return dist <= 1;
        });
        if (closeMatch) {
          return recordMatch(closeMatch, 'geo', 'dist<=1km');
        }
      }

      return null;
    }

    if (typeof facility === 'string') {
      const facilityName = facility;
      const norm = facilityName.toLowerCase().trim();
      const nameMatches = this.riskByName[norm] || [];
      if (nameMatches.length === 1) {
        return { ...nameMatches[0], _match_method: 'name' };
      }
      return null;
    }

    return null;
  },

  // Get nearby BW-risk facilities (Høy/Ekstrem) within a radius
  normalizeRiskLevel(level) {
    if (level === null || level === undefined) return '';
    return String(level)
      // Replace Norwegian letters not decomposed by NFD before stripping diacritics
      .replace(/ø/gi, 'o')   // ø (U+00F8) is not decomposed by NFD — must handle explicitly
      .replace(/æ/gi, 'ae')
      .replace(/å/gi, 'a')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  },

  isSevereRiskLevel(level) {
    const normalized = this.normalizeRiskLevel(level);
    return normalized === 'ekstrem'
      || normalized === 'extreme'
      || normalized === 'hoy'
      || normalized === 'high'
      || normalized === 'critical';
  },

  // Get nearby BW-risk facilities (Høy/Ekstrem) within a radius
  getBWRiskFacilitiesWithinDistance(lat, lon, radiusKm = 15) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    if (!this.diseaseSpreadData || !this.diseaseSpreadData.all_at_risk_facilities) return [];

    const riskList = this.diseaseSpreadData.all_at_risk_facilities;

    return riskList
      .filter(risk => this.isSevereRiskLevel(risk.risk_level))
      .map(risk => {
        const pos = risk.position || {};
        const riskLat = Number(pos.latitude ?? risk.latitude);
        const riskLon = Number(pos.longitude ?? risk.longitude);
        return { risk, latitude: riskLat, longitude: riskLon };
      })
      .filter(entry => Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude))
      .map(entry => {
        const distance = this.calculateDistance(lat, lon, entry.latitude, entry.longitude);
        return { ...entry, distance };
      })
      .filter(entry => entry.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  },
  
  // Get visits for a specific facility (by name and/or id)
  getFacilityVisits(facilityOrName, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const parseVisitDate = (visit) => {
      if (visit.visit_timestamp) return new Date(visit.visit_timestamp);
      if (visit.timestamp) return new Date(visit.timestamp);
      if (visit.visit_date) return new Date(visit.visit_date);
      return new Date('2000-01-01');
    };

    const normalize = (value) => String(value || '').toLowerCase().trim();
    const facilityName = typeof facilityOrName === 'string'
      ? facilityOrName
      : (facilityOrName?.name || facilityOrName?.facility_name || '');
    const facilityId = typeof facilityOrName === 'object'
      ? (facilityOrName?.code || facilityOrName?.localityNo || facilityOrName?.locality_no || facilityOrName?.id || '')
      : '';
    const normalizedName = normalize(facilityName);
    const normalizedId = normalize(facilityId);

    return this.auditLog.filter(visit => {
      if (!visit.facility_name) return false;

      const matchesName = normalize(visit.facility_name) === normalizedName;
      const matchesId = normalizedId && normalize(visit.facility_id) === normalizedId;
      const visitDate = parseVisitDate(visit);
      const isRecent = visitDate >= cutoffDate;

      return (matchesName || matchesId) && isRecent;
    }).sort((a, b) => parseVisitDate(b) - parseVisitDate(a));
  },
  
  // Get infected facilities
  getInfectedFacilities() {
    return this.facilities.filter(f => {
      const diseases = f.diseases || f.diseaseInfo?.diseases || [];
      return Array.isArray(diseases) && diseases.length > 0;
    });
  },

  // Get facilities within local smitte radius (10km from any infected facility)
  getFacilitiesInLocalSmitteRadius(radiusKm = 10) {
    const infected = this.getInfectedFacilities();
    if (infected.length === 0) return [];

    const facilitiesInRadius = [];
    const seen = new Set();

    infected.forEach(infectedFac => {
      this.facilities.forEach(facility => {
        // Skip if already added
        if (seen.has(facility.name)) return;

        // Skip the infected facility itself
        if (facility.name === infectedFac.name) return;

        // Skip other infected facilities
        const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
        const isInfected = Array.isArray(diseases) && diseases.length > 0;
        if (isInfected) return;

        // Check distance
        if (!facility.latitude || !facility.longitude) return;
        const distance = this.calculateDistance(
          infectedFac.latitude,
          infectedFac.longitude,
          facility.latitude,
          facility.longitude
        );

        if (distance <= radiusKm) {
          seen.add(facility.name);
          facilitiesInRadius.push({
            facility: facility,
            distance: distance
          });
        }
      });
    });

    return facilitiesInRadius.sort((a, b) => a.distance - b.distance);
  },
  
  parseCoordinate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalized = String(value).trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  },

  // Calculate distance between two points (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const pLat1 = this.parseCoordinate(lat1);
    const pLon1 = this.parseCoordinate(lon1);
    const pLat2 = this.parseCoordinate(lat2);
    const pLon2 = this.parseCoordinate(lon2);

    if (![pLat1, pLon1, pLat2, pLon2].every(Number.isFinite)) {
      return Infinity;
    }

    const R = 6371; // Earth radius in km
    const dLat = (pLat2 - pLat1) * Math.PI / 180;
    const dLon = (pLon2 - pLon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pLat1 * Math.PI / 180) * Math.cos(pLat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
  
  // Fuzzy name matching (tolerates minor variations)
  fuzzyNameMatch(name1, name2, threshold = 0.7) {
    if (!name1 || !name2) return false;
    
    const norm1 = name1.toLowerCase().trim();
    const norm2 = name2.toLowerCase().trim();
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // One contains the other (for "Lamholmen" vs "Lamholmen AS")
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    // Levenshtein distance for typos
    const maxLen = Math.max(norm1.length, norm2.length);
    const editDistance = this.levenshteinDistance(norm1, norm2);
    const similarity = 1 - (editDistance / maxLen);
    
    return similarity >= threshold;
  },
  
  // Levenshtein distance for string similarity
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  },
  
  // Find infected facilities within distance
  findInfectedWithinDistance(lat, lon, maxDistance) {
    const infected = this.getInfectedFacilities();
    
    return infected.map(facility => {
      const distance = this.calculateDistance(
        lat, lon,
        facility.latitude, facility.longitude
      );
      
      return {
        facility,
        distance,
        diseases: facility.diseases || []
      };
    })
    .filter(item => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
  },

  // Find AIS vessels within distance
  findVesselsWithinDistance(lat, lon, maxDistance) {
    const vessels = Array.isArray(this.vessels) ? this.vessels : [];

    const facilityLat = this.parseCoordinate(lat);
    const facilityLon = this.parseCoordinate(lon);
    if (!Number.isFinite(facilityLat) || !Number.isFinite(facilityLon)) {
      console.warn('⚠️ Invalid facility coordinates for vessel search:', { lat, lon });
      return [];
    }

    let invalidCoordCount = 0;
    let tooFarCount = 0;
    let withinRangeCount = 0;

    const results = vessels.map(vessel => {
      const vLat = this.parseCoordinate(vessel.latitude);
      const vLon = this.parseCoordinate(vessel.longitude);

      if (!Number.isFinite(vLat) || !Number.isFinite(vLon)) {
        invalidCoordCount++;
        return null;
      }

      const distance = this.calculateDistance(facilityLat, facilityLon, vLat, vLon);
      
      if (distance <= maxDistance) {
        withinRangeCount++;
      } else {
        tooFarCount++;
      }
      
      return {
        vessel,
        distance
      };
    })
    .filter(item => item && item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

    
    if (results.length > 0) {
      
    }

    return results;
  },

  // Determine vessel status based on confirmed plans and quarantine status
  async getVesselStatus(mmsi) {
    if (!mmsi) return 'unregistered';

    // Check quarantine status first (higher priority)
    const quarantineStatus = await this.checkQuarantineStatus(mmsi);
    if (quarantineStatus === 'breach' || quarantineStatus === 'quarantine' || quarantineStatus === 'caution') {
      return quarantineStatus;
    }

    // Fall back to confirmed plans for health pass status
    const plan = this.confirmedPlans.find(p => String(p.mmsi) === String(mmsi));
    if (!plan) return 'unregistered';

    const route = Array.isArray(plan.route) ? plan.route : [];
    const hasRisk = route.some(day => day?.needs_quarantine === true || day?.has_infected === true);

    return hasRisk ? 'not-cleared' : 'cleared';
  },

  // Get vessel status with a short reason for UI
  async getVesselStatusDetails(mmsi) {
    const status = await this.getVesselStatus(mmsi);
    const cached = this.quarantineCache[mmsi];
    let reason = '';

    if (status === 'breach') {
      reason = '⛔ KARANTENEBRUDD - Besøkt annet anlegg innen 48t';
    } else if (status === 'quarantine' || status === 'caution') {
      const source = cached?.source === 'auto_registered'
        ? 'Auto-registrert karantene'
        : 'Karantene fra planer';
      const hours = Number.isFinite(cached?.hoursRemaining)
        ? Math.max(0, Math.round(cached.hoursRemaining))
        : null;
      reason = hours !== null && hours > 0
        ? `${source} (${hours} t igjen)`
        : source;
    } else if (status === 'not-cleared') {
      reason = 'Planlagt rute har smitte/karantene';
    } else if (status === 'cleared') {
      reason = 'Godkjent plan uten risiko';
    } else {
      reason = 'Ingen godkjent plan';
    }

    return { status, reason };
  },

  // ========== OUTBREAK RISK SCORING ==========
  outbreakRiskCache: {},
  async getOutbreakRiskData() {
    const cacheKey = 'outbreak_risk_all';
    const now = Date.now();
    const cacheMs = 5 * 60 * 1000; // 5 minute cache

    if (this.outbreakRiskCache[cacheKey] && (now - this.outbreakRiskCache[cacheKey].timestamp) < cacheMs) {
      return this.outbreakRiskCache[cacheKey].data;
    }

    try {
      const response = await fetch(`${API_BASE}/api/risk/outbreak-risk-at-healthy-facilities`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const facilityMap = {};
      
      if (data.healthy_at_risk && Array.isArray(data.healthy_at_risk)) {
        data.healthy_at_risk.forEach(facility => {
          facilityMap[facility.facility_code] = facility;
          facilityMap[facility.facility_name.toLowerCase()] = facility;
        });
      }

      const result = {
        all: data.healthy_at_risk || [],
        summary: data.summary || {},
        facilityMap: facilityMap
      };

      this.outbreakRiskCache[cacheKey] = { data: result, timestamp: now };
      
      return result;
    } catch (error) {
      console.warn('⚠️ Failed to load outbreak risk data:', error);
      return { all: [], summary: {}, facilityMap: {} };
    }
  },

  async getRiskScoreForFacility(facilityName, facilityCode) {
    try {
      // Use new detailed endpoint if we have facility code (locality_no)
      if (facilityCode) {
        try {
          const response = await fetch(
            `${API_BASE}/api/facility/${facilityCode}/risk-score`,
            { method: 'GET', mode: 'cors' }
          );
          
          if (response.ok) {
            const detailedData = await response.json();
            
            return detailedData;
          }
        } catch (e) {
          console.warn(`Failed to get detailed risk score, falling back to summary:`, e);
        }
      }
      
      // Fallback: use summary data from outbreak-risk endpoint
      const riskData = await this.getOutbreakRiskData();
      
      if (facilityCode && riskData.facilityMap[facilityCode]) {
        return riskData.facilityMap[facilityCode];
      }
      
      const lowerName = facilityName.toLowerCase();
      if (riskData.facilityMap[lowerName]) {
        return riskData.facilityMap[lowerName];
      }
      
      const facility = riskData.all.find(f => 
        f.facility_name.toLowerCase().includes(lowerName) ||
        lowerName.includes(f.facility_name.toLowerCase())
      );
      
      return facility || null;
    } catch (error) {
      console.warn(`Failed to get risk score for ${facilityName}:`, error);
      return null;
    }
  },

  // Check quarantine status from backend (both auto-register and confirmed plans)
  async checkQuarantineStatus(mmsi) {

    if (!mmsi) return 'unregistered';

    // Defensive init for older sessions/state objects
    if (!this.quarantineAnalysisData || typeof this.quarantineAnalysisData !== 'object') {
      this.quarantineAnalysisData = {};
    }
    if (!Number.isFinite(this.lastQuarantineAnalysisFetch)) {
      this.lastQuarantineAnalysisFetch = 0;
    }

    // Check cache first (5 minute TTL)
    const cached = this.quarantineCache[mmsi];
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < 5 * 60 * 1000) { // 5 minutes
        return cached.status;
      }
    }

    // Check quarantine analysis data first (from at-risk-facilities endpoint)
    const analysis = this.quarantineAnalysisData[String(mmsi)];
    if (analysis) {
      const status = analysis.quarantine_status;
      
      if (status === 'QUARANTINE_BREACH') {
        this.quarantineCache[mmsi] = {
          status: 'breach',
          timestamp: Date.now(),
          hoursRemaining: 0,
          source: 'quarantine_breach'
        };
        return 'breach';
      } else if (status === 'QUARANTINE_ACTIVE') {
        const hoursRemaining = analysis.hours_until_clear || 0;
        this.quarantineCache[mmsi] = {
          status: 'quarantine',
          timestamp: Date.now(),
          hoursRemaining: hoursRemaining,
          source: 'quarantine_analysis'
        };
        return 'quarantine';
      } else if (status === 'QUARANTINE_CLEARED') {
        this.quarantineCache[mmsi] = {
          status: 'cleared',
          timestamp: Date.now(),
          hoursRemaining: 0,
          source: 'quarantine_analysis'
        };
        return 'cleared';
      }
    }

    try {
      // First check auto-register status (new system)
      try {
        const autoRegResponse = await fetch(
          `${API_BASE}/api/vessel/auto-register/status/${mmsi}`,
          { method: 'GET', mode: 'cors' }
        );

        if (autoRegResponse.ok) {
          const autoRegData = await autoRegResponse.json();
          // If vessel is in auto-registered quarantine, return that status
          if (autoRegData.in_quarantine) {
            const status = autoRegData.status || 'quarantine';
            const mappedStatus = status === 'cooldown' ? 'caution' : 'quarantine';
            
            this.quarantineCache[mmsi] = {
              status: mappedStatus,
              timestamp: Date.now(),
              hoursRemaining: autoRegData.hours_remaining || 0,
              source: 'auto_registered'
            };
            
            return mappedStatus;
          }
        }
      } catch (e) {
        // Auto-register endpoint might not be available, continue to legacy
      }

      // Fall back to legacy confirmed plans quarantine endpoint
      const response = await fetch(
        `${API_BASE}/api/vessel/quarantine-status/${mmsi}`,
        { method: 'GET', mode: 'cors' }
      );

      if (!response.ok) {
        // If endpoint not found or error, assume no quarantine
        return 'unregistered';
      }

      const data = await response.json();
      const status = data.risk_level || 'clear';

      // Map backend risk_level to status
      let mappedStatus = 'cleared';
      if (status === 'quarantine') {
        mappedStatus = 'quarantine';
      } else if (status === 'caution') {
        mappedStatus = 'caution';
      }

      // Cache the result
      this.quarantineCache[mmsi] = {
        status: mappedStatus,
        timestamp: Date.now(),
        hoursRemaining: data.hours_since_infected_visit || 0,
        source: 'confirmed_plans'
      };

      return mappedStatus;
    } catch (error) {
      // Silent fail - network error or parsing error
      return 'unregistered';
    }
  }
};

// Export for use in other modules
window.FacilityData = FacilityData;
