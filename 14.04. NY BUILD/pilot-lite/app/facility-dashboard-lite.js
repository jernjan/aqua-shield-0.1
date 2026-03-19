import { loadProfile, mapById, isoToLocal, createCell, repairMojibakeText, downloadTextFile } from './common.js';
import { renderFacilityMiniMap } from './lite-map.js';
import { isMmsiCleared, refreshClearanceCache } from './pilot-shared-store.js';
import { createJob, listJobs, JOB_TYPES, JOB_STATUSES, matchVesselsForJob, findVesselsInRadius, generateProposal, addProposalsToJob, updateJobPolicySnapshot, updateJobStatus } from './job-store.js';
import { deriveAvailabilityWindows, distanceKmBetween } from './availability-windows.js';

const API_BASE_OVERRIDE_KEY = 'pilotLiteApiBaseOverrideV1';
function resolveApiBase() {
    // On Render: API service name is "kyst-monitor-api" → https://kyst-monitor-api.onrender.com
    // Override with ?apiBase=<url> or via system-check.html if the name differs.
    const fallback = window.location.hostname.includes('render.com')
        ? 'https://kyst-monitor-api.onrender.com'
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
const DEMO_RESET_KEY_PREFIXES = ['pilotlite', 'facility'];

let profile = null;
let companyMap = null;
let vesselMap = null;
let facilityCatalog = [];
let selectedFacilityId = null;
let analysisRadiusKm = 20;
let diseaseSpreadData = { confirmed_diseased_facilities: [], all_at_risk_facilities: [] };
let riskByCode = new Map();
let riskByName = new Map();
let confirmedByCode = new Set();
let confirmedByName = new Set();
let nearbyAisVessels = [];
let nearbyAisRiskVessels = [];
let nearbyAisClearedVessels = [];
let nearbyLiceRiskVessels = [];
let calendarEnabledFacilityIds = new Set();
let selectedCalendarDayKey = null;
let selectedBoatForBookingId = null;
let activeMarkMode = null; // 'green' | 'red' | null – for multi-day batch marking
let calendarViewYear = null;
let calendarViewMonth = null;
let calendarStatusFilter = 'all';
let calendarQuickMode = 'all';
const CALENDAR_OVERRIDES_KEY = 'facilityCalendarEventOverridesV1';
const PANEL_PREFS_KEY = 'facilityDashboardLitePanelPrefsV1';
const VESSEL_CALENDAR_STORE_KEY = 'pilotLiteVesselCalendarV2';
const BOAT_AVAILABILITY_KEY = 'facilityBoatManualAvailabilityV1';
const AUTO_RULE_PREFS_KEY = 'facilityCalendarAutoRulePrefsV1';
const OPERATOR_PREFS_KEY = 'facilityOperatorPrefsV1';
const OPERATOR_PREFS_AUDIT_KEY = 'facilityOperatorPrefsAuditV1';
const INTEROP_ACTIVITY_KEY = 'pilotLiteInteropActivityV1';
const JOB_STATUS_LABELS = {
    [JOB_STATUSES.CREATED]: 'Opprettet',
    [JOB_STATUSES.PROPOSAL_SENT]: 'Forslag sendt',
    [JOB_STATUSES.ACCEPTED]: 'Godtatt',
    [JOB_STATUSES.IN_PROGRESS]: 'Pågår',
    [JOB_STATUSES.COMPLETED]: 'Fullført',
    [JOB_STATUSES.CANCELLED]: 'Avbrutt'
};
const JOB_STATUS_BADGE_CLASS = {
    [JOB_STATUSES.CREATED]: 'draft',
    [JOB_STATUSES.PROPOSAL_SENT]: 'matching',
    [JOB_STATUSES.ACCEPTED]: 'accepted',
    [JOB_STATUSES.IN_PROGRESS]: 'matched',
    [JOB_STATUSES.COMPLETED]: 'matched',
    [JOB_STATUSES.CANCELLED]: 'draft'
};
const JOB_STATUS_TRANSITIONS = {
    [JOB_STATUSES.CREATED]: [JOB_STATUSES.PROPOSAL_SENT, JOB_STATUSES.CANCELLED],
    [JOB_STATUSES.PROPOSAL_SENT]: [JOB_STATUSES.ACCEPTED, JOB_STATUSES.CANCELLED],
    [JOB_STATUSES.ACCEPTED]: [JOB_STATUSES.IN_PROGRESS, JOB_STATUSES.CANCELLED],
    [JOB_STATUSES.IN_PROGRESS]: [JOB_STATUSES.COMPLETED, JOB_STATUSES.CANCELLED],
    [JOB_STATUSES.COMPLETED]: [],
    [JOB_STATUSES.CANCELLED]: []
};
let calendarEventOverrides = {};
let manualBoatAvailability = {};
let autoRulePrefsByFacility = {};
let operatorPrefsByFacility = {};
let operatorPrefsAuditByFacility = {};
let panelPrefs = {
    facilitiesCollapsed: false,
    boatsCollapsed: false,
    facilityCalendarCollapsed: false,
    jobRequestCollapsed: false,
    selectedInfoCollapsed: false,
    nearbyFacilitiesCollapsed: false,
    nearbyRiskCollapsed: false
};
const dataStatus = {
    disease: 'unknown',
    ais: 'unknown',
    quarantine: 'unknown',
    clearances: 'unknown',
    lice: 'unknown'
};
const COMPANY_SCOPE_KEY = 'pilotLiteFacilityCompanyScopeV1';
let activeCompanyId = '';
let pilotActor = 'masoval';

const AIS_CACHE_MS = 2 * 60 * 1000;
const QUARANTINE_CACHE_MS = 5 * 60 * 1000;
const FROY_AIS_CACHE_MS = 3 * 60 * 1000; // refresh Frøy vessel positions every 3 min
let aisCache = { key: null, ts: 0, nearby: [], risk: [] };
let quarantineCache = { ts: 0, byMmsi: new Map() };
let froyVesselCache = { ts: 0, vessels: [] }; // last-known AIS positions for fleet vessels

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

function showToast(type, title, message, duration = 4500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const normalized = ['error', 'warning', 'info', 'success'].includes(type) ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `error-toast error-toast-${normalized}`;
    toast.innerHTML = `<div class="error-toast-title">${title}</div><div class="error-toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duration);
}

function loadManualBoatAvailability() {
    try {
        const raw = localStorage.getItem(BOAT_AVAILABILITY_KEY);
        if (!raw) {
            manualBoatAvailability = {};
            return;
        }
        const parsed = JSON.parse(raw);
        manualBoatAvailability = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        manualBoatAvailability = {};
    }
}

function saveManualBoatAvailability() {
    try {
        localStorage.setItem(BOAT_AVAILABILITY_KEY, JSON.stringify(manualBoatAvailability || {}));
    } catch (_) {
        // ignore storage quota/permission issues
    }
}

function loadAutoRulePrefs() {
    try {
        const raw = localStorage.getItem(AUTO_RULE_PREFS_KEY);
        if (!raw) {
            autoRulePrefsByFacility = {};
            return;
        }
        const parsed = JSON.parse(raw);
        autoRulePrefsByFacility = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        autoRulePrefsByFacility = {};
    }
}

function saveAutoRulePrefs() {
    try {
        localStorage.setItem(AUTO_RULE_PREFS_KEY, JSON.stringify(autoRulePrefsByFacility || {}));
    } catch (_) {
        // ignore localStorage errors
    }
}

function getAutoRuleFacilityKey(facility) {
    const localityNo = String(facility?.localityNo || '').trim();
    if (localityNo) return `loc:${localityNo}`;
    return `id:${String(facility?.id || '').trim()}`;
}

function getFacilityAutoRuleConfig(facility) {
    const key = getAutoRuleFacilityKey(facility);
    const raw = (key && autoRulePrefsByFacility[key] && typeof autoRulePrefsByFacility[key] === 'object')
        ? autoRulePrefsByFacility[key]
        : {};

    const hasNearbyDisease = isDiseaseTestingAutoRecommendedForFacility(facility, 10);

    return {
        liceDeadline: typeof raw.liceDeadline === 'boolean' ? raw.liceDeadline : true,
        bInvestigation: typeof raw.bInvestigation === 'boolean' ? raw.bInvestigation : true,
        diseaseTestingWindow: typeof raw.diseaseTestingWindow === 'boolean' ? raw.diseaseTestingWindow : hasNearbyDisease,
        biomassPlanning: typeof raw.biomassPlanning === 'boolean' ? raw.biomassPlanning : true,
        waterQualityMonthly: typeof raw.waterQualityMonthly === 'boolean' ? raw.waterQualityMonthly : false
    };
}

function isDiseaseTestingAutoRecommendedForFacility(facility, radiusKm = 10) {
    if (!facility) return false;
    const selectedLat = toValidNumber(facility?.latitude);
    const selectedLon = toValidNumber(facility?.longitude);
    if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLon)) return false;

    const selectedId = String(facility?.id || '').trim();
    const nearby = getFacilityCatalog();
    for (const candidate of nearby) {
        const candidateId = String(candidate?.id || '').trim();
        if (!candidateId || candidateId === selectedId) continue;
        if (!isFacilityInfected(candidate)) continue;
        const lat = toValidNumber(candidate?.latitude);
        const lon = toValidNumber(candidate?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const distance = haversineKm(selectedLat, selectedLon, lat, lon);
        if (Number.isFinite(distance) && distance <= radiusKm) return true;
    }
    return isFacilityInfected(facility);
}

function setFacilityAutoRuleEnabled(facility, ruleKey, enabled) {
    const key = getAutoRuleFacilityKey(facility);
    if (!key) return;
    const current = (autoRulePrefsByFacility[key] && typeof autoRulePrefsByFacility[key] === 'object')
        ? autoRulePrefsByFacility[key]
        : {};
    autoRulePrefsByFacility[key] = { ...current, [ruleKey]: enabled === true };
    saveAutoRulePrefs();
}

function setFacilityAutoRulesBulk(facility, enabled) {
    if (!facility) return;
    setFacilityAutoRuleEnabled(facility, 'liceDeadline', enabled);
    setFacilityAutoRuleEnabled(facility, 'bInvestigation', enabled);
    setFacilityAutoRuleEnabled(facility, 'diseaseTestingWindow', enabled);
    setFacilityAutoRuleEnabled(facility, 'biomassPlanning', enabled);
    setFacilityAutoRuleEnabled(facility, 'waterQualityMonthly', enabled);
}

function renderCalendarAutoSetupControls(facility) {
    const wrap = document.getElementById('calendarAutoSetup');
    if (!wrap) return;
    const autoList = document.getElementById('autoGeneratedRequestsList');
    if (!facility) {
        wrap.style.display = 'none';
        if (autoList) autoList.textContent = 'Velg anlegg for å se forslag.';
        return;
    }

    const config = getFacilityAutoRuleConfig(facility);
    wrap.style.display = '';
    const setChecked = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.checked = value === true;
    };

    setChecked('autoRuleLiceDeadline', config.liceDeadline);
    setChecked('autoRuleBInvestigation', config.bInvestigation);
    setChecked('autoRuleDiseaseTesting', config.diseaseTestingWindow);
    setChecked('autoRuleBiomassPlanning', config.biomassPlanning);
    setChecked('autoRuleWaterQualityMonthly', config.waterQualityMonthly);
    renderAutoGeneratedRequestsList(facility);
}

function renderAutoGeneratedRequestsList(facility) {
    const listEl = document.getElementById('autoGeneratedRequestsList');
    if (!listEl) return;
    if (!facility) {
        listEl.textContent = 'Velg anlegg for å se forslag.';
        return;
    }

    const reminders = buildCalendarAutoReminders(facility).filter((item) => String(item?.suggestionType || '').trim().length > 0);
    if (!reminders.length) {
        listEl.textContent = 'Ingen aktive auto-forslag for valgt anlegg nå.';
        return;
    }

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const sorted = reminders
        .slice()
        .sort((a, b) => {
            const typePriority = (item) => {
                const type = String(item?.suggestionType || '');
                if (type === 'diseaseTestingWindow') return 0;
                if (type === 'liceDeadline') return 1;
                if (type === 'bInvestigation') return 2;
                if (type === 'harvestPlanning') return 3;
                if (type === 'waterQualityMonthly') return 4;
                return 5;
            };
            const pDiff = typePriority(a) - typePriority(b);
            if (pDiff !== 0) return pDiff;
            const tierA = a.tier === 'requirement' ? 0 : 1;
            const tierB = b.tier === 'requirement' ? 0 : 1;
            if (tierA !== tierB) return tierA - tierB;
            return String(a.dateKey || '').localeCompare(String(b.dateKey || ''));
        })
        .slice(0, 6);

    const html = sorted.map((item) => {
        const dateKey = normalizeDateKey(item.dateKey) || '';
        const startDate = normalizeDateKey(item.actionStartDate || dateKey) || dateKey;
        const endDate = normalizeDateKey(item.actionEndDate || dateKey) || dateKey;
        const severityClass = item.severity === 'danger' ? 'danger' : (item.severity === 'warn' ? 'warn' : 'neutral');
        const tierClass = item.tier === 'requirement' ? 'requirement' : 'recommended';
        const signalClass = item.suggestionType === 'waterQualityMonthly' ? 'auto-signal-gray' : 'auto-signal-green';
        return `
            <li class="cal-rule-item ${tierClass}">
                <div class="cal-rule-head"><span class="auto-signal-dot ${signalClass}"></span><span class="cal-summary-pill ${severityClass}">${escapeHtml(item.title || 'Forslag')}</span><span class="cal-rule-date">Frist: ${escapeHtml(dateKey || '-')}</span></div>
                <div class="cal-rule-detail">${escapeHtml(item.detail || '')}</div>
                <button
                    type="button"
                    class="cal-rule-action"
                    data-auto-request="${escapeHtml(item.suggestionType || '')}"
                    data-auto-date="${escapeHtml(dateKey || '')}"
                    data-auto-start="${escapeHtml(startDate || '')}"
                    data-auto-end="${escapeHtml(endDate || '')}"
                    data-auto-title="${escapeHtml(item.title || '')}"
                >${escapeHtml(item.actionLabel || 'Legg til som forespørsel')}</button>
            </li>
        `;
    }).join('');

    listEl.innerHTML = `<ul class="cal-rule-list">${html}</ul>`;
}

function getManualBoatAvailability(vesselId) {
    const key = String(vesselId || '').trim();
    if (!key) return 'auto';
    const value = String(manualBoatAvailability?.[key] || 'auto').trim().toLowerCase();
    if (value === 'available' || value === 'unavailable') return value;
    return 'auto';
}

function setManualBoatAvailability(vesselId, mode) {
    const key = String(vesselId || '').trim();
    if (!key) return;
    const normalized = String(mode || 'auto').trim().toLowerCase();
    if (normalized === 'available' || normalized === 'unavailable') {
        manualBoatAvailability[key] = normalized;
    } else {
        delete manualBoatAvailability[key];
    }
    saveManualBoatAvailability();
}

function loadOperatorPrefs() {
    try {
        const raw = localStorage.getItem(OPERATOR_PREFS_KEY);
        if (!raw) {
            operatorPrefsByFacility = {};
            return;
        }
        const parsed = JSON.parse(raw);
        operatorPrefsByFacility = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        operatorPrefsByFacility = {};
    }
}

function saveOperatorPrefs() {
    try {
        localStorage.setItem(OPERATOR_PREFS_KEY, JSON.stringify(operatorPrefsByFacility || {}));
    } catch (_) {
        // ignore storage issues in demo mode
    }
}

function loadOperatorPrefsAudit() {
    try {
        const raw = localStorage.getItem(OPERATOR_PREFS_AUDIT_KEY);
        if (!raw) {
            operatorPrefsAuditByFacility = {};
            return;
        }
        const parsed = JSON.parse(raw);
        operatorPrefsAuditByFacility = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        operatorPrefsAuditByFacility = {};
    }
}

function saveOperatorPrefsAudit() {
    try {
        localStorage.setItem(OPERATOR_PREFS_AUDIT_KEY, JSON.stringify(operatorPrefsAuditByFacility || {}));
    } catch (_) {
        // ignore storage issues in demo mode
    }
}

function getFacilityOperatorPolicyAudit(facilityId) {
    const key = String(facilityId || '').trim();
    if (!key) return { lastUpdatedAt: null, lastAction: '', lastUpdatedBy: '', history: [] };
    const raw = operatorPrefsAuditByFacility?.[key] || {};
    const history = Array.isArray(raw.history) ? raw.history : [];
    return {
        lastUpdatedAt: raw.lastUpdatedAt || null,
        lastAction: raw.lastAction || '',
        lastUpdatedBy: raw.lastUpdatedBy || '',
        history
    };
}

function pushFacilityOperatorPolicyAudit(facilityId, entry) {
    const key = String(facilityId || '').trim();
    if (!key || !entry) return;
    const current = getFacilityOperatorPolicyAudit(key);
    const { at, action, vesselId, vesselName, by, ...extraFields } = entry;
    const nextEntry = {
        at: at || new Date().toISOString(),
        action: String(action || ''),
        vesselId: String(vesselId || ''),
        vesselName: String(vesselName || ''),
        by: String(by || pilotActor || 'facility_ops'),
        ...extraFields
    };
    const history = [nextEntry, ...(current.history || [])].slice(0, 12);
    operatorPrefsAuditByFacility[key] = {
        lastUpdatedAt: nextEntry.at,
        lastAction: nextEntry.action,
        lastUpdatedBy: nextEntry.by,
        history
    };
    saveOperatorPrefsAudit();
}

function getFacilityOperatorPrefs(facilityId) {
    const key = String(facilityId || '').trim();
    if (!key) return { preferredVesselIds: [], blockedVesselIds: [] };
    const raw = operatorPrefsByFacility?.[key] || {};
    const preferredVesselIds = Array.isArray(raw.preferredVesselIds)
        ? raw.preferredVesselIds.map((item) => String(item)).filter(Boolean)
        : [];
    const blockedVesselIds = Array.isArray(raw.blockedVesselIds)
        ? raw.blockedVesselIds.map((item) => String(item)).filter(Boolean)
        : [];
    return { preferredVesselIds, blockedVesselIds };
}

function isFacilityPreferredVessel(facilityId, vesselId) {
    const prefs = getFacilityOperatorPrefs(facilityId);
    return prefs.preferredVesselIds.includes(String(vesselId));
}

function isFacilityBlockedVessel(facilityId, vesselId) {
    const prefs = getFacilityOperatorPrefs(facilityId);
    return prefs.blockedVesselIds.includes(String(vesselId));
}

function getVesselCompanyId(vesselOrId) {
    const vessel = typeof vesselOrId === 'object' && vesselOrId
        ? vesselOrId
        : vesselMap?.get(String(vesselOrId || ''));
    if (!vessel) return '';
    return String(vessel.companyId || vessel.company_id || vessel.operatorCompanyId || '').trim();
}

function canManageVesselForActiveCompany(vesselOrId) {
    const scopedCompanyId = String(activeCompanyId || '').trim();
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
    showToast('warning', 'Selskapslås', `${actionLabel} er låst: ${vesselName} tilhører et annet selskap.`);
    return false;
}

function setFacilityPreferredVessel(facilityId, vesselId, preferred, metadata = {}) {
    const facilityKey = String(facilityId || '').trim();
    const vesselKey = String(vesselId || '').trim();
    if (!facilityKey || !vesselKey) return false;
    if (!canManageVesselForActiveCompany(vesselKey)) return false;
    const current = getFacilityOperatorPrefs(facilityKey);
    const preferredSet = new Set(current.preferredVesselIds);
    const blockedSet = new Set(current.blockedVesselIds);
    if (preferred) {
        preferredSet.add(vesselKey);
        blockedSet.delete(vesselKey);
    } else {
        preferredSet.delete(vesselKey);
    }
    operatorPrefsByFacility[facilityKey] = {
        preferredVesselIds: [...preferredSet],
        blockedVesselIds: [...blockedSet]
    };
    saveOperatorPrefs();
    pushFacilityOperatorPolicyAudit(facilityKey, {
        action: preferred ? 'preferred' : 'preferred_removed',
        vesselId: vesselKey,
        vesselName: metadata.vesselName || vesselMap?.get(vesselKey)?.name || '',
        by: metadata.by || pilotActor
    });
    if (!document.getElementById('policyHistoryModal')?.classList.contains('hidden')) {
        renderPolicyHistoryModal();
    }
    return true;
}

function setFacilityBlockedVessel(facilityId, vesselId, blocked, metadata = {}) {
    const facilityKey = String(facilityId || '').trim();
    const vesselKey = String(vesselId || '').trim();
    if (!facilityKey || !vesselKey) return false;
    if (!canManageVesselForActiveCompany(vesselKey)) return false;
    const current = getFacilityOperatorPrefs(facilityKey);
    const preferredSet = new Set(current.preferredVesselIds);
    const blockedSet = new Set(current.blockedVesselIds);
    if (blocked) {
        blockedSet.add(vesselKey);
        preferredSet.delete(vesselKey);
    } else {
        blockedSet.delete(vesselKey);
    }
    operatorPrefsByFacility[facilityKey] = {
        preferredVesselIds: [...preferredSet],
        blockedVesselIds: [...blockedSet]
    };
    saveOperatorPrefs();
    pushFacilityOperatorPolicyAudit(facilityKey, {
        action: blocked ? 'blocked' : 'blocked_removed',
        vesselId: vesselKey,
        vesselName: metadata.vesselName || vesselMap?.get(vesselKey)?.name || '',
        by: metadata.by || pilotActor
    });
    if (!document.getElementById('policyHistoryModal')?.classList.contains('hidden')) {
        renderPolicyHistoryModal();
    }
    return true;
}

function formatPolicyAuditSummary(facilityId) {
    const audit = getFacilityOperatorPolicyAudit(facilityId);
    if (!audit.lastUpdatedAt) return 'Ingen policy-endringer registrert';
    const when = new Date(audit.lastUpdatedAt);
    const whenText = Number.isNaN(when.getTime())
        ? String(audit.lastUpdatedAt)
        : when.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
    const actionText = formatPolicyAuditAction(audit.lastAction);
    const recent = (audit.history || []).slice(0, 3).map((entry) => {
        const name = entry.vesselName || entry.vesselId || 'ukjent båt';
        const label = formatPolicyAuditAction(entry.action);
        return `${name}: ${label}`;
    }).join(' · ');
    return `Sist: ${whenText} (${audit.lastUpdatedBy || 'ukjent'}) · ${actionText}${recent ? ` · Historikk: ${recent}` : ''}`;
}

function formatPolicyAuditAction(action) {
    const actionLabels = {
        preferred: 'satte som foretrukket',
        preferred_removed: 'fjernet preferanse',
        blocked: 'blokkerte operatør',
        blocked_removed: 'fjernet blokkering',
        import_policy: 'importerte policy',
        batch_resync: 'batch re-sync av jobber',
        'batch-resync': 'batch re-sync av jobber'
    };
    return actionLabels[action] || action || 'oppdaterte policy';
}

function loadInteropActivity() {
    try {
        const raw = JSON.parse(localStorage.getItem(INTEROP_ACTIVITY_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
        return {};
    }
}

function saveInteropActivity(activity) {
    try {
        localStorage.setItem(INTEROP_ACTIVITY_KEY, JSON.stringify(activity || {}));
    } catch (_) {
        // ignore localStorage issues in demo mode
    }
}

function setInteropActivity(kind, details = {}) {
    const selected = getSelectedFacility();
    const key = String(selected?.id || '').trim();
    if (!key) return;
    const activity = loadInteropActivity();
    activity[key] = {
        kind: String(kind || ''),
        at: new Date().toISOString(),
        by: pilotActor,
        ...details
    };
    saveInteropActivity(activity);
    renderInteropActivityMeta();
}

function renderInteropActivityMeta() {
    const meta = document.getElementById('interopActivityMeta');
    if (!meta) return;
    const selected = getSelectedFacility();
    if (!selected) {
        meta.textContent = 'Siste interoperabilitet: -';
        return;
    }
    const activity = loadInteropActivity()[String(selected.id || '')];
    if (!activity?.at) {
        meta.textContent = 'Siste interoperabilitet: ingen registrert aktivitet';
        return;
    }
    const when = new Date(activity.at);
    const whenText = Number.isNaN(when.getTime())
        ? String(activity.at)
        : when.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
    const detailText = activity.fileName
        ? ` · ${activity.fileName}`
        : activity.summary
        ? ` · ${activity.summary}`
        : '';
    meta.textContent = `Siste interoperabilitet: ${activity.kind || 'aktivitet'} ${whenText} (${activity.by || 'ukjent'})${detailText}`;
}

function normalizeVesselIdList(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function parsePolicyImportPayload(raw) {
    const parsed = JSON.parse(String(raw || ''));
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Ugyldig JSON-innhold.');
    }

    const policy = parsed.policy && typeof parsed.policy === 'object'
        ? parsed.policy
        : parsed;

    const preferredVesselIds = normalizeVesselIdList(policy.preferredVesselIds);
    const blockedVesselIds = normalizeVesselIdList(policy.blockedVesselIds)
        .filter((id) => !preferredVesselIds.includes(id));

    return {
        sourceFacilityId: String(parsed?.facility?.id || '').trim(),
        preferredVesselIds,
        blockedVesselIds
    };
}

async function importPolicyForSelectedFacilityFromFile(file) {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før policy import.');
        return;
    }
    if (!file) return;

    try {
        const text = await file.text();
        const payload = parsePolicyImportPayload(text);

        if (payload.sourceFacilityId && payload.sourceFacilityId !== String(selected.id)) {
            showToast('warning', 'Anlegg mismatch', `Filen er for anlegg ${payload.sourceFacilityId}, men valgt anlegg er ${selected.id}.`);
            return;
        }

        const before = getFacilityOperatorPrefs(selected.id);
        const preferredScoped = payload.preferredVesselIds.filter((vesselId) => canManageVesselForActiveCompany(vesselId));
        const blockedScoped = payload.blockedVesselIds
            .filter((vesselId) => canManageVesselForActiveCompany(vesselId))
            .filter((vesselId) => !preferredScoped.includes(vesselId));

        operatorPrefsByFacility[String(selected.id)] = {
            preferredVesselIds: preferredScoped,
            blockedVesselIds: blockedScoped
        };
        saveOperatorPrefs();

        pushFacilityOperatorPolicyAudit(selected.id, {
            action: 'import_policy',
            vesselId: '',
            vesselName: '',
            by: pilotActor,
            fileName: file.name || '',
            before: {
                preferredVesselIds: [...(before.preferredVesselIds || [])],
                blockedVesselIds: [...(before.blockedVesselIds || [])]
            },
            after: {
                preferredVesselIds: [...preferredScoped],
                blockedVesselIds: [...blockedScoped]
            }
        });

        setInteropActivity('policy import', {
            fileName: file.name || '',
            summary: `${preferredScoped.length} foretrukne · ${blockedScoped.length} blokkerte`
        });

        renderAvailableBoats();
        renderJobsList();
        renderPolicyHistoryModal();
        showToast('success', 'Policy importert', `Importert fra ${file.name}: ${preferredScoped.length} foretrukne, ${blockedScoped.length} blokkerte.`);
    } catch (error) {
        showToast('error', 'Policy import feilet', error?.message || 'Ugyldig filformat.');
    }
}

function renderPolicyHistoryModal() {
    const list = document.getElementById('policyHistoryList');
    const meta = document.getElementById('policyHistoryMeta');
    if (!list || !meta) return;

    const selected = getSelectedFacility();
    if (!selected) {
        meta.textContent = 'Velg et anlegg for å se policy-historikk.';
        list.innerHTML = '<li class="empty">Ingen historikk tilgjengelig.</li>';
        return;
    }

    const audit = getFacilityOperatorPolicyAudit(selected.id);
    const entries = Array.isArray(audit.history) ? audit.history : [];
    meta.textContent = `${selected.name || selected.id} · ${entries.length} hendelser`;
    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">Ingen policy-endringer registrert ennå.</li>';
        return;
    }

    list.innerHTML = entries.map((entry) => {
        const atDate = new Date(entry.at || '');
        const atText = Number.isNaN(atDate.getTime())
            ? String(entry.at || '-')
            : atDate.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
        const actionText = formatPolicyAuditAction(entry.action);
        const subjectText = entry.action === 'batch-resync' || entry.action === 'batch_resync'
            ? `Jobber oppdatert: ${Number(entry.jobCount || 0)}`
            : (entry.vesselName || entry.vesselId || '-');
        const diffText = entry.before && entry.after
            ? ` · Før: ${JSON.stringify(entry.before)} · Etter: ${JSON.stringify(entry.after)}`
            : '';
        return `
            <li class="stack-card" style="margin-bottom:8px;">
                <div class="stack-card-title">${actionText}</div>
                <div class="stack-card-meta">${atText} · ${entry.by || 'ukjent bruker'}</div>
                <div class="stack-card-meta">${subjectText}${diffText}</div>
            </li>
        `;
    }).join('');
}

function openPolicyHistoryModal() {
    const modal = document.getElementById('policyHistoryModal');
    if (!modal) return;
    renderPolicyHistoryModal();
    modal.classList.remove('hidden');
}

function closePolicyHistoryModal() {
    const modal = document.getElementById('policyHistoryModal');
    if (!modal) return;
    modal.classList.add('hidden');
}

function undoLastPolicyChangeForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før du angrer policy-endring.');
        return;
    }
    const audit = getFacilityOperatorPolicyAudit(selected.id);
    const entry = (audit.history || []).find((item) => ['preferred', 'preferred_removed', 'blocked', 'blocked_removed'].includes(item?.action));
    if (!entry) {
        showToast('info', 'Ingen endringer å angre', 'Fant ingen policy-endring som kan angres.');
        return;
    }
    const vesselId = String(entry.vesselId || '');
    if (!vesselId) {
        showToast('warning', 'Manglende data', 'Kunne ikke angre fordi båtid mangler i historikken.');
        return;
    }
    if (!ensureCanManageVessel(vesselId, 'Angre policy')) {
        return;
    }

    if (entry.action === 'preferred') {
        setFacilityPreferredVessel(selected.id, vesselId, false, { vesselName: entry.vesselName || '', by: `${pilotActor}:undo` });
    } else if (entry.action === 'preferred_removed') {
        setFacilityPreferredVessel(selected.id, vesselId, true, { vesselName: entry.vesselName || '', by: `${pilotActor}:undo` });
    } else if (entry.action === 'blocked') {
        setFacilityBlockedVessel(selected.id, vesselId, false, { vesselName: entry.vesselName || '', by: `${pilotActor}:undo` });
    } else if (entry.action === 'blocked_removed') {
        setFacilityBlockedVessel(selected.id, vesselId, true, { vesselName: entry.vesselName || '', by: `${pilotActor}:undo` });
    }

    showToast('success', 'Policy endring angret', `${entry.vesselName || vesselId}: ${formatPolicyAuditAction(entry.action)} ble angret.`);
    renderAvailableBoats();
    renderJobsList();
    renderPolicyHistoryModal();
}

function getNextJobStatuses(currentStatus) {
    return JOB_STATUS_TRANSITIONS[currentStatus] || [];
}

function exportOperatorPolicyAuditForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før du eksporterer policyhistorikk.');
        return;
    }

    const prefs = getFacilityOperatorPrefs(selected.id);
    const audit = getFacilityOperatorPolicyAudit(selected.id);
    const relatedJobs = listJobs(selected.id).map((job) => ({
        id: job.id,
        status: job.status,
        jobType: job.jobType,
        startDate: job.startDate,
        endDate: job.endDate,
        preferredVesselIds: Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds : [],
        blockedVesselIds: Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds : []
    }));

    const payload = {
        exportedAt: new Date().toISOString(),
        actor: pilotActor,
        facility: {
            id: selected.id,
            name: selected.name,
            code: selected.localityNo || selected.code || ''
        },
        policy: {
            preferredVesselIds: prefs.preferredVesselIds,
            blockedVesselIds: prefs.blockedVesselIds
        },
        audit,
        relatedJobs
    };

    downloadPolicyAuditPayload(
        payload,
        `policy_audit_${String(selected.name || selected.id || 'facility').toLowerCase().replace(/[^a-z0-9\-]+/g, '_').replace(/^_+|_+$/g, '') || 'facility'}_${new Date().toISOString().slice(0, 10)}.json`
    );
}

function downloadPolicyAuditPayload(payload, fileName) {
    try {
        const text = JSON.stringify(payload, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        showToast('success', 'Eksport fullført', `Lagret ${fileName}`);
    } catch (error) {
        showToast('error', 'Eksport feilet', error?.message || 'Kunne ikke eksportere policyhistorikk.');
    }
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r?\n|\r/g, ' ').trim();
    if (/[,";]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function buildCsv(rows, columns) {
    const header = columns.map((col) => csvEscape(col.header)).join(',');
    const body = rows.map((row) => columns.map((col) => csvEscape(row[col.key])).join(',')).join('\n');
    return `${header}\n${body}`;
}

function safeFileSlug(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'facility';
}

function formatDateOrRaw(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
}

function getVisibleBoatEntriesForExport(selected, startKey, endKey, options = {}) {
    const operatorPrefs = getFacilityOperatorPrefs(selected?.id);
    const preferredSet = new Set(operatorPrefs.preferredVesselIds.map(String));
    const blockedSet = new Set(operatorPrefs.blockedVesselIds.map(String));
    const boatZoneRadiusKm = Number(document.getElementById('boatZoneRadius')?.value || 30) || 30;
    const typeFilter = normalizeAsciiText(document.getElementById('boatTypeFilter')?.value || '');
    const boatSearchText = normalizeAsciiText(document.getElementById('boatSearchInput')?.value || '');
    const boatPolicyFilter = String(document.getElementById('boatPolicyFilter')?.value || 'all').toLowerCase();
    const onlyAvailable = document.getElementById('onlyAvailableBoats')?.checked === true;
    const aisByMmsi = new Map(
        nearbyAisVessels
            .map((item) => {
                const mmsi = String(item?.vessel?.mmsi || '').trim();
                return mmsi ? [mmsi, item] : null;
            })
            .filter(Boolean)
    );

    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 25;

    const boats = (profile?.vessels || [])
        .map((vessel) => {
            const mmsi = String(vessel.mmsi || '').trim();
            const planned = getVesselPlannedZoneAvailabilityForRange(vessel, selected, startKey, endKey, boatZoneRadiusKm);
            const aisNow = mmsi ? aisByMmsi.get(mmsi) : null;
            return {
                vessel,
                planned,
                aisNow,
                isPreferred: preferredSet.has(String(vessel.id)),
                isBlocked: blockedSet.has(String(vessel.id))
            };
        })
        .filter(Boolean)
        .filter((item) => {
            const mode = getManualBoatAvailability(item.vessel?.id);
            if (mode === 'available') return true;
            if (mode === 'unavailable') return onlyAvailable ? false : true;
            if (!onlyAvailable) return true;
            if (item.planned && item.planned.intervalFit === true) return true;
            const aisDistance = Number(item.aisNow?.distanceKm);
            if (Number.isFinite(aisDistance) && aisDistance <= boatZoneRadiusKm) return true;
            return false;
        })
        .filter((item) => {
            if (boatPolicyFilter === 'preferred') return item.isPreferred === true;
            if (boatPolicyFilter === 'blocked') return item.isBlocked === true;
            if (boatPolicyFilter === 'open') return item.isPreferred !== true && item.isBlocked !== true;
            return true;
        })
        .filter((item) => {
            if (!boatSearchText) return true;
            const name = normalizeAsciiText(item.vessel?.name || '');
            const vesselType = normalizeAsciiText(item.vessel?.type || '');
            const vesselCategory = normalizeAsciiText(getVesselCategory(item.vessel));
            const mmsi = normalizeAsciiText(item.vessel?.mmsi || '');
            return name.includes(boatSearchText)
                || vesselType.includes(boatSearchText)
                || vesselCategory.includes(boatSearchText)
                || mmsi.includes(boatSearchText);
        })
        .filter((item) => {
            if (!typeFilter) return true;
            const name = normalizeAsciiText(item.vessel?.name || '');
            const vesselType = normalizeAsciiText(item.vessel?.type || '');
            const vesselCategory = normalizeAsciiText(getVesselCategory(item.vessel));
            return name.includes(typeFilter) || vesselType.includes(typeFilter) || vesselCategory.includes(typeFilter);
        })
        .sort((a, b) => {
            if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
            const aScore = a.planned ? (a.planned.intervalFit ? 0 : a.planned.freeCoveredDays > 0 ? 1 : 2) : 3;
            const bScore = b.planned ? (b.planned.intervalFit ? 0 : b.planned.freeCoveredDays > 0 ? 1 : 2) : 3;
            if (aScore !== bScore) return aScore - bScore;
            const aDist = a.planned?.nearestDistanceKm ?? a.aisNow?.distanceKm ?? Infinity;
            const bDist = b.planned?.nearestDistanceKm ?? b.aisNow?.distanceKm ?? Infinity;
            if (aDist !== bDist) return aDist - bDist;
            return String(a.vessel?.name || '').localeCompare(String(b.vessel?.name || ''));
        });

    if (limit > 0) return boats.slice(0, limit);
    return boats;
}

function exportJobsCsvForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før du eksporterer jobber.');
        return;
    }

    const jobs = listJobs(selected.id).slice().sort((a, b) => {
        const aStart = new Date(`${a.startDate || ''}T00:00:00`).getTime();
        const bStart = new Date(`${b.startDate || ''}T00:00:00`).getTime();
        const aValid = Number.isFinite(aStart);
        const bValid = Number.isFinite(bStart);
        if (aValid && bValid && aStart !== bStart) return aStart - bStart;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });

    if (jobs.length === 0) {
        showToast('info', 'Ingen jobber', 'Fant ingen jobber å eksportere for valgt anlegg.');
        return;
    }

    const rows = jobs.map((job) => {
        const timeline = Array.isArray(job.statusTimeline) ? job.statusTimeline : [];
        const lastTransition = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        return {
            facilityId: selected.id,
            facilityName: selected.name || '',
            jobId: job.id || '',
            jobType: job.jobType || '',
            status: JOB_STATUS_LABELS[job.status] || job.status || '',
            startDate: job.startDate || '',
            endDate: job.endDate || '',
            priority: job.priority || '',
            estimatedHours: job.estimatedHours || '',
            proposalCount: Array.isArray(job.proposals) ? job.proposals.length : 0,
            preferredVesselCount: Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.length : 0,
            blockedVesselCount: Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.length : 0,
            policyDrift: hasPolicyDriftSinceJobCreated(job, getFacilityOperatorPrefs(selected.id)) ? 'Ja' : 'Nei',
            lastStatusAt: formatDateOrRaw(lastTransition?.at),
            lastStatusBy: lastTransition?.by || '',
            createdAt: formatDateOrRaw(job.createdAt),
            notes: job.notes || ''
        };
    });

    const columns = [
        { key: 'facilityId', header: 'Anlegg ID' },
        { key: 'facilityName', header: 'Anlegg' },
        { key: 'jobId', header: 'Jobb ID' },
        { key: 'jobType', header: 'Jobbtype' },
        { key: 'status', header: 'Status' },
        { key: 'startDate', header: 'Startdato' },
        { key: 'endDate', header: 'Sluttdato' },
        { key: 'priority', header: 'Prioritet' },
        { key: 'estimatedHours', header: 'Timer' },
        { key: 'proposalCount', header: 'Forslag' },
        { key: 'preferredVesselCount', header: 'Foretrukne i snapshot' },
        { key: 'blockedVesselCount', header: 'Blokkerte i snapshot' },
        { key: 'policyDrift', header: 'Policy drift' },
        { key: 'lastStatusAt', header: 'Status sist oppdatert' },
        { key: 'lastStatusBy', header: 'Status oppdatert av' },
        { key: 'createdAt', header: 'Opprettet' },
        { key: 'notes', header: 'Notat' }
    ];

    const csv = buildCsv(rows, columns);
    const fileName = `jobber_${safeFileSlug(selected.name || selected.id)}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(fileName, csv, 'text/csv;charset=utf-8');
    setInteropActivity('jobs csv export', { fileName, summary: `${rows.length} rader` });
    showToast('success', 'CSV eksportert', `Lagret ${fileName}`);
}

function buildJobsCsvForFacility(selected) {
    const jobs = listJobs(selected.id).slice().sort((a, b) => {
        const aStart = new Date(`${a.startDate || ''}T00:00:00`).getTime();
        const bStart = new Date(`${b.startDate || ''}T00:00:00`).getTime();
        const aValid = Number.isFinite(aStart);
        const bValid = Number.isFinite(bStart);
        if (aValid && bValid && aStart !== bStart) return aStart - bStart;
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });

    if (jobs.length === 0) {
        return { csv: '', count: 0 };
    }

    const rows = jobs.map((job) => {
        const timeline = Array.isArray(job.statusTimeline) ? job.statusTimeline : [];
        const lastTransition = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        return {
            facilityId: selected.id,
            facilityName: selected.name || '',
            jobId: job.id || '',
            jobType: job.jobType || '',
            status: JOB_STATUS_LABELS[job.status] || job.status || '',
            startDate: job.startDate || '',
            endDate: job.endDate || '',
            priority: job.priority || '',
            estimatedHours: job.estimatedHours || '',
            proposalCount: Array.isArray(job.proposals) ? job.proposals.length : 0,
            preferredVesselCount: Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.length : 0,
            blockedVesselCount: Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.length : 0,
            policyDrift: hasPolicyDriftSinceJobCreated(job, getFacilityOperatorPrefs(selected.id)) ? 'Ja' : 'Nei',
            lastStatusAt: formatDateOrRaw(lastTransition?.at),
            lastStatusBy: lastTransition?.by || '',
            createdAt: formatDateOrRaw(job.createdAt),
            notes: job.notes || ''
        };
    });

    const columns = [
        { key: 'facilityId', header: 'Anlegg ID' },
        { key: 'facilityName', header: 'Anlegg' },
        { key: 'jobId', header: 'Jobb ID' },
        { key: 'jobType', header: 'Jobbtype' },
        { key: 'status', header: 'Status' },
        { key: 'startDate', header: 'Startdato' },
        { key: 'endDate', header: 'Sluttdato' },
        { key: 'priority', header: 'Prioritet' },
        { key: 'estimatedHours', header: 'Timer' },
        { key: 'proposalCount', header: 'Forslag' },
        { key: 'preferredVesselCount', header: 'Foretrukne i snapshot' },
        { key: 'blockedVesselCount', header: 'Blokkerte i snapshot' },
        { key: 'policyDrift', header: 'Policy drift' },
        { key: 'lastStatusAt', header: 'Status sist oppdatert' },
        { key: 'lastStatusBy', header: 'Status oppdatert av' },
        { key: 'createdAt', header: 'Opprettet' },
        { key: 'notes', header: 'Notat' }
    ];

    return { csv: buildCsv(rows, columns), count: rows.length };
}

function exportVisibleBoatsCsvForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før du eksporterer båter.');
        return;
    }

    const { startKey, endKey } = getActivePlanningRange();
    const entries = getVisibleBoatEntriesForExport(selected, startKey, endKey, { limit: 0 });
    if (entries.length === 0) {
        showToast('info', 'Ingen båter', 'Fant ingen båter i gjeldende filter/range.');
        return;
    }

    const rows = entries.map((item) => {
        const vesselCompanyId = getVesselCompanyId(item.vessel);
        const vesselCompanyName = companyMap?.get(vesselCompanyId)?.name || vesselCompanyId || '';
        const category = getVesselCategory(item.vessel);
        const planned = item.planned;
        const aisNow = item.aisNow;
        const manualMode = getManualBoatAvailability(item.vessel?.id);
        const isManagedByActiveCompany = canManageVesselForActiveCompany(item.vessel);

        let availability = 'AIS nå';
        let canBook = 'Nei';
        let source = aisNow ? 'AIS' : 'Plan';
        let distanceKm = aisNow?.distanceKm ?? null;
        let coverageText = '';

        if (planned) {
            if (planned.intervalFit) {
                availability = 'Ledig hele perioden';
                canBook = 'Ja';
            } else if (planned.freeCoveredDays > 0) {
                availability = 'Delvis ledig i perioden';
            } else {
                availability = 'Opptatt i perioden';
            }
            source = planned.activeWindows.length > 0 ? 'Sonevindu' : 'Planlagt rute';
            distanceKm = planned.nearestDistanceKm;
            coverageText = `${planned.coveredDays}/${planned.totalDays}`;
        }

        if (manualMode === 'available') {
            availability = 'Manuelt ledig';
            canBook = 'Ja';
            source = source === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        } else if (manualMode === 'unavailable') {
            availability = 'Manuelt ikke ledig';
            canBook = 'Nei';
            source = source === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        }

        if (item.isBlocked) {
            availability = 'Blokkert operatør';
            canBook = 'Nei';
            source = 'Policy';
        }

        if (!isManagedByActiveCompany) {
            availability = 'Annet selskap (låst)';
            canBook = 'Nei';
            source = 'Selskapslås';
        }

        return {
            facilityId: selected.id,
            facilityName: selected.name || '',
            rangeStart: startKey,
            rangeEnd: endKey,
            vesselId: item.vessel?.id || '',
            vesselName: item.vessel?.name || '',
            mmsi: item.vessel?.mmsi || '',
            category,
            companyId: vesselCompanyId,
            companyName: vesselCompanyName,
            preferred: item.isPreferred ? 'Ja' : 'Nei',
            blocked: item.isBlocked ? 'Ja' : 'Nei',
            manualMode,
            availability,
            canBook,
            source,
            distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm).toFixed(1) : '',
            coverageDays: coverageText
        };
    });

    const columns = [
        { key: 'facilityId', header: 'Anlegg ID' },
        { key: 'facilityName', header: 'Anlegg' },
        { key: 'rangeStart', header: 'Fra dato' },
        { key: 'rangeEnd', header: 'Til dato' },
        { key: 'vesselId', header: 'Båt ID' },
        { key: 'vesselName', header: 'Båt' },
        { key: 'mmsi', header: 'MMSI' },
        { key: 'category', header: 'Kategori' },
        { key: 'companyId', header: 'Selskap ID' },
        { key: 'companyName', header: 'Selskap' },
        { key: 'preferred', header: 'Foretrukket' },
        { key: 'blocked', header: 'Blokkert' },
        { key: 'manualMode', header: 'Manuell modus' },
        { key: 'availability', header: 'Tilgjengelighet' },
        { key: 'canBook', header: 'Kan bookes' },
        { key: 'source', header: 'Kilde' },
        { key: 'distanceKm', header: 'Avstand km' },
        { key: 'coverageDays', header: 'Dekning dager' }
    ];

    const csv = buildCsv(rows, columns);
    const fileName = `bater_${safeFileSlug(selected.name || selected.id)}_${startKey}_til_${endKey}.csv`;
    downloadTextFile(fileName, csv, 'text/csv;charset=utf-8');
    setInteropActivity('boats csv export', { fileName, summary: `${rows.length} rader` });
    showToast('success', 'CSV eksportert', `Lagret ${fileName}`);
}

