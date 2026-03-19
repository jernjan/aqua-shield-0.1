window.AdminCoreLoadBindingsModule = (function () {
  function setupCoreLoadBindings(params) {
    const {
      documentRef,
      elements,
      safeAttach,
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
      loadCriticalAlerts
    } = params;

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

    safeAttach(elements.loadVesselClearing, "click", () => { loadVesselClearing(); }, "loadVesselClearing");
    safeAttach(elements.loadFacilities, "click", () => { loadFacilities(); }, "loadFacilities");
    safeAttach(elements.loadVessels, "click", () => { loadVessels(); }, "loadVessels");
    safeAttach(elements.loadHealth, "click", () => { loadHealth(); }, "loadHealth");
    safeAttach(elements.loadOcean, "click", () => { loadOcean(); }, "loadOcean");

    safeAttach(documentRef.getElementById("refreshCriticalAlerts"), "click", loadCriticalAlerts);

    safeAttach(elements.confirmedPlansLoad, "click", () => { loadConfirmedPlans(); }, "confirmedPlansLoad");
    if (elements.confirmedPlansMmsi) {
      safeAttach(elements.confirmedPlansMmsi, "keypress", (e) => {
        if (e.key === "Enter") loadConfirmedPlans();
      });
    }

    safeAttach(documentRef.getElementById("loadAuditLog"), "click", () => { loadAuditLog(); }, "loadAuditLog");
    const auditMmsiFilter = documentRef.getElementById("auditMmsiFilter");
    if (auditMmsiFilter) {
      safeAttach(auditMmsiFilter, "keypress", (e) => {
        if (e.key === "Enter") loadAuditLog();
      });
    }

    safeAttach(elements.predictionsLoad, "click", () => { loadPredictions(); }, "predictionsLoad-legacy");
  }

  return {
    setupCoreLoadBindings
  };
})();
