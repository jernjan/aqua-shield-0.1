(function () {
  function getVesselRiskTbody() {
    return document.querySelector("#vesselRiskTable tbody")
      || document.querySelector("#vessel-risk-table")
      || document.querySelector("#vessel-risk-table tbody");
  }

  function setVesselRiskHtml(html) {
    const tbody = getVesselRiskTbody();
    if (!tbody) return;
    tbody.innerHTML = html;
  }

  function getVesselLiceTbody() {
    return document.querySelector("#vessel-lice-risk-table")
      || document.querySelector("#vesselLiceRiskTable tbody");
  }

  function setVesselLiceHtml(html) {
    const tbody = getVesselLiceTbody();
    if (!tbody) return;
    tbody.innerHTML = html;
  }

  function vesselHasVisitCategory(vessel, categories) {
    if (!vessel?.visits?.length || !categories?.length) return false;
    return vessel.visits.some((visit) => categories.includes(visit.visit_category));
  }

  function getShortestFacilityGapHours(vessel) {
    const visits = (vessel?.visits || [])
      .filter((visit) => visit?.timestamp)
      .map((visit) => ({
        ...visit,
        parsedTime: new Date(visit.timestamp),
      }))
      .filter((visit) => !Number.isNaN(visit.parsedTime.getTime()))
      .sort((a, b) => a.parsedTime - b.parsedTime);

    if (visits.length < 2) return null;

    let shortestGap = null;
    for (let index = 1; index < visits.length; index += 1) {
      const previous = visits[index - 1];
      const current = visits[index];
      const previousFacility = previous.facility_code || previous.facility_name;
      const currentFacility = current.facility_code || current.facility_name;

      if (!previousFacility || !currentFacility || previousFacility === currentFacility) continue;

      const gapHours = (current.parsedTime - previous.parsedTime) / (1000 * 60 * 60);
      if (gapHours < 0) continue;
      if (shortestGap === null || gapHours < shortestGap) {
        shortestGap = gapHours;
      }
    }

    return shortestGap;
  }

  async function loadVesselRisk(deps) {
    const { state, elements, apiFetch, formatNumber, renderVesselRisk } = deps;

    setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>Loading vessel disease risk data...</td></tr>");
    setVesselLiceHtml("<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--muted);'>Loading vessel lice risk data...</td></tr>");

    try {
      const [data, liceData] = await Promise.all([
        apiFetch("/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7"),
        apiFetch("/api/vessels/at-lice-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7").catch(() => ({ vessels: [] })),
      ]);

      state.vesselRisk = data.vessels || [];
      state.vesselLiceRisk = liceData.vessels || [];

      const ekstremCount = data.ekstrem_risk_vessels || 0;
      const høyCount = data.høy_risk_vessels || 0;
      const moderatCount = data.moderat_risk_vessels || 0;
      const infectedVisits = state.vesselRisk.filter((v) => v.visited_infected).length;
      const chainCount = state.vesselRisk.filter((v) => v.has_48h_chain).length;
      
      // NEW: Extract quarantine breakdown from API
      const quarantineBreaches = data.quarantine_breakdown?.quarantine_breaches || state.vesselRisk.filter((v) => v.quarantine_analysis?.has_quarantine_breach).length;
      const activeQuarantines = data.quarantine_breakdown?.active_quarantines || state.vesselRisk.filter((v) => v.quarantine_analysis?.has_active_quarantine).length;
      const clearedQuarantines = data.quarantine_breakdown?.cleared_quarantines || state.vesselRisk.filter((v) => v.quarantine_analysis?.quarantine_status === 'QUARANTINE_CLEARED').length;

      state.vesselRiskSummary = {
        infected: infectedVisits,
        high: ekstremCount + høyCount,
        moderate: moderatCount,
        chain: chainCount,
        total: state.vesselRisk.length,
        // NEW quarantine stats
        quarantine_breaches: quarantineBreaches,
        active_quarantines: activeQuarantines,
        cleared_quarantines: clearedQuarantines
      };

      elements.vesselRiskInfectedCount.textContent = formatNumber(infectedVisits);
      elements.vesselRiskHighCount.textContent = formatNumber(ekstremCount + høyCount);
      elements.vesselRiskChainCount.textContent = formatNumber(chainCount);
      elements.vesselRiskTotalCount.textContent = formatNumber(state.vesselRisk.length);
      
      // NEW: Update quarantine stats if elements exist
      if (elements.vesselQuarantineBreachCount) {
        elements.vesselQuarantineBreachCount.textContent = formatNumber(quarantineBreaches);
      }
      if (elements.vesselQuarantineActiveCount) {
        elements.vesselQuarantineActiveCount.textContent = formatNumber(activeQuarantines);
      }

      const liceCritical = (liceData.critical_vessels || 0);
      const liceMedium = (liceData.medium_vessels || 0);
      const liceTotal = (liceData.total_vessels || state.vesselLiceRisk.length || 0);
      const liceLow = (liceData.low_vessels || 0);

      const liceCriticalEl = document.getElementById("vrl-critical-count");
      const liceMediumEl = document.getElementById("vrl-medium-count");
      const liceLowEl = document.getElementById("vrl-low-count");
      const liceTotalEl = document.getElementById("vrl-total-count");

      if (liceCriticalEl) liceCriticalEl.textContent = formatNumber(liceCritical);
      if (liceMediumEl) liceMediumEl.textContent = formatNumber(liceMedium);
      if (liceLowEl) liceLowEl.textContent = formatNumber(liceLow);
      if (liceTotalEl) liceTotalEl.textContent = formatNumber(liceTotal);

      renderVesselRisk({ state, elements, formatNumber, showVesselDetail: deps.showVesselDetail });
      renderVesselLiceRisk({ state });
      state.loaded.vesselRisk = true;
      state.loaded["vessel-risk"] = true;
    } catch (error) {
      setVesselRiskHtml(`<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--danger);'>Error: ${error.message}</td></tr>`);
      setVesselLiceHtml(`<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--danger);'>Error: ${error.message}</td></tr>`);
    }
  }

  async function loadVesselLiceRiskOnly(deps) {
    const { state, apiFetch, formatNumber } = deps;

    setVesselLiceHtml("<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--muted);'>Loading vessel lice risk data...</td></tr>");

    try {
      const liceData = await apiFetch("/api/vessels/at-lice-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7");
      state.vesselLiceRisk = liceData.vessels || [];

      const liceCritical = (liceData.critical_vessels || 0);
      const liceMedium = (liceData.medium_vessels || 0);
      const liceTotal = (liceData.total_vessels || state.vesselLiceRisk.length || 0);
      const liceLow = (liceData.low_vessels || 0);

      const liceCriticalEl = document.getElementById("vrl-critical-count");
      const liceMediumEl = document.getElementById("vrl-medium-count");
      const liceLowEl = document.getElementById("vrl-low-count");
      const liceTotalEl = document.getElementById("vrl-total-count");

      if (liceCriticalEl) liceCriticalEl.textContent = formatNumber(liceCritical);
      if (liceMediumEl) liceMediumEl.textContent = formatNumber(liceMedium);
      if (liceLowEl) liceLowEl.textContent = formatNumber(liceLow);
      if (liceTotalEl) liceTotalEl.textContent = formatNumber(liceTotal);

      renderVesselLiceRisk({ state });
    } catch (error) {
      setVesselLiceHtml(`<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--danger);'>Error: ${error.message}</td></tr>`);
    }
  }

  function renderVesselLiceRisk({ state }) {
    const vessels = state.vesselLiceRisk || [];
    if (!vessels.length) {
      setVesselLiceHtml("<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels with lice-linked exposure in selected period.</td></tr>");
      return;
    }

    const liceSearchInput = document.getElementById("vesselLiceSearch");
    const liceRiskFilter = document.getElementById("vesselLiceRiskFilter");

    const searchTerm = (liceSearchInput?.value || "").trim().toLowerCase();
    const riskFilter = (liceRiskFilter?.value || "all").trim();

    let filtered = vessels;

    if (riskFilter !== "all") {
      filtered = filtered.filter((vessel) => (vessel.lice_risk_level || "Medium") === riskFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((vessel) => {
        const mmsiText = String(vessel.mmsi || "").toLowerCase();
        const nameText = String(vessel.vessel_name || "").toLowerCase();
        return mmsiText.includes(searchTerm) || nameText.includes(searchTerm);
      });
    }

    if (!filtered.length) {
      setVesselLiceHtml("<tr><td colspan='6' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels match current lice filters.</td></tr>");
      return;
    }

    const riskColor = {
      Critical: "#dc2626",
      Medium: "#f97316",
      Low: "#16a34a",
    };

    const rows = filtered.map((vessel) => {
      const level = vessel.lice_risk_level || "Medium";
      const levelColor = riskColor[level] || "#f97316";
      const maxAdult = vessel.max_adult_female_lice;
      const maxAdultText = Number.isFinite(maxAdult) ? Number(maxAdult).toFixed(2) : "--";

      return `
        <tr>
          <td>${vessel.mmsi || "--"}</td>
          <td>${vessel.vessel_name || `Vessel ${vessel.mmsi || "--"}`}</td>
          <td><span style="color: ${levelColor}; font-weight: 700;">${level}</span></td>
          <td style="text-align: center;">${vessel.lice_high_visits || 0}</td>
          <td style="text-align: center;">${maxAdultText}</td>
          <td style="font-size: 0.85rem; color: var(--muted);">${(vessel.visits || []).slice(0, 3).map((visit) => visit.facility_name || visit.facility_code || "Ukjent").join(", ") || "--"}</td>
        </tr>
      `;
    }).join("");

    setVesselLiceHtml(rows);
  }

  function renderVesselRisk(deps) {
    const { state, elements, formatNumber, showVesselDetail } = deps;

    if (!state.vesselRisk || !state.vesselRisk.length) {
      setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels at risk. Click 'Load vessel risk' to fetch data.</td></tr>");
      if (elements.vesselRiskSelectedMmsi) elements.vesselRiskSelectedMmsi.textContent = "Selected MMSI: -";
      return;
    }

    const visitFilter = elements.vesselRiskLevel?.value || "all";
    const chainFilter = elements.vesselChainFilter?.value || "all";
    
    // NEW: Quarantine status filter
    const quarantineFilter = elements.vesselQuarantineFilter?.value || "priority"; // Default: show only critical
    
    let filtered = [...state.vesselRisk];

    const getEffectiveQuarantineStatus = (vessel) => {
      const q = vessel?.quarantine_analysis || {};
      if (q.quarantine_status && q.quarantine_status !== 'NONE') {
        return q.quarantine_status;
      }
      if (vessel?.has_48h_chain === true) {
        return 'QUARANTINE_BREACH';
      }
      return q.quarantine_status || 'NONE';
    };

    const visitFilterMap = {
      infected: ["infected_facility", "infected_facility_cluster"],
      risk_zone: ["risk_zone_facility", "risk_zone_cluster"],
      near_10km: ["near_infected_10km", "infected_facility_cluster", "risk_zone_cluster"],
    };

    if (visitFilter !== "all") {
      const categories = visitFilterMap[visitFilter] || [];
      filtered = filtered.filter((vessel) => vesselHasVisitCategory(vessel, categories));
    }

    if (chainFilter !== "all") {
      const hasChain = chainFilter === "true";
      filtered = filtered.filter((v) => v.has_48h_chain === hasChain);
    }
    
    // NEW: Quarantine status filtering
    if (quarantineFilter === "priority") {
      // Default: Show only BREACH + ACTIVE (actionable cases)
      filtered = filtered.filter((v) => {
        const qStatus = getEffectiveQuarantineStatus(v);
        return qStatus === 'QUARANTINE_BREACH' || qStatus === 'QUARANTINE_ACTIVE';
      });
    } else if (quarantineFilter === "breach") {
      filtered = filtered.filter((v) => {
        const qStatus = getEffectiveQuarantineStatus(v);
        return v.quarantine_analysis?.has_quarantine_breach === true || qStatus === 'QUARANTINE_BREACH';
      });
    } else if (quarantineFilter === "active") {
      filtered = filtered.filter((v) => {
        const qStatus = getEffectiveQuarantineStatus(v);
        return v.quarantine_analysis?.has_active_quarantine === true || qStatus === 'QUARANTINE_ACTIVE';
      });
    } else if (quarantineFilter === "cleared") {
      filtered = filtered.filter((v) => getEffectiveQuarantineStatus(v) === 'QUARANTINE_CLEARED');
    } else if (quarantineFilter === "surveillance") {
      filtered = filtered.filter((v) => {
        const qStatus = getEffectiveQuarantineStatus(v);
        return qStatus === 'RISK_ZONE_ONLY' || qStatus === 'NEAR_INFECTION_ONLY';
      });
    }
    // "all" shows everything

    if (state.visitCategoryFilter !== "all") {
      filtered = filtered.filter((vessel) => vesselHasVisitCategory(vessel, [state.visitCategoryFilter]));
    }

    const allVessels = state.vesselRisk;
    const infectedVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ["infected_facility", "infected_facility_cluster"])).length;
    const riskZoneVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ["risk_zone_facility", "risk_zone_cluster"])).length;
    const near10kmVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ["near_infected_10km", "infected_facility_cluster", "risk_zone_cluster"])).length;

    const visitCategoryBtns = document.querySelectorAll(".visit-category-filter");
    const categoryLabels = {
      infected_facility: "🦠 Smittet anlegg",
      risk_zone_facility: "⚠️ Vernesone",
      near_infected_10km: "📍 <10km",
      all: "Vis alle",
    };

    visitCategoryBtns.forEach((btn) => {
      const category = btn.dataset.category;
      let count = 0;
      if (category === "infected_facility") count = infectedVesselCount;
      else if (category === "risk_zone_facility") count = riskZoneVesselCount;
      else if (category === "near_infected_10km") count = near10kmVesselCount;

      const baseLabel = categoryLabels[category] || "Filter";
      btn.textContent = category === "all" ? baseLabel : `${baseLabel} (${count})`;
    });

    if (!filtered.length) {
      setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels match your filters.</td></tr>");
      return;
    }

    const chainCount = filtered.filter((v) => v.has_48h_chain).length;
    elements.vesselRiskChainCount.textContent = formatNumber(chainCount);

    const tableRows = filtered.map((vessel) => {
      const riskLevel = vessel.highest_risk_level || vessel.risk_level || "lav";
      const totalVisits = vessel.total_visits || 0;
      const has48hChain = vessel.has_48h_chain;
      
      // NEW: Use quarantine_analysis from API (48-hour compliance)
      const quarantineAnalysis = vessel.quarantine_analysis || {};
      const quarantineStatus = getEffectiveQuarantineStatus(vessel);
      const hasQuarantineBreach = quarantineAnalysis.has_quarantine_breach || false;
      const hasActiveQuarantine = quarantineAnalysis.has_active_quarantine || false;
      const hoursUntilClear = quarantineAnalysis.hours_until_clear || 0;
      const breachDetails = quarantineAnalysis.breach_details;
      
      // NEW PRIORITY COLORING: Quarantine breach > Active > Cleared > Risk Zone > Near Infection
      let rowBgColor = "";
      let statusIcon = "";
      let statusText = "";
      let statusColor = "";
      
      if (quarantineStatus === 'QUARANTINE_BREACH') {
        rowBgColor = "rgba(220, 38, 38, 0.12)";  // Deep red background
        statusIcon = "🚨";
        statusText = "KARANTENEBRUDD";
        statusColor = "#991b1b";  // Dark red text
        
        if (breachDetails) {
          const hoursAfter = breachDetails.hours_after_infection || 0;
          statusText += ` (besøkte ${breachDetails.facility_name || 'annet anlegg'} etter ${hoursAfter.toFixed(1)}t)`;
        }
      } else if (quarantineStatus === 'QUARANTINE_ACTIVE') {
        rowBgColor = "rgba(249, 115, 22, 0.10)";  // Orange background
        statusIcon = "⏱️";
        statusColor = "#c2410c";  // Dark orange
        
        if (hoursUntilClear > 0) {
          const hoursLeft = Math.floor(hoursUntilClear);
          const minutesLeft = Math.floor((hoursUntilClear - hoursLeft) * 60);
          statusText = `I KARANTENE (${hoursLeft}t ${minutesLeft}min igjen)`;
        } else {
          statusText = "I KARANTENE (utløper snart)";
        }
      } else if (quarantineStatus === 'QUARANTINE_CLEARED') {
        rowBgColor = "rgba(234, 179, 8, 0.08)";  // Yellow background
        statusIcon = "✓";
        statusText = "KARANTENE UTLØPT (>48t)";
        statusColor = "#a16207";  // Dark yellow
      } else if (quarantineStatus === 'RISK_ZONE_ONLY') {
        rowBgColor = "rgba(59, 130, 246, 0.06)";  // Blue background
        statusIcon = "🛡️";
        statusText = "KUN RISIKOSONE-BESØK";
        statusColor = "#1e40af";  // Dark blue
      } else if (quarantineStatus === 'NEAR_INFECTION_ONLY') {
        rowBgColor = "rgba(16, 185, 129, 0.05)";  // Green background
        statusIcon = "📍";
        statusText = "KUN 10KM-BESØK";
        statusColor = "#065f46";  // Dark green
      } else {
        statusIcon = "✅";
        statusText = "OK";
        statusColor = "#16a34a";
      }

      // Risk level icon (secondary priority)
      let riskIcon = "🟢";
      let riskColor = "#22c55e";
      if (riskLevel === "ekstrem") {
        riskIcon = "🔴";
        riskColor = "#dc2626";
      } else if (riskLevel === "høy") {
        riskIcon = "🟠";
        riskColor = "#f97316";
      } else if (riskLevel === "moderat") {
        riskIcon = "🟡";
        riskColor = "#eab308";
      }

      const visits = vessel.visits || [];
      // Count UNIQUE infected facilities (not total visits)
      // Use quarantine_analysis data if available, otherwise count unique facility codes
      const infectedCount = vessel.quarantine_analysis?.infected_facility_count ?? 
        new Set(
          visits
            .filter((v) => v.infected || ["infected_facility", "infected_facility_cluster"].includes(v.visit_category))
            .map((v) => v.facility_code)
            .filter(Boolean)
        ).size;

      const advisoryMetrics = vessel.quarantine_analysis?.advisory_metrics || {};
      const advisorySignals = vessel.quarantine_analysis?.advisory_signals || [];

      const riskZoneCount = advisoryMetrics.unique_risk_zone_facilities ??
        new Set(
          visits
            .filter((v) => ["risk_zone_facility", "risk_zone_cluster"].includes(v.visit_category))
            .map((v) => v.facility_code)
            .filter(Boolean)
        ).size;

      const near10kmCount = advisoryMetrics.unique_near_10km_facilities ??
        new Set(
          visits
            .filter((v) => ["near_infected_10km", "infected_facility_cluster", "risk_zone_cluster"].includes(v.visit_category))
            .map((v) => v.facility_code)
            .filter(Boolean)
        ).size;

      const infectedDisplay = infectedCount > 0
        ? `<span style="color: #dc2626; font-weight: 600; font-size: 1.1rem;">🦠 ${infectedCount}</span>`
        : '<span style="color: #6b7280;">—</span>';

      let riskBadges = "";
      if (riskZoneCount > 0) {
        riskBadges += `<span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block;">⚠️ Vernesone (${riskZoneCount})</span>`;
      }
      if (near10kmCount > 0) {
        riskBadges += `<span style="background: #eab308; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block;">📍 10km-regel (${near10kmCount})</span>`;
      }
      if (advisorySignals.some((signal) => signal.code === 'HIGH_LOCAL_INFECTION_PRESSURE')) {
        const pressureScore = advisoryMetrics.pressure_score || 0;
        riskBadges += `<span style="background: #7c3aed; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block;">📊 Høyt smittepress (${pressureScore})</span>`;
      }
      if (!riskBadges) {
        riskBadges = '<span style="color: #6b7280; font-size: 0.8rem;">—</span>';
      }

      // NEW: Quarantine display with countdown and breach details
      const quarantineDisplay = `<span style="color: ${statusColor}; font-weight: 700;">${statusIcon} ${statusText}</span>`;

      return `<tr style="background: ${rowBgColor};">
      <td>${vessel.mmsi}</td>
      <td>${vessel.vessel_name || `Vessel ${vessel.mmsi}`}</td>
      <td><span style="color: ${riskColor}; font-weight: 600; padding: 4px 8px; display: inline-block;">
        ${riskIcon} ${riskLevel.toUpperCase()}
      </span></td>
      <td style="text-align: center;">${infectedDisplay}</td>
      <td>${totalVisits}</td>
      <td>${riskBadges}</td>
      <td style="text-align: center; min-width: 200px;">${quarantineDisplay}</td>
      <td><button class="btn-view-details" data-mmsi="${vessel.mmsi}" style="padding: 4px 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">👁️ Vis</button></td>
    </tr>`;
    }).join("");

    setVesselRiskHtml(tableRows);

    window.vesselRiskData = filtered;

    document.querySelectorAll(".btn-view-details").forEach((btn) => {
      btn.addEventListener("click", function () {
        const mmsi = this.dataset.mmsi;
        const vesselData = window.vesselRiskData.find((v) => String(v.mmsi) === String(mmsi));
        if (vesselData && typeof showVesselDetail === "function") {
          showVesselDetail(vesselData);
        }
      });
    });
  }

  window.AdminVesselRiskModule = {
    loadVesselRisk,
    loadVesselLiceRiskOnly,
    renderVesselRisk,
    renderVesselLiceRisk,
  };
})();
