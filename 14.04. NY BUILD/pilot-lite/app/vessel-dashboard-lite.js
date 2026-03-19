// @ts-nocheck
import { loadProfile, mapById, isoToLocal, createCell, repairMojibakeText } from './common.js';
import { renderFacilityMiniMap } from './lite-map.js';
import {
    isMmsiCleared,
    listClearedMmsi,
    signRoutePlannerClearance,
    getMmsiClearance,
    refreshClearanceCache,
    appendRoutePlan,
    getRoutePlans,
    getAllRoutePlans
} from './pilot-shared-store.js';
import { getActiveJobs, getJob, acceptJobProposal as acceptStoredJobProposal } from './job-store.js';

const COMPANY_SCOPE_KEY = 'pilotLiteFacilityCompanyScopeV1';
const CALENDAR_STORE_KEY = 'pilotLiteVesselCalendarV2';
const PLANNER_STORE_KEY = 'pilotLiteVesselPlannerStateV2';
const PANEL_PREFS_KEY = 'pilotLiteVesselPanelsV1';
const BOAT_AVAILABILITY_KEY = 'facilityBoatManualAvailabilityV1';
const OPERATOR_PREFS_KEY = 'facilityOperatorPrefsV1';
const OPERATOR_PREFS_AUDIT_KEY = 'facilityOperatorPrefsAuditV1';
const VESSEL_DEMO_OPS_KEY = 'pilotLiteVesselDemoOpsV1';
const DEMO_RESET_KEY_PREFIXES = ['pilotlite', 'facility'];
const API_BASE_OVERRIDE_KEY = 'pilotLiteApiBaseOverrideV1';
function resolveApiBase() {
    const fallback = window.location.hostname.includes('render.com')
        ? 'https://kyst-api.render.com'
        : `${window.location.protocol}//${window.location.hostname}:8000`;

    const normalize = (value) => String(value || '').trim().replace(/\/$/, '');
    const isHttpUrl = (value) => /^https?:\/\/.+/i.test(value);

    try {
        const queryValue = normalize(new URLSearchParams(window.location.search).get('apiBase'));
        if (isHttpUrl(queryValue)) {
            localStorage.setItem(API_BASE_OVERRIDE_KEY, queryValue);
            return queryValue;
        }
    } catch (_) {
        // ignore query parsing/storage issues
    }

    try {
        const override = normalize(localStorage.getItem(API_BASE_OVERRIDE_KEY));
        if (isHttpUrl(override)) return override;
    } catch (_) {
        // ignore storage issues
    }

    return fallback;
}
const API_BASE = resolveApiBase();
const DEFAULT_OPERATION_MINUTES = 45;
const MAX_FACILITIES_PER_DAY = 4;
const DEFAULT_SPEED_KMH = 18.52;
const DISINFECTION_TIME_MINUTES = 60;
const QUARANTINE_HOURS = 48;
const DISINFECTION_CHEMICALS_DEFAULT = [
    'Virkon S (1%)',
    'Natriumhypokloritt (50 ppm klor)',
    'Hydrogenperoksid',
    'Peroksyeddiksyre'
];
const CLUSTER_RADIUS_KM = 25;
const AIS_VESSEL_CACHE_MS = 2 * 60 * 1000;
const MASOVAL_FACILITY_NAMES = new Set([
    'Astridholmen',
    'Bjørndal',
    'Bukkholmen S',
    'Drevflesa',
    'Espnestaren',
    'Fagerholmen',
    'Fjølværet Ø',
    'Flatøyan',
    'Gaustad',
    'Gjerde',
    'Hårkallbåen',
    'Hattholmen',
    'Heggeset',
    'Helligholmen',
    'Hindholmen',
    'Hopla',
    'Ilsøya 2',
    'Kattholmen',
    'Klungset',
    'Kråkøya',
    'Kvaløya',
    'Kvangardsnes',
    'Laksåvatnet Laksåvik',
    'Lamøya',
    'Langøya Kvaløya',
    'Langtaren',
    'Måøydraga',
    'Nausttaren',
    'Nordre Skokkeløy',
    'Or',
    'Orholmen',
    'Skjelvika',
    'Slettvika',
    'Sørværet',
    'Storelva',
    'Sydnessund',
    'Torlandsøya',
    'Ulvan',
    'Urke',
    'Val'
].map((name) => normalizeName(name)));

const MASOVAL_STATUS_FALLBACK = new Map([
    ['Espnestaren', 'høy'],
    ['Fagerholmen', 'høy'],
    ['Fjølværet Ø', 'høy'],
    ['Flatøyan', 'høy'],
    ['Kattholmen', 'smittet'],
    ['Klungset', 'høy'],
    ['Kvangardsnes', 'høy'],
    ['Langøya Kvaløya', 'høy'],
    ['Måøydraga', 'høy'],
    ['Orholmen', 'smittet']
].map(([name, status]) => [normalizeName(name), status]));

let profile = null;
let companyMap = null;
let facilityMap = null;
let vesselMap = null;
let plannerFacilities = [];
let demoFacilityIds = new Set();
let calendarFacilityKeys = new Set();
let diseaseRiskByCode = new Map();
let diseaseRiskByName = new Map();
let diseaseConfirmedByCode = new Set();
let diseaseConfirmedByName = new Set();
let facilityDataSource = 'profile';
let clearanceDataSource = 'unknown';
let activeCompanyId = '';
let pilotActor = 'froy';
let selectedVesselId = null;
let calendarViewDate = new Date();
let selectedCalendarDayKey = null;
let shareDraft = null;
let eventEditDraft = null;
let proposalCache = new Map();
let panelPrefs = {};
let aisVesselCache = { ts: 0, byMmsi: new Map(), byName: new Map() };
let aisSummarySnapshot = { vesselId: null, text: 'Ikke hentet', ts: 0 };
let aisSummaryRequestId = 0;
let lastMapFocusedVesselId = null;

function clearDemoLocalState() {
    const removedKeys = [];
    try {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
            const key = localStorage.key(index);
            if (!key) continue;
            const lowerKey = String(key).toLowerCase();
            if (!DEMO_RESET_KEY_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) continue;
            localStorage.removeItem(key);
            removedKeys.push(key);
        }
    } catch (_) {
        return [];
    }
    return removedKeys;
}

function loadJsonStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

function saveJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getCalendarStore() {
    return loadJsonStorage(CALENDAR_STORE_KEY, {});
}

function saveCalendarStore(store) {
    saveJsonStorage(CALENDAR_STORE_KEY, store);
}

function getPlannerStore() {
    return loadJsonStorage(PLANNER_STORE_KEY, {});
}

function savePlannerStore(store) {
    saveJsonStorage(PLANNER_STORE_KEY, store);
}

function loadPanelPrefs() {
    panelPrefs = loadJsonStorage(PANEL_PREFS_KEY, {});
    if (typeof panelPrefs.requestsCollapsed !== 'boolean') panelPrefs.requestsCollapsed = true;
    if (typeof panelPrefs.confirmedCollapsed !== 'boolean') panelPrefs.confirmedCollapsed = true;
    if (typeof panelPrefs.matchingSuggestionsCollapsed !== 'boolean') panelPrefs.matchingSuggestionsCollapsed = false;
    if (typeof panelPrefs.calendarCollapsed !== 'boolean') panelPrefs.calendarCollapsed = false;
    if (typeof panelPrefs.routePreviewCollapsed !== 'boolean') panelPrefs.routePreviewCollapsed = false;
    if (typeof panelPrefs.selectedDayCollapsed !== 'boolean') panelPrefs.selectedDayCollapsed = false;
}

function savePanelPrefs() {
    saveJsonStorage(PANEL_PREFS_KEY, panelPrefs);
}

function getBoatAvailabilityStore() {
    return loadJsonStorage(BOAT_AVAILABILITY_KEY, {});
}

function getVesselDemoOpsStore() {
    return loadJsonStorage(VESSEL_DEMO_OPS_KEY, {});
}

function saveVesselDemoOpsStore(store) {
    saveJsonStorage(VESSEL_DEMO_OPS_KEY, store || {});
}

function getVesselDemoOps(vesselId) {
    const key = String(vesselId || '').trim();
    if (!key) return { crewCount: '', contactName: '', contactPhone: '', healthCertName: '', healthCertUpdatedAt: '' };
    const store = getVesselDemoOpsStore();
    const entry = store?.[key] || {};
    return {
        crewCount: entry.crewCount ?? '',
        contactName: entry.contactName ?? '',
        contactPhone: entry.contactPhone ?? '',
        healthCertName: entry.healthCertName ?? '',
        healthCertUpdatedAt: entry.healthCertUpdatedAt ?? ''
    };
}

function setVesselDemoOps(vesselId, patch) {
    const key = String(vesselId || '').trim();
    if (!key) return;
    const store = getVesselDemoOpsStore();
    store[key] = { ...getVesselDemoOps(vesselId), ...(patch || {}) };
    saveVesselDemoOpsStore(store);
}

function saveBoatAvailabilityStore(store) {
    saveJsonStorage(BOAT_AVAILABILITY_KEY, store || {});
}

function getManualBoatAvailability(vesselId) {
    const key = String(vesselId || '').trim();
    if (!key) return 'auto';
    const store = getBoatAvailabilityStore();
    const value = String(store?.[key] || 'auto').trim().toLowerCase();
    if (value === 'available' || value === 'unavailable') return value;
    return 'auto';
}

function setManualBoatAvailability(vesselId, mode) {
    const key = String(vesselId || '').trim();
    if (!key) return;
    const normalized = String(mode || 'auto').trim().toLowerCase();
    const store = getBoatAvailabilityStore();
    if (normalized === 'available' || normalized === 'unavailable') {
        store[key] = normalized;
    } else {
        delete store[key];
    }
    saveBoatAvailabilityStore(store);
}

function cycleBoatAvailabilityMode(currentMode) {
    if (currentMode === 'auto') return 'available';
    if (currentMode === 'available') return 'unavailable';
    return 'auto';
}

