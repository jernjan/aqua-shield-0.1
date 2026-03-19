(function () {
  const DRIVER_LABELS = {
    distance_to_nearest_infected: "Distance to nearest infected",
    time_since_last_boat_visit: "Time since last boat visit",
    number_of_boat_visits: "Boat visits (7d)",
    ocean_current_alignment: "Ocean current alignment",
  };

  const FACTOR_LABELS = {
    distance_to_infected: "Distance factor (0-100)",
    time_since_visit: "Time since visit factor (0-100)",
    boat_visits_7d: "Boat visits factor (0-100)",
    ocean_current_risk: "Ocean current risk (0-100)",
    disease_weight: "Disease weight multiplier",
    quarantine_factor: "Quarantine multiplier",
  };

  function getRiskCategory(riskPct) {
    const pct = Number(riskPct || 0);
    if (pct >= 70) return { category: "EKSTREM", color: "#dc2626", bg: "#fee2e2", icon: "🔴" };
    if (pct >= 40) return { category: "HØY", color: "#ea580c", bg: "#fed7aa", icon: "🟠" };
    if (pct >= 20) return { category: "MODERAT", color: "#ca8a04", bg: "#fef3c7", icon: "🟡" };
    return { category: "LAV", color: "#16a34a", bg: "#dcfce7", icon: "🟢" };
  }

  function formatRiskDrivers(drivers, pred) {
    if (!Array.isArray(drivers) || !drivers.length) return "No drivers";

    const boatVisitsNormal = pred?.boat_visits_7d !== undefined ? pred.boat_visits_7d : 0;
    const quarantineBoats = pred?.quarantine_boats !== undefined ? pred.quarantine_boats : 0;
    const totalBoats = boatVisitsNormal + quarantineBoats;
    const sourceNameShort = pred?.source_facility_name ? pred.source_facility_name.split(' ')[0] : null;

    return drivers
      .map((item) => {
        if (!Array.isArray(item)) return String(item);
        const [name, weight] = item;

        if (name === "distance_to_nearest_infected" && sourceNameShort) {
          return `Avstand til ${sourceNameShort} (${weight}%)`;
        }
        if (name === "number_of_boat_visits" && totalBoats > 0) {
          return `Båter: ${totalBoats} stk (${weight}%)`;
        }
        if (name === "time_since_last_boat_visit") {
          return `Tid siden båtbesøk (${weight}%)`;
        }
        if (name === "ocean_current_alignment") {
          return `Havstrøm-retning (${weight}%)`;
        }

        const label = DRIVER_LABELS[name] || name;
        return `${label} (${weight}%)`;
      })
      .join(" · ");
  }

  function buildRiskFactorList(pred) {
    const factors = pred.factors || {};

    const factorOrder = ["distance_to_infected", "time_since_visit", "boat_visits_7d", "ocean_current_risk"];
    const sortedFactors = [];

    factorOrder.forEach((key) => {
      if (factors[key] !== undefined && factors[key] !== null) {
        sortedFactors.push(key);
      }
    });

    Object.keys(FACTOR_LABELS).forEach((key) => {
      if (!sortedFactors.includes(key) && factors[key] !== undefined && factors[key] !== null) {
        sortedFactors.push(key);
      }
    });

    const getFactorColor = (val) => {
      const num = Number(val || 0);
      if (num >= 70) return "#dc2626";
      if (num >= 50) return "#ea580c";
      if (num >= 30) return "#ca8a04";
      return "#059669";
    };

    const rows = sortedFactors
      .map((key, idx) => {
        const value = factors[key];
        const label = FACTOR_LABELS[key];
        const color = getFactorColor(value);
        const isTopFactor = idx < 2;
        const style = isTopFactor
          ? `style="background: #f9fafb; padding: 10px 8px; border-radius: 4px; border-left: 4px solid ${color}; margin-bottom: 4px;"`
          : `style="padding: 8px 4px;"`;

        return `<li ${style}><span style="color: #1f2937; font-weight: 500;">${label}</span><strong style="color: ${color}; font-weight: 700; font-size: 1.05rem;">${value}</strong></li>`;
      })
      .join("");

    return rows || `<li style="padding: 8px;"><span style="color: #374151;">No factor data available</span><strong>--</strong></li>`;
  }

  window.AdminPredictionsUtils = {
    getRiskCategory,
    formatRiskDrivers,
    buildRiskFactorList,
    DRIVER_LABELS,
    FACTOR_LABELS,
  };
})();
