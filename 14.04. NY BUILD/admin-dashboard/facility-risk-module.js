// ============================================================================
// Facility Risk Module
// Handles facility disease risk data loading, filtering, and rendering
// ============================================================================

const AdminFacilityRiskModule = (function() {
  'use strict';

  // ===== LOAD FACILITY RISK DATA =====
  async function loadFacilityRisk({ state, elements, apiFetch, formatNumber, populateDiseaseFilters, renderFacilityRisk }) {
    elements.facilityRiskList.innerHTML = "Loading facility disease risk data...";

    try {
      const data = await apiFetch("/api/facilities/disease-spread");
      state.facilityRisk = data.all_at_risk_facilities || [];
      state.facilityRiskSummary = {
        ekstrem: data.risk_summary?.ekstrem || 0,
        høy: data.risk_summary?.høy || 0,
        moderat: data.risk_summary?.moderat || 0,
        lav: data.risk_summary?.lav || 0,
        total: data.facilities_at_disease_risk || 0
      };
      
      elements.facilityRiskEkstremCount.textContent = formatNumber(data.risk_summary?.ekstrem || 0);
      elements.facilityRiskHøyCount.textContent = formatNumber(data.risk_summary?.høy || 0);
      elements.facilityRiskModeratCount.textContent = formatNumber(data.risk_summary?.moderat || 0);
      elements.facilityRiskLavCount.textContent = formatNumber(data.risk_summary?.lav || 0);
      elements.facilityRiskTotalCount.textContent = formatNumber(data.facilities_at_disease_risk || 0);
      
      populateDiseaseFilters();
      renderFacilityRisk();
      state.loaded.facilityRisk = true;
      state.loaded["facility-risks"] = true;
    } catch (error) {
      elements.facilityRiskList.innerHTML = `Error: ${error.message}`;
    }
  }

  // ===== RENDER FACILITY RISK LIST/TABLE =====
  function renderFacilityRisk({ state, elements }) {
    if (!state.facilityRisk || !state.facilityRisk.length) {
      elements.facilityRiskList.innerHTML = "No facilities at risk. Click 'Load facility risk' to fetch data.";
      if (elements.facilityRiskTopList) elements.facilityRiskTopList.textContent = "--";
      if (elements.facilityRiskTableBody) elements.facilityRiskTableBody.innerHTML = "";
      if (elements.facilityRiskSelectedId) elements.facilityRiskSelectedId.textContent = "Selected facility ID: -";
      return;
    }

    const riskLevel = elements.facilityRiskLevel.value;
    const search = elements.facilityRiskSearch.value.toLowerCase();
    const diseaseFilter = elements.facilityDiseaseFilter.value;
    const countyFilter = elements.facilityCountyFilter.value;
    let filtered = [...state.facilityRisk];

    if (riskLevel !== "all") {
      filtered = filtered.filter((f) => f.risk_level === riskLevel);
    }

    if (search) {
      filtered = filtered.filter((f) => {
        const name = (f.facility_name || "").toLowerCase();
        const code = String(f.facility_code || "");
        return name.includes(search) || code.includes(search);
      });
    }

    // Filter by disease type
    if (diseaseFilter !== "all") {
      filtered = filtered.filter((f) => {
        const allDiseases = f.all_nearby_diseases || [];
        return allDiseases.some((neighbor) => {
          const diseases = neighbor.diseases || [];
          return diseases.some((d) => {
            const diseaseName = typeof d === 'string' ? d : d.name || '';
            return diseaseName === diseaseFilter;
          });
        });
      });
    }

    // Filter by county (facility name contains county name)
    if (countyFilter !== "all") {
      filtered = filtered.filter((f) => {
        const name = (f.facility_name || "").toLowerCase();
        const county = countyFilter.toLowerCase();
        return name.includes(county);
      });
    }

    if (!filtered.length) {
      elements.facilityRiskList.innerHTML = "No facilities match the current filters.";
      if (elements.facilityRiskTopList) elements.facilityRiskTopList.textContent = "--";
      if (elements.facilityRiskTableBody) elements.facilityRiskTableBody.innerHTML = "";
      if (elements.facilityRiskSelectedId) elements.facilityRiskSelectedId.textContent = "Selected facility ID: -";
      return;
    }

    const sortedByRisk = [...filtered].sort((a, b) => b.risk_score - a.risk_score);
    const hasSelected = sortedByRisk.some((f) => String(f.facility_code) === String(state.facilityRiskSelectedCode));
    if (!hasSelected) {
      state.facilityRiskSelectedCode = sortedByRisk[0]?.facility_code || null;
    }
    if (elements.facilityRiskSelectedId) {
      elements.facilityRiskSelectedId.textContent = `Selected facility ID: ${state.facilityRiskSelectedCode || "-"}`;
    }

    if (elements.facilityRiskTopList) {
      elements.facilityRiskTopList.innerHTML = sortedByRisk.slice(0, 5)
        .map((facility) => {
          return `
            <div class="top5-item">
              <span>${facility.facility_name}</span>
              <strong>${facility.risk_score}/100</strong>
            </div>
          `;
        })
        .join("") || "--";
    }

    if (state.facilityRiskView === "table") {
      renderFacilityRiskTable({ sortedByRisk, elements });
      elements.facilityRiskList.classList.add("hidden");
      elements.facilityRiskTableWrap.classList.remove("hidden");
      return;
    }

    elements.facilityRiskList.classList.remove("hidden");
    elements.facilityRiskTableWrap.classList.add("hidden");

    // COMPACT LIST VIEW
    elements.facilityRiskList.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px;">📋 Showing ${filtered.length} facilit${filtered.length === 1 ? 'y' : 'ies'}. Click to expand details.</div>
      <div style="display: grid; gap: 4px;">
        ${filtered.sort((a, b) => b.risk_score - a.risk_score).map((facility) => {
          const levelClass = facility.risk_level?.toLowerCase() || "lav";
          const isExpanded = String(facility.facility_code) === String(state.facilityRiskSelectedCode);
          
          let riskBadgeColor = '#22c55e';
          let riskIcon = '🟢';
          if (levelClass === 'ekstrem') {
            riskBadgeColor = '#dc2626';
            riskIcon = '🔴';
          } else if (levelClass === 'høy') {
            riskBadgeColor = '#f97316';
            riskIcon = '🟠';
          } else if (levelClass === 'moderat') {
            riskBadgeColor = '#eab308';
            riskIcon = '🟡';
          }
          
          // Disease detection from BarentsWatch data
          const disease = facility.disease || '';
          let diseaseIcon = '';
          let diseaseColor = '#6b7280';
          if (disease.toUpperCase().includes('ILA')) {
            diseaseIcon = '🔴';
            diseaseColor = '#dc2626';
          } else if (disease.toUpperCase().includes('PD')) {
            diseaseIcon = '🟠';
            diseaseColor = '#f97316';
          }
          
          const zoneType = facility.zone_type || '';
          
          // COMPACT ROW
          let html = `
            <div class="compact-facility-row" data-facility-code="${facility.facility_code}" style="
              background: ${isExpanded ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)'};
              border: 1px solid ${isExpanded ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};
              border-radius: 6px;
              padding: 10px 12px;
              cursor: pointer;
              transition: all 0.2s;
            ">
              <div style="display: flex; align-items: center; gap: 12px; justify-content: space-between;">
                <div style="flex: 1; min-width: 0;">
                  <span style="font-weight: 600; color: var(--ink);">${facility.facility_name}</span>
                  <span style="color: var(--muted); font-size: 0.85rem; margin-left: 8px;">Code ${facility.facility_code}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                  <span style="background: ${riskBadgeColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                    ${riskIcon} ${facility.risk_level || 'Unknown'}
                  </span>
                  <span style="color: var(--muted); font-size: 0.85rem;">${facility.risk_score}/100</span>
                  ${disease ? `<span style="color: ${diseaseColor}; font-size: 0.85rem; font-weight: 500;">${diseaseIcon} ${disease}</span>` : ''}
                  ${zoneType ? `<span style="color: var(--muted); font-size: 0.8rem;">${zoneType}</span>` : ''}
                  <span style="color: var(--accent); font-size: 0.85rem;">${isExpanded ? '▼' : '▶'}</span>
                </div>
              </div>
          `;
          
          // EXPANDED DETAILS - BarentsWatch Zone Information
          if (isExpanded) {
            const assessmentDate = facility.assessment_date ? new Date(facility.assessment_date).toLocaleString('no-NO') : 'Unknown';
            const source = facility.source || 'BarentsWatch';
            const position = facility.position || {};
            const lat = position.latitude !== undefined ? position.latitude.toFixed(5) : 'N/A';
            const lon = position.longitude !== undefined ? position.longitude.toFixed(5) : 'N/A';
            
            // Zone type explanation
            let zoneExplanation = '';
            if (zoneType === 'RESTRICTION') {
              zoneExplanation = '⛔ RESTRICTION ZONE: Official disease confirmed. Strict movement restrictions apply.';
            } else if (zoneType === 'SURVEILLANCE') {
              zoneExplanation = '⚠️ SURVEILLANCE ZONE: Monitoring area around confirmed cases. Enhanced biosecurity required.';
            }
            
            html += `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 0.9rem; margin-bottom: 8px; color: var(--accent-strong);">
                  <strong>📍 Official Disease Zone Information:</strong>
                </div>
                
                ${disease ? `
                <div style="margin-bottom: 8px; padding: 8px; background: ${diseaseColor}20; border-left: 3px solid ${diseaseColor}; border-radius: 4px;">
                  <div style="color: ${diseaseColor}; font-weight: 600; font-size: 0.9rem;">
                    ${diseaseIcon} Disease: ${disease}
                  </div>
                </div>
                ` : ''}
                
                ${zoneType ? `
                <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px; font-size: 0.85rem;">
                  <div style="color: var(--ink); font-weight: 500; margin-bottom: 4px;">
                    Zone Type: ${zoneType}
                  </div>
                  <div style="color: var(--muted); font-size: 0.8rem;">
                    ${zoneExplanation}
                  </div>
                </div>
                ` : ''}
                
                <div style="display: grid; gap: 6px; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                    <span style="color: var(--muted);">Assessment Date:</span>
                    <span style="color: var(--ink);">${assessmentDate}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                    <span style="color: var(--muted);">Position:</span>
                    <span style="color: var(--ink);">${lat}, ${lon}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                    <span style="color: var(--muted);">Data Source:</span>
                    <span style="color: var(--ink);">${source}</span>
                  </div>
                </div>
                
                <div style="margin-top: 10px; padding: 8px; background: rgba(200, 200, 200, 0.15); border-radius: 4px; font-size: 0.85rem; color: var(--muted);">
                  <strong>📋 Official Status:</strong> This facility is in a BarentsWatch-declared disease zone. Follow official FKA (Fisheries and Food Authority) guidelines for the zone type.
                </div>
              </div>
            `;
          }
          
          html += '</div>';
          return html;
        }).join('')}
      </div>
    `;

    elements.facilityRiskList.querySelectorAll(".compact-facility-row").forEach((itemEl) => {
      itemEl.addEventListener("click", () => {
        const clickedCode = itemEl.dataset.facilityCode;
        // Toggle: if already selected, deselect, otherwise select
        state.facilityRiskSelectedCode = (String(state.facilityRiskSelectedCode) === String(clickedCode)) ? null : clickedCode;
        renderFacilityRisk({ state, elements });
      });
    });
  }

  // ===== GET ACTION RECOMMENDATION =====
  function getActionRecommendation(facility, topNeighbor) {
    const risk = facility.risk_level || "Minimal";
    const zoneType = facility.zone_type || "";
    const disease = facility.disease || "";

    if (risk === "Ekstrem") {
      if (zoneType === "RESTRICTION") {
        return "IMMEDIATE ACTION: Facility is in official RESTRICTION zone. Halt all vessel movements, require full disinfection protocols, initiate 24h monitoring. Contact authorities before any transfers.";
      }
      return "IMMEDIATE ACTION: Halt transfers, require vessel disinfection, initiate 24h inspections, and strengthen biosecurity measures.";
    }
    
    if (risk === "Høy") {
      if (zoneType === "SURVEILLANCE") {
        return "HIGH ALERT: Facility is in SURVEILLANCE zone. Restrict vessel movement, implement enhanced biosecurity protocols, increase daily monitoring and testing.";
      }
      return "HIGH RISK: Restrict vessel movement, tighten biosecurity, increase daily monitoring, and report any disease signs immediately.";
    }
    
    if (risk === "Moderat") {
      return "MODERATE RISK: Increase sampling frequency, alert neighboring operations, enforce strict biosecurity, and maintain detailed movement logs.";
    }
    
    if (risk === "Lav") {
      return "LOW RISK: Maintain standard biosecurity controls and weekly health checks.";
    }
    
    return "MINIMAL RISK: Continue routine monitoring and standard operating procedures.";
  }

  // ===== RENDER FACILITY RISK TABLE =====
  function renderFacilityRiskTable({ sortedByRisk, elements }) {
    if (!elements.facilityRiskTableBody) return;
    elements.facilityRiskTableBody.innerHTML = sortedByRisk
      .map((facility) => {
        const topNeighbor = (facility.all_nearby_diseases || [])[0] || {};
        const effective = topNeighbor.effective_distance_km ?? "--";
        const currentDir = topNeighbor.current_direction_degrees;
        const currentText = currentDir !== undefined && currentDir !== null
          ? `${currentDir.toFixed(0)}deg`
          : "--";
        const actionText = getActionRecommendation(facility, topNeighbor);
        return `
          <tr>
            <td>${facility.facility_name}</td>
            <td>${facility.facility_code}</td>
            <td>${facility.risk_level || "--"}</td>
            <td>${facility.risk_score}</td>
            <td>${effective}</td>
            <td>${currentText}</td>
            <td>${actionText}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ===== PUBLIC API =====
  return {
    loadFacilityRisk,
    renderFacilityRisk,
    renderFacilityRiskTable,
    getActionRecommendation
  };
})();

// Export to window
window.AdminFacilityRiskModule = AdminFacilityRiskModule;
