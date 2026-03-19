/**
 * vessel-simple.js
 * Simplified dashboard controller for universal vessel dashboard
 */

let quarantineInterval = null;

// Initialize dashboard (called after vessel is loaded)
async function initDashboard() {
  
  
  try {
    // Load vessel data
    const vesselData = VesselStorage.getVesselData();
    
    
    // Initialize calendar first (to load events)
    if (typeof CalendarView !== 'undefined' && CalendarView.init) {
      CalendarView.init();
      
    }
    
    // Update status display
    updateStatusDisplay();
    
    // Start quarantine counter if active
    startQuarantineCounter();
    
    // Initialize map
    if (typeof VesselMap !== 'undefined' && VesselMap.initMap) {
      await VesselMap.initMap();
      
    }
    
    // Load facilities for visit logger
    await loadFacilitiesForSelect();
    
    // Initialize route planner
    if (typeof RoutePlanner !== 'undefined' && RoutePlanner.initRoutePlanner) {
      RoutePlanner.initRoutePlanner();
      
    }
    
    // Load visit history
    loadVisitHistory();
    
    // Setup event listeners
    const infectedCheckbox = document.getElementById('showInfectedOnly');
    if (infectedCheckbox) {
      infectedCheckbox.addEventListener('change', () => {
        VesselMap.displayFacilities();
      });
    }
    
    
  } catch (error) {
    console.error('❌ Dashboard initialization failed:', error);
    alert('Feil ved initialisering: ' + error.message);
  }
}

// Update status indicator based on calendar events
function updateStatusDisplay() {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const statusDescription = document.getElementById('statusDescription');
  
  if (!indicator || !statusText || !statusDescription) return;
  
  // Get status from calendar if available
  let status = { status: 'default', text: 'Status', description: '', indicator: 'available' };
  
  if (typeof CalendarView !== 'undefined' && CalendarView.getVesselStatus) {
    status = CalendarView.getVesselStatus();
  }
  
  // Remove all status classes
  indicator.className = 'status-indicator';
  
  // Add current status class
  switch (status.indicator) {
    case 'available':
      indicator.classList.add('available');
      indicator.textContent = '✅';
      break;
    case 'quarantine':
      indicator.classList.add('quarantine');
      indicator.textContent = '⏱️';
      break;
    case 'warning':
      indicator.classList.add('warning');
      indicator.textContent = '⚠️';
      break;
    default:
      indicator.classList.add('available');
      indicator.textContent = '✓';
  }
  
  // Update text
  statusText.textContent = status.text;
  statusDescription.textContent = status.description;
}

// Start quarantine counter
function startQuarantineCounter() {
  // Clear existing interval if any
  if (quarantineInterval) {
    clearInterval(quarantineInterval);
  }
  
  // Update immediately
  updateQuarantineDisplay();
  
  // Update every second
  quarantineInterval = setInterval(() => {
    updateQuarantineDisplay();
  }, 1000);
}

// Update quarantine display
function updateQuarantineDisplay() {
  const quarantineCounter = document.getElementById('quarantineCounter');
  const quarantineTimer = document.getElementById('quarantineTimer');
  const statusText = document.getElementById('statusText');
  
  if (!quarantineCounter || !quarantineTimer) return;
  if (typeof CalendarView === 'undefined' || !CalendarView.getActiveQuarantineHours) return;
  
  const hoursRemaining = CalendarView.getActiveQuarantineHours();
  
  if (hoursRemaining > 0) {
    // Show quarantine counter
    quarantineCounter.style.display = 'block';
    
    const hours = Math.floor(hoursRemaining);
    const minutes = Math.round((hoursRemaining % 1) * 60);
    const timeString = `${hours}h ${minutes}m`;
    
    quarantineTimer.textContent = timeString;
    
    // Update status indicator color to orange
    if (statusText) {
      statusText.style.color = '#f59e0b';
    }
  } else {
    // Hide quarantine counter when expired
    quarantineCounter.style.display = 'none';
    
    // Reset status color
    if (statusText) {
      statusText.style.color = '#1f2937';
    }
  }
}

// Load facilities for select dropdown
async function loadFacilitiesForSelect() {
  try {
    const url = `${VesselStorage.API_BASE}/api/facilities?limit=500&include_fdir_metadata=true`;
    
    // Increased timeout to 300s (5 minutes) for slow API endpoints
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    const facilities = data.facilities || [];
    
    // Populate select dropdown
    populateSelectWithFacilities(facilities);
    
    
  } catch (error) {
    console.error('❌ Failed to load facilities for select:', error.message);
    
    // Use mock data as fallback
    const mockFacilities = [
      { localityNo: '1000', name: 'Nordlaks Anlegg 1', municipality: 'Trondheim', latitude: 63.4500, longitude: 10.4000, diseases: ['FRANCISELLOSE'] },
      { localityNo: '1001', name: 'Havbruk Nord', municipality: 'Frøya', latitude: 63.5000, longitude: 10.2000, diseases: [] },
      { localityNo: '1002', name: 'Marin Harvest', municipality: 'Hitra', latitude: 63.4000, longitude: 10.5000, diseases: ['FRANCISELLOSE'] }
    ];
    
    populateSelectWithFacilities(mockFacilities);
    
  }
}