function buildVisibleBoatsCsvForSelectedFacility(selected) {
    const { startKey, endKey } = getActivePlanningRange();
    const entries = getVisibleBoatEntriesForExport(selected, startKey, endKey, { limit: 0 });
    if (entries.length === 0) {
        return { csv: '', count: 0, startKey, endKey };
    }

    const rows = entries.map((item) => {
        const vesselCompanyId = getVesselCompanyId(item.vessel);
        const vesselCompanyName = companyMap?.get(vesselCompanyId)?.name || vesselCompanyId || '';
        const category = getVesselCategory(item.vessel);
        const planned = item.planned;
        const aisNow = item.aisNow;
        const manualMode = getManualBoatAvailability(item.vessel?.id);
        const isManagedByActiveCompany = canManageVesselForActiveCompany(item.vessel);

        let availability = 'AIS nå';
        let canBook = 'Nei';
        let source = aisNow ? 'AIS' : 'Plan';
        let distanceKm = aisNow?.distanceKm ?? null;
        let coverageText = '';

        if (planned) {
            if (planned.intervalFit) {
                availability = 'Ledig hele perioden';
                canBook = 'Ja';
            } else if (planned.freeCoveredDays > 0) {
                availability = 'Delvis ledig i perioden';
            } else {
                availability = 'Opptatt i perioden';
            }
            source = planned.activeWindows.length > 0 ? 'Sonevindu' : 'Planlagt rute';
            distanceKm = planned.nearestDistanceKm;
            coverageText = `${planned.coveredDays}/${planned.totalDays}`;
        }

        if (manualMode === 'available') {
            availability = 'Manuelt ledig';
            canBook = 'Ja';
            source = source === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        } else if (manualMode === 'unavailable') {
            availability = 'Manuelt ikke ledig';
            canBook = 'Nei';
            source = source === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        }

        if (item.isBlocked) {
            availability = 'Blokkert operatør';
            canBook = 'Nei';
            source = 'Policy';
        }

        if (!isManagedByActiveCompany) {
            availability = 'Annet selskap (låst)';
            canBook = 'Nei';
            source = 'Selskapslås';
        }

        return {
            facilityId: selected.id,
            facilityName: selected.name || '',
            rangeStart: startKey,
            rangeEnd: endKey,
            vesselId: item.vessel?.id || '',
            vesselName: item.vessel?.name || '',
            mmsi: item.vessel?.mmsi || '',
            category,
            companyId: vesselCompanyId,
            companyName: vesselCompanyName,
            preferred: item.isPreferred ? 'Ja' : 'Nei',
            blocked: item.isBlocked ? 'Ja' : 'Nei',
            manualMode,
            availability,
            canBook,
            source,
            distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm).toFixed(1) : '',
            coverageDays: coverageText
        };
    });

    const columns = [
        { key: 'facilityId', header: 'Anlegg ID' },
        { key: 'facilityName', header: 'Anlegg' },
        { key: 'rangeStart', header: 'Fra dato' },
        { key: 'rangeEnd', header: 'Til dato' },
        { key: 'vesselId', header: 'Båt ID' },
        { key: 'vesselName', header: 'Båt' },
        { key: 'mmsi', header: 'MMSI' },
        { key: 'category', header: 'Kategori' },
        { key: 'companyId', header: 'Selskap ID' },
        { key: 'companyName', header: 'Selskap' },
        { key: 'preferred', header: 'Foretrukket' },
        { key: 'blocked', header: 'Blokkert' },
        { key: 'manualMode', header: 'Manuell modus' },
        { key: 'availability', header: 'Tilgjengelighet' },
        { key: 'canBook', header: 'Kan bookes' },
        { key: 'source', header: 'Kilde' },
        { key: 'distanceKm', header: 'Avstand km' },
        { key: 'coverageDays', header: 'Dekning dager' }
    ];

    return { csv: buildCsv(rows, columns), count: rows.length, startKey, endKey };
}

function exportInteropPackForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før du eksporterer pakke.');
        return;
    }

    const day = new Date().toISOString().slice(0, 10);
    const slug = safeFileSlug(selected.name || selected.id);

    const jobsData = buildJobsCsvForFacility(selected);
    const boatsData = buildVisibleBoatsCsvForSelectedFacility(selected);
    const prefs = getFacilityOperatorPrefs(selected.id);
    const audit = getFacilityOperatorPolicyAudit(selected.id);

    if (jobsData.csv) {
        downloadTextFile(`pakke_${slug}_${day}_jobber.csv`, jobsData.csv, 'text/csv;charset=utf-8');
    }
    if (boatsData.csv) {
        downloadTextFile(`pakke_${slug}_${day}_bater.csv`, boatsData.csv, 'text/csv;charset=utf-8');
    }

    const policyPayload = {
        exportedAt: new Date().toISOString(),
        actor: pilotActor,
        facility: {
            id: selected.id,
            name: selected.name,
            code: selected.localityNo || selected.code || ''
        },
        policy: {
            preferredVesselIds: prefs.preferredVesselIds,
            blockedVesselIds: prefs.blockedVesselIds
        },
        audit
    };
    downloadTextFile(
        `pakke_${slug}_${day}_policy.json`,
        JSON.stringify(policyPayload, null, 2),
        'application/json;charset=utf-8'
    );

    const readme = [
        'Pilot Lite eksportpakke',
        `Dato: ${new Date().toLocaleString('nb-NO')}`,
        `Anlegg: ${selected.name || selected.id}`,
        '',
        'Filer i pakken:',
        `- pakke_${slug}_${day}_jobber.csv (${jobsData.count} rader)`,
        `- pakke_${slug}_${day}_bater.csv (${boatsData.count} rader)`,
        `- pakke_${slug}_${day}_policy.json`,
        '',
        'Tips:',
        '- CSV-filer åpnes i Excel, LibreOffice eller interne tabellverktøy.',
        '- For kalenderintegrasjon: bruk Kalender Lite > Eksporter iCal (.ics) eller Kopier iCal.'
    ].join('\n');
    downloadTextFile(`pakke_${slug}_${day}_README.txt`, readme, 'text/plain;charset=utf-8');

    setInteropActivity('interop pack export', {
        fileName: `pakke_${slug}_${day}_*`,
        summary: `${jobsData.count} jobber · ${boatsData.count} båter`
    });

    showToast(
        'success',
        'Eksportpakke klar',
        `Lagret pakke for ${selected.name || selected.id}: ${jobsData.count} jobber, ${boatsData.count} båter.`
    );
}

function exportOperatorPolicyAuditAllFacilities() {
    const facilities = getFacilityCatalog();
    if (!Array.isArray(facilities) || facilities.length === 0) {
        showToast('warning', 'Ingen anlegg', 'Fant ingen anlegg å eksportere.');
        return;
    }

    const entries = facilities.map((facility) => {
        const facilityId = facility?.id;
        const prefs = getFacilityOperatorPrefs(facilityId);
        const audit = getFacilityOperatorPolicyAudit(facilityId);
        const relatedJobs = listJobs(facilityId).map((job) => ({
            id: job.id,
            status: job.status,
            jobType: job.jobType,
            startDate: job.startDate,
            endDate: job.endDate,
            preferredVesselIds: Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds : [],
            blockedVesselIds: Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds : []
        }));
        return {
            facility: {
                id: facilityId,
                name: facility?.name || '',
                code: facility?.localityNo || facility?.code || ''
            },
            policy: {
                preferredVesselIds: prefs.preferredVesselIds,
                blockedVesselIds: prefs.blockedVesselIds
            },
            audit,
            relatedJobs
        };
    });

    const payload = {
        exportedAt: new Date().toISOString(),
        actor: pilotActor,
        facilityCount: entries.length,
        entries
    };

    downloadPolicyAuditPayload(payload, `policy_audit_all_facilities_${new Date().toISOString().slice(0, 10)}.json`);
}

function hasPolicyDriftSinceJobCreated(job, currentPrefs) {
    const currentPreferred = new Set((currentPrefs?.preferredVesselIds || []).map((id) => String(id)));
    const currentBlocked = new Set((currentPrefs?.blockedVesselIds || []).map((id) => String(id)));
    const jobPreferred = new Set((Array.isArray(job?.preferredVesselIds) ? job.preferredVesselIds : []).map((id) => String(id)));
    const jobBlocked = new Set((Array.isArray(job?.blockedVesselIds) ? job.blockedVesselIds : []).map((id) => String(id)));

    if (currentPreferred.size !== jobPreferred.size || currentBlocked.size !== jobBlocked.size) return true;
    for (const id of currentPreferred) if (!jobPreferred.has(id)) return true;
    for (const id of currentBlocked) if (!jobBlocked.has(id)) return true;
    return false;
}

function dateRangesOverlap(startA, endA, startB, endB) {
    const aStart = new Date(`${startA}T00:00:00`);
    const aEnd = new Date(`${endA || startA}T23:59:59`);
    const bStart = new Date(`${startB}T00:00:00`);
    const bEnd = new Date(`${endB || startB}T23:59:59`);
    if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value.getTime()))) return false;
    return aStart <= bEnd && aEnd >= bStart;
}

function getDriftedJobsForFacilityRange(facilityId, startDateKey, endDateKey = startDateKey) {
    const prefs = getFacilityOperatorPrefs(facilityId);
    return listJobs(facilityId).filter((job) => {
        const status = String(job?.status || '').toLowerCase();
        if (status === 'completed' || status === 'fullført' || status === 'cancelled' || status === 'avbrutt') return false;
        if (!dateRangesOverlap(job?.startDate, job?.endDate || job?.startDate, startDateKey, endDateKey)) return false;
        return hasPolicyDriftSinceJobCreated(job, prefs);
    });
}

function measureStep(stepName, fn, marks) {
    const start = performance.now();
    fn();
    marks.push({ step: stepName, ms: Number((performance.now() - start).toFixed(1)) });
}

function loadCalendarOverrides() {
    try {
        calendarEventOverrides = JSON.parse(localStorage.getItem(CALENDAR_OVERRIDES_KEY) || '{}');
        if (!calendarEventOverrides || typeof calendarEventOverrides !== 'object') {
            calendarEventOverrides = {};
        }
    } catch (_) {
        calendarEventOverrides = {};
    }
}

function saveCalendarOverrides() {
    try {
        localStorage.setItem(CALENDAR_OVERRIDES_KEY, JSON.stringify(calendarEventOverrides));
    } catch (_) {
    }
}

function loadPanelPrefs() {
    try {
        const raw = JSON.parse(localStorage.getItem(PANEL_PREFS_KEY) || '{}');
        if (raw && typeof raw === 'object') {
            panelPrefs.facilitiesCollapsed = raw.facilitiesCollapsed === true;
            panelPrefs.boatsCollapsed = raw.boatsCollapsed === true;
            panelPrefs.facilityCalendarCollapsed = raw.facilityCalendarCollapsed === true;
            panelPrefs.jobRequestCollapsed = raw.jobRequestCollapsed === true;
            panelPrefs.selectedInfoCollapsed = raw.selectedInfoCollapsed === true;
            panelPrefs.nearbyFacilitiesCollapsed = raw.nearbyFacilitiesCollapsed === true;
            panelPrefs.nearbyRiskCollapsed = raw.nearbyRiskCollapsed === true;
        }
    } catch (_) {
    }
}

function savePanelPrefs() {
    try {
        localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(panelPrefs));
    } catch (_) {
    }
}

function setPanelCollapsed(kind, collapsed) {
    const panelMap = {
        facilities: { bodyId: 'facilityPanelBody', btnId: 'toggleFacilitiesBtn', pref: 'facilitiesCollapsed' },
        boats: { bodyId: 'boatsPanelBody', btnId: 'toggleBoatsBtn', pref: 'boatsCollapsed' },
        facilityCalendar: { bodyId: 'facilityCalendarBody', btnId: 'toggleFacilityCalendarBtn', pref: 'facilityCalendarCollapsed' },
        jobRequest: { bodyId: 'jobRequestPanelBody', btnId: 'toggleJobRequestBtn', pref: 'jobRequestCollapsed' },
        selectedInfo: { bodyId: 'selectedInfoBody', btnId: 'toggleSelectedInfoBtn', pref: 'selectedInfoCollapsed' },
        nearbyFacilities: { bodyId: 'nearbyFacilitiesBody', btnId: 'toggleNearbyFacilitiesBtn', pref: 'nearbyFacilitiesCollapsed' },
        nearbyRisk: { bodyId: 'nearbyRiskBody', btnId: 'toggleNearbyRiskBtn', pref: 'nearbyRiskCollapsed' }
    };
    const spec = panelMap[kind];
    if (!spec) return;

    const body = document.getElementById(spec.bodyId);
    const btn = document.getElementById(spec.btnId);
    if (!body || !btn) return;
    body.style.display = collapsed ? 'none' : '';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.classList.toggle('collapsed', collapsed);
    panelPrefs[spec.pref] = collapsed;
    savePanelPrefs();
}

