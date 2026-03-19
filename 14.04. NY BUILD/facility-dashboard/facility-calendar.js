/**
 * Kalender for Anleggsida
 * Viser ukesvisning med plantede båtbesøk
 * Integrer med "Del rute" fra båtsiden
 */

const CALENDAR_API_BASE = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8000';
const FACILITY_CALENDAR_SCOPE_KEY = 'facilityCalendarScope';

class FacilityCalendar {
  constructor() {
    this.facilityCode = null;
    this.events = []; // Array av {date, time, vessel, status, contact, notes}
    this.greenDays = new Set(); // 0=man, 1=tir, ..., 6=søn
    this.blockedDates = new Set(); // YYYY-MM-DD for enkeltdager (rød)
    this.pollingInterval = null; // For real-time updates
  }

  getCalendarScope() {
    const scope = localStorage.getItem(FACILITY_CALENDAR_SCOPE_KEY);
    return scope === 'per-facility' ? 'per-facility' : 'global';
  }

  setCalendarScope(scope) {
    const normalized = scope === 'per-facility' ? 'per-facility' : 'global';
    localStorage.setItem(FACILITY_CALENDAR_SCOPE_KEY, normalized);
  }

  getStorageKey(prefix) {
    const scope = this.getCalendarScope();
    if (scope === 'per-facility' && this.facilityCode) {
      return `${prefix}_${this.facilityCode}`;
    }
    return `${prefix}_global`;
  }

  /**
   * Last kalender fra localStorage OG backend API
   * @param {string} facilityCode - Anleggskode for å isolere data
   */
  async loadFromStorage(facilityCode = null) {
    if (facilityCode) {
      this.facilityCode = facilityCode;
    }
    
    try {
      const scope = this.getCalendarScope();

      // Load local events
      const key = this.getStorageKey('facilityCalendar');
      const stored = localStorage.getItem(key);
      const localEvents = stored ? JSON.parse(stored) : [];
      
      // Load green days
      const greenDaysKey = this.getStorageKey('facilityGreenDays');
      const greenDaysStored = localStorage.getItem(greenDaysKey);
      if (greenDaysStored) {
        this.greenDays = new Set(JSON.parse(greenDaysStored));
      }

      // Load blocked dates (per-day red toggle)
      const blockedDatesKey = this.getStorageKey('facilityBlockedDates');
      const blockedDatesStored = localStorage.getItem(blockedDatesKey);
      if (blockedDatesStored) {
        this.blockedDates = new Set(JSON.parse(blockedDatesStored));
      }

      // Fetch from API if facility code exists OR global test scope is enabled
      if (this.facilityCode || scope === 'global') {
        try {
          await this.loadAvailabilityFromAPI();
          const proposalsUrl = (scope === 'per-facility' && this.facilityCode)
            ? `${CALENDAR_API_BASE}/api/route-proposals?facility_code=${this.facilityCode}`
            : `${CALENDAR_API_BASE}/api/route-proposals`;
          const response = await fetch(proposalsUrl);
          if (response.ok) {
            const data = await response.json();
            
            
            // Convert API proposals to calendar events
            const apiEvents = data.proposals.map(p => ({
              id: p.id,
              date: p.proposed_date,
              time: p.proposed_time,
              vessel: p.vessel_name,
              contact: p.contact_person || '',
              notes: p.notes || '',
              approved: p.status === 'approved',
              status: p.status,
              type: 'vessel-visit',
              comment: p.facility_comment,
              mmsi: p.mmsi,
              alternativeDate: p.alternative_date,
              alternativeTime: p.alternative_time,
              fromAPI: true
            }));

            // Merge with local events (API events take precedence)
            this.events = this.mergeEvents(localEvents, apiEvents);
          } else {
            this.events = localEvents;
          }
        } catch (apiError) {
          console.warn('Could not fetch from API:', apiError);
          this.events = localEvents;
        }
      } else {
        this.events = localEvents;
      }
    } catch (e) {
      console.error('Feil ved lasting av kalender:', e);
      this.events = [];
    }
  }

