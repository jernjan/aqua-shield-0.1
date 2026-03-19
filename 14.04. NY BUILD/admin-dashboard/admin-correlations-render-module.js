/**
 * Admin Correlations Render Module
 * Handles rendering of admin correlation summary and delegated network views.
 */

window.AdminCorrelationsRenderModule = (function () {
  'use strict';

  function renderAdminCorrelations(deps = {}) {
    const {
      correlationData,
      ensureAdminCorrelationLayout,
      ensureCorrelationDetailModal,
      formatNumber,
      documentRef = document,
      networkModule = window.AdminCorrelationNetworkModule,
      renderNetworkGraphFallback,
      renderPriorityListFallback,
      renderOutbreakClustersFallback,
      renderInfectedFacilitiesFallback,
      renderAffectedFacilitiesFallback,
    } = deps;

    if (!correlationData) return;

    ensureAdminCorrelationLayout();
    ensureCorrelationDetailModal();

    const summary = correlationData.summary || {};

    const infectedEl = documentRef.getElementById("correlationInfected");
    const highBoatsEl = documentRef.getElementById("correlationHighBoats");
    const modBoatsEl = documentRef.getElementById("correlationModBoats");
    const affectedEl = documentRef.getElementById("correlationAffected");
    const linksEl = documentRef.getElementById("correlationLinks");

    if (infectedEl) infectedEl.textContent = formatNumber(summary.infected_facilities || 0);
    if (highBoatsEl) highBoatsEl.textContent = formatNumber(summary.high_risk_boats || 0);
    if (modBoatsEl) modBoatsEl.textContent = formatNumber(summary.moderate_risk_boats || 0);
    if (affectedEl) affectedEl.textContent = formatNumber(summary.potentially_affected_farms || 0);
    if (linksEl) linksEl.textContent = formatNumber(summary.total_correlations || 0);

    if (infectedEl?.parentElement?.parentElement) {
      infectedEl.parentElement.parentElement.className = "summary-card " + (summary.infected_facilities > 0 ? "status-red" : "");
    }
    if (highBoatsEl?.parentElement?.parentElement) {
      highBoatsEl.parentElement.parentElement.className = "summary-card alert " + (summary.high_risk_boats > 10 ? "status-red" : "");
    }
    if (modBoatsEl?.parentElement?.parentElement) {
      modBoatsEl.parentElement.parentElement.className = "summary-card warning " + (summary.moderate_risk_boats > 10 ? "status-yellow" : "");
    }
    if (affectedEl?.parentElement?.parentElement) {
      affectedEl.parentElement.parentElement.className = "summary-card " + (summary.potentially_affected_farms > 20 ? "status-orange" : "");
    }
    if (linksEl?.parentElement?.parentElement) {
      linksEl.parentElement.parentElement.className = "summary-card " + (summary.total_correlations > 100 ? "status-yellow" : "");
    }

    if (typeof networkModule?.renderNetworkGraph === "function") {
      try {
        networkModule.renderNetworkGraph();
      } catch (e) {
        console.warn("Module renderNetworkGraph failed, using fallback:", e);
        renderNetworkGraphFallback();
      }
    } else {
      renderNetworkGraphFallback();
    }

    if (typeof networkModule?.renderPriorityList === "function") {
      try {
        networkModule.renderPriorityList();
      } catch (e) {
        console.warn("Module renderPriorityList failed, using fallback:", e);
        renderPriorityListFallback();
      }
    } else {
      renderPriorityListFallback();
    }

    if (typeof networkModule?.renderOutbreakClusters === "function") {
      try {
        networkModule.renderOutbreakClusters();
      } catch (e) {
        console.warn("Module renderOutbreakClusters failed, using fallback:", e);
        renderOutbreakClustersFallback();
      }
    } else {
      renderOutbreakClustersFallback();
    }

    if (typeof networkModule?.renderInfectedFacilities === "function") {
      try {
        networkModule.renderInfectedFacilities();
      } catch (e) {
        console.warn("Module renderInfectedFacilities failed, using fallback:", e);
        renderInfectedFacilitiesFallback();
      }
    } else {
      renderInfectedFacilitiesFallback();
    }

    if (typeof networkModule?.renderAffectedFacilities === "function") {
      try {
        networkModule.renderAffectedFacilities();
      } catch (e) {
        console.warn("Module renderAffectedFacilities failed, using fallback:", e);
        renderAffectedFacilitiesFallback();
      }
    } else {
      renderAffectedFacilitiesFallback();
    }
  }

  return {
    renderAdminCorrelations,
  };
})();