function applyPanelPrefs() {
    setPanelCollapsed('facilities', panelPrefs.facilitiesCollapsed);
    setPanelCollapsed('boats', panelPrefs.boatsCollapsed);
    setPanelCollapsed('facilityCalendar', panelPrefs.facilityCalendarCollapsed);
    setPanelCollapsed('jobRequest', panelPrefs.jobRequestCollapsed);
    setPanelCollapsed('selectedInfo', panelPrefs.selectedInfoCollapsed);
    setPanelCollapsed('nearbyFacilities', panelPrefs.nearbyFacilitiesCollapsed);
    setPanelCollapsed('nearbyRisk', panelPrefs.nearbyRiskCollapsed);
}

function updateSelectedDayLabel() {
    const label = document.getElementById('calSelectedDayLabel');
    const greenBtn = document.getElementById('calMarkGreenBtn');
    const redBtn = document.getElementById('calMarkRedBtn');
    const clearBtn = document.getElementById('calMarkClearBtn');
    if (!label || !greenBtn || !redBtn || !clearBtn) return;

    const hasSelection = Boolean(selectedCalendarDayKey);
    greenBtn.disabled = !hasSelection;
    redBtn.disabled = !hasSelection;
    clearBtn.disabled = !hasSelection;

    if (!hasSelection) {
        label.textContent = 'Valgt dag: -';
        return;
    }

    const [year, month, day] = selectedCalendarDayKey.split('-').map((v) => Number(v));
    const date = new Date(year, month, day);
    if (!Number.isFinite(date.getTime())) {
        label.textContent = `Valgt dag: ${selectedCalendarDayKey}`;
        return;
    }
    label.textContent = `Valgt dag: ${date.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function updateBookingSelectionMeta() {
    const label = document.getElementById('calBookingSelectionMeta');
    if (!label) return;

    const selected = getSelectedFacility();
    if (!selected) {
        label.textContent = 'Valgt for booking: -';
        return;
    }

    const dateKey = normalizeDateKey(selectedCalendarDayKey) || getActivePlanningDateKey();
    const requestTime = document.getElementById('boatRequestTime')?.value || '10:00';
    const opMinutes = Math.max(15, parseInt(document.getElementById('boatOperationMinutes')?.value || '60', 10) || 60);
    const hours = Math.floor(opMinutes / 60);
    const minutes = opMinutes % 60;
    const opText = `${hours > 0 ? `${hours}t ` : ''}${minutes}m`;
    const vesselName = selectedBoatForBookingId
        ? (vesselMap.get(selectedBoatForBookingId)?.name || selectedBoatForBookingId)
        : 'ikke valgt';
    label.textContent = `Valgt for booking: ${dateKey} kl ${requestTime} · Operasjonstid ${opText} · Båt ${vesselName}`;
}

function getFacilityActiveDemandCount(facilityId) {
    const jobs = listJobs(facilityId) || [];
    return jobs.filter((job) => {
        const status = String(job?.status || '').toLowerCase();
        return status !== String(JOB_STATUSES.CANCELLED || '').toLowerCase()
            && status !== String(JOB_STATUSES.COMPLETED || '').toLowerCase();
    }).length;
}

function getFacilityRecommendedDemandCount(facility) {
    if (!facility) return 0;
    const reminders = buildCalendarAutoReminders(facility) || [];
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const horizonKey = addDaysToDateKey(todayKey, 30) || todayKey;
    return reminders.filter((item) => {
        const suggestionType = String(item?.suggestionType || '').trim();
        if (!suggestionType) return false;
        const due = normalizeDateKey(item?.dateKey || item?.actionEndDate || item?.actionStartDate || '');
        if (!due) return false;
        return due >= todayKey && due <= horizonKey;
    }).length;
}

function resolveProfileVesselIdFromAis(vesselLike) {
    if (!vesselLike) return '';
    const byId = String(vesselLike.id || '').trim();
    if (byId && vesselMap?.has(byId)) return byId;
    const mmsi = String(vesselLike.mmsi || '').trim();
    if (!mmsi) return '';
    const match = (profile?.vessels || []).find((v) => String(v?.mmsi || '').trim() === mmsi);
    return String(match?.id || '').trim();
}

function setCalendarMarkForSelected(mark) {
    const selected = getSelectedFacility();
    if (!selected || !selectedCalendarDayKey) return;
    const storageKey = `facilityCalDays_${selected.id}`;
    let markedDays = {};
    try { markedDays = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) {}

    if (mark === 'green' || mark === 'red') {
        markedDays[selectedCalendarDayKey] = mark;
    } else {
        delete markedDays[selectedCalendarDayKey];
    }

    try { localStorage.setItem(storageKey, JSON.stringify(markedDays)); } catch (_) {}
    renderAll();
}

function setCalendarMarksForFacilityRange(facilityId, startDateKey, endDateKey, mark = 'green') {
    const facilityKey = String(facilityId || '').trim();
    const startKey = normalizeDateKey(startDateKey);
    const endKey = normalizeDateKey(endDateKey || startDateKey);
    if (!facilityKey || !startKey || !endKey) return 0;

    const fromDate = new Date(`${startKey}T00:00:00`);
    const toDate = new Date(`${endKey}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 0;

    const begin = fromDate.getTime() <= toDate.getTime() ? fromDate : toDate;
    const finish = fromDate.getTime() <= toDate.getTime() ? toDate : fromDate;
    const storageKey = `facilityCalDays_${facilityKey}`;

    let markedDays = {};
    try { markedDays = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { markedDays = {}; }

    let applied = 0;
    const cursor = new Date(begin);
    while (cursor.getTime() <= finish.getTime()) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        markedDays[key] = mark;
        applied += 1;
        cursor.setDate(cursor.getDate() + 1);
    }

    try { localStorage.setItem(storageKey, JSON.stringify(markedDays)); } catch (_) {}
    return applied;
}

function updateMarkModeUI() {
    const greenBtn = document.getElementById('calMarkGreenBtn');
    const redBtn = document.getElementById('calMarkRedBtn');
    if (greenBtn) greenBtn.classList.toggle('mark-active', activeMarkMode === 'green');
    if (redBtn) redBtn.classList.toggle('mark-active', activeMarkMode === 'red');
    const hint = document.getElementById('calMarkModeHint');
    if (hint) {
        hint.textContent = activeMarkMode
            ? `Klikk-modus aktiv: ${activeMarkMode === 'green' ? 'Ledig' : 'Opptatt'} – klikk på dager for å markere. Klikk knappen igjen for å avslutte.`
            : '';
        hint.style.display = activeMarkMode ? 'block' : 'none';
    }
}

function getCalendarEventKey(event) {
    if (event?.id) return String(event.id);
    return `${event?.facilityId || ''}|${event?.vesselId || ''}|${event?.start || ''}`;
}

function getFacilityCalendarEvents(facilityId) {
    const facilityKey = String(facilityId || '').trim();
    if (!facilityKey) return [];

    const profileEvents = (profile.calendarEvents || []).filter((event) => String(event?.facilityId || '') === facilityKey);
    let localStoreEvents = [];
    try {
        const rawStore = JSON.parse(localStorage.getItem(VESSEL_CALENDAR_STORE_KEY) || '{}');
        localStoreEvents = Object.values(rawStore || {})
            .flatMap((state) => Array.isArray(state?.events) ? state.events : [])
            .filter((event) => String(event?.facilityId || '') === facilityKey)
            .map((event) => ({
                ...event,
                status: event?.status || 'planned',
                source: event?.source || 'vessel-local'
            }));
    } catch (_) {
        localStoreEvents = [];
    }

    const merged = new Map();
    for (const event of [...profileEvents, ...localStoreEvents]) {
        const eventKey = String(event?.id || `${event?.facilityId || ''}|${event?.vesselId || ''}|${event?.start || event?.date || ''}`);
        if (!eventKey) continue;
        const start = event?.start || (event?.date ? `${event.date}T09:00:00` : null);
        if (!start) continue;
        const end = event?.end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
        merged.set(eventKey, {
            ...merged.get(eventKey),
            ...event,
            start,
            end,
            facilityId: facilityKey,
            status: event?.status || (event?.approved ? 'approved' : 'planned')
        });
    }

    return [...merged.values()].map((event) => {
        const key = getCalendarEventKey(event);
        const override = calendarEventOverrides[key] || {};
        return { ...event, ...override, _eventKey: key };
    });
}

async function syncCalendarActionToApi(event, action, payload = {}) {
    const proposalId = event?.proposalId || event?.id;
    const shouldSync = Boolean(event?.fromAPI || event?.proposalId);
    if (!shouldSync || !proposalId) return { ok: true, source: 'local' };

    const endpointMap = {
        approve: `${API_BASE}/api/route-proposals/${proposalId}/approve`,
        reject: `${API_BASE}/api/route-proposals/${proposalId}/reject`,
        alternative: `${API_BASE}/api/route-proposals/${proposalId}/suggest-alternative`
    };

    const bodyMap = {
        approve: { comment: payload.comment || '' },
        reject: { reason: payload.reason || 'Avvist av anlegget' },
        alternative: {
            alternative_date: payload.alternativeDate,
            alternative_time: payload.alternativeTime,
            comment: payload.comment || ''
        }
    };

    const response = await fetch(endpointMap[action], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bodyMap[action])
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return { ok: true, source: 'api' };
}

async function applyCalendarAction(event, action, payload = {}) {
    const key = event?._eventKey || getCalendarEventKey(event);
    const current = calendarEventOverrides[key] || {};

    if (action === 'undo') {
        delete calendarEventOverrides[key];
        saveCalendarOverrides();
        showToast('info', 'Endring angret', 'Kalenderhendelsen er tilbakestilt.');
        return;
    }

    if (action === 'approve') {
        await syncCalendarActionToApi(event, 'approve', { comment: '' });
        calendarEventOverrides[key] = { ...current, status: 'approved', approved: true };
        syncSharedVesselEventFromFacilityAction(event, { status: 'approved', approved: true });
        saveCalendarOverrides();
        showToast('success', 'Besøk godkjent', 'Planlagt besøk er markert som godkjent.');
        return;
    }

    if (action === 'reject') {
        const reason = String(payload.reason ?? event.comment ?? '').trim();
        await syncCalendarActionToApi(event, 'reject', { reason });
        calendarEventOverrides[key] = { ...current, status: 'rejected', approved: false, comment: reason };
        syncSharedVesselEventFromFacilityAction(event, { status: 'rejected', approved: false, comment: reason });
        saveCalendarOverrides();
        showToast('warning', 'Besøk avvist', 'Besøket er avvist og oppdatert i kalenderen.');
        return;
    }

    if (action === 'alternative') {
        const dateDefault = event.start ? new Date(event.start).toISOString().slice(0, 10) : '';
        const timeDefault = event.start ? new Date(event.start).toTimeString().slice(0, 5) : '08:00';
        const alternativeDate = String(payload.alternativeDate || event.alternativeDate || dateDefault).trim();
        const alternativeTime = String(payload.alternativeTime || event.alternativeTime || timeDefault).trim();
        const comment = String(payload.comment ?? event.comment ?? '').trim();
        if (!alternativeDate || !alternativeTime) {
            throw new Error('Alternativ dato og klokkeslett må fylles ut.');
        }

        await syncCalendarActionToApi(event, 'alternative', { alternativeDate, alternativeTime, comment });
        calendarEventOverrides[key] = {
            ...current,
            status: 'alternative_suggested',
            approved: false,
            alternativeDate,
            alternativeTime,
            comment
        };
        syncSharedVesselEventFromFacilityAction(event, {
            status: 'alternative_suggested',
            approved: false,
            alternativeDate,
            alternativeTime,
            comment
        });
        saveCalendarOverrides();
        showToast('info', 'Alternativ foreslått', `${alternativeDate} ${alternativeTime} er lagret som alternativ.`);
    }
}

function getVisitStatusLabel(statusRaw) {
    const value = String(statusRaw || '').toLowerCase();
    if (value === 'approved') return 'Godkjent';
    if (value === 'rejected') return 'Avvist';
    if (value === 'alternative_suggested') return 'Alternativ foreslått';
    return 'Planlagt';
}

function getVisitStatusClass(statusRaw) {
    const value = String(statusRaw || '').toLowerCase();
    if (value === 'approved') return 'ok';
    if (value === 'rejected') return 'danger';
    if (value === 'alternative_suggested') return 'warn';
    return 'neutral';
}

function isUnresolvedStatus(statusRaw) {
    const value = String(statusRaw || '').toLowerCase();
    return value === 'planned' || value === 'alternative_suggested';
}

function isNorwayCoordinate(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 57 && lat <= 72 && lon >= 3 && lon <= 32;
}

function getRiskBadgeText(facility) {
    const signals = getFacilityRiskSignals(facility);
    if (signals.infected) return 'Smittet';
    if (signals.liceHigh) return 'Lus';
    if (signals.ilaProtection) return 'ILA vernesone';
    if (signals.ilaSurveillance) return 'ILA overvåkning';
    return normalizeRiskLevel(signals.riskLevelRaw);
}

function getFacilityRiskBadges(facility) {
    const signals = getFacilityRiskSignals(facility);
    const badges = [];
    if (signals.infected) badges.push({ text: 'Smittet', cls: 'danger' });
    if (signals.ilaProtection) badges.push({ text: 'ILA vernesone', cls: 'ila-protect' });
    if (signals.ilaSurveillance) badges.push({ text: 'ILA overvåkning', cls: 'ila-survey' });
    if (signals.liceHigh) badges.push({ text: 'Lus', cls: 'lice' });
    if (badges.length === 0) {
        const text = getRiskBadgeText(facility);
        let cls = 'neutral';
        if (text === 'Ekstrem' || text === 'Høy') cls = 'warn';
        else if (text === 'Lav' || text === 'Moderat') cls = 'ok';
        badges.push({ text, cls });
    }
    return badges;
}

function normalizeRiskLevel(level) {
    const value = normalizeAsciiText(level || '');
    if (value === 'ekstrem' || value === 'extreme') return 'Ekstrem';
    if (value === 'hoy' || value === 'hoey' || value === 'high') return 'Høy';
    if (value === 'moderat' || value === 'moderate' || value === 'medium') return 'Moderat';
    if (value === 'lav' || value === 'low') return 'Lav';
    return 'Ukjent';
}

function isSevereRiskLevel(level) {
    const normalized = normalizeRiskLevel(level);
    return normalized === 'Høy' || normalized === 'Ekstrem';
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeAsciiText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getVesselCategory(vessel) {
    const explicit = String(vessel?.category || vessel?.type || '').trim();
    if (explicit) return explicit;

    const name = normalizeAsciiText(vessel?.name || '');
    if (!name) return 'Frøy-kandidat';
    if (/(leader|master|saga|harvest|nordkapp)/.test(name)) return 'Brønnbåt';
    if (/(supporter|supplier|server|bas|skuld|njord|neptun|fighter|challenger|stadt|hild|junior|valkyrien)/.test(name)) return 'Servicefartøy';
    if (/(ferga|banken|trans|fart|sprint|vik|vind|hav|mann|gutt|lys|lin|brand)/.test(name)) return 'Transport/logistikk';
    return 'Frøy-kandidat';
}

function getAvailabilityWindowOptions(vessel) {
    const category = normalizeAsciiText(getVesselCategory(vessel));
    const vesselType = normalizeAsciiText(vessel?.type || '');
    const vesselName = normalizeAsciiText(vessel?.name || '');

    if (category.includes('bronnbat') || vesselType.includes('bronnbat')) {
        return { beforeHours: 8, afterHours: 24, mergeRadiusKm: 28, zoneRadiusKm: 24 };
    }
    if (category.includes('service') || vesselType.includes('service')) {
        return { beforeHours: 12, afterHours: 36, mergeRadiusKm: 45, zoneRadiusKm: 35 };
    }
    if (category.includes('inspeksjon') || vesselType.includes('dykk') || vesselName.includes('dykk')) {
        return { beforeHours: 18, afterHours: 60, mergeRadiusKm: 70, zoneRadiusKm: 55 };
    }
    return { beforeHours: 12, afterHours: 36, mergeRadiusKm: 45, zoneRadiusKm: 35 };
}

function getVesselCalendarStoreEvents(vesselId) {
    if (!vesselId) return [];
    try {
        const raw = JSON.parse(localStorage.getItem(VESSEL_CALENDAR_STORE_KEY) || '{}');
        const vesselState = raw?.[String(vesselId)] || {};
        return Array.isArray(vesselState.events) ? vesselState.events : [];
    } catch (_) {
        return [];
    }
}

function getMergedVesselEvents(vesselId) {
    const profileEvents = (profile?.calendarEvents || []).filter((event) => String(event.vesselId || '') === String(vesselId || ''));
    const localEvents = getVesselCalendarStoreEvents(vesselId);
    const merged = new Map();
    for (const event of [...profileEvents, ...localEvents]) {
        const start = event?.start || (event?.date ? `${event.date}T09:00:00` : null);
        const end = event?.end || (start ? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString() : start);
        const normalizedEvent = { ...event, start, end };
        const key = String(event?.id || `${event?.vesselId || vesselId}|${event?.facilityId || ''}|${event?.start || event?.date || ''}`);
        if (!key.trim()) continue;
        merged.set(key, normalizedEvent);
    }
    return [...merged.values()];
}

function toValidNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function facilityMergeKey(facility) {
    const localityNo = String(facility?.localityNo ?? '').trim();
    if (localityNo) return `loc:${localityNo}`;
    return `name:${normalizeName(facility?.name)}|${normalizeName(facility?.municipality)}`;
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

    const companyNameNorm = normalizeAsciiText(companyMap.get(activeCompanyId)?.name || activeCompanyId);
    if (!companyNameNorm) return false;

    if (companyNameNorm.includes('masoval')) {
        return holderText.includes('masoval');
    }

    const tokens = companyNameNorm.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
    return tokens.some((token) => holderText.includes(token));
}

function normalizeApiFacilityForCompanyScope(facility) {
    const localityNo = String(facility?.localityNo ?? '').trim();
    const fdirLat = toValidNumber(facility?.fdir?.latitude);
    const fdirLon = toValidNumber(facility?.fdir?.longitude);
    const apiLat = toValidNumber(facility?.latitude);
    const apiLon = toValidNumber(facility?.longitude);

    return {
        ...facility,
        id: String(facility?.id || (localityNo ? `loc_${localityNo}` : `api_${normalizeName(facility?.name || 'facility')}`)),
        name: repairMojibakeText(facility?.name || ''),
        municipality: repairMojibakeText(facility?.municipality || ''),
        localityNo: localityNo || facility?.localityNo || null,
        latitude: fdirLat ?? apiLat,
        longitude: fdirLon ?? apiLon,
        companyId: activeCompanyId || facility?.companyId,
        companyName: repairMojibakeText(companyMap.get(activeCompanyId)?.name || facility?.companyName || ''),
        tags: Array.isArray(facility?.tags) ? facility.tags : []
    };
}

function normalizeFacilityForCatalog(facility) {
    const localityNo = String(facility?.localityNo ?? facility?.locality_no ?? '').trim();
    const fdirLat = toValidNumber(facility?.fdir?.latitude);
    const fdirLon = toValidNumber(facility?.fdir?.longitude);
    const apiLat = toValidNumber(facility?.latitude);
    const apiLon = toValidNumber(facility?.longitude);

    return {
        ...facility,
        id: String(facility?.id || (localityNo ? `loc_${localityNo}` : `api_${normalizeName(facility?.name || 'facility')}`)),
        name: repairMojibakeText(facility?.name || ''),
        municipality: repairMojibakeText(facility?.municipality || ''),
        localityNo: localityNo || facility?.localityNo || null,
        latitude: fdirLat ?? apiLat,
        longitude: fdirLon ?? apiLon,
        production_type: repairMojibakeText(String(facility?.production_type || facility?.productionType || facility?.fdir?.production_type || facility?.fdir?.species || '')),
        companyId: String(facility?.companyId || '').trim() || 'nearby-external',
        tags: Array.isArray(facility?.tags) ? facility.tags : []
    };
}

function mergeFacilityCatalog(baseFacilities, incomingFacilities) {
    const merged = [];
    const keyToIndex = new Map();

    (baseFacilities || []).forEach((facility) => {
        const normalized = normalizeFacilityForCatalog(facility);
        const key = facilityMergeKey(normalized);
        keyToIndex.set(key, merged.length);
        merged.push(normalized);
    });

    (incomingFacilities || []).forEach((facility) => {
        const normalized = normalizeFacilityForCatalog(facility);
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
            fdir: current.fdir || normalized.fdir || null,
            companyId: current.companyId || normalized.companyId || 'nearby-external'
        };
    });

    return merged;
}

function getFacilityCatalog() {
    return (facilityCatalog && facilityCatalog.length > 0) ? facilityCatalog : (profile?.facilities || []);
}

async function loadFacilityCatalogFromApi() {
    const collected = [];
    const limit = 500;
    const maxPages = 20;
    let skip = 0;

    for (let page = 0; page < maxPages; page += 1) {
        const response = await fetch(`${API_BASE}/api/facilities?limit=${limit}&skip=${skip}&include_geo=true&include_fdir_metadata=true`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`Facility API HTTP ${response.status}`);

        const payload = await response.json();
        const list = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.facilities) ? payload.facilities : (Array.isArray(payload?.items) ? payload.items : []));

        if (list.length === 0) break;
        collected.push(...list.map((facility) => normalizeFacilityForCatalog(facility)));
        if (list.length < limit) break;
        skip += limit;
    }

    facilityCatalog = mergeFacilityCatalog(profile?.facilities || [], collected);
}

function replaceCompanyFacilitiesKeepingContext(baseFacilities, incomingFacilities) {
    const existingFacilities = [...(baseFacilities || [])];
    const scopedExisting = existingFacilities.filter((facility) => String(facility?.companyId || '') === activeCompanyId);
    const unscopedExisting = existingFacilities.filter((facility) => String(facility?.companyId || '') !== activeCompanyId);

    const byLocality = new Map();
    const byNameMunicipality = new Map();
    for (const facility of scopedExisting) {
        const localityNo = String(facility?.localityNo || '').trim();
        if (localityNo) byLocality.set(localityNo, facility);
        byNameMunicipality.set(`name:${normalizeName(facility?.name)}|${normalizeName(facility?.municipality)}`, facility);
    }

    const authoritativeScoped = (incomingFacilities || []).map((incoming) => {
        const localityNo = String(incoming?.localityNo || '').trim();
        const fallbackKey = `name:${normalizeName(incoming?.name)}|${normalizeName(incoming?.municipality)}`;
        const previous = (localityNo && byLocality.get(localityNo)) || byNameMunicipality.get(fallbackKey) || null;

        return {
            ...previous,
            ...incoming,
            id: String(previous?.id || incoming?.id || (localityNo ? `loc_${localityNo}` : `api_${normalizeName(incoming?.name || 'facility')}`)),
            companyId: activeCompanyId,
            companyName: companyMap.get(activeCompanyId)?.name || incoming?.companyName || previous?.companyName || '',
            latitude: incoming.latitude ?? previous?.latitude ?? null,
            longitude: incoming.longitude ?? previous?.longitude ?? null,
            fdir: incoming.fdir || previous?.fdir || null,
            localityNo: localityNo || previous?.localityNo || null
        };
    });

    return [...unscopedExisting, ...authoritativeScoped];
}

async function syncCompanyFacilitiesFromApi() {
    if (!activeCompanyId) return { added: 0, updated: 0, totalOwned: 0 };

    await loadFacilityCatalogFromApi();
    const rawFacilities = getFacilityCatalog();

    const ownedFromApi = rawFacilities
        .filter((facility) => isFacilityOwnedByActiveCompany(facility))
        .map((facility) => normalizeApiFacilityForCompanyScope(facility));

    if (ownedFromApi.length === 0) return { added: 0, updated: 0, totalOwned: 0 };

    const scopedBefore = (profile?.facilities || []).filter((facility) => String(facility?.companyId || '') === activeCompanyId);
    const beforeByKey = new Map(scopedBefore.map((facility) => [facilityMergeKey(facility), facility]));
    profile.facilities = replaceCompanyFacilitiesKeepingContext(profile?.facilities || [], ownedFromApi);

    let added = 0;
    let updated = 0;
    for (const facility of ownedFromApi) {
        const key = facilityMergeKey(facility);
        if (!beforeByKey.has(key)) added += 1;
        else updated += 1;
    }

    const totalOwned = (profile?.facilities || []).filter((facility) => String(facility?.companyId || '') === activeCompanyId).length;
    return { added, updated, totalOwned };
}

function resolveActiveCompanyId() {
    const companies = profile?.companies || [];
    const facilities = profile?.facilities || [];
    const companyIdsWithFacilities = new Set(
        facilities
            .map((facility) => String(facility?.companyId || '').trim())
            .filter(Boolean)
    );

    const findSupportedCompany = (candidate) => {
        const normalized = String(candidate || '').trim();
        if (!normalized) return '';
        if (!companies.some((company) => String(company?.id || '') === normalized)) return '';
        if (!companyIdsWithFacilities.has(normalized)) return '';
        return normalized;
    };

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = findSupportedCompany(params.get('company'));
    if (fromQuery) {
        try { localStorage.setItem(COMPANY_SCOPE_KEY, fromQuery); } catch (_) {}
        return fromQuery;
    }

    let fromStorage = '';
    try {
        fromStorage = findSupportedCompany(localStorage.getItem(COMPANY_SCOPE_KEY));
    } catch (_) {
        fromStorage = '';
    }
    if (fromStorage) return fromStorage;

    const preferred = findSupportedCompany('masoval');
    if (preferred) return preferred;

    const firstWithFacilities = companies
        .map((company) => String(company?.id || '').trim())
        .find((id) => id && companyIdsWithFacilities.has(id));
    return firstWithFacilities || '';
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

function renderCompanyScopeBadge() {
    const badge = document.getElementById('companyScopeBadge');
    if (!badge) return;
    const companyName = companyMap?.get(activeCompanyId)?.name || activeCompanyId || '';
    if (activeCompanyId) {
        badge.textContent = `Scope: ${companyName || activeCompanyId} (låst)`;
        badge.style.color = 'var(--warn)';
    } else {
        badge.textContent = 'Scope: Alle (åpen)';
        badge.style.color = 'var(--muted)';
    }
}

function rebuildCalendarEnabledFacilityIds() {
    const enabled = new Set();
    const facilitiesById = new Map((profile?.facilities || []).map((facility) => [String(facility?.id || ''), facility]));

    for (const facility of profile?.facilities || []) {
        if (activeCompanyId && String(facility?.companyId || '') === activeCompanyId && facility?.id) {
            enabled.add(String(facility.id));
        }
    }

    for (const event of profile?.calendarEvents || []) {
        const facilityId = String(event?.facilityId || '').trim();
        if (!facilityId) continue;
        if (facilitiesById.has(facilityId)) enabled.add(facilityId);
    }

    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('facilityCalDays_')) continue;
            const facilityId = key.slice('facilityCalDays_'.length);
            if (!facilitiesById.has(String(facilityId))) continue;

            let hasMarkedDays = false;
            try {
                const raw = JSON.parse(localStorage.getItem(key) || '{}');
                hasMarkedDays = raw && typeof raw === 'object' && Object.keys(raw).length > 0;
            } catch (_) {
                hasMarkedDays = false;
            }
            if (hasMarkedDays) enabled.add(String(facilityId));
        }
    } catch (_) {
    }

    calendarEnabledFacilityIds = enabled;
}