  /**
   * Merge local and API events, prefer API data
   */
  mergeEvents(localEvents, apiEvents) {
    const apiIds = new Set(apiEvents.map(e => e.id));
    const localOnly = localEvents.filter(e => !e.fromAPI || !apiIds.has(e.id));
    return [...apiEvents, ...localOnly];
  }

  /**
   * Start polling for new proposals
   */
  startPolling(intervalMs = 15 * 60 * 1000) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      if (this.facilityCode) {
        await this.loadFromStorage(this.facilityCode);
        if (window.calendarUI) {
          window.calendarUI.render();
        }
      }
    }, intervalMs);

    
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      
    }
  }

  /**
   * Lagre kalender til localStorage
   */
  saveToStorage() {
    const key = this.getStorageKey('facilityCalendar');
    localStorage.setItem(key, JSON.stringify(this.events));
    
    const greenDaysKey = this.getStorageKey('facilityGreenDays');
    localStorage.setItem(greenDaysKey, JSON.stringify([...this.greenDays]));

    const blockedDatesKey = this.getStorageKey('facilityBlockedDates');
    localStorage.setItem(blockedDatesKey, JSON.stringify([...this.blockedDates]));
  }

  /**
   * Legg til båtbesøk
   * @param {Date} date
   * @param {string} time - HH:MM format
   * @param {string} vesselName
   * @param {string} contact - Kontaktperson
   * @param {string} notes - Ekstra info
   * @param {boolean} isApproved - Godkjent av anlegget
   */
  addVesselVisit(date, time, vesselName, contact = '', notes = '', isApproved = false) {
    const event = {
      id: Date.now(),
      date: date.toISOString().split('T')[0],
      time: time,
      vessel: vesselName,
      contact: contact,
      notes: notes,
      approved: isApproved,
      status: isApproved ? 'approved' : 'pending',
      type: 'vessel-visit'
    };

    this.events.push(event);
    this.events.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
    this.saveToStorage();
    
    return event;
  }

  /**
   * Godkjenn/avslå båtbesøk (synkroniserer med API)
   * @param {number} eventId
   * @param {boolean} approved
   * @param {string} comment - Årsak hvis avslag
   */
  async approveVisit(eventId, approved, comment = '') {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return null;

    // Update local event
    event.approved = approved;
    event.status = approved ? 'approved' : 'rejected';
    if (comment) event.comment = comment;
    
    // Sync to API if event is from API
    if (event.fromAPI) {
      try {
        const endpoint = approved 
          ? `${CALENDAR_API_BASE}/api/route-proposals/${eventId}/approve`
          : `${CALENDAR_API_BASE}/api/route-proposals/${eventId}/reject`;
        
        const body = approved 
          ? JSON.stringify({ comment })
          : JSON.stringify({ reason: comment || 'Avvist av anlegget' });

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });

        if (response.ok) {
          
        } else {
          console.warn('⚠️ Could not sync to API, saved locally only');
        }
      } catch (apiError) {
        console.warn('⚠️ API sync failed:', apiError);
      }
    }

    this.saveToStorage();
    return event;
  }

  /**
   * Foreslå alternativ tid
   */
  async suggestAlternativeTime(eventId, alternativeDate, alternativeTime, comment = '') {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return null;

    event.status = 'alternative_suggested';
    event.alternativeDate = alternativeDate;
    event.alternativeTime = alternativeTime;
    event.comment = comment;

    // Sync to API
    if (event.fromAPI) {
      try {
        const response = await fetch(`${CALENDAR_API_BASE}/api/route-proposals/${eventId}/suggest-alternative`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alternative_date: alternativeDate,
            alternative_time: alternativeTime,
            comment: comment
          })
        });

        if (response.ok) {
          
        }
      } catch (apiError) {
        console.warn('⚠️ API sync failed:', apiError);
      }
    }

    this.saveToStorage();
    return event;
  }

  /**
   * Oppdater anleggets tilgjengelighetsdager via API
   */
  async syncGreenDaysToAPI() {
    const scope = this.getCalendarScope();
    const targetFacilityCode = scope === 'per-facility'
      ? this.facilityCode
      : '__GLOBAL__';
    if (!targetFacilityCode) return;

    try {
      const response = await fetch(`${CALENDAR_API_BASE}/api/facilities/${targetFacilityCode}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          green_days: [...this.greenDays],
          blocked_dates: [...this.blockedDates],
          notes: '',
          capacity_per_day: 5
        })
      });

      if (response.ok) {
        
      }
    } catch (e) {
      console.warn('⚠️ Could not sync green days to API:', e);
    }
  }

  /**
   * Sett "grønne dager" for anlegget
   * @param {Array<number>} daysOfWeek - [0-6] hvor 0=mandag
   */
  setGreenDays(daysOfWeek) {
    this.greenDays = new Set(daysOfWeek);
    this.saveToStorage();
  }

  /**
   * Toggle a blocked date (YYYY-MM-DD)
   * @param {string} dateStr
   */
  toggleBlockedDate(dateStr) {
    if (this.blockedDates.has(dateStr)) {
      this.blockedDates.delete(dateStr);
    } else {
      this.blockedDates.add(dateStr);
    }
    this.saveToStorage();
  }

  /**
   * Load availability (green days + blocked dates) from API
   */
  async loadAvailabilityFromAPI() {
    const scope = this.getCalendarScope();
    const targetFacilityCode = scope === 'per-facility'
      ? this.facilityCode
      : '__GLOBAL__';
    if (!targetFacilityCode) return;

    try {
      const response = await fetch(`${CALENDAR_API_BASE}/api/facilities/${targetFacilityCode}/availability`);
      if (!response.ok) return;

      const data = await response.json();
      const greenDays = Array.isArray(data.available_days_indices) ? data.available_days_indices : [];
      const blockedDates = Array.isArray(data.blocked_dates) ? data.blocked_dates : [];

      this.greenDays = new Set(greenDays);
      this.blockedDates = new Set(blockedDates);
    } catch (e) {
      console.warn('⚠️ Could not load availability from API:', e);
    }
  }

  /**
   * Hent kalender for en bestemt uke
   * @param {Date} weekStart - Mandag i uka
   * @returns {Object} - {mon, tue, wed, thu, fri, sat, sun} med events
   */
  getWeekCalendar(weekStart) {
    const calendar = {
      mon: { date: new Date(weekStart), events: [], isGreen: this.greenDays.has(0) },
      tue: { date: new Date(weekStart.getTime() + 1*24*60*60*1000), events: [], isGreen: this.greenDays.has(1) },
      wed: { date: new Date(weekStart.getTime() + 2*24*60*60*1000), events: [], isGreen: this.greenDays.has(2) },
      thu: { date: new Date(weekStart.getTime() + 3*24*60*60*1000), events: [], isGreen: this.greenDays.has(3) },
      fri: { date: new Date(weekStart.getTime() + 4*24*60*60*1000), events: [], isGreen: this.greenDays.has(4) },
      sat: { date: new Date(weekStart.getTime() + 5*24*60*60*1000), events: [], isGreen: this.greenDays.has(5) },
      sun: { date: new Date(weekStart.getTime() + 6*24*60*60*1000), events: [], isGreen: this.greenDays.has(6) }
    };

    // Fyll events
    this.events.forEach(event => {
      const eventDate = event.date;
      for (const [day, data] of Object.entries(calendar)) {
        const dayStr = data.date.toISOString().split('T')[0];
        if (eventDate === dayStr) {
          data.events.push(event);
          break;
        }
      }
    });

    return calendar;
  }

  /**
   * Hent neste 3 båter
   */
  getNext3Vessels() {
    const now = new Date();
    return this.events
      .filter(e => new Date(e.date + 'T' + e.time) >= now && e.type === 'vessel-visit')
      .slice(0, 3);
  }

  /**
   * Hent risikosammendrag for i dag
   */
  getTodaysSummary() {
    const today = new Date().toISOString().split('T')[0];
    const todaysEvents = this.events.filter(e => e.date === today && e.type === 'vessel-visit');
    
    const approved = todaysEvents.filter(e => e.approved).length;
    const pending = todaysEvents.filter(e => !e.approved && e.status !== 'rejected').length;
    const rejected = todaysEvents.filter(e => e.status === 'rejected').length;

    return { approved, pending, rejected };
  }
}

/**
 * Render kalender UI
 */
class CalendarUI {
  constructor(facilityCalendar, containerId) {
    this.calendar = facilityCalendar;
    this.container = document.getElementById(containerId);
    this.currentWeekStart = this.getWeekStart(new Date());
  }

  /**
   * Få mandag i gjeldende uke
   */
  getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Tegn kalender (full månedsvisning som båtkalender)
   */
  render() {
    if (!this.container) return;

    const year = this.currentWeekStart.getFullYear();
    const month = this.currentWeekStart.getMonth();
    const monthName = this.formatMonthLabel(this.currentWeekStart);
    const allEvents = this.calendar.events;
    const todaySummary = this.calendar.getTodaysSummary();

    // Hent første og siste dag i måneden
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    let html = `
      <section class="facility-calendar-sidebar" id="calendarPanel">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: white;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 700;">📅 Besøkskalender</h2>
          <button onclick="calendarUI.closeCalendar()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>

        <!-- Måned-navigasjon -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <button class="btn-small" onclick="calendarUI.prevMonth()" style="padding: 6px 12px; font-size: 14px; font-weight: 600;">← Forrige</button>
          <span style="font-size: 18px; font-weight: 700; color: #1f2937; min-width: 180px; text-align: center;">${monthName}</span>
          <button class="btn-small" onclick="calendarUI.nextMonth()" style="padding: 6px 12px; font-size: 14px; font-weight: 600;">Neste →</button>
        </div>

        <!-- Full månedskalender (Sun-Sat) -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
              `<div style="text-align: center; font-weight: 600; font-size: 12px; padding: 8px; color: #6b7280;">${day}</div>`
            ).join('')}
          </div>
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
            ${this.renderCalendarDays(year, month, daysInMonth, startingDayOfWeek, allEvents)}
          </div>
          <div class="calendar-day-hint">Klikk på ikonet i øvre høyre hjørne for å blokkere/åpne enkelt-dager</div>
        </div>

        <!-- Planlagte Hendelser med handlingsknapper -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #1f2937;">📋 Planlagte Hendelser</h4>
          ${this.renderEventList(allEvents)}
        </div>

        <!-- Dags sammendrag -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #1f2937;">📊 I dag</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <div style="text-align: center; padding: 8px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
              <div style="font-size: 16px; font-weight: 700; color: #10b981;">${todaySummary.approved || 0}</div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Godkjent</div>
            </div>
            <div style="text-align: center; padding: 8px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px;">
              <div style="font-size: 16px; font-weight: 700; color: #f59e0b;">${todaySummary.pending || 0}</div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Avventer</div>
            </div>
            <div style="text-align: center; padding: 8px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px;">
              <div style="font-size: 16px; font-weight: 700; color: #ef4444;">${todaySummary.rejected || 0}</div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Avslått</div>
            </div>
          </div>
        </div>

        <!-- Tilgjengelige dager innstillinger -->
        <div class="calendar-settings" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #1f2937;">⏰ Tilgjengelige dager</h4>
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 4px;">Kalendermodus (test)</label>
            <select onchange="calendarUI.changeCalendarScope(this.value)" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px;">
              <option value="global" ${this.calendar.getCalendarScope() === 'global' ? 'selected' : ''}>Én kalender for alle anlegg</option>
              <option value="per-facility" ${this.calendar.getCalendarScope() === 'per-facility' ? 'selected' : ''}>Én kalender per anlegg</option>
            </select>
          </div>
          <p style="font-size: 11px; color: #6b7280; margin: 0 0 10px 0;">Velg dager når anlegget tar imot båter</p>
          <div class="green-days-picker">
            ${['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((d, i) => `
              <label class="day-checkbox" style="display: inline-flex; align-items: center; margin-right: 8px; margin-bottom: 8px;">
                <input type="checkbox" ${this.calendar.greenDays.has(i) ? 'checked' : ''} 
                       onchange="calendarUI.toggleGreenDay(${i})" style="margin-right: 4px;">
                <span style="font-size: 12px;">${d}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </section>
    `;

    this.container.innerHTML = html;

    if (typeof updateStatusPanel === 'function') {
      updateStatusPanel();
    }
  }

  /**
   * Render kalenderdager (Sun-Sat grid)
   */
  renderCalendarDays(year, month, daysInMonth, startingDayOfWeek, events) {
    let html = '';
    const today = new Date().toISOString().split('T')[0];
    
    // Tomme celler før måneden starter (søndag = 0)
    for (let i = 0; i < startingDayOfWeek; i++) {
      html += '<div style="background: #f9fafb; min-height: 60px; border-radius: 4px;"></div>';
    }
    
    // Kalenderdager
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = dateStr === today;
      const dayOfWeek = new Date(dateStr).getDay();
      const norwDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
      const isGreenDay = this.calendar.greenDays.has(norwDayOfWeek);
      const isBlockedDate = this.calendar.blockedDates.has(dateStr);
      const dayIndicator = isBlockedDate ? '🚫' : (isGreenDay ? '🟢' : '🔴');
      const dayClass = isBlockedDate ? 'calendar-day blocked' : 'calendar-day';
      const dayBackground = isBlockedDate ? '#fee2e2' : (isToday ? '#dbeafe' : '#ffffff');
      const dayBorder = isToday ? '2px solid #3b82f6' : (isBlockedDate ? '2px solid #ef4444' : '1px solid #e5e7eb');
      
      html += `
        <div class="${dayClass}" style="background: ${dayBackground}; border: ${dayBorder}; border-radius: 4px; padding: 4px; min-height: 60px; position: relative;">
          <div style="font-weight: 600; font-size: 13px; color: #1f2937; margin-bottom: 2px;">${day}</div>
          <button class="calendar-day-toggle" title="Klikk for å blokkere/åpne dagen" onclick="calendarUI.toggleBlockedDate('${dateStr}')" type="button">${dayIndicator}</button>
          ${dayEvents.length > 0 ? `
            <div style="font-size: 10px; margin-top: 4px;">
              ${dayEvents.slice(0, 2).map(e => `
                <div style="background: ${e.status === 'approved' ? '#d1fae5' : e.status === 'rejected' ? '#fee2e2' : '#fef3c7'}; padding: 2px 4px; border-radius: 2px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${e.vessel}
                </div>
              `).join('')}
              ${dayEvents.length > 2 ? `<div style="font-size: 9px; color: #6b7280;">+${dayEvents.length - 2} mer</div>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    return html;
  }

  /**
   * Render hendelsesliste med handlingsknapper
   */
  renderEventList(events) {
    if (events.length === 0) {
      return '<p style="color: #9ca3af; font-size: 12px; text-align: center;">Ingen planlagte besøk</p>';
    }
    
    // Sorter etter dato
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)
    );
    
    return sortedEvents.map(event => {
      const statusColor = event.status === 'approved' ? '#10b981' : 
                          event.status === 'rejected' ? '#ef4444' : '#f59e0b';
      const statusText = event.status === 'approved' ? '✅ Godkjent' : 
                         event.status === 'rejected' ? '❌ Avslått' : '⏳ Avventer';
      
      return `
        <div style="background: #f9fafb; border-left: 4px solid ${statusColor}; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #1f2937; font-size: 13px;">${event.vessel}</div>
              <div style="color: #6b7280; font-size: 12px; margin-top: 2px;">${event.date} kl. ${event.time}</div>
              ${event.contact ? `<div style="color: #6b7280; font-size: 11px; margin-top: 2px;">📞 ${event.contact}</div>` : ''}
              ${event.notes ? `<div style="color: #6b7280; font-size: 11px; margin-top: 4px; font-style: italic;">${event.notes}</div>` : ''}
              ${event.comment ? `<div style="color: #ef4444; font-size: 11px; margin-top: 4px; font-weight: 600;">Kommentar: ${event.comment}</div>` : ''}
              <div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: ${statusColor};">
                ${statusText}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-left: 10px;">
              ${event.status === 'pending' ? `
                <button onclick="calendarUI.approveEvent(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✓ Godkjenn</button>
                <button onclick="calendarUI.editEvent(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✎ Rediger</button>
                <button onclick="calendarUI.addComment(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">💬 Kommentar</button>
                <button onclick="calendarUI.rejectEvent(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✗ Avvis</button>
              ` : event.status === 'approved' ? `
                <button onclick="calendarUI.addComment(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">💬 Kommentar</button>
                <button onclick="calendarUI.rejectEvent(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✗ Avvis</button>
              ` : `
                <button onclick="calendarUI.approveEvent(${event.id})" style="padding: 4px 8px; font-size: 11px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✓ Godkjenn</button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Format month label
   */
  formatMonthLabel(date) {
    const months = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  /**
   * Format uke-label
   */
  formatWeekLabel(date) {
    return `${date.getDate()}. ${this.getMonthName(date.getMonth())} - ${new Date(date.getTime() + 6*24*60*60*1000).getDate()}. ${this.getMonthName(date.getMonth())}`;
  }

  getMonthName(month) {
    const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
    return months[month];
  }

  /**
   * Navigasjon - måneder
   */
  prevMonth() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentWeekStart = newDate;
    this.render();
  }

  nextMonth() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentWeekStart = newDate;
    this.render();
  }

  /**
   * Godkjenn hendelse
   */
  async approveEvent(eventId) {
    await this.calendar.approveVisit(eventId, true);
    this.render();
    
  }

  /**
   * Avvis hendelse
   */
  async rejectEvent(eventId) {
    const reason = prompt('Årsak til avvisning (valgfritt):');
    await this.calendar.approveVisit(eventId, false, reason || '');
    this.render();
    
  }

  /**
   * Rediger hendelse
   */
  async editEvent(eventId) {
    const event = this.calendar.events.find(e => e.id === eventId);
    if (!event) return;
    
    const newDate = prompt('Ny dato (YYYY-MM-DD):', event.date);
    const newTime = prompt('Ny tid (HH:MM):', event.time);
    const newNotes = prompt('Nye notater:', event.notes || '');
    
    if (newDate && newTime) {
      // Suggest alternative time instead of direct edit
      await this.calendar.suggestAlternativeTime(eventId, newDate, newTime, `Foreslått endring: ${newNotes}`);
      this.render();
      
    }
  }

  /**
   * Legg til kommentar på hendelse
   */
  async addComment(eventId) {
    const event = this.calendar.events.find(e => e.id === eventId);
    if (!event) return;
    
    const comment = prompt('Legg til kommentar:', event.comment || '');
    if (comment !== null) {
      event.comment = comment;
      this.calendar.saveToStorage();
      this.render();
      
    }
  }

  /**
   * Lukk kalender
   */
  closeCalendar() {
    if (this.container && this.container.style) {
      this.container.style.display = 'none';
    }
  }

  async toggleGreenDay(dayIndex) {
    if (this.calendar.greenDays.has(dayIndex)) {
      this.calendar.greenDays.delete(dayIndex);
    } else {
      this.calendar.greenDays.add(dayIndex);
    }
    this.calendar.saveToStorage();
    await this.calendar.syncGreenDaysToAPI(); // Sync to backend
    this.render();
  }

  async toggleBlockedDate(dateStr) {
    this.calendar.toggleBlockedDate(dateStr);
    await this.calendar.syncGreenDaysToAPI();
    this.render();
  }

  async changeCalendarScope(scope) {
    this.calendar.setCalendarScope(scope);
    await this.calendar.loadFromStorage(this.calendar.facilityCode);
    this.render();
  }
}

// Global instances
let facilityCalendar;
let calendarUI;

/**
 * Initialisering
 */
async function initCalendar(facilityCode = null) {
  facilityCalendar = new FacilityCalendar();
  if (facilityCode) {
    facilityCalendar.facilityCode = facilityCode;
  }
  calendarUI = new CalendarUI(facilityCalendar, 'calendarContainer');

  // Load calendar data from localStorage and API
  if (facilityCode) {
    await facilityCalendar.loadFromStorage(facilityCode);
    calendarUI.render();
    
    // Start polling for new proposals every 15 minutes
    facilityCalendar.startPolling(15 * 60 * 1000);
    
  } else {
    await facilityCalendar.loadFromStorage();
    calendarUI.render();
  }
}
