// app.js - Main application logic

let currentFacility = null;
let currentAssessment = null;
let facilitySearchDebounceTimer = null;
const AUTO_RESTORE_LAST_FACILITY = false;

// Loading state management
function showLoading(message = 'Laster data...') {
  const overlay = document.getElementById('loadingOverlay');
  const text = overlay?.querySelector('.loading-text');
  if (text) text.textContent = message;
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Toast notification system
function showToast(type, title, message, duration = 5000) {
  const container = document.getElementById('errorToastContainer');
  if (!container) return;

  const iconMap = {
    error: 'Feil',
    warning: 'Varsel',
    success: 'OK',
    info: 'Info'
  };

  const normalizedType = iconMap[type] ? type : 'info';

  const toast = document.createElement('div');
  toast.className = `error-toast error-toast-${normalizedType}`;
  toast.innerHTML = `
    <div class="error-toast-icon">${iconMap[normalizedType]}</div>
    <div class="error-toast-content">
      <div class="error-toast-title">${title}</div>
      <div class="error-toast-message">${message}</div>
    </div>
    <button class="error-toast-close" type="button" aria-label="Lukk">&times;</button>
  `;

  const closeBtn = toast.querySelector('.error-toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

function showErrorToast(title, message, duration = 5000) {
  showToast('error', title, message, duration);
}

function showSuccessToast(title, message, duration = 4000) {
  showToast('success', title, message, duration);
}

function showInfoToast(title, message, duration = 3500) {
  showToast('info', title, message, duration);
}

// Theme toggle functionality
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');
  const themeLabel = themeToggle?.querySelector('.theme-label');
  
  if (!themeToggle) return;

  // Check for saved theme preference or default to 'light'
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme, themeIcon, themeLabel, themeToggle);

  // Toggle theme on button click
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme, themeIcon, themeLabel, themeToggle);
    
  });

  // Keyboard accessibility
  themeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      themeToggle.click();
    }
  });
}

function updateThemeButton(theme, icon, label, button) {
  if (theme === 'dark') {
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Lys';
    if (button) button.setAttribute('title', 'Bytt til lys modus');
  } else {
    if (icon) icon.textContent = '🌙';
    if (label) label.textContent = 'Mørk';
    if (button) button.setAttribute('title', 'Bytt til mørk modus');
  }
}

function saveLastSelectedFacility(facility) {
  if (!facility) return;
  const facilityCode = facility.code || facility.localityNo || facility.locality_no;
  if (!facilityCode) return;
  localStorage.setItem('lastSelectedFacilityCode', String(facilityCode));
}

function clearLastSelectedFacility() {
  localStorage.removeItem('lastSelectedFacilityCode');
}

async function restoreLastSelectedFacility() {
  const facilityCode = localStorage.getItem('lastSelectedFacilityCode');
  if (!facilityCode) return;

  const facility = FacilityData.facilities.find((item) => {
    const code = item.code || item.localityNo || item.locality_no;
    return String(code) === facilityCode;
  });

  if (!facility) {
    clearLastSelectedFacility();
    return;
  }

  const searchInput = document.getElementById('facilitySearch');
  if (searchInput) {
    const duplicates = FacilityData.facilities.filter(f => f.name === facility.name).length > 1;
    searchInput.value = duplicates && facility.municipality
      ? `${facility.name} (${facility.municipality})`
      : facility.name;
  }

  await selectFacility(facility);
  showInfoToast('Sist valgte anlegg', `${facility.name} ble gjenopprettet.`);
}

// Initialize application
async function init() {

  try {
    // Initialize theme toggle
    initThemeToggle();

    showLoading('Starter dashboard...');

    // Start API status monitor early
    startApiStatusMonitor();
    startAisStatusMonitor();
    
    // Load all data
    const success = await FacilityData.init();
    
    if (!success) {
      showErrorToast('Feil ved lasting', 'Kunne ikke laste anleggsdata. Sjekk at API-serveren kjører på port 8000.');
      return;
    }
    
    // Initialize map
    const initializedMap = FacilityMap.init('facilityMap');
    if (!initializedMap) {
      showErrorToast('Kart utilgjengelig', 'Kartet kunne ikke initialiseres. Dashboard-data er likevel tilgjengelig.');
    }

    // Allow map clicks to select facilities
    FacilityMap.setOnFacilitySelect((facility) => {
      const searchInput = document.getElementById('facilitySearch');
      if (searchInput) {
        // Check if this facility name has duplicates
        const duplicates = FacilityData.facilities.filter(f => f.name === facility.name).length > 1;
        // If duplicates, show with municipality; otherwise just show name
        searchInput.value = duplicates && facility.municipality
          ? `${facility.name} (${facility.municipality})`
          : facility.name;
      }
      selectFacility(facility);
    });
    
    // Populate facility selector
    populateFacilitySelector();
    
    // Setup event listeners
    setupEventListeners();

    // Optional restore of previous selected facility (disabled by default to avoid heavy auto-load on refresh)
    if (AUTO_RESTORE_LAST_FACILITY) {
      await restoreLastSelectedFacility();
    } else {
      clearLastSelectedFacility();
    }

    // Calendar toggle (left column)
    setupCalendarToggle();

    // Make sidebar sections collapsible for compact view
    setupSidebarCollapsibles();

    // Show all facilities initially for quick map browsing
    FacilityMap.displayAllFacilities();
    updateRiskList(null);
    updateNearbyBreachVessels(null);
    
    // Start periodic proximity checks (every 5 minutes)
    startPeriodicProximityChecks();
  } catch (error) {
    console.error('❌ Fatal init error in facility dashboard:', error);
    showErrorToast('Uventet feil', 'Dashboard feilet under oppstart. Oppdater siden og se konsollen (F12) for detaljer.');
  } finally {
    hideLoading();
  }
}

window.addEventListener('error', () => {
  hideLoading();
});

window.addEventListener('unhandledrejection', () => {
  hideLoading();
});

function setupSidebarCollapsibles() {
  const targets = [
    { selector: '#visitsPanel', collapsed: true },
    { selector: '#nearbyInfectedPanel', collapsed: false },
    { selector: '#localSmitteRadiusPanel', collapsed: true },
    { selector: '#nearbyVesselsRiskPanel', collapsed: true },
    { selector: '#facilityDetailsPanel', collapsed: false },
    { selector: '#calendarContainer section', collapsed: true }, // Kalender collapsible
    { selector: '.factors-section-sidebar', collapsed: true },
    { selector: '.actions-section-sidebar', collapsed: true }
  ];

  targets.forEach(({ selector, collapsed }) => {
    document.querySelectorAll(selector).forEach((section) => {
      makeSectionCollapsible(section, collapsed);
    });
  });
}

function makeSectionCollapsible(section, collapsedByDefault) {
  if (!section || section.classList.contains('collapsible-section')) return;

  const header = section.querySelector('h3');
  if (!header) return;

  section.classList.add('collapsible-section');

  const body = document.createElement('div');
  body.className = 'collapsible-body';

  while (header.nextSibling) {
    body.appendChild(header.nextSibling);
  }
  section.appendChild(body);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'collapsible-toggle';
  toggle.textContent = collapsedByDefault ? 'Vis' : 'Skjul';
  toggle.setAttribute('aria-expanded', (!collapsedByDefault).toString());

  header.appendChild(toggle);

  if (collapsedByDefault) {
    section.classList.add('is-collapsed');
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isCollapsed = section.classList.toggle('is-collapsed');
    toggle.textContent = isCollapsed ? 'Vis' : 'Skjul';
    toggle.setAttribute('aria-expanded', (!isCollapsed).toString());
  });
}

function startApiStatusMonitor() {
  checkApiStatus();
  setInterval(checkApiStatus, 15 * 60 * 1000);
}

function startAisStatusMonitor() {
  // Don't load 10 000 vessels on page open – defer until a facility is selected.
  // updateAisStatusFromData() is called at the end of updateDashboard when vessels arrive.
  updateAisStatus('degraded', 'AIS: venter...');
  setInterval(checkAisStatus, 5 * 60 * 1000);
}

let isCheckingApiStatus = false;
let isCheckingAisStatus = false;

async function checkApiStatus() {
  const statusEl = document.getElementById('apiStatus');
  if (!statusEl) return;
  if (isCheckingApiStatus) return;

  isCheckingApiStatus = true;

  try {
    const response = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    if (!response.ok) {
      updateApiStatus('down', `API: nede (${response.status})`);
      return;
    }

    const data = await response.json();
    const status = data.status || 'unknown';
    if (status === 'healthy' || status === 'operational') {
      updateApiStatus('ok', 'API: OK');
    } else {
      updateApiStatus('degraded', `API: ${status}`);
    }
  } catch (error) {
    updateApiStatus('down', 'API: nede');
  } finally {
    isCheckingApiStatus = false;
  }
}

function updateApiStatus(state, text) {
  const statusEl = document.getElementById('apiStatus');
  if (!statusEl) return;

  statusEl.classList.remove('ok', 'degraded', 'down');
  statusEl.classList.add(state);
  statusEl.textContent = text;
}

async function checkAisStatus() {
  const statusEl = document.getElementById('aisStatus');
  if (!statusEl) return;
  if (isCheckingAisStatus) return;

  isCheckingAisStatus = true;

  try {
    await FacilityData.loadVessels();
    updateAisStatusFromData();
  } catch (error) {
    updateAisStatus('down', 'AIS: nede');
  } finally {
    isCheckingAisStatus = false;
  }
}

function updateAisStatusFromData() {
  const statusEl = document.getElementById('aisStatus');
  if (!statusEl) return;

  const source = FacilityData.vesselsSource || 'unknown';
  const count = Array.isArray(FacilityData.vessels) ? FacilityData.vessels.length : 0;

  if (source === 'error') {
    updateAisStatus('down', 'AIS: nede');
    return;
  }

  if (source === 'fallback') {
    updateAisStatus('degraded', 'AIS: fallback');
    return;
  }

  if (count === 0) {
    updateAisStatus('degraded', 'AIS: ingen data');
    return;
  }

  updateAisStatus('ok', 'AIS: aktiv');
}

function updateAisStatus(state, text) {
  const statusEl = document.getElementById('aisStatus');
  if (!statusEl) return;

  statusEl.classList.remove('ok', 'degraded', 'down');
  statusEl.classList.add(state);
  statusEl.textContent = text;
}

// Populate facility search datalist
function populateFacilitySelector() {
  const datalist = document.getElementById('facilityList');
  const input = document.getElementById('facilitySearch');
  
  if (!FacilityData.facilities || FacilityData.facilities.length === 0) {
    datalist.innerHTML = '<option value="">Ingen anlegg tilgjengelig</option>';
    input.placeholder = 'Ingen anlegg tilgjengelig';
    input.disabled = true;
    return;
  }
  
  // Sort facilities alphabetically
  const sorted = [...FacilityData.facilities].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '')
  );
  
  // Count name occurrences to identify duplicates
  const nameCounts = {};
  sorted.forEach(f => {
    const name = f.name || 'Unknown';
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  });
  
  // Use DocumentFragment to batch DOM updates (eliminates reflow on each append)
  const fragment = document.createDocumentFragment();
  
  sorted.forEach(facility => {
    const option = document.createElement('option');
    
    // If multiple facilities have same name, add municipality to disambiguate
    const displayName = nameCounts[facility.name] > 1 && facility.municipality
      ? `${facility.name} (${facility.municipality})`
      : facility.name;
    
    option.value = displayName;
    // Store localityNo as data attribute for precise lookup
    option.dataset.localityNo = facility.localityNo;
    fragment.appendChild(option);
  });
  
  datalist.innerHTML = '';
  datalist.appendChild(fragment);
  
  input.placeholder = `Søk blant ${sorted.length} anlegg...`;
  input.disabled = false;
}


