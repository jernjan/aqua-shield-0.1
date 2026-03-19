/**
 * Admin Actions Module
 * Handles admin correlation action buttons.
 */

window.AdminActionsModule = (function () {
  'use strict';

  function setupAdminActions(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      showIsolateModal = () => {},
      showApproveModal = () => {},
      loadAdmin = () => {},
      alertFn = () => {}
    } = deps;

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
  }

  return {
    setupAdminActions,
  };
})();
