/**
 * vessel-storage.js
 * Handles localStorage for vessel data, visits, and quarantine
 * Supports multiple boats with separate data per vessel
 */

const STORAGE_KEY = 'labridae_vessel_data';
const SAVED_BOATS_KEY = 'labridae_saved_boats';
const CURRENT_BOAT_KEY = 'labridae_current_boat';

// Auto-detect API base URL: Render vs localhost
const API_BASE = window.location.hostname.includes('render.com') 
  ? 'https://kyst-api.render.com'
  : 'http://127.0.0.1:8000';

// Default vessel data structure
const defaultVesselData = {
  vessel: {
    mmsi: '257051270',
    name: 'LABRIDAE',
    callsign: 'LH2880',
    position: {
      lat: 63.4305,  // Trondheim area
      lon: 10.3951
    },
    positionSource: 'MANUELL', // LIVE | SISTE_KJENTE | MANUELL
    positionUpdatedAt: null,
    status: 'available' // available | quarantine | restricted
  },
  visits: [],
  quarantine: {
    active: false,
    startTime: null,
    endTime: null,
    reason: null,
    facilityId: null
  },
  routes: [],
  settings: {
    autoCheckProximity: true,
    proximityAlertDistance: 10, // km
    quarantineDuration: 48 // hours
  }
};

// Get current boat MMSI
function getCurrentBoatMMSI() {
  return localStorage.getItem(CURRENT_BOAT_KEY) || '257051270';
}

// Set current boat MMSI
function setCurrentBoatMMSI(mmsi) {
  localStorage.setItem(CURRENT_BOAT_KEY, mmsi);
}

// Get storage key for specific boat
function getBoatStorageKey(mmsi) {
  return `labridae_boat_${mmsi}`;
}

// Initialize or load vessel data for current boat
function getVesselData() {
  const mmsi = getCurrentBoatMMSI();
  const key = getBoatStorageKey(mmsi);
  const stored = localStorage.getItem(key);
  
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse vessel data:', e);
      return { ...defaultVesselData, vessel: { ...defaultVesselData.vessel, mmsi } };
    }
  }
  return { ...defaultVesselData, vessel: { ...defaultVesselData.vessel, mmsi } };
}

// Save vessel data for current boat
function saveVesselData(data) {
  const key = getBoatStorageKey(data.vessel.mmsi);
  localStorage.setItem(key, JSON.stringify(data));
  // Also ensure current boat is set to this MMSI
  setCurrentBoatMMSI(data.vessel.mmsi);
  
}

// Update vessel info (for any boat)
function updateVesselInfo(vesselInfo) {
  const data = getVesselData();
  const prevPos = data.vessel.position || {};
  const nextPos = vesselInfo.position || data.vessel.position;
  const positionChanged = !prevPos || prevPos.lat !== nextPos.lat || prevPos.lon !== nextPos.lon;
  const nextUpdatedAt = vesselInfo.positionUpdatedAt
    ? vesselInfo.positionUpdatedAt
    : ((positionChanged || !data.vessel.positionUpdatedAt) ? new Date().toISOString() : data.vessel.positionUpdatedAt);
  data.vessel = {
    ...data.vessel,
    mmsi: vesselInfo.mmsi,
    name: vesselInfo.name,
    callsign: vesselInfo.callsign,
    position: nextPos,
    positionSource: vesselInfo.positionSource || data.vessel.positionSource || 'MANUELL',
    positionUpdatedAt: nextUpdatedAt
  };
  saveVesselData(data);
}

// Update vessel position
function updateVesselPosition(lat, lon, source = 'MANUELL', updatedAt = null) {
  const data = getVesselData();
  data.vessel.position = { lat, lon };
  data.vessel.positionSource = source;
  data.vessel.positionUpdatedAt = updatedAt || new Date().toISOString();
  saveVesselData(data);
}

function getPositionMeta() {
  const data = getVesselData();
  return {
    source: data.vessel.positionSource || 'MANUELL',
    updatedAt: data.vessel.positionUpdatedAt || null
  };
}

// Update vessel status
function updateVesselStatus(status, description = '') {
  const data = getVesselData();
  data.vessel.status = status;
  data.vessel.statusDescription = description;
  saveVesselData(data);
}

// Add visit
function addVisit(
  facilityId,
  facilityName,
  infected,
  disinfection = false,
  disinfectionType = null,
  acknowledgedHealthPassWarning = false,
  diseaseTypes = [],
  riskMeta = {}
) {
  const data = getVesselData();
  const proximityRisk = riskMeta?.proximityRisk === true;
  const localZoneRisk = riskMeta?.localZoneRisk === true;
  const liceHigh = riskMeta?.liceHigh === true;
  const requiresBiosecurityAction = infected || proximityRisk || liceHigh;
  
  const visit = {
    id: Date.now(),
    facilityId,
    facilityName,
    timestamp: new Date().toISOString(),
    infected,
    proximityRisk,
    localZoneRisk,
    liceHigh,
    disinfection,
    disinfectionType,
    acknowledgedHealthPassWarning,
    diseaseTypes: Array.isArray(diseaseTypes) ? diseaseTypes : []
  };
  
  data.visits.unshift(visit); // Add to beginning
  
  // If visiting infected/BW-risk/high-lice facility without disinfection, start quarantine
  if (requiresBiosecurityAction && !disinfection) {
    const quarantineReason = infected
      ? 'ILA-eksponering'
      : (liceHigh ? 'Høye lusetall (biosecurity)' : 'Smitteeksponering i risikosone');
    startQuarantine(facilityId, facilityName, quarantineReason);
  }
  
  saveVesselData(data);
  return visit;
}