function isFacilityCalendarEnabled(facility) {
    const id = String(facility?.id || '').trim();
    if (!id) return false;
    return calendarEnabledFacilityIds.has(id);
}

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const r = 6371;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function normalizeDateKey(rawKey) {
    const parts = String(rawKey || '').split('-').map((item) => Number(item));
    if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item))) return '';
    const [year, month, day] = parts;
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getActivePlanningDateKey() {
    const explicitFocus = normalizeDateKey(document.getElementById('boatFocusDate')?.value || '');
    if (explicitFocus) return explicitFocus;
    const normalized = normalizeDateKey(selectedCalendarDayKey);
    if (normalized) return normalized;
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function addDaysToDateKey(dateKey, days) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return '';
    const [year, month, day] = normalized.split('-').map(Number);
    const next = new Date(year, month - 1, day, 0, 0, 0, 0);
    next.setDate(next.getDate() + days);
    return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

function getActivePlanningRange() {
    const startKey = getActivePlanningDateKey();
    const rawEnd = normalizeDateKey(document.getElementById('boatFocusEndDate')?.value || '');
    const endKey = rawEnd && rawEnd >= startKey ? rawEnd : startKey;
    return { startKey, endKey };
}

function enumerateDateKeys(startKey, endKey) {
    const start = normalizeDateKey(startKey);
    const end = normalizeDateKey(endKey) || start;
    if (!start) return [];
    const result = [];
    let cursor = start;
    while (cursor && cursor <= end && result.length < 90) {
        result.push(cursor);
        cursor = addDaysToDateKey(cursor, 1);
    }
    return result;
}

function saveSharedVesselCalendarEvent(vesselId, event) {
    if (!vesselId || !event) return;
    try {
        const store = JSON.parse(localStorage.getItem(VESSEL_CALENDAR_STORE_KEY) || '{}');
        const key = String(vesselId);
        const current = store[key] || { events: [], dayMarks: {} };
        const existing = Array.isArray(current.events) ? [...current.events] : [];
        const idx = existing.findIndex((item) => String(item.id || '') === String(event.id || ''));
        if (idx >= 0) existing[idx] = { ...existing[idx], ...event };
        else existing.push(event);
        store[key] = { ...current, events: existing };
        localStorage.setItem(VESSEL_CALENDAR_STORE_KEY, JSON.stringify(store));
    } catch (_) {
        // ignore local sync failures in demo mode
    }
}

function syncSharedVesselEventFromFacilityAction(event, patch = {}) {
    const vesselId = String(event?.vesselId || '').trim();
    if (!vesselId) return;

    const startIso = event?.start || (event?.date ? `${event.date}T09:00:00` : null);
    const endIso = event?.end || (startIso ? new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString() : null);
    const fallbackId = `${vesselId}|${event?.facilityId || ''}|${startIso || Date.now()}`;
    const mergedEvent = {
        id: event?.id || fallbackId,
        vesselId,
        facilityId: event?.facilityId || '',
        facilityName: event?.facilityName || '',
        title: event?.title || 'Besøk',
        start: startIso,
        end: endIso,
        planned: event?.planned !== false,
        completed: event?.completed === true,
        type: event?.type || 'visit',
        requestSource: event?.requestSource || 'facility-booking',
        comment: event?.comment || '',
        ...patch
    };

    saveSharedVesselCalendarEvent(vesselId, mergedEvent);

    if (Array.isArray(profile?.calendarEvents)) {
        const idx = profile.calendarEvents.findIndex((item) => String(item?.id || '') === String(mergedEvent.id || ''));
        if (idx >= 0) {
            profile.calendarEvents[idx] = { ...profile.calendarEvents[idx], ...patch };
        }
    }
}

function getDayWindow(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-').map((item) => Number(item));
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start, end };
}

function getFacilityStoredDayMark(facilityId, dateKey) {
    if (!facilityId || !dateKey) return '';
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return '';

    const [year, month, day] = normalized.split('-').map((item) => Number(item));
    const legacyKey = `${year}-${month - 1}-${day}`;
    const compactIsoKey = `${year}-${month}-${day}`;
    const storageKey = `facilityCalDays_${facilityId}`;

    try {
        const marks = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const explicit = String(marks?.[normalized] || marks?.[compactIsoKey] || marks?.[legacyKey] || '').trim().toLowerCase();
        if (explicit === 'green' || explicit === 'red') return explicit;

        const fallbackDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        if (Number.isNaN(fallbackDate.getTime())) return '';
        const weekday = fallbackDate.getDay();
        return (weekday === 0 || weekday === 6) ? 'red' : 'green';
    } catch (_) {
        const fallbackDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        if (Number.isNaN(fallbackDate.getTime())) return '';
        const weekday = fallbackDate.getDay();
        return (weekday === 0 || weekday === 6) ? 'red' : 'green';
    }
}

function getAutoSuggestionJobType(autoType) {
    if (autoType === 'liceDeadline') return 'desinfeksjon';
    if (autoType === 'bInvestigation') return 'inspeksjon';
    if (autoType === 'harvestPlanning') return 'fisk_transport';
    if (autoType === 'waterQualityMonthly') return 'inspeksjon';
    return 'inspeksjon';
}

function createOrUpdateJobRequestFromAutoReminder({ autoType, autoDate, autoStart, autoEnd, autoTitle }) {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før automatisk jobb opprettes.');
        return;
    }

    const startDate = normalizeDateKey(autoStart || autoDate || selectedCalendarDayKey) || new Date().toISOString().split('T')[0];
    const endDate = normalizeDateKey(autoEnd || autoDate || startDate) || startDate;
    const jobType = getAutoSuggestionJobType(autoType);
    const prefix = `[Auto ${new Date().toLocaleDateString('nb-NO')}] ${autoTitle || 'Regelbasert forslag'}`;

    if (autoType === 'liceDeadline' || autoType === 'bInvestigation' || autoType === 'diseaseTestingWindow' || autoType === 'harvestPlanning') {
        const appliedDays = setCalendarMarksForFacilityRange(selected.id, startDate, endDate, 'green');
        selectedCalendarDayKey = `${new Date(startDate).getFullYear()}-${new Date(startDate).getMonth()}-${new Date(startDate).getDate()}`;
        const boatFocusDate = document.getElementById('boatFocusDate');
        if (boatFocusDate) boatFocusDate.value = startDate;
        const boatFocusEndDate = document.getElementById('boatFocusEndDate');
        if (boatFocusEndDate) boatFocusEndDate.value = endDate;
        renderFacilityMiniCalendar();
        renderAvailableBoats();
        const label = autoType === 'liceDeadline'
            ? 'avlusningsvindu'
            : autoType === 'bInvestigation'
            ? 'B-prøvevindu'
            : autoType === 'harvestPlanning'
            ? 'biomassevindu'
            : 'sykdomstestvindu';
        showToast('success', 'Kalendervindu opprettet', `${appliedDays} dager markert grønt for ${label} (${startDate}–${endDate}).`);
    }

    const existing = listJobs(selected.id).find((job) => (
        String(job?.autoSuggestionType || '') === String(autoType || '')
        && String(job?.startDate || '') === startDate
        && String(job?.endDate || '') === endDate
        && String(job?.status || '') !== JOB_STATUSES.CANCELLED
    ));
    if (existing) {
        showToast('info', 'Allerede opprettet', `Forslaget finnes allerede som jobb ${existing.id}.`);
        return;
    }

    const priority = (autoType === 'liceDeadline' || autoType === 'bInvestigation') ? 'high' : 'normal';
    const estimatedHours = autoType === 'harvestPlanning' ? 6 : 4;

    const job = createJob({
        id: selected.id,
        name: selected.name,
        code: selected.localityNo,
        latitude: selected.latitude,
        longitude: selected.longitude,
        jobType,
        startDate,
        endDate,
        preferredTime: '10:00',
        estimatedHours,
        notes: prefix,
        priority,
        preferredVesselIds: getFacilityOperatorPrefs(selected.id).preferredVesselIds,
        blockedVesselIds: getFacilityOperatorPrefs(selected.id).blockedVesselIds,
        createdBy: pilotActor,
        autoSuggestionType: autoType || '',
        autoSuggestionTitle: autoTitle || ''
    });

    const vessels = profile.vessels || [];
    const nearbyVessels = findVesselsInRadius(job, vessels, 100);
    const enrichedVessels = enrichVesselsForJobMatching(nearbyVessels, selected, startDate, endDate, 100);
    const calendarMap = buildVesselCalendarMap(enrichedVessels);
    const matchCandidates = matchVesselsForJob(job, enrichedVessels, calendarMap, new Map());
    if (matchCandidates.length > 0) {
        const proposals = matchCandidates
            .slice(0, 3)
            .map((candidate) => generateProposal(candidate.vessel, job, candidate));
        addProposalsToJob(job.id, proposals);
        showToast('success', 'Auto-jobb opprettet', `Jobb ${job.id} opprettet med ${proposals.length} forslag.`);
    } else {
        showToast('success', 'Auto-jobb opprettet', `Jobb ${job.id} opprettet. Ingen båtforslag akkurat nå.`);
    }

    renderJobsList();
    renderAutoGeneratedRequestsList(selected);
}

function overlapsDay(startIso, endIso, dayStart, dayEnd) {
    const start = new Date(startIso);
    const end = new Date(endIso || startIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return start <= dayEnd && end >= dayStart;
}

function getFacilityById(facilityId) {
    return (profile?.facilities || []).find((facility) => String(facility.id) === String(facilityId)) || null;
}

function getDistanceBetweenFacilities(a, b) {
    const lat1 = toNumber(a?.latitude);
    const lon1 = toNumber(a?.longitude);
    const lat2 = toNumber(b?.latitude);
    const lon2 = toNumber(b?.longitude);
    if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;
    return haversineKm(lat1, lon1, lat2, lon2);
}

function getVesselPlannedZoneAvailability(vessel, selectedFacility, dateKey, radiusKm = analysisRadiusKm) {
    if (!vessel || !selectedFacility) return null;
    const events = getMergedVesselEvents(vessel.id);
    if (events.length === 0) return null;

    const { start: dayStart, end: dayEnd } = getDayWindow(dateKey);
    const busyEvents = events.filter((event) => overlapsDay(event.start, event.end, dayStart, dayEnd));
    const windows = deriveAvailabilityWindows(events, (facilityId) => getFacilityById(facilityId), getAvailabilityWindowOptions(vessel));

    let activeWindow = null;
    let nearestWindowDistance = Infinity;
    for (const window of windows) {
        const overlapsSelectedDay = window.start <= dayEnd && window.end >= dayStart;
        const distanceKm = Math.min(
            ...window.facilities
                .map((facility) => distanceKmBetween(selectedFacility, facility))
                .filter((value) => Number.isFinite(value))
        );
        if (!Number.isFinite(distanceKm)) continue;
        nearestWindowDistance = Math.min(nearestWindowDistance, distanceKm);
        if (overlapsSelectedDay && distanceKm <= Math.max(radiusKm, Number(window.radiusKm || 0))) {
            activeWindow = { ...window, distanceKm };
            break;
        }
    }

    const windowStart = new Date(dayStart);
    const windowEnd = new Date(dayEnd);
    windowStart.setDate(windowStart.getDate() - 14);
    windowEnd.setDate(windowEnd.getDate() + 14);

    const inWindow = events.filter((event) => {
        const start = new Date(event.start);
        return Number.isFinite(start.getTime()) && start >= windowStart && start <= windowEnd;
    });

    let nearest = null;
    for (const event of inWindow) {
        const facility = getFacilityById(event.facilityId);
        const distanceKm = getDistanceBetweenFacilities(selectedFacility, facility);
        if (!Number.isFinite(distanceKm)) continue;
        if (!nearest || distanceKm < nearest.distanceKm) {
            nearest = { event, distanceKm, facility };
        }
    }

    if (!nearest) return null;
    const inZoneByPlan = nearest.distanceKm <= radiusKm;
    if (!inZoneByPlan && !activeWindow) return null;

    return {
        inZoneByPlan: inZoneByPlan || Boolean(activeWindow),
        busyOnDate: busyEvents.length > 0,
        nearestDistanceKm: nearest.distanceKm,
        nearestEvent: nearest.event,
        nearestFacility: nearest.facility,
        activeWindow,
        nearestWindowDistance: Number.isFinite(nearestWindowDistance) ? nearestWindowDistance : null
    };
}

function getVesselPlannedZoneAvailabilityForRange(vessel, selectedFacility, startKey, endKey, radiusKm = analysisRadiusKm) {
    const dateKeys = enumerateDateKeys(startKey, endKey);
    if (!dateKeys.length) return null;
    const daily = dateKeys
        .map((dateKey) => ({ dateKey, state: getVesselPlannedZoneAvailability(vessel, selectedFacility, dateKey, radiusKm) }))
        .filter((item) => item.state);

    if (!daily.length) return null;

    const busyDays = daily.filter((item) => item.state.busyOnDate).length;
    const coveredDays = daily.length;
    const freeCoveredDays = daily.filter((item) => !item.state.busyOnDate).length;
    const fullCoverage = coveredDays === dateKeys.length;
    const intervalFit = fullCoverage && busyDays === 0;
    const nearestDistanceKm = Math.min(...daily.map((item) => Number(item.state.nearestWindowDistance ?? item.state.nearestDistanceKm ?? Infinity)).filter(Number.isFinite));
    const windowAnchors = [];
    daily.forEach((item) => {
        if (item.state.activeWindow && !windowAnchors.some((anchor) => anchor.id === item.state.activeWindow.id)) {
            windowAnchors.push(item.state.activeWindow);
        }
    });

    return {
        intervalFit,
        fullCoverage,
        busyDays,
        coveredDays,
        freeCoveredDays,
        totalDays: dateKeys.length,
        daily,
        nearestDistanceKm: Number.isFinite(nearestDistanceKm) ? nearestDistanceKm : null,
        activeWindows: windowAnchors,
        hasCoverage: coveredDays > 0
    };
}

function renderJobsList() {
    const selected = getSelectedFacility();
    const jobList = document.getElementById('jobList');
    if (!jobList || !selected) return;

    const jobs = listJobs(selected.id);
    const jobStatusFilterEl = document.getElementById('jobStatusFilter');
    const selectedStatusFilter = String(jobStatusFilterEl?.value || 'all');
    if (jobStatusFilterEl) {
        const statusCounts = jobs.reduce((acc, job) => {
            const key = String(job?.status || '');
            if (!key) return acc;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        jobStatusFilterEl.querySelectorAll('option').forEach((option) => {
            const value = String(option.value || 'all');
            const label = value === 'all' ? 'Alle statuser' : (JOB_STATUS_LABELS[value] || value);
            const count = value === 'all'
                ? jobs.length
                : Number(statusCounts[value] || 0);
            option.textContent = `${label} (${count})`;
        });
        if (jobStatusFilterEl.value !== selectedStatusFilter) {
            jobStatusFilterEl.value = selectedStatusFilter;
        }
    }
    const visibleJobs = (selectedStatusFilter === 'all'
        ? jobs
        : jobs.filter((job) => String(job.status || '') === selectedStatusFilter))
        .slice()
        .sort((a, b) => {
            const aStart = new Date(`${a.startDate || ''}T00:00:00`).getTime();
            const bStart = new Date(`${b.startDate || ''}T00:00:00`).getTime();
            const aValid = Number.isFinite(aStart);
            const bValid = Number.isFinite(bStart);
            if (aValid && bValid && aStart !== bStart) return aStart - bStart;
            if (aValid && !bValid) return -1;
            if (!aValid && bValid) return 1;

            const aCreated = new Date(a.createdAt || '').getTime();
            const bCreated = new Date(b.createdAt || '').getTime();
            const aCreatedValid = Number.isFinite(aCreated);
            const bCreatedValid = Number.isFinite(bCreated);
            if (aCreatedValid && bCreatedValid && aCreated !== bCreated) return aCreated - bCreated;
            if (aCreatedValid && !bCreatedValid) return -1;
            if (!aCreatedValid && bCreatedValid) return 1;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
    const policyAuditText = formatPolicyAuditSummary(selected.id);
    const currentPrefs = getFacilityOperatorPrefs(selected.id);
    const resyncAllBtn = document.getElementById('resyncAllJobPoliciesBtn');
    const driftCount = jobs.filter((job) => hasPolicyDriftSinceJobCreated(job, currentPrefs)).length;
    if (resyncAllBtn) {
        resyncAllBtn.style.display = jobs.length > 0 ? '' : 'none';
        resyncAllBtn.disabled = driftCount === 0;
        resyncAllBtn.textContent = driftCount > 0 ? `Re-sync alle jobber (${driftCount})` : 'Re-sync alle jobber';
    }
    
    if (jobs.length === 0) {
        jobList.innerHTML = '<li class="empty">Ingen jobber for dette anlegget ennå.</li>';
        return;
    }

    if (visibleJobs.length === 0) {
        jobList.innerHTML = `<li class="empty">Ingen jobber med status «${JOB_STATUS_LABELS[selectedStatusFilter] || selectedStatusFilter}».</li>`;
        return;
    }

    jobList.innerHTML = visibleJobs.map(job => {
        const matchCount = job.proposals?.length || 0;
        const statusClass = job.status === JOB_STATUSES.ACCEPTED ? 'ok' : job.proposals?.length > 0 ? 'warn' : '';
        const statusBadgeClass = JOB_STATUS_BADGE_CLASS[job.status] || 'draft';
        const statusLabel = JOB_STATUS_LABELS[job.status] || job.status || 'Ukjent';
        const timeline = Array.isArray(job.statusTimeline) ? job.statusTimeline : [];
        const lastTransition = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        const nextStatuses = getNextJobStatuses(job.status);
        const preferredCount = Array.isArray(job.preferredVesselIds) ? job.preferredVesselIds.length : 0;
        const blockedCount = Array.isArray(job.blockedVesselIds) ? job.blockedVesselIds.length : 0;
        const policySummary = preferredCount > 0
            ? `Kun foretrukne (${preferredCount})${blockedCount > 0 ? ` · Blokkerte (${blockedCount})` : ''}`
            : blockedCount > 0
            ? `Blokkerte operatører (${blockedCount})`
            : 'Ingen operatørpolicy';
        const hasPolicyDrift = hasPolicyDriftSinceJobCreated(job, currentPrefs);
        
        return `
            <li class="job-card">
                <div class="job-card-header">
                    <span class="job-type-badge ${(job.jobType || 'default').toLowerCase()}">${job.jobType}</span>
                    <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
                    ${matchCount > 0 ? `<span class="match-count-pill">${matchCount}</span>` : ''}
                </div>
                <div class="job-card-meta">${job.startDate}${job.endDate !== job.startDate ? ` → ${job.endDate}` : ''}</div>
                <div class="job-card-meta">Prioritet: <strong>${job.priority || 'Normal'}</strong> · Timer: ${job.estimatedHours || '-'}</div>
                ${lastTransition?.at ? `<div class="job-card-meta">Status sist oppdatert: ${new Date(lastTransition.at).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })} (${lastTransition.by || 'ukjent'})</div>` : ''}
                <div class="job-card-meta">Policy: ${policySummary}</div>
                ${hasPolicyDrift ? '<div class="job-card-meta" style="color:var(--warn);">⚠ Policy er endret etter at jobben ble opprettet</div>' : ''}
                ${hasPolicyDrift ? `<div style="margin-top:6px;"><button type="button" class="mini-btn" data-resync-job-policy="${job.id}">Re-sync policy</button></div>` : ''}
                <div class="job-card-meta">${policyAuditText}</div>
                ${job.notes ? `<div class="job-card-meta">Notat: ${job.notes}</div>` : ''}
                ${nextStatuses.length > 0 ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">${nextStatuses.map((status) => `<button type="button" class="mini-btn" data-next-status="${status}" data-job-status="${job.id}">${JOB_STATUS_LABELS[status] || status}</button>`).join('')}</div>` : ''}
            </li>
        `;
    }).join('');

    jobList.querySelectorAll('[data-resync-job-policy]').forEach((button) => {
        button.addEventListener('click', () => {
            const jobId = String(button.dataset.resyncJobPolicy || '');
            if (!jobId) return;
            const latest = getFacilityOperatorPrefs(selected.id);
            const updatedJob = updateJobPolicySnapshot(jobId, latest.preferredVesselIds, latest.blockedVesselIds);
            if (updatedJob) {
                showToast('success', 'Policy synkronisert', `Jobb ${jobId} oppdatert med gjeldende operatørpolicy.`);
                renderJobsList();
            } else {
                showToast('warning', 'Fant ikke jobb', `Kunne ikke oppdatere jobb ${jobId}.`);
            }
        });
    });

    jobList.querySelectorAll('[data-next-status]').forEach((button) => {
        button.addEventListener('click', () => {
            const jobId = String(button.dataset.jobStatus || '');
            const nextStatus = String(button.dataset.nextStatus || '');
            if (!jobId || !nextStatus) return;
            const updated = updateJobStatus(jobId, nextStatus, { by: pilotActor, source: 'facility-dashboard' });
            if (!updated) {
                showToast('warning', 'Kunne ikke oppdatere status', `Fant ikke jobb ${jobId}.`);
                return;
            }
            showToast('success', 'Status oppdatert', `Jobb ${jobId} er nå ${JOB_STATUS_LABELS[nextStatus] || nextStatus}.`);
            renderJobsList();
        });
    });
}

function resyncAllJobPoliciesForSelectedFacility() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Velg anlegg før batch re-sync.');
        return;
    }
    const latest = getFacilityOperatorPrefs(selected.id);
    const jobs = listJobs(selected.id);
    let changed = 0;
    let firstBefore = null;
    for (const job of jobs) {
        if (!hasPolicyDriftSinceJobCreated(job, latest)) continue;
        if (!firstBefore) {
            firstBefore = {
                preferredVesselIds: [...(job.preferredVesselIds || [])],
                blockedVesselIds: [...(job.blockedVesselIds || [])]
            };
        }
        const updated = updateJobPolicySnapshot(job.id, latest.preferredVesselIds, latest.blockedVesselIds);
        if (updated) changed += 1;
    }
    if (changed > 0) {
        pushFacilityOperatorPolicyAudit(selected.id, {
            action: 'batch-resync',
            vesselId: '',
            vesselName: '',
            jobCount: changed,
            before: firstBefore,
            after: {
                preferredVesselIds: [...(latest.preferredVesselIds || [])],
                blockedVesselIds: [...(latest.blockedVesselIds || [])]
            }
        });
        showToast('success', 'Policy synkronisert', `${changed} jobb(er) oppdatert med gjeldende operatørpolicy.`);
    } else {
        showToast('info', 'Ingen endringer', 'Alle jobber er allerede synket med gjeldende policy.');
    }
    renderJobsList();
}

function showJobRequestPanel() {
    const selected = getSelectedFacility();
    const panel = document.getElementById('jobRequestPanel');
    if (!panel) return;
    
    if (selected) {
        panel.style.display = 'block';
        // Set default deadline if not set (30 days from today)
        const deadlineInput = document.getElementById('jobDeadlineInput');
        if (!deadlineInput?.value) {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            if (deadlineInput) deadlineInput.value = d.toISOString().split('T')[0];
        }
    } else {
        panel.style.display = 'none';
    }

    renderAutoGeneratedRequestsList(selected);
    
    // Show 7-day plan if selected
    const sevenDayPanel = document.getElementById('sevenDayPlanPanel');
    if (sevenDayPanel) {
        sevenDayPanel.style.display = selected ? '' : 'none';
    }
    renderSevenDayPlan();
}

function renderSevenDayPlan() {
    const selected = getSelectedFacility();
    const container = document.getElementById('sevenDayPlanContainer');
    if (!container || !selected) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    const facilityEvents = getFacilityCalendarEvents(selected.id) || [];
    const autoReminderByDay = getAutoReminderMapByLegacyDateKey(selected);
    const markForDate = (dateKey) => getFacilityStoredDayMark(selected.id, dateKey);
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const legacyDateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const dayName = date.toLocaleDateString('nb-NO', { weekday: 'short', month: 'short', day: '2-digit' });
        const { start: dayStart, end: dayEnd } = getDayWindow(dateKey);
        
        const facilityJobs = listJobs(selected.id).filter(job => {
            const jobStart = new Date(job.startDate);
            const jobEnd = new Date(job.endDate);
            return date >= jobStart && date <= jobEnd;
        });
        const dayEvents = facilityEvents.filter((event) => overlapsDay(event.start, event.end, dayStart, dayEnd));
        const dayReminders = autoReminderByDay.get(legacyDateKey) || [];
        const dayMark = markForDate(dateKey);
        
        const jobCount = facilityJobs.length;
        const eventCount = dayEvents.length;
        const reminderCount = dayReminders.length;
        const segments = [];
        if (jobCount > 0) segments.push(`${jobCount} jobb${jobCount > 1 ? 'er' : ''}`);
        if (eventCount > 0) segments.push(`${eventCount} besøk`);
        if (reminderCount > 0) segments.push(`${reminderCount} anbefaling${reminderCount > 1 ? 'er' : ''}`);
        if (segments.length === 0) segments.push(dayMark === 'red' ? 'Opptatt' : 'Ledig');
        const jobInfo = segments.join(' · ');
        
        const statusClass = (jobCount > 0 || eventCount > 0 || reminderCount > 0 || dayMark === 'red') ? 'warn' : 'ok';
        const jobTypes = jobCount > 0 ? facilityJobs.map(j => `<span class="job-type-badge ${(j.jobType || 'default').toLowerCase()}" style="font-size:10px;padding:2px 6px;">${j.jobType}</span>`).join('') : '';
        const marker = dayMark === 'green'
            ? '<span class="fpl-badge ok" style="font-size:10px;">Ledig</span>'
            : dayMark === 'red'
            ? '<span class="fpl-badge danger" style="font-size:10px;">Opptatt</span>'
            : '';
        const reminderChip = reminderCount > 0
            ? `<span class="fpl-badge warn" style="font-size:10px;">Anbefalt ${reminderCount}</span>`
            : '';
        
        html += `
            <div class="day-plan-card ${statusClass}">
                <div class="day-plan-indicator"></div>
                <div style="flex: 1;">
                    <div class="day-plan-date">${dayName}</div>
                    <div class="day-plan-info">${jobInfo}</div>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">${reminderChip}${marker}</div>
                ${jobTypes ? `<div class="day-plan-jobs" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${jobTypes}</div>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html || '<p class="empty">Ingen jobber planlagt de neste 7 dagene.</p>';
}

function buildVesselCalendarMap(vessels) {
    const calendar = {};
    for (const vessel of vessels || []) {
        const events = getMergedVesselEvents(vessel.id);
        calendar[vessel.id] = {};
        for (const event of events) {
            const start = new Date(event.start);
            const end = new Date(event.end || event.start);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
            const cursor = new Date(start);
            cursor.setHours(0, 0, 0, 0);
            const last = new Date(end);
            last.setHours(0, 0, 0, 0);
            while (cursor <= last) {
                const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
                calendar[vessel.id][key] = calendar[vessel.id][key] || [];
                calendar[vessel.id][key].push(event);
                cursor.setDate(cursor.getDate() + 1);
            }
        }
    }
    return calendar;
}

function enrichVesselsForJobMatching(vessels, facility, startDate, endDate, radiusKm = 100) {
    return (vessels || []).map((vessel) => {
        const range = getVesselPlannedZoneAvailabilityForRange(vessel, facility, startDate, endDate, radiusKm);
        return {
            ...vessel,
            __jobMatchMeta: {
                intervalFit: Boolean(range?.intervalFit),
                fullCoverage: Boolean(range?.fullCoverage),
                coveredDays: Number(range?.coveredDays || 0),
                totalDays: Number(range?.totalDays || 0),
                freeCoveredDays: Number(range?.freeCoveredDays || 0),
                busyDays: Number(range?.busyDays || 0),
                nearestDistanceKm: Number.isFinite(range?.nearestDistanceKm) ? Number(range.nearestDistanceKm) : null,
                activeWindowCount: Number(range?.activeWindows?.length || 0)
            }
        };
    });
}

async function handleJobRequestSubmit(event) {
    event.preventDefault();
    
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('warning', 'Velg anlegg', 'Du må velge anlegg før du oppretter jobbforespørsel.');
        return;
    }

    const jobType = document.getElementById('jobTypeSelect')?.value;
    const deadline = document.getElementById('jobDeadlineInput')?.value;
    const flex = document.getElementById('jobFlexibilitySelect')?.value || '1m';
    const startDate = normalizeDateKey(selectedCalendarDayKey) || new Date().toISOString().split('T')[0];
    const flexDays = { exact: 0, '1w': 7, '2w': 14, '1m': 30, '2m': 60, '6m': 180, '12m': 365, '24m': 730 }[flex] ?? 30;
    let endDate = deadline;
    if (!endDate && flexDays > 0) {
        const d = new Date(startDate.replace(/-/g, '/'));
        d.setDate(d.getDate() + flexDays);
        endDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } else if (!endDate) {
        endDate = startDate;
    }
    const prefTime = document.getElementById('jobPrefTimeInput')?.value || '10:00';
    const estHours = parseInt(document.getElementById('jobEstHoursInput')?.value || '4');
    const notes = document.getElementById('jobNotesInput')?.value || '';
    const priority = document.getElementById('jobPrioritySelect')?.value || 'normal';
    const statusEl = document.getElementById('jobRequestStatus');

    if (!jobType) {
        showToast('warning', 'Mangler data', 'Velg jobbtype for å opprette forespørsel.');
        return;
    }

    try {
        if (statusEl) statusEl.textContent = 'Oppretter jobbforespørsel og finner matchende båter...';

        const job = createJob({
            id: selected.id,
            name: selected.name,
            code: selected.localityNo,
            latitude: selected.latitude,
            longitude: selected.longitude,
            jobType,
            startDate,
            endDate,
            preferredTime: prefTime,
            estimatedHours: estHours,
            notes,
            priority,
            preferredVesselIds: getFacilityOperatorPrefs(selected.id).preferredVesselIds,
            blockedVesselIds: getFacilityOperatorPrefs(selected.id).blockedVesselIds,
            createdBy: pilotActor
        });

        // MATCHING: Find vessels near facility
        const vessels = profile.vessels || [];
        const nearbyVessels = findVesselsInRadius(job, vessels, 100); // 100km radius
        const enrichedVessels = enrichVesselsForJobMatching(nearbyVessels, selected, startDate, endDate, 100);
        const calendarMap = buildVesselCalendarMap(enrichedVessels);
        
        if (enrichedVessels.length > 0) {
            // Try matching
            const matchCandidates = matchVesselsForJob(job, enrichedVessels, calendarMap, new Map());
            
            if (matchCandidates.length > 0) {
                // Generate proposals for top candidates
                const proposals = matchCandidates
                    .slice(0, 3) // Top 3 matches
                    .map(candidate => generateProposal(candidate.vessel, job, candidate));
                
                // Save proposals to job
                addProposalsToJob(job.id, proposals);
                
                if (statusEl) {
                    statusEl.innerHTML = `<span class="ok">✓ Job opprettet:</span> ${job.id} · ${proposals.length} forslag funnet`;
                    statusEl.style.color = 'var(--ok)';
                }
                
                showToast('success', 'Job opprettet med forslag', `${proposals.length} båter kan være aktuelle for denne jobben!`);
            } else {
                if (statusEl) {
                    statusEl.innerHTML = `<span class="warn">⚠ Job opprettet:</span> ${job.id} · Ingen matchende båter funnet`;
                    statusEl.style.color = 'var(--warn)';
                }
                showToast('warning', 'Ingen forslag', 'Ingen båter funnet i området som matcher jobbkravene.');
            }
        } else {
            if (statusEl) {
                statusEl.innerHTML = `<span class="warn">⚠ Job opprettet:</span> ${job.id} · Ingen båter i nærheten`;
                statusEl.style.color = 'var(--warn)';
            }
            showToast('info', 'Job opprettet', 'Ingen båter funnet i området.');
        }

        // Reset form
        document.getElementById('jobRequestForm')?.reset();
        document.getElementById('jobPrefTimeInput').value = '10:00';
        document.getElementById('jobEstHoursInput').value = '4';
        document.getElementById('jobPrioritySelect').value = 'normal';

        renderJobsList();
    } catch (error) {
        if (statusEl) statusEl.textContent = `Feil: ${error.message}`;
        showToast('error', 'Kunne ikke opprette job', error.message);
    }
}

async function requestBoatBooking(vesselId, startDateKey, endDateKey = startDateKey) {
    const selected = getSelectedFacility();
    const vessel = vesselMap.get(vesselId);
    const requestTime = document.getElementById('boatRequestTime')?.value || '10:00';
    const operationMinutes = Math.max(15, parseInt(document.getElementById('boatOperationMinutes')?.value || '60', 10) || 60);
    const cleanDate = normalizeDateKey(startDateKey);
    const cleanEndDate = normalizeDateKey(endDateKey) || cleanDate;
    if (!selected || !vessel || !cleanDate) {
        showToast('warning', 'Mangler data', 'Velg anlegg, dato og gyldig båt før booking.');
        return;
    }

    if (!ensureCanManageVessel(vessel, 'Booking')) {
        return;
    }

    const driftedJobs = getDriftedJobsForFacilityRange(selected.id, cleanDate, cleanEndDate);
    if (driftedJobs.length > 0) {
        const jobRefs = driftedJobs
            .slice(0, 3)
            .map((j) => `${j.jobType || 'Jobb'} (${j.startDate || '?'}\u2192${j.endDate || j.startDate || '?'})`)
            .join(', ');
        const extra = driftedJobs.length > 3 ? ` +${driftedJobs.length - 3} til` : '';
        showToast('warning', 'Policy ikke synket', `Booking blokkert: ${driftedJobs.length} jobb(er) i perioden har utdatert policy — ${jobRefs}${extra}. Kjør Re-sync policy først.`);
        renderJobsList();
        return;
    }

    if (isFacilityBlockedVessel(selected.id, vesselId)) {
        showToast('warning', 'Operatør blokkert', `${vessel.name || 'Valgt båt'} er blokkert for dette anlegget.`);
        return;
    }

    const mmsi = String(vessel.mmsi || '').trim();
    if (!mmsi) {
        showToast('warning', 'Mangler MMSI', `${vessel.name || 'Valgt båt'} mangler MMSI og kan ikke bookes via API.`);
        return;
    }

    const payload = {
        mmsi: Number(mmsi),
        vessel_name: vessel.name,
        facility_code: String(selected.localityNo || selected.id || ''),
        facility_name: selected.name,
        proposed_date: cleanDate,
        proposed_time: requestTime,
        proposed_end_date: cleanEndDate,
        contact_person: 'Facility Ops',
        notes: cleanEndDate !== cleanDate
            ? `Auto-forespørsel for periode ${cleanDate} til ${cleanEndDate} fra ledig båt i sone · operasjonstid ${operationMinutes} min`
            : `Auto-forespørsel fra ledig båt i sone · operasjonstid ${operationMinutes} min`,
        operation_duration_minutes: operationMinutes,
        operation_type: 'inspection'
    };

    try {
        const response = await fetch(`${API_BASE}/api/route-proposals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
            throw new Error(result.error || result.message || `HTTP ${response.status}`);
        }

        showToast('success', 'Forespørsel sendt', `Bookingforespørsel sendt til ${vessel.name} (${cleanDate}${cleanEndDate !== cleanDate ? ` → ${cleanEndDate}` : ''} ${requestTime}).`);
    } catch (error) {
        const reason = error?.message || 'Ukjent API-feil';
        showToast('warning', 'API utilgjengelig', `Lagret lokalt: ${vessel.name} (${cleanDate}${cleanEndDate !== cleanDate ? ` → ${cleanEndDate}` : ''} ${requestTime}). Årsak: ${reason}`);
    }

    const start = new Date(`${cleanDate}T${requestTime}:00`);
    const end = cleanEndDate !== cleanDate
        ? new Date(`${cleanEndDate}T18:00:00`)
        : new Date(start.getTime() + operationMinutes * 60 * 1000);
    const bookingId = `facility_booking_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
    profile.calendarEvents = Array.isArray(profile.calendarEvents) ? profile.calendarEvents : [];
    profile.calendarEvents.push({
        id: bookingId,
        vesselId: vessel.id,
        facilityId: selected.id,
        title: `Bookingforespørsel · ${selected.name}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: 'pending',
        proposalId: null,
        fromAPI: false,
        requestSource: 'facility-booking',
        facilityName: selected.name,
        comment: cleanEndDate !== cleanDate
            ? `Auto-forespørsel for periode ${cleanDate} til ${cleanEndDate}`
            : `Auto-forespørsel fra ledig båt i sone (${operationMinutes} min)`,
        type: 'visit'
    });

    saveSharedVesselCalendarEvent(vessel.id, {
        id: bookingId,
        vesselId: vessel.id,
        facilityId: selected.id,
        facilityName: selected.name,
        title: `Bookingforespørsel · ${selected.name}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: 'pending',
        planned: true,
        completed: false,
        type: 'visit',
        requestSource: 'facility-booking',
        comment: cleanEndDate !== cleanDate
            ? `Auto-forespørsel for periode ${cleanDate} til ${cleanEndDate}`
            : `Auto-forespørsel fra anleggssiden (${operationMinutes} min)`
    });

    selectedBoatForBookingId = vessel.id;

    selectedCalendarDayKey = cleanDate;
    const boatFocusDate = document.getElementById('boatFocusDate');
    if (boatFocusDate) boatFocusDate.value = cleanDate;
    const boatFocusEndDate = document.getElementById('boatFocusEndDate');
    if (boatFocusEndDate) boatFocusEndDate.value = cleanEndDate;
    updateBookingSelectionMeta();

    renderFacilityMiniCalendar();
    renderAvailableBoats();
}

async function loadDiseaseSpreadData() {
    try {
        const response = await fetch(`${API_BASE}/api/facilities/disease-spread?ts=${Date.now()}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        diseaseSpreadData = await response.json();
        dataStatus.disease = 'api';
    } catch (_) {
        diseaseSpreadData = { confirmed_diseased_facilities: [], all_at_risk_facilities: [] };
        dataStatus.disease = 'offline';
    }

    rebuildRiskIndex();
}

function rebuildRiskIndex() {
    riskByCode = new Map();
    riskByName = new Map();
    confirmedByCode = new Set();
    confirmedByName = new Set();

    const allRisk = diseaseSpreadData?.all_at_risk_facilities || [];
    for (const risk of allRisk) {
        const code = risk?.facility_code ? String(risk.facility_code).trim() : '';
        if (code) {
            riskByCode.set(code, risk);
        }

        const name = normalizeName(risk?.facility_name);
        if (name) {
            const arr = riskByName.get(name) || [];
            arr.push(risk);
            riskByName.set(name, arr);
        }
    }

    const confirmed = diseaseSpreadData?.confirmed_diseased_facilities || [];
    for (const item of confirmed) {
        const code = item?.facility_code ? String(item.facility_code).trim() : '';
        if (code) confirmedByCode.add(code);
        const name = normalizeName(item?.facility_name);
        if (name) confirmedByName.add(name);
    }
}

function getSelectedFacility() {
    if (!selectedFacilityId) return null;
    return getFacilityCatalog().find((facility) => facility.id === selectedFacilityId)
        || (profile.facilities || []).find((facility) => facility.id === selectedFacilityId)
        || null;
}

function getFacilityRiskData(facility) {
    if (!facility) return null;

    const code = facility.localityNo ? String(facility.localityNo).trim() : '';
    if (code && riskByCode.has(code)) {
        return riskByCode.get(code);
    }

    const name = normalizeName(facility.name);
    const nameMatches = riskByName.get(name) || [];
    if (nameMatches.length > 0) {
        return nameMatches.find((item) => isSevereRiskLevel(item.risk_level)) || nameMatches[0];
    }

    return null;
}

function getFacilityRiskSignals(facility) {
    const risk = getFacilityRiskData(facility);
    const infected = isFacilityInfected(facility);

    const liceValue = getFirstFiniteNumber(facility, [
        'liceAdultFemale', 'lice.adult_female', 'adult_female_lice',
        'fdir.liceAdultFemale', 'fdir.lice_adult_female',
        'fdir.adult_female_lice', 'fdir.lice_adult_female_average',
        'fdir.liceAdultFemaleAverage', 'fdir.lice_adult_female_avg'
    ]);
    const liceTotalValue = getFirstFiniteNumber(facility, [
        'liceTotal', 'lice.total', 'total_lice',
        'fdir.liceTotal', 'fdir.lice_total', 'fdir.total_lice',
        'fdir.totalLice', 'fdir.lice_count_total', 'fdir.total_lice_count'
    ]);
    const liceHigh = facility?.liceHigh === true
        || facility?.lice_over_threshold === true
        || facility?.lice?.over_threshold === true
        || (Number.isFinite(liceValue) && liceValue >= 0.5)
        || (Number.isFinite(liceTotalValue) && liceTotalValue >= 3)
        || /lus|lice/.test(normalizeAsciiText(risk?.disease || risk?.reason || ''));

    const zoneType = normalizeAsciiText(risk?.zone_type || risk?.zoneType || risk?.zone || '');
    const disease = normalizeAsciiText(risk?.disease || '');
    const isIla = disease.includes('ila') || zoneType.includes('protection') || zoneType.includes('surveillance');
    const ilaProtection = isIla && (zoneType.includes('protection') || zoneType.includes('vern'));
    const ilaSurveillance = isIla && (zoneType.includes('surveillance') || zoneType.includes('overvak'));

    return {
        infected,
        liceHigh,
        ilaProtection,
        ilaSurveillance,
        liceAdultFemale: liceValue,
        liceTotal: liceTotalValue,
        riskLevelRaw: risk?.risk_level || '',
        zoneTypeRaw: risk?.zone_type || risk?.zoneType || ''
    };
}

function isFacilityInfected(facility) {
    if (!facility) return false;
    const code = facility.localityNo ? String(facility.localityNo).trim() : '';
    if (code && confirmedByCode.has(code)) return true;
    return confirmedByName.has(normalizeName(facility.name));
}

function getNestedValue(source, path) {
    if (!source || !path) return undefined;
    const segments = String(path).split('.').filter(Boolean);
    let cursor = source;
    for (const segment of segments) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        cursor = cursor[segment];
    }
    return cursor;
}

function getFirstFiniteNumber(source, paths = []) {
    for (const path of paths) {
        const value = getNestedValue(source, path);
        const normalized = typeof value === 'string'
            ? value.replace(',', '.').replace(/\s+/g, '')
            : value;
        const num = Number(normalized);
        if (Number.isFinite(num)) return num;
    }
    return null;
}

function getFirstIsoDate(source, paths = []) {
    for (const path of paths) {
        const value = getNestedValue(source, path);
        if (!value) continue;
        const date = new Date(String(value));
        if (!Number.isNaN(date.getTime())) {
            return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        }
    }
    return '';
}

function addMonthsToDateKey(dateKey, months) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized || !Number.isFinite(Number(months))) return '';
    const [year, month, day] = normalized.split('-').map(Number);
    const next = new Date(year, month - 1, day, 0, 0, 0, 0);
    next.setMonth(next.getMonth() + Number(months));
    return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

