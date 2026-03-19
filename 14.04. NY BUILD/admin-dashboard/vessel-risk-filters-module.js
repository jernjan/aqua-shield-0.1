window.AdminVesselRiskFiltersModule = (function () {
  function setupVesselRiskFilters(params) {
    const {
      documentRef,
      elements,
      state,
      safeAttach,
      renderVesselRisk
    } = params;

    const visitCategoryFilterBtns = documentRef.querySelectorAll('.visit-category-filter');

    const initializeFilterButtons = () => {
      visitCategoryFilterBtns.forEach(btn => {
        if (btn.dataset.category === state.visitCategoryFilter) {
          btn.style.opacity = '1';
        } else {
          btn.style.opacity = '0.6';
        }
      });
    };
    initializeFilterButtons();

    visitCategoryFilterBtns.forEach(btn => {
      safeAttach(btn, "click", function () {
        const category = this.dataset.category;
        state.visitCategoryFilter = category;
        initializeFilterButtons();
        renderVesselRisk();
      }, `visitCategoryFilter-${btn.dataset.category}`);
    });

    safeAttach(elements.vesselRiskLevel, "change", () => {
      renderVesselRisk();
    }, "vesselRiskLevel-change");

    safeAttach(elements.vesselChainFilter, "change", () => {
      renderVesselRisk();
    }, "vesselChainFilter-change");

    safeAttach(elements.vesselQuarantineFilter, "change", () => {
      renderVesselRisk();
    }, "vesselQuarantineFilter-change");

    const vesselRiskCardInfected = documentRef.getElementById('vesselRiskCardInfected');
    const vesselRiskCardHigh = documentRef.getElementById('vesselRiskCardHigh');
    const vesselRiskCardChain = documentRef.getElementById('vesselRiskCardChain');
    const vesselRiskCardTotal = documentRef.getElementById('vesselRiskCardTotal');

    safeAttach(vesselRiskCardInfected, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "infected";
      renderVesselRisk();
    }, "vesselRiskCardInfected");

    safeAttach(vesselRiskCardHigh, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "risk_zone";
      renderVesselRisk();
    }, "vesselRiskCardHigh");

    safeAttach(vesselRiskCardChain, "click", () => {
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "true";
      renderVesselRisk();
    }, "vesselRiskCardChain");

    safeAttach(vesselRiskCardTotal, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "all";
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "all";
      if (elements.vesselQuarantineFilter) elements.vesselQuarantineFilter.value = "priority";
      state.visitCategoryFilter = "all";
      initializeFilterButtons();
      renderVesselRisk();
    }, "vesselRiskCardTotal");
  }

  return {
    setupVesselRiskFilters
  };
})();
