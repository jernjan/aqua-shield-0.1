/**
 * Data Loading Module
 * Handles all basic data loading operations for facilities, vessels, health, and ocean data.
 * 
 * Dependencies: state, elements, apiFetch, setMiniCards, getById
 */

window.DataLoadingModule = (function () {
  'use strict';

  /**
   * Format B-survey status with Norwegian labels
   */
  function formatBSurveyStatus(bSurveyData) {
    if (!bSurveyData || !bSurveyData.site_condition) return '--';
    
    const labels = {
      1: '1 - meget god',
      2: '2 - god',
      3: '3 - dårlig',
      4: '4 - meget dårlig'
    };
    
    return labels[bSurveyData.site_condition] || `${bSurveyData.site_condition}`;
  }

  /**
   * Load facilities from API with filtering support
   * Supports two modes: "all" (with limit/skip/search) or "near" (geographical radius search)
   */
  async function loadFacilities() {
    const mode = getById("facilityMode")?.value || "all";
    const limit = Number(getById("facilityLimit")?.value || 50);
    const skip = Number(getById("facilitySkip")?.value || 0);
    const search = (getById("facilitySearch", "facility-search")?.value || "").toLowerCase();
    const lat = getById("facilityLat")?.value || "74.5";
    const lon = getById("facilityLon")?.value || "25";
    const radius = getById("facilityRadius")?.value || "10";

    elements.facilityTable.innerHTML = "<tr><td colspan=\"8\">Loading...</td></tr>";

    try {
      let data;
      if (mode === "near") {
        data = await apiFetch(`/api/facilities/near/${lat}/${lon}?radius_km=${radius}&include_fdir_metadata=true`);
        data.facilities = data.facilities || [];
      } else {
        data = await apiFetch(`/api/facilities?limit=${limit}&skip=${skip}&include_geo=true&refresh_geo=true&include_fdir_metadata=true`);
      }

      let facilities = data.facilities || [];

      if (search) {
        facilities = facilities.filter((item) => {
          const name = (item.name || "").toLowerCase();
          const code = (item.code || "").toLowerCase();
          const municipality = (item.municipality || "").toLowerCase();
          return name.includes(search) || code.includes(search) || municipality.includes(search);
        });
      }

      elements.facilityTable.innerHTML = facilities
        .map((item) => {
          const production = item.fdir?.production_category || '--';
          const bSurvey = formatBSurveyStatus(item.fdir?.latest_b_survey);
          
          return `
            <tr>
              <td>${item.code || "--"}</td>
              <td>${item.name || "--"}</td>
              <td>${item.municipality || "--"}</td>
              <td>${item.latitude?.toFixed(4) ?? "--"}</td>
              <td>${item.longitude?.toFixed(4) ?? "--"}</td>
              <td>${production}</td>
              <td>${bSurvey}</td>
              <td>${item.distance_km ?? "--"}</td>
            </tr>
          `;
        })
        .join("");

      state.loaded.facilities = true;
    } catch (error) {
      elements.facilityTable.innerHTML = `<tr><td colspan="8">Error: ${error.message}</td></tr>`;
    }
  }

  /**
   * Load vessels from API with geographical and speed filtering
   * Filters by speed range and lat/lon boundaries
   */
  async function loadVessels() {
    const limit = Number(document.getElementById("vesselLimit").value || 100);
    const minSpeed = Number(document.getElementById("vesselSpeed").value || 0);
    const latMin = Number(document.getElementById("vesselLatMin").value || -90);
    const latMax = Number(document.getElementById("vesselLatMax").value || 90);
    const lonMin = Number(document.getElementById("vesselLonMin").value || -180);
    const lonMax = Number(document.getElementById("vesselLonMax").value || 180);

    elements.vesselTable.innerHTML = "<tr><td colspan=\"7\">Loading...</td></tr>";

    try {
      const data = await apiFetch(`/api/vessels?limit=${limit}`);
      let vessels = data.vessels || [];

      vessels = vessels.filter((item) => {
        const speed = item.speedOverGround ?? 0;
        const lat = item.latitude ?? 0;
        const lon = item.longitude ?? 0;
        return speed >= minSpeed && lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
      });

      elements.vesselTable.innerHTML = vessels
        .map((item) => {
          return `
            <tr>
              <td>${item.name || "--"}</td>
              <td>${item.mmsi || "--"}</td>
              <td>${item.latitude?.toFixed(4) ?? "--"}</td>
              <td>${item.longitude?.toFixed(4) ?? "--"}</td>
              <td>${item.speedOverGround ?? "--"}</td>
              <td>${item.trueHeading ?? item.courseOverGround ?? "--"}</td>
              <td>${item.msgtime || "--"}</td>
            </tr>
          `;
        })
        .join("");

      state.loaded.vessels = true;
    } catch (error) {
      elements.vesselTable.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
    }
  }

  /**
   * Search for vessels by name
   * Uses API search endpoint with name parameter
   */
  async function searchVesselByName() {
    const searchTerm = (getById("vesselSearchName", "vessels-search")?.value || "").trim();
    
    if (!searchTerm) {
      alert("Please enter a vessel name to search");
      return;
    }

    elements.vesselTable.innerHTML = "<tr><td colspan=\"7\">Searching...</td></tr>";

    try {
      const data = await apiFetch(`/api/vessels/search?name=${encodeURIComponent(searchTerm)}`);
      const vessels = data.vessels || [];

      if (vessels.length === 0) {
        elements.vesselTable.innerHTML = `<tr><td colspan="7">No vessels found matching "${searchTerm}"</td></tr>`;
        return;
      }

      elements.vesselTable.innerHTML = vessels
        .map((item) => {
          return `
            <tr>
              <td><strong>${item.name || "--"}</strong></td>
              <td>${item.mmsi || "--"}</td>
              <td>${item.latitude?.toFixed(4) ?? "--"}</td>
              <td>${item.longitude?.toFixed(4) ?? "--"}</td>
              <td>${item.speedOverGround ?? "--"}</td>
              <td>${item.trueHeading ?? item.courseOverGround ?? "--"}</td>
              <td>${item.msgtime || "--"}</td>
            </tr>
          `;
        })
        .join("");

      state.loaded.vessels = true;
    } catch (error) {
      elements.vesselTable.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
    }
  }

  /**
   * Load health summary data
   * Displays weekly health stats (ILA/PD confirmed counts) with optional year/week filters
   */
  async function loadHealth() {
    const year = getById("healthYear", "health-year")?.value || "";
    const week = getById("healthWeek", "health-week")?.value || "";
    const params = new URLSearchParams();
    if (year) params.append("year", year);
    if (week) params.append("week", week);

    elements.healthJson.textContent = "Loading...";

    try {
      const data = await apiFetch(`/api/health-summary?${params.toString()}`);

      setMiniCards(elements.healthCards, [
        { label: "Reporting", value: data.numberOfReportingLocalities || "--" },
        { label: "Filtered", value: data.numberOfFilteredLocalities || "--" },
        { label: "ILA confirmed", value: data.numberOfLocalitiesWithIla?.confirmed || "--" },
        { label: "PD confirmed", value: data.numberOfLocalitiesWithPd?.confirmed || "--" },
      ]);

      elements.healthJson.textContent = JSON.stringify(data, null, 2);
      state.loaded.health = true;
    } catch (error) {
      elements.healthJson.textContent = `Error: ${error.message}`;
    }
  }

  /**
   * Load ocean current data for given coordinates
   * Fetches both summary metadata and current measurements at specified lat/lon
   */
  async function loadOcean() {
    const lat = getById("oceanLat", "ocean-lat")?.value || "74.5";
    const lon = getById("oceanLon", "ocean-lon")?.value || "25";

    elements.oceanJson.textContent = "Loading...";

    try {
      const summary = await apiFetch("/api/ocean/summary");
      const data = await apiFetch(`/api/ocean/currents?latitude=${lat}&longitude=${lon}`);

      setMiniCards(elements.oceanCards, [
        { label: "Area", value: summary.area || "Barentshavet" },
        { label: "Resolution", value: summary.resolution || "9km" },
        { label: "Update", value: summary.update_frequency || "Hourly" },
        { label: "Magnitude", value: data.magnitude ?? "--" },
      ]);

      elements.oceanJson.textContent = JSON.stringify(data, null, 2);
      state.loaded.ocean = true;
    } catch (error) {
      elements.oceanJson.textContent = `Error: ${error.message}`;
    }
  }

  // Public API
  return {
    loadFacilities,
    loadVessels,
    searchVesselByName,
    loadHealth,
    loadOcean
  };
})();