// Setup event listeners
function setupEventListeners() {
  const searchInput = document.getElementById('facilitySearch');
  const filterNearby = document.getElementById('filterNearby');
  const nearbyRadius = document.getElementById('nearbyRadius');
  const resetBtn = document.getElementById('resetMap');
  const toggleLocalSmitte = document.getElementById('toggleLocalSmitteRadius');
  const toggleFacilities = document.getElementById('toggleFacilities');
  const toggleVessels = document.getElementById('toggleVessels');
  
  // Listen to input changes (typing, pasting, selecting from datalist)
  searchInput.addEventListener('input', (event) => {
    if (facilitySearchDebounceTimer) {
      clearTimeout(facilitySearchDebounceTimer);
    }

    const hasValue = event.target.value.trim().length > 0;
    searchInput.setAttribute('aria-expanded', String(hasValue));

    facilitySearchDebounceTimer = setTimeout(() => {
      handleFacilitySearch(event);
    }, 220);
  });
  
  // Also listen to change event for datalist selection
  searchInput.addEventListener('change', (event) => {
    if (facilitySearchDebounceTimer) {
      clearTimeout(facilitySearchDebounceTimer);
      facilitySearchDebounceTimer = null;
    }
    handleFacilitySearch(event);
  });

  // Map filter controls - refresh map when changed
  if (filterNearby && nearbyRadius) {
    filterNearby.addEventListener('change', handleMapFilterChange);
    nearbyRadius.addEventListener('change', handleMapFilterChange);
  }

  // Map toggle controls - re-render facility display when toggled
  if (toggleFacilities) {
    toggleFacilities.addEventListener('change', () => {
      if (currentFacility && currentAssessment) {
        FacilityMap.displayFacility(currentFacility, currentAssessment);
      }
    });
  }

  if (toggleVessels) {
    toggleVessels.addEventListener('change', () => {
      if (currentFacility) {
        if (toggleVessels.checked) {
          FacilityMap.displayNearbyVessels(currentFacility);
        } else {
          FacilityMap.clearVesselMarkers();
        }
      }
    });
  }

  // Local smitte radius toggle - re-render when toggled
  if (toggleLocalSmitte) {
    toggleLocalSmitte.addEventListener('change', () => {
      if (currentFacility) {
        // Full redraw slik at 10 km-markører både legges til og fjernes korrekt
        const assessment = currentAssessment || (FacilityLogic && FacilityLogic.assessRisk
          ? FacilityLogic.assessRisk(currentFacility)
          : null);
        FacilityMap.displayFacility(currentFacility, assessment);
      }
      updateLocalSmitteRadiusList(currentFacility);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetSelection);
  }
  
  // Action buttons
  document.getElementById('btnLogEvent').addEventListener('click', handleLogEvent);
  document.getElementById('btnSendAlert').addEventListener('click', handleSendAlert);
  document.getElementById('btnSetQuarantine').addEventListener('click', handleSetQuarantine);
  document.getElementById('btnGenerateReport').addEventListener('click', handleGenerateReport);
}

function setupCalendarToggle() {
  const toggleBtn = document.getElementById('toggleCalendarBtn');
  const calendarPanel = document.getElementById('calendarPanel');

  if (!toggleBtn || !calendarPanel) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = calendarPanel.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    calendarPanel.setAttribute('aria-hidden', String(!isOpen));
  });
}

function getMapFilterSettings() {
  const filterNearby = document.getElementById('filterNearby');
  const nearbyRadius = document.getElementById('nearbyRadius');
  
  if (!filterNearby || !nearbyRadius) return null;
  
  return {
    showNearbyOnly: filterNearby.checked,
    radiusKm: parseInt(nearbyRadius.value, 10) || 20
  };
}

function handleMapFilterChange() {
  if (!currentFacility) return;
  
  const settings = getMapFilterSettings();
  if (!settings) return;
  
  FacilityMap.setFilter(settings);
  FacilityMap.displayFacility(currentFacility, currentAssessment).catch(err => {
    console.error('Error displaying facility:', err);
  });
}

// Handle facility search input
async function handleFacilitySearch(event) {
  const searchValue = event.target.value.trim();
  
  if (!searchValue) {
    resetDashboard();
    return;
  }
  
  // Try to find exact match
  // First, try exact match on search value (might include municipality)
  let facility = FacilityData.facilities.find(f => {
    const name = f.name || '';
    const municipality = f.municipality || '';
    const fullName = municipality ? `${name} (${municipality})` : name;
    return name === searchValue || fullName === searchValue;
  });
  
  // If not found, try getFacility which handles name-only matches
  if (!facility) {
    facility = FacilityData.getFacility(searchValue);
  }
  
  if (!facility) {
    // Not a complete match yet, user is still typing
    return;
  }

  await selectFacility(facility);
}

async function selectFacility(facility) {
  if (!facility) return;
  
  currentFacility = facility;
  saveLastSelectedFacility(facility);
  await updateDashboard(facility);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function selectFacilityByName(name) {
  const facility = FacilityData.facilities.find(item => item.name === name);
  if (facility) {
    selectFacility(facility);
  }
}

function bindRiskEntryClicks(container) {
  if (!container) return;
  container.querySelectorAll('.risk-entry[data-facility-name]').forEach((entry) => {
    entry.addEventListener('click', () => {
      const encodedName = entry.getAttribute('data-facility-name');
      if (!encodedName) return;
      selectFacilityByName(decodeURIComponent(encodedName));
    });
  });
}

function updateRiskList(facility = currentFacility) {
  const infectedList = document.getElementById('infectedList');
  const atRiskList = document.getElementById('atRiskList');
  const highLiceList = document.getElementById('highLiceList');

  if (!facility || !Number.isFinite(Number(facility.latitude)) || !Number.isFinite(Number(facility.longitude))) {
    ['countRed', 'countRedDetails', 'countOrange', 'countOrangeDetails', 'countPurple', 'countPurpleDetails'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '-';
    });

    if (infectedList) {
      infectedList.innerHTML = '<li class="risk-entry-empty">Velg et anlegg for å se nærliggende smitterisiko</li>';
    }
    if (atRiskList) {
      atRiskList.innerHTML = '<li class="risk-entry-empty">Velg et anlegg for å se nærliggende sonerisiko</li>';
    }
    if (highLiceList) {
      highLiceList.innerHTML = '<li class="risk-entry-empty">Velg et anlegg for å se nærliggende luserisiko</li>';
    }
    return;
  }

  const radiusKm = 15;
  const facilityLat = Number(facility.latitude ?? facility.lat);
  const facilityLon = Number(facility.longitude ?? facility.lon);
  const allFacilities = Array.isArray(FacilityData.facilities) ? FacilityData.facilities : [];
  const infected = FacilityData.findInfectedWithinDistance(facilityLat, facilityLon, radiusKm)
    .filter(item => item?.facility?.name && item.facility.name !== facility.name && item.distance > 0)
    .map(item => ({
      name: item.facility.name,
      diseases: item.diseases || item.facility?.diseases || [],
      distance: item.distance
    }));

  const atRisk = FacilityData.getBWRiskFacilitiesWithinDistance(facilityLat, facilityLon, radiusKm)
    .filter(item => item?.risk?.facility_name && item.risk.facility_name !== facility.name && item.distance > 0)
    .map(item => ({
      facility_name: item.risk.facility_name,
      zone_type: item.risk.zone_type,
      risk_level: item.risk.risk_level,
      distance: item.distance
    }));

  const highLice = allFacilities
    .filter(item => item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .filter(item => {
      const sameFacility = String(item.localityNo || item.code || '') === String(facility.localityNo || facility.code || '');
      if (sameFacility) return false;
      const distance = FacilityData.calculateDistance(facilityLat, facilityLon, item.latitude, item.longitude);
      return Number.isFinite(distance) && distance <= radiusKm;
    })
    .filter(item => item.lice_over_threshold === true || item.liceHigh === true || item?.lice?.over_threshold === true)
    .map(item => ({
      ...item,
      _distance: FacilityData.calculateDistance(facilityLat, facilityLon, item.latitude, item.longitude)
    }))
    .sort((a, b) => a._distance - b._distance);

  ['countRed', 'countRedDetails'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(infected.length);
  });
  ['countOrange', 'countOrangeDetails'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(atRisk.length);
  });
  ['countPurple', 'countPurpleDetails'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(highLice.length);
  });

  if (infectedList) {
    infectedList.innerHTML = infected.length
      ? infected.map((item) => {
          const diseases = (item.diseases || []).map(d => (typeof d === 'string' ? d : d?.name || 'Smittet')).join(', ');
          return `<li class="risk-entry risk-entry-red" data-facility-name="${encodeURIComponent(item.name)}"><span class="entry-name">${escapeHtml(item.name)}</span><span class="entry-detail">${escapeHtml(diseases || 'Smittet')} · ${item.distance.toFixed(1)} km</span></li>`;
        }).join('')
      : '<li class="risk-entry-empty">Ingen smittede anlegg innen 15 km</li>';
    bindRiskEntryClicks(infectedList);
  }

  if (atRiskList) {
    atRiskList.innerHTML = atRisk.length
      ? atRisk.map((item) => {
          const label = item.zone_type || item.risk_level || 'Risiko';
          return `<li class="risk-entry risk-entry-orange" data-facility-name="${encodeURIComponent(item.facility_name)}"><span class="entry-name">${escapeHtml(item.facility_name)}</span><span class="entry-detail">${escapeHtml(label)} · ${item.distance.toFixed(1)} km</span></li>`;
        }).join('')
      : '<li class="risk-entry-empty">Ingen anlegg i høy/ekstrem sone innen 15 km</li>';
    bindRiskEntryClicks(atRiskList);
  }

  if (highLiceList) {
    highLiceList.innerHTML = highLice.length
      ? highLice.slice(0, 40).map((item) => {
          const adult = Number(item?.lice?.adult_female_lice ?? item.lice_count ?? item.liceCount ?? item.lice);
          const detail = Number.isFinite(adult) ? `${adult.toFixed(2)} vaksne holus` : 'Over lusegrense';
          return `<li class="risk-entry risk-entry-purple" data-facility-name="${encodeURIComponent(item.name)}"><span class="entry-name">${escapeHtml(item.name)}</span><span class="entry-detail">${escapeHtml(detail)}</span></li>`;
        }).join('')
      : '<li class="risk-entry-empty">Ingen med høy lusetelling innen 15 km</li>';
    bindRiskEntryClicks(highLiceList);
  }
}

async function updateNearbyBreachVessels(facility = currentFacility) {
  const list = document.getElementById('nearbyBreachVesselsList');
  const count = document.getElementById('countBreachDetails');
  if (!list) return;

  if (!facility || !Number.isFinite(Number(facility.latitude)) || !Number.isFinite(Number(facility.longitude))) {
    if (count) count.textContent = '-';
    list.innerHTML = '<li class="risk-entry-empty">Velg et anlegg for å se båter med karantenebrudd i nærheten</li>';
    return;
  }

  if (!FacilityData.quarantineAnalysisData || Object.keys(FacilityData.quarantineAnalysisData).length === 0) {
    await FacilityData.loadQuarantineAnalysisData();
  }

  const radiusKm = FacilityMap.nearbyRadiusKm || 20;
  const candidates = FacilityData.findVesselsWithinDistance(
    facility.latitude,
    facility.longitude,
    radiusKm
  ).slice(0, 60);

  const checked = await Promise.all(candidates.map(async (item) => {
    const details = await FacilityData.getVesselStatusDetails(item.vessel.mmsi);
    return { ...item, status: details.status, reason: details.reason };
  }));

  const breaches = checked
    .filter(item => item.status === 'breach')
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  if (count) count.textContent = String(breaches.length);

  if (breaches.length === 0) {
    list.innerHTML = '<li class="risk-entry-empty">Ingen båter med karantenebrudd innen valgt radius</li>';
    return;
  }

  list.innerHTML = breaches.map((item) => {
    const vessel = item.vessel || {};
    const displayName = vessel.name || `MMSI ${vessel.mmsi}`;
    return `<li class="risk-entry risk-entry-breach"><span class="entry-name">${escapeHtml(displayName)}</span><span class="entry-detail">${item.distance.toFixed(1)} km · ${escapeHtml(item.reason || 'Karantenebrudd')}</span></li>`;
  }).join('');
}

