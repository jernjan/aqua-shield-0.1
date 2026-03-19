/**
 * vessel-search-module.js
 * Handles vessel search by name functionality
 */

window.AdminVesselSearchModule = (function() {
  'use strict';

  function setupVesselSearch(params) {
    const {
      documentRef,
      safeAttach,
      searchVesselByName
    } = params;

    // Search button click
    const searchVesselBtn = documentRef.getElementById("searchVesselBtn");
    safeAttach(searchVesselBtn, "click", searchVesselByName);

    // Enter key in search input
    const vesselSearchName = documentRef.getElementById("vesselSearchName");
    if (vesselSearchName) {
      safeAttach(vesselSearchName, "keypress", (e) => {
        if (e.key === "Enter") searchVesselByName();
      });
    }

    
  }

  return {
    setupVesselSearch
  };
})();
