/**
 * API Client with dynamic base URL support
 * Uses VITE_API_BASE_URL from environment, falls back to current origin
 */

const getApiBaseUrl = () => {
  // Use env var if available (set at build time)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback: use current origin for same-domain API (when served together)
  return window.location.origin;
};

const apiClient = {
  baseUrl: getApiBaseUrl(),

  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    return response;
  },

  async get(endpoint) {
    return this.fetch(endpoint, { method: 'GET' });
  },

  async post(endpoint, body) {
    return this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async patch(endpoint, body) {
    return this.fetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async delete(endpoint) {
    return this.fetch(endpoint, { method: 'DELETE' });
  },
};

export default apiClient;