function parseMonthInterval(rawValue) {
    const num = Number(rawValue);
    if (Number.isFinite(num) && num > 0) return Math.round(num);
    const text = String(rawValue || '').toLowerCase();
    if (text.includes('24')) return 24;
    if (text.includes('12')) return 12;
    return null;
}

function buildCalendarAutoReminders(facility) {
    if (!facility) return [];

    const reminders = [];
    const autoConfig = getFacilityAutoRuleConfig(facility);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    const signals = getFacilityRiskSignals(facility);

    const liceAdultFemale = getFirstFiniteNumber(facility, [
        'liceAdultFemale', 'lice.adult_female', 'adult_female_lice',
        'fdir.liceAdultFemale', 'fdir.lice_adult_female',
        'fdir.adult_female_lice', 'fdir.lice_adult_female_average',
        'fdir.liceAdultFemaleAverage', 'fdir.lice_adult_female_avg'
    ]);
    const liceTotal = getFirstFiniteNumber(facility, [
        'liceTotal', 'lice.total', 'total_lice',
        'fdir.liceTotal', 'fdir.lice_total', 'fdir.total_lice',
        'fdir.totalLice', 'fdir.lice_count_total', 'fdir.total_lice_count'
    ]);
    const liceMeasuredAt = getFirstIsoDate(facility, [
        'lice.measured_at', 'lice.last_updated', 'fdir.lice_measured_at',
        'fdir.lice_last_updated', 'fdir.last_lice_update'
    ]) || todayKey;
    const liceThresholdHit = (Number.isFinite(liceAdultFemale) && liceAdultFemale > 0.5)
        || (Number.isFinite(liceTotal) && liceTotal > 3);
    const liceSignalHit = signals.liceHigh === true;

    if (autoConfig.liceDeadline && (liceThresholdHit || liceSignalHit)) {
        const windowStart = liceMeasuredAt;
        const dueDate = addDaysToDateKey(liceMeasuredAt, 14) || addDaysToDateKey(todayKey, 14);
        const liceBasis = liceThresholdHit
            ? `Grunnlag: hunnlus ${Number.isFinite(liceAdultFemale) ? liceAdultFemale.toFixed(2) : '-'} / total lus ${Number.isFinite(liceTotal) ? liceTotal.toFixed(2) : '-'}.`
            : 'Grunnlag: markert høy luserisiko i risikobildet.';
        reminders.push({
            id: `lice-deadline-${facility.id}`,
            dateKey: dueDate,
            tier: 'requirement',
            severity: 'danger',
            title: 'Behandlingsfrist lusegrense',
            detail: `Høye lusetall registrert ${liceMeasuredAt}. Anbefalt avlusning innen 14 dager (frist ${dueDate}). ${liceBasis}`,
            source: 'BW/FDIR + fast regel',
            suggestionType: 'liceDeadline',
            actionLabel: 'Legg til som forespørsel',
            actionStartDate: windowStart,
            actionEndDate: dueDate
        });
    }

    const bLastDate = getFirstIsoDate(facility, [
        'fdir.lastBInvestigationDate', 'fdir.last_b_investigation_date',
        'fdir.lastBSurveyDate', 'fdir.last_b_survey_date',
        'lastBInvestigationDate', 'last_b_investigation_date'
    ]);
    const bNextDate = getFirstIsoDate(facility, [
        'fdir.nextBInvestigationDue', 'fdir.next_b_investigation_due',
        'nextBInvestigationDue', 'next_b_investigation_due'
    ]);
    const bIntervalMonths = parseMonthInterval(
        getNestedValue(facility, 'fdir.bInvestigationIntervalMonths')
        ?? getNestedValue(facility, 'fdir.b_investigation_interval_months')
        ?? getNestedValue(facility, 'fdir.bSurveyIntervalMonths')
        ?? getNestedValue(facility, 'fdir.b_survey_interval_months')
        ?? getNestedValue(facility, 'bInvestigationIntervalMonths')
        ?? getNestedValue(facility, 'b_investigation_interval_months')
    ) || 12;

    const bDueDate = bNextDate || (bLastDate ? addMonthsToDateKey(bLastDate, bIntervalMonths) : '');
    if (autoConfig.bInvestigation && bDueDate) {
        const overdue = bDueDate < todayKey;
        const bWindowStart = addDaysToDateKey(bDueDate, -14) || bDueDate;
        reminders.push({
            id: `b-investigation-${facility.id}`,
            dateKey: bDueDate,
            tier: 'requirement',
            severity: overdue ? 'danger' : 'warn',
            title: 'B-undersøkelse (NS 9410)',
            detail: `Anbefalt B-prøve/B-undersøkelse i perioden ${bWindowStart}–${bDueDate}. Neste frist beregnet fra registrert intervall (${bIntervalMonths} mnd).`,
            source: 'Fiskeridirektoratet/NS 9410',
            suggestionType: 'bInvestigation',
            actionLabel: 'Legg til som forespørsel',
            actionStartDate: bWindowStart,
            actionEndDate: bDueDate
        });
    }

    const diseaseRelevant = signals.infected || signals.ilaProtection || signals.ilaSurveillance || Number(signals.riskScore || 0) >= 1;
    if (autoConfig.diseaseTestingWindow && diseaseRelevant) {
        const windowStart = todayKey;
        const windowEnd = addDaysToDateKey(todayKey, 14) || todayKey;
        reminders.push({
            id: `disease-testing-${facility.id}`,
            dateKey: windowStart,
            tier: 'recommended',
            severity: signals.infected ? 'danger' : 'warn',
            title: 'Anbefalt sykdomstest-vindu (2 uker)',
            detail: `Anbefalt testing/oppfølging i perioden ${windowStart}–${windowEnd}.`,
            source: 'BW/FDIR risikobilde',
            suggestionType: 'diseaseTestingWindow',
            actionLabel: 'Legg til som forespørsel',
            actionStartDate: windowStart,
            actionEndDate: windowEnd
        });
    }

    const currentBiomass = getFirstFiniteNumber(facility, [
        'fdir.currentBiomass', 'fdir.current_biomass', 'fdir.biomass',
        'currentBiomass', 'current_biomass', 'biomass'
    ]);
    const maxAllowedBiomass = getFirstFiniteNumber(facility, [
        'fdir.maxAllowedBiomass', 'fdir.max_allowed_biomass', 'fdir.mab',
        'maxAllowedBiomass', 'max_allowed_biomass', 'mab'
    ]);
    if (autoConfig.biomassPlanning && Number.isFinite(currentBiomass) && Number.isFinite(maxAllowedBiomass) && maxAllowedBiomass > 0) {
        const ratio = currentBiomass / maxAllowedBiomass;
        if (ratio >= 0.9) {
            const biomassDueDate = addDaysToDateKey(todayKey, 60) || todayKey;
            const biomassWindowStart = todayKey;
            const biomassWindowEnd = addDaysToDateKey(todayKey, 30) || biomassDueDate;
            reminders.push({
                id: `harvest-plan-${facility.id}`,
                dateKey: biomassDueDate,
                tier: 'recommended',
                severity: ratio >= 1 ? 'danger' : 'warn',
                title: 'Slakte-/uttaksplanlegging',
                detail: `Biomasse ${currentBiomass.toFixed(0)} av MAB ${maxAllowedBiomass.toFixed(0)} (${Math.round(ratio * 100)}%). Anbefalt plan-/kapasitetsvindu ${biomassWindowStart}–${biomassWindowEnd}.`,
                source: 'Fiskeridirektoratet-data',
                suggestionType: 'harvestPlanning',
                actionLabel: 'Legg til som forespørsel',
                actionStartDate: biomassWindowStart,
                actionEndDate: biomassWindowEnd
            });
        }
    }

    if (autoConfig.waterQualityMonthly) {
        const firstThisMonth = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`;
        const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const firstNextMonth = `${nextMonthDate.getFullYear()}-${pad2(nextMonthDate.getMonth() + 1)}-01`;
        const targetDate = todayKey <= firstThisMonth ? firstThisMonth : firstNextMonth;

        reminders.push({
            id: `water-quality-${facility.id}`,
            dateKey: targetDate,
            tier: 'recommended',
            severity: 'neutral',
            title: 'Månedlig vannkvalitet (ekstern)',
            detail: 'Valgfri driftsregel for anlegg som bestiller ekstern vannkvalitetsmåling hver måned.',
            source: 'Driftsoppsett (valgfritt)',
            suggestionType: 'waterQualityMonthly'
        });
    }

    return reminders
        .filter((item) => normalizeDateKey(item.dateKey))
        .map((item) => ({ ...item, dateKey: normalizeDateKey(item.dateKey) }))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function getAutoReminderMapByLegacyDateKey(facility) {
    const byDay = new Map();
    const reminders = buildCalendarAutoReminders(facility);
    for (const reminder of reminders) {
        const [year, month, day] = reminder.dateKey.split('-').map(Number);
        const legacyKey = `${year}-${month - 1}-${day}`;
        const bucket = byDay.get(legacyKey) || [];
        bucket.push(reminder);
        byDay.set(legacyKey, bucket);
    }
    return byDay;
}

function getDistanceToSelected(facility) {
    const selected = getSelectedFacility();
    if (!selected) return null;

    const lat1 = toNumber(selected.latitude);
    const lon1 = toNumber(selected.longitude);
    const lat2 = toNumber(facility.latitude);
    const lon2 = toNumber(facility.longitude);
    if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

    return haversineKm(lat1, lon1, lat2, lon2);
}

function getNearbyFacilities() {
    const selected = getSelectedFacility();
    if (!selected) return [];

    return getFacilityCatalog()
        .filter((facility) => facility.id !== selected.id)
        .map((facility) => ({
            facility,
            distanceKm: getDistanceToSelected(facility)
        }))
        .filter((item) => {
            const lat = toNumber(item.facility.latitude);
            const lon = toNumber(item.facility.longitude);
            return item.distanceKm !== null && item.distanceKm <= analysisRadiusKm && isNorwayCoordinate(lat, lon);
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);
}

function getNearbyFacilitiesAll() {
    const selected = getSelectedFacility();
    if (!selected) return [];

    return getFacilityCatalog()
        .filter((facility) => facility.id !== selected.id)
        .map((facility) => ({
            facility,
            distanceKm: getDistanceToSelected(facility)
        }))
        .filter((item) => {
            const lat = toNumber(item.facility.latitude);
            const lon = toNumber(item.facility.longitude);
            return item.distanceKm !== null && isNorwayCoordinate(lat, lon);
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);
}

function getMapFacilities() {
    const ownedFacilities = getFilteredFacilities().filter((facility) => {
        const lat = toNumber(facility.latitude);
        const lon = toNumber(facility.longitude);
        return isNorwayCoordinate(lat, lon);
    });

    const selected = getSelectedFacility();
    if (!selected) {
        return ownedFacilities;
    }

    const nearby = getNearbyFacilities().map((item) => item.facility);
    const merged = new Map();

    for (const facility of ownedFacilities) {
        merged.set(String(facility.id || ''), facility);
    }
    merged.set(String(selected.id || ''), selected);

    for (const facility of nearby) {
        merged.set(String(facility.id || ''), facility);
    }

    return [...merged.values()];
}

async function loadQuarantineAnalysisMap() {
    const now = Date.now();
    if (quarantineCache.byMmsi.size > 0 && (now - quarantineCache.ts) < QUARANTINE_CACHE_MS) {
        return quarantineCache.byMmsi;
    }

    try {
        const response = await fetch(`${API_BASE}/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const vessels = data?.vessels || [];
        const byMmsi = new Map();

        for (const vessel of vessels) {
            const mmsi = String(vessel?.mmsi || '').trim();
            if (!mmsi) continue;
            if (vessel?.quarantine_analysis) {
                byMmsi.set(mmsi, vessel.quarantine_analysis);
            }
        }

        quarantineCache = { ts: now, byMmsi };
        dataStatus.quarantine = 'api';
        return byMmsi;
    } catch (_) {
        quarantineCache = { ts: now, byMmsi: new Map() };
        dataStatus.quarantine = 'offline';
        return quarantineCache.byMmsi;
    }
}

function classifyAisRisk(vessel, distanceKm, quarantineByMmsi) {
    const mmsi = String(vessel?.mmsi || '').trim();
    const speed = Number(vessel?.speedOverGround ?? vessel?.speed ?? 0);
    const qa = mmsi ? quarantineByMmsi.get(mmsi) : null;
    const quarantineStatus = String(qa?.quarantine_status || '').toUpperCase();
    const cleared = mmsi ? isMmsiCleared(profile?.profileName, pilotActor, mmsi) : false;

    if (quarantineStatus === 'QUARANTINE_BREACH') {
        return { risk: true, label: 'Karantenebrudd', severity: 'danger' };
    }

    if (quarantineStatus === 'QUARANTINE_ACTIVE') {
        return { risk: true, label: 'Aktiv karantene', severity: 'warn' };
    }

    if (Number.isFinite(speed) && speed >= 10 && distanceKm <= 5) {
        return { risk: true, label: 'Høy fart nær anlegg', severity: 'warn' };
    }

    if (cleared) {
        return { risk: false, label: 'Klarert (grønn)', severity: 'ok' };
    }

    return { risk: false, label: 'Normal', severity: 'ok' };
}

/**
 * Fetch and cache last-known AIS positions for all Frøy (fleet) vessels in the profile.
 * Reads all AIS vessels and filters to those whose MMSI matches profile.vessels.
 */
