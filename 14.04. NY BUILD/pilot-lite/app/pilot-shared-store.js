const STORE_KEY = 'pilotLiteSharedDataV1';
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
const CLEARANCE_FETCH_TIMEOUT_MS = 6000;
const CLEARANCE_FETCH_RETRIES = 2;

const cache = {
    key: null,
    ts: 0,
    ttlMs: 60 * 1000,
    clearedMmsi: new Set(),
    clearancesByMmsi: new Map()
};

function loadRawStore() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return { profiles: {}, global: { clearedByMmsi: {} } };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return { profiles: {}, global: { clearedByMmsi: {} } };
        }
        if (!parsed.profiles || typeof parsed.profiles !== 'object') parsed.profiles = {};
        if (!parsed.global || typeof parsed.global !== 'object') parsed.global = { clearedByMmsi: {} };
        if (!parsed.global.clearedByMmsi || typeof parsed.global.clearedByMmsi !== 'object') {
            parsed.global.clearedByMmsi = {};
        }
        return parsed;
    } catch (_) {
        return { profiles: {}, global: { clearedByMmsi: {} } };
    }
}

function saveRawStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function normalizeProfile(profileName) {
    return String(profileName || 'default').trim() || 'default';
}

function normalizeActor(actor) {
    return String(actor || 'shared').trim().toLowerCase() || 'shared';
}

