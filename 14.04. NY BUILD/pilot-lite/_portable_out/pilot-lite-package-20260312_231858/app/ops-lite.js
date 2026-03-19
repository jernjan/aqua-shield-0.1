import { loadProfile, mapById, createCell } from './common.js';

function renderVessels(profile, companyMap) {
    const tbody = document.getElementById('vesselTableBody');
    tbody.innerHTML = '';

    for (const vessel of profile.vessels || []) {
        const tr = document.createElement('tr');
        const company = companyMap.get(vessel.companyId)?.name || vessel.companyId || '-';
        const hasMmsi = !!(vessel.mmsi && String(vessel.mmsi).trim());

        tr.appendChild(createCell(vessel.name));
        tr.appendChild(createCell(company));
        tr.appendChild(createCell(vessel.mmsi || '-'));
        tr.appendChild(createCell(vessel.type || '-'));
        tr.appendChild(createCell(hasMmsi ? 'Ja' : 'Nei'));

        tbody.appendChild(tr);
    }
}

function renderFacilities(profile, companyMap) {
    const tbody = document.getElementById('facilityTableBody');
    tbody.innerHTML = '';

    for (const facility of profile.facilities || []) {
        const tr = document.createElement('tr');
        const company = companyMap.get(facility.companyId)?.name || facility.companyId || '-';

        tr.appendChild(createCell(facility.name));
        tr.appendChild(createCell(company));
        tr.appendChild(createCell(facility.municipality || '-'));
        tr.appendChild(createCell(facility.localityNo || '-'));
        tr.appendChild(createCell((facility.tags || []).join(', ') || '-'));

        tbody.appendChild(tr);
    }
}

function renderCounters(profile) {
    const vessels = profile.vessels || [];
    const facilities = profile.facilities || [];
    const events = profile.calendarEvents || [];
    const trackable = vessels.filter(v => v.mmsi && String(v.mmsi).trim()).length;

    document.getElementById('vesselTotal').textContent = String(vessels.length);
    document.getElementById('vesselTrackable').textContent = String(trackable);
    document.getElementById('facilityTotal').textContent = String(facilities.length);
    document.getElementById('eventTotal').textContent = String(events.length);
}

async function init() {
    const profileMeta = document.getElementById('profileMeta');

    try {
        const profile = await loadProfile();
        const companyMap = mapById(profile.companies || []);

        profileMeta.textContent = `Profil: ${profile.profileName || '-'} · Opprettet: ${profile.createdAt || '-'}`;

        renderCounters(profile);
        renderVessels(profile, companyMap);
        renderFacilities(profile, companyMap);
    } catch (error) {
        profileMeta.textContent = `Feil ved lasting av profil: ${error.message}`;
    }
}

init();
