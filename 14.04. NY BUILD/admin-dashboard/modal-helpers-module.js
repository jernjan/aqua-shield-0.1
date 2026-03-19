/**
 * Modal Helpers Module
 * Small UI modal utility functions extracted from app.js.
 */

window.AdminModalHelpersModule = (function () {
  'use strict';

  function showModal(modalId, deps = {}) {
    const { documentRef = document } = deps;
    const modal = documentRef.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "flex";
  }

  function closeModal(modalId, deps = {}) {
    const { documentRef = document } = deps;
    const modal = documentRef.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
  }

  function showIsolateModal(deps = {}) {
    const {
      documentRef = document,
      getCorrelationData = () => null,
      showModalFn = () => {}
    } = deps;

    documentRef.getElementById("isolateCount").textContent = getCorrelationData()?.summary?.high_risk_boats || 0;
    showModalFn("isolateModal");
  }

  function showApproveModal(deps = {}) {
    const {
      showModalFn = () => {}
    } = deps;

    showModalFn("approveModal");
  }

  return {
    showModal,
    closeModal,
    showIsolateModal,
    showApproveModal,
  };
})();