function toDateKey(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthInputValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getRouteBaseDateForState(state) {
    return state?.routePlanDate ? startOfDay(state.routePlanDate) : startOfDay(new Date());
}

function getFacilityCalendarDayMarks(facilityId) {
    if (!facilityId) return {};
    const storageKey = `facilityCalDays_${facilityId}`;
    try {
        const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
        return {};
    }
}

function getFacilityDayMark(facilityId, date) {
    const marks = getFacilityCalendarDayMarks(facilityId);
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return '';
    const y = target.getFullYear();
    const m = target.getMonth();
    const d = target.getDate();

    const legacyKey = `${y}-${m}-${d}`;
    const isoKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const compactIsoKey = `${y}-${m + 1}-${d}`;

    return String(marks[legacyKey] || marks[isoKey] || marks[compactIsoKey] || '').trim().toLowerCase();
}

function isFacilityBlockedOnDate(facility, date) {
    const facilityId = String(facility?.id || '').trim();
    if (!facilityId) return false;
    const mark = getFacilityDayMark(facilityId, date);
    return mark === 'red';
}

function getBlockedFacilityNamesForDate(facilities, date) {
    return (facilities || [])
        .filter((facility) => isFacilityBlockedOnDate(facility, date))
        .map((facility) => facility.name || facility.id)
        .filter(Boolean);
}

function parseTimeToHoursMinutes(value, fallback = '07:30') {
    const [h, m] = String(value || fallback).split(':').map((part) => Number(part));
    const hours = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 7;
    const minutes = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 30;
    return { hours, minutes };
}

function findFirstAvailablePlannerDate(vesselId, facility, preferredDate, operationMinutes, preferredTime) {
    const vesselEvents = getVesselEventsFor(vesselId);
    const baseDate = startOfDay(preferredDate || new Date());
    const safeDuration = Math.max(5, Number(operationMinutes) || DEFAULT_OPERATION_MINUTES);
    const { hours, minutes } = parseTimeToHoursMinutes(preferredTime, '07:30');

    for (let offset = 0; offset < 90; offset += 1) {
        const candidateDay = new Date(baseDate);
        candidateDay.setDate(baseDate.getDate() + offset);

        if (facility && isFacilityBlockedOnDate(facility, candidateDay)) continue;

        const slotStart = new Date(candidateDay);
        slotStart.setHours(hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + (safeDuration * 60 * 1000));
        const hasConflict = vesselEvents.some((event) => overlapsRange(event.start, event.end, slotStart, slotEnd));
        if (hasConflict) continue;

        return toDateKey(candidateDay);
    }

    return toDateKey(baseDate);
}

function quickPlanJob(jobId, vesselId, options = {}) {
    const autoAccept = options.autoAccept !== false;
    if (!ensureCanManageVessel(vesselId, 'Hurtigplanlegg jobb')) return;

    const job = getJob(jobId);
    const vessel = vesselMap.get(String(vesselId || ''));
    if (!job || !vessel) {
        showStatus('Fant ikke jobb eller båt for hurtigplanlegging.', 'warning');
        return;
    }

    if (autoAccept) {
        acceptJobProposal(jobId, vesselId);
    }

    const facility = getFacilityFromJob(job);
    if (!facility?.id) {
        showStatus('Kan ikke hurtigplanlegge uten gyldig anlegg.', 'warning');
        return;
    }

    const preferredTime = String(job.preferredTime || '07:30');
    const operationMinutes = Math.max(5, Math.round(Math.max(1, Number(job.estimatedHours || 4)) * 60));
    const firstDate = findFirstAvailablePlannerDate(vessel.id, facility, job.startDate || new Date(), operationMinutes, preferredTime);

    selectedVesselId = vessel.id;
    const state = getPlannerState(vessel.id);
    const selectedIds = new Set(state.selectedFacilityIds || []);
    selectedIds.add(String(facility.id));

    setPlannerState(vessel.id, {
        selectedFacilityIds: [...selectedIds],
        routePlanDate: firstDate,
        routeDepartureTime: preferredTime,
        showFacilitySelector: true
    });
    setPlannerOperationMinutes(facility.id, operationMinutes);
    if (String(job.notes || '').trim()) {
        setPlannerFacilityComment(facility.id, job.notes);
    }

    const route = buildPlannedRoute(vessel.id);
    savePlannedRoute(vessel.id, route);

    syncSelectorsToSelectedVessel();
    renderAll();
    document.getElementById('plannerSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showStatus(`Hurtigplanlagt på ${firstDate}. Se/tilpass ruten i planleggeren.`, 'success');
}

function formatDateOnly(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('nb-NO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatTimeOnly(value) {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function slugText(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeAsciiText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function getAisTimestampMs(item) {
    const raw = item?.msgtime || item?.position_time || item?.timestamp || item?.time || null;
    if (!raw) return 0;
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

async function loadAisVesselIndex(force = false) {
    const now = Date.now();
    if (!force && aisVesselCache.ts > 0 && (now - aisVesselCache.ts) < AIS_VESSEL_CACHE_MS) {
        return aisVesselCache;
    }

    const response = await fetch(`${API_BASE}/api/vessels?limit=10000`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const vessels = Array.isArray(payload?.vessels) ? payload.vessels : [];
    const byMmsi = new Map();
    const byName = new Map();

    for (const vessel of vessels) {
        const mmsi = String(vessel?.mmsi || '').trim();
        const nameKey = normalizeAsciiText(vessel?.name || vessel?.vessel_name || '');

        if (mmsi) {
            const existing = byMmsi.get(mmsi);
            if (!existing || getAisTimestampMs(vessel) > getAisTimestampMs(existing)) {
                byMmsi.set(mmsi, vessel);
            }
        }

        if (nameKey) {
            const existing = byName.get(nameKey);
            if (!existing || getAisTimestampMs(vessel) > getAisTimestampMs(existing)) {
                byName.set(nameKey, vessel);
            }
        }
    }

    aisVesselCache = { ts: now, byMmsi, byName };
    return aisVesselCache;
}

function setSelectedVesselAisSummary(vesselId, text) {
    aisSummarySnapshot = { vesselId: vesselId || null, text: String(text || ''), ts: Date.now() };
    const node = document.getElementById('selectedVesselAisMeta');
    if (node) {
        node.textContent = `AIS: ${aisSummarySnapshot.text}`;
    }
}

function getAisMatchForVessel(vessel) {
    if (!vessel) return null;
    const mmsi = String(vessel?.mmsi || '').trim();
    const nameKey = normalizeAsciiText(vessel?.name || '');
    return (mmsi ? aisVesselCache.byMmsi.get(mmsi) : null) || (nameKey ? aisVesselCache.byName.get(nameKey) : null) || null;
}

function getEffectiveVesselCoordinates(vessel) {
    if (!vessel) return null;

    const profileLat = toFiniteNumber(vessel?.latitude);
    const profileLon = toFiniteNumber(vessel?.longitude);
    if (profileLat !== null && profileLon !== null) {
        return { lat: profileLat, lon: profileLon, source: 'profile' };
    }

    const aisMatch = getAisMatchForVessel(vessel);
    const aisLat = toFiniteNumber(aisMatch?.latitude);
    const aisLon = toFiniteNumber(aisMatch?.longitude);
    if (aisLat !== null && aisLon !== null) {
        return { lat: aisLat, lon: aisLon, source: 'ais' };
    }

    return null;
}

function getAisStateForVessel(vessel) {
    const mmsi = String(vessel?.mmsi || '').trim();
    if (!mmsi) {
        return { className: 'neutral', label: 'Ingen MMSI' };
    }

    const match = getAisMatchForVessel(vessel);
    if (!match) {
        return { className: 'warn', label: 'Mangler AIS-posisjon' };
    }

    const lat = toFiniteNumber(match?.latitude);
    const lon = toFiniteNumber(match?.longitude);
    if (lat === null || lon === null) {
        return { className: 'warn', label: 'AIS uten koordinater' };
    }

    return { className: 'ok', label: 'AIS aktiv' };
}

async function refreshSelectedVesselAisSummary(vessel) {
    if (!vessel) {
        setSelectedVesselAisSummary(null, 'Ingen båt valgt');
        return;
    }

    const vesselId = String(vessel.id || '');
    const mmsi = String(vessel.mmsi || '').trim();
    const nameKey = normalizeAsciiText(vessel.name || '');
    const now = Date.now();

    if (aisSummarySnapshot.vesselId === vesselId && (now - aisSummarySnapshot.ts) < 15000) {
        setSelectedVesselAisSummary(vesselId, aisSummarySnapshot.text);
        return;
    }

    setSelectedVesselAisSummary(vesselId, 'Henter sist kjente posisjon...');
    const requestId = ++aisSummaryRequestId;

    try {
        const index = await loadAisVesselIndex(false);
        if (requestId !== aisSummaryRequestId) return;
        if (String(getSelectedVessel()?.id || '') !== vesselId) return;

        const match = (mmsi ? index.byMmsi.get(mmsi) : null) || (nameKey ? index.byName.get(nameKey) : null);
        if (!match) {
            setSelectedVesselAisSummary(vesselId, 'Ingen live/sist kjent AIS-posisjon funnet');
            return;
        }

        const lat = toFiniteNumber(match?.latitude);
        const lon = toFiniteNumber(match?.longitude);
        const tsRaw = match?.msgtime || match?.position_time || match?.timestamp || match?.time || null;
        const tsText = tsRaw ? isoToLocal(tsRaw) : 'ukjent tid';
        const speed = toFiniteNumber(match?.speedOverGround ?? match?.speed);

        if (lat === null || lon === null) {
            setSelectedVesselAisSummary(vesselId, `Sist kjent tid: ${tsText} (uten koordinater)`);
            return;
        }

        const speedText = speed === null ? '' : ` · ${speed.toFixed(1)} kn`;
        setSelectedVesselAisSummary(vesselId, `${lat.toFixed(5)}, ${lon.toFixed(5)} · ${tsText}${speedText}`);
    } catch (_) {
        if (requestId !== aisSummaryRequestId) return;
        if (String(getSelectedVessel()?.id || '') !== vesselId) return;
        setSelectedVesselAisSummary(vesselId, 'AIS utilgjengelig akkurat nå');
    }
}

function resolveActiveCompanyId() {
    const companies = profile?.companies || [];
    const vessels = profile?.vessels || [];
    const facilities = profile?.facilities || [];

    const companyIdsWithVessels = new Set(
        vessels
            .map((item) => String(item?.companyId || item?.company_id || item?.operatorCompanyId || '').trim())
            .filter(Boolean)
    );

    const companyIdsWithData = new Set([
        ...vessels.map((item) => String(item?.companyId || item?.company_id || item?.operatorCompanyId || '').trim()).filter(Boolean),
        ...facilities.map((item) => String(item?.companyId || '').trim()).filter(Boolean)
    ]);

    const normalizeCandidate = (candidate) => {
        const id = String(candidate || '').trim();
        if (!id) return '';
        if (!companies.some((company) => String(company?.id || '') === id)) return '';
        if (!companyIdsWithData.has(id)) return '';
        return id;
    };

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = normalizeCandidate(params.get('company'));
    if (fromQuery) {
        try { localStorage.setItem(COMPANY_SCOPE_KEY, fromQuery); } catch (_) {}
        return fromQuery;
    }

    let fromStorage = '';
    try {
        fromStorage = normalizeCandidate(localStorage.getItem(COMPANY_SCOPE_KEY));
    } catch (_) {
        fromStorage = '';
    }
    if (fromStorage) return fromStorage;

    const preferred = normalizeCandidate('froy');
    if (preferred) return preferred;

    const firstWithVessels = companies
        .map((company) => String(company?.id || '').trim())
        .find((id) => id && companyIdsWithVessels.has(id));
    if (firstWithVessels) return firstWithVessels;

    const first = companies
        .map((company) => String(company?.id || '').trim())
        .find((id) => id && companyIdsWithData.has(id));
    return first || '';
}

function setCompanyScope(nextCompanyId) {
    const normalized = String(nextCompanyId || '').trim();
    activeCompanyId = normalized;
    if (normalized) pilotActor = normalized;
    try {
        if (normalized) localStorage.setItem(COMPANY_SCOPE_KEY, normalized);
        else localStorage.removeItem(COMPANY_SCOPE_KEY);
    } catch (_) {}
    renderCompanyScopeBadge();
}

function activeScopeHasVessels(scopeCompanyId = activeCompanyId) {
    const scopedCompanyId = String(scopeCompanyId || '').trim();
    if (!scopedCompanyId) return false;
    return (profile?.vessels || []).some((vessel) => {
        const companyId = String(vessel?.companyId || vessel?.company_id || vessel?.operatorCompanyId || '').trim();
        return companyId && companyId === scopedCompanyId;
    });
}

function getExplicitCompanyFilter() {
    return String(document.getElementById('companyFilter')?.value || '').trim();
}

function getEffectiveScopedCompanyId() {
    const explicitCompanyId = getExplicitCompanyFilter();
    if (explicitCompanyId) return explicitCompanyId;
    return activeScopeHasVessels() ? String(activeCompanyId || '').trim() : '';
}

function getEffectivePilotActor() {
    const scopedCompanyId = getEffectiveScopedCompanyId();
    if (scopedCompanyId) return scopedCompanyId;
    const selectedCompanyId = getVesselCompanyId(getSelectedVessel());
    if (selectedCompanyId) return selectedCompanyId;
    return String(activeCompanyId || '').trim() || pilotActor || 'froy';
}

function renderCompanyScopeBadge() {
    const badge = document.getElementById('companyScopeBadge');
    if (!badge) return;
    const effectiveCompanyId = getEffectiveScopedCompanyId();
    const explicitCompanyId = getExplicitCompanyFilter();
    const companyName = companyMap?.get(effectiveCompanyId)?.name || effectiveCompanyId || '';
    const fallbackName = companyMap?.get(activeCompanyId)?.name || activeCompanyId || '';

    if (explicitCompanyId) {
        badge.textContent = `Scope: ${companyName || explicitCompanyId} (filter)`;
        badge.style.color = 'var(--warn)';
    } else if (effectiveCompanyId) {
        badge.textContent = `Scope: ${companyName || effectiveCompanyId} (låst)`;
        badge.style.color = 'var(--warn)';
    } else if (activeCompanyId) {
        badge.textContent = `Scope: Alle (åpen · ${fallbackName || activeCompanyId} har ingen båter her)`;
        badge.style.color = 'var(--muted)';
    } else {
        badge.textContent = 'Scope: Alle (åpen)';
        badge.style.color = 'var(--muted)';
    }
}

function isFacilityOwnedByActiveCompany(facility) {
    if (!facility) return false;
    if (activeCompanyId && String(facility?.companyId || '').trim() === activeCompanyId) return true;

    const holderText = normalizeAsciiText(
        facility?.fdir?.holders
        || facility?.fdir?.holder
        || facility?.companyName
        || facility?.owner
    );
    if (!holderText) return false;

    const companyNameNorm = normalizeAsciiText(companyMap?.get(activeCompanyId)?.name || activeCompanyId);
    if (!companyNameNorm) return false;

    if (companyNameNorm.includes('masoval')) {
        return holderText.includes('masoval');
    }

    const tokens = companyNameNorm.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
    return tokens.some((token) => holderText.includes(token));
}

function applyCompanyScopeToFacilities(facilities) {
    if (!activeCompanyId) return facilities || [];
    return (facilities || []).filter((facility) => isFacilityOwnedByActiveCompany(facility));
}

function toNonEmptyText(...values) {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return '';
}

function normalizeName(value) {
    return slugText(value);
}

function normalizeFacilityForPlanner(raw, fallbackPrefix = 'facility') {
    const localityNo = toNonEmptyText(raw?.localityNo, raw?.locality_no, raw?.locality_number);
    const name = repairMojibakeText(toNonEmptyText(raw?.name, raw?.facility_name, raw?.facilityName) || 'Ukjent anlegg');
    const municipality = repairMojibakeText(toNonEmptyText(raw?.municipality, raw?.municipality_name));
    const existingId = toNonEmptyText(raw?.id, raw?.facility_id, raw?.facilityCode, raw?.facility_code);
    const safeKey = slugText(`${name}_${municipality}_${localityNo}`).replace(/[^a-z0-9]+/g, '_') || 'x';
    const id = existingId || (localityNo ? `${fallbackPrefix}_${localityNo}` : `${fallbackPrefix}_${safeKey}`);

    return {
        ...raw,
        id,
        name,
        municipality,
        localityNo,
        latitude: Number.isFinite(Number(raw?.latitude)) ? Number(raw.latitude) : raw?.latitude ?? null,
        longitude: Number.isFinite(Number(raw?.longitude)) ? Number(raw.longitude) : raw?.longitude ?? null,
        status: raw?.status || raw?.healthStatus || '',
        production_type: repairMojibakeText(toNonEmptyText(raw?.production_type, raw?.productionType, raw?.fdir?.production_type, raw?.fdir?.species, raw?.species)),
        tags: Array.isArray(raw?.tags) ? raw.tags : []
    };
}

function facilityMergeKey(facility) {
    const localityNo = toNonEmptyText(facility?.localityNo);
    if (localityNo) return `loc:${localityNo}`;
    const id = toNonEmptyText(facility?.id);
    if (id) return `id:${id}`;
    return `name:${slugText(toNonEmptyText(facility?.name))}|${slugText(toNonEmptyText(facility?.municipality))}`;
}

function buildCalendarFacilityKeys() {
    const keys = new Set();
    const profileFacilities = profile?.facilities || [];
    const byId = new Map(profileFacilities.map((facility) => [String(facility?.id || ''), facility]));

    for (const facility of profileFacilities) {
        if (String(facility?.companyId || '').toLowerCase() === 'masoval') {
            keys.add(facilityMergeKey(normalizeFacilityForPlanner(facility, 'profile')));
        }
    }

    for (const event of profile?.calendarEvents || []) {
        const facilityId = String(event?.facilityId || '').trim();
        if (!facilityId) continue;
        const facility = byId.get(facilityId);
        if (facility) keys.add(facilityMergeKey(normalizeFacilityForPlanner(facility, 'profile')));
    }

    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('facilityCalDays_')) continue;
            const facilityId = key.slice('facilityCalDays_'.length);
            let hasCalendarDays = false;
            try {
                const raw = JSON.parse(localStorage.getItem(key) || '{}');
                hasCalendarDays = raw && typeof raw === 'object' && Object.keys(raw).length > 0;
            } catch (_) {
                hasCalendarDays = false;
            }
            if (!hasCalendarDays) continue;
            const facility = byId.get(String(facilityId));
            if (facility) keys.add(facilityMergeKey(normalizeFacilityForPlanner(facility, 'profile')));
        }
    } catch (_) {
    }

    calendarFacilityKeys = keys;
}

function applyCalendarRegistrationFlags(facilities) {
    const registeredIds = new Set();
    const enriched = (facilities || []).map((facility) => {
        const isCalendarEnabled = calendarFacilityKeys.has(facilityMergeKey(facility));
        if (isCalendarEnabled) registeredIds.add(String(facility.id || ''));
        return {
            ...facility,
            _calendarEnabled: isCalendarEnabled
        };
    });
    demoFacilityIds = registeredIds;
    return enriched;
}

function mergeFacilityCatalog(profileFacilities, apiFacilities) {
    const merged = [];
    const keyToIndex = new Map();

    (profileFacilities || []).forEach((facility) => {
        const normalized = normalizeFacilityForPlanner(facility, 'profile');
        const key = facilityMergeKey(normalized);
        keyToIndex.set(key, merged.length);
        merged.push(normalized);
    });

    (apiFacilities || []).forEach((facility) => {
        const normalized = normalizeFacilityForPlanner(facility, 'api');
        const key = facilityMergeKey(normalized);
        const existingIndex = keyToIndex.get(key);
        if (existingIndex === undefined) {
            keyToIndex.set(key, merged.length);
            merged.push(normalized);
            return;
        }

        const current = merged[existingIndex];
        merged[existingIndex] = {
            ...normalized,
            ...current,
            latitude: current.latitude ?? normalized.latitude,
            longitude: current.longitude ?? normalized.longitude,
            status: current.status || normalized.status || '',
            tags: (current.tags && current.tags.length > 0) ? current.tags : (normalized.tags || [])
        };
    });

    return merged;
}

async function enrichFacilitiesWithFdir(facilities) {
    const list = Array.isArray(facilities) ? facilities : [];
    if (list.length === 0) return list;

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        const res = await fetch(`${API_BASE}/api/facilities/fdir/indexed`, {
            signal: ctrl.signal,
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        clearTimeout(timer);

        if (!res.ok) return list;
        const data = await res.json();
        const fdirMap = data?.fdir_map || {};

        return list.map((facility) => {
            const localityNo = toNonEmptyText(facility?.localityNo, facility?.locality_no, facility?.locality_number);
            const fdir = localityNo ? fdirMap[String(localityNo)] : null;
            if (!fdir) return facility;

            const merged = { ...facility, fdir };
            if (!toNonEmptyText(merged.production_type, merged.productionType, merged.species)) {
                merged.production_type = toNonEmptyText(fdir?.production_type, fdir?.species);
            }
            return merged;
        });
    } catch (_) {
        return list;
    }
}

function rebuildDiseaseIndex(data) {
    diseaseRiskByCode = new Map();
    diseaseRiskByName = new Map();
    diseaseConfirmedByCode = new Set();
    diseaseConfirmedByName = new Set();

    const allRisk = data?.all_at_risk_facilities || [];
    for (const item of allRisk) {
        const code = toNonEmptyText(item?.facility_code);
        if (code) diseaseRiskByCode.set(code, item);
        const name = normalizeName(item?.facility_name);
        if (name) {
            const current = diseaseRiskByName.get(name) || [];
            current.push(item);
            diseaseRiskByName.set(name, current);
        }
    }

    const confirmed = data?.confirmed_diseased_facilities || [];
    for (const item of confirmed) {
        const code = toNonEmptyText(item?.facility_code);
        if (code) diseaseConfirmedByCode.add(code);
        const name = normalizeName(item?.facility_name);
        if (name) diseaseConfirmedByName.add(name);
    }
}

async function loadDiseaseSpreadIndex() {
    try {
        const response = await fetch(`${API_BASE}/api/facilities/disease-spread?ts=${Date.now()}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        rebuildDiseaseIndex(data);
    } catch (_) {
        rebuildDiseaseIndex({ confirmed_diseased_facilities: [], all_at_risk_facilities: [] });
    }
}

function annotateFacilitiesWithDisease(facilities) {
    return (facilities || []).map((facility) => {
        const localityNo = toNonEmptyText(facility?.localityNo);
        const nameKey = normalizeName(facility?.name);
        const riskByCode = localityNo ? diseaseRiskByCode.get(localityNo) : null;
        const riskByName = !riskByCode && nameKey ? (diseaseRiskByName.get(nameKey) || [])[0] : null;
        const risk = riskByCode || riskByName || null;
        const confirmed = (localityNo && diseaseConfirmedByCode.has(localityNo)) || (nameKey && diseaseConfirmedByName.has(nameKey));

        return {
            ...facility,
            _diseaseConfirmed: Boolean(confirmed),
            _diseaseRiskLevel: toNonEmptyText(risk?.risk_level, facility?.riskLevel, facility?.barentsWatchRisk?.risk_level),
            _diseaseZoneType: toNonEmptyText(risk?.zone_type, facility?.zone_type, facility?.barentsWatchRisk?.zone_type),
            _diseaseName: toNonEmptyText(risk?.disease, facility?.disease, facility?.barentsWatchRisk?.disease),
            _diseaseSource: risk ? 'disease-spread' : ''
        };
    });
}

async function loadAllFacilitiesForPlanner() {
    const profileFacilities = profile?.facilities || [];
    const params = 'limit=500&include_geo=true';
    const collected = [];
    let skip = 0;
    const maxPages = 20;

    try {
        // Load complete facility catalog with a safety cap.
        for (let page = 0; page < maxPages; page += 1) {
            const response = await fetch(`${API_BASE}/api/facilities?${params}&skip=${skip}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const list = Array.isArray(data)
                ? data
                : (Array.isArray(data?.facilities) ? data.facilities : (Array.isArray(data?.items) ? data.items : []));

            if (list.length === 0) break;
            collected.push(...list);
            if (list.length < 500) break;
            skip += 500;
        }
    } catch (_) {
        plannerFacilities = applyCalendarRegistrationFlags(
            annotateFacilitiesWithDisease(
                mergeFacilityCatalog(profileFacilities, [])
            )
        );
        facilityDataSource = 'profil';
        facilityMap = mapById(plannerFacilities);
        return;
    }

    const enrichedCollected = await enrichFacilitiesWithFdir(collected);

    plannerFacilities = applyCalendarRegistrationFlags(
        annotateFacilitiesWithDisease(
            mergeFacilityCatalog(profileFacilities, enrichedCollected)
        )
    );
    facilityDataSource = enrichedCollected.length > 0 ? 'api+profil' : 'profil';
    facilityMap = mapById(plannerFacilities);
}

function getSelectedVessel() {
    return selectedVesselId ? vesselMap.get(selectedVesselId) || null : null;
}

function getVesselCompanyId(vesselOrId) {
    const vessel = typeof vesselOrId === 'object' && vesselOrId
        ? vesselOrId
        : vesselMap?.get(String(vesselOrId || ''));
    if (!vessel) return '';
    return String(vessel.companyId || vessel.company_id || vessel.operatorCompanyId || '').trim();
}

function canManageVesselForActiveCompany(vesselOrId) {
    const scopedCompanyId = getEffectiveScopedCompanyId();
    if (!scopedCompanyId) return true;
    const vesselCompanyId = getVesselCompanyId(vesselOrId);
    if (!vesselCompanyId) return true;
    return vesselCompanyId === scopedCompanyId;
}

function ensureCanManageVessel(vesselOrId, actionLabel = 'denne handlingen') {
    if (canManageVesselForActiveCompany(vesselOrId)) return true;
    const vessel = typeof vesselOrId === 'object' && vesselOrId
        ? vesselOrId
        : vesselMap?.get(String(vesselOrId || ''));
    const vesselName = vessel?.name || vessel?.mmsi || 'valgt båt';
    showStatus(`${actionLabel} er låst: ${vesselName} tilhører et annet selskap.`, 'warning');
    return false;
}

function getSelectedVesselMmsi() {
    const vessel = getSelectedVessel();
    return String(vessel?.mmsi || '').trim();
}

function getFilteredVessels() {
    const companyFilter = getExplicitCompanyFilter();
    const trackFilter = document.getElementById('trackFilter')?.value || '';
    const categoryFilter = String(document.getElementById('vesselCategoryFilter')?.value || '').trim().toLowerCase();
    const scopedCompany = companyFilter || getEffectiveScopedCompanyId();

    const base = (profile.vessels || []).filter((vessel) => {
        const hasMmsi = !!String(vessel?.mmsi || '').trim();
        const vesselCategory = String(vessel?.category || vessel?.type || '').trim().toLowerCase();
        if (trackFilter === 'trackable' && !hasMmsi) return false;
        if (trackFilter === 'non-trackable' && hasMmsi) return false;
        if (categoryFilter && vesselCategory !== categoryFilter) return false;
        return true;
    });

    if (!scopedCompany) return base;

    const scoped = base.filter((vessel) => {
        const companyId = String(vessel?.companyId || vessel?.company_id || vessel?.operatorCompanyId || '').trim();
        return companyId === scopedCompany;
    });

    if (scoped.length > 0) return scoped;

    return scoped;
}

function ensureSelectedVessel() {
    const vessels = getFilteredVessels();
    if (selectedVesselId && vessels.some((item) => item.id === selectedVesselId)) return;
    selectedVesselId = vessels[0]?.id || (profile.vessels || [])[0]?.id || null;
}

function fillSelect(select, items, mapFn, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    if (placeholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        select.appendChild(option);
    }
    for (const item of items) {
        const option = document.createElement('option');
        option.value = String(item.value);
        option.textContent = item.label;
        select.appendChild(option);
    }
}

function populateFilters() {
    const companySelect = document.getElementById('companyFilter');
    companySelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'Alle selskaper';
    companySelect.appendChild(allOption);

    for (const company of profile.companies || []) {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        companySelect.appendChild(option);
    }

    const activeHasVessels = activeScopeHasVessels();

    if (activeCompanyId && activeHasVessels && (profile.companies || []).some((item) => item.id === activeCompanyId)) {
        companySelect.value = activeCompanyId;
    } else {
        companySelect.value = '';
    }

    const categorySelect = document.getElementById('vesselCategoryFilter');
    if (categorySelect) {
        const existing = categorySelect.value;
        const categories = [...new Set((profile.vessels || [])
            .map((vessel) => String(vessel?.category || vessel?.type || '').trim())
            .filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'nb-NO'));

        categorySelect.innerHTML = '<option value="">Alle kategorier</option>';
        for (const category of categories) {
            const option = document.createElement('option');
            option.value = category.toLowerCase();
            option.textContent = category;
            categorySelect.appendChild(option);
        }
        if (existing && [...categorySelect.options].some((opt) => opt.value === existing)) {
            categorySelect.value = existing;
        }
    }

    populateVesselFocusSelect();
}

function populateVesselFocusSelect() {
    const select = document.getElementById('vesselFocusSelect');
    const vessels = getFilteredVessels();
    fillSelect(
        select,
        vessels.map((vessel) => ({ value: vessel.id, label: `${vessel.name} ${vessel.mmsi ? `(${vessel.mmsi})` : '(uten MMSI)'}` })),
        null,
        'Velg båt'
    );
    if (selectedVesselId) select.value = selectedVesselId;
}

function getPanelMap() {
    return {
        fleetTable: { btnId: 'toggleFleetTableBtn', bodyId: 'fleetTableBodyWrap' },
        calendar: { btnId: 'toggleCalendarBtn', bodyId: 'calendarBodyWrap' },
        routePreview: { btnId: 'toggleRoutePreviewBtn', bodyId: 'routePreviewBodyWrap' },
        selectedDay: { btnId: 'toggleSelectedDayBtn', bodyId: 'calendarDayInfoBodyWrap' },
        health: { btnId: 'toggleHealthPanelBtn', bodyId: 'healthPanelBody' },
        requests: { btnId: 'toggleRequestsBtn', bodyId: 'requestsBodyWrap' },
        confirmed: { btnId: 'toggleConfirmedBtn', bodyId: 'confirmedBodyWrap' }
    };
}

function applyPanelPrefs() {
    const map = getPanelMap();
    for (const [key, cfg] of Object.entries(map)) {
        const btn = document.getElementById(cfg.btnId);
        const body = document.getElementById(cfg.bodyId);
        if (!btn || !body) continue;
        const collapsed = panelPrefs[`${key}Collapsed`] === true;
        btn.classList.toggle('collapsed', collapsed);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        body.style.display = collapsed ? 'none' : '';
    }
}

function togglePanel(prefKey) {
    panelPrefs[prefKey] = !panelPrefs[prefKey];
    savePanelPrefs();
    applyPanelPrefs();
}

function getVesselCalendarState(vesselId) {
    const store = getCalendarStore();
    const key = String(vesselId || '');
    if (!store[key]) {
        store[key] = { events: [], dayMarks: {} };
        saveCalendarStore(store);
    }
    return store[key];
}

function updateVesselCalendarState(vesselId, updater) {
    const store = getCalendarStore();
    const key = String(vesselId || '');
    const current = store[key] || { events: [], dayMarks: {} };
    store[key] = updater(current) || current;
    saveCalendarStore(store);
    return store[key];
}

function getPlannerState(vesselId) {
    const store = getPlannerStore();
    const key = String(vesselId || '');
    return store[key] || {
        selectedFacilityIds: [],
        routeMode: 'safe',
        routePlanDate: '',
        routeDepartureTime: '07:30',
        routeSpeedKmh: DEFAULT_SPEED_KMH,
        plannedRoute: null,
        showFacilitySelector: true,
        operationMinutes: {},
        facilityComments: {}
    };
}

function getRouteSpeedKmh(vesselId = selectedVesselId) {
    const state = getPlannerState(vesselId);
    const value = Number(state?.routeSpeedKmh);
    if (!Number.isFinite(value)) return DEFAULT_SPEED_KMH;
    return Math.min(45, Math.max(6, value));
}

function setPlannerState(vesselId, patch) {
    const store = getPlannerStore();
    const key = String(vesselId || '');
    const next = { ...getPlannerState(vesselId), ...patch };
    store[key] = next;
    savePlannerStore(store);
    return next;
}

function resetPlannerForVessel(vesselId = selectedVesselId) {
    if (!vesselId) return;
    setPlannerState(vesselId, {
        selectedFacilityIds: [],
        plannedRoute: null,
        showFacilitySelector: true,
        operationMinutes: {},
        facilityComments: {}
    });
}

function getSelectedFacilityIds() {
    return new Set(getPlannerState(selectedVesselId).selectedFacilityIds || []);
}

function setSelectedFacilityIds(nextIds) {
    setPlannerState(selectedVesselId, { selectedFacilityIds: [...nextIds] });
}

function getPlannerOperationMinutes(facilityId) {
    const state = getPlannerState(selectedVesselId);
    const value = Number(state.operationMinutes?.[String(facilityId)]);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_OPERATION_MINUTES;
}

function setPlannerOperationMinutes(facilityId, minutes) {
    const state = getPlannerState(selectedVesselId);
    const next = { ...(state.operationMinutes || {}) };
    const safe = Math.max(0, parseInt(minutes, 10) || 0);
    next[String(facilityId)] = safe;
    setPlannerState(selectedVesselId, { operationMinutes: next });
}

function getPlannerFacilityComment(facilityId) {
    const state = getPlannerState(selectedVesselId);
    return state.facilityComments?.[String(facilityId)] || '';
}

function setPlannerFacilityComment(facilityId, comment) {
    const state = getPlannerState(selectedVesselId);
    const next = { ...(state.facilityComments || {}) };
    const clean = String(comment || '').trim();
    if (clean) next[String(facilityId)] = clean;
    else delete next[String(facilityId)];
    setPlannerState(selectedVesselId, { facilityComments: next });
}

function getLocalCalendarEvents(vesselId) {
    return [...(getVesselCalendarState(vesselId)?.events || [])];
}

function getProfileCalendarEvents(vesselId) {
    return (profile.calendarEvents || []).filter((event) => event.vesselId === vesselId);
}

function normalizeEvent(event, source = 'local') {
    const facility = event.facilityId ? facilityMap.get(event.facilityId) : null;
    const start = event.start || (event.date ? `${event.date}T09:00:00` : null);
    const end = event.end || (start ? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString() : null);
    const status = event.status || (event.approved ? 'approved' : 'planned');
    return {
        ...event,
        id: event.id || `${source}_${event.vesselId || ''}_${event.facilityId || ''}_${event.start || event.date || Date.now()}`,
        source,
        title: repairMojibakeText(event.title || (event.type === 'disinfection' ? 'Desinfeksjon' : event.type === 'quarantine' ? 'Karantene' : 'Besøk')),
        start,
        end,
        dateKey: toDateKey(start || event.date),
        facilityName: repairMojibakeText(facility?.name || event.facilityName || event.details || event.facilityId || '-'),
        status,
        planned: event.planned !== false,
        completed: event.completed === true,
        type: event.type || 'visit'
    };
}

function applyProposalStatuses(events, vesselId = selectedVesselId) {
    const proposals = proposalCache.get(vesselId) || [];
    const byProposalId = new Map(proposals.map((item) => [String(item.id), item]));
    return events.map((event) => {
        const proposal = event.proposalId ? byProposalId.get(String(event.proposalId)) : null;
        if (!proposal) return event;
        const hasAlternative = proposal.status === 'alternative_suggested' && proposal.alternative_date && proposal.alternative_time;
        const nextStart = hasAlternative ? `${proposal.alternative_date}T${proposal.alternative_time}:00` : event.start;
        return {
            ...event,
            status: proposal.status || event.status,
            proposal,
            facilityComment: proposal.facility_comment || event.facilityComment || '',
            alternativeDate: proposal.alternative_date || event.alternativeDate || '',
            alternativeTime: proposal.alternative_time || event.alternativeTime || '',
            start: nextStart,
            dateKey: toDateKey(nextStart),
            sharedProposalId: proposal.id
        };
    });
}

function getSelectedVesselEvents() {
    const vessel = getSelectedVessel();
    if (!vessel) return [];
    return getVesselEventsFor(vessel.id);
}

function getVesselEventsFor(vesselId) {
    if (!vesselId) return [];
    const profileEvents = getProfileCalendarEvents(vesselId).map((event) => normalizeEvent(event, 'profile'));
    const localEvents = getLocalCalendarEvents(vesselId).map((event) => normalizeEvent(event, 'local'));
    const all = [...profileEvents, ...localEvents];
    const dedup = new Map();
    for (const event of all) {
        const key = String(event.id || `${event.vesselId}|${event.facilityId}|${event.start}`);
        dedup.set(key, { ...dedup.get(key), ...event });
    }
    return applyProposalStatuses([...dedup.values()], vesselId)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function getUpcomingEvents(vesselId = selectedVesselId) {
    const now = Date.now();
    return getVesselEventsFor(vesselId)
        .filter((event) => new Date(event.start).getTime() >= now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function recalculateRoute(route) {
    if (!route?.batches) return route;
    const speedKmh = Number(route?.speedKmh) > 0 ? Number(route.speedKmh) : DEFAULT_SPEED_KMH;
    const batches = route.batches.map((batch, batchIndex) => {
        const facilities = (batch.facilities || []).map((facility, facilityIndex) => {
            const prev = facilityIndex > 0 ? batch.facilities[facilityIndex - 1] : null;
            const distanceKm = prev && getFacilityCoords(prev) && getFacilityCoords(facility)
                ? haversine(prev.latitude, prev.longitude, facility.latitude, facility.longitude)
                : 0;
            const travelMinutes = Math.round((distanceKm / speedKmh) * 60);
            const operationMinutes = Number(facility.operationMinutes) || getPlannerOperationMinutes(facility.id);
            const liceRisk = getLiceRiskInfo(facility);
            return {
                ...facility,
                distanceKm,
                travelMinutes,
                operationMinutes,
                risk: facility.risk || inferFacilityRisk(facility),
                liceHigh: liceRisk.high,
                liceAdultFemale: liceRisk.adultFemale,
                comment: facility.comment || getPlannerFacilityComment(facility.id)
            };
        });

        return {
            ...batch,
            day: batchIndex + 1,
            facilities,
            totalDistance: facilities.reduce((sum, facility) => sum + (facility.distanceKm || 0), 0),
            totalMinutes: facilities.reduce((sum, facility) => sum + (facility.travelMinutes || 0) + (facility.operationMinutes || DEFAULT_OPERATION_MINUTES), 0),
            needsQuarantine: facilities.some((facility) => (facility.risk?.score || 0) >= 1 || facility.liceHigh === true),
            riskScore: facilities.reduce((max, facility) => Math.max(max, facility.risk?.score || 0), 0)
        };
    });

    batches.forEach((batch, index) => {
        if (index === 0) return;
        const prev = batches[index - 1];
        batch.day = prev.day + (prev.needsQuarantine ? 3 : 1);
    });

    return {
        ...route,
        speedKmh,
        batches,
        totalDays: batches.length > 0 ? batches[batches.length - 1].day : 0,
        totalDistance: batches.reduce((sum, batch) => sum + (batch.totalDistance || 0), 0),
        totalMinutes: batches.reduce((sum, batch) => sum + (batch.totalMinutes || 0), 0),
        hasQuarantine: batches.some((batch) => batch.needsQuarantine)
    };
}

function getFacilityRiskZoneKey(facility, riskScore = inferFacilityRisk(facility).score) {
    if (!facility || riskScore < 1) return null;
    const rawZone = toNonEmptyText(
        facility?._diseaseZoneType,
        facility?.barentsWatchRisk?.zone_type,
        facility?.barentsWatchRisk?.zoneType,
        facility?._diseaseRiskLevel,
        facility?.riskLevel
    );
    if (rawZone) return slugText(rawZone);
    if (riskScore >= 3) {
        return slugText(toNonEmptyText(facility?.localityNo, facility?.id, facility?.name));
    }
    return 'risk-generic';
}

function isFacilityNearBatch(batch, facility, maxRadiusKm = CLUSTER_RADIUS_KM) {
    const candidate = getFacilityCoords(facility);
    if (!candidate || !batch?.facilities?.length) return true;
    for (const existing of batch.facilities) {
        const coords = getFacilityCoords(existing);
        if (!coords) continue;
        const distance = haversine(coords.lat, coords.lon, candidate.lat, candidate.lon);
        if (distance <= maxRadiusKm) return true;
    }
    return false;
}

function canAddFacilityToBatch(batch, facility) {
    if (!batch) return false;
    if (batch.facilities.length >= MAX_FACILITIES_PER_DAY) return false;

    const risk = inferFacilityRisk(facility);
    const liceRisk = getLiceRiskInfo(facility);
    const isRisk = risk.score >= 1 || liceRisk.high === true;
    const isInfected = risk.score >= 3;
    const zoneKey = getFacilityRiskZoneKey(facility, risk.score);

    const existingInfected = batch.facilities.filter((item) => (item.risk?.score || inferFacilityRisk(item).score) >= 3);
    const existingRiskFacilities = batch.facilities.filter((item) => {
        const itemRisk = item.risk?.score || inferFacilityRisk(item).score;
        return itemRisk >= 1 || item.liceHigh === true;
    });

    if (!isFacilityNearBatch(batch, facility)) return false;

    if (isInfected && existingInfected.length > 0) {
        return false;
    }

    if (isRisk && existingRiskFacilities.length > 0 && zoneKey) {
        const hasDifferentZone = existingRiskFacilities.some((item) => {
            const itemRisk = item.risk?.score || inferFacilityRisk(item).score;
            const existingZone = getFacilityRiskZoneKey(item, itemRisk);
            return existingZone && existingZone !== zoneKey;
        });
        if (hasDifferentZone) return false;
    }

    if (existingInfected.length > 0 && isRisk) {
        const infectedZone = getFacilityRiskZoneKey(existingInfected[0], existingInfected[0].risk?.score || inferFacilityRisk(existingInfected[0]).score);
        if (zoneKey && infectedZone && zoneKey !== infectedZone) return false;
    }

    return true;
}

function getConfirmedRoutesForSelected() {
    const vessel = getSelectedVessel();
    if (!vessel) return [];
    return getConfirmedRoutesForVessel(vessel);
}

function getConfirmedRoutesForVessel(vessel, routePlans = null) {
    if (!vessel) return [];
    const mmsi = String(vessel.mmsi || '').trim();
    const plans = Array.isArray(routePlans) ? routePlans : getAllRoutePlans(profile.profileName);
    const unique = new Map();

    plans
        .filter((plan) => String(plan.vesselId || '') === vessel.id || (mmsi && String(plan.mmsi || '') === mmsi))
        .forEach((plan) => {
            const key = String(plan.id || '') || [
                vessel.id,
                mmsi,
                plan.createdAt || '',
                plan.totalDays || '',
                plan.totalDistance || ''
            ].join('|');
            if (!unique.has(key)) unique.set(key, plan);
        });

    return [...unique.values()]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function getVesselPendingRequestCount(vessel) {
    const proposals = proposalCache.get(vessel?.id) || [];
    return proposals.filter((item) => ['pending', 'alternative_suggested'].includes(String(item.status || '').toLowerCase())).length;
}

function getVesselColorCategory(vessel) {
    if (!vessel) return 'vessel-row-operational';
    
    // Check for calendar events (blue)
    const events = getVesselEventsFor(vessel.id);
    const upcomingEvents = events.filter((event) => new Date(event.start).getTime() >= Date.now());
    if (upcomingEvents.length > 0) return 'vessel-row-calendar';
    
    // Default to operational
    return 'vessel-row-operational';
}

function getStatusInfo(vessel) {
    if (!vessel) {
        return { text: 'Ikke valgt', className: 'neutral', detail: 'Velg en båt for å se status.' };
    }
    const mmsi = String(vessel.mmsi || '').trim();
    const proposals = proposalCache.get(vessel.id) || [];
    const pending = proposals.filter((item) => ['pending', 'alternative_suggested'].includes(String(item.status || '').toLowerCase())).length;
    if (!mmsi) {
        return { text: 'Ikke AIS-sporbar', className: 'warn', detail: 'Mangler MMSI og kan ikke spores/signes grønt via AIS.' };
    }
    if (isMmsiCleared(profile.profileName, pilotActor, mmsi)) {
        const clearance = getMmsiClearance(profile.profileName, pilotActor, mmsi);
        return {
            text: 'Klarert',
            className: 'ok',
            detail: clearance?.signedAt ? `Signert ${isoToLocal(clearance.signedAt)}` : 'Klar for besøk'
        };
    }
    if (pending > 0) {
        return { text: 'Avventer svar', className: 'warn', detail: `${pending} forespørsler venter på anlegg.` };
    }
    return { text: 'Ikke klarert', className: 'neutral', detail: 'Mangler grønn signering eller aktiv godkjenning.' };
}

function inferFacilityRisk(facility) {
    if (!facility) return { score: 0, label: 'Normal', className: 'ok' };
    const tags = (facility.tags || []).map((item) => slugText(item));
    const riskLevel = slugText(facility?._diseaseRiskLevel || facility?.barentsWatchRisk?.risk_level || facility?.riskLevel || '');
    const zoneType = normalizeAsciiText(facility?._diseaseZoneType || facility?.barentsWatchRisk?.zone_type || facility?.zone_type || '');
    const disease = normalizeAsciiText(facility?._diseaseName || facility?.barentsWatchRisk?.disease || facility?.disease || '');
    const statusText = slugText(facility?.status || facility?.healthStatus || '');
    const infected = facility?._diseaseConfirmed === true
        || statusText.includes('smitt')
        || statusText.includes('infect')
        || tags.some((tag) => tag.includes('smitt') || tag.includes('infect'));
    if (infected) return { score: 3, label: 'Smittet', className: 'danger' };
    const liceRisk = getLiceRiskInfo(facility);
    if (liceRisk.high) return { score: 2, label: 'Høy lus', className: 'warn' };
    if ((disease.includes('ila') || zoneType.includes('protection') || zoneType.includes('vern')) && (zoneType.includes('protection') || zoneType.includes('vern'))) {
        return { score: 2, label: 'ILA vernesone', className: 'warn' };
    }
    if ((disease.includes('ila') || zoneType.includes('surveillance') || zoneType.includes('overvak')) && (zoneType.includes('surveillance') || zoneType.includes('overvak'))) {
        return { score: 1, label: 'ILA overvåkning', className: 'warn' };
    }
    if (['høy', 'ekstrem', 'high', 'extreme'].includes(riskLevel)) return { score: 2, label: 'Høy risiko', className: 'warn' };
    if (['moderat', 'medium', 'moderate'].includes(riskLevel) || tags.some((tag) => tag.includes('risk'))) {
        return { score: 1, label: 'Risiko', className: 'warn' };
    }
    return { score: 0, label: 'Normal', className: 'ok' };
}

function renderFacilitySignalBadges(facility) {
    const risk = inferFacilityRisk(facility);
    const items = [];
    if (risk.label !== 'Normal' && risk.label !== 'Risiko') {
        const cls = risk.score >= 3 ? 'danger' : 'warn';
        items.push(`<span class="fpl-badge ${cls}">${risk.label}</span>`);
    } else if (risk.label === 'Risiko') {
        items.push('<span class="fpl-badge warn">Risiko</span>');
    }
    if (facility._calendarEnabled) items.push('<span class="fpl-badge ok">Kalender aktiv</span>');
    items.push(renderProductionBadge(facility));
    return items.join('');
}

function getLiceRiskInfo(facility) {
    const lice = facility?.lice || {};
    const adultCandidates = [
        facility?.liceAdultFemale,
        facility?.lice_adult_female,
        lice?.adult_female,
        lice?.adult_female_avg,
        lice?.adult_female_mean,
        lice?.holus,
        lice?.adult_female_count
    ];
    const adultFemale = adultCandidates
        .map((value) => Number(value))
        .find((value) => Number.isFinite(value) && value >= 0);

    const high = facility?.liceHigh === true
        || facility?.lice_over_threshold === true
        || lice?.over_threshold === true
        || (Number.isFinite(adultFemale) && adultFemale >= 0.5);

    return {
        high,
        adultFemale: Number.isFinite(adultFemale) ? adultFemale : null
    };
}

function getFacilityProductionInfo(facility) {
    const raw = toNonEmptyText(
        facility?.production_type,
        facility?.productionType,
        facility?.fdir?.production_type,
        facility?.fdir?.species,
        facility?.species
    );
    const normalized = slugText(raw);

    if (!normalized) return { label: 'Ukjent produksjon', className: 'prod-unknown' };
    if (/(smolt|settefisk|yngel)/.test(normalized)) return { label: raw || 'Smolt', className: 'prod-smolt' };
    if (/(stamfisk|brood|rogn)/.test(normalized)) return { label: raw || 'Stamfisk', className: 'prod-stamfisk' };
    if (/(skjell|musling|oyster|østers|tare|alge|algae|shell)/.test(normalized)) return { label: raw, className: 'prod-shell' };
    if (/(matfisk|laks|salmon|orret|ørret|regnbue)/.test(normalized)) return { label: raw || 'Matfisk', className: 'prod-matfisk' };
    return { label: raw, className: 'prod-unknown' };
}

function renderProductionBadge(facility) {
    const info = getFacilityProductionInfo(facility);
    return `<span class="production-badge ${info.className}">${info.label}</span>`;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getFacilityCoords(facility) {
    const lat = Number(facility?.latitude);
    const lon = Number(facility?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function sortFacilitiesForRoute(facilities, mode) {
    const sortable = facilities.map((facility) => {
        const coords = getFacilityCoords(facility);
        return { facility, risk: inferFacilityRisk(facility), coords };
    });

    if (mode === 'safe') {
        sortable.sort((a, b) => a.risk.score - b.risk.score || String(a.facility.name || '').localeCompare(String(b.facility.name || '')));
        return sortable.map((item) => item.facility);
    }

    const remaining = [...sortable];
    const sorted = [];
    let current = remaining.shift() || null;
    while (current) {
        sorted.push(current.facility);
        if (remaining.length === 0) break;
        if (!current.coords) {
            current = remaining.shift() || null;
            continue;
        }
        let nextIndex = 0;
        let nextDistance = Infinity;
        remaining.forEach((candidate, index) => {
            if (!candidate.coords) return;
            const dist = haversine(current.coords.lat, current.coords.lon, candidate.coords.lat, candidate.coords.lon);
            if (dist < nextDistance) {
                nextDistance = dist;
                nextIndex = index;
            }
        });
        current = remaining.splice(nextIndex, 1)[0] || null;
    }
    const nonInfected = sorted.filter((facility) => inferFacilityRisk(facility).score < 3);
    const infected = sorted.filter((facility) => inferFacilityRisk(facility).score >= 3);
    return [...nonInfected, ...infected];
}

/**
 * Build geographic clusters of facilities within CLUSTER_RADIUS_KM of each other.
 * Clusters with 1-2 facilities are merged with their nearest neighbour cluster
 * (up to MAX_MERGE_KM away) to avoid single-facility days.
 */
function buildGeographicClusters(facilities) {
    const MAX_MERGE_KM = 35;
    if (facilities.length === 0) return [];

    const remaining = [...facilities];
    const clusters = [];

    while (remaining.length > 0) {
        const seed = remaining.shift();
        const seedCoords = getFacilityCoords(seed);
        const cluster = { facilities: [seed] };

        const nearbyIndices = [];
        for (let i = 0; i < remaining.length; i++) {
            const coords = getFacilityCoords(remaining[i]);
            if (!coords || !seedCoords) continue;
            if (haversine(seedCoords.lat, seedCoords.lon, coords.lat, coords.lon) <= CLUSTER_RADIUS_KM) {
                cluster.facilities.push(remaining[i]);
                nearbyIndices.push(i);
            }
        }
        for (let i = nearbyIndices.length - 1; i >= 0; i--) remaining.splice(nearbyIndices[i], 1);

        // Update centroid
        const withCoords = cluster.facilities.filter((f) => getFacilityCoords(f));
        cluster.center = withCoords.length > 0 ? {
            lat: withCoords.reduce((s, f) => s + Number(f.latitude), 0) / withCoords.length,
            lon: withCoords.reduce((s, f) => s + Number(f.longitude), 0) / withCoords.length
        } : null;

        clusters.push(cluster);
    }

    // Merge small clusters with nearest neighbour
    let merging = true;
    while (merging) {
        merging = false;
        let smallIdx = -1;
        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].facilities.length <= 2 && (smallIdx === -1 || clusters[i].facilities.length < clusters[smallIdx].facilities.length)) {
                smallIdx = i;
            }
        }
        if (smallIdx === -1) break;

        const small = clusters[smallIdx];
        let nearestIdx = -1;
        let nearestDist = Infinity;
        for (let i = 0; i < clusters.length; i++) {
            if (i === smallIdx || !small.center || !clusters[i].center) continue;
            const dist = haversine(small.center.lat, small.center.lon, clusters[i].center.lat, clusters[i].center.lon);
            if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
        }
        if (nearestIdx !== -1 && nearestDist <= MAX_MERGE_KM) {
            clusters[nearestIdx].facilities.push(...small.facilities);
            const wc = clusters[nearestIdx].facilities.filter((f) => getFacilityCoords(f));
            clusters[nearestIdx].center = wc.length > 0 ? {
                lat: wc.reduce((s, f) => s + Number(f.latitude), 0) / wc.length,
                lon: wc.reduce((s, f) => s + Number(f.longitude), 0) / wc.length
            } : clusters[nearestIdx].center;
            clusters.splice(smallIdx, 1);
            merging = true;
        } else {
            break;
        }
    }

    return clusters;
}

/**
 * Given geographic clusters, produce a risk-safe ordered flat list of facilities.
 * Clean facilities come before risk facilities within each cluster.
 * Infected are always placed last (highest risk at end of day for biosecurity).
 * Clusters are visited in nearest-neighbour order from the cluster list.
 */
function orderFacilitiesByCluster(facilities, mode) {
    const clusters = buildGeographicClusters(facilities);
    if (clusters.length === 0) return sortFacilitiesForRoute(facilities, mode);

    // Order clusters: safe-first (green first, risk last)
    const sortedClusters = clusters.slice().sort((a, b) => {
        const aScore = Math.max(0, ...a.facilities.map((f) => inferFacilityRisk(f).score));
        const bScore = Math.max(0, ...b.facilities.map((f) => inferFacilityRisk(f).score));
        return aScore - bScore;
    });

    const result = [];
    for (const cluster of sortedClusters) {
        const green = cluster.facilities.filter((f) => inferFacilityRisk(f).score === 0);
        const moderate = cluster.facilities.filter((f) => inferFacilityRisk(f).score >= 1 && inferFacilityRisk(f).score < 3);
        const infected = cluster.facilities.filter((f) => inferFacilityRisk(f).score >= 3);
        result.push(...green, ...moderate, ...infected);
    }
    return result;
}

function buildPlannedRoute(vesselId) {
    const vessel = vesselMap.get(vesselId);
    const state = getPlannerState(vesselId);
    const facilities = (state.selectedFacilityIds || [])
        .map((id) => facilityMap.get(id))
        .filter(Boolean);
    if (facilities.length === 0) return null;

    const routeMode = state.routeMode || 'safe';
    const speedKmh = getRouteSpeedKmh(vesselId);
    const routeBaseDate = getRouteBaseDateForState(state);
    const ordered = orderFacilitiesByCluster(facilities, routeMode);
    const batches = [];
    let currentBatch = null;
    let scheduleDay = 1;

    ordered.forEach((facility) => {
        const risk = inferFacilityRisk(facility);
        if (!currentBatch || !canAddFacilityToBatch(currentBatch, facility)) {
            currentBatch = {
                day: scheduleDay,
                facilities: [],
                totalDistance: 0,
                totalMinutes: 0,
                needsQuarantine: false,
                riskScore: 0,
                departureTime: state.routeDepartureTime || '07:30'
            };
            batches.push(currentBatch);
            if (batches.length > 1) {
                const prev = batches[batches.length - 2];
                scheduleDay = prev.day + (prev.needsQuarantine ? 3 : 1);
                currentBatch.day = scheduleDay;
            }
        }

        if (currentBatch) {
            const batchDate = new Date(routeBaseDate);
            batchDate.setDate(batchDate.getDate() + ((currentBatch.day || 1) - 1));
            if (isFacilityBlockedOnDate(facility, batchDate)) {
                currentBatch.blockedByCalendar = true;
                currentBatch.blockedFacilities = [...(currentBatch.blockedFacilities || []), facility.name || facility.id];
                return;
            }
        }

        const prev = currentBatch.facilities[currentBatch.facilities.length - 1] || null;
        const distanceKm = prev && getFacilityCoords(prev) && getFacilityCoords(facility)
            ? haversine(prev.latitude, prev.longitude, facility.latitude, facility.longitude)
            : 0;
        const travelMinutes = Math.round((distanceKm / speedKmh) * 60);
        const operationMinutes = getPlannerOperationMinutes(facility.id);
        const liceRisk = getLiceRiskInfo(facility);
        currentBatch.totalDistance += distanceKm;
        currentBatch.totalMinutes += travelMinutes + operationMinutes;
        currentBatch.needsQuarantine = currentBatch.needsQuarantine || risk.score >= 1 || liceRisk.high;
        currentBatch.riskScore = Math.max(currentBatch.riskScore, risk.score);
        currentBatch.facilities.push({
            ...facility,
            distanceKm,
            travelMinutes,
            operationMinutes,
            risk,
            liceHigh: liceRisk.high,
            liceAdultFemale: liceRisk.adultFemale,
            comment: getPlannerFacilityComment(facility.id)
        });

        for (let idx = 1; idx < batches.length; idx += 1) {
            const prev = batches[idx - 1];
            batches[idx].day = prev.day + (prev.needsQuarantine ? 3 : 1);
        }
    });

    return {
        vesselId: vessel?.id || null,
        vesselName: vessel?.name || null,
        mmsi: String(vessel?.mmsi || '').trim(),
        createdAt: new Date().toISOString(),
        routeMode,
        speedKmh,
        routePlanDate: state.routePlanDate || '',
        routeDepartureTime: state.routeDepartureTime || '07:30',
        totalDays: batches.length > 0 ? batches[batches.length - 1].day : 0,
        totalDistance: batches.reduce((sum, batch) => sum + batch.totalDistance, 0),
        totalMinutes: batches.reduce((sum, batch) => sum + batch.totalMinutes, 0),
        hasQuarantine: batches.some((batch) => batch.needsQuarantine),
        hasCalendarBlockedFacilities: batches.some((batch) => batch.blockedByCalendar === true),
        batches
    };
}

function savePlannedRoute(vesselId, route) {
    setPlannerState(vesselId, { plannedRoute: route });
}

function getPlannedRoute() {
    return getPlannerState(selectedVesselId).plannedRoute || null;
}

function formatDuration(minutes) {
    const safe = Math.max(0, Math.round(minutes || 0));
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    if (hours && mins) return `${hours}t ${mins}m`;
    if (hours) return `${hours}t`;
    return `${mins}m`;
}

function getFacilitySourceLabel() {
    if (facilityDataSource === 'api+profil') return 'API + profil';
    if (facilityDataSource === 'profil') return 'Profil (fallback)';
    return facilityDataSource || 'Ukjent';
}

function getRiskVisualClass(score) {
    if (score >= 3) return 'risk-high';
    if (score >= 2) return 'risk-mid';
    if (score >= 1) return 'risk-low';
    return 'risk-none';
}

function getDayRiskScore(dayEvents, isQuarantineDay) {
    let score = isQuarantineDay ? 3 : 0;
    for (const event of dayEvents) {
        const type = slugText(event?.type || '');
        if (type === 'quarantine') {
            score = Math.max(score, 3);
            continue;
        }
        if (type === 'disinfection') {
            score = Math.max(score, 2);
            continue;
        }
        if (type === 'visit') {
            const riskLabel = slugText(event?.riskLabel || 'normal');
            if (riskLabel.includes('smitt')) score = Math.max(score, 3);
            else if (riskLabel.includes('høy') || riskLabel.includes('ekstrem')) score = Math.max(score, 2);
            else if (riskLabel.includes('risiko') || riskLabel.includes('moderat')) score = Math.max(score, 1);
            else score = Math.max(score, 0);
        }
    }
    return score;
}

function getRouteBiosecuritySummary(route) {
    const facilities = (route?.batches || []).flatMap((batch) => batch.facilities || []);
    const infectedCount = facilities.filter((facility) => (facility.risk?.score || 0) >= 3).length;
    const highLiceCount = facilities.filter((facility) => facility.liceHigh === true).length;
    const zoneRiskCount = facilities.filter((facility) => {
        const score = facility.risk?.score || 0;
        return score >= 1 && score < 3;
    }).length;
    return { infectedCount, highLiceCount, zoneRiskCount };
}

function renderFacilitySourceNote() {
    const note = document.getElementById('facilitySourceNote');
    const mapMeta = document.getElementById('mapMeta');
    const plannerMeta = document.getElementById('plannerMeta');
    const label = getFacilitySourceLabel();
    const count = getFacilityListForPlanner().length;
    const message = `Anleggskilde: ${label} · ${count} tilgjengelige anlegg`;

    if (note) {
        note.textContent = message;
        note.classList.remove('is-api', 'is-fallback');
        note.classList.add(facilityDataSource === 'api+profil' ? 'is-api' : 'is-fallback');
    }
    if (mapMeta) mapMeta.textContent = `Klikk anlegg for å legge til/fjerne fra rute. ${label} brukes nå.`;
    if (plannerMeta) plannerMeta.textContent = `Velg anlegg, sett operasjonstid og beregn rute. ${count} anlegg tilgjengelig.`;
}

function getBatchDate(batch) {
    const state = getPlannerState(selectedVesselId);
    const base = getRouteBaseDateForState(state);
    base.setDate(base.getDate() + ((batch?.day || 1) - 1));
    return base;
}

function makeEventId(prefix = 'evt') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function addCalendarEvents(vesselId, events) {
    updateVesselCalendarState(vesselId, (state) => ({
        ...state,
        events: [...(state.events || []), ...events]
    }));
}

function updateCalendarEvent(vesselId, eventId, patch) {
    updateVesselCalendarState(vesselId, (state) => ({
        ...state,
        events: (state.events || []).map((event) => event.id === eventId ? { ...event, ...patch } : event)
    }));
}

function deleteCalendarEvent(vesselId, eventId) {
    updateVesselCalendarState(vesselId, (state) => ({
        ...state,
        events: (state.events || []).filter((event) => event.id !== eventId)
    }));
}

function addPlannedRouteToCalendar() {
    const route = getPlannedRoute();
    const vessel = getSelectedVessel();
    if (!route || !vessel) {
        showStatus('Ingen planlagt rute å legge i kalender.', 'warning');
        return;
    }
    if (!ensureCanManageVessel(vessel, 'Legg rute i kalender')) return;

    const events = [];
    route.batches.forEach((batch) => {
        const batchDate = getBatchDate(batch);
        let runningTime = batch.departureTime || route.routeDepartureTime || '07:30';
        let lastVisitEnd = null;
        batch.facilities.forEach((facility, index) => {
            const [hh, mm] = runningTime.split(':').map(Number);
            const start = new Date(batchDate);
            start.setHours(Number.isFinite(hh) ? hh : 7, Number.isFinite(mm) ? mm : 30, 0, 0);
            if (index > 0) {
                const prev = batch.facilities[index - 1];
                const deltaMinutes = (prev.operationMinutes || 0) + (facility.travelMinutes || 0);
                start.setTime(start.getTime() + deltaMinutes * 60 * 1000);
            }
            const end = new Date(start.getTime() + (facility.operationMinutes || DEFAULT_OPERATION_MINUTES) * 60 * 1000);
            lastVisitEnd = end;
            events.push({
                id: makeEventId('visit'),
                vesselId: vessel.id,
                facilityId: facility.id,
                facilityName: facility.name,
                title: `Besøk · ${facility.name}`,
                start: start.toISOString(),
                end: end.toISOString(),
                type: 'visit',
                planned: true,
                completed: false,
                status: 'planned',
                routeBatchDay: batch.day,
                routeMode: route.routeMode,
                comment: facility.comment || '',
                riskLabel: facility.risk?.label || 'Normal',
                liceHigh: facility.liceHigh === true,
                liceAdultFemale: facility.liceAdultFemale
            });
        });
        if (batch.needsQuarantine) {
            const hasInfected = batch.facilities.some((facility) => (facility.risk?.score || 0) >= 3);
            const hasHighLice = batch.facilities.some((facility) => facility.liceHigh === true);

            const disinfectionStart = new Date(lastVisitEnd || batchDate);
            disinfectionStart.setMinutes(disinfectionStart.getMinutes() + 15);
            const disinfectionEnd = new Date(disinfectionStart.getTime() + DISINFECTION_TIME_MINUTES * 60 * 1000);

            events.push({
                id: makeEventId('disinfection'),
                vesselId: vessel.id,
                title: hasInfected
                    ? `Desinfeksjon etter smittet-besøk (dag ${batch.day})`
                    : hasHighLice
                    ? `Desinfeksjon etter høye lusetall (dag ${batch.day})`
                    : `Desinfeksjon etter risikobesøk (dag ${batch.day})`,
                start: disinfectionStart.toISOString(),
                end: disinfectionEnd.toISOString(),
                type: 'disinfection',
                planned: true,
                completed: false,
                status: 'planned',
                routeBatchDay: batch.day
            });

            const quarantineStart = new Date(disinfectionEnd);
            const quarantineEnd = new Date(quarantineStart.getTime() + QUARANTINE_HOURS * 60 * 60 * 1000);
            events.push({
                id: makeEventId('quarantine'),
                vesselId: vessel.id,
                title: `Karantene (48t) etter dag ${batch.day}`,
                start: quarantineStart.toISOString(),
                end: quarantineEnd.toISOString(),
                type: 'quarantine',
                planned: true,
                completed: false,
                status: 'planned',
                routeBatchDay: batch.day,
                quarantineHours: QUARANTINE_HOURS
            });
        }
    });

    addCalendarEvents(vessel.id, events);
    showStatus(`La ${events.length} hendelser til i kalenderen for ${vessel.name}.`, 'success');
    renderAll();
}

async function confirmPlannedRoute() {
    const route = getPlannedRoute();
    const vessel = getSelectedVessel();
    if (!route || !vessel) {
        showStatus('Ingen planlagt rute å bekrefte.', 'warning');
        return;
    }
    if (!ensureCanManageVessel(vessel, 'Bekreft rute')) return;

    const payload = {
        mmsi: route.mmsi,
        vessel_name: route.vesselName,
        route: route.batches.map((batch) => ({
            day: batch.day,
            date: formatDateOnly(getBatchDate(batch)),
            needs_quarantine: batch.needsQuarantine,
            facilities: batch.facilities.map((facility) => ({
                id: facility.id,
                name: facility.name,
                latitude: facility.latitude,
                longitude: facility.longitude,
                operation_minutes: facility.operationMinutes,
                comment: facility.comment || ''
            }))
        })),
        notes: `Pilot Lite route (${route.totalDays} dager)`
    };

    let source = 'local';
    let apiErrorReason = '';
    try {
        const response = await fetch(`${API_BASE}/api/boat/plan/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success === false) {
            throw new Error(getApiErrorMessage(result, response, 'Kunne ikke bekrefte rute'));
        }
        source = 'api';
    } catch (error) {
        source = 'local';
        apiErrorReason = error?.message || 'API utilgjengelig';
    }

    const record = appendRoutePlan(profile.profileName, pilotActor, {
        id: makeEventId('route'),
        vesselId: vessel.id,
        vesselName: vessel.name,
        mmsi: route.mmsi,
        source,
        status: source === 'api' ? 'Bekreftet på server' : 'Lokal fallback',
        totalDays: route.totalDays,
        totalDistance: route.totalDistance,
        hasQuarantine: route.hasQuarantine,
        routeMode: route.routeMode,
        batches: route.batches
    });

    savePlannedRoute(vessel.id, { ...route, confirmedRouteId: record.id });
    resetPlannerForVessel(vessel.id);
    showStatus(
        source === 'api'
            ? 'Rute bekreftet og lagret på server.'
            : `Rute lagret lokalt (fallback). Årsak: ${apiErrorReason || 'API utilgjengelig'}`,
        source === 'api' ? 'success' : 'warning'
    );
    renderAll();
}

function getFacilityListForPlanner() {
    const list = plannerFacilities || [];
    const plannerMeta = document.getElementById('plannerMeta');
    const count = list.length;
    if (plannerMeta) plannerMeta.textContent = `Velg anlegg, sett operasjonstid og beregn rute. ${count} anlegg tilgjengelig.`;
    return list;
}

function getPlannerAlertItems(route, vessel) {
    if (!route || !vessel) return [];
    const items = [];

    if (!String(vessel?.mmsi || '').trim()) {
        items.push('Båten mangler MMSI: kun planlegging, ingen live AIS-sporing.');
    }

    if (route.hasQuarantine) {
        const bio = getRouteBiosecuritySummary(route);
        items.push(`Biosecurity-rute: ${bio.infectedCount} smittet · ${bio.zoneRiskCount} risikosone · ${bio.highLiceCount} høy lus.`);
    }

    if (aisSummarySnapshot.vesselId === vessel.id) {
        const aisText = String(aisSummarySnapshot.text || '');
        if (!aisText || aisText.includes('AIS utilgjengelig') || aisText.includes('Ingen live/sist kjent')) {
            items.push('AIS-status usikker: verifiser siste kjente posisjon før endelig bekreftelse.');
        }
    }

    return items;
}

function toggleFacilitySelection(facilityId) {
    const next = getSelectedFacilityIds();
    if (next.has(facilityId)) next.delete(facilityId);
    else next.add(facilityId);
    setSelectedFacilityIds(next);
    savePlannedRoute(selectedVesselId, null);
    renderPlannerState();
    renderMap();
}

function splitBatch(batchIndex) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex]) return;
    const batch = route.batches[batchIndex];
    if (batch.facilities.length < 2) return;
    const midpoint = Math.ceil(batch.facilities.length / 2);
    const first = { ...batch, facilities: batch.facilities.slice(0, midpoint) };
    const second = { ...batch, facilities: batch.facilities.slice(midpoint) };
    const batches = [...route.batches];
    batches.splice(batchIndex, 1, first, second);
    batches.forEach((item, idx) => { item.day = idx + 1; });
    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches, totalDays: batches.length }));
    renderPlannerState();
}

function mergeBatch(batchIndex) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex] || !route?.batches?.[batchIndex + 1]) return;
    const current = route.batches[batchIndex];
    const next = route.batches[batchIndex + 1];
    const merged = { ...current, facilities: [...current.facilities, ...next.facilities] };
    const batches = [...route.batches];
    batches.splice(batchIndex, 2, merged);
    batches.forEach((item, idx) => { item.day = idx + 1; });
    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches, totalDays: batches.length }));
    renderPlannerState();
}

function confirmRouteDayCompletion(dayNumber) {
    const vessel = getSelectedVessel();
    const route = getPlannedRoute();
    if (!vessel || !route) return;

    const targetDay = Number(dayNumber);
    if (!Number.isFinite(targetDay) || targetDay <= 0) return;

    const dayEvents = getSelectedVesselEvents().filter((event) => Number(event?.routeBatchDay || 0) === targetDay);
    if (dayEvents.length === 0) {
        showStatus(`Ingen kalenderhendelser funnet for dag ${targetDay}. Legg ruten i kalender først.`, 'warning');
        return;
    }

    let updated = 0;
    dayEvents.forEach((event) => {
        if (event.completed === true && String(event.status || '').toLowerCase() === 'approved') return;
        updateCalendarEvent(vessel.id, event.id, { completed: true, status: 'approved' });
        updated += 1;
    });

    if (updated > 0) {
        showStatus(`Dag ${targetDay} bekreftet: ${updated} hendelser markert som fullført (inkl. desinfeksjon/karantene).`, 'success');
    }
    renderAll();
}

function moveFacility(batchIndex, facilityIndex, direction) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex]) return;
    const batches = route.batches.map((batch) => ({ ...batch, facilities: [...batch.facilities] }));
    const batch = batches[batchIndex];
    const facility = batch.facilities[facilityIndex];
    if (!facility) return;
    batch.facilities.splice(facilityIndex, 1);
    const targetIndex = direction === 'next' ? batchIndex + 1 : batchIndex - 1;
    if (targetIndex < 0) {
        batch.facilities.unshift(facility);
    } else if (targetIndex >= batches.length) {
        batches.push({
            day: batches.length + 1,
            facilities: [facility],
            totalDistance: 0,
            totalMinutes: facility.operationMinutes || DEFAULT_OPERATION_MINUTES,
            needsQuarantine: facility.risk?.score >= 2,
            riskScore: facility.risk?.score || 0,
            departureTime: route.routeDepartureTime || '07:30'
        });
    } else {
        batches[targetIndex].facilities.push(facility);
    }
    const cleaned = batches.filter((item) => item.facilities.length > 0);
    cleaned.forEach((item, idx) => { item.day = idx + 1; });
    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches: cleaned, totalDays: cleaned.length }));
    renderPlannerState();
}

function removeFacilityFromBatch(batchIndex, facilityIndex) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex]) return;
    const batches = route.batches.map((batch) => ({ ...batch, facilities: [...batch.facilities] }));
    batches[batchIndex].facilities.splice(facilityIndex, 1);
    const cleaned = batches.filter((item) => item.facilities.length > 0);
    cleaned.forEach((item, idx) => { item.day = idx + 1; });
    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches: cleaned, totalDays: cleaned.length }));
    renderPlannerState();
}

function updateBatchDeparture(batchIndex, time) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex]) return;
    const batches = route.batches.map((batch, idx) => idx === batchIndex ? { ...batch, departureTime: time } : batch);
    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches, routeDepartureTime: time }));
    setPlannerState(selectedVesselId, { routeDepartureTime: time });
    renderPlannerState();
}

function updateRouteFacilityOperationTime(batchIndex, facilityIndex, totalMinutes) {
    const route = getPlannedRoute();
    if (!route?.batches?.[batchIndex]?.facilities?.[facilityIndex]) return;

    const safeMinutes = Math.min(24 * 60, Math.max(5, parseInt(totalMinutes, 10) || DEFAULT_OPERATION_MINUTES));
    const target = route.batches[batchIndex].facilities[facilityIndex];
    if (!target) return;

    setPlannerOperationMinutes(target.id, safeMinutes);

    const batches = route.batches.map((batch, idx) => {
        if (idx !== batchIndex) return { ...batch, facilities: [...batch.facilities] };
        const facilities = batch.facilities.map((facility, fIdx) => (
            fIdx === facilityIndex
                ? { ...facility, operationMinutes: safeMinutes }
                : { ...facility }
        ));
        return { ...batch, facilities };
    });

    savePlannedRoute(selectedVesselId, recalculateRoute({ ...route, batches }));
    renderPlannerState();
}

function renderCards() {
    const vessels = getFilteredVessels();
    const clearedSet = new Set(listClearedMmsi(profile.profileName, pilotActor));
    const allRoutePlans = getAllRoutePlans(profile.profileName);
    const totalEvents = vessels.reduce((sum, vessel) => sum + getVesselEventsFor(vessel.id).length, 0);
    const totalPending = vessels.reduce((sum, vessel) => sum + getVesselPendingRequestCount(vessel), 0);
    const totalConfirmed = vessels.reduce((sum, vessel) => sum + getConfirmedRoutesForVessel(vessel, allRoutePlans).length, 0);

    document.getElementById('cardVessels').textContent = String(vessels.length);
    document.getElementById('cardTrackable').textContent = String(vessels.filter((item) => String(item.mmsi || '').trim()).length);
    document.getElementById('cardCleared').textContent = String(vessels.filter((item) => String(item.mmsi || '').trim() && clearedSet.has(String(item.mmsi))).length);
    document.getElementById('cardEvents').textContent = String(totalEvents);
    document.getElementById('cardPendingRequests').textContent = String(totalPending);
    document.getElementById('cardConfirmedRoutes').textContent = String(totalConfirmed);
}

function renderVesselTable() {
    const tbody = document.getElementById('vesselBody');
    tbody.innerHTML = '';
    const vessels = getFilteredVessels();

    if (vessels.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.style.color = 'var(--muted)';
        td.textContent = 'Ingen båter matcher gjeldende filter/scope. Velg "Alle selskaper" eller fjern kategori/sporbar-filter.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    for (const vessel of vessels) {
        const tr = document.createElement('tr');
        const colorCategory = getVesselColorCategory(vessel);
        tr.className = vessel.id === selectedVesselId ? `table-row-selected ${colorCategory}` : colorCategory;
        tr.addEventListener('click', () => {
            selectedVesselId = vessel.id;
            syncSelectorsToSelectedVessel();
            renderAll();
        });

        const tdName = document.createElement('td');
        tdName.className = 'vessel-name-cell';
        tdName.innerHTML = `
            <div class="vessel-name-main">${vessel.name || '-'}</div>
            <div class="vessel-name-sub">${vessel.type || 'Type ukjent'}</div>
        `;
        tr.appendChild(tdName);

        const tdStatus = document.createElement('td');
        const status = getStatusInfo(vessel);
        const aisState = getAisStateForVessel(vessel);
        const shortStatus = status.text === 'Avventer svar'
            ? 'Venter'
            : status.text === 'Ikke klarert'
            ? 'Ikke klar'
            : status.text === 'Ikke AIS-sporbar'
            ? 'Ingen MMSI'
            : status.text;
        const shortAis = aisState.className === 'ok' ? 'AIS OK' : 'AIS NEI';
        tdStatus.innerHTML = `
            <div class="vessel-stack-badges">
                <span class="status-pill ${status.className}">${shortStatus}</span>
                <span class="status-pill ${aisState.className}">${shortAis}</span>
            </div>
        `;
        tr.appendChild(tdStatus);

        const tdCalendar = document.createElement('td');
        const events = getVesselEventsFor(vessel.id);
        const upcoming = events.filter((event) => new Date(event.start).getTime() >= Date.now()).length;
        tdCalendar.innerHTML = `<div class="vessel-calendar-mini"><strong>${events.length}</strong><span>${upcoming} kom.</span></div>`;
        tr.appendChild(tdCalendar);

        const mode = getManualBoatAvailability(vessel.id);
        const tdAvailability = document.createElement('td');
        const modeLabel = mode === 'available' ? 'Ledig' : mode === 'unavailable' ? 'Ikke ledig' : 'Auto';
        const modeClass = mode === 'available' ? 'ok' : mode === 'unavailable' ? 'danger' : 'neutral';
        tdAvailability.innerHTML = `
            <button type="button" class="mini-btn vessel-mode-btn ${modeClass}" data-cycle-boat-mode="${vessel.id}" title="Bytt mellom Auto, Ledig, Ikke ledig">
                ${modeLabel}
            </button>
        `;
        const modeButton = tdAvailability.querySelector('[data-cycle-boat-mode]');
        modeButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            const nextMode = cycleBoatAvailabilityMode(mode);
            setManualBoatAvailability(vessel.id, nextMode);
            renderAll();
        });
        tr.appendChild(tdAvailability);

        tbody.appendChild(tr);
    }
}

function renderSelectedVesselSummary() {
    const vessel = getSelectedVessel();
    const meta = document.getElementById('selectedVesselMeta');
    const statusNode = document.getElementById('selectedVesselStatus');
    const metaRail = document.getElementById('selectedVesselMetaRail');
    const statusNodeRail = document.getElementById('selectedVesselStatusRail');
    const railCard = document.getElementById('selectedVesselRailCard');
    const nextVisitNode = document.getElementById('selectedNextVisit');
    const routeCountNode = document.getElementById('selectedRouteCount');
    const healthBox = document.getElementById('healthPassBox');

    if (!vessel) {
        meta.textContent = 'Ingen båt valgt';
        statusNode.className = 'status-pill neutral';
        statusNode.textContent = 'Ikke valgt';
        if (metaRail) metaRail.hidden = true;
        if (statusNodeRail) {
            statusNodeRail.className = 'status-pill neutral';
            statusNodeRail.textContent = 'Ikke valgt';
        }
        if (railCard) {
            railCard.className = 'vessel-hero-card empty';
            railCard.textContent = 'Velg en båt for å se operativ status.';
        }
        nextVisitNode.textContent = '-';
        routeCountNode.textContent = '-';
        healthBox.innerHTML = '<div class="risk-mini-sub">Velg en båt fra listen.</div>';
        return;
    }

    const status = getStatusInfo(vessel);
    const events = getSelectedVesselEvents();
    const upcoming = events.filter((event) => new Date(event.start).getTime() >= Date.now()).slice(0, 1)[0] || null;
    const confirmedRoutes = getConfirmedRoutesForSelected();
    const mmsi = String(vessel.mmsi || '').trim();
    const vesselType = String(vessel.type || '').trim();
    const clearance = mmsi ? getMmsiClearance(profile.profileName, pilotActor, mmsi) : null;
    const company = companyMap.get(vessel.companyId)?.name || '';
    const aisState = getAisStateForVessel(vessel);
    const effectiveCoords = getEffectiveVesselCoordinates(vessel);
    const availabilityMode = getManualBoatAvailability(vessel.id);
    const pendingRequests = getVesselPendingRequestCount(vessel);
    const plannerState = getPlannerState(vessel.id);
    const demoOps = getVesselDemoOps(vessel.id);
    const selectedFacilitiesCount = Array.isArray(plannerState?.selectedFacilityIds) ? plannerState.selectedFacilityIds.length : 0;
    const mmsiText = mmsi ? `MMSI ${mmsi}` : 'MMSI mangler';
    const aisText = aisState.className === 'ok' ? 'AIS ok' : 'AIS nei';

    meta.textContent = `${vessel.name}${vessel.type ? ` · ${vessel.type}` : ''} · ${mmsiText} · ${aisText}`;
    statusNode.className = `status-pill ${status.className}`;
    statusNode.textContent = status.text;
    if (metaRail) metaRail.hidden = true;
    if (statusNodeRail) {
        statusNodeRail.className = `status-pill ${status.className}`;
        statusNodeRail.textContent = status.text;
    }
    if (railCard) {
        const availabilityLabel = availabilityMode === 'available'
            ? 'Manuelt ledig'
            : availabilityMode === 'unavailable'
            ? 'Manuelt ikke ledig'
            : 'Auto';
        const coordText = effectiveCoords
            ? `${effectiveCoords.lat.toFixed(4)}, ${effectiveCoords.lon.toFixed(4)}`
            : 'Ingen posisjon';
        const coordSource = effectiveCoords?.source === 'ais'
            ? 'AIS-posisjon'
            : effectiveCoords?.source === 'profile'
            ? 'Profilposisjon'
            : 'Posisjon mangler';
        const certMeta = demoOps.healthCertName
            ? `${demoOps.healthCertName}${demoOps.healthCertUpdatedAt ? ` · ${isoToLocal(demoOps.healthCertUpdatedAt)}` : ''}`
            : 'Ikke lastet opp';
        const nextVisitText = upcoming
            ? `${formatDateOnly(upcoming.start)} ${formatTimeOnly(upcoming.start)} · ${upcoming.facilityName}`
            : 'Ingen kommende besøk';
        railCard.className = 'vessel-hero-card';
        railCard.innerHTML = `
            <div class="vessel-hero-head">
                <div>
                    <div class="vessel-hero-title">${vessel.name || 'Ukjent båt'}</div>
                    <div class="vessel-hero-sub">${vesselType || 'Type ukjent'}${company ? ` · ${company}` : ''}</div>
                </div>
                <div class="vessel-hero-pill ${status.className}">${status.text}</div>
            </div>
            <div class="vessel-hero-chip-row">
                <span class="vessel-hero-chip ${aisState.className}">${aisState.label}</span>
                <span class="vessel-hero-chip neutral">${availabilityLabel}</span>
                <span class="vessel-hero-chip neutral">${mmsi ? mmsi : 'Ingen MMSI'}</span>
            </div>
            <div class="vessel-hero-grid">
                <div class="vessel-hero-stat"><span class="label">Neste besøk</span><strong>${nextVisitText}</strong></div>
                <div class="vessel-hero-stat"><span class="label">Ventende</span><strong>${pendingRequests}</strong></div>
                <div class="vessel-hero-stat"><span class="label">Bekreftede ruter</span><strong>${confirmedRoutes.length}</strong></div>
                <div class="vessel-hero-stat"><span class="label">Valgte anlegg</span><strong>${selectedFacilitiesCount}</strong></div>
                <div class="vessel-hero-stat"><span class="label">Mannskap</span><strong>${demoOps.crewCount || 'Ikke satt'}</strong></div>
                <div class="vessel-hero-stat"><span class="label">Kontakt</span><strong>${demoOps.contactName || 'Ikke satt'}</strong><span class="meta">${demoOps.contactPhone || 'Telefon mangler'}</span></div>
                <div class="vessel-hero-stat wide split">
                    <div>
                        <span class="label">Posisjon</span>
                        <strong>${coordText}</strong>
                        <span class="meta">${coordSource}</span>
                    </div>
                    <div>
                        <span class="label">Planstart</span>
                        <strong>${plannerState?.routePlanDate ? plannerState.routePlanDate : 'Ikke satt'}</strong>
                        <span class="meta">Avreise ${plannerState?.routeDepartureTime || '07:30'}</span>
                    </div>
                </div>
                <div class="vessel-hero-stat wide"><span class="label">Helseattest</span><strong>${certMeta}</strong><span class="meta">Demo-opplasting lagres kun lokalt i nettleseren.</span></div>
            </div>
        `;
    }
    nextVisitNode.textContent = upcoming ? `${formatDateOnly(upcoming.start)} ${formatTimeOnly(upcoming.start)} · ${upcoming.facilityName}` : 'Ingen kommende';
    routeCountNode.textContent = String(confirmedRoutes.length);

    const clearanceRow = clearance?.signedBy
        ? `Signert av ${clearance.signedBy}${clearance.signedAt ? ` · ${isoToLocal(clearance.signedAt)}` : ''}${clearance.routePlanTitle ? ` · ${clearance.routePlanTitle}` : ''}`
        : 'Ingen aktiv signatur';
    const clearanceState = clearance ? 'Klarering lagret' : 'Ikke klarert ennå';

    healthBox.innerHTML = `
        <div class="vessel-health-row">
            <span class="risk-mini-title">${status.text}</span>
        </div>
        <div class="risk-mini-sub">${status.detail}</div>
        <div class="risk-mini-meta">Mannskap: ${demoOps.crewCount || 'Ikke satt'} · Kontakt: ${demoOps.contactName || 'Ikke satt'}${demoOps.contactPhone ? ` (${demoOps.contactPhone})` : ''}</div>
        <div class="risk-mini-meta">Helseattest: ${demoOps.healthCertName || 'Ikke lastet opp'}</div>
        <details class="vessel-info-details">
            <summary class="vessel-detail-summary">Vis detaljer</summary>
            <div class="vessel-detail-content">
                ${company ? `<div class="risk-mini-meta">Selskap: ${company}</div>` : ''}
                ${vesselType ? `<div class="risk-mini-meta">Type: ${vesselType}</div>` : ''}
                ${mmsi ? `<div class="risk-mini-meta">MMSI: ${mmsi}</div>` : ''}
                <div id="selectedVesselAisMeta" class="risk-mini-meta">AIS: Henter sist kjente posisjon...</div>
                <div class="risk-mini-meta">Klarering: ${clearanceState}</div>
                <div class="risk-mini-meta">${clearanceRow}</div>
            </div>
        </details>
    `;

    const crewInput = document.getElementById('demoCrewCount');
    const contactNameInput = document.getElementById('demoContactName');
    const contactPhoneInput = document.getElementById('demoContactPhone');
    const certMetaNode = document.getElementById('demoHealthCertMeta');
    if (crewInput) crewInput.value = demoOps.crewCount || '';
    if (contactNameInput) contactNameInput.value = demoOps.contactName || '';
    if (contactPhoneInput) contactPhoneInput.value = demoOps.contactPhone || '';
    if (certMetaNode) certMetaNode.textContent = demoOps.healthCertName
        ? `Helseattest: ${demoOps.healthCertName}${demoOps.healthCertUpdatedAt ? ` · ${isoToLocal(demoOps.healthCertUpdatedAt)}` : ''}`
        : 'Ingen helseattest lastet opp.';

    void refreshSelectedVesselAisSummary(vessel);
}

function renderMap() {
    const selectedIds = getSelectedFacilityIds();
    const facilities = getFacilityListForPlanner();
    const demandCountByFacility = getActiveDemandCountByFacility();
    const demandFacilityIds = new Set([...demandCountByFacility.keys()]);
    const state = getPlannerState(selectedVesselId);
    const routeDate = getRouteBaseDateForState(state);
    const availableFacilityIds = new Set(
        facilities
            .filter((facility) => getFacilityDayMark(facility?.id, routeDate) === 'green')
            .map((facility) => String(facility?.id || '').trim())
            .filter(Boolean)
    );
    const infectedIds = new Set();
    const severeIds = new Set();
    for (const facility of facilities) {
        const risk = inferFacilityRisk(facility);
        if (risk.score >= 3) infectedIds.add(facility.id);
        else if (risk.score >= 1) severeIds.add(facility.id);
    }

    const masovalFacilityIds = new Set();
    for (const facility of facilities) {
        const facilityNameNorm = normalizeName(facility?.name);
        const isMasoval = facility?.companyId === 'masoval' || MASOVAL_FACILITY_NAMES.has(facilityNameNorm);
        if (!isMasoval) continue;

        masovalFacilityIds.add(facility.id);

        const fallbackStatus = MASOVAL_STATUS_FALLBACK.get(facilityNameNorm) || '';
        if (fallbackStatus === 'smittet' && !infectedIds.has(facility.id)) {
            infectedIds.add(facility.id);
            severeIds.delete(facility.id);
        } else if (fallbackStatus === 'høy' && !infectedIds.has(facility.id) && !severeIds.has(facility.id)) {
            severeIds.add(facility.id);
        }
    }
    
    // Get live/last-known AIS positions for Frøy profile vessels from the cache
    const profileVessels = profile?.vessels || [];
    const selectedVessel = getSelectedVessel();
    const selectedVesselMmsi = String(selectedVessel?.mmsi || '').trim();
    const shouldRefocusSelectedVessel = String(selectedVessel?.id || '') !== String(lastMapFocusedVesselId || '');
    const froyVessels = profileVessels
        .map((v) => {
            const mmsi = String(v?.mmsi || '').trim();
            if (!mmsi) return null;
            const aisVessel = aisVesselCache.byMmsi.get(mmsi);
            if (!aisVessel) return null;
            return {
                ...aisVessel,
                name: repairMojibakeText(aisVessel?.name || v?.name || mmsi)
            };
        })
        .filter(Boolean);
    
    renderFacilityMiniMap(document.getElementById('facilityMap'), facilities, {
        selectedFacilityId: [...selectedIds][0] || null,
        infectedIds,
        severeIds,
        demandFacilityIds,
        demandCountByFacility,
        availableFacilityIds,
        demoFacilityIds,
        masovalFacilityIds,
        showSelectionRadius: false,
        preserveViewport: !shouldRefocusSelectedVessel,
        froyVessels,
        selectedVesselMmsi,
        centerOnSelectedVessel: shouldRefocusSelectedVessel && Boolean(selectedVesselMmsi),
        onFacilityClick: (facilityId) => {
            toggleFacilitySelection(facilityId);
        },
        onFroyVesselClick: async (froyVessel) => {
            const mmsi = String(froyVessel?.mmsi || '').trim();
            if (!mmsi) return;
            const match = getFilteredVessels().find((item) => String(item?.mmsi || '').trim() === mmsi)
                || (profile.vessels || []).find((item) => String(item?.mmsi || '').trim() === mmsi);
            if (!match?.id || String(match.id) === String(selectedVesselId)) return;
            selectedVesselId = match.id;
            syncSelectorsToSelectedVessel();
            await loadProposalsForSelected();
            renderAll();
            showStatus(`Valgte båt fra kart: ${match.name || match.mmsi}.`, 'success');
        }
    });
    lastMapFocusedVesselId = selectedVessel?.id || null;

    const chips = document.getElementById('selectedFacilitiesChips');
    const selectedFacilities = [...selectedIds].map((id) => facilityMap.get(id)).filter(Boolean);
    chips.innerHTML = selectedFacilities.length === 0
        ? '<span class="chip chip-muted">Ingen anlegg valgt</span>'
        : selectedFacilities.map((facility) => `<button type="button" class="chip chip-selected" data-remove-facility="${facility.id}"><span>${facility.name}</span>${renderProductionBadge(facility)}<span>✕</span></button>`).join('');
    chips.querySelectorAll('[data-remove-facility]').forEach((button) => {
        button.addEventListener('click', () => toggleFacilitySelection(button.dataset.removeFacility));
    });
}

function renderPlannerFacilityList() {
    const list = document.getElementById('plannerFacilityList');
    const selectedIds = getSelectedFacilityIds();
    const demandCountByFacility = getActiveDemandCountByFacility();
    const allFacilities = getFacilityListForPlanner();
    const search = slugText(document.getElementById('facilitySearchInput')?.value || '');
    const baseFacilities = search
        ? allFacilities.filter((facility) => {
            const searchHaystack = [
                facility?.name,
                facility?.municipality,
                facility?.localityNo,
                facility?.companyName,
                facility?.fdir?.holders,
                facility?.owner
            ].map(slugText).join(' ');
            return searchHaystack.includes(search);
        })
        : allFacilities;

    const facilities = [...baseFacilities]
        .sort((a, b) => {
            const aSelected = selectedIds.has(a.id) ? 1 : 0;
            const bSelected = selectedIds.has(b.id) ? 1 : 0;
            if (aSelected !== bSelected) return bSelected - aSelected;
            return String(a?.name || '').localeCompare(String(b?.name || ''), 'nb-NO');
        })
        .slice(0, search ? 24 : 80);

    if (facilities.length === 0) {
        list.innerHTML = '<div class="empty">Ingen anlegg matcher filteret.</div>';
        return;
    }

    const topInfo = search
        ? (baseFacilities.length > facilities.length
            ? `<div class="planner-list-note">Viser ${facilities.length} av ${baseFacilities.length} treff.</div>`
            : `<div class="planner-list-note">Treff: ${baseFacilities.length}</div>`)
        : (allFacilities.length > facilities.length
            ? `<div class="planner-list-note">Viser ${facilities.length} av ${allFacilities.length} anlegg. Bruk søk for å snevre inn.</div>`
            : '');

    list.innerHTML = `${topInfo}${facilities.map((facility) => {
        const risk = inferFacilityRisk(facility);
        const riskClass = getRiskVisualClass(risk.score);
        const checked = selectedIds.has(facility.id) ? 'checked' : '';
        const demandCount = Number(demandCountByFacility.get(String(facility.id)) || 0);
        return `
            <label class="planner-facility-item ${riskClass}">
                <input type="checkbox" data-facility-checkbox="${facility.id}" ${checked} />
                <span class="planner-facility-main facility-card-main">
                    <strong>${facility.name}</strong>
                    <span class="planner-facility-meta">${facility.municipality || ''}</span>
                    <span class="facility-badge-row">${renderFacilitySignalBadges(facility)}${demandCount > 0 ? `<span class="fpl-badge warn">Etterspørsel ${demandCount}</span>` : ''}</span>
                </span>
                <span class="status-pill ${risk.className}">${risk.label}</span>
            </label>
        `;
    }).join('')}`;
    list.querySelectorAll('[data-facility-checkbox]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => toggleFacilitySelection(checkbox.dataset.facilityCheckbox));
    });
}

function renderSelectedFacilityList() {
    const container = document.getElementById('selectedFacilityList');
    const demandCountByFacility = getActiveDemandCountByFacility();
    const selectedFacilities = [...getSelectedFacilityIds()].map((id) => facilityMap.get(id)).filter(Boolean);
    if (selectedFacilities.length === 0) {
        container.innerHTML = '<div class="empty">Ingen valgte anlegg ennå.</div>';
        return;
    }
    container.innerHTML = selectedFacilities.map((facility) => {
        const operation = getPlannerOperationMinutes(facility.id);
        const operationHours = Math.floor(operation / 60);
        const operationMinutes = operation % 60;
        const comment = getPlannerFacilityComment(facility.id);
        const risk = inferFacilityRisk(facility);
        const riskClass = getRiskVisualClass(risk.score);
        const demandCount = Number(demandCountByFacility.get(String(facility.id)) || 0);
        return `
            <div class="selected-facility-card ${riskClass}">
                <div class="facility-card-main">
                    <strong>${facility.name}</strong>
                    <div class="selected-facility-meta">${facility.municipality || ''}</div>
                    <div class="facility-badge-row">${renderFacilitySignalBadges(facility)}${demandCount > 0 ? `<span class="fpl-badge warn">Etterspørsel ${demandCount}</span>` : ''}</div>
                </div>
                <div class="selected-facility-actions">
                    <span class="mini-field-label">Operasjonstid</span>
                    <input type="number" min="0" step="1" value="${operationHours}" data-op-facility="${facility.id}" data-op-part="hours" class="mini-number-input" title="Operasjon timer" />
                    <span class="mini-field-suffix">t</span>
                    <input type="number" min="0" max="59" step="5" value="${operationMinutes}" data-op-facility="${facility.id}" data-op-part="minutes" class="mini-number-input" title="Operasjon minutter" />
                    <span class="mini-field-suffix">m</span>
                    <input type="text" value="${comment}" data-comment-input="${facility.id}" class="mini-text-input" placeholder="Kommentar" />
                    <button type="button" class="mini-btn danger" data-remove-selected="${facility.id}">✕</button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('[data-remove-selected]').forEach((button) => {
        button.addEventListener('click', () => toggleFacilitySelection(button.dataset.removeSelected));
    });
    container.querySelectorAll('[data-op-facility]').forEach((input) => {
        input.addEventListener('change', () => {
            const facilityId = String(input.dataset.opFacility || '');
            const hoursInput = container.querySelector(`[data-op-facility="${facilityId}"][data-op-part="hours"]`);
            const minutesInput = container.querySelector(`[data-op-facility="${facilityId}"][data-op-part="minutes"]`);
            const hours = Math.max(0, parseInt(hoursInput?.value || '0', 10) || 0);
            const minutesRaw = Math.max(0, parseInt(minutesInput?.value || '0', 10) || 0);
            const minutes = Math.min(59, minutesRaw);
            if (hoursInput) hoursInput.value = String(hours);
            if (minutesInput) minutesInput.value = String(minutes);
            setPlannerOperationMinutes(facilityId, hours * 60 + minutes);
            savePlannedRoute(selectedVesselId, null);
            renderPlannerState();
        });
    });
    container.querySelectorAll('[data-comment-input]').forEach((input) => {
        input.addEventListener('change', () => {
            setPlannerFacilityComment(input.dataset.commentInput, input.value);
            savePlannedRoute(selectedVesselId, null);
            renderPlannerState();
        });
    });
}

function renderPlannerSummary() {
    const vessel = getSelectedVessel();
    const route = getPlannedRoute();
    const box = document.getElementById('plannerSummaryBox');
    if (!vessel) {
        box.innerHTML = '<div class="empty">Velg en båt for å starte planlegging.</div>';
        return;
    }
    if (!route) {
        const selectedCount = getSelectedFacilityIds().size;
        const selectedFacilities = [...getSelectedFacilityIds()].map((id) => facilityMap.get(id)).filter(Boolean);
        const infectedCount = selectedFacilities.filter((facility) => inferFacilityRisk(facility).score >= 3).length;
        const riskZoneCount = selectedFacilities.filter((facility) => {
            const score = inferFacilityRisk(facility).score;
            return score >= 1 && score < 3;
        }).length;
        const highLiceCount = selectedFacilities.filter((facility) => facility?.liceHigh === true).length;
        const hasPreRisk = infectedCount > 0 || riskZoneCount > 0 || highLiceCount > 0;
        box.innerHTML = `
            <div class="planner-summary-row"><strong>${vessel.name}</strong></div>
            <div class="planner-summary-row">Valgte anlegg: ${selectedCount}</div>
            ${hasPreRisk ? `<div class="planner-warning">⚠️ Foreløpig risikobilde: ${infectedCount} smittet · ${riskZoneCount} risikosone · ${highLiceCount} høy lus.</div>` : ''}
            <div class="planner-summary-row">Klar for beregning.</div>
        `;
        return;
    }
    const bio = getRouteBiosecuritySummary(route);
    const alerts = getPlannerAlertItems(route, vessel);
    box.innerHTML = `
        <div class="planner-summary-row"><strong>${route.vesselName}</strong></div>
        <div class="planner-summary-row">${route.totalDays} dager · ${route.totalDistance.toFixed(1)} km · ${formatDuration(route.totalMinutes)}</div>
        <div class="planner-summary-row">${route.hasQuarantine ? 'Krever desinfeksjon + 48t karantene' : 'Ingen karantene i planen'}</div>
        ${route.hasQuarantine ? `<div class="planner-warning">⚠️ Biosecurity: ${bio.infectedCount} smittet · ${bio.zoneRiskCount} risikosone · ${bio.highLiceCount} høy lus. Karantene trigges ved risiko-bevegelse.</div>` : ''}
        ${alerts.length > 0 ? `<div class="planner-warning" style="margin-top:8px;">Varsler: ${alerts.join(' · ')}</div>` : ''}
        <div class="planner-summary-row" style="margin-top:6px;color:var(--muted,#64748b);">Bekreftelser og endringer gjøres i kalender på valgt dag.</div>
    `;
}

function renderRoutePreview() {
    const panel = document.getElementById('routePreviewPanel');
    const route = getPlannedRoute();
    if (!route) {
        panel.innerHTML = '<div class="empty">Ingen beregnet rute ennå.</div>';
        return;
    }

    const bio = getRouteBiosecuritySummary(route);
    const speedKmh = Number(route.speedKmh) > 0 ? Number(route.speedKmh) : getRouteSpeedKmh(selectedVesselId);
    const highestRiskScore = Math.max(0, ...(route.batches || []).map((batch) => Number(batch?.riskScore || 0)));
    const mostSevereDay = highestRiskScore > 0
        ? ((route.batches || []).find((batch) => Number(batch?.riskScore || 0) === highestRiskScore)?.day || null)
        : null;

    const parseTime = (timeValue) => {
        const [hh, mm] = String(timeValue || '07:30').split(':').map((part) => Number(part));
        return {
            hh: Number.isFinite(hh) ? hh : 7,
            mm: Number.isFinite(mm) ? mm : 30
        };
    };

    const buildBatchPreview = (batch) => {
        const departure = batch.departureTime || route.routeDepartureTime || '07:30';
        const date = getBatchDate(batch);
        const { hh, mm } = parseTime(departure);
        let cursor = new Date(date);
        cursor.setHours(hh, mm, 0, 0);

        const stopRows = (batch.facilities || []).map((facility, index) => {
            if (index > 0) {
                const prev = batch.facilities[index - 1];
                const transferMinutes = (prev?.operationMinutes || 0) + (facility.travelMinutes || 0);
                cursor = new Date(cursor.getTime() + transferMinutes * 60 * 1000);
            }

            const arrival = new Date(cursor);
            const operationMinutes = facility.operationMinutes || DEFAULT_OPERATION_MINUTES;
            const end = new Date(arrival.getTime() + operationMinutes * 60 * 1000);
            cursor = end;

            return {
                facility,
                arrivalText: formatTimeOnly(arrival),
                doneText: formatTimeOnly(end),
                transferText: facility.distanceKm
                    ? `${facility.distanceKm.toFixed(1)} km (~${Math.max(0, Math.round(facility.travelMinutes || 0))} min)`
                    : 'Startstopp',
                opText: formatDuration(operationMinutes)
            };
        });

        const totalOperationMinutes = (batch.facilities || []).reduce((sum, facility) => sum + (facility.operationMinutes || DEFAULT_OPERATION_MINUTES), 0);
        const finishText = stopRows.length > 0 ? stopRows[stopRows.length - 1].doneText : '--:--';

        return {
            departure,
            finishText,
            finishDate: stopRows.length > 0 ? new Date(cursor) : null,
            stopRows,
            totalOperationMinutes,
            totalDistanceKm: Number(batch.totalDistance || 0),
            totalMinutes: Number(batch.totalMinutes || 0)
        };
    };

    panel.innerHTML = `
        <div class="route-preview-summary">
            <strong>${route.totalDays} dager</strong>
            <span>${route.totalDistance.toFixed(1)} km</span>
            <span>${formatDuration(route.totalMinutes)}</span>
            <span>Fart: ${speedKmh.toFixed(1)} km/t</span>
        </div>
        ${route.hasQuarantine ? `<div class="route-warning">⚠️ Ruten krysser smittet/risikosone/høy-lus.</div>` : ''}
        ${route.hasQuarantine ? `<div class="route-warning-meta">Smittet: ${bio.infectedCount} · Risikosone: ${bio.zoneRiskCount} · Høy lus: ${bio.highLiceCount}</div>` : ''}
        ${route.batches.map((batch, batchIndex) => {
            const preview = buildBatchPreview(batch);
            const isMostSevere = mostSevereDay !== null && Number(batch.day) === Number(mostSevereDay);
            const batchRiskScore = Math.max(
                batch.needsQuarantine ? 1 : 0,
                ...(batch.facilities || []).map((facility) => {
                    const baseScore = Number(facility?.risk?.score || 0);
                    const riskLabel = String(facility?.risk?.label || '').toLowerCase();
                    if (riskLabel.includes('smitt')) return 3;
                    if (facility?.liceHigh) return Math.max(baseScore, 2);
                    return baseScore;
                })
            );
            const batchRiskClass = batchRiskScore >= 3
                ? 'batch-risk-high'
                : batchRiskScore >= 2
                    ? 'batch-risk-mid'
                    : batchRiskScore >= 1
                        ? 'batch-risk-low'
                        : 'batch-risk-none';
            return `
            <div class="route-batch-card ${batch.needsQuarantine ? 'risk-mid' : 'risk-none'} ${batchRiskClass} ${isMostSevere ? 'route-day-most-severe' : ''}">
                <div class="route-batch-header route-day-header">
                    <div>
                        <strong>DAG ${batch.day}</strong>
                        <div class="route-batch-meta">${formatDateOnly(getBatchDate(batch))} · ${batch.facilities.length} anlegg · ${preview.totalDistanceKm.toFixed(1)} km</div>
                    </div>
                    <div class="route-batch-actions">
                        <input type="time" value="${batch.departureTime || route.routeDepartureTime || '07:30'}" data-batch-departure="${batchIndex}" class="mini-time-input" />
                        <button type="button" class="mini-btn" data-split-batch="${batchIndex}">Split</button>
                        <button type="button" class="mini-btn" data-merge-batch="${batchIndex}">Merge</button>
                    </div>
                </div>
                <div class="route-day-stats">
                    <span><strong>Avreise:</strong> ${preview.departure}</span>
                    <span><strong>Ferdig:</strong> ${preview.finishText}</span>
                    <span><strong>Total:</strong> ${formatDuration(preview.totalMinutes)} (kjøring + operasjon)</span>
                </div>
                <div class="route-batch-list">
                    ${preview.stopRows.map((row, facilityIndex) => {
                        const facility = row.facility;
                        return `
                        <div class="route-facility-card route-stop-card ${getRiskVisualClass(facility.risk?.score || 0)}">
                            <div class="facility-card-main">
                                <strong>${facility.name}</strong>
                                <div class="route-facility-meta">${facility.risk?.label || 'Normal'}${facility.liceHigh ? ' · Høy lus' : ''} · Operasjon ${row.opText} · ETA ${row.arrivalText}</div>
                                <div class="route-facility-meta">${row.transferText} · Ferdig ca ${row.doneText}</div>
                                <div class="facility-badge-row">${renderProductionBadge(facility)}</div>
                                ${facility.comment ? `<div class="route-facility-meta">Kommentar: ${facility.comment}</div>` : ''}
                            </div>
                            <div class="route-facility-actions">
                                <div class="route-op-edit">
                                    <span class="mini-field-label">Op</span>
                                    <input type="number" min="0" step="1" value="${Math.floor((facility.operationMinutes || DEFAULT_OPERATION_MINUTES) / 60)}" data-route-op-key="${batchIndex}|${facilityIndex}" data-route-op-part="hours" class="mini-number-input" title="Operasjon timer" />
                                    <span class="mini-field-suffix">t</span>
                                    <input type="number" min="0" max="59" step="5" value="${(facility.operationMinutes || DEFAULT_OPERATION_MINUTES) % 60}" data-route-op-key="${batchIndex}|${facilityIndex}" data-route-op-part="minutes" class="mini-number-input" title="Operasjon minutter" />
                                    <span class="mini-field-suffix">m</span>
                                </div>
                                <button type="button" class="mini-btn" data-move-prev="${batchIndex}|${facilityIndex}">←</button>
                                <button type="button" class="mini-btn" data-move-next="${batchIndex}|${facilityIndex}">→</button>
                                <button type="button" class="mini-btn ok" data-share-batch="${batchIndex}|${facilityIndex}">Del</button>
                                <button type="button" class="mini-btn danger" data-remove-batch="${batchIndex}|${facilityIndex}">✕</button>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
                ${batch.needsQuarantine ? '<div class="route-day-end-note">⚠️ Etter denne dagen må du trolig planlegge desinfeksjon og karantenetid før neste sensitive oppdrag.</div>' : ''}
            </div>
        `;
        }).join('')}
        <div class="route-action-row" style="margin-top:10px;">
            <button id="addRouteToCalendarBtn" type="button">Legg i kalender</button>
            <button id="confirmRouteBtn" type="button" class="secondary" title="Bekreft rute">Bekreft rute</button>
        </div>
    `;

    panel.querySelectorAll('[data-split-batch]').forEach((button) => button.addEventListener('click', () => splitBatch(Number(button.dataset.splitBatch))));
    panel.querySelectorAll('[data-merge-batch]').forEach((button) => button.addEventListener('click', () => mergeBatch(Number(button.dataset.mergeBatch))));
    panel.querySelectorAll('[data-move-prev]').forEach((button) => button.addEventListener('click', () => {
        const [batchIndex, facilityIndex] = button.dataset.movePrev.split('|').map(Number);
        moveFacility(batchIndex, facilityIndex, 'prev');
    }));
    panel.querySelectorAll('[data-move-next]').forEach((button) => button.addEventListener('click', () => {
        const [batchIndex, facilityIndex] = button.dataset.moveNext.split('|').map(Number);
        moveFacility(batchIndex, facilityIndex, 'next');
    }));
    panel.querySelectorAll('[data-remove-batch]').forEach((button) => button.addEventListener('click', () => {
        const [batchIndex, facilityIndex] = button.dataset.removeBatch.split('|').map(Number);
        removeFacilityFromBatch(batchIndex, facilityIndex);
    }));
    panel.querySelectorAll('[data-batch-departure]').forEach((input) => input.addEventListener('change', () => updateBatchDeparture(Number(input.dataset.batchDeparture), input.value)));
    panel.querySelectorAll('[data-share-batch]').forEach((button) => button.addEventListener('click', () => {
        const [batchIndex, facilityIndex] = button.dataset.shareBatch.split('|').map(Number);
        openShareModalFromBatch(batchIndex, facilityIndex);
    }));
    panel.querySelectorAll('[data-route-op-key]').forEach((input) => {
        input.addEventListener('change', () => {
            const key = String(input.dataset.routeOpKey || '');
            const [batchIndex, facilityIndex] = key.split('|').map(Number);
            if (!Number.isFinite(batchIndex) || !Number.isFinite(facilityIndex)) return;
            const hoursInput = panel.querySelector(`[data-route-op-key="${key}"][data-route-op-part="hours"]`);
            const minutesInput = panel.querySelector(`[data-route-op-key="${key}"][data-route-op-part="minutes"]`);
            const hours = Math.max(0, parseInt(hoursInput?.value || '0', 10) || 0);
            const minutesRaw = Math.max(0, parseInt(minutesInput?.value || '0', 10) || 0);
            const minutes = Math.min(59, minutesRaw);
            if (hoursInput) hoursInput.value = String(hours);
            if (minutesInput) minutesInput.value = String(minutes);
            updateRouteFacilityOperationTime(batchIndex, facilityIndex, (hours * 60) + minutes);
        });
    });
    document.getElementById('addRouteToCalendarBtn')?.addEventListener('click', addPlannedRouteToCalendar);
    document.getElementById('confirmRouteBtn')?.addEventListener('click', confirmPlannedRoute);
}

function renderPlannerState() {
    const state = getPlannerState(selectedVesselId);
    const route = getPlannedRoute();
    const hasRoute = Boolean(route);
    const showSelector = !hasRoute || state.showFacilitySelector === true;

    if (document.getElementById('routeModeSelect')) document.getElementById('routeModeSelect').value = state.routeMode || 'safe';
    if (document.getElementById('routePlanDate')) document.getElementById('routePlanDate').value = state.routePlanDate || '';
    if (document.getElementById('routeDepartureTime')) document.getElementById('routeDepartureTime').value = state.routeDepartureTime || '07:30';
    if (document.getElementById('routeSpeedKmh')) document.getElementById('routeSpeedKmh').value = String(getRouteSpeedKmh(selectedVesselId));

    const plannerSelectedBox = document.getElementById('plannerSelectedBox');
    if (plannerSelectedBox) plannerSelectedBox.style.display = showSelector ? '' : 'none';

    const plannerFacilityList = document.getElementById('plannerFacilityList');
    if (plannerFacilityList) plannerFacilityList.style.display = showSelector ? '' : 'none';

    const togglePlannerFacilitiesBtn = document.getElementById('togglePlannerFacilitiesBtn');
    if (togglePlannerFacilitiesBtn) {
        togglePlannerFacilitiesBtn.style.display = hasRoute ? '' : 'none';
        togglePlannerFacilitiesBtn.textContent = showSelector ? 'Skjul anlegg' : 'Vis anlegg';
    }

    const chips = document.getElementById('selectedFacilitiesChips');
    if (chips) chips.style.display = showSelector ? '' : 'none';

    renderPlannerSummary();
    renderSelectedFacilityList();
    renderPlannerFacilityList();
    renderRoutePreview();
    renderSelectedDayRoutePlan();
}

function setDayMark(mark) {
    if (!selectedVesselId || !selectedCalendarDayKey) return;
    updateVesselCalendarState(selectedVesselId, (state) => {
        const dayMarks = { ...(state.dayMarks || {}) };
        if (mark === 'clear') delete dayMarks[selectedCalendarDayKey];
        else dayMarks[selectedCalendarDayKey] = mark;
        return { ...state, dayMarks };
    });
    renderCalendar();
}

function renderCalendar() {
    const vessel = getSelectedVessel();
    const grid = document.getElementById('vesselCalendarGrid');
    const label = document.getElementById('calendarMonthLabel');
    const dayMeta = document.getElementById('calendarSelectedDayMeta');
    const dayMarks = getVesselCalendarState(selectedVesselId)?.dayMarks || {};
    const events = getSelectedVesselEvents();

    if (!vessel) {
        grid.innerHTML = '<div class="empty">Velg en båt for å se kalender.</div>';
        document.getElementById('calendarMeta').textContent = 'Ingen båt valgt.';
        if (dayMeta) dayMeta.textContent = 'Valgt dag: -';
        return;
    }

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    label.textContent = calendarViewDate.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
    const jumpInput = document.getElementById('calendarJumpMonth');
    if (jumpInput) jumpInput.value = toMonthInputValue(calendarViewDate);
    document.getElementById('calendarMeta').textContent = `${vessel.name} · ${events.length} kalenderhendelser totalt`;

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const todayKey = toDateKey(new Date());
    const quarantineDayKeys = new Set();
    for (const event of events) {
        if (String(event?.type || '').toLowerCase() !== 'quarantine') continue;
        const start = new Date(event.start || event.date);
        if (Number.isNaN(start.getTime())) continue;
        const fallbackEnd = new Date(start.getTime() + QUARANTINE_HOURS * 60 * 60 * 1000);
        const end = event.end ? new Date(event.end) : fallbackEnd;
        const safeEnd = Number.isNaN(end.getTime()) ? fallbackEnd : end;
        const cursor = startOfDay(start);
        const last = startOfDay(safeEnd);
        while (cursor.getTime() <= last.getTime()) {
            quarantineDayKeys.add(toDateKey(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    const headers = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
        .map((text) => `<div class="mini-calendar-weekday">${text}</div>`)
        .join('');
    let cells = headers;
    for (let i = 0; i < offset; i++) {
        cells += '<div class="mini-calendar-day is-empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = toDateKey(date);
        const dayEvents = events.filter((event) => event.dateKey === dateKey);
        const hasSelection = selectedCalendarDayKey === dateKey;
        const mark = dayMarks[dateKey] || '';
        const isQuarantineDay = quarantineDayKeys.has(dateKey);
        const dayRiskScore = getDayRiskScore(dayEvents, isQuarantineDay);
        const riskClass = dayRiskScore >= 3 ? 'day-risk-high' : dayRiskScore >= 2 ? 'day-risk-mid' : dayRiskScore >= 1 ? 'day-risk-low' : '';
        const riskDot = dayRiskScore >= 3
            ? '🔴'
            : dayRiskScore >= 2
            ? '🟠'
            : dayRiskScore >= 1
            ? '🟡'
            : (dayEvents.some((event) => String(event.status || '').includes('approved'))
                ? '🟢'
                : dayEvents.some((event) => String(event.status || '').includes('rejected'))
                ? '🔴'
                : '⚪');
        const summary = dayEvents.length > 0
            ? `${dayEvents.length} · ${riskDot}`
            : isQuarantineDay
            ? '⛔ Karantene'
            : '';
        cells += `
            <button type="button" class="mini-calendar-day ${hasSelection ? 'cal-selected' : ''} ${todayKey === dateKey ? 'today' : ''} ${mark ? `mark-${mark}` : ''} ${isQuarantineDay ? 'mark-quarantine' : ''} ${riskClass}" data-calendar-day="${dateKey}">
                <span class="day-no">${day}</span>
                <span class="day-summary">${summary}</span>
            </button>
        `;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll('[data-calendar-day]').forEach((button) => {
        button.addEventListener('click', () => {
            const pickedDate = button.dataset.calendarDay;
            selectedCalendarDayKey = pickedDate;
            if (selectedVesselId && pickedDate) {
                setPlannerState(selectedVesselId, { routePlanDate: pickedDate });
                syncSelectedFacilitiesToPlannedDay(pickedDate);
            }
            renderCalendar();
            renderPlannerState();
            renderMap();
        });
    });

    if (!selectedCalendarDayKey) {
        const upcoming = events.find((event) => new Date(event.start).getTime() >= Date.now());
        selectedCalendarDayKey = upcoming?.dateKey || todayKey || toDateKey(firstDay);
    }
    if (dayMeta) dayMeta.textContent = selectedCalendarDayKey ? `Valgt dag: ${selectedCalendarDayKey}` : 'Valgt dag: -';
    syncSelectedFacilitiesToPlannedDay(selectedCalendarDayKey);
    renderSelectedDayEvents();
}

function renderSelectedDayEvents() {
    const list = document.getElementById('calendarDayEvents');
    const label = document.getElementById('selectedDayLabel');
    const summary = document.getElementById('selectedDaySummary');
    const dayMeta = document.getElementById('calendarSelectedDayMeta');
    const events = getSelectedVesselEvents().filter((event) => event.dateKey === selectedCalendarDayKey);
    label.textContent = selectedCalendarDayKey ? `Valgt dag: ${selectedCalendarDayKey}` : 'Velg en dag';
    summary.textContent = events.length > 0 ? `${events.length} hendelser denne dagen.` : 'Ingen hendelser denne dagen.';
    if (dayMeta) dayMeta.textContent = selectedCalendarDayKey
        ? `Valgt dag: ${selectedCalendarDayKey}${events.length > 0 ? ` · ${events.length} hendelser` : ''}`
        : 'Valgt dag: -';

    if (events.length === 0) {
        list.innerHTML = '<div class="empty">Ingen hendelser på valgt dag.</div>';
        return;
    }

    const getEventVisualClass = (event) => {
        const type = slugText(event?.type || '');
        if (type === 'quarantine') return 'event-quarantine';
        if (type === 'disinfection') return 'event-disinfection';
        if (type !== 'visit' && type !== 'operation') return 'event-neutral';
        const riskLabel = slugText(event?.riskLabel || '');
        if (riskLabel.includes('smitt')) return 'event-risk-high';
        if (riskLabel.includes('høy') || riskLabel.includes('ekstrem') || riskLabel.includes('lus')) return 'event-risk-mid';
        if (riskLabel.includes('risiko') || riskLabel.includes('moderat') || riskLabel.includes('overv')) return 'event-risk-low';
        return 'event-neutral';
    };

    list.innerHTML = events.map((event) => `
        <div class="event-card ${getEventVisualClass(event)}">
            <div class="event-card-header">
                <div>
                    <strong>${event.title}</strong>
                    <div class="event-card-meta">${formatTimeOnly(event.start)} – ${formatTimeOnly(event.end)} · ${event.facilityName || '-'}</div>
                    ${event.riskLabel ? `<div class="event-card-meta">Risiko: ${event.riskLabel}${event.liceHigh ? ' · Høy lus' : ''}</div>` : ''}
                </div>
                <span class="status-pill ${event.status === 'approved' ? 'ok' : event.status === 'rejected' ? 'danger' : event.status === 'alternative_suggested' || event.status === 'pending' ? 'warn' : 'neutral'}">${event.status === 'approved' ? 'Godkjent' : event.status === 'rejected' ? 'Avvist' : event.status === 'alternative_suggested' ? 'Alternativ' : event.status === 'pending' ? 'Venter svar' : event.completed ? 'Bekreftet' : 'Planlagt'}</span>
            </div>
            <div class="event-card-meta">${event.comment || event.facilityComment || ''}</div>
            <div class="event-action-row">
                ${event.completed ? `<button type="button" class="mini-btn" data-uncomplete-event="${event.id}">Angre</button>` : `<button type="button" class="mini-btn ok" data-complete-event="${event.id}">Bekreft</button>`}
                ${event.type === 'visit' && !event.completed && event.splitGroupId ? `<button type="button" class="mini-btn" data-undo-split-event="${event.id}" title="Slå sammen delte besøk">Angre deling</button>` : event.type === 'visit' && !event.completed ? `<button type="button" class="mini-btn" data-share-event="${event.id}" title="Del besøk i to halvdeler">Del</button>` : ''}
                <button type="button" class="mini-btn" data-edit-event="${event.id}">Rediger</button>
                <button type="button" class="mini-btn danger" data-delete-event="${event.id}">Slett</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('[data-complete-event]').forEach((button) => button.addEventListener('click', () => {
        const event = getSelectedVesselEvents().find((item) => String(item.id) === String(button.dataset.completeEvent));
        const isDisinfection = String(event?.type || '').toLowerCase() === 'disinfection';
        const hasChemical = String(event?.chemical || '').trim().length > 0;
        const hasResponsible = String(event?.responsibleParty || event?.responsible_party || '').trim().length > 0;
        if (isDisinfection && (!hasChemical || !hasResponsible)) {
            showStatus('Fyll ut desinfeksjonsmiddel og ansvarlig i Rediger før bekreftelse.', 'warning');
            openEventEditModal(button.dataset.completeEvent);
            return;
        }
        updateCalendarEvent(selectedVesselId, button.dataset.completeEvent, { completed: true, status: 'approved' });
        renderAll();
    }));
    list.querySelectorAll('[data-uncomplete-event]').forEach((button) => button.addEventListener('click', () => {
        updateCalendarEvent(selectedVesselId, button.dataset.uncompleteEvent, { completed: false, status: 'planned' });
        renderAll();
    }));
    list.querySelectorAll('[data-delete-event]').forEach((button) => button.addEventListener('click', () => {
        deleteCalendarEvent(selectedVesselId, button.dataset.deleteEvent);
        renderAll();
    }));
    list.querySelectorAll('[data-edit-event]').forEach((button) => button.addEventListener('click', () => {
        openEventEditModal(button.dataset.editEvent);
    }));
    list.querySelectorAll('[data-share-event]').forEach((button) => button.addEventListener('click', () => {
        splitCalendarEvent(button.dataset.shareEvent);
    }));
    list.querySelectorAll('[data-undo-split-event]').forEach((button) => button.addEventListener('click', () => {
        undoSplitCalendarEvent(button.dataset.undoSplitEvent);
    }));

    renderSelectedDayRoutePlan();
}

function syncSelectedFacilitiesToPlannedDay(dayKey = selectedCalendarDayKey) {
    const route = getPlannedRoute();
    if (!route || !dayKey || !selectedVesselId) return;
    const batch = (route.batches || []).find((item) => toDateKey(getBatchDate(item)) === dayKey);
    if (!batch) return;
    const ids = new Set((batch.facilities || []).map((facility) => String(facility?.id || '')).filter(Boolean));
    if (ids.size === 0) return;
    setSelectedFacilityIds(ids);
}

function renderSelectedDayRoutePlan() {
    const container = document.getElementById('calendarDayRoutePlan');
    if (!container) return;

    const route = getPlannedRoute();
    if (!route || !selectedCalendarDayKey) {
        container.innerHTML = '<div class="empty">Ingen planlagt rute valgt.</div>';
        return;
    }

    const batch = (route.batches || []).find((item) => toDateKey(getBatchDate(item)) === selectedCalendarDayKey);
    if (!batch) {
        container.innerHTML = '<div class="empty">Ingen planlagt rute denne dagen.</div>';
        return;
    }

    const highestRiskScore = Math.max(0, ...(route.batches || []).map((item) => Number(item?.riskScore || 0)));
    const isMostSevere = highestRiskScore > 0 && Number(batch.riskScore || 0) === highestRiskScore;
    const riskClass = getRiskVisualClass(Number(batch.riskScore || 0));

    container.innerHTML = `
        <div class="calendar-day-plan-card ${riskClass} ${isMostSevere ? 'route-day-most-severe' : ''}">
            <div class="calendar-day-plan-title">Plan for dag ${batch.day}</div>
            <div class="calendar-day-plan-meta">${batch.facilities.length} anlegg · ${batch.totalDistance.toFixed(1)} km · ${formatDuration(batch.totalMinutes)}</div>
            <div class="calendar-day-plan-list">
                ${batch.facilities.map((facility) => `<div class="calendar-day-plan-item ${getRiskVisualClass(Number(facility?.risk?.score || 0))}"><strong>${facility.name}</strong><span>${facility.risk?.label || 'Normal'}${facility.distanceKm ? ` · ${facility.distanceKm.toFixed(1)} km` : ''}</span></div>`).join('')}
            </div>
        </div>
    `;
}

function addManualEvent() {
    const vessel = getSelectedVessel();
    if (!vessel || !selectedCalendarDayKey) return;
    if (!ensureCanManageVessel(vessel, 'Legg til manuell hendelse')) return;
    const type = document.getElementById('manualEventType').value;
    const facilityId = document.getElementById('manualEventFacility').value || null;
    const facility = facilityId ? facilityMap.get(facilityId) : null;
    const time = document.getElementById('manualEventTime').value || '09:00';
    const titleText = document.getElementById('manualEventTitle').value.trim();
    const start = new Date(`${selectedCalendarDayKey}T${time}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    if (facility && ['visit', 'operation'].includes(String(type || '').toLowerCase()) && isFacilityBlockedOnDate(facility, start)) {
        showStatus(`Kan ikke legge besøk på rød dag for ${facility.name}. Velg annen dato eller be anlegg endre dagstatus.`, 'warning');
        return;
    }

    addCalendarEvents(vessel.id, [{
        id: makeEventId(type),
        vesselId: vessel.id,
        facilityId,
        facilityName: facility?.name || '',
        title: titleText || (type === 'visit' ? 'Manuelt besøk' : type === 'operation' ? 'Operasjon' : type === 'disinfection' ? 'Desinfeksjon' : 'Karantene'),
        start: start.toISOString(),
        end: end.toISOString(),
        type,
        planned: true,
        completed: false,
        status: 'planned'
    }]);
    document.getElementById('manualEventTitle').value = '';
    renderAll();
}

function getDisinfectionChemicalHistory() {
    try {
        const raw = localStorage.getItem('pilotLiteDisinfectionChemicals');
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
            ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
    } catch (_) {
        return [];
    }
}

function saveDisinfectionChemicalHistory(chemical) {
    const value = String(chemical || '').trim();
    if (!value) return;
    const existing = getDisinfectionChemicalHistory();
    if (existing.includes(value)) return;
    localStorage.setItem('pilotLiteDisinfectionChemicals', JSON.stringify([value, ...existing].slice(0, 12)));
}

function populateDisinfectionChemicalOptions(select, currentValue = '') {
    if (!select) return;
    const options = [];
    [...getDisinfectionChemicalHistory(), ...DISINFECTION_CHEMICALS_DEFAULT].forEach((item) => {
        const value = String(item || '').trim();
        if (value && !options.includes(value)) options.push(value);
    });
    select.innerHTML = '<option value="">Velg desinfeksjonsmiddel</option>'
        + options.map((item) => `<option value="${item}">${item}</option>`).join('');
    const fallback = 'Virkon S (1%)';
    const normalized = String(currentValue || '').trim();
    if (normalized && options.includes(normalized)) select.value = normalized;
    else if (options.includes(fallback)) select.value = fallback;
    else select.value = options[0] || '';
}

function openEventEditModal(eventId) {
    const event = getSelectedVesselEvents().find((item) => String(item.id) === String(eventId));
    if (!event) return;

    eventEditDraft = { ...event };
    document.getElementById('editEventFacility').value = repairMojibakeText(event.facilityName || '-');
    document.getElementById('editEventDate').value = toDateKey(event.start);
    document.getElementById('editEventComment').value = repairMojibakeText(event.comment || event.facilityComment || '');
    document.getElementById('editEventOperation').value = repairMojibakeText(event.operationName || '');
    document.getElementById('editEventDuration').value = String(Math.max(5, Number(event.duration || 60) || 60));

    const isDisinfection = String(event.type || '').toLowerCase() === 'disinfection';
    const chemicalGroup = document.getElementById('disinfectionChemicalGroup');
    const responsibleGroup = document.getElementById('responsiblePartyGroup');
    const attachmentGroup = document.getElementById('eventAttachmentGroup');
    const chemicalSelect = document.getElementById('editEventChemicalSelect');
    const responsibleInput = document.getElementById('editEventResponsibleParty');

    if (isDisinfection) {
        chemicalGroup.style.display = '';
        responsibleGroup.style.display = '';
        attachmentGroup.style.display = '';
        populateDisinfectionChemicalOptions(chemicalSelect, String(event.chemical || '').trim());
        responsibleInput.value = String(event.responsibleParty || event.responsible_party || '').trim();
    } else {
        chemicalGroup.style.display = 'none';
        responsibleGroup.style.display = 'none';
        attachmentGroup.style.display = 'none';
        if (chemicalSelect) chemicalSelect.value = '';
        if (responsibleInput) responsibleInput.value = '';
    }

    document.getElementById('eventEditModal')?.classList.remove('hidden');
}

function closeEventEditModal() {
    eventEditDraft = null;
    document.getElementById('eventEditModal')?.classList.add('hidden');
}

function saveEventEdit() {
    if (!eventEditDraft || !selectedVesselId) return;

    const dateValue = document.getElementById('editEventDate')?.value || toDateKey(eventEditDraft.start);
    const comment = String(document.getElementById('editEventComment')?.value || '').trim();
    const operationName = String(document.getElementById('editEventOperation')?.value || '').trim();
    const duration = Math.max(5, Number(document.getElementById('editEventDuration')?.value || 60) || 60);

    const startTime = formatTimeOnly(eventEditDraft.start);
    const endTime = formatTimeOnly(eventEditDraft.end || eventEditDraft.start);
    const nextStart = new Date(`${dateValue}T${startTime}:00`);
    const nextEnd = new Date(`${dateValue}T${endTime}:00`);
    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
        showStatus('Ugyldig dato/tid i redigert hendelse.', 'warning');
        return;
    }

    const isDisinfection = String(eventEditDraft.type || '').toLowerCase() === 'disinfection';
    let chemical = String(eventEditDraft.chemical || '').trim();
    let responsible = String(eventEditDraft.responsibleParty || eventEditDraft.responsible_party || '').trim();
    if (isDisinfection) {
        chemical = String(document.getElementById('editEventChemicalSelect')?.value || '').trim();
        responsible = String(document.getElementById('editEventResponsibleParty')?.value || '').trim();
        if (!chemical) {
            showStatus('Desinfeksjonsmiddel er obligatorisk for desinfeksjon.', 'warning');
            return;
        }
        if (!responsible) {
            showStatus('Firma/Person ansvarlig må fylles ut for desinfeksjon.', 'warning');
            return;
        }
        saveDisinfectionChemicalHistory(chemical);
    }

    updateCalendarEvent(selectedVesselId, eventEditDraft.id, {
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
        dateKey: toDateKey(nextStart),
        comment,
        facilityComment: comment,
        operationName,
        duration,
        chemical,
        responsibleParty: responsible,
        responsible_party: responsible,
        edited: true
    });

    closeEventEditModal();
    renderAll();
}

function deleteEventFromEditModal() {
    if (!eventEditDraft || !selectedVesselId) return;
    deleteCalendarEvent(selectedVesselId, eventEditDraft.id);
    closeEventEditModal();
    renderAll();
}

async function loadProposalsForSelected() {
    const vessel = getSelectedVessel();
    if (!vessel?.mmsi) {
        proposalCache.set(vessel?.id || 'none', []);
        return [];
    }
    try {
        const response = await fetch(`${API_BASE}/api/route-proposals?mmsi=${encodeURIComponent(vessel.mmsi)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const proposals = Array.isArray(data?.proposals) ? data.proposals : [];
        proposalCache.set(vessel.id, proposals);
        return proposals;
    } catch (_) {
        const existing = proposalCache.get(vessel.id) || [];
        proposalCache.set(vessel.id, existing);
        return existing;
    }
}

function renderRequests() {
    const list = document.getElementById('requestList');
    const vessel = getSelectedVessel();
    if (!vessel) {
        list.innerHTML = '<div class="empty">Velg en båt for å se forespørsler.</div>';
        return;
    }
    const proposals = proposalCache.get(vessel.id) || [];
    const activeJobs = getActiveJobs()
        .filter((job) => isVesselEligibleForJob(job, vessel.id))
        .filter((job) => {
            const status = String(job?.status || '').toLowerCase();
            if (status === 'completed' || status === 'cancelled' || status === 'fullført' || status === 'avbrutt') return false;
            const acceptedVesselId = String(job?.acceptedVesselId || '').trim();
            return !acceptedVesselId || acceptedVesselId === String(vessel.id);
        })
        .slice(0, 8);
    const localRequests = getLocalCalendarEvents(vessel.id)
        .map((event) => normalizeEvent(event, 'local'))
        .filter((event) => event.requestSource === 'facility-booking' || event.jobId);
    if (proposals.length === 0 && localRequests.length === 0 && activeJobs.length === 0) {
        list.innerHTML = '<div class="empty">Ingen forespørsler sendt ennå.</div>';
        return;
    }
    const apiCards = proposals.map((proposal) => `
        <div class="stack-card ${proposal.status === 'approved' ? 'ok' : proposal.status === 'rejected' ? 'danger' : proposal.status === 'alternative_suggested' ? 'warn' : ''}">
            <div class="stack-card-title">${repairMojibakeText(proposal.facility_name)}</div>
            <div class="stack-card-meta">${proposal.proposed_date} ${proposal.proposed_time} · ${proposal.status || 'pending'}</div>
            ${proposal.alternative_date ? `<div class="stack-card-meta">Alternativ: ${proposal.alternative_date} ${proposal.alternative_time || ''}</div>` : ''}
            ${proposal.facility_comment ? `<div class="stack-card-meta">Kommentar: ${repairMojibakeText(proposal.facility_comment)}</div>` : ''}
        </div>
    `);
    const localCards = localRequests.map((event) => `
        <div class="stack-card ${event.jobId ? 'ok' : 'warn'}">
            <div class="stack-card-title">${event.facilityName || event.title || 'Lokal forespørsel'}</div>
            <div class="stack-card-meta">${isoToLocal(event.start)} · ${event.jobId ? 'Oppdrag godtatt' : 'Lokal bookingforespørsel'}</div>
            <div class="stack-card-meta">Status: ${event.status === 'approved' ? 'Godkjent' : event.status === 'pending' ? 'Venter svar' : event.status || 'planned'}</div>
            ${event.comment ? `<div class="stack-card-meta">Kommentar: ${event.comment}</div>` : ''}
        </div>
    `);
    const activeJobCards = activeJobs.map((job) => {
        const isAccepted = String(job?.acceptedVesselId || '') === String(vessel.id);
        return `
            <div class="stack-card ${isAccepted ? 'ok' : 'warn'}">
                <div class="stack-card-title">${job.facilityName || 'Ukjent anlegg'}</div>
                <div class="stack-card-meta">${job.jobType || 'Jobb'} · ${job.startDate || '-'}${job.endDate && job.endDate !== job.startDate ? ` → ${job.endDate}` : ''}</div>
                <div class="stack-card-meta">${job.estimatedHours || '-'} t · Prioritet ${job.priority || 'normal'}${isAccepted ? ' · Allokert til valgt båt' : ''}</div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn ok" data-request-accept-job="${job.id}" data-request-accept-vessel="${vessel.id}" onclick="window.pilotLiteHandleMatchingAction && window.pilotLiteHandleMatchingAction(event)" style="flex:1;padding:8px;min-width:170px;">${isAccepted ? 'Allerede godtatt' : 'Godta oppdrag'}</button>
                    <button type="button" class="btn" data-request-quickplan-job="${job.id}" data-request-quickplan-vessel="${vessel.id}" onclick="window.pilotLiteHandleMatchingAction && window.pilotLiteHandleMatchingAction(event)" style="flex:1;padding:8px;min-width:170px;">Hurtigplanlegg</button>
                </div>
            </div>
        `;
    });
    list.innerHTML = [
        activeJobCards.length > 0 ? `<div class="stack-card-meta" style="margin-bottom:8px;"><strong>Aktive jobber du kan ta</strong></div>${activeJobCards.join('')}` : '',
        ...apiCards,
        ...localCards
    ].join('');

    list.querySelectorAll('[data-request-accept-job]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const jobId = btn.dataset.requestAcceptJob;
            const vesselId = btn.dataset.requestAcceptVessel;
            const job = getJob(jobId);
            if (String(job?.acceptedVesselId || '') === String(vesselId)) {
                showStatus('Oppdraget er allerede godtatt på valgt båt.', 'info');
                return;
            }
            if (!isVesselEligibleForJob(job, vesselId)) {
                showStatus('Valgt båt er ikke kvalifisert for denne jobben (preferanser/blokkering).', 'warning');
                return;
            }
            if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
            acceptJobProposal(jobId, vesselId);
        });
    });

    list.querySelectorAll('[data-request-quickplan-job]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const jobId = btn.dataset.requestQuickplanJob;
            const vesselId = btn.dataset.requestQuickplanVessel;
            quickPlanJob(jobId, vesselId, { autoAccept: true });
        });
    });
}

function getFacilityFromJob(job) {
    if (!job) return null;
    const byId = job.facilityId ? facilityMap.get(String(job.facilityId)) : null;
    if (byId) return byId;
    const byName = [...facilityMap.values()].find((facility) => String(facility?.name || '').trim() === String(job.facilityName || '').trim());
    return byName || null;
}

function getActiveDemandCountByFacility() {
    const byFacility = new Map();
    const jobs = getActiveJobs() || [];
    for (const job of jobs) {
        const status = String(job?.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled' || status === 'fullført' || status === 'avbrutt') continue;
        const facility = getFacilityFromJob(job);
        const id = String(facility?.id || job?.facilityId || '').trim();
        if (!id) continue;
        byFacility.set(id, (byFacility.get(id) || 0) + 1);
    }
    return byFacility;
}

function getFacilityOperatorPrefsState(facilityId) {
    const key = String(facilityId || '').trim();
    if (!key) return { preferredVesselIds: [], blockedVesselIds: [], lastUpdatedAt: null };

    let preferredVesselIds = [];
    let blockedVesselIds = [];
    try {
        const rawPrefs = localStorage.getItem(OPERATOR_PREFS_KEY);
        const parsed = rawPrefs ? JSON.parse(rawPrefs) : {};
        const facilityPrefs = parsed?.[key] || {};
        preferredVesselIds = Array.isArray(facilityPrefs.preferredVesselIds)
            ? facilityPrefs.preferredVesselIds.map((id) => String(id)).filter(Boolean)
            : [];
        blockedVesselIds = Array.isArray(facilityPrefs.blockedVesselIds)
            ? facilityPrefs.blockedVesselIds.map((id) => String(id)).filter(Boolean)
            : [];
    } catch (_) {
        preferredVesselIds = [];
        blockedVesselIds = [];
    }

    let lastUpdatedAt = null;
    try {
        const rawAudit = localStorage.getItem(OPERATOR_PREFS_AUDIT_KEY);
        const parsedAudit = rawAudit ? JSON.parse(rawAudit) : {};
        lastUpdatedAt = parsedAudit?.[key]?.lastUpdatedAt || null;
    } catch (_) {
        lastUpdatedAt = null;
    }

    return { preferredVesselIds, blockedVesselIds, lastUpdatedAt };
}

function hasPolicyDriftForJob(job, policyState) {
    if (!job || !policyState) return false;
    const currentPreferred = new Set((policyState.preferredVesselIds || []).map((id) => String(id)));
    const currentBlocked = new Set((policyState.blockedVesselIds || []).map((id) => String(id)));
    const snapshotPreferred = new Set((job.preferredVesselIds || []).map((id) => String(id)));
    const snapshotBlocked = new Set((job.blockedVesselIds || []).map((id) => String(id)));
    if (currentPreferred.size !== snapshotPreferred.size || currentBlocked.size !== snapshotBlocked.size) return true;
    for (const id of currentPreferred) {
        if (!snapshotPreferred.has(id)) return true;
    }
    for (const id of currentBlocked) {
        if (!snapshotBlocked.has(id)) return true;
    }
    return false;
}

function isVesselEligibleForJob(job, vesselId) {
    const id = String(vesselId || '');
    if (!id || !job) return false;
    const blocked = new Set(Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.map((item) => String(item)) : []);
    if (blocked.has(id)) return false;
    const preferred = new Set(Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.map((item) => String(item)) : []);
    if (preferred.size > 0 && !preferred.has(id)) return false;
    return true;
}

function toRangeBounds(startDate, endDate = startDate) {
    if (!startDate) return null;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate || startDate}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
}

function overlapsRange(eventStart, eventEnd, rangeStart, rangeEnd) {
    const start = new Date(eventStart);
    const end = new Date(eventEnd || eventStart);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return start <= rangeEnd && end >= rangeStart;
}

function buildAutoOpportunityForJob(job, vessel, vesselEvents) {
    const bounds = toRangeBounds(job?.startDate, job?.endDate);
    if (!bounds) return null;
    const facility = getFacilityFromJob(job);
    const facilityLat = Number(facility?.latitude ?? job?.facilityLat);
    const facilityLon = Number(facility?.longitude ?? job?.facilityLon);
    if (!Number.isFinite(facilityLat) || !Number.isFinite(facilityLon)) return null;

    const conflicting = vesselEvents.filter((event) => overlapsRange(event.start, event.end, bounds.start, bounds.end));
    if (conflicting.length > 0) return null;

    const sorted = [...vesselEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const previous = [...sorted].reverse().find((event) => new Date(event.end || event.start).getTime() <= bounds.start.getTime());
    const next = sorted.find((event) => new Date(event.start).getTime() >= bounds.end.getTime());

    const candidateAnchors = [];
    if (Number.isFinite(Number(vessel?.latitude)) && Number.isFinite(Number(vessel?.longitude))) {
        candidateAnchors.push({ lat: Number(vessel.latitude), lon: Number(vessel.longitude) });
    }
    [previous, next].forEach((event) => {
        const eventFacility = event?.facilityId ? facilityMap.get(String(event.facilityId)) : null;
        const lat = Number(eventFacility?.latitude);
        const lon = Number(eventFacility?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) candidateAnchors.push({ lat, lon });
    });

    const nearestDistanceKm = candidateAnchors.length > 0
        ? Math.min(...candidateAnchors.map((anchor) => haversine(anchor.lat, anchor.lon, facilityLat, facilityLon)))
        : null;

    const prevGapHours = previous
        ? Math.max(0, Math.round((bounds.start.getTime() - new Date(previous.end || previous.start).getTime()) / (1000 * 60 * 60)))
        : null;
    const nextGapHours = next
        ? Math.max(0, Math.round((new Date(next.start).getTime() - bounds.end.getTime()) / (1000 * 60 * 60)))
        : null;

    let score = 40;
    const reasons = [];
    if (Number.isFinite(nearestDistanceKm)) {
        if (nearestDistanceKm <= 20) {
            score += 28;
            reasons.push(`Allerede i området (${nearestDistanceKm.toFixed(1)} km)`);
        } else if (nearestDistanceKm <= 45) {
            score += 18;
            reasons.push(`Nær arbeidsområde (${nearestDistanceKm.toFixed(1)} km)`);
        } else if (nearestDistanceKm <= 80) {
            score += 8;
            reasons.push(`Mulig repositionering (${nearestDistanceKm.toFixed(1)} km)`);
        } else {
            score -= 8;
            reasons.push(`Høy dødtransport (${nearestDistanceKm.toFixed(1)} km)`);
        }
    }

    const deadtimeWindow = [prevGapHours, nextGapHours].filter((value) => Number.isFinite(value) && value >= 8 && value <= 96);
    if (deadtimeWindow.length > 0) {
        score += 20;
        reasons.push(`Fyller dødtid (${deadtimeWindow.map((h) => `${h}t`).join(' / ')})`);
    }

    if (String(job.priority || '').toLowerCase() === 'high') {
        score += 7;
        reasons.push('Høy prioritet');
    }

    if (score < 50) return null;
    return {
        job,
        score,
        reasons,
        nearestDistanceKm,
        prevGapHours,
        nextGapHours,
        facility
    };
}

function buildAutoOpportunitySuggestions(vessel, allJobs) {
    const vesselEvents = getVesselEventsFor(vessel.id)
        .filter((event) => !['presence'].includes(String(event.type || '').toLowerCase()));
    return (allJobs || [])
        .filter((job) => isVesselEligibleForJob(job, vessel.id))
        .filter((job) => !job?.proposals?.some((proposal) => String(proposal.vesselId) === String(vessel.id)))
        .map((job) => buildAutoOpportunityForJob(job, vessel, vesselEvents))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
}

function getJobFacilityCoordinates(job) {
    const facility = getFacilityFromJob(job);
    const lat = Number(facility?.latitude ?? job?.facilityLat);
    const lon = Number(facility?.longitude ?? job?.facilityLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, facility };
}

function getNearestVesselForJob(job, vesselPool = null) {
    const coords = getJobFacilityCoordinates(job);
    if (!coords) return null;

    const candidates = (Array.isArray(vesselPool) && vesselPool.length > 0 ? vesselPool : getFilteredVessels())
        .filter((candidate) => canManageVesselForActiveCompany(candidate))
        .filter((candidate) => isVesselEligibleForJob(job, candidate.id))
        .map((candidate) => {
            const vesselCoords = getEffectiveVesselCoordinates(candidate);
            if (!vesselCoords) return null;
            return {
                vessel: candidate,
                distanceKm: haversine(coords.lat, coords.lon, vesselCoords.lat, vesselCoords.lon)
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceKm - b.distanceKm);

    return candidates[0] || null;
}

function renderMatchingSuggestions() {
    const list = document.getElementById('matchingSuggestionsList');
    const vessel = getSelectedVessel();
    if (!list || !vessel) return;
    const canManageSelectedVessel = canManageVesselForActiveCompany(vessel);
    const municipalityFilterEl = document.getElementById('matchingMunicipalityFilter');
    const nearbyOnly = document.getElementById('matchingNearbyOnly')?.checked === true;

    const allJobs = getActiveJobs();
    const selectedVesselCoords = getEffectiveVesselCoordinates(vessel);
    const vesselLat = selectedVesselCoords?.lat;
    const vesselLon = selectedVesselCoords?.lon;
    const locationMetaByJobId = new Map();
    for (const job of allJobs) {
        const facility = getFacilityFromJob(job);
        if (!facility) continue;
        const facilityLat = Number(facility?.latitude);
        const facilityLon = Number(facility?.longitude);
        const distanceKm = (Number.isFinite(vesselLat) && Number.isFinite(vesselLon) && Number.isFinite(facilityLat) && Number.isFinite(facilityLon))
            ? haversine(vesselLat, vesselLon, facilityLat, facilityLon)
            : null;
        locationMetaByJobId.set(String(job.id || ''), { facility, distanceKm });
    }

    if (municipalityFilterEl) {
        const selectedMunicipality = String(municipalityFilterEl.value || '');
        const municipalities = [...new Set([...locationMetaByJobId.values()].map((item) => String(item?.facility?.municipality || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'nb-NO'));
        municipalityFilterEl.innerHTML = `<option value="">Alle kommuner</option>${municipalities.map((name) => `<option value="${name}">${name}</option>`).join('')}`;
        municipalityFilterEl.value = municipalities.includes(selectedMunicipality) ? selectedMunicipality : '';
    }

    const selectedMunicipality = String(municipalityFilterEl?.value || '');
    const passesJobFilters = (job) => {
        const meta = locationMetaByJobId.get(String(job.id || ''));
        if (!meta?.facility) return false;
        if (selectedMunicipality && String(meta.facility?.municipality || '') !== selectedMunicipality) return false;
        if (nearbyOnly && Number.isFinite(meta.distanceKm) && meta.distanceKm > 120) return false;
        return true;
    };

    const matchingJobs = [];

    // For each active job, check if this vessel matches
    for (const job of allJobs) {
        if (!passesJobFilters(job)) continue;
        if (!isVesselEligibleForJob(job, vessel.id)) continue;
        if (job.proposals && job.proposals.length > 0) {
            const matchesThisVessel = job.proposals.find(p => p.vesselId === vessel.id);
            if (matchesThisVessel) {
                matchingJobs.push({
                    job,
                    proposal: matchesThisVessel
                });
            }
        }
    }

    const autoSuggestions = buildAutoOpportunitySuggestions(vessel, allJobs).filter((item) => passesJobFilters(item.job));

    const nearbyJobs = allJobs
        .map((job) => {
            const meta = locationMetaByJobId.get(String(job.id || ''));
            if (!meta) return null;
            return { job, facility: meta.facility, distanceKm: meta.distanceKm };
        })
        .filter(Boolean)
        .filter((item) => passesJobFilters(item.job))
        .filter((item) => item.distanceKm === null || item.distanceKm <= 120)
        .sort((a, b) => {
            const aDist = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
            const bDist = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
            if (aDist !== bDist) return aDist - bDist;
            return String(a?.facility?.name || '').localeCompare(String(b?.facility?.name || ''), 'nb-NO');
        })
        .slice(0, 6);

    if (matchingJobs.length === 0 && autoSuggestions.length === 0 && nearbyJobs.length === 0) {
        list.innerHTML = '<div class="empty" style="padding:16px;text-align:center;">Ingen aktive jobbetterspørsler for valgte filtre.</div>';
        return;
    }

    // Sort by match score descending
    matchingJobs.sort((a, b) => (b.proposal.matchScore || 0) - (a.proposal.matchScore || 0));

    const proposalCards = matchingJobs.map(({ job, proposal }) => {
        const score = proposal.matchScore || 0;
        const scoreClass = score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';
        const policyState = getFacilityOperatorPrefsState(job.facilityId);
        const policyDrift = hasPolicyDriftForJob(job, policyState);
        const proposalAt = new Date(proposal?.createdAt || job?.createdAt || '').getTime();
        const policyUpdatedAt = new Date(policyState?.lastUpdatedAt || '').getTime();
        const policyChangedSinceProposal = policyDrift
            && Number.isFinite(proposalAt)
            && Number.isFinite(policyUpdatedAt)
            && policyUpdatedAt > proposalAt;
        const preferredCount = Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.length : 0;
        const blockedCount = Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.length : 0;
        const policyText = preferredCount > 0
            ? `Kun foretrukne (${preferredCount})${blockedCount > 0 ? ` · Blokkerte (${blockedCount})` : ''}`
            : blockedCount > 0
            ? `Blokkerte operatører (${blockedCount})`
            : '';
        
        const facilityName = job.facilityName || job.name || 'Ukjent anlegg';
        const jobTypeLabel = job.jobType || 'Jobb';
        
        return `
            <div class="job-card" style="margin-bottom:10px;">
                <div class="job-card-header">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span class="job-type-badge ${(job.jobType || 'default').toLowerCase()}">${jobTypeLabel}</span>
                            <span style="font-weight:600;font-size:13px;color:var(--text);">${facilityName}</span>
                        </div>
                        <div class="job-card-meta">${job.startDate} til ${job.endDate}</div>
                    </div>
                    <div class="match-score-circle ${scoreClass}" title="Matchscore: ${score}/100">
                        <span>${score}</span>
                    </div>
                </div>
                <div class="job-card-meta" style="margin-top:8px;">
                    <strong>Prioritet:</strong> ${job.priority || 'Normal'} · 
                    <strong>Timer:</strong> ${job.estimatedHours || '-'} · 
                    <strong>ETA:</strong> ${proposal.estimatedEta ? new Date(proposal.estimatedEta).toLocaleString('nb-NO', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'} ·
                    <strong>Periodefit:</strong> ${proposal.intervalFit ? 'Full' : `${proposal.coveredDays || 0}/${proposal.totalDays || 0} dager`}
                </div>
                ${policyText ? `<div class="job-card-meta" style="margin-top:4px;">Policy: ${policyText}</div>` : ''}
                ${policyChangedSinceProposal ? '<div class="job-card-meta" style="margin-top:4px;color:var(--warn);">⚠ Policy endret av anlegg siden forslaget ble laget</div>' : ''}
                ${proposal.matchReasons && proposal.matchReasons.length > 0 ? `
                    <div class="job-card-meta" style="color:#059669;font-size:11px;margin-top:6px;">
                        ✓ ${proposal.matchReasons.slice(0, 2).join(' • ')}
                    </div>
                ` : ''}
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button type="button" class="btn ok" data-accept-job="${job.id}" data-accept-vessel="${vessel.id}" style="flex:1;padding:10px;" ${canManageSelectedVessel ? '' : 'disabled title="Låst for båt fra annet selskap"'}>Godta</button>
                    <button type="button" class="btn warn" data-reject-job="${job.id}" style="flex:1;padding:10px;">Avslå</button>
                </div>
            </div>
        `;
    }).join('');

    const autoCards = autoSuggestions.map(({ job, score, reasons, nearestDistanceKm, prevGapHours, nextGapHours }) => {
        const scoreClass = score >= 80 ? 'high' : score >= 65 ? 'medium' : 'low';
        const facilityName = job.facilityName || 'Ukjent anlegg';
        const jobTypeLabel = job.jobType || 'Jobb';
        const policyState = getFacilityOperatorPrefsState(job.facilityId);
        const policyDrift = hasPolicyDriftForJob(job, policyState);
        const preferredCount = Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.length : 0;
        const blockedCount = Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.length : 0;
        const policyText = preferredCount > 0
            ? `Kun foretrukne (${preferredCount})${blockedCount > 0 ? ` · Blokkerte (${blockedCount})` : ''}`
            : blockedCount > 0
            ? `Blokkerte operatører (${blockedCount})`
            : '';
        const gapText = [prevGapHours, nextGapHours]
            .filter((value) => Number.isFinite(value))
            .map((value, idx) => `${idx === 0 ? 'før' : 'etter'} ${value}t`)
            .join(' · ');

        return `
            <div class="job-card" style="margin-bottom:10px;border:1px dashed var(--border);">
                <div class="job-card-header">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span class="job-type-badge ${(job.jobType || 'default').toLowerCase()}">${jobTypeLabel}</span>
                            <span style="font-weight:600;font-size:13px;color:var(--text);">${facilityName}</span>
                            <span class="fpl-badge warn">Auto-forslag dødtid</span>
                        </div>
                        <div class="job-card-meta">${job.startDate} til ${job.endDate}</div>
                    </div>
                    <div class="match-score-circle ${scoreClass}" title="Opportunity-score: ${score}/100">
                        <span>${score}</span>
                    </div>
                </div>
                <div class="job-card-meta" style="margin-top:8px;">
                    <strong>Timer:</strong> ${job.estimatedHours || '-'} ·
                    <strong>Avstand:</strong> ${Number.isFinite(nearestDistanceKm) ? `${nearestDistanceKm.toFixed(1)} km` : '-'}
                    ${gapText ? ` · <strong>Hull:</strong> ${gapText}` : ''}
                </div>
                ${policyText ? `<div class="job-card-meta" style="margin-top:4px;">Policy: ${policyText}</div>` : ''}
                ${policyDrift ? '<div class="job-card-meta" style="margin-top:4px;color:var(--warn);">⚠ Policy er endret siden auto-forslaget ble beregnet</div>' : ''}
                <div class="job-card-meta" style="color:#0f766e;font-size:11px;margin-top:6px;">
                    ✓ ${reasons.slice(0, 3).join(' • ')}
                </div>
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button type="button" class="btn ok" data-auto-share-job="${job.id}" style="flex:1;padding:10px;" ${canManageSelectedVessel ? '' : 'disabled title="Låst for båt fra annet selskap"'}>Send forespørsel</button>
                </div>
            </div>
        `;
    }).join('');

    const nearbyCards = nearbyJobs.map(({ job, facility, distanceKm }) => {
        const distanceText = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km` : 'Ukjent avstand';
        const nearest = getNearestVesselForJob(job);
        const nearestText = nearest
            ? `${nearest.vessel?.name || nearest.vessel?.mmsi || 'Ukjent båt'} · ${nearest.distanceKm.toFixed(1)} km`
            : 'Ingen kvalifisert båt med posisjon';
        const canPickNearest = Boolean(nearest?.vessel?.id) && String(nearest.vessel.id) !== String(vessel.id);
        return `
            <div class="stack-card" style="margin-bottom:8px;">
                <div class="stack-card-title">${facility?.name || job?.facilityName || 'Ukjent anlegg'}</div>
                <div class="stack-card-meta">${job?.jobType || 'Jobb'} · ${job?.startDate || '-'}${job?.endDate && job?.endDate !== job?.startDate ? ` → ${job.endDate}` : ''}</div>
                <div class="stack-card-meta">${distanceText} · Prioritet ${job?.priority || 'normal'} · ${job?.estimatedHours || '-'} t</div>
                <div class="stack-card-meta" style="margin-top:4px;">Nærmeste kvalifiserte båt: ${nearestText}</div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn ok" data-nearby-accept-job="${job.id}" data-nearby-accept-vessel="${vessel.id}" onclick="window.pilotLiteHandleMatchingAction && window.pilotLiteHandleMatchingAction(event)" style="flex:1;padding:8px;min-width:170px;">Godta på valgt båt</button>
                    <button type="button" class="btn" data-nearby-quickplan-job="${job.id}" data-nearby-quickplan-vessel="${vessel.id}" onclick="window.pilotLiteHandleMatchingAction && window.pilotLiteHandleMatchingAction(event)" style="flex:1;padding:8px;min-width:170px;">2) Hurtigplanlegg</button>
                    <button type="button" class="btn" data-pick-nearest-job="${job.id}" onclick="window.pilotLiteHandleMatchingAction && window.pilotLiteHandleMatchingAction(event)" style="flex:1;padding:8px;min-width:170px;">1) Velg nærmeste båt</button>
                </div>
            </div>
        `;
    }).join('');

    list.innerHTML = `
        ${nearbyCards ? `<div class="stack-card-meta" style="margin-bottom:8px;"><strong>Jobber i nærheten</strong></div>${nearbyCards}` : ''}
        ${proposalCards ? `<div class="stack-card-meta" style="margin-bottom:8px;"><strong>Direkte forespørsler til denne båten</strong></div>${proposalCards}` : ''}
        ${autoCards ? `<div class="stack-card-meta" style="margin:10px 0 8px;"><strong>Auto-forslag for å fylle dødtid</strong></div>${autoCards}` : ''}
    `;

    // Add event listeners
    list.querySelectorAll('[data-accept-job]').forEach(btn => {
        btn.addEventListener('click', () => {
            const jobId = btn.dataset.acceptJob;
            const vesselId = btn.dataset.acceptVessel;
            if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
            acceptJobProposal(jobId, vesselId);
        });
    });

    list.querySelectorAll('[data-reject-job]').forEach(btn => {
        btn.addEventListener('click', () => {
            showToast('info', 'Avslått', 'Jobbetterspørsel avslått.');
            renderMatchingSuggestions();
        });
    });

    list.querySelectorAll('[data-nearby-accept-job]').forEach((button) => {
        button.addEventListener('click', () => {
            const jobId = button.dataset.nearbyAcceptJob;
            const vesselId = button.dataset.nearbyAcceptVessel;
            const job = getJob(jobId);
            if (!isVesselEligibleForJob(job, vesselId)) {
                showStatus('Valgt båt er ikke kvalifisert for denne jobben. Bruk 1) Velg nærmeste båt.', 'warning');
                return;
            }
            if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
            acceptJobProposal(jobId, vesselId);
        });
    });

    list.querySelectorAll('[data-nearby-quickplan-job]').forEach((button) => {
        button.addEventListener('click', () => {
            const jobId = button.dataset.nearbyQuickplanJob;
            const vesselId = button.dataset.nearbyQuickplanVessel;
            const job = getJob(jobId);
            if (!isVesselEligibleForJob(job, vesselId)) {
                showStatus('Valgt båt er ikke kvalifisert for denne jobben. Bruk 1) Velg nærmeste båt.', 'warning');
                return;
            }
            quickPlanJob(jobId, vesselId, { autoAccept: true });
        });
    });

    list.querySelectorAll('[data-pick-nearest-job]').forEach((button) => {
        button.addEventListener('click', async () => {
            const job = allJobs.find((item) => String(item.id) === String(button.dataset.pickNearestJob));
            const nearest = getNearestVesselForJob(job);
            if (!nearest?.vessel?.id) {
                showStatus('Fant ingen nærmeste båt med gyldig posisjon for denne jobben.', 'warning');
                return;
            }
            if (!ensureCanManageVessel(nearest.vessel, 'Bytte til nærmeste båt')) return;
            selectedVesselId = nearest.vessel.id;
            syncSelectorsToSelectedVessel();
            await loadProposalsForSelected();
            renderAll();
            showStatus(`Valgte nærmeste kvalifiserte båt: ${nearest.vessel.name || nearest.vessel.mmsi} (${nearest.distanceKm.toFixed(1)} km). Trykk 2) Hurtigplanlegg.`, 'success');
        });
    });

    list.querySelectorAll('[data-auto-share-job]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!ensureCanManageVessel(vessel?.id, 'Send forespørsel')) return;
            const job = allJobs.find((item) => String(item.id) === String(button.dataset.autoShareJob));
            const facility = getFacilityFromJob(job);
            if (!job || !facility || !vessel) {
                showStatus('Mangler anleggsdata for auto-forslag.', 'warning');
                return;
            }
            openShareModal({
                vesselId: vessel.id,
                vesselName: vessel.name,
                vesselMmsi: vessel.mmsi,
                facilityId: facility.id,
                facilityCode: String(facility.localityNo || job.facilityCode || facility.id || ''),
                facilityName: facility.name || job.facilityName,
                date: job.startDate || toDateKey(new Date()),
                time: job.preferredTime || '10:00',
                notes: `Auto-forslag dødtid · ${job.jobType || 'jobb'} · ${job.startDate || ''}${job.endDate && job.endDate !== job.startDate ? ` til ${job.endDate}` : ''}`
            });
        });
    });
}

async function handleMatchingSuggestionsListClick(event) {
    const button = event.target?.closest?.('button');
    if (!button) return;

    const vessel = getSelectedVessel();
    if (!vessel) return;

    if (button.dataset.nearbyAcceptJob) {
        const jobId = button.dataset.nearbyAcceptJob;
        const vesselId = button.dataset.nearbyAcceptVessel || vessel.id;
        const job = getJob(jobId);
        if (!isVesselEligibleForJob(job, vesselId)) {
            showStatus('Valgt båt er ikke kvalifisert for denne jobben. Bruk 1) Velg nærmeste båt.', 'warning');
            return;
        }
        if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
        acceptJobProposal(jobId, vesselId);
        return;
    }

    if (button.dataset.nearbyQuickplanJob) {
        const jobId = button.dataset.nearbyQuickplanJob;
        const vesselId = button.dataset.nearbyQuickplanVessel || vessel.id;
        const job = getJob(jobId);
        if (!isVesselEligibleForJob(job, vesselId)) {
            showStatus('Valgt båt er ikke kvalifisert for denne jobben. Bruk 1) Velg nærmeste båt.', 'warning');
            return;
        }
        quickPlanJob(jobId, vesselId, { autoAccept: true });
        return;
    }

    if (button.dataset.pickNearestJob) {
        const allJobs = getActiveJobs();
        const job = allJobs.find((item) => String(item.id) === String(button.dataset.pickNearestJob));
        const nearest = getNearestVesselForJob(job);
        if (!nearest?.vessel?.id) {
            showStatus('Fant ingen nærmeste båt med gyldig posisjon for denne jobben.', 'warning');
            return;
        }
        if (String(nearest.vessel.id) === String(selectedVesselId)) {
            showStatus('Valgt båt er allerede nærmeste kvalifiserte båt. Trykk 2) Hurtigplanlegg.', 'info');
            return;
        }
        if (!ensureCanManageVessel(nearest.vessel, 'Bytte til nærmeste båt')) return;
        selectedVesselId = nearest.vessel.id;
        syncSelectorsToSelectedVessel();
        await loadProposalsForSelected();
        renderAll();
        showStatus(`Valgte nærmeste kvalifiserte båt: ${nearest.vessel.name || nearest.vessel.mmsi} (${nearest.distanceKm.toFixed(1)} km). Trykk 2) Hurtigplanlegg.`, 'success');
        return;
    }

    if (button.dataset.requestAcceptJob) {
        const jobId = button.dataset.requestAcceptJob;
        const vesselId = button.dataset.requestAcceptVessel || vessel.id;
        const job = getJob(jobId);
        if (String(job?.acceptedVesselId || '') === String(vesselId)) {
            showStatus('Oppdraget er allerede godtatt på valgt båt.', 'info');
            return;
        }
        if (!isVesselEligibleForJob(job, vesselId)) {
            showStatus('Valgt båt er ikke kvalifisert for denne jobben (preferanser/blokkering).', 'warning');
            return;
        }
        if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
        acceptJobProposal(jobId, vesselId);
        return;
    }

    if (button.dataset.requestQuickplanJob) {
        const jobId = button.dataset.requestQuickplanJob;
        const vesselId = button.dataset.requestQuickplanVessel || vessel.id;
        quickPlanJob(jobId, vesselId, { autoAccept: true });
    }
}

window.pilotLiteHandleMatchingAction = (event) => {
    void handleMatchingSuggestionsListClick(event);
};

function acceptJobProposal(jobId, vesselId) {
    if (!ensureCanManageVessel(vesselId, 'Godta jobb')) return;
    const acceptedJob = acceptStoredJobProposal(jobId, vesselId) || getJob(jobId);
    const vessel = vesselMap.get(vesselId);
    if (acceptedJob && vessel) {
        const start = new Date(`${acceptedJob.startDate}T${acceptedJob.preferredTime || '10:00'}:00`);
        const end = new Date(start.getTime() + Math.max(1, Number(acceptedJob.estimatedHours || 4)) * 60 * 60 * 1000);
        const exists = getLocalCalendarEvents(vesselId).some((event) => String(event.jobId || '') === String(jobId));
        if (!exists) {
            addCalendarEvents(vesselId, [{
                id: makeEventId('job'),
                jobId,
                vesselId,
                facilityId: acceptedJob.facilityId,
                facilityName: acceptedJob.facilityName,
                title: `Oppdrag · ${acceptedJob.facilityName}`,
                start: start.toISOString(),
                end: end.toISOString(),
                type: 'operation',
                planned: true,
                completed: false,
                status: 'approved',
                comment: acceptedJob.notes || '',
                requestSource: 'job-accept',
                jobType: acceptedJob.jobType,
                estimatedHours: acceptedJob.estimatedHours
            }]);
        }
    }
    showToast('success', 'Godtatt!', `Du har godtatt jobben. Anlegget er notifisert.`);
    renderRequests();
    renderAll();
    renderMatchingSuggestions();
}

function renderConfirmedRoutes() {
    const list = document.getElementById('confirmedRouteList');
    const routes = getConfirmedRoutesForSelected();
    if (routes.length === 0) {
        list.innerHTML = '<div class="empty">Ingen bekreftede ruter for valgt båt.</div>';
        return;
    }
    list.innerHTML = routes.map((route) => `
        <div class="stack-card ${route.source === 'api' ? 'ok' : 'warn'}">
            <div class="stack-card-title">${route.status || 'Route'}</div>
            <div class="stack-card-meta">${isoToLocal(route.createdAt)} · ${route.totalDays || 0} dager · ${(route.totalDistance || 0).toFixed(1)} km</div>
            <div class="stack-card-meta">${route.hasQuarantine ? 'Karantene inngår' : 'Ingen karantene'}</div>
        </div>
    `).join('');
}

function showStatus(message, tone = 'info') {
    const node = document.getElementById('dataStatus');
    node.textContent = message;
    node.className = `data-status ${tone}`;
}

function getApiErrorMessage(result, response, fallback = 'Ukjent feil') {
    const reason = result?.message || result?.error || fallback;
    if (!response) return reason;
    return `HTTP ${response.status}: ${reason}`;
}

function measureStep(stepName, fn, marks) {
    const start = performance.now();
    fn();
    marks.push({ step: stepName, ms: Number((performance.now() - start).toFixed(1)) });
}

function renderApiHealthNote() {
    const node = document.getElementById('apiHealthNote');
    if (!node) return;
    const facilityLabel = facilityDataSource === 'api+profil'
        ? 'Anlegg: API + profil'
        : facilityDataSource === 'profil'
        ? 'Anlegg: Profil fallback'
        : `Anlegg: ${facilityDataSource}`;
    const clearanceLabel = clearanceDataSource === 'api'
        ? 'Klarering: API'
        : clearanceDataSource === 'memory'
        ? 'Klarering: Cache'
        : clearanceDataSource === 'local-fallback'
        ? 'Klarering: Lokal fallback'
        : 'Klarering: Ukjent';
    const tone = (facilityDataSource === 'profil' || clearanceDataSource === 'local-fallback')
        ? 'warn'
        : (facilityDataSource === 'api+profil' || clearanceDataSource === 'api' || clearanceDataSource === 'memory')
        ? 'ok'
        : 'danger';
    node.className = `meta api-health-chip ${tone}`;
    node.textContent = `${facilityLabel} · ${clearanceLabel}`;
}

function openShareModal(data) {
    if (!ensureCanManageVessel(data?.vesselId, 'Åpne deling')) return;
    shareDraft = data;
    document.getElementById('shareFacilityInput').value = data.facilityName || '';
    document.getElementById('shareDateInput').value = data.date || '';
    document.getElementById('shareTimeInput').value = data.time || '10:00';
    document.getElementById('shareContactInput').value = data.contact || '';
    document.getElementById('shareNotesInput').value = data.notes || '';
    document.getElementById('shareModalMeta').textContent = `${data.vesselName || ''} → ${data.facilityName || ''}`;
    document.getElementById('shareRequestModal').classList.remove('hidden');
}

function closeShareModal() {
    shareDraft = null;
    document.getElementById('shareRequestModal').classList.add('hidden');
}

function openShareModalFromBatch(batchIndex, facilityIndex) {
    const route = getPlannedRoute();
    const vessel = getSelectedVessel();
    const batch = route?.batches?.[batchIndex];
    const facility = batch?.facilities?.[facilityIndex];
    if (!batch || !facility || !vessel) return;
    const batchDate = getBatchDate(batch);
    openShareModal({
        vesselId: vessel.id,
        vesselName: vessel.name,
        vesselMmsi: vessel.mmsi,
        facilityId: facility.id,
        facilityCode: facility.localityNo || facility.code || '',
        facilityName: facility.name,
        date: toDateKey(batchDate),
        time: batch.departureTime || route.routeDepartureTime || '10:00',
        notes: facility.comment || ''
    });
}

function splitCalendarEvent(eventId) {
    const vessel = getSelectedVessel();
    if (!vessel) return;
    const event = getSelectedVesselEvents().find((e) => String(e.id) === String(eventId));
    if (!event || event.type !== 'visit') {
        showStatus('Del er kun tilgjengelig for besøkshendelser.', 'warning');
        return;
    }
    if (event.completed) {
        showStatus('Kan ikke dele en allerede bekreftet hendelse.', 'warning');
        return;
    }
    const startMs = new Date(event.start).getTime();
    const endMs = new Date(event.end).getTime();
    if (endMs - startMs < 2 * 60 * 1000) {
        showStatus('Hendelsen er for kort til å deles.', 'warning');
        return;
    }
    const midMs = Math.round((startMs + endMs) / 2);
    const mid = new Date(midMs);
    const baseName = (event.title || 'Besøk').replace(/ \(\d\/2\)$/, '');
    const splitGroupId = makeEventId('split');
    const first = {
        ...event,
        id: makeEventId('visit'),
        title: `${baseName} (1/2)`,
        start: event.start,
        end: mid.toISOString(),
        splitGroupId,
        splitIndex: 1,
        splitBaseTitle: baseName,
        splitOriginalId: event.id,
    };
    const second = {
        ...event,
        id: makeEventId('visit'),
        title: `${baseName} (2/2)`,
        start: mid.toISOString(),
        end: event.end,
        splitGroupId,
        splitIndex: 2,
        splitBaseTitle: baseName,
        splitOriginalId: event.id,
    };
    deleteCalendarEvent(vessel.id, event.id);
    addCalendarEvents(vessel.id, [first, second]);
    showStatus(`Besøk delt i to: "${first.title}" og "${second.title}".`, 'ok');
    renderAll();
}

function undoSplitCalendarEvent(eventId) {
    const vessel = getSelectedVessel();
    if (!vessel) return;
    const events = getSelectedVesselEvents();
    const event = events.find((item) => String(item.id) === String(eventId));
    if (!event?.splitGroupId) {
        showStatus('Fant ingen delt hendelse å slå sammen.', 'warning');
        return;
    }
    const siblings = events
        .filter((item) => String(item.splitGroupId || '') === String(event.splitGroupId))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    if (siblings.length < 2) {
        showStatus('Trenger begge delene for å angre deling.', 'warning');
        return;
    }
    if (siblings.some((item) => item.completed)) {
        showStatus('Kan ikke angre deling etter at en del er bekreftet.', 'warning');
        return;
    }
    const merged = {
        ...siblings[0],
        id: event.splitOriginalId || makeEventId('visit'),
        title: event.splitBaseTitle || (event.title || 'Besøk').replace(/ \(\d\/2\)$/, ''),
        start: siblings[0].start,
        end: siblings[siblings.length - 1].end,
        splitGroupId: undefined,
        splitIndex: undefined,
        splitBaseTitle: undefined,
        splitOriginalId: undefined
    };
    updateVesselCalendarState(vessel.id, (state) => ({
        ...state,
        events: [...(state.events || []).filter((item) => !siblings.some((part) => String(part.id) === String(item.id))), merged]
    }));
    showStatus('Delte besøk er slått sammen igjen.', 'success');
    renderAll();
}

function openShareModalFromEvent(event) {
    const vessel = getSelectedVessel();
    openShareModal({
        vesselId: vessel?.id,
        vesselName: vessel?.name,
        vesselMmsi: vessel?.mmsi,
        facilityId: event.facilityId,
        facilityCode: facilityMap.get(event.facilityId)?.localityNo || event.facilityId || '',
        facilityName: event.facilityName,
        date: toDateKey(event.start),
        time: formatTimeOnly(event.start),
        notes: event.comment || ''
    });
}

async function confirmShareRequest() {
    if (!shareDraft) return;
    const vessel = getSelectedVessel();
    if (!ensureCanManageVessel(vessel, 'Send forespørsel')) return;
    const facility = facilityMap.get(shareDraft.facilityId);
    const date = document.getElementById('shareDateInput').value;
    const time = document.getElementById('shareTimeInput').value || '10:00';
    const contact = document.getElementById('shareContactInput').value.trim();
    const notes = document.getElementById('shareNotesInput').value.trim();
    if (!vessel?.mmsi || !facility || !date) {
        showStatus('Mangler båt, anlegg eller dato for forespørselen.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/route-proposals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                mmsi: Number(vessel.mmsi),
                vessel_name: vessel.name,
                facility_code: String(facility.localityNo || shareDraft.facilityCode || facility.id),
                facility_name: facility.name,
                proposed_date: date,
                proposed_time: time,
                contact_person: contact,
                notes,
                operation_type: 'visit'
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
            throw new Error(getApiErrorMessage(result, response, 'Kunne ikke sende forespørsel'));
        }

        const localEvents = getLocalCalendarEvents(vessel.id);
        const matching = localEvents.find((event) => event.facilityId === facility.id && toDateKey(event.start) === date && formatTimeOnly(event.start) === time);
        if (matching) {
            updateCalendarEvent(vessel.id, matching.id, {
                proposalId: result.proposal_id,
                sharedProposalId: result.proposal_id,
                status: 'pending',
                facilityComment: '',
                contactPerson: contact,
                notes
            });
        }
        await loadProposalsForSelected();
        closeShareModal();
        showStatus(`Forespørsel sendt til ${facility.name}.`, 'success');
        renderAll();
    } catch (error) {
        showStatus(`Kunne ikke sende forespørsel: ${error.message}`, 'error');
    }
}

function jumpToFirstPlannedVisit() {
    const upcoming = getSelectedVesselEvents().filter((event) => new Date(event.start).getTime() >= Date.now());
    const first = upcoming[0];
    if (!first) {
        showStatus('Ingen kommende besøk for valgt båt.', 'warning');
        return;
    }
    selectedCalendarDayKey = first.dateKey;
    calendarViewDate = new Date(first.start);
    renderCalendar();
    document.getElementById('calendarSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleSignClearance() {
    const vesselId = document.getElementById('signVesselSelect').value;
    const routeId = document.getElementById('signRouteSelect').value;
    const signedBy = document.getElementById('signByInput').value.trim();
    const quarantineDone = document.getElementById('signQuarantineDone').checked;
    const disinfectionDone = document.getElementById('signDisinfectionDone').checked;
    const status = document.getElementById('signStatus');

    if (!vesselId) {
        status.textContent = 'Velg båt før signering.';
        return;
    }
    if (!routeId) {
        status.textContent = 'Velg rute/hendelse før signering.';
        return;
    }
    if (!quarantineDone || !disinfectionDone) {
        status.textContent = 'Både karantene og desinfeksjon må markeres fullført.';
        return;
    }

    const vessel = vesselMap.get(vesselId);
    const route = getSelectedVesselEvents().find((item) => String(item.id) === routeId);
    if (!vessel?.mmsi) {
        status.textContent = 'Valgt båt mangler MMSI og kan ikke signeres grønn.';
        return;
    }

    const result = await signRoutePlannerClearance(profile.profileName, pilotActor, {
        mmsi: String(vessel.mmsi),
        vesselName: vessel.name,
        routePlanId: routeId,
        routePlanTitle: route?.title || 'Ruteplanlegger-hendelse',
        routeStart: route?.start || null,
        routeEnd: route?.end || null,
        signedBy: signedBy || 'Frøy Ops',
        quarantineCompleted: quarantineDone,
        disinfectionCompleted: disinfectionDone
    });

    if (!result.ok) {
        status.textContent = result.reason || 'Kunne ikke signere klarering.';
        return;
    }

    status.textContent = `Signert grønn status for ${vessel.name} (${vessel.mmsi}).`;
    document.getElementById('signQuarantineDone').checked = false;
    document.getElementById('signDisinfectionDone').checked = false;
    const clearanceResult = await refreshClearanceCache(profile.profileName, pilotActor, true);
    clearanceDataSource = clearanceResult?.source || 'unknown';
    renderAll();
}

function saveDemoVesselOps() {
    const vessel = getSelectedVessel();
    const statusNode = document.getElementById('demoHealthCertMeta');
    if (!vessel?.id) {
        showStatus('Velg en båt før du lagrer demo-info.', 'warning');
        return;
    }

    const crewCount = String(document.getElementById('demoCrewCount')?.value || '').trim();
    const contactName = String(document.getElementById('demoContactName')?.value || '').trim();
    const contactPhone = String(document.getElementById('demoContactPhone')?.value || '').trim();
    const fileInput = document.getElementById('demoHealthCertFile');
    const file = fileInput?.files?.[0] || null;

    const patch = {
        crewCount,
        contactName,
        contactPhone
    };

    if (file) {
        patch.healthCertName = file.name;
        patch.healthCertUpdatedAt = new Date().toISOString();
    }

    setVesselDemoOps(vessel.id, patch);
    if (fileInput) fileInput.value = '';
    if (statusNode) {
        const current = getVesselDemoOps(vessel.id);
        statusNode.textContent = current.healthCertName
            ? `Helseattest: ${current.healthCertName}${current.healthCertUpdatedAt ? ` · ${isoToLocal(current.healthCertUpdatedAt)}` : ''}`
            : 'Ingen helseattest lastet opp.';
    }
    showStatus(`Demo-info lagret for ${vessel.name}.`, 'success');
    renderSelectedVesselSummary();
}

function populateManualEventFacilities() {
    const select = document.getElementById('manualEventFacility');
    if (!select) return;
    fillSelect(
        select,
        (plannerFacilities || []).map((facility) => ({ value: facility.id, label: facility.name })),
        null,
        'Velg anlegg'
    );
}

function syncSelectorsToSelectedVessel() {
    const vessel = getSelectedVessel();
    pilotActor = getEffectivePilotActor();
    if (document.getElementById('vesselFocusSelect')) document.getElementById('vesselFocusSelect').value = vessel?.id || '';
    if (document.getElementById('signVesselSelect')) document.getElementById('signVesselSelect').value = vessel?.id || '';
    renderCompanyScopeBadge();
    populateSigningRouteOptions();
}

function populateSigningVesselOptions() {
    const select = document.getElementById('signVesselSelect');
    fillSelect(
        select,
        (profile.vessels || []).filter((item) => String(item.mmsi || '').trim()).map((vessel) => ({ value: vessel.id, label: `${vessel.name} (${vessel.mmsi})` })),
        null,
        'Velg båt'
    );
    syncSelectorsToSelectedVessel();
}

function populateSigningRouteOptions() {
    const select = document.getElementById('signRouteSelect');
    const vesselId = document.getElementById('signVesselSelect')?.value || '';
    const events = vesselId ? getSelectedVesselEvents().filter((event) => event.vesselId === vesselId) : [];
    fillSelect(
        select,
        events.map((event) => ({ value: event.id, label: `${isoToLocal(event.start)} · ${repairMojibakeText(event.title)}` })),
        null,
        'Velg rute/hendelse'
    );
}

async function calculateRoute() {
    if (!ensureCanManageVessel(getSelectedVessel(), 'Beregne rute')) return;
    if (!selectedVesselId) {
        showStatus('Velg en båt før ruteberegning.', 'warning');
        return;
    }
    const routeMode = document.getElementById('routeModeSelect').value;
    const routePlanDate = document.getElementById('routePlanDate').value;
    const routeDepartureTime = document.getElementById('routeDepartureTime').value;
    const routeSpeedKmh = Number(document.getElementById('routeSpeedKmh')?.value || DEFAULT_SPEED_KMH);
    setPlannerState(selectedVesselId, {
        routeMode,
        routePlanDate,
        routeDepartureTime,
        routeSpeedKmh: Math.min(45, Math.max(6, Number.isFinite(routeSpeedKmh) ? routeSpeedKmh : DEFAULT_SPEED_KMH))
    });
    const route = buildPlannedRoute(selectedVesselId);
    if (!route) {
        showStatus('Velg minst ett anlegg først.', 'warning');
        return;
    }

    if (route.hasCalendarBlockedFacilities) {
        const blocked = [];
        for (const batch of route.batches || []) {
            const names = Array.isArray(batch?.blockedFacilities) ? batch.blockedFacilities : [];
            blocked.push(...names);
        }
        const uniqueBlocked = [...new Set(blocked)].slice(0, 5);
        showStatus(`Rute blokkert av anleggskalender (rød dag): ${uniqueBlocked.join(', ')}. Velg annen startdato eller endre anleggsdager.`, 'warning');
        return;
    }

    const state = getPlannerState(selectedVesselId);
    const routeDate = getRouteBaseDateForState(state);
    const selectedFacilities = [...getSelectedFacilityIds()].map((id) => facilityMap.get(id)).filter(Boolean);
    const blockedNow = getBlockedFacilityNamesForDate(selectedFacilities, routeDate);
    if (blockedNow.length > 0) {
        showStatus(`Valgt dato er blokkert (rød) for: ${blockedNow.slice(0, 5).join(', ')}.`, 'warning');
        return;
    }

    setPlannerState(selectedVesselId, { showFacilitySelector: false });
    savePlannedRoute(selectedVesselId, route);
    setSelectedFacilityIds(new Set(
        (route.batches || [])
            .flatMap((batch) => (batch.facilities || []).map((facility) => String(facility?.id || '')))
            .filter(Boolean)
    ));
    renderPlannerState();
    if (route.hasQuarantine) {
        const bio = getRouteBiosecuritySummary(route);
        showStatus(
            `Rute planlagt med biosecurity-tiltak: ${bio.infectedCount} smittet / ${bio.zoneRiskCount} risikosone / ${bio.highLiceCount} høy lus. Desinfeksjon + 48t karantene legges inn i kalender.`,
            'warning'
        );
    } else {
        showStatus(`Rute planlagt: ${route.totalDays} dager, ${route.totalDistance.toFixed(1)} km.`, 'success');
    }
}

function clearRoute() {
    if (!selectedVesselId) return;
    if (!ensureCanManageVessel(getSelectedVessel(), 'Tøm rute')) return;
    setPlannerState(selectedVesselId, {
        selectedFacilityIds: [],
        plannedRoute: null,
        showFacilitySelector: true,
        facilityComments: {},
        operationMinutes: {}
    });
    renderAll();
}

function bindNavigation() {
    document.querySelectorAll('.vessel-nav-btn').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.vessel-nav-btn').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            const target = document.getElementById(button.dataset.targetSection);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function mountSelectedDayInfoUnderCalendar() {
    const mount = document.getElementById('calendarDayInfoMount');
    const header = document.getElementById('calendarDayInfoHeader');
    const section = document.getElementById('calendarDayInfoSection');
    if (!mount || !section) return;
    if (header && header.parentElement !== mount) mount.appendChild(header);
    if (section.parentElement !== mount) mount.appendChild(section);
}

function wireEvents() {
    document.getElementById('demoResetBtn')?.addEventListener('click', () => {
        const confirmed = window.confirm('Nullstill demo-tilstand for denne nettleseren? Dette fjerner lokale valg, kalender- og panelinnstillinger.');
        if (!confirmed) return;
        const removedKeys = clearDemoLocalState();
        showStatus(`Demo reset fullført. Fjernet ${removedKeys.length} lokale nøkler. Laster siden på nytt...`, 'success');
        setTimeout(() => {
            window.location.reload();
        }, 550);
    });

    document.getElementById('companyFilter')?.addEventListener('change', async () => {
        const companyId = String(document.getElementById('companyFilter')?.value || '').trim();
        setCompanyScope(companyId || '');
        await loadAllFacilitiesForPlanner();
        ensureSelectedVessel();
        populateVesselFocusSelect();
        syncSelectorsToSelectedVessel();
        renderAll();
    });
    document.getElementById('trackFilter')?.addEventListener('change', () => {
        ensureSelectedVessel();
        populateVesselFocusSelect();
        syncSelectorsToSelectedVessel();
        renderAll();
    });
    document.getElementById('vesselCategoryFilter')?.addEventListener('change', () => {
        ensureSelectedVessel();
        populateVesselFocusSelect();
        syncSelectorsToSelectedVessel();
        renderAll();
    });
    document.getElementById('vesselFocusSelect')?.addEventListener('change', async (event) => {
        selectedVesselId = event.target.value || null;
        syncSelectorsToSelectedVessel();
        await loadProposalsForSelected();
        renderAll();
    });
    document.getElementById('goUpcomingVisitBtn')?.addEventListener('click', jumpToFirstPlannedVisit);
    document.getElementById('signVesselSelect')?.addEventListener('change', populateSigningRouteOptions);
    document.getElementById('signClearanceBtn')?.addEventListener('click', () => { handleSignClearance(); });
    document.getElementById('prevCalendarMonthBtn')?.addEventListener('click', () => {
        calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
        renderCalendar();
    });
    document.getElementById('nextCalendarMonthBtn')?.addEventListener('click', () => {
        calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
        renderCalendar();
    });
    document.getElementById('calendarJumpBtn')?.addEventListener('click', () => {
        const value = document.getElementById('calendarJumpMonth')?.value || '';
        if (!/^\d{4}-\d{2}$/.test(value)) return;
        const [yearText, monthText] = value.split('-');
        const year = Number(yearText);
        const month = Number(monthText) - 1;
        if (!Number.isFinite(year) || !Number.isFinite(month)) return;
        calendarViewDate = new Date(year, month, 1);
        renderCalendar();
    });
    document.getElementById('calendarTodayBtn')?.addEventListener('click', () => {
        calendarViewDate = new Date();
        renderCalendar();
    });
    document.querySelectorAll('[data-day-mark]').forEach((button) => {
        button.addEventListener('click', () => setDayMark(button.dataset.dayMark));
    });
    document.getElementById('addManualEventBtn')?.addEventListener('click', addManualEvent);
    document.getElementById('facilitySearchInput')?.addEventListener('input', renderPlannerState);
    document.getElementById('routeModeSelect')?.addEventListener('change', () => setPlannerState(selectedVesselId, { routeMode: document.getElementById('routeModeSelect').value }));
    document.getElementById('routePlanDate')?.addEventListener('change', () => setPlannerState(selectedVesselId, { routePlanDate: document.getElementById('routePlanDate').value }));
    document.getElementById('routeDepartureTime')?.addEventListener('change', () => setPlannerState(selectedVesselId, { routeDepartureTime: document.getElementById('routeDepartureTime').value }));
    document.getElementById('routeSpeedKmh')?.addEventListener('change', () => {
        const value = Number(document.getElementById('routeSpeedKmh')?.value || DEFAULT_SPEED_KMH);
        setPlannerState(selectedVesselId, { routeSpeedKmh: Math.min(45, Math.max(6, Number.isFinite(value) ? value : DEFAULT_SPEED_KMH)) });
    });
    document.getElementById('togglePlannerFacilitiesBtn')?.addEventListener('click', () => {
        if (!selectedVesselId) return;
        const current = getPlannerState(selectedVesselId);
        setPlannerState(selectedVesselId, { showFacilitySelector: current.showFacilitySelector !== true });
        renderPlannerState();
    });
    document.getElementById('calculateRouteBtn')?.addEventListener('click', calculateRoute);
    document.getElementById('clearRouteBtn')?.addEventListener('click', clearRoute);
    document.getElementById('refreshRequestsBtn')?.addEventListener('click', async () => {
        await loadProposalsForSelected();
        renderRequests();
    });
    document.getElementById('refreshMatchingSuggestionsBtn')?.addEventListener('click', renderMatchingSuggestions);
    document.getElementById('matchingMunicipalityFilter')?.addEventListener('change', renderMatchingSuggestions);
    document.getElementById('matchingNearbyOnly')?.addEventListener('change', renderMatchingSuggestions);
    document.getElementById('matchingSuggestionsList')?.addEventListener('click', (event) => {
        void handleMatchingSuggestionsListClick(event);
    });
    document.getElementById('toggleMatchingSuggestionsBtn')?.addEventListener('click', () => togglePanel('matchingSuggestionsCollapsed'));
    document.getElementById('refreshConfirmedBtn')?.addEventListener('click', renderConfirmedRoutes);
    document.getElementById('demoSaveVesselOpsBtn')?.addEventListener('click', saveDemoVesselOps);
    document.getElementById('confirmShareRequestBtn')?.addEventListener('click', confirmShareRequest);
    document.getElementById('cancelShareRequestBtn')?.addEventListener('click', closeShareModal);
    document.getElementById('closeShareModalBtn')?.addEventListener('click', closeShareModal);
    document.getElementById('confirmEventEditBtn')?.addEventListener('click', saveEventEdit);
    document.getElementById('deleteEventEditBtn')?.addEventListener('click', deleteEventFromEditModal);
    document.getElementById('cancelEventEditBtn')?.addEventListener('click', closeEventEditModal);
    document.getElementById('closeEventEditModalBtn')?.addEventListener('click', closeEventEditModal);
    document.getElementById('editEventAttachBtn')?.addEventListener('click', () => {
        showStatus('Vedlegg av attest kommer i neste steg.', 'info');
    });
    document.getElementById('toggleFleetTableBtn')?.addEventListener('click', () => togglePanel('fleetTableCollapsed'));
    document.getElementById('toggleCalendarBtn')?.addEventListener('click', () => togglePanel('calendarCollapsed'));
    document.getElementById('toggleRoutePreviewBtn')?.addEventListener('click', () => togglePanel('routePreviewCollapsed'));
    document.getElementById('toggleSelectedDayBtn')?.addEventListener('click', () => togglePanel('selectedDayCollapsed'));
    // healthPanelBody is now a native <details> element – no JS toggle needed
    document.getElementById('toggleRequestsBtn')?.addEventListener('click', () => togglePanel('requestsCollapsed'));
    document.getElementById('toggleConfirmedBtn')?.addEventListener('click', () => togglePanel('confirmedCollapsed'));
    bindNavigation();
}

function renderAll() {
    const marks = [];
    const start = performance.now();
    renderCompanyScopeBadge();
    ensureSelectedVessel();
    measureStep('focus-select', () => populateVesselFocusSelect(), marks);
    measureStep('sync-selectors', () => syncSelectorsToSelectedVessel(), marks);
    measureStep('source-note', () => renderFacilitySourceNote(), marks);
    measureStep('cards', () => renderCards(), marks);
    measureStep('vessel-table', () => renderVesselTable(), marks);
    measureStep('vessel-summary', () => renderSelectedVesselSummary(), marks);
    measureStep('map', () => renderMap(), marks);
    measureStep('planner', () => renderPlannerState(), marks);
    measureStep('calendar', () => renderCalendar(), marks);
    measureStep('matching-suggestions', () => renderMatchingSuggestions(), marks);
    measureStep('requests', () => renderRequests(), marks);
    measureStep('confirmed', () => renderConfirmedRoutes(), marks);
    measureStep('api-health', () => renderApiHealthNote(), marks);
    window.__pilotLiteLastRender = {
        page: 'vessel',
        totalMs: Number((performance.now() - start).toFixed(1)),
        marks
    };
}

async function init() {
    const meta = document.getElementById('profileMeta');
    mountSelectedDayInfoUnderCalendar();
    loadPanelPrefs();
    applyPanelPrefs();

    try {
        profile = await loadProfile();
        companyMap = mapById(profile.companies || []);
        setCompanyScope(resolveActiveCompanyId());
        buildCalendarFacilityKeys();
        await loadDiseaseSpreadIndex();
        await loadAllFacilitiesForPlanner();
        vesselMap = mapById(profile.vessels || []);
        meta.textContent = `Profil: ${profile.profileName || '-'} · Opprettet: ${profile.createdAt || '-'}`;

        const clearanceResult = await refreshClearanceCache(profile.profileName, pilotActor, true);
        clearanceDataSource = clearanceResult?.source || 'unknown';
        populateFilters();
        populateManualEventFacilities();
        ensureSelectedVessel();
        populateSigningVesselOptions();
        wireEvents();
        await loadProposalsForSelected();
        showStatus(`Båtsiden er lastet med per-båt kalender, planlegger og anleggssynk (${facilityDataSource} anlegg).`, 'success');
        renderAll();
        // Pre-warm AIS cache in background - triggers a map re-render with Froy boat positions
        loadAisVesselIndex(false).then(() => { renderMap(); }).catch(() => {});
    } catch (error) {
        meta.textContent = `Feil ved lasting av profil: ${error.message}`;
        showStatus(`Feil ved oppstart: ${error.message}`, 'error');
    }
}

init();