function updateNearbyRiskPanel(facility) {
  const section = document.getElementById('nearbyRiskSection');
  const list = document.getElementById('nearbyRiskList');
  if (!section || !list || !facility) return;

  const facilityLat = Number(facility.latitude ?? facility.lat);
  const facilityLon = Number(facility.longitude ?? facility.lon);
  if (!Number.isFinite(facilityLat) || !Number.isFinite(facilityLon)) {
    section.style.display = 'none';
    return;
  }

  const entries = [];

  FacilityData.findInfectedWithinDistance(facilityLat, facilityLon, 15)
    .filter(item => item?.facility?.name && item.facility.name !== facility.name && item.distance > 0)
    .forEach((item) => {
      entries.push({
        name: item.facility.name,
        type: 'red',
        detail: (item.diseases || []).join(', ') || 'Smittet',
        distance: item.distance
      });
    });

  FacilityData.getBWRiskFacilitiesWithinDistance(facilityLat, facilityLon, 15)
    .filter(item => item?.risk?.facility_name && item.risk.facility_name !== facility.name && item.distance > 0)
    .forEach((item) => {
      entries.push({
        name: item.risk.facility_name,
        type: 'orange',
        detail: item.risk.zone_type || item.risk.risk_level || 'Risikosone',
        distance: item.distance
      });
    });

  if (entries.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  entries.sort((a, b) => a.distance - b.distance);
  section.style.display = 'block';
  list.innerHTML = entries
    .slice(0, 20)
    .map((item) => `<li class="risk-entry risk-entry-${item.type}" data-facility-name="${encodeURIComponent(item.name)}"><span class="entry-name">${escapeHtml(item.name)}</span><span class="entry-detail">${escapeHtml(item.detail)} · ${item.distance.toFixed(1)} km</span></li>`)
    .join('');
  bindRiskEntryClicks(list);
}

// Update entire dashboard for selected facility
async function updateDashboard(facility) {
  
  showLoading(`Laster data for ${facility.name}...`);
  
  try {
    // 1. Assess risk
    currentAssessment = FacilityLogic.assessRisk(facility);
    
    // 2. Update risk panel
    updateRiskPanel(facility, currentAssessment);
    
    // 3. Update risk factors table
    updateFactorsTable(currentAssessment);
    
    // 5. Update recommendations
    updateRecommendations(currentAssessment);
    updateNearbyRiskPanel(facility);
    updateRiskList(facility);
    
    // 6. Update map
    const mapSettings = getMapFilterSettings();
    if (mapSettings) {
      FacilityMap.setFilter(mapSettings);
    }

    // OPTIMIZATION: Parallelize all API calls with Promise.allSettled to prevent one failure from blocking others
    const _facilityLat = facility.latitude || facility.lat;
    const _facilityLon = facility.longitude || facility.lon;
    const _vesselRadius = Math.max((FacilityMap.nearbyRadiusKm || 20) * 2, 80); // 2× display radius, min 80 km
    const results = await Promise.allSettled([
      FacilityData.loadVessels(10000, { lat: _facilityLat, lon: _facilityLon, radiusKm: _vesselRadius }),
      FacilityData.loadConfirmedPlans(),
      FacilityData.loadOceanCurrent(facility.latitude, facility.longitude),
      updateOutbreakRiskScore(facility),
      updateFacilityDetailsSidebar(facility, currentAssessment),
      updateVisitsList(facility)
    ]);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['loadVessels', 'loadConfirmedPlans', 'loadOceanCurrent', 'updateOutbreakRiskScore', 'updateFacilityDetailsSidebar', 'updateVisitsList'];
        console.warn(`⚠️ ${names[index]} failed:`, result.reason);
      }
    });

    Promise.allSettled([
      FacilityData.checkProximityToInfectedFacilities(),
      FacilityData.loadActiveQuarantines()
    ]).then(() => {
      try {
        updateStatusPanel(facility, currentAssessment);
      } catch (_) {
      }
    });
    
    updateAisStatusFromData();

    // Lazy FDIR enrichment — runs once (non-blocking) on first facility select
    if (!FacilityData._fdirEnriched) {
      FacilityData._enrichWithFdir();
    }

    await FacilityMap.displayFacility(facility, currentAssessment);

    updateNearbyBreachVessels(facility).catch((error) => {
      console.warn('⚠️ updateNearbyBreachVessels failed:', error?.message || error);
    });

    updateMapStatus();

  if (currentAssessment) {
    currentAssessment.nearbyVesselsCount = FacilityMap.lastNearbyVesselsCount || 0;
    updateFactorsTable(currentAssessment);
  }
  
  // 7. Initialize calendar feature (NYT!)
  if (typeof initCalendar === 'function') {
    const facilityCode = facility.code || facility.localityNo || facility.locality_no;
    initCalendar(facilityCode);
  }

  // 7B. Update status panel summary
  updateStatusPanel(facility, currentAssessment);

  // 7C. Update facility timeline
  updateFacilityTimeline(facility).catch((error) => {
    console.warn('⚠️ updateFacilityTimeline failed:', error?.message || error);
  });

  // 8. Enable action buttons
  enableActionButtons();
  
  } catch (error) {
    console.error('Error updating dashboard:', error);
    showErrorToast('Feil ved lasting', `Kunne ikke laste alle data for ${facility.name}. Noe data kan mangle.`);
  } finally {
    hideLoading();
  }
}

// Update status panel (actionable summary)
function updateStatusPanel(facility = currentFacility, assessment = currentAssessment) {
  const nearbyVesselsEl = document.getElementById('statusNearbyVessels');
  const nearbyRadiusEl = document.getElementById('statusNearbyRadius');
  const activeRoutesEl = document.getElementById('statusActiveRoutes');
  const pendingRoutesEl = document.getElementById('statusPendingRoutes');
  const nextApprovedEl = document.getElementById('statusNextApproved');
  const nextApprovedTimeEl = document.getElementById('statusNextApprovedTime');
  const activeQuarantinesEl = document.getElementById('statusActiveQuarantines');

  if (!facility) return;

  const radiusKm = FacilityMap.nearbyRadiusKm || 20;
  const nearbyCount = assessment?.nearbyVesselsCount ?? FacilityMap.lastNearbyVesselsCount ?? 0;

  if (nearbyVesselsEl) nearbyVesselsEl.textContent = String(nearbyCount);
  if (nearbyRadiusEl) nearbyRadiusEl.textContent = `(${radiusKm} km)`;

  const calendarEvents = facilityCalendar?.events || [];
  const activeEvents = calendarEvents.filter(e => e.type === 'vessel-visit' && e.status !== 'rejected');
  const pendingEvents = activeEvents.filter(e => e.status !== 'approved');

  if (activeRoutesEl) activeRoutesEl.textContent = String(activeEvents.length);
  if (pendingRoutesEl) pendingRoutesEl.textContent = `(Avventer: ${pendingEvents.length})`;

  const approvedEvents = calendarEvents
    .filter(e => e.type === 'vessel-visit' && e.status === 'approved')
    .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

  const nextApproved = approvedEvents[0];
  if (nextApprovedEl) nextApprovedEl.textContent = nextApproved ? nextApproved.date : '-';
  if (nextApprovedTimeEl) nextApprovedTimeEl.textContent = nextApproved ? `(kl. ${nextApproved.time})` : '(-)';

  const activeQuarantines = Array.isArray(FacilityData.activeQuarantines)
    ? FacilityData.activeQuarantines.length
    : 0;
  if (activeQuarantinesEl) activeQuarantinesEl.textContent = String(activeQuarantines);
}

// Update incoming traffic widget (Tier 1 Priority)
// Now includes smittespredning risk overlay
// Incoming traffic widget removed - functionality consolidated into vessel map layer

// Update facility timeline (Tier 1 Priority - Data Moat)
// Combines vessel visits + smittespredning events into unified chronological view
async function updateFacilityTimeline(facility = currentFacility) {
  const listEl = document.getElementById('timelineList');
  if (!listEl) return;

  if (!facility) {
    listEl.innerHTML = '<div class="timeline-empty">Velg et anlegg</div>';
    return;
  }

  try {
    const facilityCode = facility.code || facility.localityNo || facility.locality_no;
    
    // Fetch from both sources in parallel
    const [timelineResp, smitteResp] = await Promise.allSettled([
      fetch(`${API_BASE}/api/facilities/${facilityCode}/timeline?limit=50`),
      fetch(`${API_BASE}/api/exposure/smittespredning/facility/${facilityCode}?limit=50`)
    ]);
    
    // Collect all events
    const allEvents = [];
    
    // Parse vessel visit timeline
    if (timelineResp.status === 'fulfilled' && timelineResp.value.ok) {
      const data = await timelineResp.value.json();
      const timeline = data.timeline || [];
      
      timeline.forEach(event => {
        allEvents.push({
          ...event,
          type: 'vessel_visit',
          sortTime: new Date(event.timestamp)
        });
      });
    }
    
    // Parse smittespredning events
    if (smitteResp.status === 'fulfilled' && smitteResp.value.ok) {
      const data = await smitteResp.value.json();
      const paths = data.outgoing_paths?.events || [];
      const incomingPaths = data.incoming_paths?.events || [];
      
      paths.forEach(event => {
        allEvents.push({
          ...event,
          type: 'smittespredning_outgoing',
          sortTime: new Date(event.timestamp_start)
        });
      });
      
      incomingPaths.forEach(event => {
        allEvents.push({
          ...event,
          type: 'smittespredning_incoming',
          sortTime: new Date(event.timestamp_start)
        });
      });
    }
    
    // Sort newest first
    allEvents.sort((a, b) => b.sortTime - a.sortTime);
    
    if (allEvents.length === 0) {
      listEl.innerHTML = '<div class="timeline-empty">Ingen hendelser registrert ennå</div>';
      return;
    }

    // Build timeline HTML
    let html = '';
    allEvents.forEach(event => {
      const timeStr = formatTimestamp(event.sortTime);
      
      if (event.type === 'vessel_visit') {
        const riskClass = event.risk_triggered ? 'risk-event' : 'vessel-visit';
        const riskBadge = event.risk_triggered 
          ? '<span class="timeline-event-badge risk">⚠️ RISIKO</span>'
          : '<span class="timeline-event-badge clean">✓ Normal</span>';
        const mergedCount = Number(event.merged_event_count || 1);
        const mergedLabel = mergedCount > 1
          ? `<br><span style="font-size: 0.82em; color: #6b7280;">Sammenslått fra ${mergedCount} registreringer (≤ 60 min)</span>`
          : '';
        const infectedSourceLabel = event.within_48h_infected_rule
          ? `<br>48t-regel: Fra smittet anlegg <strong>${event.infected_source_facility_name || event.infected_source_facility_id || 'Ukjent'}</strong>${event.infected_source_hours_ago != null ? ` (${event.infected_source_hours_ago} t siden)` : ''}`
          : '';
        
        html += `
          <div class="timeline-event ${riskClass}">
            <div class="timeline-event-header">
              <div class="timeline-event-type">
                🚢 Båtbesøk ${riskBadge}
              </div>
              <div class="timeline-event-time">${timeStr}</div>
            </div>
            <div class="timeline-event-details">
              <strong>${event.vessel_name || 'Ukjent båt'}</strong> (MMSI: ${event.vessel_mmsi})<br>
              Avstand: <strong>${event.distance_km.toFixed(1)} km</strong>
              ${event.duration_min ? ` • ${event.duration_min} min` : ''}
              ${event.disease_status ? `<br>Status: ${event.disease_status}` : ''}
              ${infectedSourceLabel}
              ${mergedLabel}
              ${event.notes ? `<br><em>${event.notes}</em>` : ''}
            </div>
          </div>
        `;
      }
      
      if (event.type === 'smittespredning_outgoing') {
        // OUTGOING: This facility had disease, and we detected a boat leaving
        const statusColor = {
          'DETECTED': '#f59e0b',
          'CONFIRMED_HEALTHY': '#10b981',
          'CONFIRMED_INFECTED': '#ef4444',
          'UNCERTAIN': '#6b7280'
        }[event.path_risk_status] || '#9ca3af';
        
        const statusText = {
          'DETECTED': '🔍 Oppdaget',
          'CONFIRMED_HEALTHY': '✅ Frisk påvist',
          'CONFIRMED_INFECTED': '⛔ Smitte påvist',
          'UNCERTAIN': '❓ Usikker'
        }[event.path_risk_status] || event.path_risk_status;
        
        html += `
          <div class="timeline-event smittespredning-event outgoing" style="border-left-color: ${statusColor};">
            <div class="timeline-event-header">
              <div class="timeline-event-type">
                🧬 Smittespredning <span style="background: ${statusColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 0.2rem; font-size: 0.8rem; font-weight: 600;">${statusText}</span>
              </div>
              <div class="timeline-event-time">${timeStr}</div>
            </div>
            <div class="timeline-event-details">
              <strong>${event.vessel_name || 'Ukjent båt'}</strong> (MMSI: ${event.vessel_mmsi})
              <br>Oppdaget via: <em>${event.detected_via}</em>
              <br>Destinasjon: <strong>${event.facility_end_name || event.facility_end_id || 'Ukjent'}</strong>
              ${event.distance_km ? `<br>Avstand: ${event.distance_km.toFixed(1)} km` : ''}
              ${event.notes ? `<br><em>${event.notes}</em>` : ''}
            </div>
          </div>
        `;
      }
      
      if (event.type === 'smittespredning_incoming') {
        // INCOMING: Another facility detected a boat that came from a sick facility, potentially bringing disease here
        const statusColor = {
          'DETECTED': '#f59e0b',
          'CONFIRMED_HEALTHY': '#10b981',
          'CONFIRMED_INFECTED': '#ef4444',
          'UNCERTAIN': '#6b7280'
        }[event.path_risk_status] || '#9ca3af';
        
        const statusText = {
          'DETECTED': '🔍 Oppdaget',
          'CONFIRMED_HEALTHY': '✅ Frisk påvist',
          'CONFIRMED_INFECTED': '⛔ Smitte påvist',
          'UNCERTAIN': '❓ Usikker'
        }[event.path_risk_status] || event.path_risk_status;
        
        html += `
          <div class="timeline-event smittespredning-event incoming" style="border-left-color: ${statusColor};">
            <div class="timeline-event-header">
              <div class="timeline-event-type">
                ⚠️ Innkommende risiko <span style="background: ${statusColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 0.2rem; font-size: 0.8rem; font-weight: 600;">${statusText}</span>
              </div>
              <div class="timeline-event-time">${timeStr}</div>
            </div>
            <div class="timeline-event-details">
              <strong>${event.vessel_name || 'Ukjent båt'}</strong> (MMSI: ${event.vessel_mmsi})
              <br>Fra smittet anlegg: <strong>${event.facility_start_name || event.facility_start_id}</strong> (${event.facility_start_disease})
              <br>Oppdaget via: <em>${event.detected_via}</em>
              ${event.distance_km ? `<br>Avstand: ${event.distance_km.toFixed(1)} km` : ''}
              ${event.notes ? `<br><em>${event.notes}</em>` : ''}
            </div>
          </div>
        `;
      }
    });

    listEl.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading timeline:', error);
    listEl.innerHTML = '<div class="timeline-empty">Feil ved lasting av tidslinje</div>';
  }
}

