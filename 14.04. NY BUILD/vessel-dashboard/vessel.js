/**
 * vessel.js
 * Main UI logic for vessel dashboard
 */

let quarantineInterval = null;

// Initialize dashboard
async function initDashboard() {
  
  
  // Check if vessel is loaded, if not show loading
  const saved = VesselStorage.getVesselData();
  
  
  if (!saved || !saved.vessel || !saved.vessel.mmsi) {
    
    return;
  }
  
  // Load vessel data
  const vesselData = VesselStorage.getVesselData();
  
  
  try {
    // Update status display
    
    updateStatusDisplay();
    updatePositionMeta();
    
  } catch (e) {
    console.warn('  ✗ Failed to update status display:', e.message);
  }
  
  try {
    // Initialize map
    
    await VesselMap.initMap();
    
  } catch (e) {
    console.warn('  ✗ Failed to initialize map:', e.message);
  }
  
  try {
    // Initialize route planner
    
    RoutePlanner.initRoutePlanner();
    
  } catch (e) {
    console.warn('  ✗ Failed to initialize route planner:', e.message);
  }
  
  try {
    // Load visit history
    
    loadVisitHistory();
    
  } catch (e) {
    console.warn('  ✗ Failed to load visit history:', e.message);
  }
  
  try {
    // Display calendar initially
    
    RoutePlanner.displayCalendar();
    
    updateCalendarQuickStats();
    
  } catch (e) {
    console.warn('  ✗ Failed to display calendar:', e.message);
  }
  
  try {
    // Check and update quarantine
    
    updateQuarantineDisplay();
    
    // Start quarantine countdown if active
    if (vesselData.quarantine && vesselData.quarantine.active) {
      
      startQuarantineCountdown();
    }
    
  } catch (e) {
    console.warn('  ✗ Failed to update quarantine:', e.message);
  }
  
  try {
    // Setup visit logger
    
    setupVisitLogger();
    
  } catch (e) {
    console.warn('  ✗ Failed to setup visit logger:', e.message);
  }
  
  try {
    // Load vessel contamination status (NEW!)
    
    await loadVesselContaminationStatus();
    
  } catch (e) {
    console.warn('  ✗ Failed to load contamination status:', e.message);
  }

  try {
    // Load confirmed plans and active routes summary
    
    await loadConfirmedPlansForVessel();
    
  } catch (e) {
    console.warn('  ✗ Failed to load confirmed plans:', e.message);
  }
  
  try {
    initLeftSectionMenu();

    // Setup event listeners
    
    const disinfection = document.getElementById('visitDisinfection');
    if (disinfection) {
      disinfection.addEventListener('change', (e) => {
        const typeDiv = document.getElementById('disinfectionTypeDiv');
        if (e.target.checked) {
          typeDiv.classList.remove('hidden');
        } else {
          typeDiv.classList.add('hidden');
        }
      });
    }
    
  } catch (e) {
    console.warn('  ✗ Failed to setup event listeners:', e.message);
  }
  
  
}