// Populate dropdown with facilities
function populateSelectWithFacilities(facilities) {
  const select = document.getElementById('visitFacility');
  if (!select) return;
  
  select.innerHTML = '<option value="">Velg anlegg...</option>';
  facilities.forEach(facility => {
    const option = document.createElement('option');
    option.value = facility.localityNo || facility.id;
    option.textContent = `${facility.name} (${facility.municipality || facility.locality || 'Ukjent'})`;
    option.dataset.infected = facility.diseases && facility.diseases.length > 0;
    select.appendChild(option);
  });
}

// Show visit logger modal
function showVisitLogger() {
  const modal = document.getElementById('visitLoggerModal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Close visit logger modal
function closeVisitLogger() {
  const modal = document.getElementById('visitLoggerModal');
  if (modal) {
    modal.classList.remove('show');
  }
  
  // Reset form
  const select = document.getElementById('visitFacility');
  const checkbox = document.getElementById('visitDisinfection');
  
  if (select) select.value = '';
  if (checkbox) checkbox.checked = false;
}

// Log visit
function logVisit() {
  const select = document.getElementById('visitFacility');
  const disinfection = document.getElementById('visitDisinfection')?.checked || false;
  
  if (!select || !select.value) {
    alert('Vennligst velg et anlegg');
    return;
  }
  
  const facilityId = select.value;
  const facilityName = select.options[select.selectedIndex].text;
  const infected = select.options[select.selectedIndex].dataset.infected === 'true';
  
  // Add visit
  VesselStorage.addVisit(facilityId, facilityName, infected, disinfection);
  
  // Update displays
  updateStatusDisplay();
  loadVisitHistory();
  
  // Close modal
  closeVisitLogger();
  
  // Show confirmation
  showToast(`✓ Besøk registrert: ${facilityName}`, 'info');
  
  // If infected and no disinfection, show quarantine info
  if (infected && !disinfection) {
    setTimeout(() => {
      showToast('⚠️ Karantene aktivert (48 timer)', 'warning');
    }, 1000);
  }
}

// Load visit history
function loadVisitHistory() {
  const container = document.getElementById('visitHistory');
  if (!container) return;
  
  const visits = VesselStorage.getVisits();
  
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
    const dateStr = date.toLocaleDateString('no-NO');
    const timeStr = date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    
    const statusColor = visit.infected ? '#ef4444' : '#10b981';
    const statusText = visit.infected ? '⚠️ Smittet' : '✓ Friskt';
    
    return `
      <div style="background: #f9fafb; padding: 1rem; margin-bottom: 0.5rem; border-left: 4px solid ${statusColor}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${visit.facilityName}</div>
            <div style="font-size: 0.9rem; color: #6b7280;">
              ${dateStr} kl. ${timeStr}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="color: ${statusColor}; font-weight: 600; font-size: 0.9rem;">
              ${statusText}
            </div>
            ${visit.disinfection ? '<div style="font-size: 0.85rem; color: #10b981;">🧼 Desinfisert</div>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Clear visit history
function clearHistory() {
  if (confirm('Er du sikker på at du vil tømme besøkshistorikken?')) {
    VesselStorage.clearVisitHistory();
    loadVisitHistory();
    showToast('Historikk tømt', 'info');
  }
}

// View quarantine
function viewQuarantine() {
  const status = VesselStorage.getQuarantineStatus();
  
  if (!status.active) {
    alert('Ingen aktiv karantene');
    return;
  }
  
  const remaining = VesselStorage.formatTimeRemaining(status.endTime);
  alert(`Karantene aktiv\n\nGrunn: ${status.reason}\nGjenværende: ${remaining}`);
}

// Show route planner
function showRoutePlanner() {
  const modal = document.getElementById('routePlannerModal');
  if (modal) {
    modal.classList.add('show');
  }
  
  // Initialize route planner if not already done
  if (typeof RoutePlanner !== 'undefined' && RoutePlanner.initRoutePlanner) {
    RoutePlanner.initRoutePlanner();
  }
}

// Close route planner
function closeRoutePlanner() {
  const modal = document.getElementById('routePlannerModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Show calendar view
function showCalendarView() {
  const modal = document.getElementById('calendarModal');
  if (modal) {
    modal.classList.add('show');
  }
  
  // Initialize advanced calendar
  if (typeof CalendarView !== 'undefined' && CalendarView.init) {
    CalendarView.init();
  }
}

// Close calendar view
function closeCalendarView() {
  const modal = document.getElementById('calendarModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-left: 4px solid #3b82f6;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  
  if (type === 'warning') {
    toast.style.borderLeftColor = '#f59e0b';
  } else if (type === 'danger') {
    toast.style.borderLeftColor = '#ef4444';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Export for global access
window.showVisitLogger = showVisitLogger;
window.closeVisitLogger = closeVisitLogger;
window.logVisit = logVisit;
window.clearHistory = clearHistory;
window.viewQuarantine = viewQuarantine;
window.showRoutePlanner = showRoutePlanner;
window.closeRoutePlanner = closeRoutePlanner;
window.showCalendarView = showCalendarView;
window.closeCalendarView = closeCalendarView;
window.initDashboard = initDashboard;
window.showToast = showToast;
