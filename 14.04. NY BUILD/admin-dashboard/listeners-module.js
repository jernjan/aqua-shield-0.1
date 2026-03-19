/**
 * Listeners Module
 * Handles setup of UI event listeners with duplicate-guarding.
 */

window.ListenersModule = (function () {
  'use strict';

  const boundRegistry = new WeakMap();
  const missingRegistry = new Set();

  function setupListeners(deps) {
    const {
      elements,
      state,
      documentRef = document,
      alertFn = alert,
      loadAdmin,
      loadRisk,
      loadFacilityRisk,
      loadVesselRisk,
      loadPredictions,
      loadVesselClearing,
      loadConfirmedPlans,
      loadAuditLog,
      loadFacilities,
      loadVessels,
      loadOcean,
      loadSmittespredning,
      loadHealth,
      loadCriticalAlerts,
      searchVesselByName,
      renderVesselRisk,
      renderPredictions,
      renderVesselClearing,
      renderFacilityRisk,
      renderAdminVesselList,
      renderSmittespredning,
      showIsolateModal,
      showApproveModal,
      showFacilityDetails,
      showCorrelationDetail,
      closeModal,
      closeRiskFactorModal,
      openEventModal,
      getCorrelationData,
      getNetworkGraph,
      resetGraphHighlight
    } = deps;

    const safeAttach = (element, event, handler, debugName) => {
      if (element && typeof element.addEventListener === 'function') {
        const key = `${event}:${element.id || debugName || 'anonymous'}`;
        let boundKeys = boundRegistry.get(element);
        if (!boundKeys) {
          boundKeys = new Set();
          boundRegistry.set(element, boundKeys);
        }

        if (boundKeys.has(key)) {
          return true;
        }

        element.addEventListener(event, handler);
        boundKeys.add(key);
        return true;
      }

      const missingKey = `${event}:${debugName || 'anonymous'}`;
      if (window.__KM_DEBUG_LISTENERS === true && !missingRegistry.has(missingKey)) {
        console.warn(`[LISTENERS] Missing optional target for ${missingKey}`, element);
        missingRegistry.add(missingKey);
      }

      return false;
    };

    safeAttach(elements.adminLoad, "click", () => { loadAdmin(); }, "adminLoad");
    safeAttach(documentRef.getElementById("admin-load"), "click", () => { loadAdmin(); }, "admin-load");
    safeAttach(documentRef.getElementById("admin-refresh"), "click", () => { loadAdmin(); }, "admin-refresh");

    safeAttach(elements.loadRisk, "click", () => { loadRisk(); }, "loadRisk");
    safeAttach(documentRef.getElementById("risk-load"), "click", () => { loadRisk(); }, "risk-load");

    safeAttach(elements.loadFacilityRisk, "click", () => { loadFacilityRisk(); }, "loadFacilityRisk");
    safeAttach(documentRef.getElementById("facility-risk-load"), "click", () => { loadFacilityRisk(); }, "facility-risk-load");

    safeAttach(elements.loadVesselRisk, "click", () => { loadVesselRisk(); }, "loadVesselRisk");
    safeAttach(documentRef.getElementById("vessel-risk-load"), "click", () => { loadVesselRisk(); }, "vessel-risk-load");

    safeAttach(documentRef.getElementById("predictionsLoad"), "click", () => { loadPredictions(); }, "predictionsLoad");
    safeAttach(documentRef.getElementById("vessel-clearing-load"), "click", () => { loadVesselClearing(); }, "vessel-clearing-load");
    safeAttach(documentRef.getElementById("confirmed-plans-load"), "click", () => { loadConfirmedPlans(); }, "confirmed-plans-load");
    safeAttach(documentRef.getElementById("audit-load"), "click", () => { loadAuditLog(); }, "audit-load");
    safeAttach(documentRef.getElementById("facilities-load"), "click", () => { loadFacilities(); }, "facilities-load");
    safeAttach(documentRef.getElementById("vessels-load"), "click", () => { loadVessels(); }, "vessels-load");
    safeAttach(documentRef.getElementById("ocean-load"), "click", () => { loadOcean(); }, "ocean-load");
    safeAttach(documentRef.getElementById("smitte-load"), "click", () => { loadSmittespredning(); }, "smitte-load");
    safeAttach(documentRef.getElementById("health-load"), "click", () => { loadHealth(); }, "health-load");

    const visitCategoryFilterBtns = documentRef.querySelectorAll('.visit-category-filter');

    const initializeFilterButtons = () => {
      visitCategoryFilterBtns.forEach(btn => {
        if (btn.dataset.category === state.visitCategoryFilter) {
          btn.style.opacity = '1';
        } else {
          btn.style.opacity = '0.6';
        }
      });
    };
    initializeFilterButtons();

    visitCategoryFilterBtns.forEach(btn => {
      safeAttach(btn, "click", function() {
        const category = this.dataset.category;
        state.visitCategoryFilter = category;
        initializeFilterButtons();
        renderVesselRisk();
      }, `visitCategoryFilter-${btn.dataset.category}`);
    });

    safeAttach(elements.vesselRiskLevel, "change", () => {
      renderVesselRisk();
    }, "vesselRiskLevel-change");

    safeAttach(elements.vesselChainFilter, "change", () => {
      renderVesselRisk();
    }, "vesselChainFilter-change");

    safeAttach(elements.vesselQuarantineFilter, "change", () => {
      renderVesselRisk();
    }, "vesselQuarantineFilter-change");

    const vesselRiskCardInfected = documentRef.getElementById('vesselRiskCardInfected');
    const vesselRiskCardHigh = documentRef.getElementById('vesselRiskCardHigh');
    const vesselRiskCardChain = documentRef.getElementById('vesselRiskCardChain');
    const vesselRiskCardTotal = documentRef.getElementById('vesselRiskCardTotal');

    safeAttach(vesselRiskCardInfected, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "infected";
      renderVesselRisk();
    }, "vesselRiskCardInfected");

    safeAttach(vesselRiskCardHigh, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "risk_zone";
      renderVesselRisk();
    }, "vesselRiskCardHigh");

    safeAttach(vesselRiskCardChain, "click", () => {
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "true";
      renderVesselRisk();
    }, "vesselRiskCardChain");

    safeAttach(vesselRiskCardTotal, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "all";
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "all";
      state.visitCategoryFilter = "all";
      initializeFilterButtons();
      renderVesselRisk();
    }, "vesselRiskCardTotal");

    safeAttach(elements.loadVesselClearing, "click", () => { loadVesselClearing(); }, "loadVesselClearing");
    safeAttach(elements.loadFacilities, "click", () => { loadFacilities(); }, "loadFacilities");
    safeAttach(elements.loadVessels, "click", () => { loadVessels(); }, "loadVessels");
    safeAttach(elements.loadHealth, "click", () => { loadHealth(); }, "loadHealth");
    safeAttach(elements.loadOcean, "click", () => { loadOcean(); }, "loadOcean");

    const refreshCriticalAlertsBtn = documentRef.getElementById("refreshCriticalAlerts");
    safeAttach(refreshCriticalAlertsBtn, "click", loadCriticalAlerts);

    safeAttach(elements.confirmedPlansLoad, "click", () => { loadConfirmedPlans(); }, "confirmedPlansLoad");
    if (elements.confirmedPlansMmsi) {
      safeAttach(elements.confirmedPlansMmsi, "keypress", (e) => {
        if (e.key === "Enter") loadConfirmedPlans();
      });
    }

    const auditLoadBtn = documentRef.getElementById("loadAuditLog");
    safeAttach(auditLoadBtn, "click", () => { loadAuditLog(); }, "loadAuditLog");
    const auditMmsiFilter = documentRef.getElementById("auditMmsiFilter");
    if (auditMmsiFilter) {
      safeAttach(auditMmsiFilter, "keypress", (e) => {
        if (e.key === "Enter") loadAuditLog();
      });
    }

    safeAttach(elements.predictionsLoad, "click", () => { loadPredictions(); }, "predictionsLoad-legacy");

    safeAttach(elements.showAllPredictionsToggle, "change", (e) => {
      state.filters.showAllPredictions = e.target.checked;
      renderPredictions();
      
    }, "showAllPredictionsToggle");

    safeAttach(elements.showOnlyProtectionToggle, "change", (e) => {
      state.filters.showOnlyProtectionZones = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlySurveillanceZones = false;
        if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
      }
      renderPredictions();
      
    }, "showOnlyProtectionToggle");

    safeAttach(elements.showOnlySurveillanceToggle, "change", (e) => {
      state.filters.showOnlySurveillanceZones = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlyProtectionZones = false;
        if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
        if (elements.showOnlyWithin10kmToggle) elements.showOnlyWithin10kmToggle.checked = false;
        state.filters.showOnlyWithin10km = false;
      }
      renderPredictions();
      
    }, "showOnlySurveillanceToggle");

    safeAttach(elements.showOnlyWithin10kmToggle, "change", (e) => {
      state.filters.showOnlyWithin10km = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlyProtectionZones = false;
        state.filters.showOnlySurveillanceZones = false;
        if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
        if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
      }
      renderPredictions();
      
    }, "showOnlyWithin10kmToggle");

    const searchVesselBtn = documentRef.getElementById("searchVesselBtn");
    safeAttach(searchVesselBtn, "click", searchVesselByName);
    const vesselSearchName = documentRef.getElementById("vesselSearchName");
    if (vesselSearchName) {
      safeAttach(vesselSearchName, "keypress", (e) => {
        if (e.key === "Enter") searchVesselByName();
      });
    }

    const adminActionIsolate = documentRef.getElementById("adminActionIsolate");
    safeAttach(adminActionIsolate, "click", () => showIsolateModal());

    const adminActionApprove = documentRef.getElementById("adminActionApprove");
    safeAttach(adminActionApprove, "click", () => showApproveModal());

    const adminActionRefresh = documentRef.getElementById("adminActionRefresh");
    safeAttach(adminActionRefresh, "click", () => loadAdmin());

    const adminActionExport = documentRef.getElementById("adminActionExport");
    safeAttach(adminActionExport, "click", () => {
      alertFn("📄 EXPORT: Compliance report ready for download. (Coming soon)");
    });

    safeAttach(documentRef, "click", (evt) => {
      const btn = evt.target.closest("button[data-action]");
      if (!btn) return;

      const priorityContainer = btn.closest("#adminPriorityList");
      if (!priorityContainer) return;

      const action = btn.dataset.action;

      if (action === "details") {
        const facilityCode = btn.dataset.facilityCode;
        if (facilityCode) {
          showFacilityDetails(facilityCode);
        }
      } else if (action === "notify") {
        const idx = parseInt(btn.dataset.index, 10);
        const top10 = (getCorrelationData()?.top_priority) || [];
        if (idx >= 0 && idx < top10.length) {
          const link = top10[idx];
          alertFn(`Varsling sendt til ${link.facility_name} (${link.facility_code})`);
        }
      }
    }, "document-priority-actions");

    const graphZoomIn = documentRef.getElementById("graphZoomIn");
    safeAttach(graphZoomIn, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale * 1.2 });
    });

    const graphZoomOut = documentRef.getElementById("graphZoomOut");
    safeAttach(graphZoomOut, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale / 1.2 });
    });

    const graphReset = documentRef.getElementById("graphReset");
    safeAttach(graphReset, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      resetGraphHighlight();
      networkGraph.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    });

    const priorityList = documentRef.getElementById("adminPriorityList");
    if (priorityList) {
      safeAttach(priorityList, "click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const index = Number(button.dataset.index || "0");
        const link = getCorrelationData()?.top_priority?.[index];
        if (!link) return;

        if (button.dataset.action === "details") {
          showCorrelationDetail(link);
        }

        if (button.dataset.action === "notify") {
          alertFn(`📧 Notify: Sending alert to ${link.facility_name} regarding ${link.vessel_name}.`);
        }
      });
    }

    const isolateCancel = documentRef.getElementById("isolateCancel");
    safeAttach(isolateCancel, "click", () => closeModal("isolateModal"));

    const isolateConfirm = documentRef.getElementById("isolateConfirm");
    safeAttach(isolateConfirm, "click", () => {
      closeModal("isolateModal");
      alertFn("✅ Isolation queued: High-risk vessels marked as pending.");
    });

    const approveCancel = documentRef.getElementById("approveCancel");
    safeAttach(approveCancel, "click", () => closeModal("approveModal"));

    const approveConfirm = documentRef.getElementById("approveConfirm");
    safeAttach(approveConfirm, "click", () => {
      closeModal("approveModal");
      alertFn("✅ Approval queued: Cleared vessels marked as approved.");
    });

    const detailClose = documentRef.getElementById("detailClose");
    safeAttach(detailClose, "click", () => closeModal("correlationDetailModal"));

    const detailNotify = documentRef.getElementById("detailNotify");
    safeAttach(detailNotify, "click", () => {
      const modal = documentRef.getElementById("correlationDetailModal");
      const facilityName = modal?.dataset?.facilityName || "Facility";
      const facilityEmail = modal?.dataset?.facilityEmail || "facility@example.com";
      alertFn(`📧 Notify: Simulated email sent to ${facilityName} (${facilityEmail}).`);
      closeModal("correlationDetailModal");
    });

    ["isolateModal", "approveModal", "correlationDetailModal"].forEach((modalId) => {
      const modal = documentRef.getElementById(modalId);
      if (modal) {
        safeAttach(modal, "click", (event) => {
          if (event.target === modal) closeModal(modalId);
        });
      }
    });

    const riskFactorModal = documentRef.getElementById("riskFactorModal");
    if (riskFactorModal) {
      riskFactorModal.querySelectorAll("[data-modal-close]").forEach((button) => {
        safeAttach(button, "click", closeRiskFactorModal);
      });
      safeAttach(riskFactorModal, "click", (event) => {
        if (event.target === riskFactorModal) closeRiskFactorModal();
      });
    }

    ["vesselStatusFilter", "vesselClearingSearch"].forEach((id) => {
      const el = documentRef.getElementById(id);
      safeAttach(el, "input", renderVesselClearing);
    });

    if (elements.facilityViewList && elements.facilityViewTable) {
      safeAttach(elements.facilityViewList, "click", () => {
        state.facilityRiskView = "list";
        elements.facilityViewList.classList.add("active");
        elements.facilityViewTable.classList.remove("active");
        renderFacilityRisk();
      });

      safeAttach(elements.facilityViewTable, "click", () => {
        state.facilityRiskView = "table";
        elements.facilityViewTable.classList.add("active");
        elements.facilityViewList.classList.remove("active");
        renderFacilityRisk();
      });
    }

    ["vessel-risk-filter", "vessel-chain-filter", "vessel-quarantine-filter", "vesselRiskLevel", "vesselChainFilter", "vesselQuarantineFilter"].forEach((id) => {
      const el = documentRef.getElementById(id);
      safeAttach(el, "input", renderVesselRisk);
    });

    ["adminVesselSpeed", "adminVesselSearch"].forEach((id) => {
      const el = documentRef.getElementById(id);
      safeAttach(el, "input", renderAdminVesselList);
    });

    safeAttach(elements.loadSmitte, "click", () => { loadSmittespredning(); }, "loadSmitte-legacy");
    safeAttach(elements.refreshSmitte, "click", () => { loadSmittespredning(); }, "refreshSmitte");
    safeAttach(elements.smitteStatusFilter, "change", renderSmittespredning);

    const logEventBtn = documentRef.getElementById("logEventBtn");
    safeAttach(logEventBtn, "click", openEventModal);

    
  }

  return {
    setupListeners
  };
})();