function initLeftSectionMenu() {
  const menu = document.getElementById('vesselLeftMenu');
  if (!menu) return;

  const buttons = Array.from(menu.querySelectorAll('[data-target-section]'));
  if (buttons.length === 0) return;

  const sectionMap = {
    planned: document.getElementById('plannedRoutesSection'),
    confirmed: document.getElementById('confirmedRoutesSection'),
    requests: document.getElementById('requestsSection')
  };

  const setActive = (target) => {
    buttons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.targetSection === target);
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.targetSection;
      const section = sectionMap[target];
      setActive(target);

      if (section) {
        section.classList.add('vessel-section-highlight');
        setTimeout(() => section.classList.remove('vessel-section-highlight'), 900);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  setActive('planned');
}

// Show vessel dashboard UI
function showVesselDashboard(vessel) {
  const vesselInputSection = document.getElementById('vesselInputSection');
  const mainDashboard = document.getElementById('mainDashboard');
  const boatSwitchSection = document.getElementById('boatSwitchSection');
  
  if (vesselInputSection) vesselInputSection.style.display = 'none';
  if (mainDashboard) mainDashboard.style.display = 'block';
  if (boatSwitchSection) boatSwitchSection.style.display = 'block';
  
  const vesselName = document.getElementById('vesselName');
  const vesselMMSI = document.getElementById('vesselMMSIDisplay');
  const vesselCallsign = document.getElementById('vesselCallsign');
  const vesselPosition = document.getElementById('vesselPosition');
  
  if (vesselName) vesselName.textContent = vessel.name;
  if (vesselMMSI) vesselMMSI.textContent = vessel.mmsi;
  if (vesselCallsign) vesselCallsign.textContent = vessel.callsign;
  if (vesselPosition) {
    const lat = Number(vessel.position?.lat);
    const lon = Number(vessel.position?.lon);
    vesselPosition.textContent = (Number.isFinite(lat) && Number.isFinite(lon))
      ? `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
      : '--';
  }
  updatePositionMeta();
  
  // Populate boat list
  populateBoatList();
}

// Load vessel by MMSI
async function loadVesselByMMSI() {
  const mmsiInput = document.getElementById('vesselMMSI');
  if (!mmsiInput) {
    console.error('Vessel MMSI input field not found');
    return;
  }
  
  const mmsi = mmsiInput.value.trim();
  if (!mmsi) {
    showToast('Vennligst skriv inn MMSI', 'warning');
    return;
  }
  
  showLoading('Forbereder dashboard...');
  
  const vesselInfo = {
    mmsi: mmsi,
    name: mmsi === '257051270' ? 'LABRIDAE' : `VESSEL-${mmsi}`,
    callsign: mmsi === '257051270' ? 'LH2880' : 'UNKNOWN',
    position: { lat: 63.4305, lon: 10.3951 },
    positionSource: 'MANUELL',
    positionUpdatedAt: new Date().toISOString()
  };
  
  // Save as favorite and switch to this boat
  VesselStorage.saveFavoriteBoat(vesselInfo);
  VesselStorage.switchBoat(mmsi, vesselInfo.name, vesselInfo.callsign);
  VesselStorage.updateVesselInfo(vesselInfo);
  showVesselDashboard(vesselInfo);
  
  try {
    await initDashboard();
    hideLoading();
  } catch (error) {
    hideLoading();
    console.error('Dashboard initialization failed:', error);
  }
}

// Show loading panel
function showLoading(message) {
  const vesselInputSection = document.getElementById('vesselInputSection');
  const mainDashboard = document.getElementById('mainDashboard');
  const loadingPanel = document.getElementById('loadingPanel');
  const loadingStatus = document.getElementById('loadingStatus');
  
  if (vesselInputSection) vesselInputSection.style.display = 'none';
  if (mainDashboard) mainDashboard.style.display = 'none';
  if (loadingPanel) loadingPanel.style.display = 'block';
  if (loadingStatus && message) loadingStatus.textContent = message;
}

// Hide loading panel
function hideLoading() {
  const loadingPanel = document.getElementById('loadingPanel');
  const mainDashboard = document.getElementById('mainDashboard');
  
  if (loadingPanel) loadingPanel.style.display = 'none';
  if (mainDashboard) mainDashboard.style.display = 'block';
}

// Clear vessel and reload
function clearVessel() {
  if (confirm('Vil du bytte båt? Historikk blir bevart.')) {
    location.reload();
  }
}

// Update status indicator
function updateStatusDisplay() {
  const vesselData = VesselStorage.getVesselData();
  if (!vesselData || !vesselData.vessel) return;
  
  const status = vesselData.vessel.status;
  
  const indicator = document.getElementById('statusIndicator');
  const legacyStatusText = document.getElementById('statusText');
  const statusDescription = document.getElementById('statusDescription');
  const compactStatusBadge = document.getElementById('compactStatusBadge');

  const statusConfig = {
    available: {
      icon: '✓',
      text: 'Klar til besøk',
      description: vesselData.vessel.statusDescription || 'Ingen aktive restriksjoner',
      compactLabel: 'KLARERT',
      compactBg: '#10b981'
    },
    quarantine: {
      icon: '⏱️',
      text: 'Karantene aktiv',
      description: vesselData.vessel.statusDescription || 'Karantene pågår',
      compactLabel: 'KARANTENE',
      compactBg: '#f59e0b'
    },
    restricted: {
      icon: '⚠️',
      text: 'Begrenset',
      description: vesselData.vessel.statusDescription || 'Nær smittet område',
      compactLabel: 'BEGRENSET',
      compactBg: '#ef4444'
    }
  };

  const config = statusConfig[status] || statusConfig.available;

  if (indicator) {
    indicator.classList.remove('available', 'quarantine', 'restricted');
    indicator.classList.add(status || 'available');
    indicator.textContent = config.icon;
  }

  if (legacyStatusText) {
    legacyStatusText.textContent = config.text;
  }

  if (statusDescription) {
    statusDescription.textContent = config.description;
  }

  if (compactStatusBadge) {
    compactStatusBadge.textContent = config.compactLabel;
    compactStatusBadge.style.background = config.compactBg;
    compactStatusBadge.title = config.description;
  }
}

// Load vessel contamination status from API
async function loadVesselContaminationStatus() {
  const vesselData = VesselStorage.getVesselData();
  if (!vesselData || !vesselData.vessel || !vesselData.vessel.mmsi) {
    
    return;
  }
  
  const mmsi = vesselData.vessel.mmsi;
  // Use VesselStorage.API_BASE which auto-detects Render vs localhost
  const container = document.getElementById('contaminationStatusPanel');
  
  if (!container) {
    
    return;
  }
  
  try {
    // Call new API endpoint
    const response = await fetch(`${VesselStorage.API_BASE}/api/vessels/${mmsi}/contamination-status`);
    
    if (!response.ok) {
      console.warn('Could not fetch contamination status:', response.status);
      container.innerHTML = '<p style="padding: 10px; color: #6b7280; font-size: 0.9em;">Kunne ikke hente kontaminasjonsstatus</p>';
      return;
    }
    
    const data = await response.json();
    
    // Update container with contamination status
    container.innerHTML = '';
    
    // Status badge
    const statusBadge = document.createElement('div');
    statusBadge.style.cssText = 'margin: 10px 0; padding: 10px; border-radius: 6px; font-weight: bold; text-align: center;';
    
    const status = data.contamination_status.status;
    const riskScore = data.contamination_status.risk_score;
    
    if (status === 'CONTAMINATED') {
      statusBadge.style.cssText += 'background: #fee2e2; color: #dc2626; border: 1px solid #dc2626;';
      statusBadge.innerHTML = `KONTAMINERT<br><span style="font-size: 0.9em; font-weight: normal;">Risiko: ${riskScore}</span>`;
    } else if (status === 'EXPOSED') {
      statusBadge.style.cssText += 'background: #ffedd5; color: #f97316; border: 1px solid #f97316;';
      statusBadge.innerHTML = `EKSPONERT<br><span style="font-size: 0.9em; font-weight: normal;">Risiko: ${riskScore}</span>`;
    } else {
      statusBadge.style.cssText += 'background: #dcfce7; color: #16a34a; border: 1px solid #16a34a;';
      statusBadge.innerHTML = `KLARERT<br><span style="font-size: 0.9em; font-weight: normal;">Risiko: ${riskScore}</span>`;
    }
    
    container.appendChild(statusBadge);
    
    // Recommendation
    const recommendation = document.createElement('div');
    recommendation.style.cssText = 'margin-top: 8px; padding: 8px; background: #f3f4f6; border-left: 3px solid #6b7280; border-radius: 4px; font-size: 0.85em;';
    recommendation.innerHTML = `<strong>Anbefaling:</strong> ${data.recommendation}`;
    container.appendChild(recommendation);
    
    // Recent diseased visits
    if (data.recent_diseased_visits && data.recent_diseased_visits.length > 0) {
      const visitsList = document.createElement('div');
      visitsList.style.cssText = 'margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px;';
      visitsList.innerHTML = `<strong style="font-size: 0.9em;">Nylige besøk på smittede anlegg:</strong>`;
      
      data.recent_diseased_visits.forEach(visit => {
        const visitEl = document.createElement('div');
        visitEl.style.cssText = 'font-size: 0.85em; color: #6b7280; margin-top: 4px; padding: 4px; background: #fff5f5; border-left: 2px solid #dc2626; padding-left: 8px;';
        visitEl.innerHTML = `${visit.facility_name} · ${visit.hours_ago}h siden`;
        visitsList.appendChild(visitEl);
      });
      
      container.appendChild(visitsList);
    }
    
    // Access permissions
    const permissions = document.createElement('div');
    permissions.style.cssText = 'margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px;';
    permissions.innerHTML = '<strong style="font-size: 0.9em;">Tillatelser:</strong>';
    
    const permissionsList = document.createElement('div');
    permissionsList.style.cssText = 'font-size: 0.85em; color: #6b7280; margin-top: 4px;';
    permissionsList.innerHTML = `
      Kan besøke røde anlegg: ${data.access_permissions.can_visit_red_facilities ? 'Ja' : 'Nei'}<br>
      Kan besøke oransje anlegg: ${data.access_permissions.can_visit_yellow_facilities ? 'Ja' : 'Nei'}<br>
      Kan besøke grønne anlegg: ${data.access_permissions.can_visit_green_facilities ? 'Ja' : 'Nei'}
    `;
    
    permissions.appendChild(permissionsList);
    container.appendChild(permissions);
    
    
    
  } catch (error) {
    console.error('Error loading contamination status:', error);
    container.innerHTML = '<p style="padding: 10px; color: #dc2626; font-size: 0.9em;">Feil ved lasting av kontaminasjonsstatus</p>';
  }
}

function getPositionSourceLabel(source) {
  switch ((source || '').toUpperCase()) {
    case 'LIVE':
      return 'LIVE';
    case 'SISTE_KJENTE':
      return 'SISTE KJENTE';
    case 'MANUELL':
    default:
      return 'MANUELL';
  }
}

function formatPositionTimestamp(ts) {
  if (!ts) return '--';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('no-NO');
}

function updatePositionMeta() {
  const statusEl = document.getElementById('vesselPositionStatus');
  const updatedEl = document.getElementById('vesselPositionUpdated');
  if (!statusEl || !updatedEl) return;

  const meta = VesselStorage.getPositionMeta();
  statusEl.textContent = getPositionSourceLabel(meta.source);
  updatedEl.textContent = `Oppdatert: ${formatPositionTimestamp(meta.updatedAt)}`;
}

function isLiceHighFacilityVisit(facility) {
  if (!facility || typeof facility !== 'object') return false;
  return facility.liceHigh === true
    || facility.lice_over_threshold === true
    || facility?.lice?.over_threshold === true;
}

// Setup visit logger with facility list
async function setupVisitLogger() {
  const facilities = VesselMap.getFacilitiesData();
  const select = document.getElementById('visitFacility');
  
  // Skip if element doesn't exist
  if (!select) {
    console.warn('⚠️ Visit facility select element not found');
    return;
  }
  
  // Sort facilities by name
  const sorted = facilities
    .filter(f => f.localityName || f.name)
    .sort((a, b) => {
      const nameA = (a.localityName || a.name).toLowerCase();
      const nameB = (b.localityName || b.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  
  // Populate select
  sorted.forEach(f => {
    const option = document.createElement('option');
    option.value = f.localityNo || f.id;
    option.textContent = f.localityName || f.name;
    option.dataset.infected = isInfectedFacility(f) ? 'true' : 'false';
    option.dataset.proximityRisk = f.proximityRisk === true ? 'true' : 'false';
    option.dataset.localZoneRisk = f.localZoneRisk === true ? 'true' : 'false';
    option.dataset.liceHigh = isLiceHighFacilityVisit(f) ? 'true' : 'false';
    const diseaseTypes = getFacilityDiseaseTypes(f);
    if (diseaseTypes.length) {
      option.dataset.diseases = JSON.stringify(diseaseTypes);
    }
    select.appendChild(option);
  });
  
  
}

// Check if facility is infected
function isInfectedFacility(facility) {
  const diseases = facility?.diseases || facility?.diseaseInfo?.diseases || [];
  return Array.isArray(diseases) && diseases.some(disease => {
    if (typeof disease === 'string') return disease.trim().length > 0;
    return typeof disease === 'object' && !!(disease?.name || disease?.disease || disease?.type || disease?.diseaseType);
  });
}

function getFacilityDiseaseTypes(facility) {
  const diseases = facility?.diseases || facility?.diseaseInfo?.diseases || [];
  return diseases
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      return entry?.disease || entry?.name || entry?.type || entry?.diseaseType || '';
    })
    .filter(Boolean);
}

// Show visit logger modal
function showVisitLogger() {
  const modal = document.getElementById('visitLoggerModal');
  modal.classList.remove('hidden');
  
  // Set current time
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16); // Format for datetime-local
  document.getElementById('visitTimestamp').value = timestamp;
}

// Close visit logger modal
function closeVisitLogger() {
  const modal = document.getElementById('visitLoggerModal');
  if (modal) modal.classList.add('hidden');
  
  // Reset form
  const select = document.getElementById('visitFacility');
  if (select) select.value = '';
  const disinfection = document.getElementById('visitDisinfection');
  if (disinfection) disinfection.checked = false;
  const typeDiv = document.getElementById('disinfectionTypeDiv');
  if (typeDiv) typeDiv.classList.add('hidden');
}

// Log visit
// Pending visit data (used when health pass warning is shown)
let pendingVisitData = null;

function logVisit() {
  const select = document.getElementById('visitFacility');
  if (!select) {
    showToast('Visit facility select element not found', 'error');
    return;
  }
  const facilityId = select.value;
  const facilityName = select.options[select.selectedIndex]?.text;
  const selectedOption = select.options[select.selectedIndex];
  const infected = selectedOption?.dataset.infected === 'true';
  const proximityRisk = selectedOption?.dataset.proximityRisk === 'true';
  const localZoneRisk = selectedOption?.dataset.localZoneRisk === 'true';
  const liceHigh = selectedOption?.dataset.liceHigh === 'true';
  const diseaseRaw = selectedOption?.dataset.diseases || '';
  let diseaseTypes = [];
  if (diseaseRaw) {
    try {
      diseaseTypes = JSON.parse(diseaseRaw);
    } catch (err) {
      diseaseTypes = diseaseRaw.split('|').map(d => d.trim()).filter(Boolean);
    }
  }
  const disinfection = document.getElementById('visitDisinfection').checked;
  const disinfectionType = disinfection ? document.getElementById('disinfectionType').value : null;
  
  if (!facilityId) {
    showToast('Velg et anlegg', 'warning');
    return;
  }
  
  // Check for active health pass before logging visit
  checkAndLogVisit(
    facilityId,
    facilityName,
    infected,
    disinfection,
    disinfectionType,
    diseaseTypes,
    {
      proximityRisk,
      localZoneRisk,
      liceHigh
    }
  );
}

// Check health pass status and show warning if needed
async function checkAndLogVisit(facilityId, facilityName, infected, disinfection, disinfectionType, diseaseTypes = [], riskMeta = {}) {
  const vesselData = VesselStorage.getVesselData();
  const mmsi = vesselData?.vessel?.mmsi;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if boat has active health pass
  const hasActiveHealthPass = await VesselStorage.isBoatClearedForDate(mmsi, today.toISOString().split('T')[0]);
  
  if (!hasActiveHealthPass) {
    // Show warning modal and store pending visit data
    pendingVisitData = { facilityId, facilityName, infected, disinfection, disinfectionType, diseaseTypes, riskMeta };
    showHealthPassWarning(facilityName);
    return;
  }
  
  // Health pass is active, proceed with visit
  proceedWithVisit(facilityId, facilityName, infected, disinfection, disinfectionType, false, diseaseTypes, riskMeta);
}

// Proceed with visit logging after health pass check
function proceedWithVisit(facilityId, facilityName, infected, disinfection, disinfectionType, acknowledgedWarning, diseaseTypes = [], riskMeta = {}) {
  const riskData = {
    proximityRisk: riskMeta?.proximityRisk === true,
    localZoneRisk: riskMeta?.localZoneRisk === true,
    liceHigh: riskMeta?.liceHigh === true
  };

  const requiresBiosecurityAction = infected || riskData.proximityRisk || riskData.liceHigh;

  // Add visit to storage
  const visit = VesselStorage.addVisit(
    facilityId,
    facilityName,
    infected,
    disinfection,
    disinfectionType,
    acknowledgedWarning,
    diseaseTypes,
    riskData
  );
  
  // Send audit log to API
  sendAuditLog(visit, acknowledgedWarning);
  
  // Show confirmation
  if (requiresBiosecurityAction && !disinfection) {
    showToast(`Besøk registrert: ${facilityName}. Karantene starter.`, 'warning');
  } else if (requiresBiosecurityAction && disinfection) {
    showToast(`Besøk registrert: ${facilityName}. Desinfeksjon utført.`, 'success');
  } else {
    showToast(`Besøk registrert: ${facilityName}`, 'success');
  }
  
  // Reload displays
  loadVisitHistory();
  updateStatusDisplay();
  updateQuarantineDisplay();
  autoUpdateCalendar();
  startQuarantineCountdown();
  
  // Close modal
  closeVisitLogger();
  closeHealthPassWarning();
  pendingVisitData = null;
}

// Show health pass warning modal
function showHealthPassWarning(facilityName) {
  const modal = document.getElementById('healthPassWarningModal');
  const facilitySpan = document.getElementById('healthPassWarningFacility');
  const checkbox = document.getElementById('healthPassAcknowledge');
  const continueBtn = document.getElementById('continueVisitBtn');
  
  facilitySpan.textContent = facilityName || '-';
  checkbox.checked = false;
  continueBtn.disabled = true;
  continueBtn.style.opacity = '0.5';
  continueBtn.style.cursor = 'not-allowed';
  
  // Toggle continue button based on checkbox
  checkbox.addEventListener('change', () => {
    continueBtn.disabled = !checkbox.checked;
    continueBtn.style.opacity = checkbox.checked ? '1' : '0.5';
    continueBtn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
  });
  
  modal.classList.add('show');
}

// Close health pass warning modal
function closeHealthPassWarning() {
  const modal = document.getElementById('healthPassWarningModal');
  modal.classList.remove('show');
  pendingVisitData = null;
}

// Continue with visit after acknowledging health pass warning
function continueVisitWithWarning() {
  if (!pendingVisitData) return;
  
  const { facilityId, facilityName, infected, disinfection, disinfectionType, diseaseTypes, riskMeta } = pendingVisitData;
  proceedWithVisit(facilityId, facilityName, infected, disinfection, disinfectionType, true, diseaseTypes, riskMeta);
}

// Send audit log entry to API
async function sendAuditLog(visit, acknowledgedWarning) {
  try {
    const vesselData = VesselStorage.getVesselData();
    const mmsi = vesselData?.vessel?.mmsi;
    const vesselName = vesselData?.vessel?.name;
    
    if (!mmsi) return; // Can't log without MMSI
    
    // Get health pass status for visit date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitDate = visit.visit_date || visit.date || today.toISOString().split('T')[0];
    const hadHealthPass = await VesselStorage.isBoatClearedForDate(mmsi, visitDate);
    
    // Always check calendar for disinfection events (not just if visit.disinfection is true)
    // because visits confirmed from calendar may have associated disinfection
    let responsibleParty = null;
    let disinfectionChemical = null;
    
    let calendarEvents = [];
    const rawCalendar = localStorage.getItem('calendarEvents');
    if (rawCalendar) {
      try {
        calendarEvents = JSON.parse(rawCalendar) || [];
      } catch (err) {
        calendarEvents = [];
      }
    }
    const fallbackCalendar = VesselStorage.getCalendar();
    const combined = Array.isArray(calendarEvents) && calendarEvents.length
      ? calendarEvents
      : (Array.isArray(fallbackCalendar) ? fallbackCalendar : []);

    const visitDateObj = new Date(visitDate);
    
    // Find completed disinfection events before this visit (within 5 days)
    const candidates = combined.filter(e => {
      if (e.type !== 'disinfection' || !e.date) return false;
      if (!e.completed || !e.responsible_party) return false;
      const eventDateObj = new Date(e.date);
      const diffDays = (visitDateObj - eventDateObj) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 5;
    });

    const disinfectionEvent = candidates.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })[0];

    responsibleParty = disinfectionEvent?.responsible_party || null;
    disinfectionChemical = disinfectionEvent?.chemical || null;
    
    

    const diseaseTypes = Array.isArray(visit.diseaseTypes)
      ? visit.diseaseTypes
      : Array.isArray(visit.diseases)
        ? visit.diseases
        : Array.isArray(visit.nearbyDiseases)
          ? visit.nearbyDiseases
          : [];
    
    
    
    // Log visits to infected, proximity risk, or local zone risk facilities
    const isInfectedOrRisk = visit.infected || visit.proximityRisk || visit.localZoneRisk || visit.liceHigh ||
      (Array.isArray(diseaseTypes) && diseaseTypes.length > 0);
    
    if (!isInfectedOrRisk) {
      
      return; // Don't send audit log for healthy facilities
    }
    
    
    
    const auditData = {
      mmsi,
      vessel_name: vesselName,
      facility_id: visit.facilityId,
      facility_name: visit.facilityName,
      visit_date: visitDate,
      had_health_pass: hadHealthPass,
      acknowledged_warning: acknowledgedWarning,
      disinfection: visit.disinfection,
      responsible_party: responsibleParty,
      disinfection_chemical: disinfectionChemical,
      disease_types: diseaseTypes,
      timestamp: visit.timestamp || new Date().toISOString()
    };
    
    // Send to audit endpoint
    const response = await fetch(`${VesselStorage.API_BASE}/api/audit/visit-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditData)
    });
    
    if (!response.ok) {
      console.warn('Failed to log audit entry on server:', response.status);
    } else {
      
    }
  } catch (err) {
    console.warn('Error sending audit log:', err);
  }
}

