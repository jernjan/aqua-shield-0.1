(function () {
  async function loadPredictions(deps) {
    const {
      state,
      elements,
      apiFetch,
      formatNumber,
      renderPredictions,
      formatRiskDrivers,
      attachRiskFactorHandlers,
      logger = console,
    } = deps;

    if (elements.predictionsLoad) {
      elements.predictionsLoadText.style.display = "none";
      elements.predictionsLoadSpinner.style.display = "inline";
    }

    try {
      let data = null;
      try {
        data = await apiFetch("/api/risk/outbreak-risk-at-healthy-facilities");
        if (data && data.healthy_at_risk && Array.isArray(data.healthy_at_risk)) {
          state.predictions = data.healthy_at_risk.map((facility) => ({
            facility_name: facility.facility_name,
            facility_code: facility.facility_code || "--",
            latitude: facility.latitude,
            longitude: facility.longitude,
            risk_score: facility.risk_score,
            is_at_risk:
              facility.is_at_risk !== undefined ? facility.is_at_risk : facility.risk_score > 0,
            risk_level: facility.risk_level,
            distance_contribution: facility.distance_contribution || 0,
            boat_vector_contribution: facility.boat_vector_contribution || 0,
            ocean_current_contribution: facility.ocean_current_contribution || 0,
            disease_contribution: facility.disease_contribution || 0,
            official_zone_contribution: facility.official_zone_contribution || 0,
            primary_disease: facility.primary_disease || "ILA/PD",
            source_facility_name: facility.source_facility_name || facility.most_likely_source_name || null,
            source_facility_code: facility.source_facility_code || null,
            nearby_sources: facility.nearby_sources || [],
            num_nearby_sources: facility.num_nearby_sources || 0,
            cluster_multiplier: facility.cluster_multiplier || 1.0,
            source_latitude: facility.source_latitude || facility.most_likely_source_lat || null,
            source_longitude: facility.source_longitude || facility.most_likely_source_lon || null,
            confidence_level:
              facility.risk_level === "Critical"
                ? "High"
                : facility.risk_level === "Medium"
                  ? "Medium"
                  : "Low",
            confidence_score: facility.risk_score <= 100 ? facility.risk_score / 100 : 0.7,
            outbreak_risk_pct: facility.risk_score,
            trend_7d: "stable",
            in_official_zone: facility.in_official_zone || false,
            official_zone_status: facility.official_zone_status || null,
            facility_zone_type: facility.facility_zone_type || null,
            distance_to_nearest_infected: facility.distance_to_source_km || null,
            distance_to_source_km: facility.distance_to_source_km || null,
          }));

          state.predictionsSummary = data.summary || { critical: 0, medium: 0, low: 0, total: 0 };
          logger.log("✓ Loaded outbreak risk from new endpoint");
        }
      } catch (newEndpointError) {
        logger.warn("New endpoint not available, trying legacy predictions endpoint...");
      }

      if (!data || !state.predictions || state.predictions.length === 0) {
        try {
          data = await apiFetch("/api/risk/predictions/disease");
          logger.log("✓ Loaded disease-only predictions endpoint");
        } catch (diseaseEndpointError) {
          logger.warn("Disease endpoint not available, trying legacy /all endpoint...");
          data = await apiFetch("/api/risk/predictions/all");
        }

        if (!data.summary?.total_facilities || data.summary.total_facilities === 0) {
          logger.warn("No real predictions found. Demo data fallback is disabled.");
        }

        state.predictions = data.top_20_by_risk || [];
        state.predictionsSummary = data.summary || { critical: 0, medium: 0, low: 0, total_facilities: 0 };
      }

      const atRiskCount = (state.predictionsSummary.critical || 0) + (state.predictionsSummary.medium || 0);
      if (elements.predictionsAtRisk) {
        elements.predictionsAtRisk.textContent = formatNumber(atRiskCount);
      }
      elements.predictionsTotal.textContent = formatNumber(
        state.predictionsSummary.total_facilities || state.predictionsSummary.total,
      );

      const protectionCount = state.predictions.filter((p) => p.official_zone_status?.zone_type === "PROTECTION").length;
      const surveillanceCount = state.predictions.filter((p) => p.official_zone_status?.zone_type === "SURVEILLANCE").length;
      const within10kmCount = state.predictions.filter((p) => (p.distance_contribution || 0) >= 30).length;

      logger.log(
        `🔴 PROTECTION zones: ${protectionCount} (filtering for zone_type === 'PROTECTION')`,
      );
      logger.log(
        `🟠 SURVEILLANCE zones: ${surveillanceCount} (filtering for zone_type === 'SURVEILLANCE')`,
      );
      logger.log(
        `🟡 WITHIN 10KM zones: ${within10kmCount} (facilities with distance_contribution >= 30)`,
      );

      logger.log("🔍 First 5 facilities with codes:");
      state.predictions.slice(0, 5).forEach((p, idx) => {
        logger.log(
          `  [${idx}] Code: ${p.facility_code}, Zone: ${p.official_zone_status?.zone_type || "none"}, Distance: ${p.distance_contribution || 0}, Full zone obj:`,
          p.official_zone_status,
        );
      });

      logger.log(
        "Sample prediction with zone data:",
        state.predictions.find((p) => p.official_zone_status) || "No official_zone_status found",
      );

      elements.predictionsProtection.textContent = formatNumber(protectionCount);
      elements.predictionsSurveillance.textContent = formatNumber(surveillanceCount);
      if (elements.predictions10km) {
        elements.predictions10km.textContent = formatNumber(within10kmCount);
      }

      if (data.summary?.timestamp) {
        const date = new Date(data.summary.timestamp);
        elements.predictionsLastUpdate.textContent = `Last update: ${date.toLocaleTimeString()}`;
      }

      renderPredictions({ state, elements, formatRiskDrivers, attachRiskFactorHandlers });
      state.loaded.predictions = true;
    } catch (error) {
      if (elements.predictionsTable) {
        elements.predictionsTable.innerHTML = `<tr><td colspan="8" style="color: #ef4444;">Error loading predictions: ${error.message}</td></tr>`;
      }
    } finally {
      if (elements.predictionsLoad) {
        elements.predictionsLoadText.style.display = "inline";
        elements.predictionsLoadSpinner.style.display = "none";
      }
    }
  }

  function renderPredictions(deps) {
    const { state, elements, formatRiskDrivers, attachRiskFactorHandlers } = deps;
    if (!elements.predictionsTable) return;

    let filteredPredictions = state.predictions;

    if (!state.filters.showAllPredictions) {
      filteredPredictions = filteredPredictions.filter((p) => p.is_at_risk);
    }

    if (state.filters.showOnlyProtectionZones) {
      filteredPredictions = filteredPredictions.filter(
        (p) => p.official_zone_status?.zone_type === "PROTECTION",
      );
    } else if (state.filters.showOnlySurveillanceZones) {
      filteredPredictions = filteredPredictions.filter(
        (p) => p.official_zone_status?.zone_type === "SURVEILLANCE",
      );
    } else if (state.filters.showOnlyWithin10km) {
      filteredPredictions = filteredPredictions.filter((p) => (p.distance_contribution || 0) >= 30);
    }

    elements.predictionsTable.innerHTML =
      filteredPredictions
        .map((pred, idx) => {
          const riskColor =
            pred.risk_level === "Critical" ? "#ef4444" : pred.risk_level === "Medium" ? "#eab308" : "#22c55e";
          const driversText = formatRiskDrivers(pred.risk_drivers);

          const confidenceBg =
            pred.confidence_level === "High"
              ? "#10b981"
              : pred.confidence_level === "Medium"
                ? "#f59e0b"
                : "#ef4444";
          const confScore =
            pred.confidence_score !== undefined ? (pred.confidence_score * 100).toFixed(0) : "?";
          const confidenceBadge = `<span style="background: ${confidenceBg}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: 500;">${pred.confidence_level || "Unknown"} (${confScore}%)</span>`;

          let trendArrow = "";
          let trendColor = "#6b7280";
          if (pred.trend_7d === "increasing") {
            trendArrow = `↑ +${pred.trend_pct?.toFixed(1) || "?"}%`;
            trendColor = "#ef4444";
          } else if (pred.trend_7d === "decreasing") {
            trendArrow = `↓ ${pred.trend_pct?.toFixed(1) || "?"}%`;
            trendColor = "#22c55e";
          } else if (pred.trend_7d === "stable") {
            trendArrow = "→ stable";
            trendColor = "#eab308";
          }

          let officialStatusBadge = `<span style="color: #6b7280; font-size: 0.8rem;">—</span>`;
          let zoneTextLabel = `<span style="color: #9ca3af; font-size: 0.8rem;">Ingen</span>`;
          if (pred.official_zone_status && pred.official_zone_status.in_official_zone) {
            const ozs = pred.official_zone_status;
            let badgeColor = "#6b7280";
            let badgeText = "Unknown";
            let icon = "⚠️";

            if (ozs.zone_type === "DISEASED") {
              badgeColor = "#dc2626";
              badgeText = `🦠 ${ozs.disease}`;
              icon = "🔴";
              zoneTextLabel = `<span style="color: #dc2626; font-size: 0.8rem; font-weight: 700;">DISEASED</span>`;
            } else if (ozs.zone_type === "PROTECTION") {
              badgeColor = "#dc2626";
              badgeText = `${ozs.disease} Protection`;
              icon = "🔴";
              zoneTextLabel = `<span style="color: #dc2626; font-size: 0.8rem; font-weight: 700;">PROTECTION</span>`;
            } else if (ozs.zone_type === "SURVEILLANCE") {
              badgeColor = "#f97316";
              badgeText = `${ozs.disease} Surveillance`;
              icon = "🟠";
              zoneTextLabel = `<span style="color: #f97316; font-size: 0.8rem; font-weight: 700;">SURVEILLANCE</span>`;
            }

            officialStatusBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: 600; display: inline-block;">${icon} ${badgeText}</span>`;
          }

          let sourceInfo = "No source threat";
          if (pred.nearby_sources && pred.nearby_sources.length > 0) {
            if (pred.nearby_sources.length === 1) {
              const primarySource = pred.nearby_sources[0];
              sourceInfo = `📍 From: ${primarySource.name} (${primarySource.latitude?.toFixed(2)}, ${primarySource.longitude?.toFixed(2)})`;
            } else if (pred.nearby_sources.length <= 3) {
              const sourceList = pred.nearby_sources
                .map((s) => `<span style="color: #dc2626; font-weight: 600;">${s.name}</span>`)
                .join(", ");
              sourceInfo = `📍 From: ${sourceList} <span style="color: #f59e0b;">(${pred.nearby_sources.length} kilder)</span>`;
            } else {
              const first = pred.nearby_sources[0];
              const second = pred.nearby_sources[1];
              const others = pred.nearby_sources.length - 2;
              sourceInfo = `📍 From: <span style="color: #dc2626; font-weight: 600;">${first.name}</span>, <span style="color: #dc2626; font-weight: 600;">${second.name}</span> <span style="color: #f59e0b;">(og ${others} andre)</span>`;
            }
          } else if (pred.source_facility_name) {
            sourceInfo = `📍 From: ${pred.source_facility_name}`;
          }

          const facilityCoords = `🎯 Facility: (${pred.latitude?.toFixed(2)}, ${pred.longitude?.toFixed(2)})`;

          return `
      <tr style="border-bottom: 1px solid #374151;">
        <td style="color: #9ca3af; font-size: 0.85rem;">${idx + 1}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <div>${pred.facility_name || "Unknown"}</div>
          <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">${facilityCoords}</div>
        </td>
        <td style="font-weight: 600; color: ${riskColor};">
          ${(pred.outbreak_risk_pct !== undefined ? pred.outbreak_risk_pct : pred.risk_score || 0).toFixed(0)} pts
          <div style="font-size: 0.75rem; color: ${trendColor}; margin-top: 2px;">${trendArrow || "N/A"}</div>
        </td>
        <td style="color: ${riskColor}; font-weight: 500;">
          ${pred.risk_level}
          <div style="font-size: 0.75rem; margin-top: 2px;">${confidenceBadge}</div>
        </td>
        <td style="font-size: 0.8rem;">
          ${officialStatusBadge}
        </td>
        <td style="font-size: 0.8rem;">
          ${zoneTextLabel}
        </td>
        <td style="font-size: 0.85rem;">${pred.primary_disease || "Unknown"}</td>
        <td style="font-size: 0.8rem; color: #9ca3af; max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
          <div>${driversText}</div>
          <div style="margin-top: 4px; color: #ef4444; font-weight: 500;">${sourceInfo}</div>
          <div style="margin-top: 6px; display: flex; gap: 6px;">
            <button class="risk-factor-btn" data-pred-index="${idx}" style="background: #0ea5e9; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">Risk Factors</button>
            <button class="transmission-source-btn" data-pred-index="${idx}" style="background: #d946ef; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">🧬 Sources</button>
            <button class="risk-link-btn" data-facility="${pred.facility_code}" onclick="switchTab('facility-risks'); setTimeout(() => document.querySelector('[data-facility-search]')?.focus(), 100);" style="background: #3b82f6; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">📊 Facility Risk</button>
            <button class="risk-link-btn" data-vessel-code="${pred.facility_code}" onclick="switchTab('vessel-risk'); setTimeout(() => document.querySelector('[data-vessel-search]')?.focus(), 100);" style="background: #8b5cf6; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">🚢 Vessel Risk</button>
          </div>
        </td>
      </tr>
    `;
        })
        .join("") ||
      `<tr><td colspan="8" style="text-align: center; color: #9ca3af;">No predictions available</td></tr>`;

    attachRiskFactorHandlers();
  }

  window.AdminPredictionsModule = {
    loadPredictions,
    renderPredictions,
  };
})();
