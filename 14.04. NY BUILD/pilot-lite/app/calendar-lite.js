import {
    loadProfile,
    mapById,
    isoToLocal,
    createCell,
    toIcsDate,
    downloadTextFile
} from './common.js';
import { buildPresenceEvents } from './availability-windows.js';

let currentProfile = null;
let vesselMap = null;
let facilityMap = null;
const LOCAL_CALENDAR_STORE_KEY = 'pilotLiteVesselCalendarV2';
let fleetStartDate = null;
let fleetHorizonDays = 14;

function fillVesselFilter(vessels) {
    const select = document.getElementById('vesselFilter');
    for (const vessel of vessels || []) {
        const option = document.createElement('option');
        option.value = vessel.id;
        option.textContent = vessel.name || vessel.id;
        select.appendChild(option);
    }
}

function getPresenceOptionsForVessel(vessel) {
    const category = String(vessel?.category || vessel?.type || '').toLowerCase();
    const name = String(vessel?.name || '').toLowerCase();
    if (category.includes('brønn') || category.includes('bronnb')) {
        return { beforeHours: 8, afterHours: 24, mergeRadiusKm: 28, zoneRadiusKm: 24 };
    }
    if (category.includes('service')) {
        return { beforeHours: 12, afterHours: 36, mergeRadiusKm: 45, zoneRadiusKm: 35 };
    }
    if (category.includes('inspeksjon') || category.includes('dykk') || name.includes('dykk')) {
        return { beforeHours: 18, afterHours: 60, mergeRadiusKm: 70, zoneRadiusKm: 55 };
    }
    return { beforeHours: 12, afterHours: 36, mergeRadiusKm: 45, zoneRadiusKm: 35 };
}

function getFilteredEvents() {
    const vesselFilter = document.getElementById('vesselFilter').value;
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const events = getMergedEvents();

    return events.filter((event) => {
        if (vesselFilter && event.vesselId !== vesselFilter) return false;
        if (typeFilter && String(event.type || '') !== typeFilter) return false;
        return true;
    });
}

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function overlapsDay(start, end, dayStart, dayEnd) {
    const startDate = new Date(start);
    const endDate = new Date(end || start);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
    return startDate <= dayEnd && endDate >= dayStart;
}