// Get all visits
function getVisits() {
  const data = getVesselData();
  return data.visits || [];
}

// Clear visit history
function clearVisitHistory() {
  const data = getVesselData();
  data.visits = [];
  saveVesselData(data);
}

// Start quarantine
function startQuarantine(facilityId, facilityName, reason = 'ILA-eksponering') {
  const data = getVesselData();
  const settings = data.settings;
  
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + (settings.quarantineDuration * 60 * 60 * 1000));
  
  data.quarantine = {
    active: true,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    reason,
    facilityId,
    facilityName
  };
  
  data.vessel.status = 'quarantine';
  data.vessel.statusDescription = `Karantene til ${endTime.toLocaleString('no-NO')}`;
  
  saveVesselData(data);
  
}

// End quarantine
function endQuarantine() {
  const data = getVesselData();
  data.quarantine.active = false;
  data.vessel.status = 'available';
  data.vessel.statusDescription = 'Klar til besøk';
  saveVesselData(data);
  
}

// Get quarantine status
function getQuarantineStatus() {
  const data = getVesselData();
  
  if (!data.quarantine.active) {
    return { active: false };
  }
  
  const now = new Date();
  const endTime = new Date(data.quarantine.endTime);
  
  // Check if quarantine should end
  if (now >= endTime) {
    endQuarantine();
    return { active: false };
  }
  
  const remainingMs = endTime - now;
  const totalMs = new Date(data.quarantine.endTime) - new Date(data.quarantine.startTime);
  const progress = ((totalMs - remainingMs) / totalMs) * 100;
  
  return {
    active: true,
    remainingMs,
    progress,
    reason: data.quarantine.reason,
    facilityName: data.quarantine.facilityName,
    endTime: data.quarantine.endTime
  };
}

// Format milliseconds to HH:MM:SS
function formatTimeRemaining(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Add route
function addRoute(name, facilities, totalDistance, estimatedTime, riskScore) {
  const data = getVesselData();
  
  const route = {
    id: Date.now(),
    name,
    facilities,
    totalDistance,
    estimatedTime,
    riskScore,
    createdAt: new Date().toISOString(),
    completed: false
  };
  
  data.routes.push(route);
  saveVesselData(data);
  return route;
}

// Get all routes
function getRoutes() {
  const data = getVesselData();
  return data.routes || [];
}

// Mark route as completed
function completeRoute(routeId) {
  const data = getVesselData();
  const route = data.routes.find(r => r.id === routeId);
  if (route) {
    route.completed = true;
    route.completedAt = new Date().toISOString();
    saveVesselData(data);
  }
}

// Calendar management
function getCalendar() {
  const calendar = localStorage.getItem('labridae_calendar');
  return calendar ? JSON.parse(calendar) : [];
}

function saveCalendar(calendar) {
  localStorage.setItem('labridae_calendar', JSON.stringify(calendar));
}

function addCalendarEntry(entry) {
  const calendar = getCalendar();
  calendar.push({
    ...entry,
    createdAt: new Date().toISOString()
  });
  saveCalendar(calendar);
  return calendar;
}

// Save boat to favorites list
function saveFavoriteBoat(vesselInfo) {
  let savedBoats = getSavedBoats();
  const exists = savedBoats.find(b => b.mmsi === vesselInfo.mmsi);
  
  if (!exists) {
    savedBoats.push({
      mmsi: vesselInfo.mmsi,
      name: vesselInfo.name,
      callsign: vesselInfo.callsign,
      addedAt: new Date().toISOString()
    });
    localStorage.setItem(SAVED_BOATS_KEY, JSON.stringify(savedBoats));
    
  }
  return savedBoats;
}

// Get all saved favorite boats
function getSavedBoats() {
  const stored = localStorage.getItem(SAVED_BOATS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse saved boats:', e);
      return [];
    }
  }
  // Initialize with LABRIDAE as default
  const defaults = [{
    mmsi: '257051270',
    name: 'LABRIDAE',
    callsign: 'LH2880',
    addedAt: new Date().toISOString()
  }];
  localStorage.setItem(SAVED_BOATS_KEY, JSON.stringify(defaults));
  return defaults;
}

// Remove boat from favorites
function removeFavoriteBoat(mmsi) {
  let savedBoats = getSavedBoats();
  savedBoats = savedBoats.filter(b => b.mmsi !== mmsi);
  localStorage.setItem(SAVED_BOATS_KEY, JSON.stringify(savedBoats));
  
  return savedBoats;
}

