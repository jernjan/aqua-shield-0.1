/**
 * Admin Load Fallback Module
 * Dedicated fallback for loading admin correlations when primary module fails.
 */

window.AdminLoadFallbackModule = (function () {
  'use strict';

  async function loadAdminFallback(deps) {
    const {
      apiFetch,
      setCorrelationData,
      state,
      renderAdminCorrelations,
      documentRef = document,
      setModuleCorrelationData
    } = deps;

    try {
      const loadedCorrelationData = await apiFetch("/api/risk/correlations");
      setCorrelationData(loadedCorrelationData);

      if (typeof setModuleCorrelationData === "function") {
        setModuleCorrelationData(loadedCorrelationData);
      }

      if (!loadedCorrelationData || !loadedCorrelationData.summary || loadedCorrelationData.summary.total_correlations === 0) {
        documentRef.getElementById("admin-data").innerHTML = `
          <div style="padding: 2rem; text-align: center; color: #10b981; font-size: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">✅</div>
            <div><strong>Great news!</strong> Ingen høyrisiko-koblinger akkurat nå.</div>
            <div style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.9rem;">Systemet overvåker kontinuerlig for endringer.</div>
          </div>
        `;
      } else {
        state.loaded.admin = true;
        renderAdminCorrelations();
      }
    } catch (error) {
      console.error("Error loading correlations:", error);
      documentRef.getElementById("admin-data").innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;">❌ Feil ved lasting av risiko-nettverk: ${error.message}</div>`;
    }
  }

  return {
    loadAdminFallback,
  };
})();
