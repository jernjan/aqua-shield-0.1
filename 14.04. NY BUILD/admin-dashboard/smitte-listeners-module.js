/**
 * Smitte Listeners Module
 * Handles smittespredning legacy listener bindings and log event action.
 */

window.AdminSmitteListenersModule = (function () {
  'use strict';

  function setupSmitteListeners(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      elements = {},
      loadSmittespredning = () => {},
      renderSmittespredning = () => {},
      openEventModal = () => {}
    } = deps;

    safeAttach(elements.loadSmitte, "click", () => { loadSmittespredning(); }, "loadSmitte-legacy");
    safeAttach(elements.refreshSmitte, "click", () => { loadSmittespredning(); }, "refreshSmitte");
    safeAttach(elements.smitteStatusFilter, "change", renderSmittespredning);

    const logEventBtn = documentRef.getElementById("logEventBtn");
    safeAttach(logEventBtn, "click", openEventModal);
  }

  return {
    setupSmitteListeners,
  };
})();