// Format timestamp for timeline display
function formatTimestamp(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} min siden`;
  } else if (diffHours < 24) {
    return `${diffHours} t siden`;
  } else if (diffDays < 7) {
    return `${diffDays} d siden`;
  } else {
    return date.toLocaleDateString('no-NO', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

function handleResetSelection() {
  const searchInput = document.getElementById('facilitySearch');
  if (searchInput) {
    searchInput.value = '';
  }
  clearLastSelectedFacility();
  currentFacility = null;
  currentAssessment = null;
  resetDashboard();
}

// Update risk panel (section 1)
function updateRiskPanel(facility, assessment) {
  const nameEl = document.getElementById('facilityName');
  const facilityCodeEl = document.getElementById('facilityCodeIndicator');
  const statusEl = document.getElementById('riskStatus');
  const whyRiskLink = document.getElementById('whyRiskLink');
  const nearbyInfectedEl = document.getElementById('nearbyInfected');
  const closestDistanceEl = document.getElementById('closestDistance');
  const recentVisitsEl = document.getElementById('recentVisits');
  const currentFlowEl = document.getElementById('currentFlow');
  
  // Update name
  nameEl.textContent = facility.name;
  if (facilityCodeEl) {
    const facilityCode = facility.code || facility.localityNo || facility.locality_no || '-';
    facilityCodeEl.textContent = `ID: ${facilityCode}`;
  }
  
  // Update status badge with explanation
  const badge = FacilityLogic.getRiskBadge(assessment);
  let statusHTML = `<span class="risk-badge ${badge.class}">${badge.text}</span>`;
  
  // Show "Hvorfor?" link when facility is selected
  if (whyRiskLink) {
    whyRiskLink.style.display = 'inline';
  }
  
  // Add risk explanation if available
  if (assessment.riskExplanation && assessment.riskExplanation.length > 0) {
    statusHTML += '<div class="risk-explanation">';
    statusHTML += '<strong>Hvorfor:</strong> ' + assessment.riskExplanation.join(' • ');
    statusHTML += '</div>';
  }
  
  statusEl.innerHTML = statusHTML;
  
  // Update metrics
  const nearbyCount = assessment.nearbyInfected ? assessment.nearbyInfected.length : 0;
  nearbyInfectedEl.textContent = nearbyCount;
  
  if (assessment.closestInfected) {
    closestDistanceEl.textContent = `${assessment.closestInfected.distance.toFixed(1)} km`;
  } else {
    closestDistanceEl.textContent = 'Ingen';
  }
  
  if (recentVisitsEl) {
    recentVisitsEl.textContent = '...';
  }

  // Current flow - placeholder (would need ocean current data)
  if (currentFlowEl) {
    currentFlowEl.textContent = 'N/A';
  }
}

// Update outbreak risk score panel with detailed factor breakdown (NEW!)
async function updateOutbreakRiskScore(facility) {
  const panel = document.getElementById('outbreakRiskPanel');
  if (!panel) return;

  try {
    const riskData = await FacilityData.getRiskScoreForFacility(facility.name, facility.code || facility.localityNo);
    
    if (!riskData) {
      document.getElementById('riskScoreValue').textContent = '—';
      document.getElementById('riskScoreLevel').textContent = 'Ingen data';
      return;
    }

    const score = riskData.risk_score || 0;
    const level = riskData.risk_level || 'Low';
    const factors = riskData.risk_factors || {};
    const recommendations = riskData.recommendations || [];
    
    // Update main score display
    document.getElementById('riskScoreValue').textContent = score;
    
    // Set level text and styling
    const levelEl = document.getElementById('riskScoreLevel');
    levelEl.textContent = getLevelLabel(level);
    levelEl.className = `risk-level-${level.toLowerCase()}`;
    
    // Update Factor 1: Distance
    const distFactor = factors.distance || {};
    document.getElementById('distancePoints').textContent = `${distFactor.points || 0} pts`;
    document.getElementById('distanceDetail').textContent = distFactor.explanation || 'Ikke beregnet';
    
    // Update Factor 2: Ocean Current
    const currFactor = factors.ocean_current || {};
    document.getElementById('currentPoints').textContent = `${currFactor.points || 0} pts`;
    const currExpl = currFactor.explanation || 'Ikke tilgjengelig';
    document.getElementById('currentDetail').textContent = currExpl;
    
    // Update Factor 3: Risky Vessels
    const vesselFactor = factors.risky_vessels || {};
    document.getElementById('vesselPoints').textContent = `${vesselFactor.points || 0} pts`;
    document.getElementById('vesselDetail').textContent = vesselFactor.explanation || 'Ingen båter nærby';
    
    // Update Factor 4: Recent Contacts
    const contactFactor = factors.recent_contacts || {};
    document.getElementById('contactPoints').textContent = `${contactFactor.points || 0} pts`;
    document.getElementById('contactDetail').textContent = contactFactor.explanation || 'Ingen nylige kontakter';
    
    // Update recommendations
    const recsEl = document.getElementById('riskRecommendations');
    if (recommendations && recommendations.length > 0) {
      recsEl.innerHTML = recommendations.map(rec => `<div class="recommendation-item">${rec}</div>`).join('');
    } else {
      recsEl.textContent = '✓ Normale rutiner er tilstrekkelig';
    }
    
  } catch (error) {
    console.warn('Failed to load outbreak risk score:', error);
    document.getElementById('riskScoreValue').textContent = '—';
    document.getElementById('riskScoreLevel').textContent = 'Feil';
  }
}

// Helper function to get risk level label
function getLevelLabel(level) {
  switch(level.toUpperCase()) {
    case 'CRITICAL': return '🔴 KRITISK';
    case 'HIGH': return '🔴 HØYT';
    case 'MEDIUM': return '🟡 MODERAT';
    case 'LOW': return '🟢 LAVT';
    default: return level;
  }
}

function formatBSurveyStatus(siteCondition, measurementDate) {
  const labels = {
    1: '1 - meget god',
    2: '2 - god',
    3: '3 - dårlig',
    4: '4 - meget dårlig'
  };

  const statusText = labels[siteCondition] || (siteCondition ? String(siteCondition) : 'Ikke oppgitt');

  if (!measurementDate) {
    return statusText;
  }

  const parsed = new Date(measurementDate);
  if (Number.isNaN(parsed.getTime())) {
    return statusText;
  }

  return `${statusText} (${parsed.toLocaleDateString('no-NO')})`;
}

// Calculate B-survey deadline and status
function calculateBSurveyStatus(bSurveyData) {
  if (!bSurveyData) {
    return {
      status: 'unknown',
      statusText: 'Ingen data',
      statusBadge: '❓ Ukjent',
      lastDate: null,
      siteCondition: null,
      siteConditionText: 'Ikke oppgitt',
      recommendedDate: null,
      daysUntilDeadline: null,
      infoText: 'Ingen B-undersøkelsesdata tilgjengelig'
    };
  }

  const measurementDate = bSurveyData.measurement_date || bSurveyData.samplingDate;
  if (!measurementDate) {
    return {
      status: 'unknown',
      statusText: 'Ingen rapport',
      statusBadge: '❓ Ukjent',
      lastDate: null,
      siteCondition: bSurveyData.site_condition,
      siteConditionText: formatSiteConditionLabel(bSurveyData.site_condition),
      recommendedDate: null,
      daysUntilDeadline: null,
      infoText: 'Ingen måledato registrert'
    };
  }

  const lastDate = new Date(measurementDate);
  if (Number.isNaN(lastDate.getTime())) {
    return {
      status: 'unknown',
      statusText: 'Ugyldig dato',
      statusBadge: '❓ Ukjent',
      lastDate: null,
      siteCondition: bSurveyData.site_condition,
      siteConditionText: formatSiteConditionLabel(bSurveyData.site_condition),
      recommendedDate: null,
      daysUntilDeadline: null,
      infoText: 'Datoen kunne ikke tolkes'
    };
  }

  // Determine frequency based on site condition
  // "Meget dårlig" (4) → 6 months
  // "Dårlig" (3) → 12 months
  // "God/Meget god" (1-2) → 24 months
  let frequencyMonths;
  const siteCondition = bSurveyData.site_condition;
  
  if (siteCondition === 4) {
    frequencyMonths = 6;
  } else if (siteCondition === 3) {
    frequencyMonths = 12;
  } else {
    frequencyMonths = 24; // Default for 1, 2, or unknown
  }

  // Calculate recommended date
  const recommendedDate = new Date(lastDate);
  recommendedDate.setMonth(recommendedDate.getMonth() + frequencyMonths);

  // Calculate days until deadline
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  recommendedDate.setHours(0, 0, 0, 0);
  
  const daysUntilDeadline = Math.floor((recommendedDate - today) / (1000 * 60 * 60 * 24));
  
  // Determine status based on days until deadline
  let status, statusText, statusBadge;
  
  if (daysUntilDeadline < 0) {
    // Overdue
    status = 'alert';
    statusText = 'Utgått (må gjennomføres nå)';
    statusBadge = '🔴 Utgått';
  } else if (daysUntilDeadline <= 60) {
    // Warning: within 2 months
    status = 'warning';
    const daysText = daysUntilDeadline === 1 ? 'dag' : 'dager';
    statusText = `Må gjennomføres innen ${daysUntilDeadline} ${daysText}`;
    statusBadge = '🟡 Forfall snart';
  } else {
    // OK
    status = 'ok';
    const monthsText = Math.floor(daysUntilDeadline / 30);
    statusText = `OK - neste frist om ${monthsText} mnd`;
    statusBadge = '🟢 OK';
  }

  return {
    status,
    statusText,
    statusBadge,
    lastDate: lastDate.toLocaleDateString('no-NO'),
    siteCondition: siteCondition,
    siteConditionText: formatSiteConditionLabel(siteCondition),
    recommendedDate: recommendedDate.toLocaleDateString('no-NO'),
    daysUntilDeadline: daysUntilDeadline,
    infoText: statusText
  };
}

// Format site condition label
function formatSiteConditionLabel(condition) {
  const labels = {
    1: '1 - Meget god',
    2: '2 - God',
    3: '3 - Dårlig',
    4: '4 - Meget dårlig'
  };
  return labels[condition] || (condition ? String(condition) : 'Ikke oppgitt');
}

// Update facility details sidebar (NEW!)
async function updateFacilityDetailsSidebar(facility, assessment) {
  // 1. FACILITY DETAILS (sykdom, lusetall, fisk, produksjon, koordinater)
  const diseases = facility.diseases || facility.diseaseInfo?.diseases || [];
  const diseaseText = Array.isArray(diseases) && diseases.length > 0
    ? diseases.map(d => (typeof d === 'string' ? d : d.name || 'Ukjent')).join(', ')
    : 'Ingen registrert';

  const liceAdult = Number(facility?.lice?.adult_female_lice ?? facility.lice_count ?? facility.liceCount ?? facility.lice);
  const liceTotal = Number(facility?.lice?.total_lice);
  const fishCount = facility.fish_count ?? facility.fishCount ?? facility.fish;

  const fdir = facility.fdir || null;
  const productionText = fdir?.production_category || facility.production_type || facility.productionType || 'Laks';

  const liceDetailText = Number.isFinite(liceAdult)
    ? `Vaksne holus: ${liceAdult.toFixed(2)}${Number.isFinite(liceTotal) ? ` · Totalt: ${liceTotal.toFixed(2)}` : ''}`
    : 'Ikke oppgitt';

  updateDetailGroup('detailDiseases', diseaseText);
  updateDetailGroup('detailLice', liceDetailText);
  updateDetailGroup('detailFish', Number.isFinite(fishCount) ? `${fishCount.toLocaleString('no-NO')}` : 'Ikke oppgitt');
  updateDetailGroup('detailProduction', productionText);
  updateDetailGroup('detailCoords', `${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`);
  
  // 1.5 UPDATE B-SURVEY STATUS (NEW!)
  updateBSurveyStatusDisplay(fdir?.latest_b_survey);

  // 2. NEARBY INFECTED FACILITIES (15 km)
  updateNearbyInfectedList(assessment);

  // 2.3 LOCAL SMITTE RADIUS (10 km - yellow)
  updateLocalSmitteRadiusList(facility);

  // 2.4 BARENTSWATCH RISK FACILITIES (15 km - orange)
  updateBarentsWatchRiskList(facility);
  
  // 2.5 LICE FACILITIES (15 km - separate presentation)
  updateNearbyLiceList(facility);
  
  // 3. NEARBY RISK VESSELS (røde/oransje båter)
  await updateNearbyRiskVesselsList(facility);
  
  // 3.5 VESSEL ARRIVAL RISK (NEW!)
  await loadVesselArrivalRisk(facility);
}

// Helper to update detail group
function updateDetailGroup(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = String(value);
  }
}

// Update B-survey status display
function updateBSurveyStatusDisplay(bSurveyData) {
  const statusPanel = document.getElementById('bSurveyStatusPanel');
  if (!statusPanel) return;

  const bStatus = calculateBSurveyStatus(bSurveyData);
  
  // Update badge with correct status class
  const badge = document.getElementById('bSurveyStatusBadge');
  if (badge) {
    badge.textContent = bStatus.statusBadge;
    badge.className = `b-survey-status status-${bStatus.status}`;
  }
  
  // Update info text
  const infoEl = document.getElementById('bSurveyInfo');
  if (infoEl) {
    infoEl.textContent = bStatus.infoText;
  }
  
  // Update details
  const lastDateEl = document.getElementById('bSurveyLastDate');
  if (lastDateEl) {
    lastDateEl.textContent = bStatus.lastDate || '-';
  }
  
  const siteConditionEl = document.getElementById('bSurveySiteCondition');
  if (siteConditionEl) {
    siteConditionEl.textContent = bStatus.siteConditionText;
  }
  
  const recommendedDateEl = document.getElementById('bSurveyRecommendedDate');
  if (recommendedDateEl) {
    recommendedDateEl.textContent = bStatus.recommendedDate || '-';
  }
  
  const daysEl = document.getElementById('bSurveyDaysUntilDeadline');
  if (daysEl) {
    if (bStatus.daysUntilDeadline !== null) {
      if (bStatus.daysUntilDeadline < 0) {
        daysEl.textContent = `${Math.abs(bStatus.daysUntilDeadline)} dager OVERSKREDET`;
        daysEl.style.color = '#991b1b';
      } else if (bStatus.daysUntilDeadline <= 60) {
        daysEl.textContent = `${bStatus.daysUntilDeadline} dager`;
        daysEl.style.color = '#854d0e';
      } else {
        daysEl.textContent = `${bStatus.daysUntilDeadline} dager`;
        daysEl.style.color = '#065f46';
      }
    } else {
      daysEl.textContent = '-';
      daysEl.style.color = 'inherit';
    }
  }
}

// Update nearby infected facilities list
function updateNearbyInfectedList(assessment, facility = currentFacility) {
  const container = document.getElementById('nearbyInfectedList');
  const header = document.getElementById('nearbyInfectedHeader');
  
  // Safety safeguard: if container doesn't exist, exit early
  if (!container) {
    if (!updateNearbyInfectedList._missingContainerLogged) {
      console.info('[Facility] nearbyInfectedList container not found in DOM (optional panel).');
      updateNearbyInfectedList._missingContainerLogged = true;
    }
    return;
  }
  
  const radiusKm = FacilityMap.nearbyRadiusKm || 20;
  if (header) {
    const headerText = header.querySelector('.section-title');
    if (headerText) {
      headerText.textContent = `🔴 Smittede anlegg (${radiusKm} km)`;
    } else {
      header.textContent = `🔴 Smittede anlegg (${radiusKm} km)`;
    }
  }
  
  const nearbyInfected = assessment?.nearbyInfected && assessment.nearbyInfected.length > 0
    ? assessment.nearbyInfected
    : (facility ? FacilityData.findInfectedWithinDistance(facility.latitude, facility.longitude, radiusKm) : []);

  if (!nearbyInfected || nearbyInfected.length === 0) {
    container.innerHTML = `<p class="no-data">Ingen smittede anlegg innenfor ${radiusKm} km</p>`;
    return;
  }

  if (header) {
    const headerText = header.querySelector('.section-title');
    const label = `🔴 Smittede anlegg (${radiusKm} km) · ${nearbyInfected.length}`;
    if (headerText) {
      headerText.textContent = label;
    } else {
      header.textContent = label;
    }
  }
  
  container.innerHTML = '';
  
  nearbyInfected.forEach(infected => {
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const name = infected.facility?.name || infected.name || 'Ukjent anlegg';
    const distance = Number.isFinite(infected.distance) ? infected.distance.toFixed(1) : 'N/A';
    const diseases = infected.diseases || infected.facility?.diseases || [];
    const diseaseText = Array.isArray(diseases) && diseases.length > 0
      ? diseases.map(d => (typeof d === 'string' ? d : d.name || 'Ukjent')).join(', ')
      : 'Ukjent';
    
    item.innerHTML = `
      <div class="list-item-name">${name}</div>
      <div class="list-item-detail">${distance} km · ${diseaseText}</div>
    `;
    
    container.appendChild(item);
  });
}

// Update local smitte radius facilities list (yellow - 10 km from infected)
function updateLocalSmitteRadiusList(facility = currentFacility) {
  const container = document.getElementById('localSmitteRadiusList');
  const header = document.getElementById('localSmitteRadiusHeader');

  if (!container || !facility) return;

  const toggle = document.getElementById('toggleLocalSmitteRadius');
  const isEnabled = toggle && toggle.checked;

  // Get ALL facilities within 10km of any infected facility
  const allFacilitiesInGlobalRadius = FacilityData.getFacilitiesInLocalSmitteRadius(10);

  // But FILTER to only show those near the SELECTED facility (20 km radius)
  const facilitiesNearSelectedFacility = allFacilitiesInGlobalRadius.filter(entry => {
    if (!entry.facility || !entry.facility.latitude || !entry.facility.longitude) return false;
    
    const distToSelectedFacility = FacilityData.calculateDistance(
      facility.latitude,
      facility.longitude,
      entry.facility.latitude,
      entry.facility.longitude
    );
    
    // Only show if within 20 km of the selected facility
    return distToSelectedFacility <= 20;
  });

  if (!isEnabled || facilitiesNearSelectedFacility.length === 0) {
    const message = isEnabled 
      ? 'Ingen anlegg innenfor lokal smitteradius (10 km fra smittet) nær dette anlegget'
      : 'Slå på "Lokal smitteradius" for å se anlegg innenfor 10 km fra smittet';
    container.innerHTML = `<p class="no-data">${message}</p>`;
    return;
  }

  if (header) {
    const headerText = header.querySelector('.section-title');
    const label = `🟡 Lokal smitteradius (10 km) · ${facilitiesNearSelectedFacility.length}`;
    if (headerText) {
      headerText.textContent = label;
    } else {
      header.textContent = label;
    }
  }

  container.innerHTML = '';

  facilitiesNearSelectedFacility.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'list-item';

    const fac = entry.facility;
    const name = fac.name || fac.facility_name || 'Ukjent anlegg';
    
    const distToSelectedFacility = FacilityData.calculateDistance(
      facility.latitude,
      facility.longitude,
      fac.latitude,
      fac.longitude
    );

    // Style for local smitte radius (yellow)
    div.style.borderLeft = '3px solid #eab308';
    div.style.background = '#fef08a';

    div.innerHTML = `
      <div class="list-item-name">${name}</div>
      <div class="list-item-detail">${distToSelectedFacility.toFixed(1)} km · Innenfor 10 km av smittet</div>
    `;

    container.appendChild(div);
  });
}

// Update BarentsWatch risk facilities list (orange - Høy/Ekstrem risk level)
function updateBarentsWatchRiskList(facility = currentFacility) {
  const container = document.getElementById('barentsWatchRiskList');
  const header = document.getElementById('barentsWatchRiskHeader');

  if (!container || !facility) return;

  if (!facility.latitude || !facility.longitude) {
    container.innerHTML = '<p class="no-data">Facility has invalid coordinates</p>';
    return;
  }

  // Get BarentsWatch risk facilities within 15 km (Høy/Ekstrem)
  const bwRiskEntries = FacilityData.getBWRiskFacilitiesWithinDistance(
    facility.latitude,
    facility.longitude,
    15
  );

  if (!bwRiskEntries || bwRiskEntries.length === 0) {
    container.innerHTML = '<p class="no-data">Ingen BarentsWatch-fasiliteter (Høy/Ekstrem) innenfor 15 km</p>';
    if (header) {
      const headerText = header.querySelector('.section-title');
      if (headerText) headerText.textContent = '🟠 BarentsWatch risiko (15 km)';
    }
    return;
  }

  if (header) {
    const headerText = header.querySelector('.section-title');
    const label = `🟠 BarentsWatch risiko (15 km) · ${bwRiskEntries.length}`;
    if (headerText) {
      headerText.textContent = label;
    } else {
      header.textContent = label;
    }
  }

  container.innerHTML = '';

  bwRiskEntries.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'list-item';

    const risk = entry.risk;
    const name = risk.facility_name || 'Ukjent anlegg';
    const distance = entry.distance ? entry.distance.toFixed(1) : 'N/A';
    const riskLevel = risk.risk_level || 'Ukjent';

    // Style for BarentsWatch risk (orange)
    div.style.borderLeft = '3px solid #f97316';
    div.style.background = '#fed7aa';

    div.innerHTML = `
      <div class="list-item-name">${name}</div>
      <div class="list-item-detail">${distance} km · ${riskLevel} (BarentsWatch)</div>
    `;

    container.appendChild(div);
  });
}

function updateNearbyLiceList(facility = currentFacility) {
  const container = document.getElementById('nearbyLiceList');
  const header = document.getElementById('nearbyLiceHeader');

  if (!container || !facility || !Number.isFinite(facility.latitude) || !Number.isFinite(facility.longitude)) return;

  const radiusKm = 15;
  const nearby = (FacilityData.facilities || [])
    .filter(f => f && Number.isFinite(f.latitude) && Number.isFinite(f.longitude))
    .filter(f => String(f.localityNo || f.code || '') !== String(facility.localityNo || facility.code || ''))
    .map(f => {
      const distance = FacilityData.calculateDistance(facility.latitude, facility.longitude, f.latitude, f.longitude);
      const liceAdult = Number(f?.lice?.adult_female_lice ?? f.lice_count ?? f.liceCount ?? f.lice);
      const liceTotal = Number(f?.lice?.total_lice);
      const high = f.lice_over_threshold === true || f?.lice?.over_threshold === true;
      return { facility: f, distance, liceAdult, liceTotal, high };
    })
    .filter(item => item.distance <= radiusKm && (Number.isFinite(item.liceAdult) || Number.isFinite(item.liceTotal)))
    .sort((a, b) => {
      const aScore = Number.isFinite(a.liceAdult) ? a.liceAdult : -1;
      const bScore = Number.isFinite(b.liceAdult) ? b.liceAdult : -1;
      return bScore - aScore;
    })
    .slice(0, 10);

  if (header) {
    const label = `🧪 Nærliggende lusenivå (${radiusKm} km)${nearby.length ? ` · ${nearby.length}` : ''}`;
    const headerText = header.querySelector('.section-title');
    if (headerText) headerText.textContent = label;
    else header.textContent = label;
  }

  if (nearby.length === 0) {
    container.innerHTML = `<p class="no-data">Ingen lusedata innenfor ${radiusKm} km</p>`;
    return;
  }

  container.innerHTML = '';
  nearby.forEach(item => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.borderLeft = item.high ? '3px solid #dc2626' : '3px solid #16a34a';
    div.style.background = item.high ? '#fee2e2' : '#dcfce7';

    const name = item.facility.name || 'Ukjent anlegg';
    const adultText = Number.isFinite(item.liceAdult) ? item.liceAdult.toFixed(2) : 'N/A';
    const totalText = Number.isFinite(item.liceTotal) ? item.liceTotal.toFixed(2) : 'N/A';
    const status = item.high ? 'over terskel' : 'under terskel';

    div.innerHTML = `
      <div class="list-item-name">${name}</div>
      <div class="list-item-detail">${item.distance.toFixed(1)} km · holus: ${adultText} · total: ${totalText} (${status})</div>
    `;
    container.appendChild(div);
  });
}

// Update nearby risk vessels list
async function updateNearbyRiskVesselsList(facility) {
  const container = document.getElementById('nearbyVesselsRiskList');

  if (!container) return; // element may not exist yet during early init

  if (!facility) {
    container.innerHTML = '<p class="no-data">Ingen risiko-båter detektert</p>';
    return;
  }
  
  container.innerHTML = '';

  const radiusKm = FacilityMap.nearbyRadiusKm || 20;
  const candidates = FacilityData.findVesselsWithinDistance(
    facility.latitude,
    facility.longitude,
    radiusKm
  ).slice(0, 20);

  const statuses = await Promise.all(
    candidates.map(async item => {
      const details = await FacilityData.getVesselStatusDetails(item.vessel.mmsi);
      return { ...item, status: details.status, reason: details.reason };
    })
  );

  const riskVessels = statuses.filter(item =>
    ['quarantine', 'caution', 'not-cleared'].includes(item.status)
  );

  if (riskVessels.length === 0) {
    container.innerHTML = '<p class="no-data">Ingen risiko-båter detektert</p>';
    return;
  }

  // Show first 5 risk vessels
  riskVessels.slice(0, 5).forEach(item => {
    const vessel = item.vessel;
    const itemEl = document.createElement('div');
    itemEl.className = 'vessel-item';

    const status = item.status;
    const color = status === 'quarantine' ? '🟠' : (status === 'caution' ? '🟡' : '🔴');
    const label = status === 'quarantine'
      ? 'Karantene'
      : (status === 'caution' ? 'Forsiktig' : 'Risiko');
    const distance = Number.isFinite(item.distance) ? item.distance.toFixed(1) : '--';
    const reason = item.reason || '';

    itemEl.innerHTML = `
      <div class="vessel-item-name">${color} ${vessel.name || `MMSI ${vessel.mmsi}`}</div>
      <div class="vessel-item-detail">${label} · ${distance} km</div>
      ${reason ? `<div class="vessel-item-reason">Hvorfor: ${reason}</div>` : ''}
    `;

    container.appendChild(itemEl);
  });
}

// Load vessel arrival risk (new API endpoint - vessel cross-contamination detection)
async function loadVesselArrivalRisk(facility) {
  const container = document.getElementById('vesselArrivalRiskPanel');
  const summaryContainer = document.getElementById('vesselArrivalRiskSummary');
  const criticalContainer = document.getElementById('vesselArrivalRiskCritical');
  const cautionContainer = document.getElementById('vesselArrivalRiskCaution');
  
  if (!container) return;
  
  try {
    // Get facility code
    const facilityCode = facility.code || facility.localityNo || facility.locality_no;
    if (!facilityCode) {
      summaryContainer.innerHTML = '<p class="no-data">Anlegget har ingen kode</p>';
      return;
    }
    
    // Call new API endpoint
    const response = await fetch(`${API_BASE}/api/facilities/${facilityCode}/vessel-arrival-risk`);
    
    if (!response.ok) {
      summaryContainer.innerHTML = '<p class="no-data">Kunne ikke hente vessel-risiko data</p>';
      console.error('Vessel arrival risk error:', response.status);
      return;
    }
    
    const data = await response.json();
    
    // Clear containers
    summaryContainer.innerHTML = '';
    criticalContainer.innerHTML = '';
    cautionContainer.innerHTML = '';
    
    // Show high attention alerts (advisory only)
    if (data.critical_alerts && data.critical_alerts.length > 0) {
      criticalContainer.innerHTML = '<h4 style="color: #dc2626; margin-bottom: 8px;">⛔ Hoy oppmerksomhet - nylige besok</h4>';
      data.critical_alerts.forEach(vessel => {
        const alert = document.createElement('div');
        alert.className = 'vessel-alert critical';
        alert.style.cssText = 'background: #fee2e2; border-left: 4px solid #dc2626; padding: 10px; margin-bottom: 8px; border-radius: 4px;';
        
        const recentVisit = vessel.infected_visits?.[0];
        const hoursAgo = recentVisit?.hours_ago || '?';
        const facilityName = recentVisit?.facility_name || 'Infected facility';
        
        alert.innerHTML = `
          <div style="font-weight: bold; color: #dc2626;">🚨 ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
          <div style="font-size: 0.9em; color: #7f1d1d; margin-top: 4px;">
            Besok hos ${facilityName} for ${hoursAgo} timer siden
          </div>
          <div style="font-size: 0.85em; color: #991b1b; margin-top: 6px; font-style: italic;">
            ${vessel.risk_assessment?.recommendation || 'Karantenetid trolig ikke tilfredsstilt. Vurder tiltak.'}
          </div>
        `;
        criticalContainer.appendChild(alert);
      });
    }
    
    // Show caution alerts (advisory only)
    if (data.caution_alerts && data.caution_alerts.length > 0) {
      cautionContainer.innerHTML = '<h4 style="color: #f97316; margin-bottom: 8px;">⚠️ Forvarsel - nylige besok</h4>';
      data.caution_alerts.forEach(vessel => {
        const alert = document.createElement('div');
        alert.className = 'vessel-alert caution';
        alert.style.cssText = 'background: #ffedd5; border-left: 4px solid #f97316; padding: 10px; margin-bottom: 8px; border-radius: 4px;';
        
        const recentVisit = vessel.infected_visits?.[0];
        const hoursAgo = recentVisit?.hours_ago || '?';
        const facilityName = recentVisit?.facility_name || 'Infected facility';
        
        alert.innerHTML = `
          <div style="font-weight: bold; color: #f97316;">⚠️ ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
          <div style="font-size: 0.9em; color: #92400e; margin-top: 4px;">
            Besok hos ${facilityName} for ${hoursAgo} timer siden
          </div>
          <div style="font-size: 0.85em; color: #b45309; margin-top: 6px; font-style: italic;">
            ${vessel.risk_assessment?.recommendation || 'Vurder desinfeksjon og ekstra kontroll.'}
          </div>
        `;
        cautionContainer.appendChild(alert);
      });
    }
    
    // Show summary
    if (data.critical_alerts?.length === 0 && data.caution_alerts?.length === 0) {
      summaryContainer.innerHTML = `<p class="no-data">✓ Ingen nylige besok som gir indikasjoner for ${facility.name}</p>`;
    } else {
      summaryContainer.innerHTML = `
        <p style="font-size: 0.9em; color: #6b7280; margin-top: 8px;">
          <strong>${data.summary.total_recent_vessels}</strong> båter besøkt siste 72 timer · 
          <strong>${data.critical_alerts?.length || 0}</strong> hoy oppmerksomhet · 
          <strong>${data.caution_alerts?.length || 0}</strong> forvarsel
        </p>
      `;
    }
    
    
  } catch (error) {
    console.error('Error loading vessel arrival risk:', error);
    summaryContainer.innerHTML = '<p class="no-data">Feil ved lasting av vessel-risiko</p>';
  }
}

// Update factors table (section 2)
function updateFactorsTable(assessment) {
  const tbody = document.getElementById('factorsBody');
  
  if (!assessment || !assessment.factors || assessment.factors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2">Ingen risikofaktorer identifisert</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';

  if (Number.isFinite(assessment.nearbyVesselsCount)) {
    const tr = document.createElement('tr');
    const tdFactor = document.createElement('td');
    const tdStatus = document.createElement('td');

    tdFactor.textContent = 'Båter innenfor radius (AIS)';
    tdStatus.textContent = String(assessment.nearbyVesselsCount);
    tdStatus.className = 'status-info';

    tr.appendChild(tdFactor);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  }
  
  assessment.factors.forEach(factor => {
    const tr = document.createElement('tr');
    
    const tdFactor = document.createElement('td');
    tdFactor.textContent = factor.factor;
    
    const tdStatus = document.createElement('td');
    tdStatus.textContent = factor.status;
    tdStatus.className = `status-${factor.severity}`;

    if (factor.details) {
      const details = document.createElement('div');
      details.className = 'factor-details';
      details.textContent = factor.details;
      tdStatus.appendChild(details);
    }
    
    tr.appendChild(tdFactor);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
}

// Update visits list (section 3) - NOW USING LIVE AIS DATA
async function updateVisitsList(facility) {
  const container = document.getElementById('visitsList');
  const recentVisitsEl = document.getElementById('recentVisits');
  if (!container) return;
  
  container.innerHTML = '<p class="no-data" style="color: #6b7280;">Henter besøk...</p>';
  
  try {
    // Refresh audit log to get latest visits
    await FacilityData.loadAuditLog();
    
    // Get visits from audit log for this facility (48 hours)
    const facilityVisits = FacilityData.getFacilityVisits(facility.name, 2);
    
    if (!facilityVisits || facilityVisits.length === 0) {
      container.innerHTML = '<p class="no-data">Ingen registrerte besøk siste 48 timer</p>';
      if (recentVisitsEl) recentVisitsEl.textContent = '0';
      return;
    }
    
    container.innerHTML = '';
    
    // Show visits (from audit log)
    facilityVisits.forEach(visit => {
      const card = document.createElement('div');
      card.className = 'visit-card';
      
      const vesselName = visit.vessel_name || `MMSI: ${visit.mmsi || 'Ukjent'}`;
      const visitDate = visit.visit_timestamp ? new Date(visit.visit_timestamp).toLocaleString('no-NO') : 'Ukjent tid';
      
      // Determine risk level badge color based on disease types
      const hasDisease = visit.disease_types && Array.isArray(visit.disease_types) && visit.disease_types.length > 0;
      const badgeColor = hasDisease ? '#dc2626' : '#f59e0b';
      const badgeText = hasDisease ? '🔴 Smitte' : '⚠️ Risiko';
      
      card.innerHTML = `
        <div class="visit-field">
          <span class="visit-field-label">Båt</span>
          <span class="visit-field-value">${vesselName}</span>
        </div>
        <div class="visit-field">
          <span class="visit-field-label">Tid</span>
          <span class="visit-field-value">${visitDate}</span>
        </div>
        <div class="visit-field">
          <span class="visit-field-label">Status</span>
          <span class="visit-field-value" style="color: ${badgeColor};">${badgeText}</span>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    if (recentVisitsEl) recentVisitsEl.textContent = String(facilityVisits.length);
    
  } catch (error) {
    console.error('Error loading visits:', error);
    container.innerHTML = '<p class="no-data">Feil ved lasting av besøk</p>';
    if (recentVisitsEl) recentVisitsEl.textContent = '-';
  }
}

