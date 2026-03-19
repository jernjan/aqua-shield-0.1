/**
 * Standardisert fargepalet for alle dashboards
 * Skal importeres og brukes konsistentoveralt
 */

const COLOR_PALETTE = {
  // Risk statuses
  INFECTED: '#ef4444',      // Rød - Smittet anlegg
  BW_ZONE: '#f59e0b',       // Oransje - BarentsWatch-sone / Karantene
  LOCAL_ZONE: '#facc15',    // Gul - Lokal smitteradius (10km)
  HEALTHY: '#10b981',       // Grønn - Fritt/frisk anlegg
  
  // Neutral/Info
  INFO: '#3b82f6',          // Blå - Informasjon
  WARNING: '#f97316',       // Dyp oransje - Advarsel
  NEUTRAL: '#6b7280',       // Grå - Nøytral info
  
  // UI Elements
  BORDER_LIGHT: '#e5e7eb',
  BORDER_DARK: '#9ca3af',
  BG_LIGHT: '#f9fafb',
  BG_DARK: '#1f2937',
  TEXT_PRIMARY: '#111827',
  TEXT_SECONDARY: '#6b7280'
};

// CSS class mappings for easy adoption
const COLOR_CLASSES = {
  infected: 'status-infected',
  bw_zone: 'status-bw-zone',
  local_zone: 'status-local-zone',
  healthy: 'status-healthy'
};

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COLOR_PALETTE, COLOR_CLASSES };
}

// Usage in HTML/CSS:
// <div class="status-badge status-infected">Smittet</div>
// 
// CSS:
// .status-infected { background-color: #ef4444; }
// .status-bw-zone { background-color: #f59e0b; }
// .status-local-zone { background-color: #facc15; }
// .status-healthy { background-color: #10b981; }