// Load visit history
function loadVisitHistory() {
  const visits = VesselStorage.getVisits();
  const container = document.getElementById('visitHistory');
  
  if (!container) return; // Exit if element doesn't exist
  
  if (visits.length === 0) {
    container.innerHTML = `
      <p style="color: #6b7280; text-align: center; padding: 2rem;">
        Ingen registrerte besøk ennå.
      </p>
    `;
    return;
  }
  
  container.innerHTML = visits.map(visit => {
    const date = new Date(visit.timestamp);
    const className = visit.infected ? 'visit-card infected' : 'visit-card';
    
    return `
      <div class="${className}">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <h4 style="margin: 0 0 0.5rem 0;">${visit.facilityName}</h4>
            <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">
              ${date.toLocaleString('no-NO')}
            </p>
          </div>
          <div style="text-align: right;">
            ${visit.infected ? '<span style="color: #ef4444; font-weight: bold;">⚠️ Smittet</span>' : '<span style="color: #10b981;">✓ Frisk</span>'}
            ${visit.disinfection ? '<br><span style="color: #3b82f6; font-size: 0.9rem;">🧼 Desinfisert</span>' : ''}
          </div>
        </div>
        ${visit.disinfectionType ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #6b7280;">Type: ${getDisinfectionTypeLabel(visit.disinfectionType)}</p>` : ''}
      </div>
    `;
  }).join('');
}

// Get disinfection type label
function getDisinfectionTypeLabel(type) {
  const labels = {
    'chemical': 'Kjemisk',
    'thermal': 'Termisk',
    'freshwater': 'Ferskvannsbehandling'
  };
  return labels[type] || type;
}

// Clear history
function clearHistory() {
  if (confirm('Er du sikker på at du vil tømme besøkshistorikken?')) {
    VesselStorage.clearVisitHistory();
    loadVisitHistory();
    showToast('Historikk tømt', 'success');
  }
}

// Update quarantine display
function updateQuarantineDisplay() {
  const status = VesselStorage.getQuarantineStatus();
  const panel = document.getElementById('quarantinePanel');
  
  // Skip if element doesn't exist
  if (!panel) {
    
    return;
  }
  
  if (status.active) {
    panel.classList.remove('hidden');
    const reasonEl = document.getElementById('quarantineReason');
    if (reasonEl) {
      reasonEl.textContent = `Grunn: ${status.reason}`;
    }
  } else {
    panel.classList.add('hidden');
    // Stop countdown if running
    if (quarantineInterval) {
      clearInterval(quarantineInterval);
      quarantineInterval = null;
    }
  }
}

// Start quarantine countdown
function startQuarantineCountdown() {
  // Clear existing interval
  if (quarantineInterval) {
    clearInterval(quarantineInterval);
  }
  
  // Update immediately
  updateQuarantineCountdown();
  
  // Update every second
  quarantineInterval = setInterval(() => {
    const status = VesselStorage.getQuarantineStatus();
    
    if (!status.active) {
      clearInterval(quarantineInterval);
      quarantineInterval = null;
      updateQuarantineDisplay();
      updateStatusDisplay();
      showToast('Karantene fullført. Klar til besøk.', 'success');
      return;
    }
    
    updateQuarantineCountdown();
  }, 1000);
}

// Update quarantine countdown display
function updateQuarantineCountdown() {
  const status = VesselStorage.getQuarantineStatus();
  
  if (!status.active) return;
  
  const countdown = document.getElementById('quarantineCountdown');
  const progress = document.getElementById('quarantineProgress');
  
  countdown.textContent = VesselStorage.formatTimeRemaining(status.remainingMs);
  progress.style.width = `${status.progress}%`;
}

// View quarantine
function viewQuarantine() {
  const status = VesselStorage.getQuarantineStatus();
  
  if (status.active) {
    // Scroll to quarantine panel
    document.getElementById('quarantinePanel').scrollIntoView({ behavior: 'smooth' });
  } else {
    showToast('Ingen aktiv karantene', 'info');
  }
}

// Show route planner
function showRoutePlanner() {
  document.getElementById('routePlannerModal').classList.remove('hidden');
}

// Open calendar modal
function openCalendarModal() {
  const calendarModal = document.getElementById('calendarModal');
  if (calendarModal) {
    calendarModal.style.display = 'flex';
    // Initialize calendar when modal opens
    if (typeof CalendarView !== 'undefined') {
      setTimeout(() => {
        try {
          if (CalendarView.init) {
            CalendarView.init();
          } else if (CalendarView.displayCalendar) {
            CalendarView.displayCalendar();
          }
        } catch (err) {
          console.error('Calendar initialization error:', err);
        }
      }, 100);
    }
    showToast('Kalender åpnet', 'info');
  }
}

// Close calendar modal
function closeCalendarView() {
  const calendarModal = document.getElementById('calendarModal');
  if (calendarModal) {
    calendarModal.style.display = 'none';
  }
}

// Show calendar view
function showCalendarView() {
  openCalendarModal();
}

// Update calendar quick stats
function updateCalendarQuickStats() {
  const entries = RoutePlanner.getCalendarEntries();
  const container = document.getElementById('calendarQuickStats');
  if (!container) return;
  
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.date === today);
  const upcomingEntries = entries.filter(e => e.date > today);
  const pastEntries = entries.filter(e => e.date < today);
  
  const stats = [
    { label: 'I dag', count: todayEntries.length, color: '#3b82f6' },
    { label: 'Kommende', count: upcomingEntries.length, color: '#f59e0b' },
    { label: 'Historikk', count: pastEntries.length, color: '#6b7280' }
  ];
  
  container.innerHTML = stats.map(stat => `
    <div style="background: ${stat.color}; color: white; padding: 0.75rem; border-radius: 4px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: bold;">${stat.count}</div>
      <div style="font-size: 0.85rem;">${stat.label}</div>
    </div>
  `).join('');
}

// Auto-update calendar when visits/quarantine changes
function autoUpdateCalendar() {
  RoutePlanner.displayCalendar();
  updateCalendarQuickStats();
}

async function loadConfirmedPlansForVessel() {
  const list = document.getElementById('confirmedPlansList');
  const meta = document.getElementById('confirmedPlansMeta');
  if (!list || !meta) return;

  const vesselData = VesselStorage.getVesselData();
  const mmsi = vesselData?.vessel?.mmsi;
  if (!mmsi) {
    meta.textContent = 'MMSI mangler.';
    list.innerHTML = '';
    return;
  }

  meta.textContent = 'Laster bekreftede ruter...';
  list.innerHTML = '';

  try {
    const response = await fetch(`${VesselStorage.API_BASE}/api/boat/plan/confirmed?mmsi=${encodeURIComponent(mmsi)}`);
    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }
    const data = await response.json();
    const plans = data.plans || [];
    meta.textContent = `Totalt: ${data.count ?? plans.length} bekreftede ruter`;

    if (!plans.length) {
      list.innerHTML = '<div style="color: #6b7280; font-size: 0.85rem;">Ingen bekreftede ruter enda.</div>';
      updateActiveRoutesPanel([]);
      return;
    }

    updateActiveRoutesPanel(plans);

    list.innerHTML = plans
      .slice(0, 5)
      .map((plan) => {
        const routeDays = Array.isArray(plan.route) ? plan.route.length : 0;
        const facilityCount = Array.isArray(plan.route)
          ? plan.route.reduce((sum, day) => sum + (day.facilities?.length || 0), 0)
          : 0;
        const confirmedAt = plan.confirmed_at
          ? new Date(plan.confirmed_at).toLocaleString('no-NO')
          : '--';
        return `
          <div style="padding: 0.5rem 0; border-top: 1px solid #e5e7eb;">
            <div style="font-weight: 600; font-size: 0.9rem;">Plan ${plan.plan_id || '--'}</div>
            <div style="font-size: 0.8rem; color: #6b7280;">${routeDays} dager · ${facilityCount} anlegg</div>
            <div style="font-size: 0.8rem; color: #6b7280;">Bekreftet: ${confirmedAt}</div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load confirmed plans:', err);
    meta.textContent = 'Kunne ikke hente bekreftede ruter.';
    list.innerHTML = '';
    updateActiveRoutesPanel([]);
  }
}