// Update recommendations (section 4)
function updateRecommendations(assessment) {
  const container = document.getElementById('recommendationsList');
  if (!container) return;
  
  if (!assessment || !assessment.recommendations || assessment.recommendations.length === 0) {
    container.innerHTML = '<p class="no-data">Ingen spesifikke anbefalinger</p>';
    return;
  }
  
  container.innerHTML = '';
  
  assessment.recommendations.forEach(rec => {
    const card = document.createElement('div');
    card.className = `recommendation-card ${rec.type}`;
    
    let html = `
      <div class="recommendation-title">${rec.title}</div>
      <div class="recommendation-text">${rec.text}</div>
    `;
    
    // Add reason if available
    if (rec.reason) {
      html += `<div class="recommendation-reason">Hvorfor: ${rec.reason}</div>`;
    }
    
    card.innerHTML = html;
    container.appendChild(card);
  });
}

// Reset dashboard to initial state
function resetDashboard() {
  currentFacility = null;
  currentAssessment = null;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const setHtml = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  };

  setText('facilityName', 'Velg et anlegg');
  const facilityCodeEl = document.getElementById('facilityCodeIndicator');
  if (facilityCodeEl) {
    facilityCodeEl.textContent = 'ID: -';
  }
  setHtml('riskStatus', '<span class="risk-badge">-</span>');
  setText('nearbyInfected', '-');
  setText('closestDistance', '-');
  setText('recentVisits', '-');
  const bwRiskEl = document.getElementById('nearbyBWRisk');
  if (bwRiskEl) {
    bwRiskEl.textContent = '-';
  }
  const currentFlowEl = document.getElementById('currentFlow');
  if (currentFlowEl) {
    currentFlowEl.textContent = '-';
  }
  
  // Reset sidebar details
  setText('detailDiseases', '-');
  setText('detailLice', '-');
  setText('detailFish', '-');
  setText('detailProduction', '-');
  const detailBSurvey = document.getElementById('detailBSurvey');
  if (detailBSurvey) {
    detailBSurvey.textContent = '-';
  }
  setText('detailCoords', '-');
  
  setHtml('nearbyInfectedList', '<p class="no-data">Velg et anlegg for å se smittede i området</p>');
  setHtml('barentsWatchRiskList', '<p class="no-data">Velg et anlegg for å se risikofasiliteter (Høy/Ekstrem)</p>');
  const nearbyLiceList = document.getElementById('nearbyLiceList');
  if (nearbyLiceList) {
    nearbyLiceList.innerHTML = '<p class="no-data">Velg et anlegg for å se lusedata i nærheten</p>';
  }
  setHtml('localSmitteRadiusList', '<p class="no-data">Slå på "Lokal smitteradius" for å se anlegg innenfor 10 km fra smittet</p>');
  const bwRiskList = document.getElementById('nearbyBWRiskList');
  if (bwRiskList) {
    bwRiskList.innerHTML = '<p class="no-data">Ingen BW-risiko innenfor 15 km</p>';
  }
  setHtml('nearbyVesselsRiskList', '<p class="no-data">Ingen båter detektert</p>');
  
  setHtml('factorsBody', '<tr><td colspan="2">Velg et anlegg for å se risikofaktorer</td></tr>');

  const visitsList = document.getElementById('visitsList');
  if (visitsList) {
    visitsList.innerHTML = '<p class="no-data">Velg et anlegg for å se besøkshistorikk</p>';
  }

  const recommendationsList = document.getElementById('recommendationsList');
  if (recommendationsList) {
    recommendationsList.innerHTML = '<p class="no-data">Velg et anlegg for å se anbefalinger</p>';
  }

  const nearbyRiskSection = document.getElementById('nearbyRiskSection');
  const nearbyRiskList = document.getElementById('nearbyRiskList');
  if (nearbyRiskSection) {
    nearbyRiskSection.style.display = 'none';
  }
  if (nearbyRiskList) {
    nearbyRiskList.innerHTML = '';
  }

  FacilityMap.displayAllFacilities();
  updateMapStatus();
  disableActionButtons();
}

