/**
 * Priority Actions Module
 * Handles priority-list related click actions in admin dashboard.
 */

window.AdminPriorityActionsModule = (function () {
  'use strict';

  function setupPriorityActions(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      getCorrelationData = () => ({}),
      showFacilityDetails = () => {},
      showCorrelationDetail = () => {},
      alertFn = () => {}
    } = deps;

    documentRef.addEventListener("click", (evt) => {
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
        const top10 = getCorrelationData().top_priority || [];
        if (idx >= 0 && idx < top10.length) {
          const link = top10[idx];
          alertFn(`Varsling sendt til ${link.facility_name} (${link.facility_code})`);
        }
      }
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
  }

  return {
    setupPriorityActions,
  };
})();
