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

const CHECK_TIMEOUT_MS = 10000;

const CHECKS = [
    {
        id: 'profile',
        label: 'Lokal profil',
        kind: 'local',
        url: './data/profile.json'
    },
    {
        id: 'vessels',
        label: 'AIS / fartøy',
        kind: 'api',
        url: `${API_BASE}/api/vessels?limit=1`
    },
    {
        id: 'facilities',
        label: 'Anleggsdata',
        kind: 'api',
        url: `${API_BASE}/api/facilities?limit=1&skip=0&include_geo=true`
    },
    {
        id: 'disease',
        label: 'Smitteindeks',
        kind: 'api',
        url: `${API_BASE}/api/facilities/disease-spread?ts=${Date.now()}`
    },
    {
        id: 'riskVisits',
        label: 'Risikobesøk',
        kind: 'api',
        url: `${API_BASE}/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7`
    },
    {
        id: 'liceRisk',
        label: 'Luserisiko',
        kind: 'api',
        url: `${API_BASE}/api/vessels/at-lice-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7`
    }
];

function formatLocalDateTime(date) {
    try {
        return new Intl.DateTimeFormat('nb-NO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    } catch (_) {
        return date.toLocaleString();
    }
}

function setRunMeta(text) {
    const node = document.getElementById('checkRunMeta');
    if (!node) return;
    node.textContent = text;
}

function toTone(status, latencyMs) {
    if (status === 'ok' && latencyMs <= 1800) return 'ok';
    if (status === 'ok') return 'warn';
    return 'danger';
}

function createCard(check) {
    const card = document.createElement('article');
    card.className = 'system-check-card';
    card.innerHTML = `
        <h3>${check.label}</h3>
        <p class="meta" id="checkStatus-${check.id}">Venter...</p>
        <span class="system-check-url">${check.url}</span>
    `;
    return card;
}

function renderSummary(results) {
    const summary = document.getElementById('checkSummary');
    if (!summary) return;
    const okCount = results.filter((item) => item.status === 'ok').length;
    const failCount = results.length - okCount;
    const maxLatency = results.reduce((max, item) => Math.max(max, item.latencyMs || 0), 0);

    let tone = 'ok';
    if (failCount > 0) tone = 'danger';
    else if (maxLatency > 3000) tone = 'warn';

    summary.className = `meta api-health-chip ${tone}`;
    summary.textContent = `OK: ${okCount}/${results.length} · Feil: ${failCount} · Maks responstid: ${maxLatency} ms · API: ${API_BASE}`;
}

async function runSingleCheck(check) {
    const statusNode = document.getElementById(`checkStatus-${check.id}`);
    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
        const response = await fetch(check.url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        if (!response.ok) {
            if (statusNode) {
                statusNode.className = 'meta api-health-chip danger';
                statusNode.textContent = `Feil · HTTP ${response.status} · ${latencyMs} ms`;
            }
            return { id: check.id, status: 'error', latencyMs };
        }

        if (statusNode) {
            const tone = toTone('ok', latencyMs);
            statusNode.className = `meta api-health-chip ${tone}`;
            statusNode.textContent = `OK · HTTP ${response.status} · ${latencyMs} ms`;
        }
        return { id: check.id, status: 'ok', latencyMs };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startedAt);
        if (statusNode) {
            statusNode.className = 'meta api-health-chip danger';
            statusNode.textContent = `Feil · ${error?.name === 'AbortError' ? 'Timeout' : (error?.message || 'Ukjent feil')} · ${latencyMs} ms`;
        }
        return { id: check.id, status: 'error', latencyMs };
    } finally {
        clearTimeout(timer);
    }
}

async function runChecks() {
    const runBtn = document.getElementById('runChecksBtn');
    const startedAt = new Date();
    setRunMeta(`Kjører sjekk... startet ${formatLocalDateTime(startedAt)}`);
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = 'Kjører...';
    }

    const results = [];
    for (const check of CHECKS) {
        const result = await runSingleCheck(check);
        results.push(result);
        renderSummary(results);
        setRunMeta(`Kjører sjekk... ${results.length}/${CHECKS.length} ferdig`);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    setRunMeta(`Sist sjekket: ${formatLocalDateTime(completedAt)} · Varighet: ${durationMs} ms`);

    if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = 'Kjør sjekk';
    }
}

function init() {
    const grid = document.getElementById('checkGrid');
    if (grid) {
        CHECKS.forEach((check) => {
            grid.appendChild(createCard(check));
        });
    }

    document.getElementById('runChecksBtn')?.addEventListener('click', () => {
        runChecks();
    });

    runChecks();
}

init();
