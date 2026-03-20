const API_BASE_OVERRIDE_KEY = 'pilotLiteApiBaseOverrideV1';
const AUTH_TOKEN_KEY = 'pilotLiteAuthTokenV1';
const AUTH_NEXT_KEY = 'pilotLiteAuthNextV1';

function resolveApiBase() {
    const fallback = window.location.hostname.includes('render.com')
        ? 'https://aqua-shield-api.onrender.com'
        : `${window.location.protocol}//${window.location.hostname}:8000`;

    const normalize = (value) => String(value || '').trim().replace(/\/$/, '');
    const isHttpUrl = (value) => /^https?:\/\/.+/i.test(value);

    try {
        const queryValue = normalize(new URLSearchParams(window.location.search).get('apiBase'));
        if (isHttpUrl(queryValue)) {
            localStorage.setItem(API_BASE_OVERRIDE_KEY, queryValue);
            return queryValue;
        }
    } catch (_) {}

    try {
        const override = normalize(localStorage.getItem(API_BASE_OVERRIDE_KEY));
        if (isHttpUrl(override)) return override;
    } catch (_) {}

    return fallback;
}

const API_BASE = resolveApiBase();

function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function isLoginPage() {
    return getCurrentPage() === 'login.html';
}

function getToken() {
    try {
        return localStorage.getItem(AUTH_TOKEN_KEY) || '';
    } catch (_) {
        return '';
    }
}

function setToken(token) {
    try {
        if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
        else localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (_) {}
}

function redirectToLogin() {
    try {
        localStorage.setItem(AUTH_NEXT_KEY, window.location.pathname + window.location.search + window.location.hash);
    } catch (_) {}
    if (!isLoginPage()) {
        window.location.replace('./login.html');
    }
}

function redirectAfterLogin() {
    let next = './index.html';
    try {
        const stored = localStorage.getItem(AUTH_NEXT_KEY);
        if (stored) next = stored;
        localStorage.removeItem(AUTH_NEXT_KEY);
    } catch (_) {}
    window.location.replace(next);
}

async function loginWithPassword(password) {
    const response = await window.fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({ password })
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    setToken(payload?.token || '');
    return payload;
}

async function verifySession() {
    const token = getToken();
    if (!token) return false;

    const response = await window.fetch(`${API_BASE}/api/auth/me`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        }
    }).catch(() => null);

    if (!response || !response.ok) {
        setToken('');
        return false;
    }
    return true;
}

function installFetchAuth() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url || '';
        const token = getToken();
        const isApiCall = requestUrl.startsWith(API_BASE) || requestUrl.startsWith('/api/');

        if (!isApiCall) {
            return originalFetch(input, init);
        }

        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined) || {});
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await originalFetch(input, {
            ...init,
            headers
        });

        if (response.status === 401 && !isLoginPage()) {
            setToken('');
            redirectToLogin();
        }

        return response;
    };
}

function installLogoutButton() {
    window.addEventListener('DOMContentLoaded', () => {
        const nav = document.querySelector('.links');
        if (!nav || nav.querySelector('[data-auth-logout]')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.authLogout = 'true';
        btn.className = 'topbar-link-btn';
        btn.textContent = 'Logg ut';
        btn.addEventListener('click', () => {
            setToken('');
            redirectToLogin();
        });
        nav.appendChild(btn);
    });
}

async function bootstrapAuth() {
    installFetchAuth();

    if (isLoginPage()) return;

    const isAuthenticated = await verifySession();
    if (!isAuthenticated) {
        redirectToLogin();
        return;
    }

    installLogoutButton();
}

window.PilotLiteAuth = {
    apiBase: API_BASE,
    getToken,
    setToken,
    loginWithPassword,
    verifySession,
    redirectAfterLogin,
    logout() {
        setToken('');
        redirectToLogin();
    }
};

bootstrapAuth();
