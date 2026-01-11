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
    const response = await this.fetch(endpoint, { method: 'GET' });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async post(endpoint, body) {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async patch(endpoint, body) {
    const response = await this.fetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async delete(endpoint) {
    const response = await this.fetch(endpoint, { method: 'DELETE' });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
};

export default apiClient;
