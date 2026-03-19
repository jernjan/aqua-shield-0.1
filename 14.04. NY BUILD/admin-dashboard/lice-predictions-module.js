(function () {
  const state = {
    rows: [],
    loaded: false,
    expandedRows: new Set(),
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "--";
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toLocaleString("nb-NO");
  }

  function resolveApiBase() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuery = urlParams.get("api_base");
    if (fromQuery) return fromQuery;
    return "http://127.0.0.1:8000";
  }

  function getRiskColor(level) {
    if (level === "Critical") return "#dc2626";
    if (level === "Medium") return "#f97316";
    return "#16a34a";
  }

  function formatFixed(value, digits = 1) {
    if (value === null || value === undefined || value === "") return "--";
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toFixed(digits);
  }

  function getCurrentLabel(row) {
    const currentRisk = row.ocean_current_risk || {};
    const alignment = Number(currentRisk.alignment_factor);
    const contribution = Number(row.ocean_current_contribution);

    if (Number.isFinite(alignment) && alignment < 0.5) {
      return "Motstraum";
    }

    if (Number.isFinite(contribution) && contribution > 0) {
      return "Hjelper spreiing";
    }

    return "Nøytral";
  }

  function formatDrivers(row) {
    const drivers = Array.isArray(row.risk_drivers) ? row.risk_drivers : [];
    if (!drivers.length) return "--";

    const labels = {
      lice_level: "Eige lusepress",
      distance_to_high_lice_source: "Kort avstand",
      ocean_current_alignment: "Havstraum",
      lice_cluster: "Klynge",
      report_threshold: "Over terskel",
    };

    return drivers.map((driver) => labels[driver] || driver).join(" • ");
  }

  function buildDetailText(row) {
    const currentRisk = row.ocean_current_risk || {};
    const sourceName = row.source_facility_name || "Ukjent kjelde";
    const sourceCode = row.source_facility_code || "--";
    const distanceKm = formatFixed(row.distance_to_source_km, 1);
    const ownContribution = formatFixed(row.own_lice_contribution, 1);
    const distanceContribution = formatFixed(row.distance_contribution, 1);
    const currentContribution = formatFixed(row.ocean_current_contribution, 1);
    const clusterContribution = formatFixed(row.cluster_contribution, 1);
    const alignment = formatFixed(currentRisk.alignment_factor, 2);
    const speed = formatFixed(currentRisk.current_speed_ms, 3);

    return `Kjelde: ${sourceName} (${sourceCode}) · Avstand: ${distanceKm === "--" ? "--" : `${distanceKm} km`} · Bidrag: eige=${ownContribution}, avstand=${distanceContribution}, straum=${currentContribution}, klynge=${clusterContribution} · Straumdata: alignment=${alignment}, fart=${speed} m/s`;
  }

  function getFilteredRows() {
    const search = (byId("predictionsLiceSearch")?.value || "").trim().toLowerCase();
    const level = (byId("predictionsLiceLevelFilter")?.value || "all").trim();

    let filtered = state.rows;

    if (level !== "all") {
      filtered = filtered.filter((row) => (row.risk_level || "Low") === level);
    }

    if (search) {
      filtered = filtered.filter((row) => {
        const name = String(row.facility_name || "").toLowerCase();
        const code = String(row.facility_code || "").toLowerCase();
        return name.includes(search) || code.includes(search);
      });
    }

    return filtered;
  }

  function renderSummary(summary) {
    byId("pl-critical").textContent = formatNumber(summary?.critical || 0);
    byId("pl-medium").textContent = formatNumber(summary?.medium || 0);
    byId("pl-low").textContent = formatNumber(summary?.low || 0);
    byId("pl-total").textContent = formatNumber(summary?.total_facilities || 0);
  }

  function renderTable() {
    const tbody = byId("predictions-lice-table");
    if (!tbody) return;

    const filtered = getFilteredRows();
    if (!filtered.length) {
      tbody.innerHTML = "<tr><td colspan='7' style='padding: 20px; text-align: center; color: var(--muted);'>Ingen anlegg matcher luse-filter.</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map((row, index) => {
      const riskLevel = row.risk_level || "Low";
      const riskColor = getRiskColor(riskLevel);
      const lice = row.lice_data || {};
      const adult = Number(lice.adult_female_lice);
      const total = Number(lice.total_lice);
      const adultText = Number.isFinite(adult) ? adult.toFixed(2) : "--";
      const totalText = Number.isFinite(total) ? total.toFixed(2) : "--";
      const overThreshold = lice.over_threshold === true;
      const distanceText = formatFixed(row.distance_to_source_km, 1);
      const ownContribution = formatFixed(row.own_lice_contribution, 1);
      const distanceContribution = formatFixed(row.distance_contribution, 1);
      const currentContribution = formatFixed(row.ocean_current_contribution, 1);
      const clusterContribution = formatFixed(row.cluster_contribution, 1);
      const currentLabel = getCurrentLabel(row);
      const sourceName = row.source_facility_name || "--";
      const sourceCode = row.source_facility_code || "--";
      const currentRisk = row.ocean_current_risk || {};
      const alignmentText = formatFixed(currentRisk.alignment_factor, 2);
      const driversText = formatDrivers(row);
      const detailText = buildDetailText(row);
      const detailKey = String(row.facility_code || row.facility_name || index);
      const isExpanded = state.expandedRows.has(detailKey);
      const detailsLabel = isExpanded ? "Skjul detaljer" : "Vis detaljer";

      return `
        <tr>
          <td>
            <div style="font-weight: 600;">${row.facility_name || "--"}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Kode: ${row.facility_code || "--"}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Vaksne: ${adultText} · Total: ${totalText} · ${overThreshold ? "🔴 Over terskel" : "🟢 Under terskel"}</div>
            <div style="margin-top: 6px;">
              <button class="btn secondary lice-detail-toggle" data-detail-key="${detailKey}" style="padding: 4px 8px; font-size: 0.72rem;">${detailsLabel}</button>
            </div>
          </td>
          <td style="text-align: center;">
            <div style="color: ${riskColor}; font-weight: 700;">${riskLevel}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">${formatFixed(row.risk_score, 1)} poeng</div>
          </td>
          <td style="text-align: center;">
            <div style="font-weight: 700;">${ownContribution}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">frå eige anlegg</div>
          </td>
          <td>
            <div style="font-weight: 600;">${sourceName}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Kode: ${sourceCode}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Klyngebonus: ${clusterContribution}</div>
          </td>
          <td style="text-align: center;">
            <div style="font-weight: 700;">${distanceText === "--" ? "--" : `${distanceText} km`}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Bidrag: ${distanceContribution}</div>
          </td>
          <td style="text-align: center;">
            <div style="font-weight: 700;">${currentLabel}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Bidrag: ${currentContribution}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Align: ${alignmentText}</div>
          </td>
          <td>
            <div>${driversText}</div>
            <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">Kjeldefelt: avstand + straum + eige press</div>
          </td>
        </tr>
        <tr style="display: ${isExpanded ? "table-row" : "none"}; background: rgba(255,255,255,0.02);">
          <td colspan="7" style="padding: 10px 12px; color: var(--muted); font-size: 0.82rem; border-top: 1px dashed rgba(255,255,255,0.08);">
            ${detailText}
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadLicePredictions() {
    const tbody = byId("predictions-lice-table");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='7' style='padding: 20px; text-align: center; color: var(--muted);'>Laster luse-prognoser...</td></tr>";

    try {
      const API_BASE = resolveApiBase();
      const response = await fetch(`${API_BASE}/api/risk/predictions/lice?limit=200`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      state.rows = data.top_20_by_risk || [];
      state.loaded = true;

      renderSummary(data.summary || {});
      renderTable();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='7' style='padding: 20px; text-align: center; color: var(--danger);'>Feil ved lasting av luse-prognoser: ${error.message}</td></tr>`;
    }
  }

  function setupLicePredictionFilters() {
    const searchInput = byId("predictionsLiceSearch");
    const levelFilter = byId("predictionsLiceLevelFilter");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        if (!state.loaded) return;
        renderTable();
      });
    }

    if (levelFilter) {
      levelFilter.addEventListener("change", () => {
        if (!state.loaded) return;
        renderTable();
      });
    }

    const tbody = byId("predictions-lice-table");
    if (tbody) {
      tbody.addEventListener("click", (event) => {
        const button = event.target.closest(".lice-detail-toggle");
        if (!button) return;
        const detailKey = String(button.dataset.detailKey || "");
        if (!detailKey) return;

        if (state.expandedRows.has(detailKey)) {
          state.expandedRows.delete(detailKey);
        } else {
          state.expandedRows.add(detailKey);
        }
        renderTable();
      });
    }
  }

  setupLicePredictionFilters();

  window.loadLicePredictions = loadLicePredictions;
  window.AdminLicePredictionsModule = {
    loadLicePredictions,
  };
})();