// Switch to different boat
function switchBoat(mmsi, vesselName = null, vesselCallsign = null) {
  if (!mmsi) return false;
  
  setCurrentBoatMMSI(mmsi);
  
  // If new vessel info provided, save it as favorite
  if (vesselName) {
    saveFavoriteBoat({
      mmsi,
      name: vesselName,
      callsign: vesselCallsign || 'UNKNOWN'
    });
  }
  
  
  return true;
}

// Reset all data (for testing)
function resetVesselData() {
  const mmsi = getCurrentBoatMMSI();
  const key = getBoatStorageKey(mmsi);
  localStorage.removeItem(key);
  
  return getVesselData();
}

// Update an event in calendar
function updateEvent(event) {
  const calendar = getCalendar();
  const index = calendar.findIndex(e => e.id === event.id);
  if (index !== -1) {
    calendar[index] = { ...calendar[index], ...event };
    saveCalendar(calendar);
    
  }
  return calendar;
}

// Delete an event from calendar
function deleteEvent(eventId) {
  const calendar = getCalendar();
  const filtered = calendar.filter(e => e.id !== eventId);
  saveCalendar(filtered);
  
  return filtered;
}

// Check if boat is cleared for facility visit on specific date
async function isBoatClearedForDate(mmsi, visitDate) {
  try {
    if (!mmsi || !visitDate) return false;
    
    // First check API for confirmed plans
    const response = await fetch(`${API_BASE}/api/boat/plan/confirmed?mmsi=${encodeURIComponent(mmsi)}`);
    if (response.ok) {
      const data = await response.json();
      const plans = data.plans || [];
      
      if (plans.length > 0) {
        const checkDate = new Date(visitDate);
        checkDate.setHours(0, 0, 0, 0);
        
        // Check if any valid plan covers this date
        const hasApiClearance = plans.some(plan => {
          if (!plan.route || !Array.isArray(plan.route)) return false;
          
          return plan.route.some(day => {
            if (!day.date) return false;
            const dayDate = new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);
            return dayDate.getTime() === checkDate.getTime();
          });
        });
        
        if (hasApiClearance) return true;
      }
    }
    
    // Fallback: check localStorage for completed disinfection events
    // A boat has health pass if disinfection was completed within last 5 days
    const rawCalendar = localStorage.getItem('calendarEvents');
    if (!rawCalendar) return false;
    
    let calendarEvents = [];
    try {
      calendarEvents = JSON.parse(rawCalendar) || [];
    } catch (err) {
      return false;
    }
    
    const checkDate = new Date(visitDate);
    checkDate.setHours(0, 0, 0, 0);
    
    // Find completed disinfection events before this visit date
    const hasCompletedDisinfection = calendarEvents.some(event => {
      if (event.type !== 'disinfection' || !event.completed) return false;
      if (!event.date) return false;
      
      const disinfectionDate = new Date(event.date);
      disinfectionDate.setHours(0, 0, 0, 0);
      
      // Disinfection must be before or on visit date, and within 5 days
      const daysDiff = (checkDate - disinfectionDate) / (1000 * 60 * 60 * 24);
      return daysDiff >= 0 && daysDiff <= 5;
    });
    
    return hasCompletedDisinfection;
  } catch (err) {
    console.warn('Error checking boat clearance:', err);
    return false;
  }
}

// Get boat's active/most recent confirmed plan
async function getBoatActivePlan(mmsi) {
  try {
    if (!mmsi) return null;
    
    const response = await fetch(`${API_BASE}/api/boat/plan/confirmed?mmsi=${encodeURIComponent(mmsi)}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const plans = data.plans || [];
    
    if (!plans.length) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find most recent valid plan (within 30 days)
    const validPlan = plans.find(plan => {
      if (!plan.route || !Array.isArray(plan.route) || plan.route.length === 0) return false;
      const lastDay = plan.route[plan.route.length - 1];
      if (!lastDay.date) return false;
      const routeDate = new Date(lastDay.date);
      routeDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((routeDate - today) / (1000 * 60 * 60 * 24));
      return daysDiff >= -30;
    });
    
    return validPlan || null;
  } catch (err) {
    console.warn('Error getting boat plan:', err);
    return null;
  }
}

// Export functions
window.VesselStorage = {
  getVesselData,
  saveVesselData,
  updateVesselInfo,
  updateVesselPosition,
  updateVesselStatus,
  addVisit,
  getVisits,
  clearVisitHistory,
  startQuarantine,
  endQuarantine,
  getQuarantineStatus,
  formatTimeRemaining,
  addRoute,
  getRoutes,
  completeRoute,
  getCalendar,
  saveCalendar,
  addCalendarEntry,
  updateEvent,
  deleteEvent,
  isBoatClearedForDate,
  getBoatActivePlan,
  resetVesselData,
  getPositionMeta,
  getCurrentBoatMMSI,
  setCurrentBoatMMSI,
  saveFavoriteBoat,
  getSavedBoats,
  removeFavoriteBoat,
  switchBoat,
  API_BASE
};