function updateActiveRoutesPanel(plans) {
  const container = document.getElementById('activeRoutesList');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activePlans = (plans || []).filter(plan => {
    const route = Array.isArray(plan.route) ? plan.route : [];
    if (!route.length) return false;
    const lastDate = route[route.length - 1]?.date;
    if (!lastDate) return false;
    const lastDay = new Date(lastDate);
    lastDay.setHours(0, 0, 0, 0);
    return lastDay >= today;
  });

  if (!activePlans.length) {
    container.innerHTML = '<p style="color: #6b7280; font-size: 0.85rem; text-align: center;">Ingen aktive ruter enda.</p>';
    return;
  }

  container.innerHTML = activePlans
    .slice(0, 3)
    .map(plan => {
      const route = Array.isArray(plan.route) ? plan.route : [];
      const dates = route.map(day => day?.date).filter(Boolean);
      const firstDate = dates[0] ? new Date(dates[0]).toLocaleDateString('no-NO') : '--';
      const lastDate = dates[dates.length - 1] ? new Date(dates[dates.length - 1]).toLocaleDateString('no-NO') : '--';
      const facilityCount = route.reduce((sum, day) => sum + (day.facilities?.length || 0), 0);
      return `
        <div class="active-route-item">
          <div class="route-title">Plan ${plan.plan_id || '--'}</div>
          <div class="route-meta">${firstDate} - ${lastDate} · ${facilityCount} anlegg</div>
        </div>
      `;
    })
    .join('');
}

