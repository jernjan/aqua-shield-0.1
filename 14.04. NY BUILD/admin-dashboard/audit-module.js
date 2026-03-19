(function () {
  async function loadAuditLog(deps) {
    const { state, apiFetch, getById, renderAuditLog, logger = console } = deps;

    const mmsi = (getById("auditMmsiFilter", "audit-mmsi")?.value || "").trim();
    const days = getById("auditDaysFilter", "audit-days")?.value || "30";
    const query = `?days=${days}${mmsi ? "&mmsi=" + encodeURIComponent(mmsi) : ""}`;

    try {
      const data = await apiFetch(`/api/audit/visits-log${query}`);
      state.auditLog = data.entries || [];

      const totalCount = state.auditLog.length;
      const withPassCount = state.auditLog.filter((e) => e.had_health_pass === true).length;
      const warningIgnoredCount = state.auditLog.filter((e) => e.acknowledged_warning === true).length;
      const disinfectionCount = state.auditLog.filter((e) => e.disinfection === true).length;

      const totalEl = document.getElementById("auditTotalCount");
      const withPassEl = document.getElementById("auditWithPassCount");
      const warningIgnoredEl = document.getElementById("auditWarningIgnoredCount");
      const disinfectionEl = document.getElementById("auditDisinfectionCount");
      const lastUpdatedEl = document.getElementById("auditLastUpdated");

      if (totalEl) totalEl.textContent = totalCount;
      if (withPassEl) withPassEl.textContent = withPassCount;
      if (warningIgnoredEl) warningIgnoredEl.textContent = warningIgnoredCount;
      if (disinfectionEl) disinfectionEl.textContent = disinfectionCount;
      if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleTimeString("no-NO");

      renderAuditLog({ state, getById });
      state.loaded["audit-log"] = true;
    } catch (error) {
      logger.error("Failed to load audit log:", error);
      const tbody = getById("auditLogBody", "audit-table");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
      }
    }
  }

  function renderAuditLog(deps) {
    const { state, getById } = deps;
    const tbody = getById("auditLogBody", "audit-table");
    if (!tbody) return;

    if (!state.auditLog.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #9ca3af;">No audit entries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.auditLog
      .map((entry) => {
        const visitDate = entry.visit_date ? new Date(entry.visit_date).toLocaleDateString("no-NO") : "--";
        const boatName = entry.vessel_name || "--";
        const mmsi = entry.mmsi || "--";
        const facility = entry.facility_name || "--";
        const diseaseTypes = Array.isArray(entry.disease_types)
          ? entry.disease_types
          : (entry.disease_types ? [entry.disease_types] : []);
        const diseaseText = diseaseTypes.length ? diseaseTypes.join(", ") : "--";

        let healthPassBadge = "❓ Unknown";
        if (entry.had_health_pass === true) {
          healthPassBadge = "✅ Active";
        } else if (entry.had_health_pass === false && entry.acknowledged_warning === true) {
          healthPassBadge = "⚠️ Ignored";
        } else if (entry.had_health_pass === false) {
          healthPassBadge = "🔴 None";
        }

        const disinfectionBadge = entry.disinfection ? "✓ Yes" : "--";
        const responsibleParty = entry.responsible_party || "--";

        return `
      <tr style="border-bottom: 1px solid #e5e7eb; hover: background: #f9fafb;">
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">${visitDate}</td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb; font-weight: 500;">${boatName}<br><span style="font-size: 0.85rem; color: #6b7280;">${mmsi}</span></td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">${facility}</td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.9rem;">${diseaseText}</td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb; font-weight: 600;">${healthPassBadge}</td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">${disinfectionBadge}</td>
        <td style="padding: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.9rem;">${responsibleParty}</td>
      </tr>
    `;
      })
      .join("");
  }

  window.AdminAuditModule = {
    loadAuditLog,
    renderAuditLog,
  };
})();