function formatDayLabel(date) {
    return date.toLocaleDateString('nb-NO', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function getFleetVisibleVessels() {
    const selectedVesselId = document.getElementById('vesselFilter').value;
    const vessels = currentProfile?.vessels || [];
    return selectedVesselId ? vessels.filter((vessel) => String(vessel.id) === String(selectedVesselId)) : vessels;
}

function getDayState(events, dayStart, dayEnd) {
    const dayEvents = events.filter((event) => overlapsDay(event.start, event.end, dayStart, dayEnd));
    const actualEvents = dayEvents.filter((event) => event.type !== 'presence');
    const riskEvents = actualEvents.filter((event) => ['quarantine', 'disinfection'].includes(String(event.type || '').toLowerCase()));
    const presenceEvents = dayEvents.filter((event) => event.type === 'presence');
    if (riskEvents.length > 0) {
        return {
            cls: 'risk',
            label: riskEvents.some((event) => event.type === 'quarantine') ? 'K' : 'D',
            title: riskEvents.map((event) => `${event.title} (${isoToLocal(event.start)})`).join('\n')
        };
    }
    if (actualEvents.length > 0) {
        return {
            cls: 'busy',
            label: String(actualEvents.length),
            title: actualEvents.map((event) => `${event.title} (${isoToLocal(event.start)})`).join('\n')
        };
    }
    if (presenceEvents.length > 0) {
        return {
            cls: 'presence',
            label: 'S',
            title: presenceEvents.map((event) => `${event.title} (${isoToLocal(event.start)} → ${isoToLocal(event.end)})`).join('\n')
        };
    }
    return { cls: 'free', label: '', title: 'Ingen registrerte aktiviteter' };
}

function renderFleetTimeline() {
    const wrap = document.getElementById('fleetTimelineWrap');
    const meta = document.getElementById('fleetTimelineMeta');
    if (!wrap || !meta) return;

    const vessels = getFleetVisibleVessels();
    const allEvents = getMergedEvents();
    const start = startOfDay(fleetStartDate || new Date());
    const horizon = Math.max(7, Number(fleetHorizonDays || 14));
    const days = Array.from({ length: horizon }, (_, index) => addDays(start, index));
    const todayKey = startOfDay(new Date()).toISOString();

    if (vessels.length === 0) {
        wrap.innerHTML = '<div class="fleet-empty">Ingen båter å vise.</div>';
        meta.textContent = 'Ingen båter i valgt filter.';
        return;
    }

    const rows = vessels.map((vessel) => {
        const vesselEvents = allEvents.filter((event) => String(event.vesselId || '') === String(vessel.id));
        let busyDays = 0;
        let presenceDays = 0;
        const cells = days.map((day) => {
            const dayStart = startOfDay(day);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const state = getDayState(vesselEvents, dayStart, dayEnd);
            if (state.cls === 'busy' || state.cls === 'risk') busyDays += 1;
            else if (state.cls === 'presence') presenceDays += 1;
            const isToday = dayStart.toISOString() === todayKey;
            return `
                <td class="fleet-day-cell">
                    <div class="fleet-day-btn ${state.cls} ${isToday ? 'today' : ''} ${String(document.getElementById('typeFilter')?.value || '') && state.cls === 'free' ? 'dim' : ''}" title="${state.title.replace(/"/g, '&quot;')}">
                        ${state.label || '&nbsp;'}
                    </div>
                </td>
            `;
        }).join('');
        const freeDays = Math.max(0, horizon - busyDays - presenceDays);
        return {
            html: `
                <tr>
                    <td class="fleet-vessel-cell">
                        <div class="fleet-vessel-name">${vessel.name || vessel.id}</div>
                        <div class="fleet-vessel-meta">${vessel.type || vessel.category || 'Båt'} · ${busyDays} opptatt · ${presenceDays} i sone · ${freeDays} fri</div>
                    </td>
                    ${cells}
                </tr>
            `,
            busyDays,
            presenceDays,
            freeDays
        };
    });

    const headerCells = days.map((day) => `<th>${formatDayLabel(day)}</th>`).join('');
    wrap.innerHTML = `
        <table class="fleet-grid">
            <thead>
                <tr>
                    <th class="fleet-vessel-cell" style="text-align:left;">Båt</th>
                    ${headerCells}
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => row.html).join('')}
            </tbody>
        </table>
    `;

    const totalBusy = rows.reduce((sum, row) => sum + row.busyDays, 0);
    const totalPresence = rows.reduce((sum, row) => sum + row.presenceDays, 0);
    const totalFree = rows.reduce((sum, row) => sum + row.freeDays, 0);
    meta.textContent = `${vessels.length} båter · ${horizon} dager · ${totalBusy} opptatte båtdager · ${totalPresence} sone-dager · ${totalFree} frie båtdager.`;
}

function normalizeEvent(event, source = 'profile') {
    const start = event.start || (event.date ? `${event.date}T09:00:00` : null);
    const end = event.end || (start ? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString() : null);
    return {
        ...event,
        id: event.id || `${source}_${event.vesselId || ''}_${event.facilityId || ''}_${start || Date.now()}`,
        start,
        end,
        type: event.type || 'visit',
        source,
        status: event.status || (event.completed ? 'approved' : 'planned')
    };
}

function getLocalEvents() {
    try {
        const store = JSON.parse(localStorage.getItem(LOCAL_CALENDAR_STORE_KEY) || '{}');
        return Object.entries(store).flatMap(([vesselId, state]) => {
            const events = Array.isArray(state?.events) ? state.events : [];
            return events.map((event) => normalizeEvent({ ...event, vesselId: event.vesselId || vesselId }, 'local'));
        });
    } catch (_) {
        return [];
    }
}

function getMergedEvents() {
    const profileEvents = (currentProfile?.calendarEvents || []).map((event) => normalizeEvent(event, 'profile'));
    const localEvents = getLocalEvents();
    const merged = new Map();
    for (const event of [...profileEvents, ...localEvents]) {
        merged.set(String(event.id), { ...merged.get(String(event.id)), ...event });
    }
    const baseEvents = [...merged.values()].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const byVessel = new Map();
    for (const event of baseEvents) {
        const key = String(event.vesselId || '');
        if (!key) continue;
        if (!byVessel.has(key)) byVessel.set(key, []);
        byVessel.get(key).push(event);
    }
    const presenceEvents = [...byVessel.entries()].flatMap(([vesselId, events]) =>
        buildPresenceEvents(events, (facilityId) => facilityMap.get(facilityId), getPresenceOptionsForVessel(vesselMap.get(vesselId))).map((event) => ({
            ...event,
            vesselId,
            source: 'derived'
        }))
    );
    return [...baseEvents, ...presenceEvents]
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function formatEventType(type) {
    const labels = {
        visit: 'Besøk',
        operation: 'Oppdrag',
        disinfection: 'Desinfeksjon',
        quarantine: 'Karantene',
        presence: 'Tilstede i område'
    };
    return labels[String(type || '').toLowerCase()] || type || '-';
}

function formatSource(source) {
    if (source === 'local') return 'Lokal';
    if (source === 'derived') return 'Avledet';
    return 'Profil';
}

function renderEvents() {
    const tbody = document.getElementById('eventTableBody');
    const emptyMsg = document.getElementById('emptyMsg');
    tbody.innerHTML = '';

    const events = getFilteredEvents();

    if (emptyMsg) {
        emptyMsg.style.display = events.length === 0 ? '' : 'none';
    }

    for (const event of events) {
        const tr = document.createElement('tr');

        tr.appendChild(createCell(event.title || '-'));
        tr.appendChild(createCell(vesselMap.get(event.vesselId)?.name || event.vesselId || '-'));
        tr.appendChild(createCell(facilityMap.get(event.facilityId)?.name || event.facilityId || '-'));
        tr.appendChild(createCell(isoToLocal(event.start)));
        tr.appendChild(createCell(isoToLocal(event.end)));
        tr.appendChild(createCell(formatEventType(event.type)));

        const tdStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'status-badge';
        badge.textContent = event.status || '-';
        tdStatus.appendChild(badge);
        tr.appendChild(tdStatus);

        tr.appendChild(createCell(formatSource(event.source)));

        tbody.appendChild(tr);
    }
}

function buildIcs(events) {
    const now = toIcsDate(new Date().toISOString());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kyst Monitor//Pilot Lite//NO'
    ];

    for (const event of events) {
        const dtStart = toIcsDate(event.start);
        const dtEnd = toIcsDate(event.end);
        if (!dtStart || !dtEnd) continue;

        const vesselName = vesselMap.get(event.vesselId)?.name || event.vesselId || 'Ukjent båt';
        const facilityName = facilityMap.get(event.facilityId)?.name || event.facilityId || 'Ukjent anlegg';
        const uid = `${event.id || Math.random().toString(36).slice(2)}@kyst-monitor-lite`;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${now}`);
        lines.push(`DTSTART:${dtStart}`);
        lines.push(`DTEND:${dtEnd}`);
        lines.push(`SUMMARY:${(event.title || 'Hendelse').replace(/,/g, '\\,')}`);
        lines.push(`DESCRIPTION:Båt: ${vesselName} | Anlegg: ${facilityName}`);
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r?\n|\r/g, ' ').trim();
    if (/[,";]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function buildCalendarCsv(events) {
    const headers = ['Tittel', 'Båt', 'Anlegg', 'Start', 'Slutt', 'Type', 'Status', 'Kilde', 'VesselId', 'FacilityId'];
    const lines = [headers.map(csvEscape).join(',')];
    for (const event of events) {
        const row = [
            event.title || '',
            vesselMap.get(event.vesselId)?.name || event.vesselId || '',
            facilityMap.get(event.facilityId)?.name || event.facilityId || '',
            isoToLocal(event.start),
            isoToLocal(event.end),
            formatEventType(event.type),
            event.status || '',
            formatSource(event.source),
            event.vesselId || '',
            event.facilityId || ''
        ];
        lines.push(row.map(csvEscape).join(','));
    }
    return lines.join('\n');
}

function setCalendarSyncMeta(message) {
    const meta = document.getElementById('calendarSyncMeta');
    if (meta) meta.textContent = message;
}

function safeFilePart(value, fallback = 'alle') {
    const normalized = String(value || '').trim().toLowerCase();
    const slug = normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return slug || fallback;
}

function getExportContext(events) {
    const vesselId = document.getElementById('vesselFilter')?.value || '';
    const type = document.getElementById('typeFilter')?.value || '';
    const vesselName = vesselId ? (vesselMap.get(vesselId)?.name || vesselId) : 'alle-bater';
    const typeName = type || 'alle-typer';
    const today = new Date().toISOString().slice(0, 10);
    const vesselPart = safeFilePart(vesselName, 'alle_bater');
    const typePart = safeFilePart(typeName, 'alle_typer');
    return {
        events,
        vesselId,
        type,
        vesselName,
        typeName,
        date: today,
        baseName: `pilot-lite-kalender_${vesselPart}_${typePart}_${today}`
    };
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    input.remove();
    if (!ok) throw new Error('Kunne ikke kopiere automatisk.');
}

function showCalendarSyncHelp() {
    alert(
        'Kalendersynk i Pilot Lite:\n\n'
        + '1) Klikk "Eksporter iCal (.ics)" for import i Outlook/Google/andre interne kalendere.\n'
        + '2) Klikk "Kopier iCal" for å lime inn rå iCal-tekst i interne integrasjoner.\n'
        + '3) Klikk "Eksporter CSV" for Excel/tabellverktøy uten Excel-lisenskrav.\n\n'
        + 'Tips: Bruk filter for båt/type før eksport slik at filen kun inneholder relevant utsnitt.'
    );
}

function exportCalendarPack() {
    const events = getFilteredEvents();
    const context = getExportContext(events);
    const ics = buildIcs(events);
    const csv = buildCalendarCsv(events);
    const readme = [
        'Pilot Lite kalenderpakke',
        `Dato: ${new Date().toLocaleString('nb-NO')}`,
        `Filter båt: ${context.vesselName}`,
        `Filter type: ${context.typeName}`,
        `Antall hendelser: ${events.length}`,
        '',
        'Filer:',
        `- ${context.baseName}.ics`,
        `- ${context.baseName}.csv`,
        `- ${context.baseName}_README.txt`,
        '',
        'Bruk:',
        '- .ics for Outlook/Google/interne kalendersystemer.',
        '- .csv for Excel/BI/tabellverktøy.'
    ].join('\n');

    downloadTextFile(`${context.baseName}.ics`, ics, 'text/calendar;charset=utf-8');
    downloadTextFile(`${context.baseName}.csv`, csv, 'text/csv;charset=utf-8');
    downloadTextFile(`${context.baseName}_README.txt`, readme, 'text/plain;charset=utf-8');
    setCalendarSyncMeta(`Eksporterte pakke (${events.length} hendelser): .ics + .csv + README.`);
}

function wireEvents() {
    document.getElementById('vesselFilter').addEventListener('change', renderEvents);
    document.getElementById('vesselFilter').addEventListener('change', renderFleetTimeline);
    document.getElementById('typeFilter')?.addEventListener('change', renderEvents);
    document.getElementById('typeFilter')?.addEventListener('change', renderFleetTimeline);

    document.getElementById('fleetStartDate')?.addEventListener('change', (event) => {
        fleetStartDate = event.target.value ? new Date(`${event.target.value}T00:00:00`) : new Date();
        renderFleetTimeline();
    });
    document.getElementById('fleetHorizon')?.addEventListener('change', (event) => {
        fleetHorizonDays = Number(event.target.value || 14) || 14;
        renderFleetTimeline();
    });

    document.getElementById('exportIcsBtn').addEventListener('click', () => {
        const events = getFilteredEvents();
        const context = getExportContext(events);
        const ics = buildIcs(events);
        downloadTextFile(`${context.baseName}.ics`, ics, 'text/calendar;charset=utf-8');
        setCalendarSyncMeta(`Eksporterte ${events.length} hendelser til .ics.`);
    });

    document.getElementById('copyIcsBtn')?.addEventListener('click', async () => {
        const events = getFilteredEvents();
        const ics = buildIcs(events);
        try {
            await copyTextToClipboard(ics);
            setCalendarSyncMeta(`Kopierte iCal for ${events.length} hendelser til utklippstavlen.`);
        } catch (error) {
            setCalendarSyncMeta(`Kopiering feilet: ${error?.message || 'ukjent feil'}`);
        }
    });

    document.getElementById('exportCalendarCsvBtn')?.addEventListener('click', () => {
        const events = getFilteredEvents();
        const context = getExportContext(events);
        const csv = buildCalendarCsv(events);
        downloadTextFile(`${context.baseName}.csv`, csv, 'text/csv;charset=utf-8');
        setCalendarSyncMeta(`Eksporterte ${events.length} hendelser til CSV.`);
    });

    document.getElementById('copyCalendarCsvBtn')?.addEventListener('click', async () => {
        const events = getFilteredEvents();
        const csv = buildCalendarCsv(events);
        try {
            await copyTextToClipboard(csv);
            setCalendarSyncMeta(`Kopierte CSV for ${events.length} hendelser til utklippstavlen.`);
        } catch (error) {
            setCalendarSyncMeta(`CSV-kopiering feilet: ${error?.message || 'ukjent feil'}`);
        }
    });

    document.getElementById('exportCalendarPackBtn')?.addEventListener('click', exportCalendarPack);

    document.getElementById('calendarSyncHelpBtn')?.addEventListener('click', showCalendarSyncHelp);
}

async function init() {
    const profileMeta = document.getElementById('profileMeta');

    try {
        currentProfile = await loadProfile();
        vesselMap = mapById(currentProfile.vessels || []);
        facilityMap = mapById(currentProfile.facilities || []);
        fleetStartDate = new Date();

        profileMeta.textContent = `Profil: ${currentProfile.profileName || '-'} · Opprettet: ${currentProfile.createdAt || '-'}`;
        const fleetStartDateInput = document.getElementById('fleetStartDate');
        if (fleetStartDateInput) {
            const yyyy = fleetStartDate.getFullYear();
            const mm = String(fleetStartDate.getMonth() + 1).padStart(2, '0');
            const dd = String(fleetStartDate.getDate()).padStart(2, '0');
            fleetStartDateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        fillVesselFilter(currentProfile.vessels || []);
        wireEvents();
        renderEvents();
        renderFleetTimeline();
    } catch (error) {
        profileMeta.textContent = `Feil ved lasting av profil: ${error.message}`;
    }
}

init();
