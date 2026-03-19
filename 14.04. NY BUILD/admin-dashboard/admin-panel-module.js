window.AdminPanelModule = (function () {
  'use strict';

  /**
   * Renders the disease status widget in the admin overview.
   * Shows confirmed and suspected counts for each disease type.
   */
  function renderAdminDiseaseStatus() {
    const data = state.admin.disease;
    if (!data || !data.diseases) {
      elements.adminDiseaseStatus.textContent = "No disease summary available.";
      return;
    }

    const entries = Object.entries(data.diseases)
      .map(([name, statuses]) => {
        const confirmed = statuses.confirmed || 0;
        const suspected = statuses.suspected || 0;
        const total = confirmed + suspected;
        return { name, confirmed, suspected, total };
      })
      .sort((a, b) => b.total - a.total);

    if (!entries.length) {
      elements.adminDiseaseStatus.textContent = "No disease signals in current week.";
      return;
    }

    elements.adminDiseaseStatus.innerHTML = entries
      .map((item) => {
        return `
        <div class="disease-item">
          <div class="disease-count">${item.total}</div>
          <div>
            <div>${item.name}</div>
            <div class="disease-meta">Confirmed ${item.confirmed} · Suspected ${item.suspected}</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  /**
   * Renders the 6 KPI mini-cards at the top of admin panel.
   * Shows critical/high counts, disease confirmations, and loaded data counts.
   */
  function renderAdminKpis() {
    const critical = state.admin.risk.filter((item) => item.risk_level === "Critical").length;
    const high = state.admin.risk.filter((item) => item.risk_level === "High").length;
    const vessels = state.admin.vessels.length;
    const ilaConfirmed = state.admin.health?.numberOfLocalitiesWithIla?.confirmed ?? "--";
    const pdConfirmed = state.admin.health?.numberOfLocalitiesWithPd?.confirmed ?? "--";

    setMiniCards(elements.adminKpis, [
      { label: "Critical", value: critical },
      { label: "High", value: high },
      { label: "ILA confirmed", value: ilaConfirmed },
      { label: "PD confirmed", value: pdConfirmed },
      { label: "Facilities loaded", value: state.admin.risk.length },
      { label: "Vessels loaded", value: vessels },
    ]);
  }

  /**
   * Renders the filterable facility list in admin panel.
   * Supports filtering by risk level, disease type, and search text.
   */
  function renderAdminRiskList() {
    const level = document.getElementById("adminRiskLevel").value;
    const disease = document.getElementById("adminDisease").value;
    const search = document.getElementById("adminRiskSearch").value.toLowerCase();

    let list = [...state.admin.risk];
    if (level !== "all") list = list.filter((item) => item.risk_level === level);
    if (disease === "ila") list = list.filter((item) => item.disease_status?.has_ila);
    if (disease === "pd") list = list.filter((item) => item.disease_status?.has_pd);
    if (disease === "none") list = list.filter((item) => !item.disease_status?.has_ila && !item.disease_status?.has_pd);
    if (search) {
      list = list.filter((item) => {
        const name = item.facility_name?.toLowerCase() || "";
        const code = item.facility_code?.toLowerCase() || "";
        return name.includes(search) || code.includes(search);
      });
    }

    if (!list.length) {
      elements.adminRiskList.innerHTML = "No facilities match current filters.";
      setAdminRiskDetail(null);
      return;
    }

    const selectedCode = state.admin.selectedRisk?.facility_code;
    if (!selectedCode || !list.find((item) => item.facility_code === selectedCode)) {
      state.admin.selectedRisk = list[0];
    }

    elements.adminRiskList.innerHTML = list
      .map((item, index) => {
        const levelClass = item.risk_level?.toLowerCase() || "medium";
        const sources = item.disease_status?.disease_sources;
        const sourcesCount = Array.isArray(sources) ? sources.length : 0;
        const tags = [
          item.disease_status?.has_ila ? "ILA" : null,
          item.disease_status?.has_pd ? "PD" : null,
        ].filter(Boolean);
        const isActive = item.facility_code === state.admin.selectedRisk?.facility_code;
        return `
        <div class="list-item ${isActive ? "active" : ""}" data-risk-index="${index}">
          <div class="list-title">${item.facility_name || "Unknown"}</div>
          <div class="list-meta">${item.facility_code || "--"} · Score ${item.risk_score ?? "--"}</div>
          <div class="list-meta">Lat ${formatCoord(item.location?.latitude)} · Lon ${formatCoord(item.location?.longitude)}</div>
          <div class="list-tags">
            <span class="tag ${levelClass}">${item.risk_level || "Unknown"}</span>
            ${tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
            ${sourcesCount ? `<span class="pill">Sources ${sourcesCount}</span>` : ""}
          </div>
        </div>
      `;
      })
      .join("");

    elements.adminRiskList.querySelectorAll(".list-item").forEach((item) => {
      item.addEventListener("click", () => {
        const index = Number(item.dataset.riskIndex);
        state.admin.selectedRisk = list[index];
        renderAdminRiskList();
        setAdminRiskDetail(state.admin.selectedRisk);
      });
    });

    setAdminRiskDetail(state.admin.selectedRisk);
  }

  /**
   * Renders facility detail panel showing risk score, lice data, and nearby disease sources.
   */
  function setAdminRiskDetail(item) {
    if (!item) {
      elements.adminRiskDetail.textContent = "Select a facility to see details.";
      return;
    }

    const lice = item.lice_data || {};
    const sources = item.disease_status?.disease_sources;
    const sourcesList = Array.isArray(sources)
      ? sources
          .slice(0, 6)
          .map((source) => {
            const diseases = Array.isArray(source.diseases) ? source.diseases.join(", ") : "--";
            return `
            <div class="detail-section">
              <div class="detail-row">
                <span>${source.facility_name || "Unknown"}</span>
                <span class="mono">${source.distance_km ?? "--"} km</span>
              </div>
              <div class="detail-sub">Disease: ${diseases}</div>
              <div class="detail-sub">Lice: adult ${source.adult_female_lice ?? "--"}, mobile ${source.mobile_lice ?? "--"}</div>
            </div>
          `;
          })
          .join("")
      : `<div class="detail-sub">${sources || "No disease sources"}</div>`;

    elements.adminRiskDetail.innerHTML = `
    <div class="detail-title">${item.facility_name || "Unknown"}</div>
    <div class="detail-sub">${item.facility_code || "--"} · ${formatCoord(item.location?.latitude)}, ${formatCoord(item.location?.longitude)}</div>
    <div class="detail-grid">
      <div class="detail-row"><span>Risk score</span><strong>${item.risk_score ?? "--"}</strong></div>
      <div class="detail-row"><span>Risk level</span><span class="tag ${item.risk_level?.toLowerCase() || "medium"}">${item.risk_level || "Unknown"}</span></div>
      <div class="detail-row"><span>Biggest factor</span><span>${item.biggest_risk_factor || "--"}</span></div>
      <div class="detail-row"><span>Lice (adult / mobile)</span><span>${lice.adult_female_lice ?? "--"} / ${lice.mobile_lice ?? "--"}</span></div>
      <div class="detail-row"><span>ILA</span><span>${item.disease_status?.has_ila ? "Yes" : "No"}</span></div>
      <div class="detail-row"><span>PD</span><span>${item.disease_status?.has_pd ? "Yes" : "No"}</span></div>
    </div>
    <div class="detail-title">Nearby disease sources</div>
    ${sourcesList}
  `;
  }

  /**
   * Renders the filterable vessel list in admin panel.
   * Supports filtering by minimum speed and MMSI search.
   */
  function renderAdminVesselList() {
    const minSpeed = Number(document.getElementById("adminVesselSpeed").value || 0);
    const search = document.getElementById("adminVesselSearch").value.trim();

    let vessels = [...state.admin.vessels];
    if (minSpeed) vessels = vessels.filter((item) => (item.speedOverGround ?? 0) >= minSpeed);
    if (search) vessels = vessels.filter((item) => String(item.mmsi || "").includes(search));

    vessels.sort((a, b) => (b.speedOverGround ?? 0) - (a.speedOverGround ?? 0));

    if (!vessels.length) {
      elements.adminVesselList.innerHTML = "No vessels match current filters.";
      setAdminVesselDetail(null);
      return;
    }

    const selectedMmsi = state.admin.selectedVessel?.mmsi;
    if (!selectedMmsi || !vessels.find((item) => item.mmsi === selectedMmsi)) {
      state.admin.selectedVessel = vessels[0];
    }

    elements.adminVesselList.innerHTML = vessels
      .slice(0, 30)
      .map((item, index) => {
        const isActive = item.mmsi === state.admin.selectedVessel?.mmsi;
        return `
        <div class="list-item ${isActive ? "active" : ""}" data-vessel-index="${index}">
          <div class="list-title">MMSI ${item.mmsi || "--"}</div>
          <div class="list-meta">Speed ${item.speedOverGround ?? "--"} kn · Heading ${item.trueHeading ?? item.courseOverGround ?? "--"}</div>
          <div class="list-meta">${item.latitude?.toFixed(3) ?? "--"}, ${item.longitude?.toFixed(3) ?? "--"}</div>
        </div>
      `;
      })
      .join("");

    elements.adminVesselList.querySelectorAll(".list-item").forEach((item) => {
      item.addEventListener("click", () => {
        const index = Number(item.dataset.vesselIndex);
        state.admin.selectedVessel = vessels[index];
        renderAdminVesselList();
        setAdminVesselDetail(state.admin.selectedVessel);
      });
    });

    setAdminVesselDetail(state.admin.selectedVessel);
  }

  /**
   * Renders vessel detail panel showing position, speed, course, heading, and status.
   */
  function setAdminVesselDetail(item) {
    if (!item) {
      elements.adminVesselDetail.textContent = "Select a vessel to see details.";
      return;
    }

    elements.adminVesselDetail.innerHTML = `
    <div class="detail-title">Vessel ${item.mmsi || "--"}</div>
    <div class="detail-sub">Updated ${item.msgtime || "--"}</div>
    <div class="detail-grid">
      <div class="detail-row"><span>Latitude</span><span>${item.latitude?.toFixed(4) ?? "--"}</span></div>
      <div class="detail-row"><span>Longitude</span><span>${item.longitude?.toFixed(4) ?? "--"}</span></div>
      <div class="detail-row"><span>Speed</span><span>${item.speedOverGround ?? "--"} kn</span></div>
      <div class="detail-row"><span>Course</span><span>${item.courseOverGround ?? "--"}</span></div>
      <div class="detail-row"><span>Heading</span><span>${item.trueHeading ?? "--"}</span></div>
      <div class="detail-row"><span>Status</span><span>${item.navigationalStatus ?? "--"}</span></div>
    </div>
  `;
  }

  // Public API
  return {
    renderAdminDiseaseStatus,
    renderAdminKpis,
    renderAdminRiskList,
    setAdminRiskDetail,
    renderAdminVesselList,
    setAdminVesselDetail,
  };
})();
