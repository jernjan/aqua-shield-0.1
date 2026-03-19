window.OverviewRiskModule = (function () {
  'use strict';

  /**
   * Renders the risk overview tab with filtering capabilities.
   * Shows facility risk cards with counts by risk level.
   */
  function renderRisk() {
    if (!elements?.riskGrid || !elements?.riskSummary) {
      return;
    }

    const riskItems = Array.isArray(state?.risk) ? state.risk : [];
    if (!riskItems.length) {
      elements.riskGrid.innerHTML = "Load risk data to see assessments.";
      elements.riskSummary.innerHTML = "";
      return;
    }

    const riskLevelEl = document.getElementById("risk-level") || document.getElementById("riskLevel");
    const diseaseFilterEl = document.getElementById("risk-disease") || document.getElementById("diseaseFilter");
    const searchEl = document.getElementById("riskSearch");

    const riskLevel = riskLevelEl?.value || "all";
    const diseaseFilter = diseaseFilterEl?.value || "all";
    const search = (searchEl?.value || "").toLowerCase();

    let filtered = [...riskItems];

    if (riskLevel !== "all") {
      filtered = filtered.filter((item) => item.risk_level === riskLevel);
    }

    if (diseaseFilter === "ila") {
      filtered = filtered.filter((item) => item.disease_status?.has_ila);
    }
    if (diseaseFilter === "pd") {
      filtered = filtered.filter((item) => item.disease_status?.has_pd);
    }
    if (diseaseFilter === "none") {
      filtered = filtered.filter((item) => !item.disease_status?.has_ila && !item.disease_status?.has_pd);
    }

    if (search) {
      filtered = filtered.filter((item) => {
        const name = item.facility_name?.toLowerCase() || "";
        const code = item.facility_code?.toLowerCase() || "";
        return name.includes(search) || code.includes(search);
      });
    }

    const counts = {
      Critical: riskItems.filter((r) => r.risk_level === "Critical").length,
      High: riskItems.filter((r) => r.risk_level === "High").length,
      Medium: riskItems.filter((r) => r.risk_level === "Medium").length,
      Low: riskItems.filter((r) => r.risk_level === "Low").length,
    };

    setMiniCards(elements.riskSummary, [
      { label: "Critical", value: counts.Critical },
      { label: "High", value: counts.High },
      { label: "Medium", value: counts.Medium },
      { label: "Low", value: counts.Low },
      { label: "Shown", value: filtered.length, meta: "Filtered" },
    ]);

    elements.riskGrid.innerHTML = filtered
      .map((item) => {
        const level = item.risk_level?.toLowerCase() || "medium";
        const lice = item.lice_data || {};
        const riskScore = item.risk_score ?? "--";
        const sources = item.disease_status?.disease_sources;
        const sourcesCount = Array.isArray(sources) ? sources.length : 0;
        return `
      <div class="card">
        <div class="card-title">${item.facility_name || "Unknown"}</div>
        <div class="mono">${item.facility_code || "--"}</div>
        <span class="tag ${level}">${item.risk_level || "Unknown"}</span>
        <div>Score: <strong>${riskScore}</strong></div>
        <div>Location: ${formatCoord(item.location?.latitude)}, ${formatCoord(item.location?.longitude)}</div>
        <div>Biggest factor: ${item.biggest_risk_factor || "--"}</div>
        <div>ILA: ${item.disease_status?.has_ila ? "Yes" : "No"} | PD: ${item.disease_status?.has_pd ? "Yes" : "No"}</div>
        <div>Disease sources: ${sourcesCount || "None"}</div>
        <div>Lice (adult): ${lice.adult_female_lice ?? "--"}, mobile: ${lice.mobile_lice ?? "--"}</div>
      </div>
      `;
      })
      .join("");
  }

  /**
   * Populates disease filter dropdowns from facility and vessel risk data.
   * Extracts unique disease names and sorts them alphabetically.
   */
  function populateDiseaseFilters() {
    const diseases = new Set();
    
    // Extract diseases from facility risk data
    if (state.facilityRisk && state.facilityRisk.length) {
      state.facilityRisk.forEach((facility) => {
        const allNearby = facility.all_nearby_diseases || [];
        allNearby.forEach((neighbor) => {
          const neighborDiseases = neighbor.diseases || [];
          neighborDiseases.forEach((d) => {
            const diseaseName = typeof d === 'string' ? d : d.name || '';
            if (diseaseName) diseases.add(diseaseName);
          });
        });
      });
    }
    
    // Extract diseases from vessel risk data
    if (state.vesselRisk && state.vesselRisk.length) {
      state.vesselRisk.forEach((vessel) => {
        const facility = vessel.infected_facility || {};
        const facilityDiseases = facility.diseases || [];
        facilityDiseases.forEach((d) => {
          if (d) diseases.add(d);
        });
      });
    }
    
    // Sort diseases alphabetically
    const sortedDiseases = Array.from(diseases).sort();
    
    // Populate facility disease filter
    if (elements.facilityDiseaseFilter) {
      const currentValue = elements.facilityDiseaseFilter.value;
      elements.facilityDiseaseFilter.innerHTML = '<option value="all">All Diseases</option>';
      sortedDiseases.forEach((disease) => {
        const option = document.createElement('option');
        option.value = disease;
        option.textContent = disease;
        elements.facilityDiseaseFilter.appendChild(option);
      });
      elements.facilityDiseaseFilter.value = currentValue;
    }
    
    // Populate vessel disease filter
    if (elements.vesselDiseaseFilter) {
      const currentValue = elements.vesselDiseaseFilter.value;
      elements.vesselDiseaseFilter.innerHTML = '<option value="all">All Diseases</option>';
      sortedDiseases.forEach((disease) => {
        const option = document.createElement('option');
        option.value = disease;
        option.textContent = disease;
        elements.vesselDiseaseFilter.appendChild(option);
      });
      elements.vesselDiseaseFilter.value = currentValue;
    }
  }

  // Public API
  return {
    renderRisk,
    populateDiseaseFilters,
  };
})();