// Load boat health pass status based on confirmed plans
async function loadBoatHealthPass() {
  const iconDiv = document.getElementById('healthPassStatusIcon');
  const textDiv = document.getElementById('healthPassStatusText');
  const infoDiv = document.getElementById('healthPassQuarantineInfo');
  
  if (!iconDiv || !textDiv) return;
  
  const vesselData = VesselStorage.getVesselData();
  const mmsi = vesselData?.vessel?.mmsi;
  
  if (!mmsi) {
    iconDiv.textContent = '❓';
    textDiv.textContent = 'MMSI mangler';
    if (infoDiv) infoDiv.textContent = '';
    return;
  }

  iconDiv.textContent = '⏳';
  textDiv.textContent = 'Sjekker status...';
  if (infoDiv) infoDiv.textContent = '';

  try {
    const response = await fetch(`${VesselStorage.API_BASE}/api/boat/plan/confirmed?mmsi=${encodeURIComponent(mmsi)}`);
    if (!response.ok) throw new Error(`Server error ${response.status}`);
    
    const data = await response.json();
    const plans = data.plans || [];
    
    if (!plans.length) {
      // No confirmed plans
      iconDiv.textContent = '🔴';
      textDiv.textContent = 'Ingen aktiv helseattest';
      if (infoDiv) infoDiv.textContent = 'Bekreft rute først';
      return;
    }

    // Find most recent valid plan
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const validPlans = plans.filter(plan => {
      if (!plan.route || !Array.isArray(plan.route) || plan.route.length === 0) return false;
      const lastDay = plan.route[plan.route.length - 1];
      if (!lastDay.date) return false;
      const routeDate = new Date(lastDay.date);
      routeDate.setHours(0, 0, 0, 0);
      // Valid if rute ended within last 30 days or in future
      const daysDiff = Math.floor((routeDate - today) / (1000 * 60 * 60 * 24));
      return daysDiff >= -30;
    });

    if (!validPlans.length) {
      iconDiv.textContent = '⏳';
      textDiv.textContent = 'Helseattest utløpt';
      const newestPlan = plans[0];
      if (newestPlan?.route?.[newestPlan.route.length - 1]?.date && infoDiv) {
        const expiredDate = new Date(newestPlan.route[newestPlan.route.length - 1].date);
        infoDiv.textContent = `Utløpt: ${expiredDate.toLocaleDateString('no-NO')}`;
      }
      return;
    }

    // Found valid plans
    const latestPlan = validPlans[0];
    iconDiv.textContent = '✅';
    
    const lastRoute = latestPlan.route[latestPlan.route.length - 1];
    const validUntil = new Date(lastRoute.date);
    const daysUntilExpire = Math.floor((validUntil - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpire < 0) {
      textDiv.textContent = `Utløper om ${Math.abs(daysUntilExpire)} dag${Math.abs(daysUntilExpire) !== 1 ? 'er' : ''}`;
    } else if (daysUntilExpire === 0) {
      textDiv.textContent = 'Utløper i dag';
    } else {
      textDiv.textContent = `Gyldig i ${daysUntilExpire} dag${daysUntilExpire !== 1 ? 'er' : ''}`;
    }
    
    if (infoDiv) {
      const facilityCount = latestPlan.route.reduce((sum, day) => sum + (day.facilities?.length || 0), 0);
      infoDiv.textContent = `${latestPlan.route.length} dager · ${facilityCount} anlegg`;
    }
  } catch (err) {
    console.error('Failed to load health pass:', err);
    iconDiv.textContent = '❌';
    textDiv.textContent = 'Feil ved henting';
    if (infoDiv) infoDiv.textContent = '';
  }
}

// Show toast notification
function showToast(message, type = 'info', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// Filter map (placeholder for future use)
function filterMap() {
  // TODO: Implement map filtering if needed
  
}

// Filter facility markers based on checkboxes
function filterFacilityMarkers() {
  const showHealthy = document.getElementById('showHealthy')?.checked ?? true;
  const showRiskZone = document.getElementById('showRiskZone')?.checked ?? true;
  const showLocalZone = document.getElementById('showLocalZone')?.checked ?? false;
  const showInfected = document.getElementById('showInfected')?.checked ?? true;
  
  
  
  // Save filter state to localStorage
  try {
    localStorage.setItem('mapFilters', JSON.stringify({
      showHealthy,
      showRiskZone,
      showLocalZone,
      showInfected
    }));
  } catch (e) {
    console.warn('Could not save filter state:', e);
  }
  
  // Access the facility markers from VesselMap (if exported)
  if (typeof VesselMap !== 'undefined' && VesselMap.filterMarkersByStatus) {
    VesselMap.filterMarkersByStatus(showHealthy, showRiskZone, showLocalZone, showInfected);
    
  } else {
    console.warn('⚠️ VesselMap.filterMarkersByStatus not available');
  }
}

// Multi-boat management functions

// Populate boat list in dropdown
function populateBoatList() {
  const select = document.getElementById('boatQuickSwitch');
  if (!select) return;
  
  const savedBoats = VesselStorage.getSavedBoats();
  const currentBoatMMSI = VesselStorage.getCurrentBoatMMSI();
  
  // Clear existing options except first
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Add saved boats
  savedBoats.forEach(boat => {
    const option = document.createElement('option');
    option.value = boat.mmsi;
    option.textContent = `🚢 ${boat.name} (${boat.callsign})`;
    if (boat.mmsi === currentBoatMMSI) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// Switch boat from dropdown
function switchBoatFromDropdown() {
  const select = document.getElementById('boatQuickSwitch');
  const mmsi = select.value;
  
  if (!mmsi) return;
  
  const savedBoats = VesselStorage.getSavedBoats();
  const boat = savedBoats.find(b => b.mmsi === mmsi);
  
  if (boat) {
    VesselStorage.switchBoat(mmsi, boat.name, boat.callsign);
    location.reload(); // Reload to show new boat data
  }
}

// Show dialog to add new boat
function showAddBoatDialog() {
  const mmsi = prompt('Skriv inn MMSI for båten:');
  if (!mmsi || mmsi.trim() === '') return;
  
  const name = prompt('Båtnavn (f.eks MYOXOCEPHALUS):');
  if (!name || name.trim() === '') return;
  
  const callsign = prompt('Callsign (f.eks MX2890):');
  if (!callsign || callsign.trim() === '') return;
  
  // Add boat to saved list
  VesselStorage.saveFavoriteBoat({
    mmsi: mmsi.trim(),
    name: name.trim(),
    callsign: callsign.trim()
  });
  
  // Switch to this boat
  VesselStorage.switchBoat(mmsi.trim(), name.trim(), callsign.trim());
  
  showToast(`Båt "${name}" lagt til og aktivert`, 'success');
  populateBoatList();
  
  // Reload after short delay
  setTimeout(() => location.reload(), 1000);
}

// ============================================================================
// ROLE SYSTEM INTEGRATION - Role-based UI functions
// ============================================================================

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (!menu) return;
  const isVisible = menu.style.display !== 'none';
  menu.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    document.addEventListener('click', handleUserMenuClick);
  } else {
    document.removeEventListener('click', handleUserMenuClick);
  }
}

function handleUserMenuClick(event) {
  const userPanel = document.querySelector('.user-panel');
  if (!userPanel || !userPanel.contains(event.target)) {
    const menu = document.getElementById('userMenu');
    if (menu) menu.style.display = 'none';
    document.removeEventListener('click', handleUserMenuClick);
  }
}

function switchUserRole(role) {
  if (!window.RoleSystem) {
    console.error('RoleSystem not loaded');
    return;
  }
  
  RoleSystem.setUserRole(role);
  updateUserDisplay();
  const menu = document.getElementById('userMenu');
  if (menu) menu.style.display = 'none';
  if (typeof filterDataByRole === 'function') {
    filterDataByRole();
  }
  const user = RoleSystem.getCurrentUser();
  
}

function showRoleInfo() {
  if (!window.RoleSystem) {
    console.error('RoleSystem not loaded');
    return;
  }
  const user = RoleSystem.getCurrentUser();
  const roleInfo = RoleSystem.getRoleInfo(user.role);
  if (!roleInfo) {
    alert('Role information not available');
    return;
  }
  const permissions = Object.entries(roleInfo.permissions)
    .filter(([key, value]) => value === true)
    .map(([key]) => `• ${key.replace(/_/g, ' ').toUpperCase()}`)
    .join('\n');
  const infoText = `
ROLLE: ${roleInfo.name}
═══════════════════════════════════════

TILLATELSER:
${permissions || '(Ingen tillatelser tildelt)'}

BESKRIVELSE:
${roleInfo.description || 'Ingen beskrivelse tilgjengelig'}

Nåværende tildelinger:
• Anlegg: ${user.assigned_facilities?.length || 0}
• Båter: ${user.assigned_vessels?.length || 0}
  `.trim();
  alert(infoText);
}

function updateUserDisplay() {
  if (!window.RoleSystem) {
    console.error('RoleSystem not loaded');
    return;
  }
  try {
    const user = RoleSystem.getCurrentUser();
    const roleBadge = document.getElementById('userRoleBadge');
    const userName = document.getElementById('userName');
    if (roleBadge) {
      roleBadge.textContent = user.role || 'USER';
      const roleColors = {
        'ADMIN': { bg: '#dc2626', text: 'white' },
        'OPERATOR': { bg: '#0284c7', text: 'white' },
        'VIEWER': { bg: '#059669', text: 'white' }
      };
      const roleStyle = roleColors[user.role] || { bg: '#6b7280', text: 'white' };
      roleBadge.style.background = roleStyle.bg;
      roleBadge.style.color = roleStyle.text;
    }
    if (userName) {
      userName.textContent = user.name || 'User';
      userName.title = `${user.email} (${user.role})`;
    }
    
  } catch (error) {
    console.error('Error updating user display:', error);
  }
}

function initializeRoleSystem() {
  if (!window.RoleSystem) {
    console.warn('[ROLE] RoleSystem not yet loaded, retrying...');
    setTimeout(initializeRoleSystem, 500);
    return;
  }
  
  Promise.resolve(window.RoleSystem.init?.()).then(() => {
    updateUserDisplay();
    
  }).catch((error) => {
    console.error('Error initializing role system:', error);
    updateUserDisplay();
  });
}

function filterDataByRole() {
  if (!window.RoleSystem) {
    console.warn('RoleSystem not available for filtering');
    return;
  }
  const user = RoleSystem.getCurrentUser();
  
  if (user.role !== 'ADMIN') {
    
  }
}

function setupRoleChangeListeners() {
  document.addEventListener('userRoleChanged', (event) => {
    
    filterDataByRole();
  });
  document.addEventListener('userAssignmentsChanged', (event) => {
    
    filterDataByRole();
  });
  
}

// ============================================================================
// END ROLE SYSTEM INTEGRATION
// ============================================================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
  setupRoleChangeListeners();  // Initialize role change listeners
  initializeRoleSystem();        // Initialize role system and display

  
  try {
    const currentBoat = VesselStorage.getCurrentBoatMMSI();
    
    
    const savedBoats = VesselStorage.getSavedBoats();
    
    
    // Check if current boat exists in saved boats
    const boatExists = savedBoats.find(b => b.mmsi === currentBoat);
    
    
    // If no current boat or boat not in saved list, auto-load LABRIDAE
    let boatToShow = boatExists ? savedBoats.find(b => b.mmsi === currentBoat) : null;
    if (!boatToShow) {
      
      boatToShow = savedBoats.find(b => b.mmsi === '257051270') || savedBoats[0];
      if (boatToShow) {
        
        VesselStorage.switchBoat(boatToShow.mmsi, boatToShow.name, boatToShow.callsign);
      }
    }
    
    // Show the vessel UI and initialize vessel data
    if (boatToShow) {
      
      const existing = VesselStorage.getVesselData();
      const useExisting = existing?.vessel?.mmsi === boatToShow.mmsi;
      const vesselInfo = {
        mmsi: boatToShow.mmsi,
        name: boatToShow.name,
        callsign: boatToShow.callsign,
        position: useExisting ? existing.vessel.position : { lat: 63.4305, lon: 10.3951 },
        positionSource: useExisting ? existing.vessel.positionSource : 'SISTE_KJENTE',
        positionUpdatedAt: useExisting ? existing.vessel.positionUpdatedAt : null
      };
      
      // Save vessel info to storage BEFORE showing UI
      
      VesselStorage.updateVesselInfo(vesselInfo);
      
      
      
      showVesselDashboard(vesselInfo);
      
    } else {
      console.error('❌ No boat found to display!');
      return;
    }
    
    // Small delay to ensure DOM is fully ready for map
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize dashboard with auto-loaded boat
    
    try {
      await initDashboard();
      
      loadConfirmedPlansForVessel();
      loadBoatHealthPass();
      
      // Register panels for auto-load
      if (typeof AutoLoadManager !== 'undefined') {
        AutoLoadManager.registerPanel('vessel-dashboard', async () => {
          await loadVesselByMMSI();
          await loadVesselContaminationStatus();
          loadVisitHistory();
        });
        
      }
      
      
      
      
    } catch (error) {
      console.error('❌ Error in initDashboard:', error);
      console.error('Error stack:', error.stack);
    }
    
    // Setup facility filter listeners
    
    const showHealthy = document.getElementById('showHealthy');
    const showRiskZone = document.getElementById('showRiskZone');
    const showLocalZone = document.getElementById('showLocalZone');
    const showInfected = document.getElementById('showInfected');
    
    // Restore filter state from localStorage
    try {
      const savedFilters = localStorage.getItem('mapFilters');
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        if (showHealthy) showHealthy.checked = filters.showHealthy ?? true;
        if (showRiskZone) showRiskZone.checked = filters.showRiskZone ?? true;
          if (showLocalZone) showLocalZone.checked = filters.showLocalZone === true; // OFF by default (only true if explicitly saved)
        if (showInfected) showInfected.checked = filters.showInfected ?? true;
        
        } else {
          // Set defaults if no saved state
          if (showHealthy) showHealthy.checked = true;
          if (showRiskZone) showRiskZone.checked = true;
          if (showLocalZone) showLocalZone.checked = false; // OFF by default (ekstra sikkerhet)
          if (showInfected) showInfected.checked = true;
      }
    } catch (e) {
      console.warn('Could not restore filter state:', e);
        // Set safe defaults on error
        if (showLocalZone) showLocalZone.checked = false;
    }
    
    if (showHealthy) showHealthy.addEventListener('change', filterFacilityMarkers);
    if (showRiskZone) showRiskZone.addEventListener('change', filterFacilityMarkers);
    if (showLocalZone) showLocalZone.addEventListener('change', filterFacilityMarkers);
    if (showInfected) showInfected.addEventListener('change', filterFacilityMarkers);
    

    setupPanelCollapsibles();
    
  } catch (error) {
    console.error('❌ Fatal error in DOMContentLoaded:', error);
    console.error('Error stack:', error.stack);
  }
});