function updateMapStatus() {
  const statusEl = document.getElementById('mapStatus');
  if (!statusEl) return;

  if (!currentFacility) {
    statusEl.textContent = 'Velg et anlegg for å se båter i området.';
    return;
  }

  const count = FacilityMap.lastNearbyVesselsCount || 0;
  const radiusKm = FacilityMap.nearbyRadiusKm || 20;

  let sourceText = 'AIS';
  if (FacilityData.vesselsSource === 'confirmed_plans_fallback') {
    sourceText = 'Planlagte båter (AIS utilgjengelig)';
  } else if (FacilityData.vesselsSource === 'error') {
    sourceText = 'AIS utilgjengelig';
  }

  statusEl.textContent = `${count} båt(er) innenfor ${radiusKm} km · Kilde: ${sourceText}`;
}

// Enable action buttons when facility is selected
function enableActionButtons() {
  document.getElementById('btnLogEvent').disabled = false;
  document.getElementById('btnSendAlert').disabled = false;
  document.getElementById('btnSetQuarantine').disabled = false;
  document.getElementById('btnGenerateReport').disabled = false;
}

// Disable action buttons
function disableActionButtons() {
  document.getElementById('btnLogEvent').disabled = true;
  document.getElementById('btnSendAlert').disabled = true;
  document.getElementById('btnSetQuarantine').disabled = true;
  document.getElementById('btnGenerateReport').disabled = true;
}

