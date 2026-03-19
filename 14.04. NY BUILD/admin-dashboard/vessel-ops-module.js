(function () {
  async function loadVesselClearing(deps) {
    const {
      state,
      elements,
      apiFetch,
      formatNumber,
      renderVesselClearing,
      logger = console,
    } = deps;

    if (!elements.vesselClearingList) return;
    elements.vesselClearingList.innerHTML = "Loading vessel clearing data...";

    try {
      const data = await apiFetch("/api/vessel/clearing-status");
      state.vesselClearing = data.vessels || [];

      const summary = data.summary || { cleared: 0, pending: 0, atRisk: 0, total: 0 };

      elements.vesselClearedCount.textContent = formatNumber(summary.cleared || 0);
      elements.vesselPendingCount.textContent = formatNumber(summary.pending || 0);
      elements.vesselAtRiskCount.textContent = formatNumber(summary["at-risk"] || 0);
      elements.vesselClearingTotalCount.textContent = formatNumber(summary.total || 0);

      renderVesselClearing({ state, elements });
      state.loaded.vesselClearing = true;
      state.loaded["vessel-clearing"] = true;
    } catch (error) {
      elements.vesselClearingList.innerHTML = `Error: ${error.message}`;
      logger.error("Error loading vessel clearing:", error);
    }
  }

  function renderVesselClearing(deps) {
    const { state, elements } = deps;
    if (!elements.vesselClearingList) return;

    const statusFilter = elements.vesselStatusFilter?.value || "all";
    const searchTerm = (elements.vesselClearingSearch?.value || "").toLowerCase();

    let filtered = state.vesselClearing || [];

    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((v) =>
        (v.name || "").toLowerCase().includes(searchTerm)
        || String(v.mmsi || "").toLowerCase().includes(searchTerm)
      );
    }

    if (!filtered.length) {
      elements.vesselClearingList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #6b7280;">No vessels found matching criteria.</div>';
      return;
    }

    elements.vesselClearingList.innerHTML = filtered.map((vessel) => {
      const statusIcon = vessel.status === "cleared" ? "✓" : (vessel.status === "pending" ? "⏳" : "🔴");
      const statusColor = vessel.status === "cleared" ? "#10b981" : (vessel.status === "pending" ? "#f59e0b" : "#ef4444");
      const statusText = vessel.status === "cleared" ? "CLEARED" : (vessel.status === "pending" ? "PENDING" : "AT RISK");

      const quarantineText = vessel.status === "pending" && vessel.quarantine_hours_remaining > 0
        ? `${vessel.quarantine_hours_remaining}h remaining`
        : "";

      const lastVisitText = vessel.last_infected_visit
        ? `${vessel.last_infected_visit}`
        : "No infected visits";

      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; background: #f9fafb;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <div style="font-weight: 600; font-size: 1.1rem;">${vessel.name}</div>
            <div style="font-size: 0.85rem; color: #6b7280;">MMSI: ${vessel.mmsi}</div>
          </div>
          <div style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; font-weight: 600; text-align: center;">
            ${statusIcon} ${statusText}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem; margin-bottom: 0.75rem;">
          <div>
            <div style="color: #6b7280; font-size: 0.85rem;">Detection Events</div>
            <div style="font-weight: 500;">${vessel.event_count} recorded</div>
          </div>
          <div>
            <div style="color: #6b7280; font-size: 0.85rem;">Last Infected Visit</div>
            <div style="font-weight: 500;">${lastVisitText}</div>
          </div>
        </div>
        ${vessel.status === "cleared" ? `
          <div style="background: #dcfce7; border: 1px solid #86efac; color: #15803d; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            ✓ Båten er godkjent for normal drift ved alle anlegg.
          </div>
        ` : vessel.status === "pending" ? `
          <div style="background: #fef3c7; border: 1px solid #fde68a; color: #78350f; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            ⏳ Karantenetid ikke oppfylt. ${quarantineText}
          </div>
        ` : `
          <div style="background: #fee2e2; border: 1px solid #fecaca; color: #7f1d1d; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            🔴 Båten har besøkt smittet anlegg og er merket for risikotilsyn.
          </div>
        `}
      </div>
    `;
    }).join("");
  }

  async function loadConfirmedPlans(deps) {
    const {
      state,
      elements,
      apiFetch,
      formatNumber,
      renderConfirmedPlans,
    } = deps;

    if (!elements.confirmedPlansList) return;
    elements.confirmedPlansList.innerHTML = "Loading confirmed plans...";

    const mmsi = (elements.confirmedPlansMmsi?.value || "").trim();
    const query = mmsi ? `?mmsi=${encodeURIComponent(mmsi)}` : "";

    try {
      const data = await apiFetch(`/api/boat/plan/confirmed${query}`);
      state.confirmedPlans = data.plans || [];
      if (elements.confirmedPlansCount) {
        elements.confirmedPlansCount.textContent = formatNumber(data.count ?? state.confirmedPlans.length);
      }
      renderConfirmedPlans({ state, elements });
      state.loaded["confirmed-plans"] = true;
    } catch (error) {
      elements.confirmedPlansList.innerHTML = `Error: ${error.message}`;
    }
  }

  function renderConfirmedPlans(deps) {
    const { state, elements } = deps;

    if (!elements.confirmedPlansList) return;
    if (!state.confirmedPlans || !state.confirmedPlans.length) {
      elements.confirmedPlansList.innerHTML = "No confirmed plans found.";
      return;
    }

    elements.confirmedPlansList.innerHTML = state.confirmedPlans
      .map((plan) => {
        const routeDays = Array.isArray(plan.route) ? plan.route.length : 0;
        const facilityCount = Array.isArray(plan.route)
          ? plan.route.reduce((sum, day) => sum + (day.facilities?.length || 0), 0)
          : 0;
        const confirmedAtIso = plan.confirmed_at
          ? (/([zZ]|[+-]\d{2}:\d{2})$/.test(plan.confirmed_at) ? plan.confirmed_at : `${plan.confirmed_at}Z`)
          : null;
        const confirmedAt = confirmedAtIso
          ? new Date(confirmedAtIso).toLocaleString("no-NO")
          : "--";
        const position = plan.position || {};
        const posText = (Number.isFinite(position.lat) && Number.isFinite(position.lon))
          ? `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`
          : "--";

        return `
        <div class="list-item">
          <div class="list-title">${plan.vessel_name || "Unknown vessel"} (MMSI ${plan.mmsi || "--"})</div>
          <div class="list-meta">Plan ID: ${plan.plan_id || "--"} · Confirmed: ${confirmedAt}</div>
          <div class="list-meta">Days: ${routeDays} · Facilities: ${facilityCount}</div>
          <div class="list-meta">Position: ${posText} · Source: ${plan.position_source || "--"}</div>
        </div>
      `;
      })
      .join("");
  }

  window.AdminVesselOpsModule = {
    loadVesselClearing,
    renderVesselClearing,
    loadConfirmedPlans,
    renderConfirmedPlans,
  };
})();