function setupPanelCollapsibles() {
  const panels = [
    { id: 'healthPassPanel', collapsed: true },
    { id: 'actionsPanel', collapsed: true },
    { id: 'historyPanel', collapsed: true }
  ];

  panels.forEach(({ id, collapsed }) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    makePanelCollapsible(panel, collapsed);
  });
}

function makePanelCollapsible(panel, collapsedByDefault) {
  if (!panel || panel.classList.contains('collapsible-panel')) return;

  const header = panel.querySelector('.panel-header');
  if (!header) return;

  panel.classList.add('collapsible-panel');

  const body = document.createElement('div');
  body.className = 'panel-body';

  while (header.nextSibling) {
    body.appendChild(header.nextSibling);
  }
  panel.appendChild(body);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'panel-toggle';
  toggle.textContent = collapsedByDefault ? 'Vis' : 'Skjul';
  toggle.setAttribute('aria-expanded', (!collapsedByDefault).toString());

  header.appendChild(toggle);

  if (collapsedByDefault) {
    panel.classList.add('is-collapsed');
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isCollapsed = panel.classList.toggle('is-collapsed');
    toggle.textContent = isCollapsed ? 'Vis' : 'Skjul';
    toggle.setAttribute('aria-expanded', (!isCollapsed).toString());
  });
}

