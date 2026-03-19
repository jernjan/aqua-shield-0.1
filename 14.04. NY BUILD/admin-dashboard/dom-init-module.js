/**
 * DOM Initialization Module - Modal Close Handlers
 * Manages DOMContentLoaded event listeners for closing modals
 * when users click on backdrops or close buttons
 */

window.DOMInitModule = (function() {
  /**
   * Setup DOM initialization handlers
   * @param {Object} params - Configuration parameters
   * @param {Object} params.closeEventModalFn - Function to close event modal
   * @param {Function} params.closeTransmissionModalFn - Function to close transmission modal
   * @param {Function} params.closeRiskFactorModalFn - Function to close risk factor modal
   */
  function setupDOMInit(params) {
    const {
      closeEventModalFn,
      closeTransmissionModalFn,
      closeRiskFactorModalFn
    } = params;

    // Event Modal close handler
    const eventModal = document.getElementById("eventModal");
    if (eventModal) {
      window.addEventListener("click", (e) => {
        if (e.target === eventModal) {
          closeEventModalFn();
        }
      });
    }

    // Transmission Modal close handler
    const transmissionModal = document.getElementById("transmissionModal");
    if (transmissionModal) {
      const backdrop = transmissionModal.querySelector(".modal-backdrop");
      const closeBtn = transmissionModal.querySelector(".modal-close");
      
      if (backdrop) {
        backdrop.addEventListener("click", () => closeTransmissionModalFn());
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => closeTransmissionModalFn());
      }
      
      window.addEventListener("click", (e) => {
        if (e.target === transmissionModal) {
          closeTransmissionModalFn();
        }
      });
    }

    // Risk Factor Modal close handler
    const riskFactorModal = document.getElementById("riskFactorModal");
    if (riskFactorModal) {
      const backdrop = riskFactorModal.querySelector(".modal-backdrop");
      const closeBtn = riskFactorModal.querySelector(".modal-close");
      
      if (backdrop) {
        backdrop.addEventListener("click", () => closeRiskFactorModalFn());
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => closeRiskFactorModalFn());
      }
    }

    
  }

  return {
    setupDOMInit
  };
})();