function normalizeMmsi(mmsi) {
    return String(mmsi || '').trim();
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = CLEARANCE_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function ensureActorStore(store, profileName, actor) {
    const profileKey = normalizeProfile(profileName);
    const actorKey = normalizeActor(actor);

    if (!store.profiles[profileKey]) {
        store.profiles[profileKey] = { actors: {}, routePlans: [] };
    }
    if (!store.profiles[profileKey].actors || typeof store.profiles[profileKey].actors !== 'object') {
        store.profiles[profileKey].actors = {};
    }
    if (!store.profiles[profileKey].actors[actorKey]) {
        store.profiles[profileKey].actors[actorKey] = {
            clearedByMmsi: {},
            routePlans: [],
            updatedAt: null
        };
    }

    return store.profiles[profileKey].actors[actorKey];
}

export function isMmsiCleared(profileName, actor, mmsi) {
    const key = normalizeMmsi(mmsi);
    if (!key) return false;
    return cache.clearedMmsi.has(key);
}

export function getMmsiClearance(profileName, actor, mmsi) {
    const key = normalizeMmsi(mmsi);
    if (!key) return null;
    return cache.clearancesByMmsi.get(key) || null;
}

export async function refreshClearanceCache(profileName, actor, force = false) {
    const profileKey = normalizeProfile(profileName);
    const actorKey = normalizeActor(actor);
    const key = `${profileKey}|${actorKey}`;
    const now = Date.now();

    if (!force && cache.key === key && (now - cache.ts) < cache.ttlMs) {
        return { ok: true, source: 'memory', count: cache.clearedMmsi.size };
    }

    try {
        const query = new URLSearchParams({
            profile_name: profileKey,
            actor: actorKey
        });
        let response = null;
        let lastError = null;
        for (let attempt = 0; attempt <= CLEARANCE_FETCH_RETRIES; attempt += 1) {
            try {
                response = await fetchWithTimeout(`${API_BASE}/api/pilot/clearances?${query.toString()}`, {
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                if (attempt < CLEARANCE_FETCH_RETRIES) {
                    await delay(220 * (attempt + 1));
                }
            }
        }

        if (!response || lastError) {
            throw lastError || new Error('Clearance API unavailable');
        }

        const data = await response.json();
        const cleared = Array.isArray(data?.cleared_mmsi) ? data.cleared_mmsi.map((item) => String(item)) : [];
        const mergedClearances = new Map();

        const actorClearances = data?.actor_clearances || {};
        for (const [mmsi, record] of Object.entries(actorClearances)) {
            mergedClearances.set(String(mmsi), record);
        }
        const globalClearances = data?.global_clearances || {};
        for (const [mmsi, record] of Object.entries(globalClearances)) {
            if (!mergedClearances.has(String(mmsi))) mergedClearances.set(String(mmsi), record);
        }

        cache.key = key;
        cache.ts = now;
        cache.clearedMmsi = new Set(cleared);
        cache.clearancesByMmsi = mergedClearances;

        return { ok: true, source: 'api', count: cache.clearedMmsi.size };
    } catch (error) {
        const store = loadRawStore();
        const actorStore = ensureActorStore(store, profileName, actor);
        const actorCleared = Object.entries(actorStore.clearedByMmsi || {})
            .filter(([, rec]) => rec?.cleared === true && rec?.signedVia === 'route-planner' && rec?.quarantineCompleted === true && rec?.disinfectionCompleted === true)
            .map(([mmsi]) => String(mmsi));
        const globalCleared = Object.entries(store.global?.clearedByMmsi || {})
            .filter(([, rec]) => rec?.cleared === true && rec?.signedVia === 'route-planner' && rec?.quarantineCompleted === true && rec?.disinfectionCompleted === true)
            .map(([mmsi]) => String(mmsi));

        const merged = [...new Set([...actorCleared, ...globalCleared])];
        cache.key = key;
        cache.ts = now;
        cache.clearedMmsi = new Set(merged);
        cache.clearancesByMmsi = new Map();

        const reason = error?.name === 'AbortError' ? 'timeout' : 'error';
        return { ok: true, source: 'local-fallback', reason, count: cache.clearedMmsi.size };
    }
}

export async function signRoutePlannerClearance(profileName, actor, payload = {}) {
    const key = normalizeMmsi(payload.mmsi);
    if (!key) return { ok: false, reason: 'MMSI mangler' };

    const quarantineCompleted = payload.quarantineCompleted === true;
    const disinfectionCompleted = payload.disinfectionCompleted === true;
    if (!quarantineCompleted || !disinfectionCompleted) {
        return { ok: false, reason: 'Karantene og desinfeksjon må være fullført før signering' };
    }

    const profileKey = normalizeProfile(profileName);
    const actorKey = normalizeActor(actor);

    try {
        const response = await fetch(`${API_BASE}/api/pilot/clearances/sign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                profile_name: profileKey,
                actor: actorKey,
                mmsi: key,
                vessel_name: payload.vesselName || null,
                route_plan_id: payload.routePlanId || null,
                route_plan_title: payload.routePlanTitle || null,
                route_start: payload.routeStart || null,
                route_end: payload.routeEnd || null,
                signed_by: payload.signedBy || null,
                quarantine_completed: true,
                disinfection_completed: true
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, reason: data?.message || data?.error || `HTTP ${response.status}` };
        }

        await refreshClearanceCache(profileName, actor, true);
        return { ok: true, record: data?.clearance || null };
    } catch (_) {
        const store = loadRawStore();
        const actorStore = ensureActorStore(store, profileName, actor);
        const signedAt = new Date().toISOString();
        const record = {
            cleared: true,
            updatedAt: signedAt,
            vesselName: payload.vesselName || null,
            source: normalizeActor(actor),
            signedVia: 'route-planner',
            signedAt,
            signedBy: payload.signedBy || null,
            quarantineCompleted: true,
            disinfectionCompleted: true,
            routePlanId: payload.routePlanId || null,
            routePlanTitle: payload.routePlanTitle || null,
            routeStart: payload.routeStart || null,
            routeEnd: payload.routeEnd || null
        };
        actorStore.clearedByMmsi[key] = record;
        store.global.clearedByMmsi[key] = record;
        saveRawStore(store);
        await refreshClearanceCache(profileName, actor, true);
        return { ok: true, record, source: 'local-fallback' };
    }
}

export function listClearedMmsi(profileName, actor) {
    return [...cache.clearedMmsi];
}

export function appendRoutePlan(profileName, actor, plan) {
    const store = loadRawStore();
    const actorStore = ensureActorStore(store, profileName, actor);

    const record = {
        id: plan?.id || `plan_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...plan
    };

    actorStore.routePlans = Array.isArray(actorStore.routePlans) ? actorStore.routePlans : [];
    actorStore.routePlans.unshift(record);
    actorStore.routePlans = actorStore.routePlans.slice(0, 1000);
    actorStore.updatedAt = new Date().toISOString();

    saveRawStore(store);
    return record;
}

export function getRoutePlans(profileName, actor) {
    const store = loadRawStore();
    const actorStore = ensureActorStore(store, profileName, actor);
    return Array.isArray(actorStore.routePlans) ? actorStore.routePlans : [];
}

export function getAllRoutePlans(profileName) {
    const store = loadRawStore();
    const profileKey = normalizeProfile(profileName);
    const profileStore = store?.profiles?.[profileKey];
    const actors = profileStore?.actors && typeof profileStore.actors === 'object'
        ? Object.values(profileStore.actors)
        : [];
    return actors.flatMap((actorStore) => Array.isArray(actorStore?.routePlans) ? actorStore.routePlans : []);
}