async function loadFroyVesselPositions() {
    const now = Date.now();
    if (froyVesselCache.ts > 0 && (now - froyVesselCache.ts) < FROY_AIS_CACHE_MS) {
        return froyVesselCache.vessels;
    }

    const profileVessels = profile?.vessels || [];
    if (profileVessels.length === 0) {
        froyVesselCache = { ts: now, vessels: [] };
        return [];
    }

    const profileMmsiSet = new Set(profileVessels.map((v) => String(v?.mmsi || '').trim()).filter(Boolean));

    try {
        const response = await fetch(`${API_BASE}/api/vessels?limit=10000`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        const allVessels = Array.isArray(payload?.vessels) ? payload.vessels : [];

        // Keep latest position per MMSI (some entries may appear multiple times)
        const latestByMmsi = new Map();
        for (const v of allVessels) {
            const mmsi = String(v?.mmsi || '').trim();
            if (!mmsi || !profileMmsiSet.has(mmsi)) continue;
            const existing = latestByMmsi.get(mmsi);
            const tsNew = v?.msgtime ? new Date(v.msgtime).getTime() : 0;
            const tsOld = existing?.msgtime ? new Date(existing.msgtime).getTime() : 0;
            if (!existing || tsNew >= tsOld) {
                latestByMmsi.set(mmsi, v);
            }
        }

        const vessels = [...latestByMmsi.values()].map((v) => ({
            ...v,
            name: repairMojibakeText(v?.name || String(v?.mmsi || '') || 'Ukjent båt')
        }));

        froyVesselCache = { ts: now, vessels };
        return vessels;
    } catch (_) {
        froyVesselCache = { ts: now, vessels: [] };
        return [];
    }
}

async function loadNearbyAisForSelected() {
    const selected = getSelectedFacility();
    if (!selected) {
        nearbyAisVessels = [];
        nearbyAisRiskVessels = [];
        nearbyAisClearedVessels = [];
        dataStatus.ais = 'idle';
        return;
    }

    const lat = toNumber(selected.latitude);
    const lon = toNumber(selected.longitude);
    if (lat === null || lon === null) {
        nearbyAisVessels = [];
        nearbyAisRiskVessels = [];
        nearbyAisClearedVessels = [];
        dataStatus.ais = 'idle';
        return;
    }

    const key = `${selected.id}|${analysisRadiusKm}`;
    const now = Date.now();
    if (aisCache.key === key && (now - aisCache.ts) < AIS_CACHE_MS) {
        nearbyAisVessels = aisCache.nearby;
        nearbyAisRiskVessels = aisCache.risk;
        nearbyAisClearedVessels = aisCache.nearby.filter((item) => item.riskInfo.label === 'Klarert (grønn)');
        dataStatus.ais = 'cache';
        return;
    }

    try {
        const [vesselResponse, quarantineByMmsi] = await Promise.all([
            fetch(`${API_BASE}/api/vessels?limit=10000`),
            loadQuarantineAnalysisMap()
        ]);

        if (!vesselResponse.ok) {
            throw new Error(`HTTP ${vesselResponse.status}`);
        }

        const vesselPayload = await vesselResponse.json();
        const vessels = vesselPayload?.vessels || [];

        const nearby = vessels
            .map((vessel) => {
                const vesselLat = toNumber(vessel.latitude);
                const vesselLon = toNumber(vessel.longitude);
                if (vesselLat === null || vesselLon === null) return null;

                const distanceKm = haversineKm(lat, lon, vesselLat, vesselLon);
                if (distanceKm > analysisRadiusKm) return null;

                const riskInfo = classifyAisRisk(vessel, distanceKm, quarantineByMmsi);
                return {
                    vessel: { ...vessel, name: repairMojibakeText(vessel?.name || '') },
                    distanceKm,
                    riskInfo
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        const riskOnly = nearby
            .filter((item) => item.riskInfo.risk)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        const clearedOnly = nearby
            .filter((item) => item.riskInfo.label === 'Klarert (grønn)')
            .sort((a, b) => a.distanceKm - b.distanceKm);

        nearbyAisVessels = nearby;
        nearbyAisRiskVessels = riskOnly;
        nearbyAisClearedVessels = clearedOnly;
        aisCache = { key, ts: now, nearby, risk: riskOnly };
        dataStatus.ais = 'api';
    } catch (_) {
        nearbyAisVessels = [];
        nearbyAisRiskVessels = [];
        nearbyAisClearedVessels = [];
        dataStatus.ais = 'offline';
    }
}

async function loadNearbyLiceRiskForSelected() {
    const selected = getSelectedFacility();
    if (!selected) {
        nearbyLiceRiskVessels = [];
        dataStatus.lice = 'idle';
        return;
    }

    const lat = toNumber(selected.latitude);
    const lon = toNumber(selected.longitude);
    if (lat === null || lon === null) {
        nearbyLiceRiskVessels = [];
        dataStatus.lice = 'idle';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/vessels/at-lice-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const vessels = payload?.vessels || [];

        nearbyLiceRiskVessels = vessels
            .map((vessel) => {
                const vesselLat = toNumber(vessel?.latitude);
                const vesselLon = toNumber(vessel?.longitude);
                let distanceKm = null;

                if (vesselLat !== null && vesselLon !== null) {
                    distanceKm = haversineKm(lat, lon, vesselLat, vesselLon);
                } else {
                    const fallbackDistance = Number(vessel?.distance_km ?? vessel?.min_distance_km);
                    distanceKm = Number.isFinite(fallbackDistance) ? fallbackDistance : null;
                }

                if (distanceKm === null || distanceKm > analysisRadiusKm) return null;
                return { vessel, distanceKm };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        dataStatus.lice = 'api';
    } catch (_) {
        nearbyLiceRiskVessels = [];
        dataStatus.lice = 'offline';
    }
}

function renderRiskMiniBox() {
    const smitteEl = document.getElementById('smitteRiskMini');
    const liceEl = document.getElementById('liceRiskMini');
    if (!smitteEl || !liceEl) return;

    const selected = getSelectedFacility();
    if (!selected) {
        smitteEl.textContent = '-';
        smitteEl.className = 'risk-mini-value';
        liceEl.textContent = '-';
        liceEl.className = 'risk-mini-value';
        return;
    }

    const nearby = getNearbyFacilities();
    const infected = nearby.filter((item) => isFacilityInfected(item.facility)).length;
    const severe = nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level)).length;

    let smitteLevel = 'Lav';
    let smitteClass = 'ok';
    if (infected > 0 || severe >= 3) {
        smitteLevel = 'Høy';
        smitteClass = 'danger';
    } else if (severe > 0) {
        smitteLevel = 'Moderat';
        smitteClass = 'warn';
    }

    const liceCount = nearbyLiceRiskVessels.length;
    let liceLevel = 'Lav';
    let liceClass = 'ok';
    if (liceCount >= 3) {
        liceLevel = 'Høy';
        liceClass = 'danger';
    } else if (liceCount > 0) {
        liceLevel = 'Moderat';
        liceClass = 'warn';
    }

    smitteEl.textContent = `${smitteLevel} (${infected} smittede)`;
    smitteEl.className = `risk-mini-value ${smitteClass}`;

    liceEl.textContent = `${liceLevel} (${liceCount} risiko-båter)`;
    liceEl.className = `risk-mini-value ${liceClass}`;
}

function renderDataStatus() {
    const el = document.getElementById('dataStatusNote');
    const apiHealth = document.getElementById('apiHealthNote');
    if (!el) return;

    if (apiHealth) {
        const statusLabel = (name, value) => {
            if (value === 'api') return `${name}: API`;
            if (value === 'cache') return `${name}: Cache`;
            if (value === 'idle') return `${name}: Ikke aktiv`;
            if (value === 'offline') return `${name}: Offline`;
            return `${name}: Ukjent`;
        };
        apiHealth.textContent = [
            statusLabel('Sykdom', dataStatus.disease),
            statusLabel('AIS', dataStatus.ais),
            statusLabel('Karantene', dataStatus.quarantine),
            statusLabel('Klarering', dataStatus.clearances),
            statusLabel('Lus', dataStatus.lice)
        ].join(' · ');
        const offlineCount = [dataStatus.disease, dataStatus.ais, dataStatus.quarantine, dataStatus.clearances, dataStatus.lice]
            .filter((value) => value === 'offline').length;
        const tone = offlineCount === 0 ? 'ok' : (offlineCount >= 2 ? 'danger' : 'warn');
        apiHealth.className = `meta api-health-chip ${tone}`;
    }

    const offline = [];
    if (dataStatus.disease === 'offline') offline.push('Sykdomsdata');
    if (dataStatus.ais === 'offline') offline.push('AIS');
    if (dataStatus.quarantine === 'offline') offline.push('Karantene');
    if (dataStatus.clearances === 'offline') offline.push('Klarering');
    if (dataStatus.lice === 'offline') offline.push('Lus');

    if (offline.length === 0) {
        el.style.display = 'none';
        el.textContent = '';
        const boatsSource = document.getElementById('boatsDataSource');
        if (boatsSource) boatsSource.textContent = `Kilde: ${dataStatus.ais === 'cache' ? 'AIS cache' : 'API live'}`;
        const riskSource = document.getElementById('riskDataSource');
        const clearancesText = dataStatus.clearances === 'api'
            ? 'klarering API'
            : dataStatus.clearances === 'cache'
            ? 'klarering cache'
            : 'klarering fallback';
        const liceText = dataStatus.lice === 'api' ? 'lus API' : dataStatus.lice === 'idle' ? 'lus ikke aktiv' : 'lus fallback';
        if (riskSource) riskSource.textContent = `Kilde: ${dataStatus.disease === 'api' ? 'Sykdom API' : 'Lokal fallback'} + ${dataStatus.quarantine === 'api' ? 'karantene API' : 'karantene fallback'} + ${clearancesText} + ${liceText}`;
        return;
    }

    el.style.display = '';
    el.textContent = `API offline: ${offline.join(', ')}. Viser lokale/fallback-data der det finnes.`;
    const boatsSource = document.getElementById('boatsDataSource');
    if (boatsSource) boatsSource.textContent = `Kilde: ${dataStatus.ais === 'offline' ? 'Ingen live AIS (offline)' : 'AIS fallback/cache'}`;
    const riskSource = document.getElementById('riskDataSource');
    if (riskSource) riskSource.textContent = `Kilde: sykdom/karantene/lus fallback (API utilgjengelig)`;
}

function ensureSelectedFacilityOption() {
    const select = document.getElementById('selectedFacilityFilter');
    const options = getFilteredFacilities().filter((facility) => {
        const lat = toNumber(facility.latitude);
        const lon = toNumber(facility.longitude);
        return isNorwayCoordinate(lat, lon);
    });

    select.innerHTML = '';
    for (const facility of options) {
        const option = document.createElement('option');
        option.value = facility.id;
        option.textContent = facility.name;
        select.appendChild(option);
    }

    if (!selectedFacilityId || !options.some((item) => item.id === selectedFacilityId)) {
        selectedFacilityId = options[0]?.id || null;
    }

    if (selectedFacilityId) {
        select.value = selectedFacilityId;
    }
}

function populateFilters() {
    const municipalitySelect = document.getElementById('municipalityFilter');
    const companySelect = document.getElementById('companyFilter');

    const municipalities = new Set((profile.facilities || []).map((facility) => facility.municipality).filter(Boolean));
    const companies = profile.companies || [];

    for (const municipality of [...municipalities].sort()) {
        const option = document.createElement('option');
        option.value = municipality;
        option.textContent = municipality;
        municipalitySelect.appendChild(option);
    }

    for (const company of companies) {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        companySelect.appendChild(option);
    }

    if (activeCompanyId) {
        companySelect.value = activeCompanyId;
    }

    ensureSelectedFacilityOption();
}

function getFilteredFacilities() {
    const municipality = document.getElementById('municipalityFilter').value;
    const company = document.getElementById('companyFilter').value;
    const scopedCompany = activeCompanyId || company;

    return (profile.facilities || []).filter((facility) => {
        const lat = toNumber(facility.latitude);
        const lon = toNumber(facility.longitude);
        if (!isNorwayCoordinate(lat, lon)) return false;
        if (municipality && facility.municipality !== municipality) return false;
        if (scopedCompany && facility.companyId !== scopedCompany) return false;
        return true;
    });
}

function renderCards(facilities) {
    // Guard: card elements were removed from the lite layout – skip safely
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
    const nearby = getNearbyFacilities();
    set('cardFacilities', facilities.length);
    set('cardNearby', nearby.length);
    set('cardInfected', nearby.filter((item) => isFacilityInfected(item.facility)).length);
    set('cardSevere', nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level)).length);
    set('cardAisVessels', nearbyAisVessels.length);
    set('cardAisCleared', nearbyAisClearedVessels.length);
    set('cardAisRisk', nearbyAisRiskVessels.length);
}

function renderSelectedFacilityDetails() {
    const container = document.getElementById('selectedFacilityDetails');
    container.innerHTML = '';

    const selected = getSelectedFacility();
    if (!selected) {
        container.innerHTML = '<p class="empty">Velg anlegg for detaljer.</p>';
        return;
    }

    const nearby = getNearbyFacilities();
    const severe = nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level));
    const infected = nearby.filter((item) => isFacilityInfected(item.facility));
    const cards = [
        { label: 'Lokalitet', value: selected.name || '-' },
        { label: 'Kommune', value: selected.municipality || '-' },
        { label: 'Tilstand', value: getRiskBadgeText(selected) },
        { label: `Risiko innen ${analysisRadiusKm} km`, value: `${infected.length} smittede / ${severe.length} høy- eller ekstrem` },
        { label: 'AIS i radius', value: `${nearbyAisVessels.length} båter` },
        { label: 'Signert grønne båter', value: `${nearbyAisClearedVessels.length}` }
    ];

    for (const card of cards) {
        const div = document.createElement('div');
        div.className = 'detail-card';
        div.innerHTML = `<span class="label">${card.label}</span><div class="value">${card.value}</div>`;
        container.appendChild(div);
    }
}

function renderFacilityVisitRequests() {
    const list = document.getElementById('facilityVisitRequests');
    list.innerHTML = '';
    const selected = getSelectedFacility();
    if (!selected) {
        list.innerHTML = '<li>Velg anlegg for å se båtbesøk.</li>';
        return;
    }

    const visits = [...(profile.calendarEvents || [])]
        .filter((event) => event.facilityId === selected.id)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 12);

    if (visits.length === 0) {
        list.innerHTML = '<li>Ingen planlagte eller registrerte båtbesøk for valgt anlegg.</li>';
        return;
    }

    for (const visit of visits) {
        const li = document.createElement('li');
        const vesselName = vesselMap.get(visit.vesselId)?.name || visit.vesselId || 'Ukjent båt';
        li.textContent = `${isoToLocal(visit.start)} · ${vesselName} · ${visit.title || 'Besøk'}`;
        list.appendChild(li);
    }
}

function renderNearbyFacilityList() {
    const list = document.getElementById('nearbyFacilityList');
    const summary = document.getElementById('nearbyFacilitiesSummary');
    if (!list || !summary) return;
    list.innerHTML = '';

    const selected = getSelectedFacility();
    if (!selected) {
        summary.textContent = 'Velg anlegg.';
        list.innerHTML = '<li class="empty">Velg anlegg for å se nærliggende anlegg.</li>';
        return;
    }

    const nearby = getNearbyFacilitiesAll().slice(0, 30);
    summary.textContent = `${nearby.length} anlegg vist (sortert etter avstand)`;

    if (nearby.length === 0) {
        list.innerHTML = '<li class="empty">Ingen nærliggende anlegg med koordinater.</li>';
        return;
    }

    for (const item of nearby) {
        const badgeText = getRiskBadgeText(item.facility);
        let badgeClass = 'neutral';
        if (badgeText === 'Smittet') badgeClass = 'danger';
        else if (badgeText === 'Lus') badgeClass = 'lice';
        else if (badgeText === 'Ekstrem' || badgeText === 'Høy') badgeClass = 'warn';
        else if (badgeText === 'Lav' || badgeText === 'Moderat') badgeClass = 'ok';
        const calendarBadge = isFacilityCalendarEnabled(item.facility) ? '<span class="fpl-badge info">Kalender aktiv</span>' : '';

        const li = document.createElement('li');
        li.className = 'nearby-facility-row';
        li.innerHTML = `<span class="fpl-name">${item.facility.name}</span><span style="font-size:11px;color:var(--muted)">${item.distanceKm.toFixed(1)} km</span><span class="fpl-badge ${badgeClass}">${badgeText}</span>${calendarBadge}`;
        list.appendChild(li);
    }
}

function renderSmitteAnalysis() {
    const summary = document.getElementById('selectedSummary');
    const infectedList = document.getElementById('nearbyInfected');
    const liceList = document.getElementById('nearbyLice');
    const severeList = document.getElementById('nearbySevere');

    infectedList.innerHTML = '';
    if (liceList) liceList.innerHTML = '';
    severeList.innerHTML = '';

    const selected = getSelectedFacility();
    if (!selected) {
        summary.textContent = 'Velg anlegg for analyse.';
        return;
    }

    const nearby = getNearbyFacilities();
    const infected = nearby.filter((item) => isFacilityInfected(item.facility));
    const lice = nearby.filter((item) => getFacilityRiskSignals(item.facility).liceHigh);
    const severe = nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level));

    summary.textContent = `${selected.name}: ${nearby.length} anlegg innen ${analysisRadiusKm} km · ${infected.length} smittede · ${lice.length} høy lus · ${severe.length} høy/ekstrem risiko`;

    if (infected.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Ingen registrerte smittede anlegg.';
        infectedList.appendChild(li);
    } else {
        for (const item of infected.slice(0, 15)) {
            const li = document.createElement('li');
            li.className = 'nearby-risk-row';
            li.innerHTML = `${repairMojibakeText(item.facility.name)} · ${item.distanceKm.toFixed(1)} km${isFacilityCalendarEnabled(item.facility) ? ' · <span class="fpl-badge info">Kalender aktiv</span>' : ''}`;
            infectedList.appendChild(li);
        }
    }

    if (liceList) {
        if (lice.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Ingen anlegg med høy lusebelastning nærliggende.';
            liceList.appendChild(li);
        } else {
            for (const item of lice.slice(0, 15)) {
                const li = document.createElement('li');
                li.className = 'nearby-risk-row';
                li.innerHTML = `${repairMojibakeText(item.facility.name)} · ${item.distanceKm.toFixed(1)} km${isFacilityCalendarEnabled(item.facility) ? ' · <span class="fpl-badge lice">Lus</span>' : ''}`;
                liceList.appendChild(li);
            }
        }
    }

    if (severe.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Ingen anlegg med høy/ekstrem BW-risiko.';
        severeList.appendChild(li);
    } else {
        for (const item of severe.slice(0, 15)) {
            const risk = getFacilityRiskData(item.facility);
            const level = normalizeRiskLevel(risk?.risk_level);
            const li = document.createElement('li');
            li.className = 'nearby-risk-row';
            li.innerHTML = `${repairMojibakeText(item.facility.name)} · ${level} · ${item.distanceKm.toFixed(1)} km${isFacilityCalendarEnabled(item.facility) ? ' · <span class="fpl-badge info">Kalender aktiv</span>' : ''}`;
            severeList.appendChild(li);
        }
    }
}

function renderAisAnalysis() {
    const riskList = document.getElementById('nearbyAisRisk');
    const clearedList = document.getElementById('nearbyAisCleared');
    const categorySummary = document.getElementById('aisCategorySummary');
    if (!riskList || !clearedList) return;
    riskList.innerHTML = '';
    clearedList.innerHTML = '';
    if (categorySummary) categorySummary.textContent = 'Kategori: -';

    const selected = getSelectedFacility();
    if (!selected) return;

    if (nearbyAisRiskVessels.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Ingen risiko-båter identifisert akkurat nå.';
        riskList.appendChild(li);
    } else {
        const categoryCount = { smittet: 0, høy: 0, ukjent: 0 };
        for (const item of nearbyAisRiskVessels.slice(0, 20)) {
            const li = document.createElement('li');
            const name = item.vessel?.name || item.vessel?.mmsi || 'Ukjent båt';
            const speed = Number(item.vessel?.speedOverGround ?? item.vessel?.speed);
            const speedText = Number.isFinite(speed) ? `${speed.toFixed(1)} kn` : '-';
            const rawLabel = String(item?.riskInfo?.label || 'Ukjent').trim();
            let category = 'Ukjent';
            if (/karantene|brudd|smittet/i.test(rawLabel)) {
                category = 'Smittet/karantene';
                categoryCount.smittet += 1;
            } else if (/høy|fart|risiko|warn/i.test(rawLabel)) {
                category = 'Høy risiko';
                categoryCount.høy += 1;
            } else {
                categoryCount.ukjent += 1;
            }
            li.textContent = `${name} · ${category} (${rawLabel}) · ${item.distanceKm.toFixed(1)} km · ${speedText}`;
            riskList.appendChild(li);
        }
        if (categorySummary) {
            categorySummary.textContent = `Kategori: Smittet/karantene ${categoryCount.smittet} · Høy risiko ${categoryCount.høy} · Ukjent ${categoryCount.ukjent}`;
        }
    }

    if (nearbyAisClearedVessels.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Ingen klarerte (grønne) båter i området akkurat nå.';
        clearedList.appendChild(li);
    } else {
        for (const item of nearbyAisClearedVessels.slice(0, 20)) {
            const li = document.createElement('li');
            const name = item.vessel?.name || item.vessel?.mmsi || 'Ukjent båt';
            li.textContent = `${name} · Klarert · ${item.distanceKm.toFixed(1)} km`;
            clearedList.appendChild(li);
        }
    }
}

function calculateRiskSnapshot() {
    const selected = getSelectedFacility();
    if (!selected) {
        return {
            score: 0,
            level: 'Lav',
            levelClass: 'low',
            drivers: [],
            actions: ['Velg et anlegg for å se risikobildet.']
        };
    }

    const nearby = getNearbyFacilities();
    const infectedNearby = nearby.filter((item) => isFacilityInfected(item.facility));
    const severeNearby = nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level));
    const aisRisk = nearbyAisRiskVessels.length;
    const aisTotal = nearbyAisVessels.length;
    const selectedInfected = isFacilityInfected(selected);
    const selectedRisk = getFacilityRiskData(selected);
    const selectedSevere = isSevereRiskLevel(selectedRisk?.risk_level);

    let score = 0;
    if (selectedInfected) score += 45;
    else if (selectedSevere) score += 25;
    score += infectedNearby.length * 12;
    score += severeNearby.length * 8;
    score += aisRisk * 6;
    score += Math.min(10, Math.round(aisTotal * 0.2));
    score = Math.min(100, score);

    let level = 'Lav';
    let levelClass = 'low';
    if (score >= 75) {
        level = 'Ekstrem';
        levelClass = 'extreme';
    } else if (score >= 50) {
        level = 'Høy';
        levelClass = 'high';
    } else if (score >= 25) {
        level = 'Moderat';
        levelClass = 'moderate';
    }

    const drivers = [
        `Smittede anlegg innen ${analysisRadiusKm} km: ${infectedNearby.length}`,
        `Høy/Ekstrem anlegg innen ${analysisRadiusKm} km: ${severeNearby.length}`,
        `AIS risiko-båter innen ${analysisRadiusKm} km: ${aisRisk}`
    ];

    if (selectedInfected) {
        drivers.unshift('Valgt anlegg er registrert som smittet');
    } else if (selectedSevere) {
        drivers.unshift('Valgt anlegg har høy/ekstrem risiko-status');
    }

    const actions = [];
    if (selectedInfected) {
        actions.push('Skru opp beredskap: streng kontroll av alle anløp umiddelbart.');
    }
    if (aisRisk > 0) {
        actions.push('Følg opp AIS-risiko-båter og verifiser karantenestatus før anløp.');
    }
    if (infectedNearby.length > 0) {
        actions.push('Prioriter prøvetaking mot nærmeste smittede anlegg.');
    }
    if (severeNearby.length > 0) {
        actions.push('Reduser trafikk mot anlegg med høy/ekstrem risikovurdering.');
    }
    if (actions.length < 5) {
        actions.push('Oppdater AIS og sykdomsdata minst hver 2. minutt i aktiv drift.');
    }
    while (actions.length < 5) {
        actions.push('Bekreft tiltak i driftslogg og informer operatørteamet.');
    }

    return { score, level, levelClass, drivers: drivers.slice(0, 5), actions: actions.slice(0, 5) };
}

function renderRiskOverview() {
    const scoreLine = document.getElementById('riskScoreLine');
    const driversList = document.getElementById('riskDrivers');
    const actionsList = document.getElementById('priorityActions');

    driversList.innerHTML = '';
    actionsList.innerHTML = '';

    const selected = getSelectedFacility();
    if (!selected) {
        scoreLine.className = 'risk-score';
        scoreLine.textContent = 'Velg anlegg for risikobilde.';
        return;
    }

    const snapshot = calculateRiskSnapshot();
    scoreLine.className = `risk-score ${snapshot.levelClass}`;
    scoreLine.textContent = `${selected.name} · Score ${snapshot.score}/100 · ${snapshot.level}`;

    for (const text of snapshot.drivers) {
        const li = document.createElement('li');
        li.textContent = text;
        driversList.appendChild(li);
    }

    for (const action of snapshot.actions) {
        const li = document.createElement('li');
        li.textContent = action;
        actionsList.appendChild(li);
    }
}

function renderAlertCenter() {
    const summary = document.getElementById('facilityAlertSummary');
    const list = document.getElementById('facilityAlertList');
    if (!summary || !list) return;

    list.innerHTML = '';
    const selected = getSelectedFacility();
    if (!selected) {
        summary.textContent = 'Velg anlegg for å se operative varsler.';
        list.innerHTML = '<li class="empty">Ingen varsler uten valgt anlegg.</li>';
        return;
    }

    const alerts = [];
    const dateKey = getActivePlanningDateKey();
    const { start: dayStart, end: dayEnd } = getDayWindow(dateKey);
    const eventsToday = getFacilityCalendarEvents(selected.id).filter((event) => overlapsDay(event.start, event.end, dayStart, dayEnd));
    const dayMark = getFacilityStoredDayMark(selected.id, dateKey);

    if (isFacilityInfected(selected)) {
        alerts.push({ severity: 'alert', text: 'Sykdomsstatus registrert på dette anlegget i Barentswatch/Mattilsynet-data. Verifiser med offisiell kilde før besøk.' });
    }

    if (dayMark === 'red' && eventsToday.length > 0) {
        alerts.push({ severity: 'alert', text: `Valgt dag er markert opptatt (rød) men har ${eventsToday.length} planlagt(e) besøk.` });
    }

    if (nearbyAisRiskVessels.length > 0) {
        alerts.push({ severity: 'info', text: `${nearbyAisRiskVessels.length} båt(er) med uklar risikoklassifisering funnet i AIS-data innen radius. Metodikk kan inneholde usikkerheter.` });
    }

    if (dataStatus.ais === 'offline') {
        alerts.push({ severity: 'info', text: 'AIS-kilde er ikke tilgjengelig akkurat nå. Posisjoner kan være utdaterte.' });
    }

    if (nearbyAisClearedVessels.length === 0) {
        alerts.push({ severity: 'info', text: 'Ingen klarerte grønne båter funnet i nærheten akkurat nå.' });
    }

    if (alerts.length === 0) {
        alerts.push({ severity: 'ok', text: 'Ingen varsler for valgt anlegg og dato.' });
    }

    const warningCount = alerts.filter((item) => item.severity === 'alert').length;
    const infoCount = alerts.filter((item) => item.severity === 'info').length;

    summary.textContent = warningCount > 0 
        ? `${selected.name} · ${dateKey} · Varsel ${warningCount}${infoCount > 0 ? ` · Info ${infoCount}` : ''}`
        : `${selected.name} · ${dateKey} · OK`;

    for (const alert of alerts) {
        const li = document.createElement('li');
        li.className = alert.severity === 'alert'
            ? 'nearby-risk-row risk-high'
            : 'nearby-risk-row';
        li.textContent = `${alert.text}`;
        list.appendChild(li);
    }
}

function buildFacilityAlertSets(facilities = []) {
    const warningIds = new Set();
    const dateKey = getActivePlanningDateKey();
    const { start: dayStart, end: dayEnd } = getDayWindow(dateKey);
    const source = facilities.length > 0 ? facilities : getFacilityCatalog();

    for (const facility of source) {
        const facilityId = String(facility?.id || '').trim();
        if (!facilityId) continue;

        const eventsToday = getFacilityCalendarEvents(facilityId).filter((event) => overlapsDay(event.start, event.end, dayStart, dayEnd));
        const dayMark = getFacilityStoredDayMark(facilityId, dateKey);
        const signals = getFacilityRiskSignals(facility);

        if (signals.infected || signals.liceHigh || signals.ilaProtection || signals.ilaSurveillance || (dayMark === 'red' && eventsToday.length > 0)) {
            warningIds.add(facilityId);
        }
    }

    return { warningIds };
}

function renderRecentVisits() {
    const list = document.getElementById('recentVisits');
    list.innerHTML = '';

    const visits = [...(profile.calendarEvents || [])]
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .slice(0, 8);

    if (visits.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Ingen planlagte besøk.';
        list.appendChild(empty);
        return;
    }

    for (const visit of visits) {
        const li = document.createElement('li');
        const vesselName = vesselMap.get(visit.vesselId)?.name || visit.vesselId;
        const facilityName = (profile.facilities || []).find((item) => item.id === visit.facilityId)?.name || visit.facilityId;
        li.textContent = `${isoToLocal(visit.start)} · ${facilityName} · ${vesselName}`;
        list.appendChild(li);
    }
}

async function renderAll() {
    const marks = [];
    const start = performance.now();
    rebuildCalendarEnabledFacilityIds();
    renderCompanyScopeBadge();
    const clearanceResult = await refreshClearanceCache(profile.profileName, pilotActor);
    if (clearanceResult?.source === 'api') dataStatus.clearances = 'api';
    else if (clearanceResult?.source === 'memory') dataStatus.clearances = 'cache';
    else if (clearanceResult?.source === 'local-fallback') dataStatus.clearances = clearanceResult?.reason === 'timeout' ? 'cache' : 'offline';
    else dataStatus.clearances = 'cache';
    await loadNearbyAisForSelected();
    await loadNearbyLiceRiskForSelected();
    const froyVessels = await loadFroyVesselPositions();

    const facilities = getFilteredFacilities();
    const mapFacilities = getMapFacilities();
    const activeDateKey = normalizeDateKey(selectedCalendarDayKey) || getActivePlanningDateKey();
    const availableFacilityIds = new Set(
        mapFacilities
            .filter((facility) => getFacilityStoredDayMark(facility?.id, activeDateKey) === 'green')
            .map((facility) => String(facility?.id || '').trim())
            .filter(Boolean)
    );
    const demandFacilityIds = new Set();
    const demandCountByFacility = new Map();
    for (const facility of mapFacilities) {
        const facilityId = String(facility?.id || '').trim();
        if (!facilityId) continue;
        const count = getFacilityActiveDemandCount(facilityId);
        if (count > 0) {
            demandFacilityIds.add(facilityId);
            demandCountByFacility.set(facilityId, count);
        }
    }
    const selectableFacilityIds = new Set(facilities.map((item) => String(item?.id || '')).filter(Boolean));
    const infectedIds = new Set();
    const severeIds = new Set();
    const liceHighIds = new Set();
    const ilaProtectionIds = new Set();
    const ilaSurveillanceIds = new Set();

    for (const facility of mapFacilities) {
        const id = String(facility?.id || '').trim();
        if (!id) continue;
        const signals = getFacilityRiskSignals(facility);
        if (signals.infected) infectedIds.add(id);
        if (signals.liceHigh) liceHighIds.add(id);
        if (signals.ilaProtection) ilaProtectionIds.add(id);
        if (signals.ilaSurveillance) ilaSurveillanceIds.add(id);
    }

    const alertSets = buildFacilityAlertSets(mapFacilities);

    measureStep('info-bar', () => renderFacilityInfoBar(), marks);
    measureStep('jobs', () => showJobRequestPanel(), marks);
    measureStep('jobs-list', () => renderJobsList(), marks);
    measureStep('seven-day', () => renderSevenDayPlan(), marks);
    measureStep('facility-list', () => renderFacilityPickerList(), marks);
    measureStep('system-boats', () => renderSystemBoats(), marks);
    measureStep('mini-calendar', () => renderFacilityMiniCalendar(), marks);
    measureStep('boats', () => renderAvailableBoats(), marks);
    measureStep('nearby-list', () => renderNearbyFacilityList(), marks);
    measureStep('disease-analysis', () => renderSmitteAnalysis(), marks);
    measureStep('ais-analysis', () => renderAisAnalysis(), marks);
    measureStep('risk-mini', () => renderRiskMiniBox(), marks);
    measureStep('alert-center', () => renderAlertCenter(), marks);
    measureStep('data-status', () => renderDataStatus(), marks);
    measureStep('map', () => renderFacilityMiniMap(document.getElementById('facilityMap'), mapFacilities, {
        selectedFacilityId,
        analysisRadiusKm,
        fitToAllFacilities: !selectedFacilityId,
        infectedIds,
        severeIds,
        liceHighIds,
        ilaProtectionIds,
        ilaSurveillanceIds,
        demandFacilityIds,
        demandCountByFacility,
        availableFacilityIds,
        alertWarningIds: alertSets.warningIds,
        demoFacilityIds: calendarEnabledFacilityIds,
        selectableFacilityIds,
        nearbyVessels: nearbyAisVessels,
        nearbyRiskVessels: nearbyAisRiskVessels,
        nearbyClearedVessels: nearbyAisClearedVessels,
        froyVessels,
        onNearbyVesselClick: (vesselLike) => {
            const vesselId = resolveProfileVesselIdFromAis(vesselLike);
            if (!vesselId) {
                showToast('warning', 'Fant ikke båt', 'Kunne ikke koble AIS-båt til profilbåt for booking.');
                return;
            }
            selectedBoatForBookingId = vesselId;
            updateBookingSelectionMeta();
            renderAvailableBoats();
            showToast('info', 'Båt valgt fra kart', `${vesselMap.get(vesselId)?.name || vesselId} valgt for booking.`);
        },
        onFacilityClick: (facilityId) => {
            if (!facilityId || facilityId === selectedFacilityId) return;
            selectedFacilityId = facilityId;
            const sel = document.getElementById('selectedFacilityFilter');
            if (sel) sel.value = facilityId;
            aisCache = { key: null, ts: 0, nearby: [], risk: [] };
            renderAll();
        }
    }), marks);

    window.__pilotLiteLastRender = {
        page: 'facility',
        totalMs: Number((performance.now() - start).toFixed(1)),
        marks
    };
}

