/**
 * UI Filter Bindings Module
 * Handles lower setupListeners filter/input bindings.
 */

window.AdminUiFilterBindingsModule = (function () {
  'use strict';

  function setupUiFilterBindings(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      elements = {},
      state = {},
      renderVesselClearing = () => {},
      renderFacilityRisk = () => {},
      renderVesselRisk = () => {},
      renderAdminVesselList = () => {}
    } = deps;

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
  }

  return {
    setupUiFilterBindings,
  };
})();
