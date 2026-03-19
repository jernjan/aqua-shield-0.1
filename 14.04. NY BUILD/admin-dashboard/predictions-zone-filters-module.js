/**
 * predictions-zone-filters-module.js
 * Handles zone filter toggles and display options for predictions view
 */

window.AdminPredictionsZoneFiltersModule = (function() {
  'use strict';

  function setupPredictionsZoneFilters(params) {
    const {
      documentRef,
      elements,
      state,
      safeAttach,
      renderPredictions
    } = params;

    // Show all predictions toggle (display green 0-score facilities)
    safeAttach(elements.showAllPredictionsToggle, "change", (e) => {
      state.filters.showAllPredictions = e.target.checked;
      renderPredictions();
      
    }, "showAllPredictionsToggle");

    // Protection zone toggle
    safeAttach(elements.showOnlyProtectionToggle, "change", (e) => {
      state.filters.showOnlyProtectionZones = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlySurveillanceZones = false;
        state.filters.showOnlyWithin10km = false;
        if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
        if (elements.showOnlyWithin10kmToggle) elements.showOnlyWithin10kmToggle.checked = false;
      }
      renderPredictions();
      
    }, "showOnlyProtectionToggle");

    // Surveillance zone toggle
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

    // Within 10km toggle
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

    
  }

  return {
    setupPredictionsZoneFilters
  };
})();