// Action button handlers

async function handleLogEvent() {
  if (!currentFacility) return;
  
  const eventType = prompt('Velg hendelsestype:\n1. Prøvetaking\n2. Behandling\n3. Inspeksjon\n4. Annet', '1');
  
  if (!eventType) return;
  
  const eventTypes = {
    '1': 'Prøvetaking',
    '2': 'Behandling',
    '3': 'Inspeksjon',
    '4': 'Annet'
  };
  
  const type = eventTypes[eventType] || 'Annet';
  const notes = prompt(`Notater for ${type}:`, '');
  
  if (notes === null) return;
  
  const logEntry = {
    facility: currentFacility.name,
    facility_code: currentFacility.code || currentFacility.localityNo || currentFacility.locality_no,
    type: type,
    notes: notes,
    timestamp: new Date().toISOString(),
    responsible: 'Dashboard-bruker'
  };
  
  
  try {
    const response = await fetch(`${API_BASE}/api/facility/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      showSuccessToast('Hendelse logget', `${type} ble lagret (ID: ${result.event_id}).`);
    } else {
      throw new Error(result.message || 'Ukjent feil');
    }
  } catch (error) {
    console.error('Feil ved logging:', error);
    showErrorToast('Feil ved logging', `Kunne ikke lagre hendelse: ${error.message}`);
  }
}

async function handleSendAlert() {
  if (!currentFacility || !currentAssessment) return;
  
  const visitsLast72h = FacilityData.getFacilityVisits(currentFacility.name, 3);
  
  if (visitsLast72h.length === 0) {
    showInfoToast('Ingen nylige besøk', 'Ingen båter har besøkt anlegget de siste 72 timene.');
    return;
  }
  
  const vessels = [...new Set(visitsLast72h.map(v => v.vessel_name).filter(Boolean))];
  
  const message = `VARSEL fra ${currentFacility.name}:\n\n` +
    `Risikostatus: ${currentAssessment.riskLevel}\n` +
    `${currentAssessment.riskExplanation.join(' • ')}\n\n` +
    `Dette varselet ville bli sendt til:\n${vessels.join(', ')}`;
  
  if (confirm(message + '\n\nSend varsel?')) {
    
    const alertData = {
      facility: currentFacility.name,
      facility_code: currentFacility.code || currentFacility.localityNo || currentFacility.locality_no,
      vessels: vessels,
      message: message,
      priority: currentAssessment.riskLevel === 'HØY' || currentAssessment.riskLevel === 'EKSTREM' ? 'high' : 'medium',
      sent_by: 'Dashboard-bruker'
    };
    
    try {
      const response = await fetch(`${API_BASE}/api/facility/send-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      
      const result = await response.json();
      
      if (result.status === 'ok') {
        showSuccessToast('Varsel logget', `Varsel registrert for ${vessels.length} båt(er) (ID: ${result.alert_id}).`);
      } else {
        throw new Error(result.message || 'Ukjent feil');
      }
    } catch (error) {
      console.error('Feil ved sending av varsel:', error);
      showErrorToast('Feil ved varsling', `Kunne ikke sende varsel: ${error.message}`);
    }
  }
}

