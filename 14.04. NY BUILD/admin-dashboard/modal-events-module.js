/**
 * Modal Events Module
 * Handles modal button and backdrop interactions.
 */

window.AdminModalEventsModule = (function () {
  'use strict';

  function setupModalEvents(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      closeModal = () => {},
      closeRiskFactorModal = () => {},
      alertFn = () => {}
    } = deps;

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
  }

  return {
    setupModalEvents,
  };
})();
