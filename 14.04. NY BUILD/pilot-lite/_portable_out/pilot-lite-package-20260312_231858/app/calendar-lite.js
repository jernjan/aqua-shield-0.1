import {
    loadProfile,
    mapById,
    isoToLocal,
    createCell,
    toIcsDate,
    downloadTextFile
} from './common.js';

let currentProfile = null;
let vesselMap = null;
let facilityMap = null;

function fillVesselFilter(vessels) {
    const select = document.getElementById('vesselFilter');
    for (const vessel of vessels || []) {
        const option = document.createElement('option');
        option.value = vessel.id;
        option.textContent = vessel.name || vessel.id;
        select.appendChild(option);
    }
}

function getFilteredEvents() {
    const vesselFilter = document.getElementById('vesselFilter').value;
    const events = currentProfile?.calendarEvents || [];

    return events.filter(event => !vesselFilter || event.vesselId === vesselFilter);
}

function renderEvents() {
    const tbody = document.getElementById('eventTableBody');
    tbody.innerHTML = '';

    const events = getFilteredEvents();
    for (const event of events) {
        const tr = document.createElement('tr');

        tr.appendChild(createCell(event.title || '-'));
        tr.appendChild(createCell(vesselMap.get(event.vesselId)?.name || event.vesselId || '-'));
        tr.appendChild(createCell(facilityMap.get(event.facilityId)?.name || event.facilityId || '-'));
        tr.appendChild(createCell(isoToLocal(event.start)));
        tr.appendChild(createCell(isoToLocal(event.end)));
        tr.appendChild(createCell(event.status || '-'));

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

function wireEvents() {
    document.getElementById('vesselFilter').addEventListener('change', renderEvents);

    document.getElementById('exportIcsBtn').addEventListener('click', () => {
        const events = getFilteredEvents();
        const ics = buildIcs(events);
        downloadTextFile('pilot-lite-calendar.ics', ics, 'text/calendar;charset=utf-8');
    });
}

async function init() {
    const profileMeta = document.getElementById('profileMeta');

    try {
        currentProfile = await loadProfile();
        vesselMap = mapById(currentProfile.vessels || []);
        facilityMap = mapById(currentProfile.facilities || []);

        profileMeta.textContent = `Profil: ${currentProfile.profileName || '-'} · Opprettet: ${currentProfile.createdAt || '-'}`;

        fillVesselFilter(currentProfile.vessels || []);
        wireEvents();
        renderEvents();
    } catch (error) {
        profileMeta.textContent = `Feil ved lasting av profil: ${error.message}`;
    }
}

init();