// Export for global access
window.initDashboard = initDashboard;
window.showVesselDashboard = showVesselDashboard;
window.loadVesselByMMSI = loadVesselByMMSI;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.clearVessel = clearVessel;
window.updateStatusDisplay = updateStatusDisplay;
window.updatePositionMeta = updatePositionMeta;
window.setupVisitLogger = setupVisitLogger;
window.showVisitLogger = showVisitLogger;
window.closeVisitLogger = closeVisitLogger;
window.logVisit = logVisit;
window.loadVisitHistory = loadVisitHistory;
window.clearHistory = clearHistory;
window.updateQuarantineDisplay = updateQuarantineDisplay;
window.startQuarantineCountdown = startQuarantineCountdown;
window.updateQuarantineCountdown = updateQuarantineCountdown;
window.viewQuarantine = viewQuarantine;
window.showRoutePlanner = showRoutePlanner;
window.showCalendarView = showCalendarView;
window.openCalendarModal = openCalendarModal;
window.closeCalendarView = closeCalendarView;
window.updateCalendarQuickStats = updateCalendarQuickStats;
window.autoUpdateCalendar = autoUpdateCalendar;
window.loadConfirmedPlansForVessel = loadConfirmedPlansForVessel;
window.loadBoatHealthPass = loadBoatHealthPass;
window.showHealthPassWarning = showHealthPassWarning;
window.closeHealthPassWarning = closeHealthPassWarning;
window.continueVisitWithWarning = continueVisitWithWarning;
window.sendAuditLog = sendAuditLog;
window.showToast = showToast;
window.filterMap = filterMap;
window.filterFacilityMarkers = filterFacilityMarkers;
window.populateBoatList = populateBoatList;
window.switchBoatFromDropdown = switchBoatFromDropdown;
window.showAddBoatDialog = showAddBoatDialog;
// ========== DEBUG TOOLS ==========
// Diagnostic functions for troubleshooting data flow
window.debugVesselSystem = {
  step1_checkFacilitiesLoaded: () => {
    
    if (typeof VesselMap === 'undefined') {
      console.error('❌ VesselMap not available');
      return null;
    }
    const facilities = VesselMap.getFacilitiesData();
    
    if (facilities && facilities.length > 0) {
      const infected = facilities.filter(f => f.diseases && f.diseases.length > 0);
      
      
      facilities.slice(0, 3).forEach(f => {
        
        
        
      });
      
      if (infected.length > 0) {
        
        
      }
    }
    return facilities;
  },
  
  step2_checkSearchDOM: () => {
    
    const topSearch = document.getElementById('facilitySearchBoxTop');
    const internalSearch = document.getElementById('facilitySearchInput');
    const checkboxes = document.querySelectorAll('.facility-checkbox-item');
    
    
    
    
    
    if (checkboxes.length > 0) {
      
      Array.from(checkboxes).slice(0, 3).forEach((item, idx) => {
        
        
        
        
        
      });
    } else {
      console.warn('⚠️ No checkboxes found - setupFacilitySelector may not have run');
    }
    
    return {
      topSearch: !!topSearch,
      internalSearch: !!internalSearch,
      checkboxCount: checkboxes.length
    };
  },
  
  step3_testSearch: (term) => {
    
    const checkboxes = document.querySelectorAll('.facility-checkbox-item');
    
    
    let matches = 0;
    const matchedNames = [];
    
    checkboxes.forEach(item => {
      const name = item.dataset.name || '';
      const searchName = item.dataset.searchName || '';
      const termLower = term.toLowerCase();
      
      const matchName = name.includes(termLower);
      const matchSearch = searchName.includes(termLower);
      
      if (matchName || matchSearch) {
        matches++;
        matchedNames.push(item.dataset.fullName || name);
      }
    });
    
    
    if (matches > 0) {
      
    } else {
      console.warn('⚠️ No matches found');
      
    }
    
    return {matches, matchedNames};
  },
  
  step4_checkCalendarEvents: () => {
    
    const raw = localStorage.getItem('calendarEvents');
    if (!raw) {
      
      return null;
    }
    
    const events = JSON.parse(raw);
    
    
    const visits = events.filter(e => e.type === 'visit');
    const disinfections = events.filter(e => e.type === 'disinfection');
    const completedDisinfections = disinfections.filter(e => e.completed === true);
    
    
    
    
    
    if (visits.length > 0) {
      
      const v = visits[0];
      
    }
    
    if (completedDisinfections.length > 0) {
      
      const d = completedDisinfections[0];
      
    } else if (disinfections.length > 0) {
      console.warn('⚠️ Found disinfection events but none are marked completed');
      
    }
    
    return {visits, disinfections, completedDisinfections};
  },
  
  step5_traceDataFlow: (facilityName) => {
    
    
    // Check in facilities list
    const facilities = VesselMap?.getFacilitiesData() || [];
    const facility = facilities.find(f => 
      f.name.toLowerCase().includes(facilityName.toLowerCase())
    );
    
    
    
    // Check in calendar
    const raw = localStorage.getItem('calendarEvents');
    if (!raw) {
      
      return {facility, visitEvent: null};
    }
    
    const events = JSON.parse(raw);
    const visitEvent = events.find(e => 
      e.type === 'visit' && 
      e.details && 
      e.details.toLowerCase().includes(facilityName.toLowerCase())
    );
    
    
    
    if (visitEvent && visitEvent.completed && !visitEvent.audit_logged) {
      console.warn('⚠️ Visit is completed but not audit logged yet');
    }
    
    return {facility, visitEvent};
  },
  
  step6_testDisinfectionMatching: (visitDate) => {
    
    
    const raw = localStorage.getItem('calendarEvents');
    if (!raw) {
      
      return null;
    }
    
    const events = JSON.parse(raw);
    const visitDateObj = new Date(visitDate);
    
    
    
    const combined = events;
    const candidates = combined.filter(e => {
      if (e.type !== 'disinfection' || !e.date) {
        return false;
      }
      if (!e.completed || !e.responsible_party) {
        return false;
      }
      
      const eventDateObj = new Date(e.date);
      const diffDays = (visitDateObj - eventDateObj) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 5;
    });
    
    
    
    if (candidates.length > 0) {
      
      candidates.forEach((c, idx) => {
        const eventDateObj = new Date(c.date);
        const diffDays = Math.floor((visitDateObj - eventDateObj) / (1000 * 60 * 60 * 24));
        
        
        
        
      });
      
      const mostRecent = candidates.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      
      
      return mostRecent;
    } else {
      console.warn('❌ No matching disinfection found');
      
      // Show all disinfections for debugging
      const allDisinfections = events.filter(e => e.type === 'disinfection');
      
      allDisinfections.forEach((d, idx) => {
        
      });
      
      return null;
    }
  }
};

