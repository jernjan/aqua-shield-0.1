/**
 * calendar-advanced.js
 * Advanced calendar with event planning and infection risk analysis
 */

let currentCalendarDate = new Date();
let calendarEvents = [];
let pendingCompletionEventId = null;
const CALENDAR_API_BASE = (typeof VesselStorage !== 'undefined' && VesselStorage.API_BASE)
  ? VesselStorage.API_BASE
  : (window.location.hostname.includes('render.com') ? 'https://kyst-api.render.com' : 'http://localhost:8000');

const CalendarView = {
  sharedOnlyFilter: false,

  // Initialize calendar
  init() {
    
    
    // Load events from storage
    this.loadEvents();
    
    // Display calendar
    this.displayCalendar();
    
    // Update infection risk analysis
    this.analyzeInfectionRisk();

    // Refresh status for shared visits (pending/approved/rejected)
    this.refreshSharedProposalStatuses();
    
    
  },

  async refreshSharedProposalStatuses() {
    const sharedVisitEvents = calendarEvents.filter(event =>
      event.type === 'visit' &&
      event.planned === true &&
      event.sharedProposalId
    );

    if (sharedVisitEvents.length === 0) return;

    let changed = false;

    for (const event of sharedVisitEvents) {
      try {
        const response = await fetch(`${CALENDAR_API_BASE}/api/route-proposals/${event.sharedProposalId}`);
        if (!response.ok) continue;

        const proposal = await response.json();
        const nextStatus = proposal.status || 'pending';
        const nextFacilityName = proposal.facility_name || event.sharedFacilityName || event.details || '';

        if (event.sharedStatus !== nextStatus || event.sharedFacilityName !== nextFacilityName) {
          event.sharedStatus = nextStatus;
          event.sharedFacilityName = nextFacilityName;
          changed = true;
        }
      } catch (err) {
        console.warn(`Could not refresh shared status for proposal ${event.sharedProposalId}:`, err);
      }
    }

    if (changed) {
      this.saveEvents();
      this.displayCalendar();
      this.analyzeInfectionRisk();
    }
  },

  // Load events from localStorage
  loadEvents() {
    try {
      const stored = localStorage.getItem('calendarEvents');
      if (stored) {
        calendarEvents = JSON.parse(stored).map(event => ({
          id: event.id || `evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          planned: event.planned !== false,
          completed: event.completed === true, // Default to false if not specified
          ...event
        }));
      }
    } catch (err) {
      console.error('Error loading calendar events:', err);
      calendarEvents = [];
    }
  },

  // Save events to localStorage
  saveEvents() {
    localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
  },

  // Combine planned events and logged visits
  getCombinedEvents() {
    const visits = (typeof VesselStorage !== 'undefined' && VesselStorage.getVisits)
      ? VesselStorage.getVisits()
      : [];

    const planned = calendarEvents.map(event => ({
      ...event,
      source: 'planned'
    }));

    const logged = visits.map(visit => ({
      id: `visit_${visit.id}`,
      date: new Date(visit.timestamp).toISOString().split('T')[0],
      type: 'visit',
      details: visit.facilityName,
      infected: visit.infected,
      disinfection: visit.disinfection,
      planned: false,
      source: 'logged'
    }));

    return [...planned, ...logged];
  },

  // Display calendar
  displayCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const combinedEvents = this.getCombinedEvents();
    
    // Update header
    const monthNames = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Create calendar grid
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.style.fontWeight = '600';
      header.style.textAlign = 'center';
      header.style.paddingBottom = '0.5rem';
      header.textContent = day;
      calendarGrid.appendChild(header);
    });
    
    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day other-month';
      calendarGrid.appendChild(emptyCell);
    }
    
    // Days of month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'calendar-day';
      
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check if today
      const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
      if (isToday) dayCell.classList.add('today');
      
      // Get events for this day
      const dayEvents = combinedEvents.filter(e => e.date === dateStr);
      if (dayEvents.length > 0) {
        dayCell.classList.add('has-events');
      }
      
      // Day number
      const numberDiv = document.createElement('div');
      numberDiv.className = 'calendar-day-number';
      numberDiv.textContent = day;
      dayCell.appendChild(numberDiv);
      
      // Show event count/type with status indicator
      if (dayEvents.length > 0) {
        const visitCount = dayEvents.filter(e => e.type === 'visit').length;
        const operationCount = dayEvents.filter(e => e.type === 'operation').length;
        const hasDisinfection = dayEvents.some(e => e.type === 'disinfection');
        const hasQuarantine = dayEvents.some(e => e.type === 'quarantine');
        
        // Check completion status - if any critical event is not completed, show red
        const hasUncompletedDisinfection = dayEvents.some(e => e.type === 'disinfection' && !e.completed);
        const hasUncompletedInfectedVisit = dayEvents.some(e => e.type === 'visit' && e.infected && !e.completed);
        const hasUncompletedProximityVisit = dayEvents.some(e => e.type === 'visit' && e.proximityRisk && !e.completed);
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'calendar-day-visits';
        
        // Status indicator dot
        let statusDot = '🟢'; // Green = all important events completed
        if (hasUncompletedDisinfection || hasUncompletedInfectedVisit) {
          statusDot = '🔴'; // Red = critical unconfirmed events (infected or disinfection)
        } else if (hasUncompletedProximityVisit) {
          statusDot = '🟠'; // Orange = proximity risk but no confirmed infection/disinfection
        }
        
        let icons = statusDot + ' ';
        if (visitCount > 0) icons += `🏢${visitCount}`;
        if (operationCount > 0) icons += ` 🛠️${operationCount}`;
        if (hasDisinfection) icons += ' 🧼';
        if (hasQuarantine) icons += ' ⏱️';
        eventDiv.textContent = icons.trim();
        dayCell.appendChild(eventDiv);
      }
      
      // Click handler
      dayCell.onclick = () => {
        const eventDate = document.getElementById('eventDate');
        const routeDate = document.getElementById('routeEditDate');
        const operationDate = document.getElementById('operationDate');
        if (eventDate) eventDate.value = dateStr;
        if (routeDate) routeDate.value = dateStr;
        if (operationDate) operationDate.value = dateStr;
        document.querySelector('.event-form').scrollIntoView({ behavior: 'smooth' });
      };
      
      calendarGrid.appendChild(dayCell);
    }
    
    // Empty cells after last day
    const totalCells = startingDayOfWeek + daysInMonth;
    const emptyAfter = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < emptyAfter; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day other-month';
      calendarGrid.appendChild(emptyCell);
    }
    
    // Display events list
    this.displayEventsList();
  },

  // Display events list
  displayEventsList() {
    const eventList = document.getElementById('eventList');
    const combinedEvents = this.getCombinedEvents();

    const sharedEvents = combinedEvents.filter(event =>
      event.type === 'visit' &&
      event.planned === true &&
      !!event.sharedProposalId
    );

    const visibleEvents = this.sharedOnlyFilter
      ? sharedEvents
      : combinedEvents;

    const filterControls = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
        <span style="font-size: 0.82rem; color: #6b7280;">
          ${this.sharedOnlyFilter ? `Viser delte besøk (${sharedEvents.length})` : `Viser alle hendelser (${combinedEvents.length})`}
        </span>
        <button class="btn" onclick="CalendarView.toggleSharedFilter()" style="font-size: 0.78rem; padding: 0.22rem 0.5rem; background: #1d4ed8; color: white;">
          ${this.sharedOnlyFilter ? 'Vis alle' : 'Kun delte besøk'}
        </button>
      </div>
    `;

    if (combinedEvents.length === 0) {
      eventList.innerHTML = `${filterControls}<p style="color: #6b7280; text-align: center;">Ingen planlagte eller loggførte hendelser ennå.</p>`;
      return;
    }

    if (visibleEvents.length === 0) {
      eventList.innerHTML = `${filterControls}<p style="color: #6b7280; text-align: center;">Ingen delte besøk ennå.</p>`;
      return;
    }

    // Sort by date
    visibleEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    eventList.innerHTML = filterControls + visibleEvents.map(event => {
      const date = new Date(event.date + 'T00:00:00');
      const dateStr = date.toLocaleDateString('no-NO', { weekday: 'short', month: 'short', day: 'numeric' });
      
      let icon = '📋';
      let typeClass = '';
      let details = event.details || '';
      const isPlanned = event.planned === true;
      const isCompleted = event.completed === true;
      
      if (event.type === 'visit') {
        icon = event.infected ? '⚠️' : (event.proximityRisk ? '🟠' : '✓');
        typeClass = 'visit';
        if (isPlanned) details += ' (Planlagt)';
        if (isCompleted) details += ' ✓ Bekreftet';
        if (!isPlanned && event.source === 'logged') details += ' [Loggert]';
        if (event.infected) details += ' (Smittet)';
        if (!event.infected && event.proximityRisk) details += ' (Mulig smitte)';

        if (event.sharedProposalId) {
          const sharedStatus = event.sharedStatus || 'pending';
          const statusIcon = sharedStatus === 'approved'
            ? '🟢'
            : (sharedStatus === 'rejected' ? '🔴' : (sharedStatus === 'alternative_suggested' ? '🟡' : '🟠'));
          const statusText = sharedStatus === 'approved'
            ? 'godkjent'
            : (sharedStatus === 'rejected' ? 'avvist' : (sharedStatus === 'alternative_suggested' ? 'alternativ foreslått' : 'avventer'));
          const targetFacility = event.sharedFacilityName || event.details || 'anlegg';
          details += ` [📤 Delt: ${targetFacility} · ${statusIcon} ${statusText}]`;
        }
      } else if (event.type === 'disinfection') {
        icon = '🧼';
        typeClass = 'disinfection';
        details += ` [${event.chemical || 'Virkon S (1%)'}]`;
        if (isCompleted) details += ' ✓ Gjennomført';
      } else if (event.type === 'quarantine') {
        icon = '⏱️';
        typeClass = 'quarantine';
        details += ` [${event.duration || 48}h]`;
        if (isCompleted) details += ' ✓ Avsluttet';
        if (event.attestation?.approved) {
          details += ` (Attestert: ${event.attestation.approvedBy})`;
        }
      } else if (event.type === 'operation') {
        icon = '🛠️';
        typeClass = 'operation';
        if (event.duration) details += ` [${event.duration} min]`;
      }
      
      // Determine button layout based on event type and status
      let editButton = '';
      let confirmButton = '';
      let shareButton = '';
      
      if (isPlanned && (event.type === 'visit' || event.type === 'disinfection' || event.type === 'quarantine' || event.type === 'operation')) {
        editButton = `<button class="btn" onclick="openEventEditModal('${event.id}')" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #3b82f6; margin-right: 0.25rem;">Rediger</button>`;
      }
      
      // Show confirm/undo button for visit, disinfection, quarantine, and operation
      if (isPlanned && (event.type === 'visit' || event.type === 'disinfection' || event.type === 'quarantine' || event.type === 'operation')) {
        if (!isCompleted) {
          confirmButton = `<button class="btn" onclick="CalendarView.markCompleted('${event.id}')" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #10b981; color: white; margin-right: 0.25rem;">✓ Bekreft</button>`;
        } else {
          confirmButton = `<button class="btn" onclick="CalendarView.markUncompleted('${event.id}')" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #f97316; color: white; margin-right: 0.25rem;">Angre</button>`;
        }
      }

      if (isPlanned && event.type === 'visit') {
        if (event.sharedProposalId) {
          shareButton = `<button class="btn" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #10b981; color: white; margin-right: 0.25rem; opacity: 0.85;" disabled>✓ Delt</button>`;
        } else {
          shareButton = `<button class="btn" onclick="CalendarView.shareVisitToFacility('${event.id}')" style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #2563eb; color: white; margin-right: 0.25rem;">📤 Del</button>`;
        }
      }

      const deleteButton = isPlanned
        ? `<button class="btn" onclick="CalendarView.deleteEvent('${event.id}')" style="font-size: 0.8rem; padding: 0.25rem 0.5rem;">Slett</button>`
        : '';

      // Status indicator
      let statusIndicator = '';
      if (event.type === 'disinfection' || event.type === 'quarantine') {
        if (isCompleted) {
          statusIndicator = '<span style="color: #10b981; font-weight: 600; font-size: 1.2rem; margin-right: 0.5rem;">🟢</span>';
        } else {
          statusIndicator = '<span style="color: #ef4444; font-weight: 600; font-size: 1.2rem; margin-right: 0.5rem;">🔴</span>';
        }
      }

      let eventCardStyle = '';
      if (event.type === 'visit' && isPlanned && event.sharedProposalId) {
        const sharedStatus = event.sharedStatus || 'pending';
        if (sharedStatus === 'approved') {
          eventCardStyle = 'border-left: 4px solid #10b981; background: #f0fdf4;';
        } else if (sharedStatus === 'rejected') {
          eventCardStyle = 'border-left: 4px solid #ef4444; background: #fef2f2;';
        } else if (sharedStatus === 'alternative_suggested') {
          eventCardStyle = 'border-left: 4px solid #3b82f6; background: #dbeafe;';
        } else {
          eventCardStyle = 'border-left: 4px solid #f59e0b; background: #fffbeb;';
        }
      }

      return `
        <div class="event-item ${typeClass}" style="${eventCardStyle}">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="display: flex; align-items: flex-start; gap: 0.5rem; flex: 1;">
              ${statusIndicator}
              <div>
                <div><strong>${icon} ${details}</strong></div>
                <div class="event-item-time">${dateStr}</div>
                ${event.description ? `<div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">${event.description}</div>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.25rem;">
              ${shareButton}
              ${confirmButton}
              ${editButton}
              ${deleteButton}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleSharedFilter() {
    this.sharedOnlyFilter = !this.sharedOnlyFilter;
    this.displayEventsList();
  },

  // Add event
  addEvent() {
    const dateInput = document.getElementById('eventDate').value;
    const typeInput = document.getElementById('eventType').value;
    const detailsInput = document.getElementById('eventDetails').value.trim();
    
    if (!dateInput || !typeInput || !detailsInput) {
      showToast('Vennligst fyll ut alle felter', 'warning');
      return;
    }
    
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      date: dateInput,
      type: typeInput,
      details: detailsInput,
      planned: true,
      createdAt: new Date().toISOString()
    };
    
    calendarEvents.push(event);
    this.saveEvents();
    
    // Clear form
    document.getElementById('eventDate').value = '';
    document.getElementById('eventType').value = 'visit';
    document.getElementById('eventDetails').value = '';
    
    // Refresh display
    this.displayCalendar();
    this.analyzeInfectionRisk();
    
    showToast(`✓ Hendelse lagt til: ${detailsInput}`, 'success');
  },

  addFacilityToPlannedRoute() {
    const dateInput = document.getElementById('routeEditDate').value;
    const nameInput = document.getElementById('routeFacilityName').value.trim();

    if (!dateInput || !nameInput) {
      showToast('Velg dato og navn på anlegg', 'warning');
      return;
    }

    const alreadyPlanned = calendarEvents.some(event =>
      event.type === 'visit' &&
      event.planned === true &&
      event.date === dateInput &&
      (event.details || '').toLowerCase() === nameInput.toLowerCase()
    );

    if (alreadyPlanned) {
      showToast('Anlegget ligger allerede i ruten for den datoen', 'info');
      return;
    }

    const facility = this.findFacilityByName(nameInput);
    const newEvent = {
      id: `route_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      date: dateInput,
      type: 'visit',
      details: facility?.name || nameInput,
      infected: facility?.infected === true,
      proximityRisk: facility?.proximityRisk === true,
      diseases: facility?.diseases || [],
      nearbyDiseases: facility?.nearbyDiseases || [],
      planned: true,
      createdAt: new Date().toISOString()
    };

    calendarEvents.push(newEvent);
    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();

    document.getElementById('routeFacilityName').value = '';

    if (newEvent.infected || newEvent.proximityRisk) {
      showToast('⚠️ Anlegg i risiko lagt til. Vurder desinfeksjon/karantene i kalenderen.', 'warning');
    } else {
      showToast('✓ Anlegg lagt til i ruten', 'success');
    }
  },

  addOperation() {
    const dateInput = document.getElementById('operationDate').value;
    const nameInput = document.getElementById('operationName').value.trim();
    const durationInput = parseInt(document.getElementById('operationDuration').value, 10);
    const commentInput = document.getElementById('operationComment').value.trim();

    if (!dateInput || !nameInput) {
      showToast('Velg dato og angi operasjon', 'warning');
      return;
    }

    const event = {
      id: `op_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      date: dateInput,
      type: 'operation',
      details: nameInput,
      duration: Number.isFinite(durationInput) ? durationInput : undefined,
      description: commentInput || undefined,
      planned: true,
      createdAt: new Date().toISOString()
    };

    calendarEvents.push(event);
    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();

    document.getElementById('operationName').value = '';
    document.getElementById('operationDuration').value = '';
    document.getElementById('operationComment').value = '';

    showToast('✓ Operasjon lagt til', 'success');
  },

  async shareVisitToFacility(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event || event.type !== 'visit') {
      showToast('Fant ikke besøket i kalenderen', 'warning');
      return;
    }

    if (event.sharedProposalId) {
      showToast('Besøket er allerede delt med anlegget', 'info');
      return;
    }

    const facilityName = (event.details || '').trim();
    if (!facilityName) {
      showToast('Mangler anleggsnavn på besøket', 'warning');
      return;
    }

    const facility = this.findFacilityByName(facilityName);
    const facilityCode = facility?.code || facility?.localityNo || facility?.id;

    if (!facilityCode) {
      showToast('Kunne ikke finne anleggskode for besøket. Velg et kjent anleggsnavn.', 'warning');
      return;
    }

    const vesselData = (typeof VesselStorage !== 'undefined' && VesselStorage.getVesselData)
      ? VesselStorage.getVesselData()
      : null;

    const vesselName = vesselData?.vessel?.name || vesselData?.name || 'Ukjent båt';
    const vesselMMSI = parseInt(vesselData?.vessel?.mmsi || vesselData?.mmsi || 0, 10) || 0;
    const baseNotes = (event.description || '').trim();
    const shareNotes = ['Delt fra båtkalender', baseNotes].filter(Boolean).join(' · ');

    try {
      const response = await fetch(`${CALENDAR_API_BASE}/api/route-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mmsi: vesselMMSI,
          vessel_name: vesselName,
          facility_code: String(facilityCode),
          facility_name: facility?.name || facilityName,
          proposed_date: event.date,
          proposed_time: event.time || '10:00',
          contact_person: '',
          notes: shareNotes,
          operation_type: 'visit'
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.error === 'date_not_available') {
          const availableDays = Array.isArray(result.available_days) ? result.available_days.join(', ') : 'ukjent';
          showToast(`Anlegget tar ikke imot den dagen. Tilgjengelig: ${availableDays}`, 'warning');
        } else {
          showToast('Klarte ikke å dele besøket med anlegget', 'error');
        }
        return;
      }

      event.sharedProposalId = result.proposal_id;
      event.sharedAt = new Date().toISOString();
      event.sharedStatus = 'pending';
      event.sharedFacilityName = facility?.name || facilityName;

      this.saveEvents();
      this.displayCalendar();
      this.refreshSharedProposalStatuses();
      showToast(`✓ Besøk delt med ${facility?.name || facilityName}`, 'success');
    } catch (err) {
      console.error('Failed to share visit from calendar:', err);
      showToast('Kunne ikke koble til server for deling av besøk', 'error');
    }
  },

  findFacilityByName(name) {
    if (typeof VesselMap === 'undefined' || !VesselMap.getFacilitiesData) return null;
    const facilities = VesselMap.getFacilitiesData() || [];
    const normalized = name.toLowerCase();
    return facilities.find(facility => {
      const candidate = (facility.name || '').toLowerCase();
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    }) || null;
  },

  // Delete event
  deleteEvent(eventId) {
    calendarEvents = calendarEvents.filter(e => e.id !== eventId);
    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();
    showToast('Hendelse slettet', 'info');
  },

  // Mark event as completed/gjennomført
  markCompleted(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    if (event.type === 'disinfection' && (!event.responsible_party || !event.chemical)) {
      pendingCompletionEventId = event.id;
      showToast('⚠️ Firma/Person ansvarlig og desinfeksjonsmiddel er obligatorisk', 'warning');
      if (typeof openEventEditModal === 'function') {
        openEventEditModal(event.id);
      }
      return;
    }

    event.completed = true;
    event.completedAt = new Date().toISOString();

    // If disinfection is completed, mark linked quarantine as eligible but not necessarily completed
    if (event.type === 'disinfection') {
      // Find associated quarantine (created around same time based on createdAt timestamp)
      const linkedQuarantine = calendarEvents.find(e => 
        e.type === 'quarantine' && 
        Math.abs(new Date(e.createdAt).getTime() - new Date(event.createdAt).getTime()) < 1000
      );
      
      if (linkedQuarantine) {
        // Mark boat as no longer suspect if disinfection is confirmed
        showToast('✓ Desinfeksjon bekreftet - båten er godkjent for bruk etter karanteneperioden', 'success');
      }
    } else if (event.type === 'quarantine') {
      showToast('✓ Karanteneperiode avsluttet - båten kan brukes normalt', 'success');
    } else if (event.type === 'visit' && !event.audit_logged) {
      const facilityName = event.details || event.facilityName || event.facility || 'Ukjent anlegg';
      const facilityId = event.facilityId || event.facility_id || facilityName
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'unknown-facility';

      if (typeof window.sendAuditLog === 'function') {
        window.sendAuditLog({
          facilityId,
          facilityName,
          infected: event.infected === true,
          proximityRisk: event.proximityRisk === true,
          disinfection: false,
          timestamp: event.completedAt,
          visit_date: event.date,
          diseaseTypes: Array.isArray(event.diseases) ? event.diseases : (Array.isArray(event.nearbyDiseases) ? event.nearbyDiseases : [])
        }, false);
        event.audit_logged = true;
      }
    }

    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();
    
    // Update vessel status display
    if (typeof updateStatusDisplay === 'function') {
      updateStatusDisplay();
    }
  },

  // Mark event as uncompleted (undo confirmation)
  markUncompleted(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    event.completed = false;
    event.completedAt = undefined;

    if (event.type === 'disinfection') {
      showToast('⚠️ Desinfeksjon-bekrefting angret - båten er igjen under overvåking', 'warning');
    } else if (event.type === 'quarantine') {
      showToast('⚠️ Karantene-avslutning angret', 'warning');
    }

    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();
    
    // Update vessel status display
    if (typeof updateStatusDisplay === 'function') {
      updateStatusDisplay();
    }
  },

  // Edit disinfection or quarantine event
  editEvent(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    if (event.type === 'disinfection') {
      this.editDisinfection(event);
    } else if (event.type === 'quarantine') {
      this.editQuarantine(event);
    }
  },

  editDisinfection(event) {
    const modalHTML = `
      <div id="editDisinfectionModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; width: 90%; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          <h3 style="margin-top: 0;">Rediger desinfeksjon</h3>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Dato for vask/desinfeksjon</label>
            <input type="date" id="disinfectionDate" value="${event.date}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem;">
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Godkjent desinfektionsmiddel (Mattilsynet)</label>
            <select id="disinfectionChemical" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem;">
              ${(event.chemicalOptions || ['Virkon S (1%)', 'Natriumhypokloritt (50 ppm klor)', 'Hydrogenperoksid', 'Peroksyeddiksyre']).map(opt => 
                `<option value="${opt}" ${opt === event.chemical ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Prosess</label>
            <div style="background: #f3f4f6; padding: 1rem; border-radius: 0.25rem; font-size: 0.9rem; line-height: 1.5;">
              <strong>Standard desinfeksjonsprosess (Mattilsynet):</strong><br/>
              1. Mekanisk vask (grovrengjøring)<br/>
              2. Desinfeksjon (30min-1time kontakttid)<br/>
              3. Skylling og tørking
            </div>
          </div>
          
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button onclick="document.getElementById('editDisinfectionModal').remove()" style="padding: 0.5rem 1rem; background: #d1d5db; border: none; border-radius: 0.25rem; cursor: pointer;">Avbryt</button>
            <button onclick="CalendarView.saveDisinfectionEdit('${event.id}')" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Lagre</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  saveDisinfectionEdit(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    const newDate = document.getElementById('disinfectionDate').value;
    const newChemical = document.getElementById('disinfectionChemical').value;

    if (!newDate || !newChemical) {
      showToast('Vennligst fyll ut alle felter', 'warning');
      return;
    }

    event.date = newDate;
    event.chemical = newChemical;
    
    // Update linked quarantine date if it exists
    const linkedQuarantine = calendarEvents.find(e => 
      e.type === 'quarantine' && 
      e.createdAt === event.createdAt
    );
    
    if (linkedQuarantine) {
      const qDate = new Date(newDate);
      qDate.setDate(qDate.getDate() + 1);
      linkedQuarantine.date = qDate.toISOString().split('T')[0];
      
      const qEndDate = new Date(qDate);
      qEndDate.setDate(qEndDate.getDate() + 2);
      linkedQuarantine.dateEnd = qEndDate.toISOString().split('T')[0];
    }

    this.saveEvents();
    this.displayCalendar();
    document.getElementById('editDisinfectionModal').remove();
    showToast('✓ Desinfeksjon oppdatert', 'success');
  },

  editQuarantine(event) {
    const modalHTML = `
      <div id="editQuarantineModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; width: 90%; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          <h3 style="margin-top: 0;">Rediger karantene</h3>
          <p style="color: #6b7280; font-size: 0.9rem;">Transportforskriften §20a: Minimum 48 timer etter godkjent desinfeksjon</p>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Startdato for karantene</label>
            <input type="date" id="quarantineStartDate" value="${event.date}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem;">
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Karantenets varighet (timer)</label>
            <input type="number" id="quarantineDuration" value="${event.duration || 48}" min="48" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem;">
            <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem;">Minimum: 48 timer (per Transportforskriften §20a)</div>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="quarantineApproved" ${event.attestation?.approved ? 'checked' : ''}>
              <span>Attestert av fiskehelsepersonell/veterinær</span>
            </label>
            <input type="text" id="quarantineApprovedBy" placeholder="Navn på attestant" value="${event.attestation?.approvedBy || ''}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; margin-top: 0.5rem;">
          </div>
          
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button onclick="document.getElementById('editQuarantineModal').remove()" style="padding: 0.5rem 1rem; background: #d1d5db; border: none; border-radius: 0.25rem; cursor: pointer;">Avbryt</button>
            <button onclick="CalendarView.saveQuarantineEdit('${event.id}')" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Lagre</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  saveQuarantineEdit(eventId) {
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;

    const newStartDate = document.getElementById('quarantineStartDate').value;
    const newDuration = parseInt(document.getElementById('quarantineDuration').value) || 48;
    const isApproved = document.getElementById('quarantineApproved').checked;
    const approvedBy = document.getElementById('quarantineApprovedBy').value.trim();

    if (!newStartDate) {
      showToast('Vennligst fyll ut alle felter', 'warning');
      return;
    }

    if (newDuration < 48) {
      showToast('Karantenen må være minst 48 timer', 'warning');
      return;
    }

    event.date = newStartDate;
    event.duration = newDuration;
    
    // Calculate end date based on duration
    const startDate = new Date(newStartDate);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + newDuration);
    event.dateEnd = endDate.toISOString().split('T')[0];
    
    event.attestation = {
      approved: isApproved,
      approvedBy: isApproved ? approvedBy : '',
      role: 'Fiskehelsepersonell'
    };

    this.saveEvents();
    this.displayCalendar();
    document.getElementById('editQuarantineModal').remove();
    showToast('✓ Karantene oppdatert', 'success');
  },

  // Previous month
  previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    this.displayCalendar();
  },

  // Next month
  nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    this.displayCalendar();
  },

  // Analyze infection risk
  analyzeInfectionRisk() {
    const riskDiv = document.getElementById('infectionRiskAnalysis');
    const combinedEvents = this.getCombinedEvents();

    if (combinedEvents.length === 0) {
      riskDiv.innerHTML = '';
      return;
    }

    // Get all visits
    const visits = combinedEvents.filter(e => e.type === 'visit');
    if (visits.length === 0) {
      riskDiv.innerHTML = '';
      return;
    }
    
    // Check for infection risk patterns
    const risks = [];
    
    // Check for infected facility visits without CONFIRMED disinfection
    visits.forEach(visit => {
      const detailsText = (visit.details || '').toLowerCase();
      const isKnownInfected = visit.infected === true || detailsText.includes('smittet') || detailsText.includes('infected');

      if (isKnownInfected) {
        // Check if disinfection scheduled same day or next day AND is completed
        const visitDate = new Date(visit.date);
        const nextDay = new Date(visitDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const hasConfirmedDisinfection = calendarEvents.some(e =>
          e.type === 'disinfection' &&
          e.completed === true &&
          (e.date === visit.date || e.date === nextDay.toISOString().split('T')[0])
        );

        const hasPlannedDisinfection = calendarEvents.some(e =>
          e.type === 'disinfection' &&
          (e.date === visit.date || e.date === nextDay.toISOString().split('T')[0])
        );
        
        if (!hasConfirmedDisinfection) {
          // Determine severity based on whether disinfection is planned
          const severity = hasPlannedDisinfection ? 'medium' : 'high';
          const message = hasPlannedDisinfection 
            ? `🔴 MULIG SMITTESPREDER: Besøk på "${visit.details}" - VENTER DESINFEKSJON-BEKREFTELSE`
            : `⚠️ SMITTE-RISIKO: Besøk på "${visit.details}" uten planlagt desinfeksjon!`;
          
          risks.push({
            severity: severity,
            message,
            recommendation: hasPlannedDisinfection 
              ? 'Desinfeksjon er planlagt men IKKE ennå bekreftet som gjennomført. Båten kan ikke brukes før desinfeksjon er bekreftet i kalenderen.'
              : 'Planlegg desinfeksjon innen 24 timer etter besøket og bekreft gjennomføring i kalender.'
          });
        } else {
          // Disinfection is confirmed - still show green indicator but no risk
          // The calendar will show green dot for this date
        }
      }
    });
    
    // Check for CHECK if any boat has been in infection zone without confirmed disinfection
    const proximityVisits = visits.filter(v => v.proximityRisk === true && v.infected !== true);
    if (proximityVisits.length > 0) {
      // Check if these proximity visits have confirmed disinfection
      const unconfirmedProximityVisits = proximityVisits.filter(pv => {
        const visitDate = new Date(pv.date);
        const nextDay = new Date(visitDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const hasConfirmedDisinfection = calendarEvents.some(e =>
          e.type === 'disinfection' &&
          e.completed === true &&
          (e.date === pv.date || e.date === nextDay.toISOString().split('T')[0])
        );
        
        return !hasConfirmedDisinfection;
      });

      if (unconfirmedProximityVisits.length > 0) {
        const facilityNames = unconfirmedProximityVisits.map(v => v.details).filter(Boolean);
        const nearbyDiseases = new Set();
        unconfirmedProximityVisits.forEach(v => {
          (v.nearbyDiseases || []).forEach(disease => {
            if (disease) nearbyDiseases.add(String(disease));
          });
        });

        risks.push({
          severity: 'medium',
          message: `🟠 RISIKOSONE: Rute passerer mulige smitteområder - VENTER DESINFEKSJON-BEKREFTELSE`,
          recommendation: `Anlegg: ${facilityNames.join(', ') || 'Ukjent'}${nearbyDiseases.size > 0 ? ` | Mulige sykdommer: ${Array.from(nearbyDiseases).join(', ')}` : ''}. Bekreft desinfeksjon i kalender før båten brukes igjen.`
        });
      }
    }
    
    const highLiceVisits = visits.filter(v => v.liceHigh === true && v.infected !== true);
    if (highLiceVisits.length > 0) {
      const unconfirmedLiceVisits = highLiceVisits.filter(lv => {
        const visitDate = new Date(lv.date);
        const nextDay = new Date(visitDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const hasConfirmedDisinfection = calendarEvents.some(e =>
          e.type === 'disinfection' &&
          e.completed === true &&
          (e.date === lv.date || e.date === nextDay.toISOString().split('T')[0])
        );

        return !hasConfirmedDisinfection;
      });

      if (unconfirmedLiceVisits.length > 0) {
        const maxAdult = Math.max(...unconfirmedLiceVisits.map(v => Number(v.liceAdultFemale) || 0));
        risks.push({
          severity: 'medium',
          message: '🧪 LUSE-RISIKO: Besøk med høye lusetall uten bekreftet desinfeksjon',
          recommendation: `Maks registrert holus i plan: ${maxAdult.toFixed(2)}. Bekreft desinfeksjon og 48t karantene før videre drift.`
        });
      }
    }

    const infectedVisits = visits.filter(v => {
      const detailsText = (v.details || '').toLowerCase();
      return v.infected === true || detailsText.includes('smittet') || detailsText.includes('infected');
    });

    if (infectedVisits.length > 0) {
      const lastInfectedVisit = new Date(Math.max(...infectedVisits.map(v => new Date(v.date))));
      const quarantineEnd = new Date(lastInfectedVisit);
      quarantineEnd.setDate(quarantineEnd.getDate() + 2);
      
      const hasConfirmedQuarantine = calendarEvents.some(e =>
        e.type === 'quarantine' &&
        e.completed === true &&
        new Date(e.date) >= lastInfectedVisit &&
        new Date(e.date) <= quarantineEnd
      );

      const hasPlannedQuarantine = calendarEvents.some(e =>
        e.type === 'quarantine' &&
        new Date(e.date) >= lastInfectedVisit &&
        new Date(e.date) <= quarantineEnd
      );
      
      if (!hasPlannedQuarantine) {
        risks.push({
          severity: 'medium',
          message: `📋 KARANTENE: Planlegg karantene etter smitte-besøk`,
          recommendation: `Karantene skal dokumenteres fra ${lastInfectedVisit.toLocaleDateString('no-NO')} til ${quarantineEnd.toLocaleDateString('no-NO')}`
        });
      }
    }
    
    // Display risks
    if (risks.length === 0) {
      riskDiv.innerHTML = '<div style="padding: 1rem; background: #dcfce7; border-radius: 4px; color: #15803d;"><strong>✓ Alle protokoller ser ut til å være fulgt - båten er klar for bruk!</strong></div>';
    } else {
      riskDiv.innerHTML = risks.map(risk => `
        <div class="infection-risk" style="background: ${risk.severity === 'high' ? '#fee2e2' : '#fef3c7'}; border-color: ${risk.severity === 'high' ? '#fecaca' : '#fde68a'}; color: ${risk.severity === 'high' ? '#7f1d1d' : '#78350f'};">
          <strong>${risk.message}</strong>
          <div style="margin-top: 0.5rem; font-size: 0.9rem;">${risk.recommendation}</div>
        </div>
      `).join('');
    }
  },

  // Add planned route to calendar
  addPlannedRoute(date, facilities) {
    if (!date || !Array.isArray(facilities) || facilities.length === 0) {
      showToast('Velg dato og minst ett anlegg', 'warning');
      return;
    }

    const newEvents = facilities.map((facility, index) => ({
      id: `route_${Date.now()}_${index}`,
      date,
      type: 'visit',
      details: facility.name,
      infected: facility.infected === true,
      proximityRisk: facility.proximityRisk === true,
      liceHigh: facility.liceHigh === true,
      liceAdultFemale: Number.isFinite(Number(facility.liceAdultFemale)) ? Number(facility.liceAdultFemale) : null,
      liceTotal: Number.isFinite(Number(facility.liceTotal)) ? Number(facility.liceTotal) : null,
      diseases: facility.diseases || [],
      nearbyDiseases: facility.nearbyDiseases || [],
      planned: true,
      createdAt: new Date().toISOString()
    }));

    calendarEvents = [...calendarEvents, ...newEvents];

    // Check if any facility is infected or has proximity risk
    const hasInfected = facilities.some(f => f.infected === true);
    const hasProximityRisk = facilities.some(f => f.proximityRisk === true && f.infected !== true);
    const hasHighLice = facilities.some(f => f.liceHigh === true);

    if (hasInfected || hasProximityRisk || hasHighLice) {
      // Auto-suggest disinfection the day after route (same day if infected)
      const lastFacilityDate = new Date(date);
      const disinfectionDate = new Date(lastFacilityDate);
      if (!hasInfected) {
        disinfectionDate.setDate(disinfectionDate.getDate() + 1);
      }

      const disinfectionEvent = {
        id: `disinfection_${Date.now()}`,
        date: disinfectionDate.toISOString().split('T')[0],
        type: 'disinfection',
        details: 'Vask og desinfeksjon av båt',
        planned: true,
        recommended: true,
        chemical: 'Virkon S (1%)',
        chemicalOptions: ['Virkon S (1%)', 'Natriumhypokloritt (50 ppm klor)', 'Hydrogenperoksid', 'Peroksyeddiksyre'],
        trigger: hasInfected
          ? 'disease'
          : (hasHighLice ? 'lice' : 'proximity'),
        description: hasInfected
          ? 'Obligatorisk desinfeksjon etter kontakt med smittet anlegg'
          : (hasHighLice
            ? 'Obligatorisk desinfeksjon etter besøk ved høye lusetall'
            : 'Anbefalt desinfeksjon etter rute i risikosone'),
        responsible_party: '',
        createdAt: new Date().toISOString()
      };

      calendarEvents.push(disinfectionEvent);

      // Auto-suggest 48-hour quarantine after disinfection (Transportforskriften §20a)
      const quarantineStartDate = new Date(disinfectionDate);
      quarantineStartDate.setDate(quarantineStartDate.getDate() + 1);
      const quarantineEndDate = new Date(quarantineStartDate);
      quarantineEndDate.setDate(quarantineEndDate.getDate() + 2); // 48 timer

      const quarantineEvent = {
        id: `quarantine_${Date.now()}`,
        date: quarantineStartDate.toISOString().split('T')[0],
        dateEnd: quarantineEndDate.toISOString().split('T')[0],
        type: 'quarantine',
        details: 'Karantene (48 timer minimum)',
        planned: true,
        recommended: true,
        duration: 48,
        minDuration: 48,
        trigger: hasInfected
          ? 'disease'
          : (hasHighLice ? 'lice' : 'proximity'),
        attestation: {
          approved: false,
          approvedBy: '',
          role: 'Fiskehelsepersonell'
        },
        description: 'Obligatorisk karantene iht. Transportforskriften §20a - båt kan ikke brukes før denne perioden er over',
        createdAt: new Date().toISOString()
      };

      calendarEvents.push(quarantineEvent);

      // Show notification with user-edit prompt
      if (hasInfected) {
        showToast('⚠️ Desinfeksjon og karantene foreslått (smittet anlegg). Klikk "Rediger" for å endre dato/midler.', 'warning');
      } else if (hasHighLice) {
        showToast('🧪 Høye lusetall oppdaget: desinfeksjon og karantene foreslått. Klikk "Rediger" for å endre dato/midler.', 'warning');
      } else {
        showToast('🟠 Desinfeksjon og karantene anbefalt (risikosone). Klikk "Rediger" for å endre dato/midler.', 'info');
      }
    }

    this.saveEvents();
    this.displayCalendar();
    this.analyzeInfectionRisk();
    const suggestions = (hasInfected || hasProximityRisk || hasHighLice)
      ? ' + desinfeksjon & karantene foreslått'
      : '';
    showToast(`✓ Rute lagt til i kalender (${newEvents.length} anlegg)${suggestions}`, 'success');
  },

  // Check if vessel is cleared for next visit (all infected visits have confirmed disinfection)
  isVesselCleared() {
    const visits = calendarEvents.filter(e => e.type === 'visit');
    if (visits.length === 0) return true; // No visits = cleared
    
    // Check for infected visits without confirmed disinfection
    const infectedVisits = visits.filter(v => v.infected === true);
    if (infectedVisits.length === 0) return true; // No infected visits = cleared
    
    // Check if all infected visits have confirmed disinfection
    const allConfirmed = infectedVisits.every(visit => {
      const visitDate = new Date(visit.date);
      const nextDay = new Date(visitDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return calendarEvents.some(e =>
        e.type === 'disinfection' &&
        e.completed === true &&
        (e.date === visit.date || e.date === nextDay.toISOString().split('T')[0])
      );
    });
    
    return allConfirmed;
  },

  // Get active quarantine hours remaining (from most recent disinfection)
  getActiveQuarantineHours() {
    const quarantines = calendarEvents.filter(e => e.type === 'quarantine');
    if (quarantines.length === 0) return 0;
    
    // Get the most recent quarantine that is still active
    const now = new Date();
    const activeQuarantines = quarantines.filter(q => {
      const endDate = new Date(q.dateEnd || q.date);
      // Add duration if it exists (in hours)
      if (q.duration) {
        endDate.setHours(endDate.getHours() + q.duration);
      }
      return endDate > now;
    });
    
    if (activeQuarantines.length === 0) return 0;
    
    // Sort by end date and get the latest
    const latest = activeQuarantines.sort((a, b) => {
      const aEnd = new Date(a.dateEnd || a.date);
      const bEnd = new Date(b.dateEnd || b.date);
      if (a.duration) aEnd.setHours(aEnd.getHours() + a.duration);
      if (b.duration) bEnd.setHours(bEnd.getHours() + b.duration);
      return bEnd - aEnd;
    })[0];
    
    if (!latest) return 0;
    
    const endDate = new Date(latest.dateEnd || latest.date);
    if (latest.duration) {
      endDate.setHours(endDate.getHours() + latest.duration);
    }
    
    const hoursRemaining = Math.max(0, (endDate - now) / (1000 * 60 * 60));
    return Math.ceil(hoursRemaining);
  },

  // Get vessel status for display
  getVesselStatus() {
    const hoursRemaining = this.getActiveQuarantineHours();
    const isCleared = this.isVesselCleared();
    
    if (hoursRemaining > 0) {
      const hours = Math.floor(hoursRemaining);
      const minutes = Math.round((hoursRemaining % 1) * 60);
      return {
        status: 'quarantine',
        text: '⏱️ Karantene aktiv',
        description: `${hours}h ${minutes}m igjen`,
        indicator: 'quarantine'
      };
    } else if (isCleared) {
      return {
        status: 'cleared',
        text: '✅ Klarert til neste besøk',
        description: 'Alle protokoller fullført',
        indicator: 'available'
      };
    } else {
      return {
        status: 'pending',
        text: '⚠️ Avventer desinfeksjon',
        description: 'Besøk på smittet anlegg må bekreftes',
        indicator: 'warning'
      };
    }
  }
};

// ====== Event Editing Functions ======

let currentEventEditData = null;

const DISINFECTION_CHEMICALS_DEFAULT = [
  'Virkon S (1%)',
  'Natriumhypokloritt (50 ppm klor)',
  'Hydrogenperoksid',
  'Peroksyeddiksyre'
];

function getDisinfectionChemicalHistory() {
  try {
    const stored = localStorage.getItem('labridae_disinfection_chemicals');
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (err) {
    console.warn('Failed to load disinfection chemical history:', err);
    return [];
  }
}

function saveDisinfectionChemicalHistory(chemical) {
  const value = (chemical || '').trim();
  if (!value) return;
  const existing = getDisinfectionChemicalHistory();
  if (!existing.includes(value)) {
    const next = [value, ...existing].slice(0, 12);
    localStorage.setItem('labridae_disinfection_chemicals', JSON.stringify(next));
  }
}

function buildDisinfectionChemicalOptions(selectEl, currentChemical) {
  const history = getDisinfectionChemicalHistory();
  const options = [];
  [...history, ...DISINFECTION_CHEMICALS_DEFAULT].forEach((item) => {
    const value = (item || '').trim();
    if (value && !options.includes(value)) {
      options.push(value);
    }
  });

  selectEl.innerHTML = '<option value="">Velg desinfeksjonsmiddel</option>'
    + options.map(opt => `<option value="${opt}">${opt}</option>`).join('')
    + '<option value="__other__">Annet...</option>';

  const normalized = (currentChemical || '').trim();
  if (normalized && options.includes(normalized)) {
    selectEl.value = normalized;
  } else if (normalized) {
    selectEl.value = '__other__';
  } else {
    selectEl.value = '';
  }
}

function openEventEditModal(eventId) {
  const modal = document.getElementById('eventEditModal');
  const combinedEvents = CalendarView.getCombinedEvents();
  const event = combinedEvents.find(e => e.id === eventId);
  
  if (!event) {
    console.warn('Event not found:', eventId);
    return;
  }
  
  currentEventEditData = { ...event };
  
  // Populate form
  const facility = event.details || event.facilityName || event.facility || 'Anlegg';
  document.getElementById('editEventFacility').value = facility;
  document.getElementById('editEventDate').value = event.date;
  document.getElementById('editEventComment').value = event.description || '';
  document.getElementById('editEventOperation').value = event.operationName || '';
  document.getElementById('editEventDuration').value = event.duration || '';
  
  // Show/hide responsible party field based on event type
  const responsiblePartyGroup = document.getElementById('responsiblePartyGroup');
  const responsiblePartyInput = document.getElementById('editEventResponsibleParty');
  const chemicalGroup = document.getElementById('disinfectionChemicalGroup');
  const chemicalSelect = document.getElementById('editEventChemicalSelect');
  const chemicalOtherInput = document.getElementById('editEventChemicalOther');
  if (event.type === 'disinfection') {
    responsiblePartyGroup.style.display = 'block';
    responsiblePartyInput.value = event.responsible_party || '';
    chemicalGroup.style.display = 'block';
    buildDisinfectionChemicalOptions(chemicalSelect, event.chemical || '');
    chemicalOtherInput.value = event.chemical || '';
    chemicalOtherInput.style.display = chemicalSelect.value === '__other__' ? 'block' : 'none';
    chemicalSelect.onchange = () => {
      chemicalOtherInput.style.display = chemicalSelect.value === '__other__' ? 'block' : 'none';
    };
  } else {
    responsiblePartyGroup.style.display = 'none';
    responsiblePartyInput.value = '';
    chemicalGroup.style.display = 'none';
    chemicalSelect.innerHTML = '<option value="">Velg desinfeksjonsmiddel</option>';
    chemicalOtherInput.value = '';
    chemicalOtherInput.style.display = 'none';
  }
  
  // Show modal
  if (!modal.classList.contains('show')) {
    modal.classList.add('show');
  }
}

function closeEventEditModal() {
  const modal = document.getElementById('eventEditModal');
  modal.classList.remove('show');
  currentEventEditData = null;
}

function saveEventEdit() {
  if (!currentEventEditData) return;
  
  const newDate = document.getElementById('editEventDate').value;
  const newComment = document.getElementById('editEventComment').value;
  const newOperation = document.getElementById('editEventOperation').value;
  const newDuration = parseInt(document.getElementById('editEventDuration').value) || 0;
  const newResponsibleParty = document.getElementById('editEventResponsibleParty').value.trim();
  const chemicalSelect = document.getElementById('editEventChemicalSelect');
  const chemicalOtherInput = document.getElementById('editEventChemicalOther');
  let newChemical = '';
  if (currentEventEditData.type === 'disinfection') {
    const selected = chemicalSelect?.value || '';
    newChemical = (selected === '__other__')
      ? (chemicalOtherInput?.value || '').trim()
      : selected.trim();
  }
  
  // Validate disinfection details
  if (currentEventEditData.type === 'disinfection' && !newChemical) {
    if (chemicalSelect) chemicalSelect.style.borderColor = '#ef4444';
    if (chemicalOtherInput) chemicalOtherInput.style.borderColor = '#ef4444';
    showToast('⚠️ Desinfeksjonsmiddel er obligatorisk', 'warning');
    return;
  }
  if (currentEventEditData.type === 'disinfection' && !newResponsibleParty) {
    document.getElementById('editEventResponsibleParty').style.borderColor = '#ef4444';
    showToast('⚠️ Firma/Person Ansvarlig er obligatorisk for desinfeksjon', 'warning');
    return;
  }
  
  // Update event data
  currentEventEditData.date = newDate;
  currentEventEditData.description = newComment;
  currentEventEditData.operationName = newOperation;
  currentEventEditData.duration = newDuration;
  if (currentEventEditData.type === 'disinfection') {
    currentEventEditData.responsible_party = newResponsibleParty;
    currentEventEditData.chemical = newChemical;
    saveDisinfectionChemicalHistory(newChemical);
  }
  
  // Mark as edited
  currentEventEditData.edited = true;
  
  // Save to storage
  // Save to calendarEvents storage
  const eventIndex = calendarEvents.findIndex(e => e.id === currentEventEditData.id);
  if (eventIndex !== -1) {
    calendarEvents[eventIndex] = { ...calendarEvents[eventIndex], ...currentEventEditData };
    CalendarView.saveEvents();
  }
  
  // Refresh display
  CalendarView.displayEventsList();
  
  closeEventEditModal();

  if (pendingCompletionEventId === currentEventEditData.id) {
    const toComplete = pendingCompletionEventId;
    pendingCompletionEventId = null;
    CalendarView.markCompleted(toComplete);
    return;
  }

  showToast('✓ Hendelse oppdatert', 'success');
}

function deleteEventEdit() {
  if (!currentEventEditData) return;
  
  if (confirm('Er du sikker på at du vil slette denne hendelsen?')) {
    calendarEvents = calendarEvents.filter(e => e.id !== currentEventEditData.id);
    CalendarView.saveEvents();
    CalendarView.displayEventsList();
    closeEventEditModal();
    showToast('✓ Hendelse slettet', 'success');
  }
}

// Export
window.CalendarView = CalendarView;
window.openEventEditModal = openEventEditModal;
window.closeEventEditModal = closeEventEditModal;
window.saveEventEdit = saveEventEdit;
window.deleteEventEdit = deleteEventEdit;