function renderFacilityInfoBar() {
    const bar = document.getElementById('facilityInfoBar');
    const typeMeta = document.getElementById('facilityTypeMeta');
    if (!bar) return;
    bar.innerHTML = '';

    const selected = getSelectedFacility();
    if (!selected) {
        const msg = document.createElement('span');
        msg.className = 'empty';
        msg.textContent = 'Velg et anlegg fra listen for å se detaljer.';
        bar.appendChild(msg);
        if (typeMeta) typeMeta.textContent = 'Type drift: -';
        return;
    }

    const nearby = getNearbyFacilities();
    const infectedCount = nearby.filter((item) => isFacilityInfected(item.facility)).length;
    const severeCount = nearby.filter((item) => isSevereRiskLevel(getFacilityRiskData(item.facility)?.risk_level)).length;
    const signals = getFacilityRiskSignals(selected);
    const demandCount = getFacilityActiveDemandCount(selected.id);
    const recommendedCount = getFacilityRecommendedDemandCount(selected);
    const productionType = repairMojibakeText(String(selected?.production_type || selected?.productionType || selected?.fdir?.production_type || selected?.fdir?.species || '-'));
    const liceAdultFemale = getFirstFiniteNumber(selected, [
        'liceAdultFemale', 'lice.adult_female', 'adult_female_lice',
        'fdir.liceAdultFemale', 'fdir.lice_adult_female'
    ]);
    const liceTotal = getFirstFiniteNumber(selected, [
        'liceTotal', 'lice.total', 'total_lice',
        'fdir.liceTotal', 'fdir.lice_total'
    ]);
    const maxAllowedBiomass = getFirstFiniteNumber(selected, [
        'fdir.maxAllowedBiomass', 'fdir.max_allowed_biomass', 'fdir.mab',
        'maxAllowedBiomass', 'max_allowed_biomass', 'mab'
    ]);
    const riskText = getRiskBadgeText(selected);
    let riskClass = '';
    if (riskText === 'Smittet') riskClass = 'danger';
    else if (riskText === 'Ekstrem' || riskText === 'Høy') riskClass = 'warn';
    else if (riskText === 'Lav' || riskText === 'Moderat') riskClass = 'ok';

    const items = [
        { label: 'Anlegg', value: repairMojibakeText(selected.name), cls: '' },
        { label: 'Kommune', value: repairMojibakeText(selected.municipality || '-'), cls: '' },
        { label: 'Produksjon', value: productionType || '-', cls: '' },
        { label: 'Smittestatus', value: signals.infected ? 'Smittet' : 'Ikke smittet', cls: signals.infected ? 'danger' : 'ok' },
        { label: 'Sone', value: signals.ilaProtection ? 'ILA vernesone' : signals.ilaSurveillance ? 'ILA overvåkning' : 'Ingen', cls: (signals.ilaProtection || signals.ilaSurveillance) ? 'warn' : 'ok' },
        { label: 'Tilstand', value: riskText, cls: riskClass },
        { label: 'Lusetall (hunn/total)', value: `${Number.isFinite(liceAdultFemale) ? liceAdultFemale.toFixed(2) : '-'} / ${Number.isFinite(liceTotal) ? liceTotal.toFixed(2) : '-'}`, cls: signals.liceHigh ? 'warn' : '' },
        { label: 'MAB', value: Number.isFinite(maxAllowedBiomass) ? `${Math.round(maxAllowedBiomass)} kg` : '-', cls: '' },
        { label: 'Aktive etterspørsler', value: String(demandCount), cls: demandCount > 0 ? 'warn' : 'ok' },
        { label: 'Anbefalte bestillinger (30d)', value: String(recommendedCount), cls: recommendedCount > 0 ? 'warn' : 'ok' },
        { label: `Smittede (${analysisRadiusKm} km)`, value: String(infectedCount), cls: infectedCount > 0 ? 'danger' : 'ok' },
        { label: `Høy/Ekstrem (${analysisRadiusKm} km)`, value: String(severeCount), cls: severeCount > 0 ? 'warn' : 'ok' }
    ];

    for (const item of items) {
        const div = document.createElement('div');
        div.className = 'fi-item';
        div.innerHTML = `<span class="fi-label">${item.label}</span><span class="fi-value ${item.cls}">${item.value}</span>`;
        bar.appendChild(div);
    }

    if (typeMeta) {
        const tags = Array.isArray(selected.tags) ? selected.tags.filter(Boolean) : [];
        const tagText = tags.length > 0 ? tags.join(', ') : 'Ikke oppgitt';
        typeMeta.textContent = `Type drift: ${tagText}`;
    }
}

function facilityHasUpcomingEvents(facilityId) {
    const now = Date.now() - 86400000; // include today's events
    return getFacilityCalendarEvents(facilityId).some(
        (event) => new Date(event.start).getTime() >= now
    );
}

function jumpToFirstPlannedVisit() {
    const selected = getSelectedFacility();
    if (!selected) {
        showToast('info', 'Ingen valgt anlegg', 'Velg et anlegg først.');
        return;
    }

    const now = Date.now();
    const upcoming = getFacilityCalendarEvents(selected.id)
        .filter((event) => new Date(event.start).getTime() >= now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (upcoming.length === 0) {
        showToast('info', 'Ingen planlagte besøk', 'Fant ingen kommende besøk for valgt anlegg.');
        return;
    }

    const first = new Date(upcoming[0].start);
    calendarViewYear = first.getFullYear();
    calendarViewMonth = first.getMonth();
    selectedCalendarDayKey = `${first.getFullYear()}-${first.getMonth()}-${first.getDate()}`;
    renderFacilityMiniCalendar();
}

function renderFacilityPickerList() {
    const list = document.getElementById('facilityPickerList');
    if (!list) return;
    list.innerHTML = '';

    const showOnlyActive = document.getElementById('activeFacilitiesOnly')?.checked === true;
    const baseFacilities = getFilteredFacilities();
    let facilities = showOnlyActive
        ? baseFacilities.filter((facility) => facilityHasUpcomingEvents(facility.id) || isFacilityCalendarEnabled(facility) || getFacilityActiveDemandCount(facility.id) > 0)
        : baseFacilities;

    if (showOnlyActive && selectedFacilityId && !facilities.some((facility) => String(facility.id) === String(selectedFacilityId))) {
        const selectedFacility = baseFacilities.find((facility) => String(facility.id) === String(selectedFacilityId));
        if (selectedFacility) facilities = [selectedFacility, ...facilities];
    }

    facilities = facilities.slice().sort((a, b) => {
        const aDisease = (isFacilityInfected(a) || getFacilityRiskSignals(a).ilaProtection || getFacilityRiskSignals(a).ilaSurveillance) ? 1 : 0;
        const bDisease = (isFacilityInfected(b) || getFacilityRiskSignals(b).ilaProtection || getFacilityRiskSignals(b).ilaSurveillance) ? 1 : 0;
        if (aDisease !== bDisease) return bDisease - aDisease;
        const aDemand = getFacilityActiveDemandCount(a.id) > 0 ? 1 : 0;
        const bDemand = getFacilityActiveDemandCount(b.id) > 0 ? 1 : 0;
        if (aDemand !== bDemand) return bDemand - aDemand;
        const aRecommended = getFacilityRecommendedDemandCount(a) > 0 ? 1 : 0;
        const bRecommended = getFacilityRecommendedDemandCount(b) > 0 ? 1 : 0;
        if (aRecommended !== bRecommended) return bRecommended - aRecommended;
        const aActive = (facilityHasUpcomingEvents(a.id) || isFacilityCalendarEnabled(a)) ? 1 : 0;
        const bActive = (facilityHasUpcomingEvents(b.id) || isFacilityCalendarEnabled(b)) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'nb-NO');
    });

    if (facilities.length === 0) {
        list.innerHTML = `<li style="color:var(--muted);font-size:12px;padding:8px">${showOnlyActive ? 'Ingen aktive anlegg med kalenderbruk akkurat nå.' : 'Ingen anlegg i profil.'}</li>`;
        return;
    }

    for (const facility of facilities) {
        const li = document.createElement('li');
        if (facility.id === selectedFacilityId) li.classList.add('selected-row');

        const riskBadges = getFacilityRiskBadges(facility);

        const hasAlert = facilityHasUpcomingEvents(facility.id);
        const isCalendarActive = isFacilityCalendarEnabled(facility);
        const demandCount = getFacilityActiveDemandCount(facility.id);
        const recommendedCount = getFacilityRecommendedDemandCount(facility);
        const alertDot = hasAlert ? '<span class="fpl-alert-dot" title="Planlagte besøk"></span>' : '';
        const activeDot = `<span class="fpl-state-dot ${isCalendarActive ? 'active' : 'inactive'}" title="${isCalendarActive ? 'Aktiv kalender' : 'Ikke aktiv kalender'}"></span>`;
        const demandBadge = demandCount > 0 ? `<span class="fpl-badge warn">Etterspørsel ${demandCount}</span>` : '';
        const recommendedBadge = recommendedCount > 0 ? `<span class="fpl-badge ok">Anbefalt ${recommendedCount}</span>` : '';
        const riskBadgeHtml = riskBadges.map((item) => `<span class="fpl-badge ${item.cls}">${item.text}</span>`).join('');

        li.innerHTML = `${alertDot}${activeDot}<span class="fpl-name">${repairMojibakeText(facility.name)}</span>${riskBadgeHtml}${demandBadge}${recommendedBadge}`;
        li.addEventListener('click', () => {
            selectedFacilityId = facility.id;
            const sel = document.getElementById('selectedFacilityFilter');
            if (sel) sel.value = facility.id;
            aisCache = { key: null, ts: 0, nearby: [], risk: [] };
            renderAll();
        });
        list.appendChild(li);
    }
}

function renderSystemBoats() {
    const list = document.getElementById('systemBoatsList');
    if (!list || !profile || !profile.vessels || profile.vessels.length === 0) return;

    const selected = getSelectedFacility();
    const dateKey = getActivePlanningDateKey();
    const boatZoneRadiusKm = Number(document.getElementById('boatZoneRadius')?.value || 30) || 30;
    const aisByMmsi = new Map(
        nearbyAisVessels
            .map((item) => {
                const mmsi = String(item?.vessel?.mmsi || '').trim();
                return mmsi ? [mmsi, item] : null;
            })
            .filter(Boolean)
    );

    const rows = (profile.vessels || [])
        .slice()
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'nb-NO'))
        .map((vessel) => {
            const mmsi = String(vessel?.mmsi || '').trim();
            const planned = selected ? getVesselPlannedZoneAvailability(vessel, selected, dateKey, boatZoneRadiusKm) : null;
            const aisNow = mmsi ? aisByMmsi.get(mmsi) : null;
            const mode = getManualBoatAvailability(vessel.id);

            let statusClass = 'neutral';
            let statusText = 'Ukjent';

            if (mode === 'unavailable') {
                statusClass = 'danger';
                statusText = 'Manuell: ikke ledig';
            } else if (mode === 'available') {
                statusClass = 'ok';
                statusText = 'Manuell: ledig';
            } else if (planned) {
                statusClass = planned.busyOnDate ? 'warn' : 'ok';
                statusText = planned.busyOnDate ? 'Opptatt valgt dato' : 'Ledig i plan';
            } else if (aisNow) {
                statusClass = 'neutral';
                statusText = `AIS ${aisNow.distanceKm.toFixed(1)} km`;
            }

            return `
                <li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);">
                    <span style="min-width:0;display:grid;gap:2px;flex:1;">
                        <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${vessel?.name || 'Ukjent båt'}</span>
                        <span style="font-size:11px;color:var(--muted);">${vessel?.mmsi ? vessel.mmsi : 'Ingen MMSI'} · ${getVesselCategory(vessel)}</span>
                    </span>
                    <span class="fpl-badge ${statusClass}">${statusText}</span>
                </li>
            `;
        });

    list.innerHTML = rows.join('');
}