/**
 * Global modal management
 */
function showModal(content) {
  // Create modal container if it doesn't exist
  let modalOverlay = document.getElementById('modalOverlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modalOverlay';
    modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
    };
    document.body.appendChild(modalOverlay);
  }

  // Create modal content container
  let modalContent = document.getElementById('modalContent');
  if (!modalContent) {
    modalContent = document.createElement('div');
    modalContent.id = 'modalContent';
    modalOverlay.appendChild(modalContent);
  }

  // Set the content
  if (typeof content === 'string') {
    modalContent.innerHTML = content;
  } else {
    modalContent.textContent = content;
  }

  // Show modal
  modalOverlay.style.display = 'flex';
}

function closeModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
}

// Show visit history in modal
function showVisitHistoryModal() {
  const vesselData = VesselStorage.getVesselData();
  const currentBoat = vesselData?.vessel;
  
  if (!currentBoat) {
    showModal('⚠️ Ingen båt registrert');
    return;
  }

  const visits = currentBoat.visitHistory || [];
  
  let content = `
    <h2>📋 Besøkshistorikk - ${currentBoat.name || 'Ukjent'}</h2>
    <div style="max-height: 400px; overflow-y: auto;">
  `;
  
  if (visits.length === 0) {
    content += '<p style="text-align: center; color: #666; padding: 20px;">Ingen registrerte besøk</p>';
  } else {
    content += '<table style="width: 100%; border-collapse: collapse;">';
    content += '<thead><tr style="border-bottom: 2px solid #ccc;"><th style="padding: 10px; text-align: left;">Anlegg</th><th style="padding: 10px; text-align: left;">Dato</th><th style="padding: 10px; text-align: left;">Status</th></tr></thead>';
    content += '<tbody>';
    
    visits.forEach(visit => {
      const statusColor = visit.infected ? '#ef4444' : '#10b981';
      const statusIcon = visit.infected ? '⚠️' : '✅';
      content += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${visit.facility}</td>
          <td style="padding: 10px;">${visit.date}</td>
          <td style="padding: 10px; color: ${statusColor};">${statusIcon} ${visit.infected ? 'Smittet' : 'Friskt'}</td>
        </tr>
      `;
    });
    
    content += '</tbody></table>';
  }
  
  content += '</div>';
  showModal(content);
}

// Show route details in modal
function showRouteDetailsModal() {
  const plannedRoute = JSON.parse(localStorage.getItem('plannedRoute') || 'null');
  
  if (!plannedRoute || !plannedRoute.waypoints || plannedRoute.waypoints.length === 0) {
    showModal('ℹ️ Ingen planlagt rute');
    return;
  }

  let content = '<h2>🗺️ Rutedetaljer</h2>';
  content += '<div style="max-height: 400px; overflow-y: auto;">';
  content += '<p><strong>Total avstand:</strong> ' + (plannedRoute.totalDistance || 'Ukjent') + ' km</p>';
  content += '<p><strong>Estimert reisetid:</strong> ' + (plannedRoute.totalTime || 'Ukjent') + '</p>';
  content += '<p><strong>Antall anlegg:</strong> ' + plannedRoute.waypoints.length + '</p>';
  content += '<h3 style="margin-top: 20px;">Rute:</h3>';
  content += '<ol style="padding-left: 20px;">';
  
  plannedRoute.waypoints.forEach(wp => {
    content += '<li style="margin-bottom: 10px;"><strong>' + wp.name + '</strong>';
    if (wp.eta) content += ' - Ankomst: ' + wp.eta;
    content += '</li>';
  });
  
  content += '</ol>';
  content += '</div>';
  
  showModal(content);
}