async function handleSetQuarantine() {
  if (!currentFacility) return;
  
  const days = prompt('Antall dager karantene:', '14');
  
  if (!days || isNaN(days)) return;
  
  const reason = prompt('Årsak til karantene:', 'Smitterisiko');
  
  if (!reason) return;
  
  const quarantineData = {
    facility: currentFacility.name,
    facility_code: currentFacility.code || currentFacility.localityNo || currentFacility.locality_no,
    days: parseInt(days),
    reason: reason,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString(),
    set_by: 'Dashboard-bruker'
  };
  
  
  try {
    const response = await fetch(`${API_BASE}/api/facility/set-quarantine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quarantineData)
    });
    
    const result = await response.json();
    
    if (result.status === 'ok') {
      showSuccessToast('Karantene opprettet', `${days} dager (ID: ${result.quarantine_id}). Sluttdato: ${new Date(result.end_date).toLocaleDateString('no-NO')}.`);
    } else {
      throw new Error(result.message || 'Ukjent feil');
    }
  } catch (error) {
    console.error('Feil ved setting av karantene:', error);
    showErrorToast('Feil ved karantene', `Kunne ikke sette karantene: ${error.message}`);
  }
}

function handleGenerateReport() {
  if (!currentFacility || !currentAssessment) return;
  
  // Generate report text
  const reportText = `
BIOSIKKERHETSRAPPORT
Anlegg: ${currentFacility.name}
Generert: ${new Date().toLocaleDateString('no-NO')}

RISIKOSTATUS: ${currentAssessment.riskLevel}
${currentAssessment.riskExplanation.join('\n')}

RISIKOFAKTORER:
${currentAssessment.factors.map(f => `- ${f.factor}: ${f.status}`).join('\n')}

ANBEFALINGER:
${currentAssessment.recommendations.map(r => `- ${r.title}: ${r.text}`).join('\n')}

BESØK SISTE 30 DAGER:
${FacilityData.getFacilityVisits(currentFacility.name, 30).length} registrerte besøk
  `.trim();
  
  
  // Create download
  const blob = new Blob([reportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_${currentFacility.name}_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  showSuccessToast('Rapport klar', 'Rapporten er lastet ned.');
}

// Start periodic proximity checks (every 15 minutes)
function startPeriodicProximityChecks() {
  // NOTE: No immediate run – vessels + quarantines are loaded on demand when a facility is selected.
  // The first real run happens inside updateDashboard().

  // Then run every 15 minutes
  setInterval(async () => {
    if (!currentFacility) return; // Skip if no facility is selected
    try {
      await FacilityData.checkProximityToInfectedFacilities();
      await FacilityData.loadActiveQuarantines();
      
      // If a facility is selected, refresh its vessel display
      if (currentFacility) {
        // Refresh the active quarantines list for current display
        FacilityMap.refreshVesselMarkers();
      }
    } catch (error) {
      console.warn('⚠️ Periodic proximity check failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

// Setup facility dashboard auto-load for AutoLoadManager
function setupFacilityDashboardAutoLoad() {
  if (typeof AutoLoadManager !== 'undefined' && currentFacility) {
    const refreshFacilityData = async () => {
      if (currentFacility) {
        try {
          await updateDashboard(currentFacility);
        } catch (error) {
          console.warn('⚠️ Facility dashboard auto-refresh failed:', error);
        }
      }
    };
    AutoLoadManager.registerPanel('facility-dashboard', refreshFacilityData);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setTimeout(() => setupFacilityDashboardAutoLoad(), 1000);
  });
} else {
  init();
  setTimeout(() => setupFacilityDashboardAutoLoad(), 1000);
}

// Show route planner warnings (BETA feature)
async function showRoutePlannerWarnings() {
  // Use global API_BASE from facility-data.js (auto-detects Render vs localhost)
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'routePlannerModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 2rem;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 2px solid #fbbf24; padding-bottom: 1rem;">
      <h2 style="margin: 0; color: #f59e0b;">🧪 Ruteplanlegger BETA</h2>
      <button onclick="closeRoutePlannerModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280;">✕</button>
    </div>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
      <p style="margin: 0; font-size: 0.9rem; color: #92400e;">
        <strong>⚠️ Advarsel:</strong> Dette er estimater basert på planlagte ruter, ikke live GPS/AIS-data. 
        Bruk denne funksjonen kun for planlegging. For nøyaktig risiko, se "Nærliggende båter" som bruker live AIS-data.
      </p>
    </div>
    
    <!-- Vessel Arrival Risk Section -->
    <div id="routePlannerArrivalRisk" style="margin-bottom: 1.5rem;">
      <h3 style="margin: 0 0 0.5rem 0; color: #dc2626; font-size: 1.1rem;">⚠️ Båter som ankommer (basert på planer)</h3>
      <div id="betaCriticalAlerts"></div>
      <div id="betaCautionAlerts"></div>
      <div id="betaArrivalSummary" style="color: #6b7280; font-size: 0.9rem; margin-top: 0.5rem;">Laster...</div>
    </div>
    
    <!-- Route Plans Section -->
    <div id="routePlannerWarningsContent" style="padding: 1rem; border-top: 2px solid #e5e7eb; margin-top: 1rem;">
      <h3 style="margin: 0 0 0.5rem 0; color: #374151; font-size: 1.1rem;">📋 Planlagte besøk til dette anlegget</h3>
      <p style="color: #6b7280; text-align: center;">Laster planlagte ruter...</p>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Load vessel arrival risk data
  try {
    const facilityCode = currentFacility.code || currentFacility.localityNo || currentFacility.locality_no;
    if (facilityCode) {
      const arrivalResponse = await fetch(`${API_BASE}/api/facilities/${facilityCode}/vessel-arrival-risk`);
      if (arrivalResponse.ok) {
        const arrivalData = await arrivalResponse.json();
        
        const criticalDiv = document.getElementById('betaCriticalAlerts');
        const cautionDiv = document.getElementById('betaCautionAlerts');
        const summaryDiv = document.getElementById('betaArrivalSummary');
        
        // Show critical alerts
        if (arrivalData.critical_alerts && arrivalData.critical_alerts.length > 0) {
          let criticalHTML = '<h4 style="color: #dc2626; margin: 0.5rem 0; font-size: 0.95rem;">⛔ Høy oppmerksomhet - nylige besøk</h4>';
          arrivalData.critical_alerts.forEach(vessel => {
            const recentVisit = vessel.infected_visits?.[0];
            const hoursAgo = recentVisit?.hours_ago || '?';
            const facilityName = recentVisit?.facility_name || 'Smittet anlegg';
            
            criticalHTML += `
              <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px;">
                <div style="font-weight: bold; color: #dc2626;">🚨 ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
                <div style="font-size: 0.85rem; color: #7f1d1d; margin-top: 0.25rem;">
                  Besøk hos ${facilityName} for ${hoursAgo} timer siden
                </div>
                <div style="font-size: 0.8rem; color: #991b1b; margin-top: 0.5rem; font-style: italic;">
                  ${vessel.risk_assessment?.recommendation || 'Karantenetid trolig ikke tilfredsstilt'}
                </div>
              </div>
            `;
          });
          criticalDiv.innerHTML = criticalHTML;
        }
        
        // Show caution alerts
        if (arrivalData.caution_alerts && arrivalData.caution_alerts.length > 0) {
          let cautionHTML = '<h4 style="color: #f97316; margin: 0.5rem 0; font-size: 0.95rem;">⚠️ Forvarsel - nylige besøk</h4>';
          arrivalData.caution_alerts.forEach(vessel => {
            const recentVisit = vessel.infected_visits?.[0];
            const hoursAgo = recentVisit?.hours_ago || '?';
            const facilityName = recentVisit?.facility_name || 'Smittet anlegg';
            
            cautionHTML += `
              <div style="background: #ffedd5; border-left: 4px solid #f97316; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px;">
                <div style="font-weight: bold; color: #f97316;">⚠️ ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
                <div style="font-size: 0.85rem; color: #92400e; margin-top: 0.25rem;">
                  Besøk hos ${facilityName} for ${hoursAgo} timer siden
                </div>
                <div style="font-size: 0.8rem; color: #b45309; margin-top: 0.5rem; font-style: italic;">
                  ${vessel.risk_assessment?.recommendation || 'Vurder desinfeksjon'}
                </div>
              </div>
            `;
          });
          cautionDiv.innerHTML = cautionHTML;
        }
        
        // Show summary
        if (arrivalData.critical_alerts?.length === 0 && arrivalData.caution_alerts?.length === 0) {
          summaryDiv.innerHTML = '✓ Ingen nylige besøk som gir indikasjoner';
        } else {
          summaryDiv.innerHTML = `
            <strong>${arrivalData.summary.total_recent_vessels}</strong> båter besøkt siste 72t · 
            <strong>${arrivalData.critical_alerts?.length || 0}</strong> høy oppmerksomhet · 
            <strong>${arrivalData.caution_alerts?.length || 0}</strong> forvarsel
          `;
        }
      }
    }
  } catch (error) {
    console.warn('Could not load arrival risk in BETA modal:', error);
    document.getElementById('betaArrivalSummary').innerHTML = 'Kunne ikke laste ankomst-data';
  }
  
  // Load confirmed plans for warnings
  try {
    if (!currentFacility) {
      document.getElementById('routePlannerWarningsContent').innerHTML = '<p style="color: #6b7280; text-align: center;">Velg et anlegg først</p>';
      return;
    }
    
    const response = await fetch(`${API_BASE}/api/data/confirmed_plans`);
    if (!response.ok) {
      throw new Error('Could not load confirmed plans');
    }
    
    const plans = await response.json();
    
    if (!plans || plans.length === 0) {
      document.getElementById('routePlannerWarningsContent').innerHTML = '<p style="color: #6b7280; text-align: center;">Ingen planlagte ruter funnet</p>';
      return;
    }
    
    // Check which plans intersect with current facility
    const warnings = [];
    
    plans.forEach(plan => {
      if (!plan.route) return;
      
      plan.route.forEach(day => {
        if (!day.facilities) return;
        
        const matchingFacility = day.facilities.find(f => 
          f.id === currentFacility.localityNo || 
          f.name?.toLowerCase() === currentFacility.name?.toLowerCase()
        );
        
        if (matchingFacility) {
          warnings.push({
            vessel: plan.vessel_name || `MMSI: ${plan.mmsi}`,
            mmsi: plan.mmsi,
            date: day.date,
            day: day.day,
            facility: matchingFacility,
            hasInfected: day.has_infected,
            needsQuarantine: day.needs_quarantine,
            plan_id: plan.plan_id
          });
        }
      });
    });
    
    if (warnings.length === 0) {
      document.getElementById('routePlannerWarningsContent').innerHTML = `
        <p style="color: #6b7280; text-align: center;">
          Ingen planlagte besøk funnet for <strong>${currentFacility.name}</strong>
        </p>
      `;
      return;
    }
    
    // Sort by date
    warnings.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let html = `<p style="color: #374151; margin-bottom: 1rem; font-weight: 600;">
      Planlagte besøk til ${currentFacility.name}: ${warnings.length}
    </p>`;
    
    warnings.forEach(warning => {
      const dateObj = new Date(warning.date);
      const dateStr = dateObj.toLocaleDateString('no-NO');
      
      html += `
        <div style="border: 2px solid ${warning.hasInfected ? '#ef4444' : '#e5e7eb'}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: ${warning.hasInfected ? '#fef2f2' : 'white'};">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">🚢 ${warning.vessel}</h4>
              <p style="margin: 0.25rem 0; font-size: 0.85rem; color: #6b7280;">MMSI: ${warning.mmsi} · Plan ID: ${warning.plan_id}</p>
              <p style="margin: 0.25rem 0; font-size: 0.85rem;"><strong>Planlagt dato:</strong> ${dateStr} (Dag ${warning.day})</p>
            </div>
          </div>
          ${warning.needsQuarantine ? '<p style="margin: 0.5rem 0; padding: 0.5rem; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 0.85rem;"><strong>⚠️ Karantene påkrevd etter ruten</strong></p>' : ''}
          ${warning.hasInfected ? '<p style="margin: 0.5rem 0; padding: 0.5rem; background: #fee2e2; border-left: 3px solid #ef4444; font-size: 0.85rem;"><strong>🔴 Ruten inkluderer smittede/risikoanlegg</strong></p>' : ''}
        </div>
      `;
    });
    
    document.getElementById('routePlannerWarningsContent').innerHTML = html;
    
  } catch (error) {
    console.error('Error loading route planner warnings:', error);
    document.getElementById('routePlannerWarningsContent').innerHTML = '<p style="color: #ef4444; text-align: center;">Feil ved lasting av rutedata</p>';
  }
}

function closeRoutePlannerModal() {
  const modal = document.getElementById('routePlannerModal');
  if (modal) modal.remove();
}

// ========== DIAGNOSTIC TOOLS ==========
// Call from browser console: testAisApi()
window.testAisApi = async function() {
  const apiBase = 'http://localhost:8000';
  const endpoint = `${apiBase}/api/vessels`;

  try {
    const url = `${endpoint}?limit=10000`;
    const response = await fetch(url);

    console.log('✅ API Test response:', {
      status: response.status,
      ok: response.ok,
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length')
    });

    const data = await response.json();
    console.log(`✅ API returned ${data.vessels?.length || 0} vessels`);

    if (Array.isArray(data.vessels) && data.vessels.length > 0) {
      data.vessels.slice(0, 3).forEach((v, i) => {
        console.log(`Vessel ${i + 1}:`, v);
      });
    }

    return data;
  } catch (error) {
    console.error('❌ API Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Force reload vessels (clears cache)
window.forceReloadVessels = window.forcReloadVessels = async function() {
  FacilityData.vessels = [];
  FacilityData.lastVesselsFetch = 0;
  await FacilityData.loadVessels();
  console.log(`🔄 Reloaded ${FacilityData.vessels.length || 0} vessels`);
};

// Show current vessel status
window.showVesselStatus = function() {
  console.log(`🚢 Cached vessels: ${FacilityData.vessels.length || 0}`);
  if (FacilityData.vessels.length > 0) {
    FacilityData.vessels.slice(0, 5).forEach((v, i) => {
      console.log(`Vessel ${i + 1}:`, v);
    });
  }
};


// ============================================================================
// RISK EXPLANATION MODAL
// ============================================================================

/**
 * Show risk explanation modal for current facility
 * Transforms assessment data into modal format
 */
function handleShowRiskExplanation() {
  if (!currentFacility || !currentAssessment) {
    showInfoToast('Velg anlegg', 'Velg et anlegg først for å se forklaring.');
    return;
  }
  
  // Transform assessment data into modal format
  const riskFactors = {
    overallRisk: getRiskColor(currentAssessment.status),
    confirmedDisease: currentAssessment.status === 'infected',
    diseaseType: currentAssessment.factors.find(f => f.factor === 'Smittet anlegg')?.status || null,
    inBarentsWatchZone: currentAssessment.riskData?.risk_level === 'Ekstrem' || currentAssessment.riskData?.risk_level === 'Høy',
    bwZoneType: currentAssessment.riskData?.risk_level === 'Ekstrem' ? 'protection' : 'surveillance',
    nearbyInfected: currentAssessment.nearbyInfected?.length || 0,
    closestDistance: currentAssessment.closestInfected ? `${currentAssessment.closestInfected.distance.toFixed(1)} km` : null,
    inLocalRadius: currentAssessment.inLocalSmitteRadius || false,
    recentVisits: currentAssessment.recentVisitsCount || 0,
    oceanCurrents: FacilityData.oceanCurrent ? {
      direction: Math.round(FacilityData.oceanCurrent.direction),
      speed: FacilityData.oceanCurrent.speed?.toFixed(2)
    } : null
  };
  
  const facilityData = {
    name: currentFacility.name,
    code: currentFacility.code || currentFacility.localityNo || currentFacility.locality_no,
    municipality: currentFacility.municipality
  };
  
  // Show modal
  showRiskExplanation(facilityData, riskFactors);
}

/**
 * Helper to get risk color from assessment status
 */
function getRiskColor(status) {
  const colorMap = {
    'infected': 'red',
    'high-risk': 'orange',
    'moderate-risk': 'yellow',
    'local-risk': 'yellow',
    'healthy': 'green'
  };
  return colorMap[status] || 'green';
}

// ===== SIDEBAR NAVIGATION =====
function initSidebarNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const sections = document.querySelectorAll('.sidebar-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetSection = item.getAttribute('data-section');

      // Remove active state from all items and sections
      navItems.forEach(navItem => navItem.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));

      // Add active state to clicked item and corresponding section
      item.classList.add('active');
      const targetElement = document.querySelector(`.sidebar-section[data-section="${targetSection}"]`);
      if (targetElement) {
        targetElement.classList.add('active');
      }
    });
  });

  // Initialize with first tab active (already set in HTML)
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

// Initialize sidebar on page load
document.addEventListener('DOMContentLoaded', () => {
  initSidebarNavigation();
  setupRoleChangeListeners();  // Initialize role change listeners
  initializeRoleSystem();        // Initialize role system and display
});


