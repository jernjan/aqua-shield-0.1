(function () {
  async function loadSmittespredning(deps) {
    const { elements, state, apiFetch, renderSmittespredning } = deps;

    elements.smitteTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Loading...</td></tr>`;
    elements.smitteJson.textContent = "Loading infection paths...";

    try {
      const status = elements.smitteStatusFilter?.value || "";
      let url = `/api/exposure/smittespredning?limit=100`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await apiFetch(url);
      state.smittespredning = response.events || [];

      const stats = {
        total: response.count || 0,
        DETECTED: 0,
        CONFIRMED_HEALTHY: 0,
        CONFIRMED_INFECTED: 0,
        UNCERTAIN: 0,
      };

      state.smittespredning.forEach((event) => {
        const eventStatus = event.path_risk_status;
        if (stats[eventStatus] !== undefined) stats[eventStatus]++;
      });

      elements.smitteTotalPaths.textContent = stats.total;
      elements.smitteDetected.textContent = stats.DETECTED;
      elements.smitteHealthy.textContent = stats.CONFIRMED_HEALTHY;
      elements.smitteInfected.textContent = stats.CONFIRMED_INFECTED;
      elements.smitteUncertain.textContent = stats.UNCERTAIN;

      elements.smitteJson.textContent = JSON.stringify(response, null, 2);
      state.loaded.smittespredning = true;

      renderSmittespredning({ elements, state });
    } catch (error) {
      elements.smitteTableBody.innerHTML = `<tr><td colspan="8" class="text-center error">Error: ${error.message}</td></tr>`;
      elements.smitteJson.textContent = `Error: ${error.message}`;
    }
  }

  function renderSmittespredning(deps) {
    const { elements, state } = deps;

    const filter = elements.smitteStatusFilter?.value || "";
    const filtered = filter
      ? state.smittespredning.filter((e) => e.path_risk_status === filter)
      : state.smittespredning;

    if (filtered.length === 0) {
      elements.smitteTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">
          ${filter ? `No paths with status "${filter}"` : "No infection paths recorded"}
        </td>
      </tr>
    `;
      return;
    }

    let html = "";
    filtered.forEach((event) => {
      const startTime = new Date(event.timestamp_start).toLocaleString("no-NO");
      const endTime = event.timestamp_end ? new Date(event.timestamp_end).toLocaleString("no-NO") : "--";
      const statusColor = {
        DETECTED: "#fbbf24",
        CONFIRMED_HEALTHY: "#10b981",
        CONFIRMED_INFECTED: "#ef4444",
        UNCERTAIN: "#6b7280",
      }[event.path_risk_status] || "#9ca3af";

      html += `
      <tr>
        <td>
          <div style="font-weight: 600;">${event.vessel_name || "Unknown"}</div>
          <div style="font-size: 0.8rem; color: #9ca3af; font-family: 'IBM Plex Mono';">
            ${event.vessel_mmsi}
          </div>
        </td>
        <td>
          <div style="font-weight: 600;">${event.facility_start_name || event.facility_start_id}</div>
          <div style="font-size: 0.8rem; color: #f87171;">🧬 ${event.facility_start_disease}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${event.facility_end_name || event.facility_end_id || "--"}</div>
          <div style="font-size: 0.8rem; color: #9ca3af;">
            ${event.facility_end_id ? "Destination" : "Unknown"}
          </div>
        </td>
        <td>
          <span style="background: #374151; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.8rem;">
            ${event.detected_via}
          </span>
        </td>
        <td>
          <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.8rem; font-weight: 600;">
            ${event.path_risk_status}
          </span>
        </td>
        <td>
          <div style="font-size: 0.8rem;">
            <div>${startTime}</div>
            ${event.timestamp_end ? `<div>${endTime}</div>` : ""}
          </div>
        </td>
        <td>
          <div style="text-align: right;">
            ${event.distance_km ? `${event.distance_km.toFixed(1)} km` : "--"}
          </div>
        </td>
        <td>
          <div style="font-size: 0.8rem; color: #9ca3af; max-width: 200px; word-break: break-word;">
            ${event.notes || "--"}
          </div>
        </td>
      </tr>
    `;
    });

    elements.smitteTableBody.innerHTML = html;
  }

  window.AdminSmittespredningModule = {
    loadSmittespredning,
    renderSmittespredning,
  };
})();
