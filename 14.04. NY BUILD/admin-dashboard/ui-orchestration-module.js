/**
 * UI Orchestration Module
 * Handles dashboard overview loading, tab setup, tab switching, and mini-card rendering.
 *
 * Dependencies are injected from app.js to preserve safe fallback behavior.
 */

window.UIOrchestrationModule = (function () {
  'use strict';

  function loadTabData(tabName, deps) {
    const {
      state,
      loadAdmin,
      loadCriticalAlerts,
      loadRisk,
      loadPredictions,
      loadSmittespredning,
      loadFacilityRisk,
      loadVesselRisk,
      loadVesselClearing,
      loadConfirmedPlans,
      loadAuditLog,
      loadFacilities,
      loadVessels,
      loadHealth,
      loadOcean
    } = deps;

    if (!state.loaded[tabName]) {
      if (tabName === "admin") {
        loadAdmin();
        loadCriticalAlerts();
      }
      if (tabName === "risk") loadRisk();
      if (tabName === "predictions") loadPredictions();
      if (tabName === "smittespredning") loadSmittespredning();
      if (tabName === "facility-risks") loadFacilityRisk();
      if (tabName === "vessel-risk") loadVesselRisk();
      if (tabName === "vessel-clearing") loadVesselClearing();
      if (tabName === "confirmed-plans") loadConfirmedPlans();
      if (tabName === "audit-log") loadAuditLog();
      if (tabName === "facilities") loadFacilities();
      if (tabName === "vessels") loadVessels();
      if (tabName === "health") loadHealth();
      if (tabName === "ocean") loadOcean();
    }
  }

  async function loadOverview(deps) {
    const {
      elements,
      API_BASE,
      apiFetch,
      setApiStatus,
      formatNumber,
      state
    } = deps;

    elements.apiBase.textContent = API_BASE;
    try {
      
      const [health, facilities, vessels, ocean] = await Promise.all([
        apiFetch("/health"),
        apiFetch("/api/facilities?limit=1"),
        apiFetch("/api/vessels?limit=1"),
        apiFetch("/api/ocean/summary"),
      ]);

      
      const statusOk = health.status === "healthy";
      const datasources = health?.datasources ?? {};
      setApiStatus(statusOk, statusOk ? "Healthy" : "Degraded", datasources);
      elements.healthStatus.textContent = statusOk ? "Healthy" : "Degraded";
      elements.healthMeta.textContent = Object.values(datasources).join(" | ");

      elements.facilityTotal.textContent = formatNumber(facilities.total || facilities.count);
      elements.vesselTotal.textContent = formatNumber(vessels.total || vessels.count);
      if (elements.vesselMeta) {
        const source = vessels.source || "unknown";
        const sourceLabel = source === "barentswatch_ais"
          ? "AIS (BarentsWatch)"
          : (source === "confirmed_plans_fallback" ? "Fallback (confirmed plans)" : source);
        const errorText = vessels.error ? ` · ${vessels.error}` : "";
        elements.vesselMeta.textContent = `Source: ${sourceLabel}${errorText}`;
      }

      const coverage = ocean?.coverage
        ? `Lat ${ocean.coverage.lat_min} - ${ocean.coverage.lat_max}`
        : "Barentshavet";
      elements.oceanCoverage.textContent = coverage;

      const now = new Date();
      const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const date = now.toLocaleDateString("en-GB");
      elements.dataFreshness.textContent = `Last check: ${date} ${time}`;

      state.loaded.overview = true;
    } catch (error) {
      console.error("[DASHBOARD] Error loading overview:", error);
      setApiStatus(false, "Offline", {});
      elements.healthStatus.textContent = "Offline";
      elements.healthMeta.textContent = error.message;
      elements.dataFreshness.textContent = "Last check: --";
    }
  }

  function setupTabs(deps) {
    const { documentRef = document } = deps;
    const tabs = documentRef.querySelectorAll(".tab");
    const panels = documentRef.querySelectorAll(".panel");

    const activateTab = (tabName) => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      const selected = documentRef.querySelector(`.tab[data-tab="${tabName}"]`);
      if (selected) selected.classList.add("active");
      const target = documentRef.getElementById(tabName);
      if (target) target.classList.add("active");

      loadTabData(tabName, deps);
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateTab(tab.dataset.tab);
      });
    });

    documentRef.querySelectorAll("[data-tab]").forEach((button) => {
      if (!button.classList.contains("tab")) {
        button.addEventListener("click", () => activateTab(button.dataset.tab));
      }
    });
  }

  function switchTab(tabName, deps) {
    const { documentRef = document } = deps;
    const tab = documentRef.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tab) {
      tab.click();
      return;
    }

    const targetPanel = documentRef.getElementById(tabName);
    if (!targetPanel) return;

    documentRef.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    targetPanel.classList.add("active");

    loadTabData(tabName, deps);
  }

  function setMiniCards(container, items) {
    container.innerHTML = items
      .map(
        (item) => `
      <div class="mini-card">
        <div>${item.label}</div>
        <strong>${item.value}</strong>
        <div class="muted">${item.meta || ""}</div>
      </div>
    `
      )
      .join("");
  }

  return {
    loadOverview,
    setupTabs,
    switchTab,
    setMiniCards
  };
})();
