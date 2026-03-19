/**
 * AutoLoadManager - Global auto-refresh system for Kyst Dashboard
 * 
 * Provides centralized auto-refresh timer with:
 * - 60-second refresh interval
 * - Automatic "updated X sec ago" timestamp updates
 * - Filter state tracking to prevent auto-update during user interactions
 * - Per-dashboard refresh function registration
 */

const AutoLoadManager = (() => {
  let config = {
    refreshInterval: 60000, // 60 seconds
    isEnabled: true,
    pauseWhileFiltering: true,
  };

  let state = {
    lastRefreshTime: null,
    isUserFiltering: false,
    filterTimeoutHandle: null,
    registeredPanels: {}, // { panelId: { loadFn, timestampElementId } }
    refreshTimers: {}, // { panelId: timerId }
  };

  let globalRefreshTimer = null;
  let timestampUpdateTimer = null;

  /**
   * Initialize AutoLoadManager (call once on DOMContentLoaded)
   */
  function init() {
    
    
    // Start global refresh timer
    startGlobalRefreshTimer();
    
    // Start timestamp updater (updates every second)
    startTimestampUpdater();
    
    // Track filter interactions
    setupFilterTracking();
    
    
  }

  /**
   * Register a panel for auto-refresh
   * @param {string} panelId - ID of the panel
   * @param {Function} loadFn - Async function that loads the panel data
   * @param {string} timestampElementId - Optional: ID of element to update with timestamp
   */
  function registerPanel(panelId, loadFn, timestampElementId = null) {
    if (!panelId || typeof loadFn !== 'function') {
      console.warn('AutoLoadManager: Invalid panel registration', { panelId, loadFn });
      return;
    }
    
    state.registeredPanels[panelId] = {
      loadFn,
      timestampElementId,
      lastLoadTime: null,
      isLoading: false
    };
    
    
  }

  /**
   * Start the global refresh timer
   */
  function startGlobalRefreshTimer() {
    if (globalRefreshTimer) clearInterval(globalRefreshTimer);
    
    globalRefreshTimer = setInterval(() => {
      if (!config.isEnabled) return;
      
      // Skip refresh if user is actively filtering
      if (config.pauseWhileFiltering && state.isUserFiltering) {
        
        return;
      }
      
      refreshAllPanels();
    }, config.refreshInterval);
    
    
  }

  /**
   * Start the timestamp updater (runs every second)
   */
  function startTimestampUpdater() {
    if (timestampUpdateTimer) clearInterval(timestampUpdateTimer);
    
    timestampUpdateTimer = setInterval(() => {
      updateAllTimestamps();
    }, 1000);
  }

  /**
   * Refresh all registered panels
   */
  async function refreshAllPanels() {
    
    state.lastRefreshTime = new Date();
    
    const panelIds = Object.keys(state.registeredPanels);
    
    for (const panelId of panelIds) {
      const panel = state.registeredPanels[panelId];
      
      if (panel.isLoading) {
        
        continue;
      }
      
      try {
        panel.isLoading = true;
        panel.lastLoadTime = new Date();
        
        
        await panel.loadFn();
        
        
      } catch (error) {
        console.warn(`⚠️ Failed to refresh panel ${panelId}:`, error);
      } finally {
        panel.isLoading = false;
      }
    }
    
    
  }

  /**
   * Update all panel timestamps (not timestamps in footer)
   */
  function updateAllTimestamps() {
    for (const [panelId, panel] of Object.entries(state.registeredPanels)) {
      if (!panel.timestampElementId || !panel.lastLoadTime) continue;
      
      const el = document.getElementById(panel.timestampElementId);
      if (!el) continue;
      
      const secondsAgo = Math.floor((new Date() - panel.lastLoadTime) / 1000);
      const timeText = formatTimeAgo(secondsAgo);
      
      if (el.textContent !== timeText) {
        el.textContent = timeText;
      }
    }
  }

  /**
   * Format seconds into "X sekunder siden" / "X minutter siden" etc
   */
  function formatTimeAgo(seconds) {
    if (seconds < 60) {
      return `oppdatert ${seconds}s siden`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `oppdatert ${minutes}m siden`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `oppdatert ${hours}h siden`;
    }
  }

  /**
   * Track when user interacts with filters
   */
  function setupFilterTracking() {
    // Listen for input/select changes on common filter selectors
    const filterSelectors = [
      'input[type="checkbox"]',
      'input[type="radio"]',
      'select[id*="filter"]',
      'input[id*="filter"]',
      'input.filter',
      '[data-filter-control]'
    ];
    
    document.addEventListener('change', (e) => {
      // Check if it's a filter element
      const isFilter = filterSelectors.some(sel => e.target.matches(sel));
      
      if (isFilter) {
        pauseRefreshForUserInteraction();
      }
    }, true);
  }

  /**
   * Pause auto-refresh while user is filtering, resume after inactivity
   */
  function pauseRefreshForUserInteraction() {
    state.isUserFiltering = true;
    
    // Clear existing timeout
    if (state.filterTimeoutHandle) {
      clearTimeout(state.filterTimeoutHandle);
    }
    
    // Resume after 3 seconds of inactivity
    state.filterTimeoutHandle = setTimeout(() => {
      state.isUserFiltering = false;
      
    }, 3000);
  }

  /**
   * Manually trigger refresh of a specific panel
   */
  async function refreshPanel(panelId) {
    const panel = state.registeredPanels[panelId];
    if (!panel) {
      console.warn(`Panel not found: ${panelId}`);
      return;
    }
    
    if (panel.isLoading) {
      
      return;
    }
    
    try {
      panel.isLoading = true;
      panel.lastLoadTime = new Date();
      await panel.loadFn();
      
    } catch (error) {
      console.warn(`Failed to refresh panel ${panelId}:`, error);
    } finally {
      panel.isLoading = false;
    }
  }

  /**
   * Pause all auto-refresh
   */
  function pause() {
    config.isEnabled = false;
    
  }

  /**
   * Resume auto-refresh
   */
  function resume() {
    config.isEnabled = true;
    
  }

  /**
   * Stop all timers and cleanup
   */
  function destroy() {
    if (globalRefreshTimer) clearInterval(globalRefreshTimer);
    if (timestampUpdateTimer) clearInterval(timestampUpdateTimer);
    if (state.filterTimeoutHandle) clearTimeout(state.filterTimeoutHandle);
    
    state.registeredPanels = {};
    state.refreshTimers = {};
    
    
  }

  /**
   * Public API
   */
  return {
    init,
    registerPanel,
    refreshPanel,
    pause,
    resume,
    destroy,
    getState: () => ({ ...state, config }),
    formatTimeAgo
  };
})();

// Auto-initialize if DOM is already loaded
if (document.readyState !== 'loading') {
  AutoLoadManager.init();
} else {
  document.addEventListener('DOMContentLoaded', () => AutoLoadManager.init());
}