function renderFacilityMiniCalendar() {
    const panel = document.getElementById('facilityCalendarPanel');
    const container = document.getElementById('facilityMiniCalendar');
    const nameEl = document.getElementById('calFacilityName');
    const dayInfoEl = document.getElementById('calDayInfo');
    if (!panel || !container) return;

    const selected = getSelectedFacility();
    if (!selected) {
        panel.style.display = 'none';
        renderCalendarAutoSetupControls(null);
        return;
    }
    panel.style.display = '';
    renderCalendarAutoSetupControls(selected);
    if (nameEl) nameEl.textContent = selected.name;

    const now = new Date();
    if (calendarViewYear === null || calendarViewMonth === null) {
        calendarViewYear = now.getFullYear();
        calendarViewMonth = now.getMonth();
    }
    const year = calendarViewYear;
    const month = calendarViewMonth;

    const events = getFacilityCalendarEvents(selected.id);
    const autoReminderByDay = getAutoReminderMapByLegacyDateKey(selected);
    const eventCountByDay = new Map();
    const eventsByDay = new Map();
    for (const event of events) {
        const d = new Date(event.start);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        eventCountByDay.set(key, (eventCountByDay.get(key) || 0) + 1);
        const arr = eventsByDay.get(key) || [];
        arr.push(event);
        eventsByDay.set(key, arr);
    }
    const eventDays = new Set(eventCountByDay.keys());

    const storageKey = `facilityCalDays_${selected.id}`;
    let markedDays = {};
    try { markedDays = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) {}

    const monthNames = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayRaw = new Date(year, month, 1).getDay();
    const mondayFirst = (firstDayRaw + 6) % 7;

    let html = '<div class="mini-cal-toolbar">';
    html += '<button type="button" class="mini-cal-nav" data-cal-nav="prev" aria-label="Forrige måned">‹</button>';
    html += `<div class="mini-cal-header">${monthNames[month]} ${year}</div>`;
    html += '<button type="button" class="mini-cal-nav" data-cal-nav="next" aria-label="Neste måned">›</button>';
    html += '</div>';
    html += '<div class="mini-cal-grid">';
    ['Ma','Ti','On','To','Fr','Lø','Sø'].forEach((d) => { html += `<span class="mini-cal-dow">${d}</span>`; });
    for (let i = 0; i < mondayFirst; i++) html += '<span></span>';

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${month}-${day}`;
        const hasEvent = eventDays.has(dateKey);
        const autoReminders = autoReminderByDay.get(dateKey) || [];
        const hasAutoReminder = autoReminders.length > 0;
        const eventCount = eventCountByDay.get(dateKey) || 0;
        const normalizedDate = `${year}-${pad2(month + 1)}-${pad2(day)}`;
        const mark = getFacilityStoredDayMark(selected.id, normalizedDate);
        let cls = 'mini-cal-day';
        if (mark === 'green') cls += ' cal-green';
        else if (mark === 'red') cls += ' cal-red';
        if (hasEvent || hasAutoReminder) cls += ' cal-has-event';
        if (selectedCalendarDayKey === dateKey) cls += ' cal-selected';
        if (day === now.getDate() && month === now.getMonth() && year === now.getFullYear()) cls += ' cal-today';
        const title = `${hasEvent ? `${eventCount} planlagt${eventCount > 1 ? 'e' : ''} besøk` : 'Ingen planlagte besøk'}${hasAutoReminder ? ` · ${autoReminders.length} auto-regel${autoReminders.length > 1 ? 'er' : ''}` : ''}`;
        html += `<span class="${cls}" data-date="${dateKey}" title="${title}">${day}${eventCount > 1 ? `<span class="cal-count">${eventCount}</span>` : ''}</span>`;
    }
    html += '</div>';
    container.innerHTML = html;
    updateSelectedDayLabel();
    updateBookingSelectionMeta();

    container.querySelectorAll('.mini-cal-nav').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.calNav === 'prev') {
                calendarViewMonth -= 1;
                if (calendarViewMonth < 0) {
                    calendarViewMonth = 11;
                    calendarViewYear -= 1;
                }
            } else {
                calendarViewMonth += 1;
                if (calendarViewMonth > 11) {
                    calendarViewMonth = 0;
                    calendarViewYear += 1;
                }
            }
            renderFacilityMiniCalendar();
        });
    });

    const renderDayInfo = (dateKey) => {
        if (!dayInfoEl) return;
        const normalizedDateKey = normalizeDateKey(dateKey);
        const dayAutoReminders = autoReminderByDay.get(dateKey) || [];
        const requiredReminders = dayAutoReminders.filter((item) => item.tier === 'requirement');
        const recommendedReminders = dayAutoReminders.filter((item) => item.tier === 'recommended');

        const renderReminderList = (items = [], tierLabel = '') => {
            if (!items.length) return '';
            const tierClass = tierLabel === 'Krav (regelstyrt)' ? 'requirement' : 'recommended';
            const rows = items.map((item) => {
                const severityClass = item.severity === 'danger' ? 'danger' : (item.severity === 'warn' ? 'warn' : 'neutral');
                const actionBtn = `
                    <button
                        type="button"
                        class="cal-rule-action"
                        data-auto-request="${item.suggestionType || ''}"
                        data-auto-date="${item.dateKey || normalizedDateKey || ''}"
                        data-auto-start="${item.actionStartDate || item.dateKey || normalizedDateKey || ''}"
                        data-auto-end="${item.actionEndDate || item.dateKey || normalizedDateKey || ''}"
                        data-auto-title="${String(item.title || '').replace(/"/g, '&quot;')}"
                    >${item.actionLabel || 'Legg i etterspørsel'}</button>
                `;
                return `
                    <li class="cal-rule-item ${tierClass}">
                        <div class="cal-rule-head"><span class="cal-summary-pill ${severityClass}">${item.title}</span><span class="cal-rule-date">Frist: ${item.dateKey || '-'}</span></div>
                        <div class="cal-rule-detail">${item.detail || ''}</div>
                        <div class="cal-rule-source">Kilde: ${item.source || '-'}</div>
                        ${actionBtn}
                    </li>
                `;
            }).join('');
            return `
                <div class="cal-rule-section ${tierClass}">
                    <div class="cal-rule-title">${tierLabel}</div>
                    <ul class="cal-rule-list">${rows}</ul>
                </div>
            `;
        };

        const reminderBlock = (requiredReminders.length || recommendedReminders.length)
            ? `<div class="cal-reminder-wrap">${renderReminderList(requiredReminders, 'Krav (regelstyrt)')}${renderReminderList(recommendedReminders, 'Anbefalt (driftsregel)')}</div>`
            : '';

        const dateParts = dateKey.split('-').map((x) => Number(x));
        const dateObj = new Date(dateParts[0], dateParts[1], dateParts[2]);
        const heading = Number.isFinite(dateObj.getTime())
            ? dateObj.toLocaleDateString('nb-NO', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
            : dateKey;

        const dayEvents = eventsByDay.get(dateKey) || [];
        if (dayEvents.length === 0 && !reminderBlock) {
            dayInfoEl.className = 'cal-day-info empty';
            dayInfoEl.innerHTML = `<strong>${heading}</strong><br>Ingen planlagte besøk.`;
            return;
        }

        if (dayEvents.length === 0 && reminderBlock) {
            dayInfoEl.className = 'cal-day-info';
            dayInfoEl.innerHTML = `<strong>${heading}</strong><br><span class="cal-day-meta">Ingen planlagte besøk</span>${reminderBlock}`;
            dayInfoEl.onclick = (evt) => {
                const autoBtn = evt.target.closest('button[data-auto-request]');
                if (!autoBtn) return;
                const autoType = autoBtn.dataset.autoRequest || '';
                const autoDate = autoBtn.dataset.autoDate || normalizedDateKey;
                const autoStart = autoBtn.dataset.autoStart || autoDate;
                const autoEnd = autoBtn.dataset.autoEnd || autoDate;
                const autoTitle = autoBtn.dataset.autoTitle || '';

                createOrUpdateJobRequestFromAutoReminder({ autoType, autoDate, autoStart, autoEnd, autoTitle });
            };
            return;
        }

        const quickModeButtons = `
            <div class="cal-quick-row">
                <button type="button" class="cal-quick-btn ${calendarQuickMode === 'all' ? 'active' : ''}" data-cal-quick="all">Alle</button>
                <button type="button" class="cal-quick-btn ${calendarQuickMode === 'pending-first' ? 'active' : ''}" data-cal-quick="pending-first">Pending først</button>
                <button type="button" class="cal-quick-btn ${calendarQuickMode === 'unresolved-only' ? 'active' : ''}" data-cal-quick="unresolved-only">Kun uløste</button>
            </div>
        `;

        const statusCounters = dayEvents.reduce((acc, event) => {
            const key = String(event.status || 'planned').toLowerCase();
            if (!acc[key]) acc[key] = 0;
            acc[key] += 1;
            return acc;
        }, {});
        const summaryLine = `
            <div class="cal-status-summary">
                <span class="cal-summary-pill neutral">Totalt: ${dayEvents.length}</span>
                <span class="cal-summary-pill neutral">Planlagt: ${statusCounters.planned || 0}</span>
                <span class="cal-summary-pill ok">Godkjent: ${statusCounters.approved || 0}</span>
                <span class="cal-summary-pill danger">Avvist: ${statusCounters.rejected || 0}</span>
                <span class="cal-summary-pill warn">Alternativ: ${statusCounters.alternative_suggested || 0}</span>
            </div>
        `;

        const filterButtons = `
            <div class="cal-filter-row">
                <button type="button" class="cal-filter-btn ${calendarStatusFilter === 'all' ? 'active' : ''}" data-cal-filter="all">Alle</button>
                <button type="button" class="cal-filter-btn ${calendarStatusFilter === 'planned' ? 'active' : ''}" data-cal-filter="planned">Planlagt</button>
                <button type="button" class="cal-filter-btn ${calendarStatusFilter === 'approved' ? 'active' : ''}" data-cal-filter="approved">Godkjent</button>
                <button type="button" class="cal-filter-btn ${calendarStatusFilter === 'rejected' ? 'active' : ''}" data-cal-filter="rejected">Avvist</button>
                <button type="button" class="cal-filter-btn ${calendarStatusFilter === 'alternative_suggested' ? 'active' : ''}" data-cal-filter="alternative_suggested">Alternativ</button>
            </div>
        `;

        let candidateEvents = dayEvents.slice();
        if (calendarQuickMode === 'unresolved-only') {
            candidateEvents = candidateEvents.filter((event) => isUnresolvedStatus(event.status || 'planned'));
        } else if (calendarQuickMode === 'pending-first') {
            const priority = (event) => {
                const status = String(event.status || 'planned').toLowerCase();
                if (status === 'planned') return 0;
                if (status === 'alternative_suggested') return 1;
                if (status === 'approved') return 2;
                if (status === 'rejected') return 3;
                return 4;
            };
            candidateEvents.sort((a, b) => {
                const p = priority(a) - priority(b);
                if (p !== 0) return p;
                return new Date(a.start).getTime() - new Date(b.start).getTime();
            });
        }

        const visibleEvents = candidateEvents.filter((event) => (
            calendarStatusFilter === 'all' || String(event.status || 'planned').toLowerCase() === calendarStatusFilter
        ));

        if (visibleEvents.length === 0) {
            dayInfoEl.className = 'cal-day-info';
            dayInfoEl.innerHTML = `<strong>${heading}</strong><br><span class="cal-day-meta">${dayEvents.length} planlagt${dayEvents.length > 1 ? 'e' : ''} besøk</span>${summaryLine}${reminderBlock}${quickModeButtons}${filterButtons}<div class="empty" style="margin-top:6px">Ingen besøk matcher valgt filter/modus.</div>`;
            return;
        }

        const lines = visibleEvents
            .slice()
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
            .map((event) => {
                const vesselName = vesselMap.get(event.vesselId)?.name || event.vesselId || 'Ukjent fartøy';
                const from = isoToLocal(event.start);
                const to = isoToLocal(event.end);
                const statusRaw = String(event.status || '').toLowerCase();
                const status = getVisitStatusLabel(statusRaw);
                const statusClass = getVisitStatusClass(statusRaw);
                const contact = event.contact_person || event.contact || '';
                const notes = event.comment || event.notes || '';
                const hasOverride = Boolean(calendarEventOverrides[event._eventKey]);
                const actionButtons = `
                    <div class="cal-actions" data-event-key="${event._eventKey}">
                        <button type="button" class="cal-act-btn ok" data-cal-action="approve" data-event-key="${event._eventKey}">Godkjenn</button>
                        <button type="button" class="cal-act-btn warn" data-cal-action="alternative" data-event-key="${event._eventKey}">Foreslå alternativ</button>
                        <button type="button" class="cal-act-btn danger" data-cal-action="reject" data-event-key="${event._eventKey}">Avvis</button>
                        ${hasOverride ? `<button type="button" class="cal-act-btn" data-cal-action="undo" data-event-key="${event._eventKey}">Angre</button>` : ''}
                    </div>
                `;
                const rejectEditor = `
                    <div class="cal-inline-editor" data-editor="reject" data-event-key="${event._eventKey}" style="display:none">
                        <label>Årsak</label>
                        <textarea data-field="reason" data-event-key="${event._eventKey}" rows="2" placeholder="Valgfri begrunnelse">${event.comment || ''}</textarea>
                        <div class="cal-inline-actions">
                            <button type="button" class="cal-act-btn danger" data-cal-submit="reject" data-event-key="${event._eventKey}">Bekreft avvisning</button>
                            <button type="button" class="cal-act-btn" data-cal-cancel="reject" data-event-key="${event._eventKey}">Avbryt</button>
                        </div>
                    </div>
                `;
                const alternativeEditor = `
                    <div class="cal-inline-editor" data-editor="alternative" data-event-key="${event._eventKey}" style="display:none">
                        <div class="cal-inline-grid">
                            <label>Dato<input type="date" data-field="alternativeDate" data-event-key="${event._eventKey}" value="${event.alternativeDate || (event.start ? new Date(event.start).toISOString().slice(0, 10) : '')}"></label>
                            <label>Tid<input type="time" data-field="alternativeTime" data-event-key="${event._eventKey}" value="${event.alternativeTime || (event.start ? new Date(event.start).toTimeString().slice(0, 5) : '08:00')}"></label>
                        </div>
                        <label>Kommentar</label>
                        <textarea data-field="comment" data-event-key="${event._eventKey}" rows="2" placeholder="Valgfri kommentar">${event.comment || ''}</textarea>
                        <div class="cal-inline-actions">
                            <button type="button" class="cal-act-btn warn" data-cal-submit="alternative" data-event-key="${event._eventKey}">Send forslag</button>
                            <button type="button" class="cal-act-btn" data-cal-cancel="alternative" data-event-key="${event._eventKey}">Avbryt</button>
                        </div>
                    </div>
                `;
                const alternativeLine = event.alternativeDate
                    ? `<br>Alternativ: ${event.alternativeDate}${event.alternativeTime ? ` ${event.alternativeTime}` : ''}`
                    : '';
                return `<li><strong>${vesselName}</strong> · <span class="cal-status ${statusClass}">${status}</span><br>${from}${event.end ? ` → ${to}` : ''}${contact ? `<br>Kontakt: ${contact}` : ''}${notes ? `<br>Notat: ${notes}` : ''}${alternativeLine}${actionButtons}${rejectEditor}${alternativeEditor}</li>`;
            })
            .join('');

        dayInfoEl.className = 'cal-day-info';
        dayInfoEl.innerHTML = `<strong>${heading}</strong><br><span class="cal-day-meta">${dayEvents.length} planlagt${dayEvents.length > 1 ? 'e' : ''} besøk</span>${summaryLine}${reminderBlock}${quickModeButtons}${filterButtons}<ul>${lines}</ul>`;

        dayInfoEl.onclick = async (evt) => {
            const autoBtn = evt.target.closest('button[data-auto-request]');
            if (autoBtn) {
                const autoType = autoBtn.dataset.autoRequest || '';
                const autoDate = autoBtn.dataset.autoDate || normalizedDateKey;
                const autoStart = autoBtn.dataset.autoStart || autoDate;
                const autoEnd = autoBtn.dataset.autoEnd || autoDate;
                const autoTitle = autoBtn.dataset.autoTitle || '';

                createOrUpdateJobRequestFromAutoReminder({ autoType, autoDate, autoStart, autoEnd, autoTitle });
                return;
            }

            const quickBtn = evt.target.closest('button[data-cal-quick]');
            if (quickBtn) {
                calendarQuickMode = quickBtn.dataset.calQuick || 'all';
                renderDayInfo(dateKey);
                return;
            }

            const filterBtn = evt.target.closest('button[data-cal-filter]');
            if (filterBtn) {
                calendarStatusFilter = filterBtn.dataset.calFilter || 'all';
                renderDayInfo(dateKey);
                return;
            }

            const actionBtn = evt.target.closest('button[data-cal-action]');
            const submitBtn = evt.target.closest('button[data-cal-submit]');
            const cancelBtn = evt.target.closest('button[data-cal-cancel]');

            const toggleEditor = (eventKey, editorType, open) => {
                const editor = dayInfoEl.querySelector(`.cal-inline-editor[data-editor="${editorType}"][data-event-key="${eventKey}"]`);
                if (editor) editor.style.display = open ? '' : 'none';
            };

            if (actionBtn) {
                const action = actionBtn.dataset.calAction;
                const eventKey = actionBtn.dataset.eventKey;
                const targetEvent = dayEvents.find((item) => item._eventKey === eventKey);
                if (!targetEvent) return;

                if (action === 'approve') {
                    try {
                        await applyCalendarAction(targetEvent, 'approve');
                        renderFacilityMiniCalendar();
                    } catch (error) {
                        showToast('error', 'Kunne ikke oppdatere besøk', error?.message || 'Ukjent feil');
                    }
                    return;
                }

                if (action === 'undo') {
                    try {
                        await applyCalendarAction(targetEvent, 'undo');
                        renderFacilityMiniCalendar();
                    } catch (error) {
                        showToast('error', 'Kunne ikke angre endring', error?.message || 'Ukjent feil');
                    }
                    return;
                }

                if (action === 'reject') {
                    toggleEditor(eventKey, 'alternative', false);
                    const rejectEditorEl = dayInfoEl.querySelector(`.cal-inline-editor[data-editor="reject"][data-event-key="${eventKey}"]`);
                    const isOpen = rejectEditorEl && rejectEditorEl.style.display !== 'none';
                    toggleEditor(eventKey, 'reject', !isOpen);
                    return;
                }

                if (action === 'alternative') {
                    toggleEditor(eventKey, 'reject', false);
                    const altEditorEl = dayInfoEl.querySelector(`.cal-inline-editor[data-editor="alternative"][data-event-key="${eventKey}"]`);
                    const isOpen = altEditorEl && altEditorEl.style.display !== 'none';
                    toggleEditor(eventKey, 'alternative', !isOpen);
                }
                return;
            }

            if (cancelBtn) {
                const eventKey = cancelBtn.dataset.eventKey;
                const type = cancelBtn.dataset.calCancel;
                toggleEditor(eventKey, type, false);
                return;
            }

            if (!submitBtn) return;

            const action = submitBtn.dataset.calSubmit;
            const eventKey = submitBtn.dataset.eventKey;
            const targetEvent = dayEvents.find((item) => item._eventKey === eventKey);
            if (!targetEvent) return;

            let payload = {};
            if (action === 'reject') {
                const reason = dayInfoEl.querySelector(`textarea[data-field="reason"][data-event-key="${eventKey}"]`)?.value || '';
                payload = { reason };
            }

            if (action === 'alternative') {
                const alternativeDate = dayInfoEl.querySelector(`input[data-field="alternativeDate"][data-event-key="${eventKey}"]`)?.value || '';
                const alternativeTime = dayInfoEl.querySelector(`input[data-field="alternativeTime"][data-event-key="${eventKey}"]`)?.value || '';
                const comment = dayInfoEl.querySelector(`textarea[data-field="comment"][data-event-key="${eventKey}"]`)?.value || '';
                payload = { alternativeDate, alternativeTime, comment };
            }

            try {
                await applyCalendarAction(targetEvent, action, payload);
                renderFacilityMiniCalendar();
            } catch (error) {
                showToast('error', 'Kunne ikke oppdatere besøk', error?.message || 'Ukjent feil');
            }
        };
    };

    const todayKey = `${year}-${month}-${now.getDate()}`;
    const sortedEventKeys = [...eventDays].sort((a, b) => new Date(a.replace(/-/g, '/')).getTime() - new Date(b.replace(/-/g, '/')).getTime());
    if (!selectedCalendarDayKey || !container.querySelector(`[data-date="${selectedCalendarDayKey}"]`)) {
        selectedCalendarDayKey = container.querySelector(`[data-date="${todayKey}"]`)
            ? todayKey
            : sortedEventKeys[0] || `${year}-${month}-1`;
    }
    const boatFocusDate = document.getElementById('boatFocusDate');
    if (boatFocusDate && !boatFocusDate.value) boatFocusDate.value = normalizeDateKey(selectedCalendarDayKey) || '';
    updateSelectedDayLabel();
    updateBookingSelectionMeta();
    renderDayInfo(selectedCalendarDayKey);

    container.querySelectorAll('.mini-cal-day').forEach((el) => {
        el.addEventListener('click', () => {
            const dateKey = el.dataset.date;
            selectedCalendarDayKey = dateKey;
            const boatFocusDate = document.getElementById('boatFocusDate');
            if (boatFocusDate) boatFocusDate.value = normalizeDateKey(dateKey) || '';

            // Auto-fill job deadline from calendar selection if not set
            const jobDeadline = document.getElementById('jobDeadlineInput');
            if (jobDeadline && !jobDeadline.value) jobDeadline.value = normalizeDateKey(dateKey) || '';

            container.querySelectorAll('.mini-cal-day').forEach((item) => item.classList.remove('cal-selected'));
            el.classList.add('cal-selected');
            updateSelectedDayLabel();
            updateBookingSelectionMeta();

            // In mark mode: apply mark to the clicked day immediately without navigating away
            if (activeMarkMode) {
                setCalendarMarkForSelected(activeMarkMode);
                return;
            }

            renderDayInfo(dateKey);
            renderAvailableBoats();
        });
    });
}

function renderAvailableBoats() {
    const list = document.getElementById('availableBoatsList');
    const meta = document.getElementById('boatAvailabilityMeta');
    if (!list) return;
    list.innerHTML = '';
    list.className = 'list list-sm boat-list';

    const selected = getSelectedFacility();
    const { startKey, endKey } = getActivePlanningRange();
    const operatorPrefs = getFacilityOperatorPrefs(selected?.id);
    const preferredSet = new Set(operatorPrefs.preferredVesselIds.map(String));
    const blockedSet = new Set(operatorPrefs.blockedVesselIds.map(String));
    const boatZoneRadiusKm = Number(document.getElementById('boatZoneRadius')?.value || 30) || 30;
    const rangeText = startKey === endKey ? startKey : `${startKey} → ${endKey}`;
    if (meta) {
        const policyText = preferredSet.size > 0
            ? `Policy: kun foretrukne (${preferredSet.size})${blockedSet.size > 0 ? ` · blokkerte (${blockedSet.size})` : ''}`
            : blockedSet.size > 0
            ? `Policy: blokkerte (${blockedSet.size})`
            : 'Policy: åpen';
        const auditText = formatPolicyAuditSummary(selected?.id);
        const scopeText = activeCompanyId ? 'Selskapslås: aktiv' : 'Selskapslås: av';
        meta.textContent = `Periode: ${rangeText} · Radius plan: ${boatZoneRadiusKm} km · ${policyText} · ${scopeText} · ${auditText} · inkluderer sonevinduer før/etter oppdrag`;
    }
    if (!selected) {
        list.innerHTML = '<li class="empty">Velg anlegg for å se nærliggende båter.</li>';
        renderInteropActivityMeta();
        return;
    }

    const boats = getVisibleBoatEntriesForExport(selected, startKey, endKey, { limit: 25 });
    const sortedBoats = boats.slice().sort((a, b) => {
        const aSelected = String(a?.vessel?.id || '') === String(selectedBoatForBookingId || '') ? 1 : 0;
        const bSelected = String(b?.vessel?.id || '') === String(selectedBoatForBookingId || '') ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        return String(a?.vessel?.name || '').localeCompare(String(b?.vessel?.name || ''), 'nb-NO');
    });

    if (sortedBoats.length === 0) {
        const policyHint = preferredSet.size > 0
            ? ' (merk: kun foretrukne operatører vises)'
            : '';
        list.innerHTML = `<li class="empty">Ingen båter med planlagt tilstedeværelse i sonen rundt valgt dato${policyHint}.</li>`;
        updateBookingSelectionMeta();
        renderInteropActivityMeta();
        return;
    }

    for (const item of sortedBoats) {
        const name = item.vessel?.name || item.vessel?.mmsi || 'Ukjent båt';
        const category = getVesselCategory(item.vessel);
        const planned = item.planned;
        const aisNow = item.aisNow;
        const manualMode = getManualBoatAvailability(item.vessel?.id);
        const isPreferred = item.isPreferred === true;
        const isBlocked = item.isBlocked === true;
        const isManagedByActiveCompany = canManageVesselForActiveCompany(item.vessel);
        const isSelectedBoat = String(item?.vessel?.id || '') === String(selectedBoatForBookingId || '');
        const li = document.createElement('li');
        let statusBadge = '<span class="fpl-badge neutral">AIS nå</span>';
        let distanceText = aisNow ? `${aisNow.distanceKm.toFixed(1)} km nå` : '-';
        let sourceText = aisNow ? 'AIS' : 'Plan';
        let canBook = false;

        if (planned) {
            canBook = planned.intervalFit;
            if (planned.intervalFit) {
                statusBadge = '<span class="fpl-badge ok">Ledig hele perioden</span>';
            } else if (planned.freeCoveredDays > 0) {
                statusBadge = '<span class="fpl-badge warn">Delvis ledig i perioden</span>';
            } else {
                statusBadge = '<span class="fpl-badge danger">Opptatt i perioden</span>';
            }
            distanceText = planned.nearestDistanceKm != null
                ? `${planned.nearestDistanceKm.toFixed(1)} km · dekker ${planned.coveredDays}/${planned.totalDays} dager`
                : `Dekker ${planned.coveredDays}/${planned.totalDays} dager`;
            sourceText = planned.activeWindows.length > 0
                ? `Sonevindu · ${planned.activeWindows.length} områdeopphold`
                : 'Planlagt rute';
        } else if (aisNow && Number(aisNow.distanceKm) <= boatZoneRadiusKm) {
            canBook = true;
            statusBadge = '<span class="fpl-badge ok">Nær nå (AIS)</span>';
            sourceText = 'AIS live';
        }

        if (manualMode === 'available') {
            canBook = true;
            statusBadge = '<span class="fpl-badge ok">Manuelt ledig</span>';
            sourceText = sourceText === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        } else if (manualMode === 'unavailable') {
            canBook = false;
            statusBadge = '<span class="fpl-badge danger">Manuelt ikke ledig</span>';
            sourceText = sourceText === 'Planlagt rute' ? 'Plan + manuell' : 'Manuell';
        }

        if (isBlocked) {
            canBook = false;
            statusBadge = '<span class="fpl-badge danger">Blokkert operatør</span>';
            sourceText = 'Policy';
        }

        if (!isManagedByActiveCompany) {
            canBook = false;
            statusBadge = '<span class="fpl-badge neutral">Annet selskap</span>';
            sourceText = 'Selskapslås';
        }

        li.innerHTML = `
            <span class="boat-row-main">
                <span class="fpl-name">${name}</span>
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">${category}</span>
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">${distanceText}</span>
                ${isSelectedBoat ? '<span class="fpl-badge info">Valgt</span>' : ''}
                ${isPreferred ? '<span class="fpl-badge ok">Foretrukket</span>' : ''}
                ${statusBadge}
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">${sourceText}</span>
            </span>
            <span class="boat-row-actions">
                ${canBook ? `<button type="button" class="mini-btn" data-book-vessel="${item.vessel.id}" data-book-start="${startKey}" data-book-end="${endKey}">Book</button>` : ''}
                <button type="button" class="mini-btn" data-pref-vessel="${item.vessel.id}" ${isManagedByActiveCompany ? '' : 'disabled title="Låst for båter fra andre selskaper"'}>${isPreferred ? 'Fjern preferanse' : 'Foretrekk'}</button>
                <button type="button" class="mini-btn ${isBlocked ? '' : 'danger'}" data-block-vessel="${item.vessel.id}" ${isManagedByActiveCompany ? '' : 'disabled title="Låst for båter fra andre selskaper"'}>${isBlocked ? 'Fjern blokkering' : 'Blokker'}</button>
            </span>
        `;
        li.addEventListener('click', () => {
            selectedBoatForBookingId = item.vessel.id;
            updateBookingSelectionMeta();
            renderAvailableBoats();
        });
        list.appendChild(li);
    }

    updateBookingSelectionMeta();

    list.querySelectorAll('[data-book-vessel]').forEach((button) => {
        button.addEventListener('click', () => {
            requestBoatBooking(button.dataset.bookVessel, button.dataset.bookStart, button.dataset.bookEnd);
        });
    });
    list.querySelectorAll('[data-pref-vessel]').forEach((button) => {
        button.addEventListener('click', () => {
            const vesselId = String(button.dataset.prefVessel || '');
            if (!ensureCanManageVessel(vesselId, 'Policyendring')) return;
            const currentlyPreferred = isFacilityPreferredVessel(selected?.id, vesselId);
            setFacilityPreferredVessel(selected?.id, vesselId, !currentlyPreferred, {
                vesselName: vesselMap?.get(vesselId)?.name || '',
                by: pilotActor
            });
            renderAvailableBoats();
            renderJobsList();
        });
    });
    list.querySelectorAll('[data-block-vessel]').forEach((button) => {
        button.addEventListener('click', () => {
            const vesselId = String(button.dataset.blockVessel || '');
            if (!ensureCanManageVessel(vesselId, 'Policyendring')) return;
            const currentlyBlocked = isFacilityBlockedVessel(selected?.id, vesselId);
            setFacilityBlockedVessel(selected?.id, vesselId, !currentlyBlocked, {
                vesselName: vesselMap?.get(vesselId)?.name || '',
                by: pilotActor
            });
            renderAvailableBoats();
            renderJobsList();
        });
    });

    renderInteropActivityMeta();
}


function wireEvents() {
    const demoResetBtn = document.getElementById('demoResetBtn');
    if (demoResetBtn) {
        demoResetBtn.addEventListener('click', () => {
            const confirmed = window.confirm('Nullstill demo-tilstand for denne nettleseren? Dette fjerner lokale valg, kalender- og panelinnstillinger.');
            if (!confirmed) return;
            const removedKeys = clearDemoLocalState();
            showToast('success', 'Demo reset fullført', `Fjernet ${removedKeys.length} lokale nøkler. Laster siden på nytt...`);
            setTimeout(() => {
                window.location.reload();
            }, 550);
        });
    }

    document.getElementById('municipalityFilter').addEventListener('change', () => { renderAll(); });
    document.getElementById('companyFilter').addEventListener('change', () => {
        const nextCompanyId = document.getElementById('companyFilter').value || activeCompanyId;
        setCompanyScope(nextCompanyId);
        ensureSelectedFacilityOption();
        renderAll();
    });
    document.getElementById('selectedFacilityFilter').addEventListener('change', (event) => {
        selectedFacilityId = event.target.value || null;
        aisCache = { key: null, ts: 0, nearby: [], risk: [] };
        renderAll();
    });

    const boatTypeFilter = document.getElementById('boatTypeFilter');
    if (boatTypeFilter) {
        boatTypeFilter.addEventListener('change', () => { renderAvailableBoats(); });
    }

    const jobStatusFilter = document.getElementById('jobStatusFilter');
    if (jobStatusFilter) {
        jobStatusFilter.addEventListener('change', () => { renderJobsList(); });
    }

    const activeFacilitiesOnly = document.getElementById('activeFacilitiesOnly');
    if (activeFacilitiesOnly) {
        activeFacilitiesOnly.addEventListener('change', () => {
            renderFacilityPickerList();
        });
    }

    const boatSearchInput = document.getElementById('boatSearchInput');
    if (boatSearchInput) {
        boatSearchInput.addEventListener('input', () => { renderAvailableBoats(); });
    }

    const boatPolicyFilter = document.getElementById('boatPolicyFilter');
    if (boatPolicyFilter) {
        boatPolicyFilter.addEventListener('change', () => { renderAvailableBoats(); });
    }

    const onlyAvailableBoats = document.getElementById('onlyAvailableBoats');
    if (onlyAvailableBoats) {
        onlyAvailableBoats.addEventListener('change', () => { renderAvailableBoats(); });
    }

    const boatRequestTime = document.getElementById('boatRequestTime');
    if (boatRequestTime) {
        boatRequestTime.addEventListener('change', () => {
            renderAvailableBoats();
            updateBookingSelectionMeta();
        });
    }

    const boatOperationMinutes = document.getElementById('boatOperationMinutes');
    if (boatOperationMinutes) {
        boatOperationMinutes.addEventListener('change', () => {
            boatOperationMinutes.value = String(Math.max(15, parseInt(boatOperationMinutes.value || '60', 10) || 60));
            updateBookingSelectionMeta();
        });
    }

    const boatFocusDate = document.getElementById('boatFocusDate');
    if (boatFocusDate) {
        if (!boatFocusDate.value) boatFocusDate.value = getActivePlanningDateKey();
        boatFocusDate.addEventListener('change', () => {
            selectedCalendarDayKey = normalizeDateKey(boatFocusDate.value || '') || selectedCalendarDayKey;
            const boatFocusEndDate = document.getElementById('boatFocusEndDate');
            if (boatFocusEndDate && !boatFocusEndDate.value) {
                boatFocusEndDate.value = normalizeDateKey(boatFocusDate.value || '') || '';
            }
            renderFacilityMiniCalendar();
            renderAvailableBoats();
            renderNearbyFacilities();
            renderAlertCenter();
        });
    }

    const boatFocusEndDate = document.getElementById('boatFocusEndDate');
    if (boatFocusEndDate) {
        if (!boatFocusEndDate.value) boatFocusEndDate.value = getActivePlanningDateKey();
        boatFocusEndDate.addEventListener('change', () => {
            const startKey = normalizeDateKey(document.getElementById('boatFocusDate')?.value || '') || getActivePlanningDateKey();
            const endKey = normalizeDateKey(boatFocusEndDate.value || '') || startKey;
            if (endKey < startKey) boatFocusEndDate.value = startKey;
            renderAvailableBoats();
        });
    }

    const boatZoneRadius = document.getElementById('boatZoneRadius');
    if (boatZoneRadius) {
        boatZoneRadius.addEventListener('change', () => {
            renderSystemBoats();
            renderAvailableBoats();
        });
    }

    const exportPolicyAuditBtn = document.getElementById('exportPolicyAuditBtn');
    if (exportPolicyAuditBtn) {
        exportPolicyAuditBtn.addEventListener('click', exportOperatorPolicyAuditForSelectedFacility);
    }
    const exportAllPolicyAuditBtn = document.getElementById('exportAllPolicyAuditBtn');
    if (exportAllPolicyAuditBtn) {
        exportAllPolicyAuditBtn.addEventListener('click', exportOperatorPolicyAuditAllFacilities);
    }
    const exportJobsCsvBtn = document.getElementById('exportJobsCsvBtn');
    if (exportJobsCsvBtn) {
        exportJobsCsvBtn.addEventListener('click', exportJobsCsvForSelectedFacility);
    }
    const exportBoatsCsvBtn = document.getElementById('exportBoatsCsvBtn');
    if (exportBoatsCsvBtn) {
        exportBoatsCsvBtn.addEventListener('click', exportVisibleBoatsCsvForSelectedFacility);
    }
    const exportInteropPackBtn = document.getElementById('exportInteropPackBtn');
    if (exportInteropPackBtn) {
        exportInteropPackBtn.addEventListener('click', exportInteropPackForSelectedFacility);
    }
    const importPolicyBtn = document.getElementById('importPolicyBtn');
    const importPolicyFileInput = document.getElementById('importPolicyFileInput');
    if (importPolicyBtn && importPolicyFileInput) {
        importPolicyBtn.addEventListener('click', () => {
            importPolicyFileInput.value = '';
            importPolicyFileInput.click();
        });
        importPolicyFileInput.addEventListener('change', async (event) => {
            const file = event?.target?.files?.[0];
            await importPolicyForSelectedFacilityFromFile(file);
            importPolicyFileInput.value = '';
        });
    }
    const resyncAllJobPoliciesBtn = document.getElementById('resyncAllJobPoliciesBtn');
    if (resyncAllJobPoliciesBtn) {
        resyncAllJobPoliciesBtn.addEventListener('click', resyncAllJobPoliciesForSelectedFacility);
    }

    const openPolicyHistoryBtn = document.getElementById('openPolicyHistoryBtn');
    if (openPolicyHistoryBtn) {
        openPolicyHistoryBtn.addEventListener('click', openPolicyHistoryModal);
    }

    const closePolicyHistoryModalBtn = document.getElementById('closePolicyHistoryModalBtn');
    if (closePolicyHistoryModalBtn) {
        closePolicyHistoryModalBtn.addEventListener('click', closePolicyHistoryModal);
    }

    const undoPolicyChangeBtn = document.getElementById('undoPolicyChangeBtn');
    if (undoPolicyChangeBtn) {
        undoPolicyChangeBtn.addEventListener('click', undoLastPolicyChangeForSelectedFacility);
    }

    const policyHistoryModal = document.getElementById('policyHistoryModal');
    if (policyHistoryModal) {
        policyHistoryModal.addEventListener('click', (event) => {
            if (event.target === policyHistoryModal) closePolicyHistoryModal();
        });
    }

    const refreshAisBtn = document.getElementById('refreshAisBtn');
    if (refreshAisBtn) {
        refreshAisBtn.addEventListener('click', async () => {
            const summary = document.getElementById('aisSummary');
            if (summary) summary.textContent = 'Oppdaterer AIS-data...';
            aisCache = { key: null, ts: 0, nearby: [], risk: [] };
            quarantineCache = { ts: 0, byMmsi: new Map() };
            await renderAll();
        });
    }

    const toggleFacilitiesBtn = document.getElementById('toggleFacilitiesBtn');
    if (toggleFacilitiesBtn) {
        toggleFacilitiesBtn.addEventListener('click', () => {
            const collapsed = toggleFacilitiesBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('facilities', collapsed);
        });
    }

    const toggleBoatsBtn = document.getElementById('toggleBoatsBtn');
    if (toggleBoatsBtn) {
        toggleBoatsBtn.addEventListener('click', () => {
            const collapsed = toggleBoatsBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('boats', collapsed);
        });
    }

    const toggleFacilityCalendarBtn = document.getElementById('toggleFacilityCalendarBtn');
    if (toggleFacilityCalendarBtn) {
        toggleFacilityCalendarBtn.addEventListener('click', () => {
            const collapsed = toggleFacilityCalendarBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('facilityCalendar', collapsed);
        });
    }

    const toggleJobRequestBtn = document.getElementById('toggleJobRequestBtn');
    if (toggleJobRequestBtn) {
        toggleJobRequestBtn.addEventListener('click', () => {
            const collapsed = toggleJobRequestBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('jobRequest', collapsed);
        });
    }

    const toggleSelectedInfoBtn = document.getElementById('toggleSelectedInfoBtn');
    if (toggleSelectedInfoBtn) {
        toggleSelectedInfoBtn.addEventListener('click', () => {
            const collapsed = toggleSelectedInfoBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('selectedInfo', collapsed);
        });
    }

    const toggleNearbyFacilitiesBtn = document.getElementById('toggleNearbyFacilitiesBtn');
    if (toggleNearbyFacilitiesBtn) {
        toggleNearbyFacilitiesBtn.addEventListener('click', () => {
            const collapsed = toggleNearbyFacilitiesBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('nearbyFacilities', collapsed);
        });
    }

    const toggleNearbyRiskBtn = document.getElementById('toggleNearbyRiskBtn');
    if (toggleNearbyRiskBtn) {
        toggleNearbyRiskBtn.addEventListener('click', () => {
            const collapsed = toggleNearbyRiskBtn.getAttribute('aria-expanded') === 'true';
            setPanelCollapsed('nearbyRisk', collapsed);
        });
    }

    const calMarkGreenBtn = document.getElementById('calMarkGreenBtn');
    if (calMarkGreenBtn) calMarkGreenBtn.addEventListener('click', () => {
        if (activeMarkMode === 'green') {
            activeMarkMode = null;
        } else {
            activeMarkMode = 'green';
        }
        updateMarkModeUI();
    });

    const calMarkRedBtn = document.getElementById('calMarkRedBtn');
    if (calMarkRedBtn) calMarkRedBtn.addEventListener('click', () => {
        if (activeMarkMode === 'red') {
            activeMarkMode = null;
        } else {
            activeMarkMode = 'red';
        }
        updateMarkModeUI();
    });

    const calMarkClearBtn = document.getElementById('calMarkClearBtn');
    if (calMarkClearBtn) calMarkClearBtn.addEventListener('click', () => {
        activeMarkMode = null;
        updateMarkModeUI();
        setCalendarMarkForSelected('clear');
    });

    const goFirstPlannedBtn = document.getElementById('goFirstPlannedBtn');
    if (goFirstPlannedBtn) goFirstPlannedBtn.addEventListener('click', jumpToFirstPlannedVisit);

    const calendarAutoSetup = document.getElementById('calendarAutoSetup');
    if (calendarAutoSetup) {
        calendarAutoSetup.addEventListener('change', (event) => {
            const input = event.target?.closest('input[data-auto-rule]');
            if (!input) return;
            const selected = getSelectedFacility();
            if (!selected) {
                input.checked = false;
                return;
            }

            const ruleKey = String(input.dataset.autoRule || '').trim();
            if (!ruleKey) return;

            setFacilityAutoRuleEnabled(selected, ruleKey, input.checked === true);
            renderFacilityMiniCalendar();
            const stateText = input.checked ? 'aktivert' : 'deaktivert';
            showToast('info', 'Auto-oppsett oppdatert', `${input.value || ruleKey}: ${stateText}`);
        });
    }

    const autoGeneratedRequestsList = document.getElementById('autoGeneratedRequestsList');
    if (autoGeneratedRequestsList) {
        autoGeneratedRequestsList.addEventListener('click', (event) => {
            const button = event.target?.closest('button[data-auto-request]');
            if (!button) return;
            const autoType = button.dataset.autoRequest || '';
            const autoDate = button.dataset.autoDate || selectedCalendarDayKey || '';
            const autoStart = button.dataset.autoStart || autoDate;
            const autoEnd = button.dataset.autoEnd || autoDate;
            const autoTitle = button.dataset.autoTitle || '';
            createOrUpdateJobRequestFromAutoReminder({ autoType, autoDate, autoStart, autoEnd, autoTitle });
        });
    }

    const autoRulesEnableAllBtn = document.getElementById('autoRulesEnableAllBtn');
    if (autoRulesEnableAllBtn) {
        autoRulesEnableAllBtn.addEventListener('click', () => {
            const selected = getSelectedFacility();
            if (!selected) return;
            setFacilityAutoRulesBulk(selected, true);
            renderCalendarAutoSetupControls(selected);
            renderFacilityMiniCalendar();
            showToast('info', 'Auto-oppsett oppdatert', 'Alle auto-regler er aktivert for valgt anlegg.');
        });
    }

    const autoRulesDisableAllBtn = document.getElementById('autoRulesDisableAllBtn');
    if (autoRulesDisableAllBtn) {
        autoRulesDisableAllBtn.addEventListener('click', () => {
            const selected = getSelectedFacility();
            if (!selected) return;
            setFacilityAutoRulesBulk(selected, false);
            renderCalendarAutoSetupControls(selected);
            renderFacilityMiniCalendar();
            showToast('info', 'Auto-oppsett oppdatert', 'Alle auto-regler er slått av for valgt anlegg.');
        });
    }

    // Job Request Form
    const jobRequestForm = document.getElementById('jobRequestForm');
    if (jobRequestForm) {
        jobRequestForm.addEventListener('submit', handleJobRequestSubmit);
    }
}

async function init() {
    const meta = document.getElementById('profileMeta');

    try {
        showLoading('Laster profil og kartdata...');
        profile = await loadProfile();
        loadCalendarOverrides();
        loadManualBoatAvailability();
        loadAutoRulePrefs();
        loadOperatorPrefs();
        loadOperatorPrefsAudit();
        loadPanelPrefs();
        companyMap = mapById(profile.companies || []);
        vesselMap = mapById(profile.vessels || []);
        setCompanyScope(resolveActiveCompanyId());
        analysisRadiusKm = Number(profile?.scope?.nearbyFacilityRadiusKm) || 20;

        let syncInfo = { added: 0, updated: 0, totalOwned: 0 };
        try {
            syncInfo = await syncCompanyFacilitiesFromApi();
        } catch (_) {
            syncInfo = { added: 0, updated: 0, totalOwned: (profile?.facilities || []).filter((facility) => String(facility?.companyId || '') === activeCompanyId).length };
        }

        await loadDiseaseSpreadData();
        await refreshClearanceCache(profile.profileName, pilotActor, true);

        const scopedCompanyName = companyMap.get(activeCompanyId)?.name || activeCompanyId || 'Alle';
        meta.textContent = `Profil: ${profile.profileName || '-'} · Opprettet: ${profile.createdAt || '-'} · Selskap: ${scopedCompanyName} · Anlegg: ${syncInfo.totalOwned} · Radius: ${analysisRadiusKm} km`;

        if (syncInfo.added > 0 || syncInfo.updated > 0) {
            showToast('info', 'Anlegg synkronisert', `FDIR/BW oppdatert: ${syncInfo.added} nye, ${syncInfo.updated} oppdaterte anlegg.`);
        }

        populateFilters();
        wireEvents();
        applyPanelPrefs();
        await renderAll();
        if (dataStatus.disease === 'offline' || dataStatus.ais === 'offline' || dataStatus.quarantine === 'offline' || dataStatus.clearances === 'offline') {
            showToast('warning', 'API delvis offline', 'Noen datakilder er utilgjengelige. Dashboard viser fallback-data der det er mulig.');
        }
    } catch (error) {
        meta.textContent = `Feil ved lasting av profil: ${error.message}`;
        showToast('error', 'Kunne ikke laste dashboard', error.message || 'Ukjent feil');
    } finally {
        hideLoading();
    }
}

init();
