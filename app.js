const API_BASE = window.location.hostname.includes("render.com")
  ? "https://kyst-api.render.com"
  : (window.location.hostname === "127.0.0.1" ? "http://127.0.0.1:8000" : "http://localhost:8000");

const API_BASE_FALLBACK = window.location.hostname.includes("render.com")
  ? null
  : (API_BASE.includes("localhost") ? "http://127.0.0.1:8000" : "http://localhost:8000");

const state = {
  risk: [],
  facilityRisk: [],
  facilityRiskSelectedCode: null,
  facilityRiskSummary: { ekstrem: 0, hÃ¸y: 0, moderat: 0, lav: 0, total: 0 },
  facilityRiskView: "list",
  vesselRisk: [],
  vesselRiskSelectedMmsi: null,
  vesselRiskSummary: { infected: 0, high: 0, moderate: 0, total: 0 },
  visitCategoryFilter: 'all',
  vesselClearing: [],
  vesselClearingSummary: { cleared: 0, pending: 0, atRisk: 0, total: 0 },
  predictions: [],
  predictionsSummary: { critical: 0, medium: 0, low: 0, total: 0 },
  confirmedPlans: [],
  auditLog: [],
  smittespredning: [],
  smitteStatusFilter: "",
  filters: {
    showAllPredictions: false,
    showOnlyProtectionZones: false,
    showOnlySurveillanceZones: false,
    showOnlyWithin10km: false,
  },
  admin: {
    risk: [],
    vessels: [],
    health: null,
    selectedRisk: null,
    selectedVessel: null,
  },
  loaded: {
    overview: false,
    admin: false,
    risk: false,
    facilityRisk: false,
    "facility-risks": false,
    facilities: false,
    vessels: false,
    vesselRisk: false,
    "vessel-risk": false,
    vesselClearing: false,
    "vessel-clearing": false,
    "confirmed-plans": false,
    "audit-log": false,
    "b-surveys": false,
    health: false,
    ocean: false,
    predictions: false,
    smittespredning: false,
  },
};

// Elements will be initialized after DOM loads
let elements = {};

function getById(...ids) {
  for (const id of ids) {
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function getByQuery(...selectors) {
  for (const selector of selectors) {
    if (!selector) continue;
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function ensureElement(id, tagName = "div", parent = document.body) {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const created = document.createElement(tagName);
  created.id = id;
  parent.appendChild(created);
  return created;
}

function ensureListContainer(id, fallbackTableBodyId) {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const fallbackBody = document.getElementById(fallbackTableBodyId);
  if (!fallbackBody) return null;
  const wrap = fallbackBody.closest(".table-wrap") || fallbackBody.parentElement;
  const list = document.createElement("div");
  list.id = id;
  list.className = "list";
  if (wrap && wrap.parentElement) {
    wrap.parentElement.insertBefore(list, wrap);
  } else {
    fallbackBody.parentElement.appendChild(list);
  }
  return list;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'info' (default: 'info')
 */
function showToast(message, type = 'info') {
  // Quick notification system without persistent toast UI
  // Can be enhanced later with visual toast elements
  console.log(`[${type.toUpperCase()}]`, message);
  
  // Optional: Show brief alerts for important messages
  if (type === 'error') {
    console.error(message);
  } else if (type === 'success') {
    console.log('âœ“ ' + message);
  }
}

// Initialize all DOM element references - MUST be called after DOMContentLoaded
function initializeElements() {
  elements = {
    apiDot: document.getElementById("apiDot"),
    apiStatus: document.getElementById("apiStatus"),
    apiBase: document.getElementById("apiBase"),
    healthStatus: document.getElementById("healthStatus"),
    healthMeta: document.getElementById("healthMeta"),
    dataFreshness: document.getElementById("dataFreshness"),
    facilityTotal: document.getElementById("facilityTotal"),
    vesselTotal: document.getElementById("vesselTotal"),
    vesselMeta: document.getElementById("vesselMeta"),
    oceanCoverage: document.getElementById("oceanCoverage"),
    riskGrid: document.getElementById("riskGrid"),
    riskSummary: document.getElementById("riskSummary"),
    loadRisk: document.getElementById("loadRisk"),
    facilityTable: document.querySelector("#facilityTable tbody"),
    loadFacilities: document.getElementById("loadFacilities"),
    loadFacilityRisk: document.getElementById("loadFacilityRisk"),
    facilityRiskEkstremCount: document.getElementById("facilityRiskEkstremCount"),
    facilityRiskHÃ¸yCount: document.getElementById("facilityRiskHÃ¸yCount"),
    facilityRiskModeratCount: document.getElementById("facilityRiskModeratCount"),
    facilityRiskLavCount: document.getElementById("facilityRiskLavCount"),
    facilityRiskTotalCount: document.getElementById("facilityRiskTotalCount"),
    facilityRiskList: document.getElementById("facilityRiskList"),
    facilityRiskTableWrap: document.getElementById("facilityRiskTableWrap"),
    facilityRiskTableBody: document.querySelector("#facilityRiskTable tbody"),
    facilityRiskTopList: document.getElementById("facilityRiskTopList"),
    facilityRiskSelectedId: document.getElementById("facilityRiskSelectedId"),
    facilityViewList: document.getElementById("facilityViewList"),
    facilityViewTable: document.getElementById("facilityViewTable"),
    facilityRiskLevel: document.getElementById("facilityRiskLevel"),
    facilityRiskSearch: document.getElementById("facilityRiskSearch"),
    facilityDiseaseFilter: document.getElementById("facilityDiseaseFilter"),
    facilityCountyFilter: document.getElementById("facilityCountyFilter"),
    vesselTable: document.querySelector("#vesselTable tbody"),
    loadVessels: document.getElementById("loadVessels"),
    loadHealth: document.getElementById("loadHealth"),
    healthCards: document.getElementById("healthCards"),
    healthJson: document.getElementById("healthJson"),
    loadOcean: document.getElementById("loadOcean"),
    oceanCards: document.getElementById("oceanCards"),
    oceanJson: document.getElementById("oceanJson"),
    loadSmitte: document.getElementById("loadSmitte"),
    refreshSmitte: document.getElementById("refreshSmitte"),
    smitteStatusFilter: document.getElementById("smitteStatusFilter"),
    smitteStats: document.getElementById("smitteStats"),
    smitteTotalPaths: document.getElementById("smitteTotalPaths"),
    smitteDetected: document.getElementById("smitteDetected"),
    smitteHealthy: document.getElementById("smitteHealthy"),
    smitteInfected: document.getElementById("smitteInfected"),
    smitteUncertain: document.getElementById("smitteUncertain"),
    smitteTableBody: document.getElementById("smitteTableBody"),
    smitteJson: document.getElementById("smitteJson"),
    adminKpis: document.getElementById("adminKpis"),
    adminRiskList: document.getElementById("adminRiskList"),
    adminRiskDetail: document.getElementById("adminRiskDetail"),
    adminVesselList: document.getElementById("adminVesselList"),
    adminVesselDetail: document.getElementById("adminVesselDetail"),
    adminLoad: document.getElementById("adminLoad"),
    adminDiseaseStatus: document.getElementById("adminDiseaseStatus"),
    loadVesselRisk: document.getElementById("loadVesselRisk"),
    vesselRiskInfectedCount: document.getElementById("vesselRiskInfectedCount"),
    vesselRiskHighCount: document.getElementById("vesselRiskHighCount"),
    vesselRiskChainCount: document.getElementById("vesselRiskChainCount"),
    vesselRiskTotalCount: document.getElementById("vesselRiskTotalCount"),
    vesselRiskList: document.getElementById("vesselRiskList"), // Legacy, no longer used
    vesselRiskSelectedMmsi: document.getElementById("vesselRiskSelectedMmsi"),
    vesselRiskLevel: document.getElementById("vesselRiskLevel"),
    vesselInfectedFilter: document.getElementById("vesselInfectedFilter"),
    vesselChainFilter: document.getElementById("vessel-chain-filter") || document.getElementById("vesselChainFilter"),
    vesselQuarantineFilter: document.getElementById("vessel-quarantine-filter") || document.getElementById("vesselQuarantineFilter"),
    vesselQuarantineBreachCount: document.getElementById("vr-breach-count"),
    vesselQuarantineActiveCount: document.getElementById("vr-active-count"),
    vesselClearedCount: document.getElementById("vesselClearedCount"),
    vesselPendingCount: document.getElementById("vesselPendingCount"),
    vesselAtRiskCount: document.getElementById("vesselAtRiskCount"),
    vesselClearingTotalCount: document.getElementById("vesselClearingTotalCount"),
    vesselClearingList: document.getElementById("vesselClearingList"),
    vesselStatusFilter: document.getElementById("vesselStatusFilter"),
    vesselClearingSearch: document.getElementById("vesselClearingSearch"),
    loadVesselClearing: document.getElementById("loadVesselClearing"),
    predictionsLoad: document.getElementById("predictionsLoad"),
    predictionsLoadText: document.getElementById("predictionsLoadText"),
    predictionsLoadSpinner: document.getElementById("predictionsLoadSpinner"),
    showAllPredictionsToggle: document.getElementById("showAllPredictionsToggle"),
    showOnlyProtectionToggle: document.getElementById("showOnlyProtectionToggle"),
    showOnlySurveillanceToggle: document.getElementById("showOnlySurveillanceToggle"),
    showOnlyWithin10kmToggle: document.getElementById("showOnlyWithin10kmToggle"),
    predictionsAtRisk: document.getElementById("pred-at-risk"),
    predictionsProtection: document.getElementById("pred-protection-count"),
    predictionsSurveillance: document.getElementById("pred-surveillance-count"),
    predictions10km: document.getElementById("pred-10km-count"),
    predictionsTotal: document.getElementById("predictionsTotal"),
    predictionsCriticalList: document.getElementById("predictionsCriticalList"),
    predictionsTable: document.querySelector("#predictionsTable tbody"),
    predictionsLastUpdate: document.getElementById("predictionsLastUpdate"),
    confirmedPlansMmsi: document.getElementById("confirmedPlansMmsi"),
    confirmedPlansLoad: document.getElementById("loadConfirmedPlans"),
    confirmedPlansCount: document.getElementById("confirmedPlansCount"),
    confirmedPlansList: document.getElementById("confirmedPlansList"),
  };

  if (!elements.healthStatus) elements.healthStatus = getById("overviewApiStatus", "heroStatus");
  if (!elements.healthMeta) elements.healthMeta = ensureElement("healthMeta", "span", document.body);
  if (!elements.dataFreshness) elements.dataFreshness = ensureElement("dataFreshness", "span", document.body);
  if (!elements.facilityTotal) elements.facilityTotal = getById("overviewFacilities", "sidebarFacilities");
  if (!elements.vesselTotal) elements.vesselTotal = getById("overviewVessels", "sidebarVessels");
  if (!elements.vesselMeta) elements.vesselMeta = ensureElement("vesselMeta", "span", document.body);
  if (!elements.oceanCoverage) elements.oceanCoverage = getById("overviewOcean");

  if (!elements.riskGrid) elements.riskGrid = getById("risk-data");
  if (!elements.riskSummary) elements.riskSummary = getById("risk-data");
  if (!elements.loadRisk) elements.loadRisk = getById("risk-load");

  if (!elements.facilityTable) elements.facilityTable = getByQuery("#facilityTable tbody", "#facilities-table");
  if (!elements.loadFacilities) elements.loadFacilities = getById("facilities-load");
  if (!elements.loadFacilityRisk) elements.loadFacilityRisk = getById("facility-risk-load");
  if (!elements.facilityRiskEkstremCount) elements.facilityRiskEkstremCount = getById("fr-ekstrem");
  if (!elements.facilityRiskHÃ¸yCount) elements.facilityRiskHÃ¸yCount = getById("fr-hÃ¸y");
  if (!elements.facilityRiskModeratCount) elements.facilityRiskModeratCount = getById("fr-moderat");
  if (!elements.facilityRiskLavCount) elements.facilityRiskLavCount = ensureElement("facilityRiskLavCount", "span", document.body);
  if (!elements.facilityRiskTotalCount) elements.facilityRiskTotalCount = getById("fr-total");
  if (!elements.facilityRiskList) elements.facilityRiskList = ensureListContainer("facilityRiskList", "facility-risk-table");
  if (!elements.facilityRiskTableBody) elements.facilityRiskTableBody = getByQuery("#facility-risk-table", "#facilityRiskTable tbody");
  if (!elements.facilityRiskTableWrap) {
    const wrap = getById("facilityRiskTableWrap") || document.querySelector("#facility-risks .table-wrap");
    elements.facilityRiskTableWrap = wrap || ensureElement("facilityRiskTableWrap", "div", document.body);
  }
  if (!elements.facilityRiskTopList) elements.facilityRiskTopList = ensureElement("facilityRiskTopList", "div", document.body);
  if (!elements.facilityRiskSelectedId) elements.facilityRiskSelectedId = ensureElement("facilityRiskSelectedId", "span", document.body);
  if (!elements.facilityViewList) elements.facilityViewList = ensureElement("facilityViewList", "button", document.body);
  if (!elements.facilityViewTable) elements.facilityViewTable = ensureElement("facilityViewTable", "button", document.body);
  if (!elements.facilityRiskLevel) elements.facilityRiskLevel = getById("facility-risk-level");
  if (!elements.facilityRiskSearch) elements.facilityRiskSearch = ensureElement("facilityRiskSearch", "input", document.body);
  if (!elements.facilityDiseaseFilter) elements.facilityDiseaseFilter = ensureElement("facilityDiseaseFilter", "select", document.body);
  if (!elements.facilityCountyFilter) elements.facilityCountyFilter = ensureElement("facilityCountyFilter", "select", document.body);

  if (!elements.vesselTable) elements.vesselTable = getByQuery("#vesselTable tbody", "#vessels-table");
  if (!elements.loadVessels) elements.loadVessels = getById("vessels-load");
  if (!elements.loadHealth) elements.loadHealth = getById("health-load");
  if (!elements.healthCards) elements.healthCards = ensureElement("healthCards", "div", getById("health") || document.body);
  if (!elements.healthJson) elements.healthJson = getById("health-data");
  if (!elements.loadOcean) elements.loadOcean = getById("ocean-load");
  if (!elements.oceanCards) elements.oceanCards = ensureElement("oceanCards", "div", getById("ocean") || document.body);
  if (!elements.oceanJson) elements.oceanJson = getById("ocean-data");

  if (!elements.loadSmitte) elements.loadSmitte = getById("smitte-load");
  if (!elements.refreshSmitte) elements.refreshSmitte = getById("smitte-load");
  if (!elements.smitteStatusFilter) elements.smitteStatusFilter = getById("smitte-status");
  if (!elements.smitteStats) elements.smitteStats = ensureElement("smitteStats", "div", document.body);
  if (!elements.smitteTotalPaths) elements.smitteTotalPaths = ensureElement("smitteTotalPaths", "span", document.body);
  if (!elements.smitteDetected) elements.smitteDetected = ensureElement("smitteDetected", "span", document.body);
  if (!elements.smitteHealthy) elements.smitteHealthy = ensureElement("smitteHealthy", "span", document.body);
  if (!elements.smitteInfected) elements.smitteInfected = ensureElement("smitteInfected", "span", document.body);
  if (!elements.smitteUncertain) elements.smitteUncertain = ensureElement("smitteUncertain", "span", document.body);
  if (!elements.smitteTableBody) elements.smitteTableBody = getById("smitte-table", "smitteTableBody");
  if (!elements.smitteJson) elements.smitteJson = ensureElement("smitteJson", "pre", getById("smittespredning") || document.body);

  if (!elements.adminKpis) elements.adminKpis = ensureElement("adminKpis", "div", getById("admin") || document.body);
  if (!elements.adminRiskList) elements.adminRiskList = ensureElement("adminRiskList", "div", getById("admin") || document.body);
  if (!elements.adminRiskDetail) elements.adminRiskDetail = ensureElement("adminRiskDetail", "div", getById("admin") || document.body);
  if (!elements.adminVesselList) elements.adminVesselList = ensureElement("adminVesselList", "div", getById("admin") || document.body);
  if (!elements.adminVesselDetail) elements.adminVesselDetail = ensureElement("adminVesselDetail", "div", getById("admin") || document.body);
  if (!elements.adminLoad) elements.adminLoad = getById("admin-load", "admin-refresh");
  if (!elements.adminDiseaseStatus) elements.adminDiseaseStatus = ensureElement("adminDiseaseStatus", "div", getById("admin") || document.body);
  ensureElement("adminNetworkContainer", "div", getById("admin") || document.body);
  ensureElement("adminPriorityList", "div", getById("admin") || document.body);
  ensureElement("criticalEventsContainer", "div", getById("admin") || document.body);
  ensureElement("criticalCount", "span", getById("admin") || document.body);
  ensureElement("statusInfectedVisit", "span", getById("admin") || document.body);
  ensureElement("statusRiskZoneVisit", "span", getById("admin") || document.body);
  ensureElement("status10kmVisit", "span", getById("admin") || document.body);
  ensureElement("statusCleared", "span", getById("admin") || document.body);

  if (!elements.loadVesselRisk) elements.loadVesselRisk = getById("vessel-risk-load");
  if (!elements.vesselRiskInfectedCount) elements.vesselRiskInfectedCount = getById("vr-infected-count");
  if (!elements.vesselRiskHighCount) elements.vesselRiskHighCount = getById("vr-risk-count");
  if (!elements.vesselRiskChainCount) elements.vesselRiskChainCount = ensureElement("vesselRiskChainCount", "span", document.body);
  if (!elements.vesselRiskTotalCount) elements.vesselRiskTotalCount = getById("vr-total-count");
  if (!elements.vesselRiskSelectedMmsi) elements.vesselRiskSelectedMmsi = ensureElement("vesselRiskSelectedMmsi", "span", document.body);
  if (!elements.vesselRiskLevel) elements.vesselRiskLevel = getById("vessel-risk-filter", "vesselRiskLevel") || ensureElement("vesselRiskLevel", "select", document.body);
  if (!elements.vesselChainFilter) elements.vesselChainFilter = getById("vessel-chain-filter", "vesselChainFilter") || ensureElement("vesselChainFilter", "select", document.body);
  if (!elements.vesselQuarantineFilter) elements.vesselQuarantineFilter = getById("vessel-quarantine-filter", "vesselQuarantineFilter") || ensureElement("vesselQuarantineFilter", "select", document.body);
  if (!elements.vesselQuarantineBreachCount) elements.vesselQuarantineBreachCount = getById("vr-breach-count") || ensureElement("vesselQuarantineBreachCount", "span", document.body);
  if (!elements.vesselQuarantineActiveCount) elements.vesselQuarantineActiveCount = getById("vr-active-count") || ensureElement("vesselQuarantineActiveCount", "span", document.body);
  if (!elements.vesselRiskLevel.value) elements.vesselRiskLevel.value = "all";
  if (!elements.vesselChainFilter.value) elements.vesselChainFilter.value = "all";
  if (!elements.vesselQuarantineFilter.value) elements.vesselQuarantineFilter.value = "priority";

  if (!elements.vesselClearedCount) elements.vesselClearedCount = getById("vc-cleared");
  if (!elements.vesselPendingCount) elements.vesselPendingCount = getById("vc-pending");
  if (!elements.vesselAtRiskCount) elements.vesselAtRiskCount = getById("vc-atrisk");
  if (!elements.vesselClearingTotalCount) elements.vesselClearingTotalCount = getById("vc-total");
  if (!elements.vesselClearingList) elements.vesselClearingList = ensureListContainer("vesselClearingList", "vessel-clearing-table");
  if (!elements.vesselStatusFilter) elements.vesselStatusFilter = getById("vessel-clearing-status") || ensureElement("vesselStatusFilter", "select", document.body);
  if (!elements.vesselClearingSearch) elements.vesselClearingSearch = ensureElement("vesselClearingSearch", "input", document.body);
  if (!elements.loadVesselClearing) elements.loadVesselClearing = getById("vessel-clearing-load");

  if (!elements.predictionsLoad) elements.predictionsLoad = getById("predictionsLoad");
  if (!elements.predictionsLoadText) elements.predictionsLoadText = ensureElement("predictionsLoadText", "span", elements.predictionsLoad || document.body);
  if (!elements.predictionsLoadSpinner) elements.predictionsLoadSpinner = ensureElement("predictionsLoadSpinner", "span", elements.predictionsLoad || document.body);
  if (!elements.predictionsAtRisk) elements.predictionsAtRisk = getById("pred-at-risk");
  if (!elements.predictionsTotal) elements.predictionsTotal = ensureElement("predictionsTotal", "span", document.body);
  if (!elements.predictionsCriticalList) elements.predictionsCriticalList = ensureElement("predictionsCriticalList", "div", getById("predictions") || document.body);
  if (!elements.predictionsTable) elements.predictionsTable = getById("predictions-table") || getByQuery("#predictionsTable tbody");
  if (!elements.predictionsLastUpdate) elements.predictionsLastUpdate = ensureElement("predictionsLastUpdate", "span", document.body);

  if (!elements.confirmedPlansMmsi) elements.confirmedPlansMmsi = getById("confirmed-plans-mmsi");
  if (!elements.confirmedPlansLoad) elements.confirmedPlansLoad = getById("confirmed-plans-load");
  if (!elements.confirmedPlansCount) elements.confirmedPlansCount = ensureElement("confirmedPlansCount", "span", getById("confirmed-plans") || document.body);
  if (!elements.confirmedPlansList) elements.confirmedPlansList = ensureListContainer("confirmedPlansList", "confirmed-plans-table");
}

function setApiStatus(ok, text, datasources = {}) {
  elements.apiDot.style.background = ok ? "#45e39e" : "#ff6b6b";
  elements.apiStatus.textContent = text;
  
  // Update datasources display
  updateDatasourcesDisplay(datasources);
}

function updateDatasourcesDisplay(datasources = {}) {
  const container = document.getElementById('datasourcesList');
  if (!container) return;
  
  // Map display names for datasources
  const displayNames = {
    'barentswatch_facilities': 'BarentsWatch Facilities',
    'barentswatch_nais': 'BarentsWatch NAIS',
    'barentswatch_ais': 'BarentsWatch AIS',
    'cmems_ocean_data': 'CMEMS Ocean'
  };
  
  container.innerHTML = '';
  
  if (Object.keys(datasources).length === 0) {
    container.innerHTML = '<div style="color: var(--muted); font-size: 0.75rem;">No data</div>';
    return;
  }
  
  Object.entries(datasources).forEach(([key, value]) => {
    const displayName = displayNames[key] || key.replace(/_/g, ' ');
    const isOk = value === 'OK' || value === 'ok' || value === 'healthy';
    const dotColor = isOk ? '#45e39e' : '#ff9a50';
    const dot = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; margin-right: 6px; vertical-align: middle;"></span>`;
    
    const text = `${dot}<span style="color: var(--muted);">${displayName}</span>`;
    const row = document.createElement('div');
    row.innerHTML = text;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.fontSize = '0.78rem';
    container.appendChild(row);
  });
}

function formatNumber(value) {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCoord(value) {
  if (value === null || value === undefined) return "--";
  return Number(value).toFixed(3);
}

const predictionsUtils = window.AdminPredictionsUtils || {};
const predictionsModule = window.AdminPredictionsModule || {};
const vesselRiskModule = window.AdminVesselRiskModule || {};
const auditModule = window.AdminAuditModule || {};
const vesselOpsModule = window.AdminVesselOpsModule || {};
const smittespredningModule = window.AdminSmittespredningModule || {};
const correlationDetailModule = window.AdminCorrelationDetailModule || {};
const adminCorrelationsRenderModule = window.AdminCorrelationsRenderModule || {};
const adminLoadFallbackModule = window.AdminLoadFallbackModule || {};
const modalHelpersModule = window.AdminModalHelpersModule || {};
const graphHighlightModule = window.AdminGraphHighlightModule || {};
const graphControlsModule = window.AdminGraphControlsModule || {};
const priorityActionsModule = window.AdminPriorityActionsModule || {};
const adminActionsModule = window.AdminActionsModule || {};
const modalEventsModule = window.AdminModalEventsModule || {};
const uiFilterBindingsModule = window.AdminUiFilterBindingsModule || {};
const smitteListenersModule = window.AdminSmitteListenersModule || {};
const coreLoadBindingsModule = window.AdminCoreLoadBindingsModule || {};
const vesselRiskFiltersModule = window.AdminVesselRiskFiltersModule || {};
const predictionsZoneFiltersModule = window.AdminPredictionsZoneFiltersModule || {};
const vesselSearchModule = window.AdminVesselSearchModule || {};
const domInitModule = window.DOMInitModule || {};

// Risk category classification with colors
function getRiskCategory(riskPct) {
  if (typeof predictionsUtils.getRiskCategory === "function") {
    return predictionsUtils.getRiskCategory(riskPct);
  }
  const pct = Number(riskPct || 0);
  if (pct >= 70) return { category: "EKSTREM", color: "#dc2626", bg: "#fee2e2", icon: "ðŸ”´" };
  if (pct >= 40) return { category: "HÃ˜Y", color: "#ea580c", bg: "#fed7aa", icon: "ðŸŸ " };
  if (pct >= 20) return { category: "MODERAT", color: "#ca8a04", bg: "#fef3c7", icon: "ðŸŸ¡" };
  return { category: "LAV", color: "#16a34a", bg: "#dcfce7", icon: "ðŸŸ¢" };
}

function formatRiskDrivers(drivers, pred) {
  if (typeof predictionsUtils.formatRiskDrivers === "function") {
    return predictionsUtils.formatRiskDrivers(drivers, pred);
  }
  if (!Array.isArray(drivers) || !drivers.length) return "No drivers";
  
  const factors = pred?.factors || {};
  const boatVisitsNormal = pred?.boat_visits_7d !== undefined ? pred.boat_visits_7d : 0;
  const quarantineBoats = pred?.quarantine_boats !== undefined ? pred.quarantine_boats : 0;
  const totalBoats = boatVisitsNormal + quarantineBoats;
  const sourceNameShort = pred?.source_facility_name ? pred.source_facility_name.split(' ')[0] : null;
  
  return drivers
    .map((item) => {
      if (!Array.isArray(item)) return String(item);
      const [name, weight] = item;
      
      // Add context to each driver
      if (name === "distance_to_nearest_infected" && sourceNameShort) {
        return `Avstand til ${sourceNameShort} (${weight}%)`;
      } else if (name === "number_of_boat_visits" && totalBoats > 0) {
        return `BÃ¥ter: ${totalBoats} stk (${weight}%)`;
      } else if (name === "time_since_last_boat_visit") {
        return `Tid siden bÃ¥tbesÃ¸k (${weight}%)`;
      } else if (name === "ocean_current_alignment") {
        return `HavstrÃ¸m-retning (${weight}%)`;
      }
      
      const label = (predictionsUtils.DRIVER_LABELS && predictionsUtils.DRIVER_LABELS[name]) || name;
      return `${label} (${weight}%)`;
    })
    .join(" Â· ");
}

function buildRiskFactorList(pred) {
  if (typeof predictionsUtils.buildRiskFactorList === "function") {
    return predictionsUtils.buildRiskFactorList(pred);
  }
  const factors = pred.factors || {};
  
  // Order factors by impact (distance, time, boats, ocean)
  const factorOrder = ["distance_to_infected", "time_since_visit", "boat_visits_7d", "ocean_current_risk"];
  const sortedFactors = [];
  
  factorOrder.forEach(key => {
    if (factors[key] !== undefined && factors[key] !== null) {
      sortedFactors.push(key);
    }
  });
  
  // Add any remaining factors
  const factorLabels = predictionsUtils.FACTOR_LABELS || {
    distance_to_infected: "Distance factor (0-100)",
    time_since_visit: "Time since visit factor (0-100)",
    boat_visits_7d: "Boat visits factor (0-100)",
    ocean_current_risk: "Ocean current risk (0-100)",
    disease_weight: "Disease weight multiplier",
    quarantine_factor: "Quarantine multiplier",
  };

  Object.keys(factorLabels).forEach(key => {
    if (!sortedFactors.includes(key) && factors[key] !== undefined && factors[key] !== null) {
      sortedFactors.push(key);
    }
  });
  
  // Color intensity based on value (higher = more red/orange)
  const getFactorColor = (val) => {
    const num = Number(val || 0);
    if (num >= 70) return "#dc2626"; // Red
    if (num >= 50) return "#ea580c"; // Orange
    if (num >= 30) return "#ca8a04"; // Amber
    return "#059669"; // Green
  };
  
  const rows = sortedFactors
    .map((key, idx) => {
      const value = factors[key];
      const label = factorLabels[key];
      const color = getFactorColor(value);
      const isTopFactor = idx < 2; // Highlight top 2 factors
      const style = isTopFactor 
        ? `style="background: #f9fafb; padding: 10px 8px; border-radius: 4px; border-left: 4px solid ${color}; margin-bottom: 4px;"` 
        : `style="padding: 8px 4px;"`;
      return `<li ${style}>
        <span style="color: #1f2937; font-weight: 500;">${label}</span>
        <strong style="color: ${color}; font-weight: 700; font-size: 1.05rem;">${value}</strong>
      </li>`;
    })
    .join("");
  
  return rows || `<li style="padding: 8px;"><span style="color: #374151;">No factor data available</span><strong>--</strong></li>`;
}

function ensureRiskFactorModal() {
  let modal = document.getElementById("riskFactorModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "riskFactorModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px;";
  modal.innerHTML = `
    <div style="width:min(900px, 96vw);max-height:90vh;overflow:auto;background:#0b1220;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
        <h3 style="margin:0;color:#e5e7eb;font-size:1.1rem;">Risikoprognose - Detaljer</h3>
        <button id="closeRiskFactorModal" class="btn" style="background:#374151;color:#fff;cursor:pointer;">Lukk</button>
      </div>
      <div id="riskFactorBody" style="color:#d1d5db;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#closeRiskFactorModal");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeRiskFactorModal());
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeRiskFactorModal();
  });

  return modal;
}

function ensureTransmissionModal() {
  let modal = document.getElementById("transmissionModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "transmissionModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px;";
  modal.innerHTML = `
    <div style="width:min(900px, 96vw);max-height:90vh;overflow:auto;background:#0b1220;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
        <h3 style="margin:0;color:#e5e7eb;font-size:1.1rem;">Smittekjede-analyse</h3>
        <button id="closeTransmissionModal" class="btn" style="background:#374151;color:#fff;cursor:pointer;">Lukk</button>
      </div>
      <div id="transmissionBody" style="color:#d1d5db;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#closeTransmissionModal");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeTransmissionModal());
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeTransmissionModal();
  });

  return modal;
}

async function showRiskFactorModal(pred) {
  const modal = ensureRiskFactorModal();
  const body = document.getElementById("riskFactorBody");
  if (!modal || !body || !pred) return;

  const riskScore = Number(pred.outbreak_risk_pct ?? 0).toFixed(0);
  const driversText = formatRiskDrivers(pred.risk_drivers, pred);
  const facilityName = pred.facility_name || "Unknown";
  const facilityCode = pred.facility_code || "--";
  const primaryDisease = pred.primary_disease || "Unknown";
  
  // Facility health status - MUST BE CRYSTAL CLEAR
  // Use explicit is_infected flag from API if available, otherwise assume healthy (this endpoint returns healthy at-risk facilities)
  const hasDisease = pred.is_infected === true;
  
  // Mode indicator & header with category colors
  const riskCat = getRiskCategory(riskScore);
  
  // MAKE IT ABSOLUTELY CLEAR WHAT THIS MEANS
  let mainMessage, explanation, targetInfo;
  
  if (hasDisease) {
    // ALREADY INFECTED - risk is about spreading TO OTHERS
    mainMessage = `${facilityName} ER ALLEREDE SMITTET`;
    explanation = `Dette anlegget kan SPRE ${primaryDisease} til andre anlegg i omrÃ¥det`;
    targetInfo = `<div style="padding: 12px; background: #fff; border-radius: 6px; border-left: 4px solid #dc2626; margin-top: 12px;">
      <div style="font-weight: 700; color: #7f1d1d; margin-bottom: 6px;">âš ï¸ SMITTERISIKO FOR ANDRE ANLEGG</div>
      <div style="color: #1f2937; font-size: 0.95rem; line-height: 1.6;">
        Anlegg i nÃ¦rheten kan bli smittet via bÃ¥ttrafikk og havstrÃ¸mmer. 
        Risikoscoren er ${riskScore} poeng de neste 30 dagene.
      </div>
    </div>`;
  } else if (pred.source_facility_name) {
    // HEALTHY but can be infected FROM SOURCE
    mainMessage = `${facilityName} ER FRISKT (ikke smittet ennÃ¥)`;
    explanation = `Dette anlegget KAN BLI SMITTET av ${pred.source_facility_name}`;
    targetInfo = `<div style="padding: 14px; background: white; border-radius: 6px; border: 2px solid #fca5a5; margin-top: 12px;">
      <div style="font-weight: 700; color: #7f1d1d; margin-bottom: 8px; font-size: 0.95rem;">ðŸ”» SMITTEKILDE</div>
      <div style="padding: 10px; background: #fef2f2; border-radius: 4px; margin-bottom: 8px;">
        <div style="font-weight: 600; color: #7f1d1d; font-size: 1rem;">${pred.source_facility_name}</div>
        <div style="color: #1f2937; font-size: 0.85rem; margin-top: 4px;">ðŸ“ ${pred.distance_to_nearest_infected?.toFixed(1) || "?"} km unna</div>
      </div>
      <div style="color: #1f2937; font-size: 0.95rem; line-height: 1.5;">
        <strong>Scenario:</strong> ${pred.source_facility_name} kan smitte ${facilityName} 
        via bÃ¥ter som besÃ¸ker begge anlegg eller via havstrÃ¸mmer. 
        Risikoscore: ${riskScore} poeng de neste 30 dagene.
      </div>
    </div>`;
  } else {
    // HEALTHY and no source nearby
    mainMessage = `${facilityName} ER FRISKT`;
    explanation = `Ingen smittede anlegg i umiddelbar nÃ¦rhet`;
    targetInfo = `<div style="padding: 12px; background: #f0fdf4; border-radius: 6px; border-left: 4px solid #22c55e; margin-top: 12px;">
      <div style="font-weight: 600; color: #15803d;">âœ“ Ingen identifisert smittekilde</div>
      <div style="color: #1f2937; font-size: 0.9rem; margin-top: 6px;">Ingen smittede anlegg funnet i nÃ¦rheten</div>
    </div>`;
  }
  
  const modeDisplay = hasDisease
    ? {
        title: "ðŸ”´ OVERFÃ˜RINGSRISIKO",
        subtitle: "Dette anlegget KAN SMITTE andre",
        color: "#dc2626",
        bg: "#fee2e2"
      }
    : {
        title: `${riskCat.icon} SMITTERISIKO (${riskCat.category})`,
        subtitle: "Dette anlegget KAN BLI SMITTET",
        color: riskCat.color,
        bg: riskCat.bg
      };
  
  // Facility header card - ULTRA CLEAR
  const facilityHeader = `
    <div class="modal-card-item" style="background: ${modeDisplay.bg}; border-left: 5px solid ${modeDisplay.color}; padding: 18px; margin-bottom: 16px;">
      <div style="font-weight: 700; color: ${modeDisplay.color}; font-size: 1.2rem; margin-bottom: 8px;">${modeDisplay.title}</div>
      <div style="font-weight: 700; font-size: 1.05rem; color: #111827; margin-bottom: 6px;">${mainMessage}</div>
      <div style="font-size: 0.95rem; color: #1f2937; margin-bottom: 12px; line-height: 1.5;">${explanation}</div>
      <div class="value" style="font-size: 1.6rem; color: ${modeDisplay.color}; font-weight: 700;">${riskScore}</div>
      <div style="font-size: 0.85rem; color: #374151; margin-top: 4px;">Risiko-score (0-100 poeng) - 30-dags prognose</div>
    </div>
  `;
  
  // Risk contribution breakdown - SHOW WHAT AFFECTS THE RISK
  const distContrib = Number(pred.distance_contribution || 0).toFixed(0);
  const oceanContrib = Number(pred.ocean_current_contribution || 0).toFixed(0);
  const diseaseContrib = Number(pred.disease_contribution || 0).toFixed(0);
  const vesselContrib = Number(pred.vessel_contribution || 0).toFixed(0);
  const totalContrib = Number(distContrib) + Number(oceanContrib) + Number(diseaseContrib) + Number(vesselContrib);
  
  const getContribColor = (contrib) => {
    const num = Number(contrib || 0);
    if (num >= 20) return "#dc2626"; // Red - strong factor
    if (num >= 10) return "#ea580c"; // Orange - medium factor
    return "#059669"; // Green - weak factor
  };
  
  const contribBar = (label, contrib, maxWidth = 100) => {
    const num = Number(contrib || 0);
    const width = totalContrib > 0 ? (num / totalContrib * maxWidth) : 0;
    const color = getContribColor(num);
    return num > 0 ? `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #374151; font-weight: 500; font-size: 0.9rem;">${label}</span>
          <span style="color: ${color}; font-weight: 700; font-size: 0.9rem;">${num} pts</span>
        </div>
        <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: ${color}; height: 100%; width: ${width}%; transition: width 0.3s ease;"></div>
        </div>
      </div>
    ` : '';
  };
  
  const riskBreakdown = `
    <div class="modal-card-item" style="background: #f9fafb; border-left: 4px solid #6b7280; padding: 14px; margin-bottom: 16px;">
      <div style="font-weight: 700; color: #111827; margin-bottom: 12px; font-size: 0.95rem;">ðŸ“Š RISIKOFAKTOR-BIDRAG (Totalt 100 pts)</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          ${contribBar('ðŸ“ Avstand', distContrib, 50)}
          ${contribBar('ðŸŒŠ HavstrÃ¸m', oceanContrib, 50)}
        </div>
        <div>
          ${contribBar('ðŸ¦  Sykdomstype', diseaseContrib, 50)}
          ${contribBar('ðŸš¢ BÃ¥ttrafikk', vesselContrib, 50)}
        </div>
      </div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 0.85rem; color: #6b7280;">
        <strong>HovedÃ¥rsaker:</strong> ${(pred.risk_drivers || []).map(d => {
          if (d === 'distance') return 'ðŸ“ Avstand';
          if (d === 'ocean_current') return 'ðŸŒŠ HavstrÃ¸m';
          if (d === 'disease') return 'ðŸ¦  Sykdomstype';
          if (d === 'vessels') return 'ðŸš¢ BÃ¥ter';
          return d;
        }).join(', ') || 'Ingen identifisert'}
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d1d5db; font-size: 0.75rem; color: #9ca3af;">
        ðŸ’¡ <strong>Hva betyr denne scoren?</strong> En score pÃ¥ ${riskScore} poeng indikerer risikoen basert pÃ¥ avstand, havstrÃ¸m-retning og sykdomstype. Dette er et estimat, ikke en presise sannsynlighet.
      </div>
    </div>
  `;
  
  // Facility info card
  const facilityInfo = `
    <div class="modal-card-item">
      <div class="label" style="color: #111827; font-weight: 600;">ðŸ“ Anleggsinformasjon</div>
      <div style="margin-top: 8px;">
        <div style="font-weight: 600; font-size: 1.05rem; color: #111827;">${facilityName}</div>
        <div style="font-size: 0.9rem; color: #374151; margin-top: 2px;">Lokalitet: ${facilityCode}</div>
        ${hasDisease ? `<div style="font-size: 0.9rem; color: #991b1b; font-weight: 600; margin-top: 4px;">Sykdom: ${primaryDisease}</div>` : ''}
        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 6px;">ðŸ“ ${pred.latitude?.toFixed(4)}, ${pred.longitude?.toFixed(4)}</div>
        <div style="font-size: 0.85rem; color: #6b7280;">ðŸ“… ${pred.prediction_date?.split('T')[0] || "--"}</div>
      </div>
    </div>
  `;
  
  // Boat visits data - CLEAR NUMBERS
  const factors = pred.factors || {};
  const boatVisitsNormal = pred.boat_visits_7d !== undefined ? pred.boat_visits_7d : 0;
  const quarantineBoats = pred.quarantine_boats !== undefined ? pred.quarantine_boats : 0;
  const totalBoats = boatVisitsNormal + quarantineBoats;
  
  const boatInfo = totalBoats > 0 ? `
    <div class="modal-card-item">
      <div class="label" style="color: #111827; font-weight: 600;">ðŸš¢ BÃ¥ttrafikk (siste 7 dager)</div>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <div style="flex: 1; padding: 14px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px;">
          <div style="font-size: 0.85rem; color: #374151; margin-bottom: 4px; font-weight: 600;">Normale bÃ¥ter</div>
          <div style="font-weight: 700; font-size: 1.4rem; color: #15803d;">${boatVisitsNormal}</div>
        </div>
        ${quarantineBoats > 0 ? `
        <div style="flex: 1; padding: 14px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px;">
          <div style="font-size: 0.85rem; color: #374151; margin-bottom: 4px; font-weight: 600;">âš ï¸ Karantene-bÃ¥ter</div>
          <div style="font-weight: 700; font-size: 1.4rem; color: #991b1b;">${quarantineBoats}</div>
          <div style="font-size: 0.8rem; color: #7f1d1d; margin-top: 4px; font-weight: 600;">3x hÃ¸yere risiko</div>
        </div>
        ` : ""}
      </div>
      <div style="margin-top: 10px; font-size: 0.9rem; color: #1f2937; font-weight: 500;">
        Totalt: ${totalBoats} bÃ¥t${totalBoats !== 1 ? 'er' : ''} har besÃ¸kt anlegget
      </div>
    </div>
  ` : `
    <div class="modal-card-item">
      <div class="label" style="color: #111827; font-weight: 600;">ðŸš¢ BÃ¥ttrafikk (siste 7 dager)</div>
      <div style="font-size: 0.95rem; color: #374151; margin-top: 8px; font-weight: 500;">Ingen bÃ¥ter registrert</div>
    </div>
  `;
  
  // Fetch vessel visit details for this facility
  let vesselVisitsSection = '';
  try {
    const response = await fetch(`${API_BASE}/api/vessels/at-risk-facilities?min_duration_minutes=20`);
    if (response.ok) {
      const data = await response.json();
      // Find vessels that visited this facility
      const vesselsForFacility = data.vessels?.filter(v => 
        v.facility_visits?.some(visit => String(visit.facility_code) === String(facilityCode))
      ) || [];
      
      if (vesselsForFacility.length > 0) {
        const vesselListHTML = vesselsForFacility.slice(0, 10).map(vessel => {
          // Get this facility's visit details
          const thisVisit = vessel.facility_visits.find(v => String(v.facility_code) === String(facilityCode));
          const visitDate = thisVisit?.last_visit ? new Date(thisVisit.last_visit).toLocaleDateString('no-NO') : 'Unknown';
          const visitDuration = thisVisit?.duration_minutes ? `${thisVisit.duration_minutes} min` : 'Unknown';
          const otherFacilities = vessel.facility_visits.filter(v => String(v.facility_code) !== String(facilityCode));
          
          // Risk badge
          const riskBadge = vessel.risk_level === 'ekstrem' 
            ? 'ðŸ”´ Ekstrem' 
            : vessel.risk_level === 'hÃ¸y' 
            ? 'ðŸŸ  HÃ¸y' 
            : vessel.risk_level === 'moderat' 
            ? 'ðŸŸ¡ Moderat' 
            : 'ðŸŸ¢ Lav';
          
          const riskColor = vessel.risk_level === 'ekstrem' 
            ? '#dc2626' 
            : vessel.risk_level === 'hÃ¸y' 
            ? '#f97316' 
            : vessel.risk_level === 'moderat' 
            ? '#eab308' 
            : '#22c55e';
          
          return `
            <div style="padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${riskColor}; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div>
                  <div style="font-weight: 600; color: #111827; font-size: 0.95rem;">${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
                  <div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">ðŸ“… Siste besÃ¸k: ${visitDate} â€¢ â±ï¸ ${visitDuration}</div>
                </div>
                <span style="background: ${riskColor}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.7rem; font-weight: 600; white-space: nowrap;">${riskBadge}</span>
              </div>
              ${otherFacilities.length > 0 ? `
                <div style="font-size: 0.85rem; color: #374151; margin-top: 8px;">
                  <strong>Andre anlegg besÃ¸kt (7d):</strong>
                  <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                    ${otherFacilities.slice(0, 3).map(f => `
                      <span style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.facility_name || f.facility_code}</span>
                    `).join('')}
                    ${otherFacilities.length > 3 ? `<span style="color: #6b7280; font-size: 0.75rem;">+${otherFacilities.length - 3} til</span>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
        
        vesselVisitsSection = `
          <div class="modal-card-item" style="border: 2px solid #3b82f6; background: #eff6ff;">
            <div class="label" style="color: #1e40af; font-weight: 600;">ðŸš¢ BÃ¥ter som har besÃ¸kt dette anlegget (siste 7 dager)</div>
            <div style="font-size: 0.85rem; color: #1f2937; margin-top: 6px; margin-bottom: 12px;">
              Viser ${Math.min(vesselsForFacility.length, 10)} av ${vesselsForFacility.length} bÃ¥t${vesselsForFacility.length !== 1 ? 'er' : ''} som har besÃ¸kt ${facilityName}
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
              ${vesselListHTML}
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to fetch vessel visits:', error);
  }
  
  // Ocean current data
  const oceanRisk = factors.ocean_current_risk;
  const oceanInfo = oceanRisk !== undefined && oceanRisk > 0
    ? `
      <div class="modal-card-item" style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px;">
        <div class="label" style="color: #1e40af; font-weight: 600;">ðŸŒŠ HavstrÃ¸m (NorKyst-800)</div>
        <div style="font-weight: 700; font-size: 1.2rem; color: #1e40af; margin-top: 6px;">${(oceanRisk).toFixed(1)}/100</div>
        <div style="font-size: 0.85rem; color: #1f2937; margin-top: 4px; font-weight: 500;">StrÃ¸mretning-analyse aktiv</div>
      </div>
    `
    : "";

  body.innerHTML = `
    ${facilityHeader}
    ${riskBreakdown}
    ${targetInfo}
    ${facilityInfo}
    ${boatInfo}
    ${vesselVisitsSection}
    ${oceanInfo}
    <div class="modal-card-item">
      <div class="label" style="color: #111827; font-weight: 600;">ðŸ“Š Hovedfaktorer som driver risiko</div>
      <div style="font-size: 0.95rem; margin-top: 10px; line-height: 1.7; color: #1f2937; font-weight: 500;">${driversText}</div>
    </div>
    <div class="modal-card-item">
      <div class="label" style="color: #111827; font-weight: 600;">ðŸ“ˆ Teknisk faktor-oversikt</div>
      <ul class="modal-list" style="margin-top: 10px;">
        ${buildRiskFactorList(pred)}
      </ul>
    </div>
  `;

  modal.style.display = "flex";
}

function closeRiskFactorModal() {
  const modal = document.getElementById("riskFactorModal");
  if (!modal) return;
  modal.style.display = "none";
}

async function showTransmissionModal(pred) {
  const modal = ensureTransmissionModal();
  const body = document.getElementById("transmissionBody");
  if (!modal || !body || !pred) return;

  const facilityName = pred.facility_name || "Unknown";
  const facilityCode = pred.facility_code || "--";
  const sourceFacility = pred.source_facility_name || "Unknown";
  const sourceDistance = (pred.distance_to_nearest_infected || pred.distance_to_source_km || 0)?.toFixed(1) || "?";
  const riskScore = Number(pred.outbreak_risk_pct ?? 0).toFixed(0);
  const primaryDisease = pred.primary_disease || "Unknown";
  
  // Multiple sources in cluster
  const nearbySources = pred.nearby_sources || [];
  const hasCluster = nearbySources.length > 1;
  const sourcesList = nearbySources.length > 0 
    ? nearbySources.map((s, idx) => `<div style="padding:8px; background:${idx === 0 ? '#fee2e2' : 'white'}; border-radius:4px; margin-bottom:6px; border-left:3px solid ${idx === 0 ? '#dc2626' : '#f97316'};">
        <div style="font-weight:600; color:#1f2937;">${idx === 0 ? 'ðŸ”´ ' : 'ðŸŸ  '}${s.name}</div>
        <div style="color:#6b7280; font-size:0.85rem;">ðŸ“ ${s.distance} km unna</div>
        ${s.latitude && s.longitude ? `<div style="color:#9ca3af; font-size:0.75rem;">(${s.latitude?.toFixed(2)}, ${s.longitude?.toFixed(2)})</div>` : ''}
        ${s.diseases && s.diseases.length > 0 ? `<div style="color:#dc2626; font-size:0.8rem; font-weight:600;">ðŸ¦  ${s.diseases.join(', ')}</div>` : ''}
      </div>`).join('')
    : `<div style="padding:8px; background:white; border-radius:4px; color:#6b7280;">${sourceFacility} (${sourceDistance} km)</div>`;

  // Build transmission chain visualization
  let transmissionHTML = `
    ${hasCluster ? `
    <div style="padding: 16px; background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); border-radius: 8px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
      <div style="font-weight: 700; color: white; font-size: 1.2rem; margin-bottom: 6px;">âš ï¸ SMITTEKLYNGE DETEKTERT</div>
      <div style="color: white; font-size: 0.95rem; line-height: 1.6;">
        ${nearbySources.length} smittede anlegg innenfor 50 km radius. 
        <strong>Risiko Ã¸kt med ${((pred.cluster_multiplier - 1) * 100).toFixed(0)}% pga. flere smittekilder.</strong>
      </div>
    </div>
    ` : ''}
    <div style="padding: 16px; background: #fff3e0; border-radius: 8px; border-left: 5px solid #f97316; margin-bottom: 20px;">
      <div style="font-weight: 700; color: #7c2d12; font-size: 1.1rem; margin-bottom: 8px;">ðŸ§¬ Smittekjede-analyse</div>
      <div style="color: #1f2937; font-size: 0.95rem; line-height: 1.6;">
        <strong class="text-em">${facilityName}</strong> har risikoscore <strong class="text-em">${riskScore} poeng</strong> for Ã¥ bli smittet 
        fra en klynge av <strong class="text-em">${nearbySources.length > 0 ? nearbySources.length : 1}</strong> smittet anlegg innenfor 50 km
        i lÃ¸pet av de neste 30 dagene.
      </div>
    </div>

    <!-- Transmission Chain Visualization -->
    <div style="margin-bottom: 24px;">
      <div style="font-weight: 700; color: #111827; margin-bottom: 12px; font-size: 1rem;">ðŸ“Š SMITTEFLYT FRA KLYNGE</div>
      
      <!-- Source Facility Box -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="flex: 1; padding: 14px; background: #fee2e2; border: 2px solid #dc2626; border-radius: 8px;">
          <div style="font-weight: 700; color: #7f1d1d; font-size: 1rem;">ðŸ”´ SMITTEKILDER</div>
          ${sourcesList}
          <div style="color: #6b7280; font-size: 0.85rem; margin-top: 4px;">ðŸ“ ${sourceDistance} km unna</div>
          <div style="color: #dc2626; font-weight: 600; font-size: 0.85rem; margin-top: 6px;">ðŸ¦  ${primaryDisease} bekreftet</div>
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; font-size: 1.5rem; color: #f97316; margin-bottom: 16px; letter-spacing: 2px;">â¬‡ â¬‡ â¬‡</div>

      <!-- Transmission Vectors Section -->
      <div style="padding: 14px; background: #f3e8ff; border: 2px solid #a855f7; border-radius: 8px; margin-bottom: 16px;">
        <div style="font-weight: 700; color: #6b21a8; font-size: 0.95rem; margin-bottom: 8px;">ðŸš¢ MULIGE SMITTEVEKTORER</div>
        <div style="color: #1f2937; font-size: 0.9rem; line-height: 1.6;">
          <div style="margin-bottom: 8px;">
            <strong>BÃ¥ter:</strong> Kommersielle bÃ¥ter og Service-bÃ¥ter som besÃ¸ker bÃ¥de smittekilder og <strong>${facilityName}</strong> kan transportere virus.
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Hydrologi:</strong> HavstrÃ¸mmer fra klyngen av smittede anlegg (innenfor 50 km) kan transportere virus direkte.
          </div>
          <div>
            <strong>Tidsvindu:</strong> Virus overlever ca. 5-7 dager under optimale forhold.
          </div>
        </div>
      </div>

      <!-- Arrow -->
      <div style="text-align: center; font-size: 1.5rem; color: #f97316; margin-bottom: 16px; letter-spacing: 2px;">â¬‡ â¬‡ â¬‡</div>

      <!-- Target Facility Box -->
      <div style="padding: 14px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px;">
        <div style="font-weight: 700; color: #92400e; font-size: 1rem;">ðŸŸ  RISIKOUTSATT ANLEGG</div>
        <div style="color: #1f2937; font-weight: 600; margin-top: 6px; font-size: 0.95rem;">${facilityName}</div>
        <div style="color: #92400e; font-weight: 700; font-size: 1.2rem; margin-top: 8px;">${riskScore} poeng</div>
        <div style="color: #6b7280; font-size: 0.85rem; margin-top: 4px;">Risikoscore neste 30 dager</div>
      </div>
    </div>

    <!-- Key Risk Factors -->
    <div style="padding: 14px; background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px; margin-bottom: 20px;">
      <div style="font-weight: 700; color: #0c4a6e; font-size: 0.95rem; margin-bottom: 10px;">âš¡ KRITISKE RISIKOFAKTORER</div>
      <ul style="margin: 0; padding-left: 20px; color: #1f2937; font-size: 0.9rem; line-height: 1.8;">
        <li><strong>Smitteklynge:</strong> ${nearbySources.length} anlegg innenfor 50 km${nearbySources.length > 1 ? ` (risiko Ã¸kt med ${((pred.cluster_multiplier - 1) * 100).toFixed(0)}% pga. flere kilder)` : ''}</li>
        <li><strong>Avstand:</strong> NÃ¦rmeste smittekilde: ${sourceDistance} km</li>
        <li><strong>BÃ¥ttrafikk:</strong> (se bÃ¥t-vektor-data under)</li>
        <li><strong>Sykdomstype:</strong> ${primaryDisease} â€“ (overfÃ¸ringshastighet: hÃ¸y)</li>
        <li><strong>Tidsvindu:</strong> Virus kan overleve 5-7 dager i lavtemperatur-miljÃ¸</li>
        <li><strong>Prognosehorisont:</strong> 30 dager (full infeksjonssyklus + buffer)</li>
      </ul>
    </div>
      </ul>
    </div>

    <!-- Mitigation Actions -->
    <div style="padding: 14px; background: #dcfce7; border-left: 4px solid #16a34a; border-radius: 6px; margin-bottom: 20px;">
      <div style="font-weight: 700; color: #166534; font-size: 0.95rem; margin-bottom: 10px;">âœ“ TILTAK</div>
      <ul style="margin: 0; padding-left: 20px; color: #1f2937; font-size: 0.9rem; line-height: 1.8;">
        <li><strong>BÃ¥tkarantene:</strong> Isoler bÃ¥ter som besÃ¸ker smitteklyngen</li>
        <li><strong>Desinfeksjon:</strong> Krev desinfeksjon fÃ¸r besÃ¸k hos ${facilityName}</li>
        <li><strong>OvervÃ¥king:</strong> Ã˜k testfrekvens de neste 30 dagene</li>
        <li><strong>Redusert trafikk:</strong> Limit bÃ¥t-bevegelse mellom sonene</li>
      </ul>
    </div>

    <!-- Boat Vector Details (if available) -->
    <div style="padding: 14px; background: #f3f4f6; border-radius: 6px; border: 1px solid #d1d5db;">
      <div style="font-weight: 700; color: #111827; font-size: 0.95rem; margin-bottom: 10px;">ðŸš¢ BÃ…TER MED KONTAKT TIL SMITTEKILDENE</div>
      <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 10px;">
        Disse bÃ¥tene har besÃ¸kt smitteklyngen eller ligger i nÃ¦rheten og kan vÃ¦re vektorer:
      </div>
      <div id="boatVectorsList" style="color: #6b7280; font-size: 0.85rem; font-style: italic;">
        (BÃ¥t-data lastes fra API...)
      </div>
    </div>
  `;

  body.innerHTML = transmissionHTML;

  // Try to load actual boat vector data from API
  try {
    const vesselData = await apiFetch(`/api/facilities/${facilityCode}/vessel-arrival-risk`);
    if (vesselData && vesselData.vessels && vesselData.vessels.length > 0) {
      const boatHTML = vesselData.vessels.slice(0, 5).map((vessel, idx) => `
        <div style="padding: 10px; background: white; border-radius: 4px; margin-bottom: 8px; border-left: 3px solid #0284c7;">
          <div style="font-weight: 600; color: #111827; font-size: 0.9rem;">#${idx + 1}: ${vessel.vessel_name || `MMSI ${vessel.mmsi}`}</div>
          <div style="color: #6b7280; font-size: 0.85rem; margin-top: 3px;">
            ðŸ“ Avstand: ${(vessel.distance_km ?? "?").toFixed(1)} km
            â€¢ â±ï¸ Sist besÃ¸k: ${vessel.last_visit ? new Date(vessel.last_visit).toLocaleDateString('no-NO') : "Unknown"}
            â€¢ ðŸŸ  Risiko: ${vessel.risk_level}
          </div>
        </div>
      `).join('');
      
      document.getElementById("boatVectorsList").innerHTML = boatHTML || "<div style='color: #9ca3af;'>Ingen bÃ¥t-aktivitet detektert</div>";
    }
  } catch (err) {
    console.error('Failed to load boat vector data:', err);
    document.getElementById("boatVectorsList").innerHTML = "<div style='color: #ef4444;'>Kunne ikke laste bÃ¥t-data</div>";
  }

  modal.style.display = "flex";
  
  // Add close button handler
  const closeBtn = modal.querySelector('[data-modal-close]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = "none";
    });
  }
}

function closeTransmissionModal() {
  const modal = document.getElementById("transmissionModal");
  if (!modal) return;
  modal.style.display = "none";
}


function attachRiskFactorHandlers() {
  document.querySelectorAll(".risk-factor-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.predIndex || "0");
      const pred = state.predictions[index];
      showRiskFactorModal(pred);
    });
  });

  // Transmission sources handlers
  document.querySelectorAll(".transmission-source-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.predIndex || "0");
      const pred = state.predictions[index];
      showTransmissionModal(pred);
    });
  });
}

async function apiFetch(path, options = {}) {
  const baseCandidates = API_BASE_FALLBACK ? [API_BASE, API_BASE_FALLBACK] : [API_BASE];
  let lastError = null;

  // Safety timeout: 10 min for heavy endpoints, 5 min for others
  const timeoutMs = path.includes('at-risk-facilities') ? 10 * 60 * 1000 : 5 * 60 * 1000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const mergedOptions = { ...options, signal: options.signal || controller.signal };

  try {
    for (const base of baseCandidates) {
      try {
        console.log(`[API] Fetching: ${base}${path}`);
        const response = await fetch(`${base}${path}`, mergedOptions);
        console.log(`[API] Response status for ${path}: ${response.status}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[API] Error response body: ${errorText}`);
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`[API] Success: ${path}`, data);
        clearTimeout(timeoutId);
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`[API] Base failed (${base}):`, error?.message || error);
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  console.error(`[API] Fetch failed for ${path}:`, lastError);
  throw lastError;

async function loadOverview() {
  if (typeof UIOrchestrationModule?.loadOverview === "function") {
    try {
      await UIOrchestrationModule.loadOverview({
        elements,
        API_BASE,
        apiFetch,
        setApiStatus,
        formatNumber,
        state
      });
      return;
    } catch (moduleError) {
      console.warn("UI orchestration module loadOverview failed, using fallback in app.js:", moduleError);
    }
  }
async function apiFetch(path, options = {}) {
  const baseCandidates = API_BASE_FALLBACK ? [API_BASE, API_BASE_FALLBACK] : [API_BASE];
  let lastError = null;

  // Safety timeout: 10 min for heavy endpoints, 5 min for others
  const timeoutMs = path.includes('at-risk-facilities') ? 10 * 60 * 1000 : 5 * 60 * 1000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const mergedOptions = { ...options, signal: options.signal || controller.signal };

  try {
    for (const base of baseCandidates) {
      try {
        console.log(`[API] Fetching: ${base}${path}`);
        const response = await fetch(`${base}${path}`, mergedOptions);
        console.log(`[API] Response status for ${path}: ${response.status}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[API] Error response body: ${errorText}`);
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`[API] Success: ${path}`, data);
        clearTimeout(timeoutId);
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`[API] Base failed (${base}):`, error?.message || error);
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  console.error(`[API] Fetch failed for ${path}:`, lastError);
  throw lastError;
}
}

async function loadOverview() {
  if (typeof UIOrchestrationModule?.loadOverview === "function") {
    try {
      await UIOrchestrationModule.loadOverview({
        elements,
        API_BASE,
        apiFetch,
        setApiStatus,
        formatNumber,
        state
      });
      return;
    } catch (moduleError) {
      console.warn("UI orchestration module loadOverview failed, using fallback in app.js:", moduleError);
    }
  }

  elements.apiBase.textContent = API_BASE;
  try {
    console.log("[DASHBOARD] Loading overview...");
    const [health, facilities, vessels, ocean] = await Promise.all([
      apiFetch("/health"),
      apiFetch("/api/facilities?limit=1"),
      apiFetch("/api/vessels?limit=1"),
      apiFetch("/api/ocean/summary"),
    ]);

    console.log("[DASHBOARD] All data loaded successfully");
    const statusOk = health.status === "healthy";
    setApiStatus(statusOk, statusOk ? "Healthy" : "Degraded", health.datasources || {});
    elements.healthStatus.textContent = statusOk ? "Healthy" : "Degraded";
    elements.healthMeta.textContent = Object.values(health.datasources).join(" | ");

    elements.facilityTotal.textContent = formatNumber(facilities.total || facilities.count);
    elements.vesselTotal.textContent = formatNumber(vessels.total || vessels.count);
    if (elements.vesselMeta) {
      const source = vessels.source || "unknown";
      const sourceLabel = source === "barentswatch_ais"
        ? "AIS (BarentsWatch)"
        : (source === "confirmed_plans_fallback" ? "Fallback (confirmed plans)" : source);
      const errorText = vessels.error ? ` Â· ${vessels.error}` : "";
      elements.vesselMeta.textContent = `Source: ${sourceLabel}${errorText}`;
    }

    const coverage = ocean?.coverage
      ? `Lat ${ocean.coverage.lat_min} - ${ocean.coverage.lat_max}`
      : "Barentshavet";
    elements.oceanCoverage.textContent = coverage;

    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("en-GB");
    elements.dataFreshness.textContent = `Last check: ${date} ${time}`;

    state.loaded.overview = true;
  } catch (error) {
    console.error("[DASHBOARD] Error loading overview:", error);
    setApiStatus(false, "Offline", {});
    elements.healthStatus.textContent = "Offline";
    elements.healthMeta.textContent = error.message;
    elements.dataFreshness.textContent = "Last check: --";
  }
}

function setupTabs() {
  if (typeof UIOrchestrationModule?.setupTabs === "function") {
    try {
      UIOrchestrationModule.setupTabs({
        documentRef: document,
        state,
        loadAdmin,
        loadCriticalAlerts,
        loadRisk,
        loadPredictions,
        loadSmittespredning,
        loadFacilityRisk,
        loadVesselRisk,
        loadVesselClearing,
        loadConfirmedPlans,
        loadAuditLog,
        loadFacilities,
        loadVessels,
        loadHealth,
        loadOcean
      });
      return;
    } catch (moduleError) {
      console.warn("UI orchestration module setupTabs failed, using fallback in app.js:", moduleError);
    }
  }

  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");

  const activateTab = (tabName) => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    const selected = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (selected) selected.classList.add("active");
    const target = document.getElementById(tabName);
    if (target) target.classList.add("active");

    if (!state.loaded[tabName]) {
      if (tabName === "admin") {
        loadAdmin();
        loadCriticalAlerts();
      }
      if (tabName === "risk") loadRisk();
      if (tabName === "predictions") loadPredictions();
      if (tabName === "smittespredning") loadSmittespredning();
      if (tabName === "facility-risks") loadFacilityRisk();
      if (tabName === "vessel-risk") loadVesselRisk();
      if (tabName === "vessel-clearing") loadVesselClearing();
      if (tabName === "confirmed-plans") loadConfirmedPlans();
      if (tabName === "audit-log") loadAuditLog();
      if (tabName === "facilities") loadFacilities();
      if (tabName === "vessels") loadVessels();
      if (tabName === "health") loadHealth();
      if (tabName === "ocean") loadOcean();
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    if (!button.classList.contains("tab")) {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    }
  });
}

// Global function to switch tabs from anywhere in the app
function switchTab(tabName) {
  if (typeof UIOrchestrationModule?.switchTab === "function") {
    try {
      UIOrchestrationModule.switchTab(tabName, {
        documentRef: document,
        state,
        loadAdmin,
        loadCriticalAlerts,
        loadRisk,
        loadPredictions,
        loadSmittespredning,
        loadFacilityRisk,
        loadVesselRisk,
        loadVesselClearing,
        loadConfirmedPlans,
        loadAuditLog,
        loadFacilities,
        loadVessels,
        loadHealth,
        loadOcean
      });
      return;
    } catch (moduleError) {
      console.warn("UI orchestration module switchTab failed, using fallback in app.js:", moduleError);
    }
  }

  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (tab) {
    tab.click();
    return;
  }

  const targetPanel = document.getElementById(tabName);
  if (!targetPanel) return;

  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  targetPanel.classList.add("active");

  if (!state.loaded[tabName]) {
    if (tabName === "admin") {
      loadAdmin();
      loadCriticalAlerts();
    }
    if (tabName === "risk") loadRisk();
    if (tabName === "predictions") loadPredictions();
    if (tabName === "smittespredning") loadSmittespredning();
    if (tabName === "facility-risks") loadFacilityRisk();
    if (tabName === "vessel-risk") loadVesselRisk();
    if (tabName === "vessel-clearing") loadVesselClearing();
    if (tabName === "confirmed-plans") loadConfirmedPlans();
    if (tabName === "audit-log") loadAuditLog();
    if (tabName === "facilities") loadFacilities();
    if (tabName === "vessels") loadVessels();
    if (tabName === "health") loadHealth();
    if (tabName === "ocean") loadOcean();
  }
}

function setMiniCards(container, items) {
  if (typeof UIOrchestrationModule?.setMiniCards === "function") {
    try {
      UIOrchestrationModule.setMiniCards(container, items);
      return;
    } catch (moduleError) {
      console.warn("UI orchestration module setMiniCards failed, using fallback in app.js:", moduleError);
    }
  }

  container.innerHTML = items
    .map(
      (item) => `
      <div class="mini-card">
        <div>${item.label}</div>
        <strong>${item.value}</strong>
        <div class="muted">${item.meta || ""}</div>
      </div>
    `
    )
    .join("");
}

async function loadRisk() {
  if (typeof AdminCoreModule?.loadRisk === "function") {
    try {
      await AdminCoreModule.loadRisk({
        getById,
        elements,
        apiFetch,
        state,
        renderRisk
      });
      return;
    } catch (moduleError) {
      console.warn("Admin core module loadRisk failed, using fallback in app.js:", moduleError);
    }
  }

  const limit = Number((getById("riskLimit", "risk-limit")?.value) || 80);
  elements.riskGrid.innerHTML = "Loading risk assessment...";

  try {
    const data = await apiFetch(`/api/risk/assess?limit=${limit}`);
    state.risk = data.assessments || [];
    renderRisk();
    state.loaded.risk = true;
  } catch (error) {
    elements.riskGrid.innerHTML = `Error: ${error.message}`;
  }
}

async function loadFacilityRisk() {
  // Try module first
  if (typeof AdminFacilityRiskModule?.loadFacilityRisk === "function") {
    try {
      await AdminFacilityRiskModule.loadFacilityRisk({
        state,
        elements,
        apiFetch,
        formatNumber,
        populateDiseaseFilters,
        renderFacilityRisk
      });
      return;
    } catch (moduleError) {
      console.warn("Facility risk module load failed, using fallback in app.js:", moduleError);
    }
  }

  // Fallback implementation
  elements.facilityRiskList.innerHTML = "Loading facility disease risk data...";

  try {
    const data = await apiFetch("/api/facilities/disease-spread");
    state.facilityRisk = data.all_at_risk_facilities || [];
    state.facilityRiskSummary = {
      ekstrem: data.risk_summary?.ekstrem || 0,
      hÃ¸y: data.risk_summary?.hÃ¸y || 0,
      moderat: data.risk_summary?.moderat || 0,
      lav: data.risk_summary?.lav || 0,
      total: data.facilities_at_disease_risk || 0
    };
    
    elements.facilityRiskEkstremCount.textContent = formatNumber(data.risk_summary?.ekstrem || 0);
    elements.facilityRiskHÃ¸yCount.textContent = formatNumber(data.risk_summary?.hÃ¸y || 0);
    elements.facilityRiskModeratCount.textContent = formatNumber(data.risk_summary?.moderat || 0);
    elements.facilityRiskLavCount.textContent = formatNumber(data.risk_summary?.lav || 0);
    elements.facilityRiskTotalCount.textContent = formatNumber(data.facilities_at_disease_risk || 0);
    
    populateDiseaseFilters();
    renderFacilityRisk();
    state.loaded.facilityRisk = true;
    state.loaded["facility-risks"] = true;
    if (window.updateInsightsPanel) window.updateInsightsPanel();
  } catch (error) {
    elements.facilityRiskList.innerHTML = `Error: ${error.message}`;
  }
}

async function loadPredictions() {
  if (typeof predictionsModule.loadPredictions === "function") {
    try {
      await predictionsModule.loadPredictions({
        state,
        elements,
        apiFetch,
        formatNumber,
        renderPredictions: predictionsModule.renderPredictions,
        formatRiskDrivers,
        attachRiskFactorHandlers,
      });
      return;
    } catch (moduleError) {
      console.warn("Predictions module load failed, using fallback in app.js:", moduleError);
    }
  }

  if (elements.predictionsLoad) {
    elements.predictionsLoadText.style.display = "none";
    elements.predictionsLoadSpinner.style.display = "inline";
  }

  try {
    // First try the new outbreak risk endpoint for real data
    let data = null;
    try {
      data = await apiFetch("/api/risk/outbreak-risk-at-healthy-facilities");
      if (data && data.healthy_at_risk && Array.isArray(data.healthy_at_risk)) {
        // Convert outbreak risk format to predictions format
        state.predictions = data.healthy_at_risk.map(facility => ({
          facility_name: facility.facility_name,
          facility_code: facility.facility_code || "--",
          latitude: facility.latitude,
          longitude: facility.longitude,
          risk_score: facility.risk_score,
          is_at_risk: facility.is_at_risk !== undefined ? facility.is_at_risk : (facility.risk_score > 0),
          risk_level: facility.risk_level,
          distance_contribution: facility.distance_contribution || 0,
          boat_vector_contribution: facility.boat_vector_contribution || 0,
          ocean_current_contribution: facility.ocean_current_contribution || 0,
          disease_contribution: facility.disease_contribution || 0,
          official_zone_contribution: facility.official_zone_contribution || 0,
          primary_disease: facility.primary_disease || 'ILA/PD',
          source_facility_name: facility.source_facility_name || facility.most_likely_source_name || null,
          source_facility_code: facility.source_facility_code || null,
          nearby_sources: facility.nearby_sources || [],
          num_nearby_sources: facility.num_nearby_sources || 0,
          cluster_multiplier: facility.cluster_multiplier || 1.0,
          source_latitude: facility.source_latitude || facility.most_likely_source_lat || null,
          source_longitude: facility.source_longitude || facility.most_likely_source_lon || null,
          confidence_level: facility.risk_level === 'Critical' ? 'High' : facility.risk_level === 'Medium' ? 'Medium' : 'Low',
          confidence_score: facility.risk_score <= 100 ? facility.risk_score / 100 : 0.7,
          outbreak_risk_pct: facility.risk_score,
          trend_7d: 'stable',
          in_official_zone: facility.in_official_zone || false,
          official_zone_status: facility.official_zone_status || null,
          facility_zone_type: facility.facility_zone_type || null,
          distance_to_nearest_infected: facility.distance_to_source_km || null,
          distance_to_source_km: facility.distance_to_source_km || null
        }));
        
        state.predictionsSummary = data.summary || { critical: 0, medium: 0, low: 0, total: 0 };
        console.log('âœ“ Loaded outbreak risk from new endpoint');
      }
    } catch (newEndpointError) {
      console.warn('New endpoint not available, trying legacy predictions endpoint...');
    }

    // Fallback to legacy predictions endpoint if new endpoint failed
    if (!data || !state.predictions || state.predictions.length === 0) {
      data = await apiFetch("/api/risk/predictions/all");
      
      if (!data.summary?.total_facilities || data.summary.total_facilities === 0) {
        console.warn("No real predictions found. Demo data fallback is disabled.");
      }
      
      state.predictions = data.top_20_by_risk || [];
      state.predictionsSummary = data.summary || { critical: 0, medium: 0, low: 0, total_facilities: 0 };
    }
    
    // Update summary cards
    // Count at-risk facilities (Critical + Medium combined)
    const atRiskCount = (state.predictionsSummary.critical || 0) + (state.predictionsSummary.medium || 0);
    if (elements.predictionsAtRisk) {
      elements.predictionsAtRisk.textContent = formatNumber(atRiskCount);
    }
    elements.predictionsTotal.textContent = formatNumber(state.predictionsSummary.total_facilities || state.predictionsSummary.total);
    
    // Count protection and surveillance zones
    const protectionCount = state.predictions.filter(p => {
      const hasProtection = p.official_zone_status?.zone_type === 'PROTECTION';
      return hasProtection;
    }).length;
    const surveillanceCount = state.predictions.filter(p => {
      const hasSurveillance = p.official_zone_status?.zone_type === 'SURVEILLANCE';
      return hasSurveillance;
    }).length;
    
    // Count facilities within 10km (distance_contribution >= 30 = within 10km likely)
    // Include all facilities with proximity risk, even if in official zones
    const within10kmCount = state.predictions.filter(p => {
        // Distance >= 30pts = within 10km (distance_score 30-50 for 5-15km range)
        return (p.distance_contribution || 0) >= 30;
    }).length;
    
    console.log(`ðŸ”´ PROTECTION zones: ${protectionCount} (filtering for zone_type === 'PROTECTION')`);
    console.log(`ðŸŸ  SURVEILLANCE zones: ${surveillanceCount} (filtering for zone_type === 'SURVEILLANCE')`);
    console.log(`ðŸŸ¡ WITHIN 10KM zones: ${within10kmCount} (facilities with distance_contribution >= 30)`);
    
    // Log first 5 facilities with their facility_codes and official_zone_status
    console.log('ðŸ” First 5 facilities with codes:');
    state.predictions.slice(0, 5).forEach((p, idx) => {
      console.log(`  [${idx}] Code: ${p.facility_code}, Zone: ${p.official_zone_status?.zone_type || 'none'}, Distance: ${p.distance_contribution || 0}, Full zone obj:`, p.official_zone_status);
    });
    
    console.log('Sample prediction with zone data:', state.predictions.find(p => p.official_zone_status) || 'No official_zone_status found');
    
    elements.predictionsProtection.textContent = formatNumber(protectionCount);
    elements.predictionsSurveillance.textContent = formatNumber(surveillanceCount);
    if (elements.predictions10km) {
      elements.predictions10km.textContent = formatNumber(within10kmCount);
    }
    
    // Update timestamp
    if (data.summary?.timestamp) {
      const date = new Date(data.summary.timestamp);
      elements.predictionsLastUpdate.textContent = `Last update: ${date.toLocaleTimeString()}`;
    }
    
    // Render predictions table
    renderPredictions();
    state.loaded.predictions = true;
    if (window.updateInsightsPanel) window.updateInsightsPanel();
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

function renderPredictions() {
  if (typeof predictionsModule.renderPredictions === "function") {
    try {
      predictionsModule.renderPredictions({
        state,
        elements,
        formatRiskDrivers,
        attachRiskFactorHandlers,
      });
      return;
    } catch (moduleError) {
      console.warn("Predictions module render failed, using fallback in app.js:", moduleError);
    }
  }

  if (!elements.predictionsTable) return;
  
  // Apply filters
  let filteredPredictions = state.predictions;
  
  // Filter by risk score if showAllPredictions is false
  if (!state.filters.showAllPredictions) {
    filteredPredictions = filteredPredictions.filter(p => p.is_at_risk);
  }
  
  // Filter by zone type
  if (state.filters.showOnlyProtectionZones) {
    filteredPredictions = filteredPredictions.filter(p => 
      p.official_zone_status?.zone_type === 'PROTECTION'
    );
  } else if (state.filters.showOnlySurveillanceZones) {
    filteredPredictions = filteredPredictions.filter(p => 
      p.official_zone_status?.zone_type === 'SURVEILLANCE'
    );
  } else if (state.filters.showOnlyWithin10km) {
    // Within 10km: distance contribution >= 30 (facilities within ~10km range)
    filteredPredictions = filteredPredictions.filter(p => 
      (p.distance_contribution || 0) >= 30
    );
  }
  
  elements.predictionsTable.innerHTML = filteredPredictions.map((pred, idx) => {
    const riskColor = pred.risk_level === "Critical" ? "#ef4444" : 
                      pred.risk_level === "Medium" ? "#eab308" : "#22c55e";
    const driversText = formatRiskDrivers(pred.risk_drivers);
    
    // Confidence level badge
    const confidenceBg = pred.confidence_level === "High" ? "#10b981" : 
                        pred.confidence_level === "Medium" ? "#f59e0b" : "#ef4444";
    const confScore = pred.confidence_score !== undefined ? (pred.confidence_score * 100).toFixed(0) : "?";
    const confidenceBadge = `<span style="background: ${confidenceBg}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: 500;">${pred.confidence_level || "Unknown"} (${confScore}%)</span>`;
    
    // Trend arrow
    let trendArrow = "";
    let trendColor = "#6b7280";
    if (pred.trend_7d === "increasing") {
      trendArrow = `â†‘ +${pred.trend_pct?.toFixed(1) || "?"}%`;
      trendColor = "#ef4444";
    } else if (pred.trend_7d === "decreasing") {
      trendArrow = `â†“ ${pred.trend_pct?.toFixed(1) || "?"}%`;
      trendColor = "#22c55e";
    } else if (pred.trend_7d === "stable") {
      trendArrow = "â†’ stable";
      trendColor = "#eab308";
    }
    
    // Official zone status badge
    let officialStatusBadge = `<span style="color: #6b7280; font-size: 0.8rem;">â€”</span>`;
    let zoneTextLabel = `<span style="color: #9ca3af; font-size: 0.8rem;">Ingen</span>`;
    if (pred.official_zone_status && pred.official_zone_status.in_official_zone) {
      const ozs = pred.official_zone_status;
      let badgeColor = "#6b7280";
      let badgeText = "Unknown";
      let icon = "âš ï¸";
      
      if (ozs.zone_type === "DISEASED") {
        badgeColor = "#dc2626"; // Red
        badgeText = `ðŸ¦  ${ozs.disease}`;
        icon = "ðŸ”´";
        zoneTextLabel = `<span style="color: #dc2626; font-size: 0.8rem; font-weight: 700;">DISEASED</span>`;
      } else if (ozs.zone_type === "PROTECTION") {
        badgeColor = "#dc2626"; // Red
        badgeText = `${ozs.disease} Protection`;
        icon = "ðŸ”´";
        zoneTextLabel = `<span style="color: #dc2626; font-size: 0.8rem; font-weight: 700;">PROTECTION</span>`;
      } else if (ozs.zone_type === "SURVEILLANCE") {
        badgeColor = "#f97316"; // Orange
        badgeText = `${ozs.disease} Surveillance`;
        icon = "ðŸŸ ";
        zoneTextLabel = `<span style="color: #f97316; font-size: 0.8rem; font-weight: 700;">SURVEILLANCE</span>`;
      }
      
      officialStatusBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: 600; display: inline-block;">${icon} ${badgeText}</span>`;
    }
    
    // Source facility info - use nearby sources if available
    let sourceInfo = "No source threat";
    if (pred.nearby_sources && pred.nearby_sources.length > 0) {
      if (pred.nearby_sources.length === 1) {
        const primarySource = pred.nearby_sources[0];
        sourceInfo = `ðŸ“ From: ${primarySource.name} (${primarySource.latitude?.toFixed(2)}, ${primarySource.longitude?.toFixed(2)})`;
      } else if (pred.nearby_sources.length <= 3) {
        // Show all sources if 2-3
        const sourceList = pred.nearby_sources.map(s => `<span style="color: #dc2626; font-weight: 600;">${s.name}</span>`).join(", ");
        sourceInfo = `ðŸ“ From: ${sourceList} <span style="color: #f59e0b;">(${pred.nearby_sources.length} kilder)</span>`;
      } else {
        // Show first 2 and count
        const first = pred.nearby_sources[0];
        const second = pred.nearby_sources[1];
        const others = pred.nearby_sources.length - 2;
        sourceInfo = `ðŸ“ From: <span style="color: #dc2626; font-weight: 600;">${first.name}</span>, <span style="color: #dc2626; font-weight: 600;">${second.name}</span> <span style="color: #f59e0b;">(og ${others} andre)</span>`;
      }
    } else if (pred.source_facility_name) {
      sourceInfo = `ðŸ“ From: ${pred.source_facility_name}`;
    }
    
    const facilityCoords = `ðŸŽ¯ Facility: (${pred.latitude?.toFixed(2)}, ${pred.longitude?.toFixed(2)})`;
    
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
            <button class="transmission-source-btn" data-pred-index="${idx}" style="background: #d946ef; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">ðŸ§¬ Sources</button>
            <button class="risk-link-btn" data-facility="${pred.facility_code}" onclick="switchTab('facility-risks'); setTimeout(() => document.querySelector('[data-facility-search]')?.focus(), 100);" style="background: #3b82f6; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">ðŸ“Š Facility Risk</button>
            <button class="risk-link-btn" data-vessel-code="${pred.facility_code}" onclick="switchTab('vessel-risk'); setTimeout(() => document.querySelector('[data-vessel-search]')?.focus(), 100);" style="background: #8b5cf6; color: white; border: none; padding: 3px 8px; font-size: 0.7rem; border-radius: 3px; cursor: pointer; transition: all 0.2s;">ðŸš¢ Vessel Risk</button>
          </div>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="8" style="text-align: center; color: #9ca3af;">No predictions available</td></tr>`;

  attachRiskFactorHandlers();
}

async function loadVesselRisk() {
  if (typeof vesselRiskModule.loadVesselRisk === "function") {
    try {
      await vesselRiskModule.loadVesselRisk({
        state,
        elements,
        apiFetch,
        formatNumber,
        renderVesselRisk: vesselRiskModule.renderVesselRisk,
        showVesselDetail,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel risk module load failed, using fallback in app.js:", moduleError);
    }
  }

  // Show loading in table - keep table structure intact
  setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>Loading vessel disease risk data...</td></tr>");

  try {
    const data = await apiFetch("/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7");
    state.vesselRisk = data.vessels || [];
    
    // Use API summary counts (API returns ekstrem_risk_vessels, hÃ¸y_risk_vessels, moderat_risk_vessels)
    const ekstremCount = data.ekstrem_risk_vessels || 0;
    const hÃ¸yCount = data.hÃ¸y_risk_vessels || 0;
    const moderatCount = data.moderat_risk_vessels || 0;
    const infectedVisits = state.vesselRisk.filter(v => v.visited_infected).length;
    const chainCount = state.vesselRisk.filter(v => v.has_48h_chain).length;
    
    state.vesselRiskSummary = {
      infected: infectedVisits,
      high: ekstremCount + hÃ¸yCount,
      moderate: moderatCount,
      chain: chainCount,
      total: state.vesselRisk.length
    };
    
    elements.vesselRiskInfectedCount.textContent = formatNumber(infectedVisits);
    elements.vesselRiskHighCount.textContent = formatNumber(ekstremCount + hÃ¸yCount);
    elements.vesselRiskChainCount.textContent = formatNumber(chainCount);
    elements.vesselRiskTotalCount.textContent = formatNumber(state.vesselRisk.length);
    
    renderVesselRisk();
    state.loaded.vesselRisk = true;
    state.loaded["vessel-risk"] = true;
    if (window.updateInsightsPanel) window.updateInsightsPanel();
  } catch (error) {
    setVesselRiskHtml(`<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--danger);'>Error: ${error.message}</td></tr>`);
  }
}

async function loadVesselClearing() {
  if (typeof vesselOpsModule.loadVesselClearing === "function") {
    try {
      await vesselOpsModule.loadVesselClearing({
        state,
        elements,
        apiFetch,
        formatNumber,
        renderVesselClearing: vesselOpsModule.renderVesselClearing,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel ops module loadVesselClearing failed, using fallback in app.js:", moduleError);
    }
  }

  elements.vesselClearingList.innerHTML = "Loading vessel clearing data...";

  try {
    // Fetch vessel clearing status from the new /api/vessel/clearing-status endpoint
    const data = await apiFetch("/api/vessel/clearing-status");
    
    state.vesselClearing = data.vessels || [];
    
    // Calculate summary
    const summary = data.summary || { cleared: 0, pending: 0, atRisk: 0, total: 0 };
    
    elements.vesselClearedCount.textContent = formatNumber(summary.cleared || 0);
    elements.vesselPendingCount.textContent = formatNumber(summary.pending || 0);
    elements.vesselAtRiskCount.textContent = formatNumber(summary["at-risk"] || 0);
    elements.vesselClearingTotalCount.textContent = formatNumber(summary.total || 0);
    
    renderVesselClearing();
    state.loaded.vesselClearing = true;
    state.loaded["vessel-clearing"] = true;
    if (window.updateInsightsPanel) window.updateInsightsPanel();
  } catch (error) {
    elements.vesselClearingList.innerHTML = `Error: ${error.message}`;
    console.error("Error loading vessel clearing:", error);
  }
}

async function loadConfirmedPlans() {
  if (typeof vesselOpsModule.loadConfirmedPlans === "function") {
    try {
      await vesselOpsModule.loadConfirmedPlans({
        state,
        elements,
        apiFetch,
        formatNumber,
        renderConfirmedPlans: vesselOpsModule.renderConfirmedPlans,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel ops module loadConfirmedPlans failed, using fallback in app.js:", moduleError);
    }
  }

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
    renderConfirmedPlans();
    state.loaded["confirmed-plans"] = true;
  } catch (error) {
    elements.confirmedPlansList.innerHTML = `Error: ${error.message}`;
  }
}

function renderConfirmedPlans() {
  if (typeof vesselOpsModule.renderConfirmedPlans === "function") {
    try {
      vesselOpsModule.renderConfirmedPlans({
        state,
        elements,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel ops module renderConfirmedPlans failed, using fallback in app.js:", moduleError);
    }
  }

  if (!elements.confirmedPlansList) return;
  if (!state.confirmedPlans.length) {
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
          <div class="list-meta">Plan ID: ${plan.plan_id || "--"} Â· Confirmed: ${confirmedAt}</div>
          <div class="list-meta">Days: ${routeDays} Â· Facilities: ${facilityCount}</div>
          <div class="list-meta">Position: ${posText} Â· Source: ${plan.position_source || "--"}</div>
        </div>
      `;
    })
    .join("");
}

// Load and display audit log
async function loadAuditLog() {
  if (typeof auditModule.loadAuditLog === "function") {
    try {
      await auditModule.loadAuditLog({
        state,
        apiFetch,
        getById,
        renderAuditLog: auditModule.renderAuditLog,
      });
      return;
    } catch (moduleError) {
      console.warn("Audit module load failed, using fallback in app.js:", moduleError);
    }
  }

  const mmsi = (getById("auditMmsiFilter", "audit-mmsi")?.value || "").trim();
  const days = getById("auditDaysFilter", "audit-days")?.value || "30";
  const query = `?days=${days}${mmsi ? "&mmsi=" + encodeURIComponent(mmsi) : ""}`;
  
  try {
    const data = await apiFetch(`/api/audit/visits-log${query}`);
    state.auditLog = data.entries || [];
    
    // Calculate statistics
    const totalCount = state.auditLog.length;
    const withPassCount = state.auditLog.filter(e => e.had_health_pass === true).length;
    const warningIgnoredCount = state.auditLog.filter(e => e.acknowledged_warning === true).length;
    const disinfectionCount = state.auditLog.filter(e => e.disinfection === true).length;
    
    // Update summary cards
    if (document.getElementById("auditTotalCount")) 
      document.getElementById("auditTotalCount").textContent = totalCount;
    if (document.getElementById("auditWithPassCount")) 
      document.getElementById("auditWithPassCount").textContent = withPassCount;
    if (document.getElementById("auditWarningIgnoredCount")) 
      document.getElementById("auditWarningIgnoredCount").textContent = warningIgnoredCount;
    if (document.getElementById("auditDisinfectionCount")) 
      document.getElementById("auditDisinfectionCount").textContent = disinfectionCount;
    if (document.getElementById("auditLastUpdated"))
      document.getElementById("auditLastUpdated").textContent = new Date().toLocaleTimeString("no-NO");
    
    renderAuditLog();
    state.loaded["audit-log"] = true;
  } catch (error) {
    console.error("Failed to load audit log:", error);
    const tbody = getById("auditLogBody", "audit-table");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
    }
  }
}

// Render audit log table
function renderAuditLog() {
  if (typeof auditModule.renderAuditLog === "function") {
    try {
      auditModule.renderAuditLog({
        state,
        getById,
      });
      return;
    } catch (moduleError) {
      console.warn("Audit module render failed, using fallback in app.js:", moduleError);
    }
  }

  const tbody = getById("auditLogBody", "audit-table");
  if (!tbody) return;
  
  if (!state.auditLog.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #9ca3af;">No audit entries found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = state.auditLog.map(entry => {
    const visitDate = entry.visit_date ? new Date(entry.visit_date).toLocaleDateString("no-NO") : "--";
    const boatName = entry.vessel_name || "--";
    const mmsi = entry.mmsi || "--";
    const facility = entry.facility_name || "--";
    const diseaseTypes = Array.isArray(entry.disease_types)
      ? entry.disease_types
      : (entry.disease_types ? [entry.disease_types] : []);
    const diseaseText = diseaseTypes.length ? diseaseTypes.join(', ') : '--';
    
    // Health pass status badge
    let healthPassBadge = "â“ Unknown";
    if (entry.had_health_pass === true) {
      healthPassBadge = "âœ… Active";
    } else if (entry.had_health_pass === false && entry.acknowledged_warning === true) {
      healthPassBadge = "âš ï¸ Ignored";
    } else if (entry.had_health_pass === false) {
      healthPassBadge = "ðŸ”´ None";
    }
    
    const disinfectionBadge = entry.disinfection ? "âœ“ Yes" : "--";
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
  }).join("");
}

function getVesselClearingDataFromDashboard() {
  try {
    // Try to read calendar events from sessionStorage/localStorage key that vessel dashboard uses
    const calendarEventsStr = localStorage.getItem('calendarEvents');
    if (!calendarEventsStr) {
      return [];
    }
    
    const allEvents = JSON.parse(calendarEventsStr);
    
    // Group events by vessel (we'll use a generic "Vessel" name for now, but in production
    // this would come from the actual vessel tracking data)
    const vesselMap = {};
    
    allEvents.forEach(event => {
      // Create a vessel entry for tracking clearing status
      const vesselKey = "Monitored Vessel"; // In production, get actual vessel name from context
      
      if (!vesselMap[vesselKey]) {
        vesselMap[vesselKey] = {
          name: vesselKey,
          mmsi: "Unknown",
          visits: [],
          disinfections: [],
          quarantines: [],
          status: "cleared",
          lastAction: null,
          diseases: []
        };
      }
      
      const vessel = vesselMap[vesselKey];
      
      if (event.type === 'visit') {
        vessel.visits.push({
          facility: event.details,
          date: event.date,
          infected: event.infected,
          proximityRisk: event.proximityRisk,
          diseases: event.diseases || []
        });
        
        // Collect diseases
        if (event.infected || event.proximityRisk) {
          (event.diseases || []).forEach(disease => {
            if (disease && !vessel.diseases.includes(disease)) {
              vessel.diseases.push(disease);
            }
          });
          (event.nearbyDiseases || []).forEach(disease => {
            if (disease && !vessel.diseases.includes(disease)) {
              vessel.diseases.push(disease);
            }
          });
        }
        
        // Update status based on visit
        if (event.infected && !event.completed) {
          vessel.status = 'at-risk';
        } else if (event.proximityRisk && !event.completed) {
          vessel.status = 'at-risk';
        }
      } else if (event.type === 'disinfection') {
        vessel.disinfections.push({
          date: event.date,
          chemical: event.chemical || 'Unknown',
          completed: event.completed === true,
          description: event.description
        });
        
        if (event.completed) {
          vessel.lastAction = {
            type: 'disinfection',
            date: event.completedAt || event.date,
            detail: event.chemical
          };
        } else {
          vessel.status = 'pending';
        }
      } else if (event.type === 'quarantine') {
        vessel.quarantines.push({
          startDate: event.date,
          endDate: event.dateEnd,
          duration: event.duration || 48,
          completed: event.completed === true,
          attestation: event.attestation
        });
        
        if (event.completed) {
          vessel.status = 'cleared';
        } else if (vessel.status !== 'at-risk') {
          vessel.status = 'pending';
        }
      }
    });
    
    // Convert map to array
    return Object.values(vesselMap);
  } catch (err) {
    console.error("Error parsing vessel clearing data:", err);
    return [];
  }
}

function renderVesselClearing() {
  if (typeof vesselOpsModule.renderVesselClearing === "function") {
    try {
      vesselOpsModule.renderVesselClearing({
        state,
        elements,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel ops module renderVesselClearing failed, using fallback in app.js:", moduleError);
    }
  }

  const statusFilter = elements.vesselStatusFilter.value;
  const searchTerm = (elements.vesselClearingSearch.value || '').toLowerCase();
  
  let filtered = state.vesselClearing;
  
  if (statusFilter !== 'all') {
    filtered = filtered.filter(v => v.status === statusFilter);
  }
  
  if (searchTerm) {
    filtered = filtered.filter(v => 
      v.name.toLowerCase().includes(searchTerm) || 
      (v.mmsi && v.mmsi.toLowerCase().includes(searchTerm)));
  }
  
  if (filtered.length === 0) {
    elements.vesselClearingList.innerHTML = '<div style="padding: 2rem; text-align: center; color: #6b7280;">No vessels found matching criteria.</div>';
    return;
  }
  
  elements.vesselClearingList.innerHTML = filtered.map(vessel => {
    const statusIcon = vessel.status === 'cleared' ? 'âœ“' : (vessel.status === 'pending' ? 'â³' : 'ðŸ”´');
    const statusColor = vessel.status === 'cleared' ? '#10b981' : (vessel.status === 'pending' ? '#f59e0b' : '#ef4444');
    const statusText = vessel.status === 'cleared' ? 'CLEARED' : (vessel.status === 'pending' ? 'PENDING' : 'AT RISK');
    
    const quarantineText = vessel.status === 'pending' && vessel.quarantine_hours_remaining > 0
      ? `${vessel.quarantine_hours_remaining}h remaining`
      : '';
    
    const lastVisitText = vessel.last_infected_visit 
      ? `${vessel.last_infected_visit}`
      : 'No infected visits';
    
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
        ${vessel.status === 'cleared' ? `
          <div style="background: #dcfce7; border: 1px solid #86efac; color: #15803d; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            âœ“ BÃ¥ten er godkjent for normal drift ved alle anlegg.
          </div>
        ` : vessel.status === 'pending' ? `
          <div style="background: #fef3c7; border: 1px solid #fde68a; color: #78350f; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            â³ Karantenetid ikke oppfylt. ${quarantineText}
          </div>
        ` : `
          <div style="background: #fee2e2; border: 1px solid #fecaca; color: #7f1d1d; padding: 0.75rem; border-radius: 0.25rem; font-size: 0.9rem;">
            ðŸ”´ BÃ¥ten har besÃ¸kt smittet anlegg og er merket for risikotilsyn.
          </div>
        `}
      </div>
    `;
  }).join('');
}

// Store correlation data globally for use across functions
let correlationData = null;
let networkGraph = null;
let selectedNodeId = null;
let highlightedNodes = new Set();
let highlightedEdges = new Set();

// Modal functions
function showModal(modalId) {
  if (typeof modalHelpersModule.showModal === "function") {
    try {
      return modalHelpersModule.showModal(modalId, { documentRef: document });
    } catch (moduleError) {
      console.warn("Modal helpers module showModal failed, using fallback in app.js:", moduleError);
    }
  }

  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = "flex";
}

function closeModal(modalId) {
  if (typeof modalHelpersModule.closeModal === "function") {
    try {
      return modalHelpersModule.closeModal(modalId, { documentRef: document });
    } catch (moduleError) {
      console.warn("Modal helpers module closeModal failed, using fallback in app.js:", moduleError);
    }
  }

  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = "none";
}

function showIsolateModal() {
  if (typeof modalHelpersModule.showIsolateModal === "function") {
    try {
      modalHelpersModule.showIsolateModal({
        documentRef: document,
        getCorrelationData: () => correlationData,
        showModalFn: showModal,
      });
      return;
    } catch (moduleError) {
      console.warn("Modal helpers module showIsolateModal failed, using fallback in app.js:", moduleError);
    }
  }

  document.getElementById("isolateCount").textContent = correlationData?.summary?.high_risk_boats || 0;
  showModal("isolateModal");
}

function showApproveModal() {
  if (typeof modalHelpersModule.showApproveModal === "function") {
    try {
      modalHelpersModule.showApproveModal({
        showModalFn: showModal,
      });
      return;
    } catch (moduleError) {
      console.warn("Modal helpers module showApproveModal failed, using fallback in app.js:", moduleError);
    }
  }

  showModal("approveModal");
}

function ensureCorrelationDetailModal() {
  if (typeof correlationDetailModule.ensureCorrelationDetailModal === "function") {
    try {
      return correlationDetailModule.ensureCorrelationDetailModal({
        documentRef: document,
        closeModal,
        alertFn: alert,
      });
    } catch (moduleError) {
      console.warn("Correlation detail module ensureCorrelationDetailModal failed, using fallback in app.js:", moduleError);
    }
  }

  let modal = document.getElementById("correlationDetailModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "correlationDetailModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px;";
  modal.innerHTML = `
    <div style="width:min(760px, 96vw);max-height:85vh;overflow:auto;background:#0b1220;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
        <h3 id="detailTitle" style="margin:0;color:#e5e7eb;font-size:1rem;">Correlation Details</h3>
        <button id="detailClose" class="btn" style="background:#374151;color:#fff;">Lukk</button>
      </div>
      <div id="detailContent" style="color:#d1d5db;"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button id="detailNotify" class="btn" style="background:#2563eb;color:#fff;">Notify facility</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#detailClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeModal("correlationDetailModal"));
  }

  const notifyBtn = modal.querySelector("#detailNotify");
  if (notifyBtn) {
    notifyBtn.addEventListener("click", () => {
      const facilityName = modal?.dataset?.facilityName || "Facility";
      const facilityEmail = modal?.dataset?.facilityEmail || "facility@example.com";
      alert(`ðŸ“§ Notify: Simulated email sent to ${facilityName} (${facilityEmail}).`);
      closeModal("correlationDetailModal");
    });
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal("correlationDetailModal");
  });

  return modal;
}

function ensureAdminCorrelationLayout() {
  if (typeof correlationDetailModule.ensureAdminCorrelationLayout === "function") {
    try {
      correlationDetailModule.ensureAdminCorrelationLayout({
        documentRef: document,
      });
      return;
    } catch (moduleError) {
      console.warn("Correlation detail module ensureAdminCorrelationLayout failed, using fallback in app.js:", moduleError);
    }
  }

  const adminData = document.getElementById("admin-data");
  if (!adminData) return;

  const hasLayout = document.getElementById("adminNetworkContainer") &&
    document.getElementById("adminPriorityList") &&
    document.getElementById("adminInfectedList") &&
    document.getElementById("adminAffectedList");

  if (hasLayout) return;

  adminData.innerHTML = `
    <div style="margin-bottom:12px;padding:10px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;color:#9ca3af;font-size:0.88rem;">
      <strong style="color:#e5e7eb;">Forklaring:</strong>
      Nettverket viser koblinger mellom bÃ¥ter og anlegg i smittesoner. Rader med hÃ¸y risiko betyr nylig kontakt eller hÃ¸y sannsynlighet for videre smittespredning.
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Infiserte anlegg</div><div id="correlationInfected" style="color:#e5e7eb;font-weight:700;">0</div></div>
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">HÃ¸y risiko bÃ¥ter</div><div id="correlationHighBoats" style="color:#e5e7eb;font-weight:700;">0</div></div>
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Moderat risiko bÃ¥ter</div><div id="correlationModBoats" style="color:#e5e7eb;font-weight:700;">0</div></div>
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">BerÃ¸rte anlegg</div><div id="correlationAffected" style="color:#e5e7eb;font-weight:700;">0</div></div>
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Totale koblinger</div><div id="correlationLinks" style="color:#e5e7eb;font-weight:700;">0</div></div>
    </div>

    <div id="adminNetworkContainer" style="height:360px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;margin-bottom:12px;"></div>

    <h3 style="color:#e5e7eb;margin:8px 0;">Top prioritet (tabell)</h3>
    <div id="adminPriorityList" style="margin-bottom:14px;"></div>

    <h3 style="color:#e5e7eb;margin:8px 0;">Utbruddsklynger over tid (mÃ¥neder)</h3>
    <div id="adminOutbreakClusters" style="margin-bottom:14px;"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><h3 style="color:#e5e7eb;margin:8px 0;">Infiserte anlegg</h3><div id="adminInfectedList"></div></div>
      <div><h3 style="color:#e5e7eb;margin:8px 0;">Potensielt berÃ¸rte anlegg</h3><div id="adminAffectedList"></div></div>
    </div>
  `;
}

function showCorrelationDetail(link) {
  if (typeof correlationDetailModule.showCorrelationDetail === "function") {
    try {
      correlationDetailModule.showCorrelationDetail(link, {
        documentRef: document,
        showModal,
        closeModal,
        alertFn: alert,
      });
      return;
    } catch (moduleError) {
      console.warn("Correlation detail module showCorrelationDetail failed, using fallback in app.js:", moduleError);
    }
  }

  const modal = ensureCorrelationDetailModal();

  const content = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <div style="font-size: 0.85rem; color: #9ca3af;">VESSEL</div>
        <div style="color: #e5e7eb; font-weight: 600;">${link.vessel_name}</div>
        <div style="color: #d1d5db; font-size: 0.9rem;">MMSI: ${link.vessel_mmsi}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #9ca3af;">FACILITY</div>
        <div style="color: #e5e7eb; font-weight: 600;">${link.facility_name}</div>
        <div style="color: #d1d5db; font-size: 0.9rem;">Code: ${link.facility_code}</div>
      </div>
    </div>
    <div style="padding: 1rem; background: #111827; border-radius: 0.25rem; margin-bottom: 1rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
        <div>
          <div style="color: #9ca3af; margin-bottom: 0.25rem;">Distance</div>
          <div style="color: #e5e7eb; font-weight: 600;">${link.distance_km} km</div>
        </div>
        <div>
          <div style="color: #9ca3af; margin-bottom: 0.25rem;">Risk Level</div>
          <div style="color: ${link.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
            ${link.risk_level === 'HIGH' ? 'ðŸ”´ HIGH RISK' : 'âš ï¸ MODERATE'}
          </div>
        </div>
        <div>
          <div style="color: #9ca3af; margin-bottom: 0.25rem;">Facility Risk</div>
          <div style="color: #e5e7eb; font-weight: 600;">${link.facility_risk_score}</div>
        </div>
        <div>
          <div style="color: #9ca3af; margin-bottom: 0.25rem;">Last Updated</div>
          <div style="color: #e5e7eb; font-weight: 600;">${new Date().toLocaleDateString('no-NO')}</div>
        </div>
      </div>
    </div>
    <div>
      <div style="color: #9ca3af; margin-bottom: 0.5rem; font-size: 0.9rem;">ðŸ“‹ Diseases Detected</div>
      <div style="color: #e5e7eb;">${link.diseases.length > 0 ? link.diseases.join(', ') : 'No diseases detected'}</div>
    </div>
  `;
  
  const titleEl = document.getElementById("detailTitle");
  const contentEl = document.getElementById("detailContent");
  if (titleEl) titleEl.textContent = `${link.vessel_name} â†’ ${link.facility_name}`;
  if (contentEl) contentEl.innerHTML = content;
  
  // Store link data for notify action
  if (modal) {
    modal.dataset.facilityCode = link.facility_code;
    modal.dataset.facilityName = link.facility_name;
    modal.dataset.facilityEmail = `facility_${link.facility_code}@farm.no`;
  }
  
  showModal("correlationDetailModal");
}

function showFacilityDetails(facilityCode) {
  if (typeof correlationDetailModule.showFacilityDetails === "function") {
    try {
      correlationDetailModule.showFacilityDetails(facilityCode, {
        documentRef: document,
        showModal,
        closeModal,
        alertFn: alert,
        getCorrelationData: () => correlationData,
        getFacilityCluster,
        getClusterColor,
      });
      return;
    } catch (moduleError) {
      console.warn("Correlation detail module showFacilityDetails failed, using fallback in app.js:", moduleError);
    }
  }

  // Find all vessels that visited this facility
  const allLinks = correlationData.vessel_facility_links || [];
  const facilityLinks = allLinks.filter(l => l.facility_code === facilityCode);
  
  if (!facilityLinks.length) {
    alert("Ingen data funnet for dette anlegget");
    return;
  }

  const firstLink = facilityLinks[0];
  const cluster = getFacilityCluster(facilityCode);
  
  // Build vessel table
  const vesselRows = facilityLinks.map(link => {
    const riskColor = link.risk_level === "HIGH" ? "#ef4444" : "#f59e0b";
    const diseases = link.diseases && link.diseases.length ? link.diseases.join(", ") : "Ingen";
    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:8px;color:#e5e7eb;">${link.vessel_name || "Unknown"}</td>
        <td style="padding:8px;color:#d1d5db;">${link.vessel_mmsi || "-"}</td>
        <td style="padding:8px;color:${riskColor};font-weight:600;">${link.risk_level || "-"}</td>
        <td style="padding:8px;color:#9ca3af;font-size:0.85rem;">${diseases}</td>
      </tr>
    `;
  }).join("");

  // Build cluster section if in cluster
  const clusterSection = cluster ? `
    <div style="margin-top:16px;padding:12px;background:#111827;border-left:4px solid ${getClusterColor(cluster.cluster_id)};border-radius:6px;">
      <div style="color:${getClusterColor(cluster.cluster_id)};font-weight:700;margin-bottom:8px;">ðŸ”— Klynge #${cluster.cluster_id} - Smittekjede</div>
      <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">
        Dette anlegget er del av en klynge med <strong>${cluster.facility_count} anlegg</strong> koblet over <strong>${cluster.duration_days} dager</strong>.
      </div>
      <div style="color:#9ca3af;font-size:0.8rem;">
        <strong>Anlegg i klyngen:</strong>
      </div>
      ${(cluster.facilities || []).map(f => `
        <div style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="color:#e5e7eb;font-size:0.85rem;">${f.name} <span style="color:#9ca3af;">(${f.code})</span></div>
          <div style="color:#9ca3af;font-size:0.75rem;">${f.vessel_count} bÃ¥ter Â· Siste besÃ¸k: ${new Date(f.last_seen).toLocaleDateString('no-NO')}</div>
        </div>
      `).join("")}
    </div>
  ` : `
    <div style="margin-top:16px;padding:12px;background:#111827;border-radius:6px;color:#10b981;">
      âœ“ Dette anlegget er <strong>ikke</strong> del av en identifisert smitteklynge.
    </div>
  `;

  const modal = ensureCorrelationDetailModal();
  const titleEl = document.getElementById("detailTitle");
  const contentEl = document.getElementById("detailContent");
  
  if (titleEl) titleEl.textContent = `${firstLink.facility_name} (${facilityCode})`;
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">ðŸ“Š Eksponeringsdetaljer</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div style="padding:10px;background:#111827;border-radius:6px;">
            <div style="color:#9ca3af;font-size:0.75rem;">Totalt bÃ¥ter</div>
            <div style="color:#e5e7eb;font-size:1.3rem;font-weight:700;">${facilityLinks.length}</div>
          </div>
          <div style="padding:10px;background:#111827;border-radius:6px;">
            <div style="color:#9ca3af;font-size:0.75rem;">HÃ¸y risiko</div>
            <div style="color:#ef4444;font-size:1.3rem;font-weight:700;">${facilityLinks.filter(l => l.risk_level === "HIGH").length}</div>
          </div>
          <div style="padding:10px;background:#111827;border-radius:6px;">
            <div style="color:#9ca3af;font-size:0.75rem;">Anleggsscore</div>
            <div style="color:#e5e7eb;font-size:1.3rem;font-weight:700;">${firstLink.facility_risk_score ?? "-"}</div>
          </div>
        </div>
      </div>

      <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">ðŸš¢ BÃ¥ter som har besÃ¸kt</div>
      <div style="max-height:240px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px;background:#0b1424;">
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead>
            <tr style="background:#111827;color:#9ca3af;text-align:left;position:sticky;top:0;">
              <th style="padding:8px;">BÃ¥t</th>
              <th style="padding:8px;">MMSI</th>
              <th style="padding:8px;">Risiko</th>
              <th style="padding:8px;">Sykdom</th>
            </tr>
          </thead>
          <tbody>${vesselRows}</tbody>
        </table>
      </div>

      ${clusterSection}
    `;
  }
  
  showModal("correlationDetailModal");
}

async function loadAdmin() {
  if (typeof AdminCoreModule?.loadAdmin === "function") {
    try {
      await AdminCoreModule.loadAdmin({
        apiFetch,
        setCorrelationData: (data) => { correlationData = data; },
        state,
        renderAdminCorrelations,
        documentRef: document,
        setModuleCorrelationData: typeof AdminCorrelationNetworkModule?.setCorrelationData === "function"
          ? (data) => AdminCorrelationNetworkModule.setCorrelationData(data)
          : null
      });
      return;
    } catch (moduleError) {
      console.warn("Admin core module loadAdmin failed, using fallback in app.js:", moduleError);
    }
  }

  if (typeof adminLoadFallbackModule.loadAdminFallback === "function") {
    try {
      await adminLoadFallbackModule.loadAdminFallback({
        apiFetch,
        setCorrelationData: (data) => { correlationData = data; },
        state,
        renderAdminCorrelations,
        documentRef: document,
        setModuleCorrelationData: typeof AdminCorrelationNetworkModule?.setCorrelationData === "function"
          ? (data) => AdminCorrelationNetworkModule.setCorrelationData(data)
          : null
      });
      return;
    } catch (moduleError) {
      console.warn("Admin load fallback module failed, using inline fallback in app.js:", moduleError);
    }
  }

  try {
    correlationData = await apiFetch("/api/risk/correlations");
    
    // Sync correlation data with module if available
    if (typeof AdminCorrelationNetworkModule?.setCorrelationData === "function") {
      AdminCorrelationNetworkModule.setCorrelationData(correlationData);
    }
    
    // Check if data is empty
    if (!correlationData || !correlationData.summary || correlationData.summary.total_correlations === 0) {
      document.getElementById("admin-data").innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #10b981; font-size: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">âœ…</div>
          <div><strong>Great news!</strong> Ingen hÃ¸yrisiko-koblinger akkurat nÃ¥.</div>
          <div style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.9rem;">Systemet overvÃ¥ker kontinuerlig for endringer.</div>
        </div>
      `;
    } else {
      state.loaded.admin = true;
      renderAdminCorrelations();
    }
  } catch (error) {
    console.error("Error loading correlations:", error);
    document.getElementById("admin-data").innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;">âŒ Feil ved lasting av risiko-nettverk: ${error.message}</div>`;
  }
}

function renderAdminCorrelations() {
  if (typeof adminCorrelationsRenderModule.renderAdminCorrelations === "function") {
    try {
      adminCorrelationsRenderModule.renderAdminCorrelations({
        correlationData,
        ensureAdminCorrelationLayout,
        ensureCorrelationDetailModal,
        formatNumber,
        documentRef: document,
        networkModule: window.AdminCorrelationNetworkModule,
        renderNetworkGraphFallback: renderNetworkGraph,
        renderPriorityListFallback: renderPriorityList,
        renderOutbreakClustersFallback: renderOutbreakClusters,
        renderInfectedFacilitiesFallback: renderInfectedFacilities,
        renderAffectedFacilitiesFallback: renderAffectedFacilities,
      });
      return;
    } catch (moduleError) {
      console.warn("Admin correlations render module failed, using fallback in app.js:", moduleError);
    }
  }

  if (!correlationData) return;

  ensureAdminCorrelationLayout();
  ensureCorrelationDetailModal();

  const summary = correlationData.summary || {};

  // Update KPI cards with status colors
  const infectedEl = document.getElementById("correlationInfected");
  const highBoatsEl = document.getElementById("correlationHighBoats");
  const modBoatsEl = document.getElementById("correlationModBoats");
  const affectedEl = document.getElementById("correlationAffected");
  const linksEl = document.getElementById("correlationLinks");

  if (infectedEl) infectedEl.textContent = formatNumber(summary.infected_facilities || 0);
  if (highBoatsEl) highBoatsEl.textContent = formatNumber(summary.high_risk_boats || 0);
  if (modBoatsEl) modBoatsEl.textContent = formatNumber(summary.moderate_risk_boats || 0);
  if (affectedEl) affectedEl.textContent = formatNumber(summary.potentially_affected_farms || 0);
  if (linksEl) linksEl.textContent = formatNumber(summary.total_correlations || 0);

  // Update status colors for KPI cards when KPI elements exist in DOM
  if (infectedEl?.parentElement?.parentElement) {
    infectedEl.parentElement.parentElement.className = "summary-card " + (summary.infected_facilities > 0 ? "status-red" : "");
  }
  if (highBoatsEl?.parentElement?.parentElement) {
    highBoatsEl.parentElement.parentElement.className = "summary-card alert " + (summary.high_risk_boats > 10 ? "status-red" : "");
  }
  if (modBoatsEl?.parentElement?.parentElement) {
    modBoatsEl.parentElement.parentElement.className = "summary-card warning " + (summary.moderate_risk_boats > 10 ? "status-yellow" : "");
  }
  if (affectedEl?.parentElement?.parentElement) {
    affectedEl.parentElement.parentElement.className = "summary-card " + (summary.potentially_affected_farms > 20 ? "status-orange" : "");
  }
  if (linksEl?.parentElement?.parentElement) {
    linksEl.parentElement.parentElement.className = "summary-card " + (summary.total_correlations > 100 ? "status-yellow" : "");
  }

  // Render network graph
  if (typeof AdminCorrelationNetworkModule?.renderNetworkGraph === "function") {
    try {
      AdminCorrelationNetworkModule.renderNetworkGraph();
    } catch (e) {
      console.warn("Module renderNetworkGraph failed, using fallback:", e);
      renderNetworkGraph();
    }
  } else {
    renderNetworkGraph();
  }

  // Render priority list
  if (typeof AdminCorrelationNetworkModule?.renderPriorityList === "function") {
    try {
      AdminCorrelationNetworkModule.renderPriorityList();
    } catch (e) {
      console.warn("Module renderPriorityList failed, using fallback:", e);
      renderPriorityList();
    }
  } else {
    renderPriorityList();
  }

  // Render month-scale outbreak clusters
  if (typeof AdminCorrelationNetworkModule?.renderOutbreakClusters === "function") {
    try {
      AdminCorrelationNetworkModule.renderOutbreakClusters();
    } catch (e) {
      console.warn("Module renderOutbreakClusters failed, using fallback:", e);
      renderOutbreakClusters();
    }
  } else {
    renderOutbreakClusters();
  }

  // Render infected and affected facilities
  if (typeof AdminCorrelationNetworkModule?.renderInfectedFacilities === "function") {
    try {
      AdminCorrelationNetworkModule.renderInfectedFacilities();
    } catch (e) {
      console.warn("Module renderInfectedFacilities failed, using fallback:", e);
      renderInfectedFacilities();
    }
  } else {
    renderInfectedFacilities();
  }
  
  if (typeof AdminCorrelationNetworkModule?.renderAffectedFacilities === "function") {
    try {
      AdminCorrelationNetworkModule.renderAffectedFacilities();
    } catch (e) {
      console.warn("Module renderAffectedFacilities failed, using fallback:", e);
      renderAffectedFacilities();
    }
  } else {
    renderAffectedFacilities();
  }
}

function getLastSeenDays(link) {
  const candidates = [
    link.days_since_contact,
    link.days_since_visit,
    link.days_since_seen,
    link.days_since_update,
    link.days_since_last_visit,
    link.last_seen_days
  ];
  const found = candidates.find((value) => Number.isFinite(value));
  if (Number.isFinite(found)) {
    return Math.max(1, Math.round(found));
  }
  return 3;
}

function resetGraphHighlight() {
  if (typeof graphHighlightModule.resetGraphHighlight === "function") {
    try {
      graphHighlightModule.resetGraphHighlight({
        getNetworkGraph: () => networkGraph,
        highlightedNodes,
        highlightedEdges,
        setSelectedNodeId: (value) => {
          selectedNodeId = value;
        }
      });
      return;
    } catch (moduleError) {
      console.warn("Graph highlight module reset failed, using fallback in app.js:", moduleError);
    }
  }

  if (!networkGraph) return;

  const nodes = networkGraph.body.data.nodes;
  const edges = networkGraph.body.data.edges;

  const nodeUpdates = nodes.get().map((node) => ({
    id: node.id,
    color: node.baseColor || node.color,
    font: { ...(node.font || {}), color: "#fff" },
  }));

  const edgeUpdates = edges.get().map((edge) => ({
    id: edge.id,
    color: { color: edge.baseColor || (edge.color && edge.color.color) || edge.color },
    width: edge.baseWidth || edge.width,
    dashes: false,
  }));

  nodes.update(nodeUpdates);
  edges.update(edgeUpdates);

  highlightedNodes.clear();
  highlightedEdges.clear();
  selectedNodeId = null;
}

function applyGraphHighlight(nodeId) {
  if (typeof graphHighlightModule.applyGraphHighlight === "function") {
    try {
      graphHighlightModule.applyGraphHighlight(nodeId, {
        getNetworkGraph: () => networkGraph,
        getSelectedNodeId: () => selectedNodeId,
        setSelectedNodeId: (value) => {
          selectedNodeId = value;
        },
        resetGraphHighlightFn: resetGraphHighlight
      });
      return;
    } catch (moduleError) {
      console.warn("Graph highlight module apply failed, using fallback in app.js:", moduleError);
    }
  }

  if (!networkGraph) return;

  if (selectedNodeId === nodeId) {
    resetGraphHighlight();
    return;
  }

  selectedNodeId = nodeId;
  const nodes = networkGraph.body.data.nodes;
  const edges = networkGraph.body.data.edges;

  const connectedNodes = new Set(networkGraph.getConnectedNodes(nodeId));
  const connectedEdges = new Set(networkGraph.getConnectedEdges(nodeId));
  connectedNodes.add(nodeId);

  const nodeUpdates = nodes.get().map((node) => {
    const isConnected = connectedNodes.has(node.id);
    return {
      id: node.id,
      color: isConnected ? (node.baseColor || node.color) : { background: "#1f2937", border: "#0f172a" },
      font: { ...(node.font || {}), color: isConnected ? "#fff" : "#6b7280" },
    };
  });

  const edgeUpdates = edges.get().map((edge) => {
    const isConnected = connectedEdges.has(edge.id);
    return {
      id: edge.id,
      color: { color: isConnected ? (edge.baseColor || (edge.color && edge.color.color) || edge.color) : "#1f2937" },
      width: isConnected ? (edge.baseWidth || edge.width) + 1 : 1,
      dashes: !isConnected,
    };
  });

  nodes.update(nodeUpdates);
  edges.update(edgeUpdates);
}

function renderNetworkGraph() {
  const container = document.getElementById("adminNetworkContainer");
  if (!container) return;

  if (typeof vis === "undefined" || !vis.Network || !vis.DataSet) {
    container.innerHTML = '<div style="padding: 1rem; color: #f59e0b; text-align: center;">âš ï¸ Network-graf kunne ikkje lastast (vis-network manglar).</div>';
    networkGraph = null;
    return;
  }

  const infected = correlationData.infected_facilities || [];
  const links = correlationData.vessel_facility_links || [];

  // Build nodes
  const nodes = new vis.DataSet();

  // Add infected facility nodes (red)
  infected.forEach(f => {
    const baseColor = { background: "#ef4444", border: "#dc2626", highlight: { background: "#991b1b", border: "#dc2626" } };
    nodes.add({
      id: `fac_${f.code}`,
      label: f.name.substring(0, 15),
      title: `${f.name} (${f.code})\nRisk: ${f.risk_level}\nScore: ${f.risk_score}`,
      color: baseColor,
      baseColor: baseColor,
      shape: "box",
      font: { size: 12, color: "#fff" },
      mass: 2
    });
  });

  // Add vessel nodes
  const vesselSet = new Set();
  links.forEach(link => {
    vesselSet.add(link.vessel_mmsi);
  });

  vesselSet.forEach(mmsi => {
    const link = links.find(l => l.vessel_mmsi === mmsi);
    const riskColor = link && link.risk_level === "HIGH" ? "#ef4444" : "#f59e0b";
    const baseColor = { background: riskColor, border: "#d97706", highlight: { background: "#b45309", border: "#d97706" } };
    nodes.add({
      id: `vessel_${mmsi}`,
      label: mmsi.toString().substring(0, 8),
      title: `${link.vessel_name}\nMMSI: ${mmsi}\nRisk: ${link.risk_level}`,
      color: baseColor,
      baseColor: baseColor,
      shape: "circle",
      font: { size: 11, color: "#fff" },
      size: 25
    });
  });

  // Build edges
  const edges = new vis.DataSet();
  links.forEach((link) => {
    const riskText = link.risk_level === "HIGH" ? "Hoy" : "Moderat";
    const lastDays = getLastSeenDays(link);
    const color = link.risk_level === "HIGH" ? "#ef4444" : "#f59e0b";
    const width = link.risk_level === "HIGH" ? 3 : 2;
    edges.add({
      from: `vessel_${link.vessel_mmsi}`,
      to: `fac_${link.facility_code}`,
      color: { color, highlight: "#fbbf24" },
      baseColor: color,
      baseWidth: width,
      width: width,
      title: `Risiko: ${riskText} - siste besok i smittesone for ${lastDays} dager siden\nAvstand: ${link.distance_km} km`,
      smooth: { type: "continuous" }
    });
  });

  // Network options
  const options = {
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -26000,
        centralGravity: 0.005,
        springLength: 200,
        springConstant: 0.04
      },
      maxVelocity: 50,
      solver: "barnesHut",
      timestep: 0.35
    },
    nodes: {
      widthConstraint: { maximum: 80 }
    },
    edges: {
      smooth: { type: "continuous" },
      arrows: { to: { enabled: false } }
    },
    interaction: {
      navigationButtons: false,
      keyboard: true,
      zoomView: true,
      dragView: true
    }
  };

  // Create network
  const data = { nodes: nodes, edges: edges };
  networkGraph = new vis.Network(container, data, options);

  // Handle click events
  networkGraph.on("click", function(params) {
    if (params.nodes.length > 0) {
      applyGraphHighlight(params.nodes[0]);
      return;
    }

    if (params.edges.length > 0) {
      const edge = networkGraph.body.data.edges.get(params.edges[0]);
      if (edge && edge.from) {
        applyGraphHighlight(edge.from);
        return;
      }
    }

    resetGraphHighlight();
  });
}

function renderPriorityList() {
  const container = document.getElementById("adminPriorityList");
  if (!container) return;
  const top10 = correlationData.top_priority || [];

  if (!top10.length) {
    container.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 2rem;">Ingen kritiske koblinger identifisert.</div>';
    return;
  }

  const rows = top10.map((link, idx) => {
    const riskText = link.risk_level === "HIGH" ? "HIGH" : "MODERATE";
    const riskColor = link.risk_level === "HIGH" ? "#ef4444" : "#f59e0b";
    const diseases = link.diseases && link.diseases.length ? link.diseases.join(", ") : "None";
    
    // Check if facility is in a cluster
    const cluster = getFacilityCluster(link.facility_code);
    const clusterBadge = cluster 
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getClusterColor(cluster.cluster_id)};margin-right:4px;" title="Klynge #${cluster.cluster_id}"></span>`
      : '';
    
    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);border-left:3px solid ${cluster ? getClusterColor(cluster.cluster_id) : 'transparent'};">
        <td style="padding:8px;color:#d1d5db;">${idx + 1}</td>
        <td style="padding:8px;color:#e5e7eb;">${link.vessel_name || "Unknown"}</td>
        <td style="padding:8px;color:#d1d5db;">${link.vessel_mmsi || "-"}</td>
        <td style="padding:8px;color:#e5e7eb;">${clusterBadge}${link.facility_name || "Unknown"}</td>
        <td style="padding:8px;color:#d1d5db;">${link.facility_code || "-"}</td>
        <td style="padding:8px;color:#d1d5db;">${link.distance_km ?? "-"} km</td>
        <td style="padding:8px;color:#d1d5db;">${link.facility_risk_score ?? "-"}</td>
        <td style="padding:8px;color:${riskColor};font-weight:700;">${riskText}</td>
        <td style="padding:8px;color:#9ca3af;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${diseases}</td>
        <td style="padding:8px;white-space:nowrap;">
          <button class="btn" data-action="details" data-facility-code="${link.facility_code}" style="background:#374151;color:#e5e7eb;padding:0.25rem 0.6rem;font-size:0.78rem;">View details</button>
          <button class="btn" data-action="notify" data-index="${idx}" style="background:#2563eb;color:#fff;padding:0.25rem 0.6rem;font-size:0.78rem;margin-left:6px;">Notify</button>
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div style="overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;">
      <table style="width:100%;border-collapse:collapse;min-width:1020px;font-size:0.86rem;">
        <thead>
          <tr style="text-align:left;background:#111827;color:#9ca3af;">
            <th style="padding:8px;">#</th>
            <th style="padding:8px;">Vessel</th>
            <th style="padding:8px;">MMSI</th>
            <th style="padding:8px;">Facility</th>
            <th style="padding:8px;">Code</th>
            <th style="padding:8px;">Distance</th>
            <th style="padding:8px;">Facility Risk</th>
            <th style="padding:8px;">Risk</th>
            <th style="padding:8px;">Diseases</th>
            <th style="padding:8px;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;color:#9ca3af;font-size:0.8rem;">
      ðŸ’¡ Fargede striper = anlegget er del av en utbruddsklynge (se under for detaljer)
    </div>
  `;
}

// Global cluster color mapping (consistent colors across views)
const clusterColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

function getClusterColor(clusterId) {
  return clusterColors[(clusterId - 1) % clusterColors.length];
}

function getFacilityCluster(facilityCode) {
  const clusters = correlationData.outbreak_clusters || [];
  for (const cluster of clusters) {
    if (cluster.facilities && cluster.facilities.some(f => f.code === facilityCode)) {
      return cluster;
    }
  }
  return null;
}

function renderOutbreakClusters() {
  const container = document.getElementById("adminOutbreakClusters");
  if (!container) return;

  const clusters = correlationData.outbreak_clusters || [];
  const summary = correlationData.outbreak_cluster_summary || {};

  if (!clusters.length) {
    container.innerHTML = `
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;color:#9ca3af;">
        Ingen tydelige utbruddsklynger i 120-dagers vindu. Dette kan bety god smittekontroll! âœ“
      </div>
    `;
    return;
  }

  const summaryBar = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
      <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Klynger</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_clusters ?? clusters.length}</div></div>
      <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Anlegg i klynger</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_facilities_in_clusters ?? "-"}</div></div>
      <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">BrobÃ¥ter</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_bridge_vessels ?? "-"}</div></div>
      <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Tidsanalyse</div><div style="color:#e5e7eb;font-weight:700;">120 dager</div></div>
    </div>
  `;

  const clusterCards = clusters.map((cluster) => {
    const clusterColor = getClusterColor(cluster.cluster_id);
    const facilitiesList = (cluster.facilities || []).map(f => {
      const daysSinceFirst = cluster.first_seen ? Math.floor((new Date(f.last_seen) - new Date(cluster.first_seen)) / (1000 * 60 * 60 * 24)) : 0;
      return `
        <div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div>
            <div style="color:#e5e7eb;font-size:0.88rem;">${f.name}</div>
            <div style="color:#9ca3af;font-size:0.75rem;">Kode: ${f.code} Â· ${f.vessel_count} bÃ¥ter</div>
          </div>
          <div style="color:#9ca3af;font-size:0.75rem;text-align:right;">
            <div>Dag +${daysSinceFirst}</div>
          </div>
        </div>
      `;
    }).join("");

    const topPath = (cluster.top_paths && cluster.top_paths.length)
      ? `${cluster.top_paths[0].from_facility} â†’ ${cluster.top_paths[0].to_facility} (${cluster.top_paths[0].vessel_count} bÃ¥ter, ${cluster.top_paths[0].distance_km?.toFixed(1) || '?'} km)`
      : "-";

    return `
      <div style="border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${clusterColor};border-radius:8px;background:#0b1424;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="color:${clusterColor};font-weight:700;font-size:0.9rem;">ðŸ”— Klynge #${cluster.cluster_id}</div>
            <div style="color:#9ca3af;font-size:0.8rem;margin-top:2px;">Startet: ${cluster.start_facility_name}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#e5e7eb;font-size:1.1rem;font-weight:700;">${cluster.duration_days} dager</div>
            <div style="color:#9ca3af;font-size:0.75rem;">${cluster.facility_count} anlegg Â· ${cluster.vessel_count} bÃ¥ter</div>
          </div>
        </div>
        
        <div style="background:#111827;border-radius:6px;padding:8px;margin-bottom:10px;">
          <div style="color:#9ca3af;font-size:0.75rem;margin-bottom:4px;">ðŸ“ Sterkeste forbindelse:</div>
          <div style="color:#e5e7eb;font-size:0.85rem;">${topPath}</div>
        </div>

        <div style="background:#111827;border-radius:6px;overflow:hidden;">
          <div style="padding:6px 8px;background:#1f2937;color:#9ca3af;font-size:0.75rem;font-weight:600;">ANLEGG I KLYNGEN (kronologisk)</div>
          ${facilitiesList}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    ${summaryBar}
    ${clusterCards}
    <div style="padding:10px;background:#111827;border-radius:8px;color:#9ca3af;font-size:0.8rem;">
      ðŸ’¡ <strong>Slik leser du klyngene:</strong> Hver fargekode representerer en separat smitteklynge. "Dag +0" er fÃ¸rste registrerte infeksjon i klyngen. 
      Anlegg med samme fargekode er koblet via felles bÃ¥ttrafikk eller geografisk nÃ¦rhet (< 20 km) innenfor 90-dagers vinduer.
    </div>
  `;
}

function renderInfectedFacilities() {
  const container = document.getElementById("adminInfectedList");
  if (!container) return;
  const infected = correlationData.infected_facilities || [];

  if (!infected.length) {
    container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 1rem;">No infected facilities detected.</div>';
    return;
  }

  const rows = infected.map((f) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
      <td style="padding:8px;color:#e5e7eb;">${f.name || "Unknown"}</td>
      <td style="padding:8px;color:#d1d5db;">${f.code || "-"}</td>
      <td style="padding:8px;color:#fca5a5;">${f.risk_level || "-"}</td>
      <td style="padding:8px;color:#9ca3af;">${f.has_ila ? "ILA " : ""}${f.has_pd ? "PD" : ""}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div style="overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead><tr style="text-align:left;background:#111827;color:#9ca3af;"><th style="padding:8px;">Name</th><th style="padding:8px;">Code</th><th style="padding:8px;">Risk</th><th style="padding:8px;">Disease</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAffectedFacilities() {
  const container = document.getElementById("adminAffectedList");
  if (!container) return;
  const affected = correlationData.affected_facilities || [];

  if (!affected.length) {
    container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 1rem;">No facilities currently at risk.</div>';
    return;
  }

  const rows = affected
    .sort((a, b) => b.affected_by_boats - a.affected_by_boats)
    .slice(0, 10)
    .map((f) => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <td style="padding:8px;color:#e5e7eb;">${f.name || "Unknown"}</td>
        <td style="padding:8px;color:#d1d5db;">${f.code || "-"}</td>
        <td style="padding:8px;color:#d1d5db;">${f.risk_level || "-"}</td>
        <td style="padding:8px;color:#d1d5db;">${f.affected_by_boats ?? 0}</td>
      </tr>
    `).join("");

  container.innerHTML = `
    <div style="overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead><tr style="text-align:left;background:#111827;color:#9ca3af;"><th style="padding:8px;">Name</th><th style="padding:8px;">Code</th><th style="padding:8px;">Risk</th><th style="padding:8px;">Visited by boats</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAdmin() {
  // Kept for compatibility
  renderAdminCorrelations();
}

function renderAdminDiseaseStatus() {
  if (typeof AdminPanelModule?.renderAdminDiseaseStatus === "function") {
    try {
      AdminPanelModule.renderAdminDiseaseStatus();
      return;
    } catch (e) {
      console.warn("AdminPanelModule.renderAdminDiseaseStatus failed:", e);
    }
  }
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
            <div class="disease-meta">Confirmed ${item.confirmed} Â· Suspected ${item.suspected}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAdminKpis() {
  if (typeof AdminPanelModule?.renderAdminKpis === "function") {
    try {
      AdminPanelModule.renderAdminKpis();
      return;
    } catch (e) {
      console.warn("AdminPanelModule.renderAdminKpis failed:", e);
    }
  }
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

function renderAdminRiskList() {
  if (typeof AdminPanelModule?.renderAdminRiskList === "function") {
    try {
      AdminPanelModule.renderAdminRiskList();
      return;
    } catch (e) {
      console.warn("AdminPanelModule.renderAdminRiskList failed:", e);
    }
  }
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
          <div class="list-meta">${item.facility_code || "--"} Â· Score ${item.risk_score ?? "--"}</div>
          <div class="list-meta">Lat ${formatCoord(item.location?.latitude)} Â· Lon ${formatCoord(item.location?.longitude)}</div>
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

function setAdminRiskDetail(item) {
  if (typeof AdminPanelModule?.setAdminRiskDetail === "function") {
    try {
      AdminPanelModule.setAdminRiskDetail(item);
      return;
    } catch (e) {
      console.warn("AdminPanelModule.setAdminRiskDetail failed:", e);
    }
  }
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
    <div class="detail-sub">${item.facility_code || "--"} Â· ${formatCoord(item.location?.latitude)}, ${formatCoord(item.location?.longitude)}</div>
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

function renderAdminVesselList() {
  if (typeof AdminPanelModule?.renderAdminVesselList === "function") {
    try {
      AdminPanelModule.renderAdminVesselList();
      return;
    } catch (e) {
      console.warn("AdminPanelModule.renderAdminVesselList failed:", e);
    }
  }
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
          <div class="list-meta">Speed ${item.speedOverGround ?? "--"} kn Â· Heading ${item.trueHeading ?? item.courseOverGround ?? "--"}</div>
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

function setAdminVesselDetail(item) {
  if (typeof AdminPanelModule?.setAdminVesselDetail === "function") {
    try {
      AdminPanelModule.setAdminVesselDetail(item);
      return;
    } catch (e) {
      console.warn("AdminPanelModule.setAdminVesselDetail failed:", e);
    }
  }
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

function renderRisk() {
  if (typeof OverviewRiskModule?.renderRisk === "function") {
    try {
      OverviewRiskModule.renderRisk();
      return;
    } catch (e) {
      console.warn("OverviewRiskModule.renderRisk failed:", e);
    }
  }
  if (!state.risk.length) {
    elements.riskGrid.innerHTML = "Load risk data to see assessments.";
    elements.riskSummary.innerHTML = "";
    return;
  }
  const riskLevel = document.getElementById("riskLevel").value;
  const diseaseFilter = document.getElementById("diseaseFilter").value;
  const search = document.getElementById("riskSearch").value.toLowerCase();

  let filtered = [...state.risk];

  if (riskLevel !== "all") {
    filtered = filtered.filter((item) => item.risk_level === riskLevel);
  }

  if (diseaseFilter === "ila") {
    filtered = filtered.filter((item) => item.disease_status?.has_ila);
  }
  if (diseaseFilter === "pd") {
    filtered = filtered.filter((item) => item.disease_status?.has_pd);
  }
  if (diseaseFilter === "none") {
    filtered = filtered.filter((item) => !item.disease_status?.has_ila && !item.disease_status?.has_pd);
  }

  if (search) {
    filtered = filtered.filter((item) => {
      const name = item.facility_name?.toLowerCase() || "";
      const code = item.facility_code?.toLowerCase() || "";
      return name.includes(search) || code.includes(search);
    });
  }

  const counts = {
    Critical: state.risk.filter((r) => r.risk_level === "Critical").length,
    High: state.risk.filter((r) => r.risk_level === "High").length,
    Medium: state.risk.filter((r) => r.risk_level === "Medium").length,
    Low: state.risk.filter((r) => r.risk_level === "Low").length,
  };

  setMiniCards(elements.riskSummary, [
    { label: "Critical", value: counts.Critical },
    { label: "High", value: counts.High },
    { label: "Medium", value: counts.Medium },
    { label: "Low", value: counts.Low },
    { label: "Shown", value: filtered.length, meta: "Filtered" },
  ]);

  elements.riskGrid.innerHTML = filtered
    .map((item) => {
      const level = item.risk_level?.toLowerCase() || "medium";
      const lice = item.lice_data || {};
      const riskScore = item.risk_score ?? "--";
      const sources = item.disease_status?.disease_sources;
      const sourcesCount = Array.isArray(sources) ? sources.length : 0;
      return `
      <div class="card">
        <div class="card-title">${item.facility_name || "Unknown"}</div>
        <div class="mono">${item.facility_code || "--"}</div>
        <span class="tag ${level}">${item.risk_level || "Unknown"}</span>
        <div>Score: <strong>${riskScore}</strong></div>
        <div>Location: ${formatCoord(item.location?.latitude)}, ${formatCoord(item.location?.longitude)}</div>
        <div>Biggest factor: ${item.biggest_risk_factor || "--"}</div>
        <div>ILA: ${item.disease_status?.has_ila ? "Yes" : "No"} | PD: ${item.disease_status?.has_pd ? "Yes" : "No"}</div>
        <div>Disease sources: ${sourcesCount || "None"}</div>
        <div>Lice (adult): ${lice.adult_female_lice ?? "--"}, mobile: ${lice.mobile_lice ?? "--"}</div>
      </div>
      `;
    })
    .join("");
}

function populateDiseaseFilters() {
  if (typeof OverviewRiskModule?.populateDiseaseFilters === "function") {
    try {
      OverviewRiskModule.populateDiseaseFilters();
      return;
    } catch (e) {
      console.warn("OverviewRiskModule.populateDiseaseFilters failed:", e);
    }
  }
  const diseases = new Set();
  
  // Extract diseases from facility risk data
  if (state.facilityRisk && state.facilityRisk.length) {
    state.facilityRisk.forEach((facility) => {
      const allNearby = facility.all_nearby_diseases || [];
      allNearby.forEach((neighbor) => {
        const neighborDiseases = neighbor.diseases || [];
        neighborDiseases.forEach((d) => {
          const diseaseName = typeof d === 'string' ? d : d.name || '';
          if (diseaseName) diseases.add(diseaseName);
        });
      });
    });
  }
  
  // Extract diseases from vessel risk data
  if (state.vesselRisk && state.vesselRisk.length) {
    state.vesselRisk.forEach((vessel) => {
      const facility = vessel.infected_facility || {};
      const facilityDiseases = facility.diseases || [];
      facilityDiseases.forEach((d) => {
        if (d) diseases.add(d);
      });
    });
  }
  
  // Sort diseases alphabetically
  const sortedDiseases = Array.from(diseases).sort();
  
  // Populate facility disease filter
  if (elements.facilityDiseaseFilter) {
    const currentValue = elements.facilityDiseaseFilter.value;
    elements.facilityDiseaseFilter.innerHTML = '<option value="all">All Diseases</option>';
    sortedDiseases.forEach((disease) => {
      const option = document.createElement('option');
      option.value = disease;
      option.textContent = disease;
      elements.facilityDiseaseFilter.appendChild(option);
    });
    elements.facilityDiseaseFilter.value = currentValue;
  }
  
  // Populate vessel disease filter
  if (elements.vesselDiseaseFilter) {
    const currentValue = elements.vesselDiseaseFilter.value;
    elements.vesselDiseaseFilter.innerHTML = '<option value="all">All Diseases</option>';
    sortedDiseases.forEach((disease) => {
      const option = document.createElement('option');
      option.value = disease;
      option.textContent = disease;
      elements.vesselDiseaseFilter.appendChild(option);
    });
    elements.vesselDiseaseFilter.value = currentValue;
  }
}

function renderFacilityRisk() {
  // Try module first
  if (typeof AdminFacilityRiskModule?.renderFacilityRisk === "function") {
    try {
      AdminFacilityRiskModule.renderFacilityRisk({ state, elements });
      return;
    } catch (moduleError) {
      console.warn("Facility risk module render failed, using fallback in app.js:", moduleError);
    }
  }

  // Fallback implementation
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
    renderFacilityRiskTable(sortedByRisk);
    elements.facilityRiskList.classList.add("hidden");
    elements.facilityRiskTableWrap.classList.remove("hidden");
    return;
  }

  elements.facilityRiskList.classList.remove("hidden");
  elements.facilityRiskTableWrap.classList.add("hidden");

  // COMPACT LIST VIEW
  elements.facilityRiskList.innerHTML = `
    <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 8px;">ðŸ“‹ Showing ${filtered.length} facilit${filtered.length === 1 ? 'y' : 'ies'}. Click to expand details.</div>
    <div style="display: grid; gap: 4px;">
      ${filtered.sort((a, b) => b.risk_score - a.risk_score).map((facility) => {
        const levelClass = facility.risk_level?.toLowerCase() || "lav";
        const isExpanded = String(facility.facility_code) === String(state.facilityRiskSelectedCode);
        
        let riskBadgeColor = '#22c55e';
        let riskIcon = 'ðŸŸ¢';
        if (levelClass === 'ekstrem') {
          riskBadgeColor = '#dc2626';
          riskIcon = 'ðŸ”´';
        } else if (levelClass === 'hÃ¸y') {
          riskBadgeColor = '#f97316';
          riskIcon = 'ðŸŸ ';
        } else if (levelClass === 'moderat') {
          riskBadgeColor = '#eab308';
          riskIcon = 'ðŸŸ¡';
        }
        
        // Disease detection from BarentsWatch data
        const disease = facility.disease || '';
        let diseaseIcon = '';
        let diseaseColor = '#6b7280';
        if (disease.toUpperCase().includes('ILA')) {
          diseaseIcon = 'ðŸ”´';
          diseaseColor = '#dc2626';
        } else if (disease.toUpperCase().includes('PD')) {
          diseaseIcon = 'ðŸŸ ';
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
                <span style="color: var(--accent); font-size: 0.85rem;">${isExpanded ? 'â–¼' : 'â–¶'}</span>
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
            zoneExplanation = 'â›” RESTRICTION ZONE: Official disease confirmed. Strict movement restrictions apply.';
          } else if (zoneType === 'SURVEILLANCE') {
            zoneExplanation = 'âš ï¸ SURVEILLANCE ZONE: Monitoring area around confirmed cases. Enhanced biosecurity required.';
          }
          
          html += `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
              <div style="font-size: 0.9rem; margin-bottom: 8px; color: var(--accent-strong);">
                <strong>ðŸ“ Official Disease Zone Information:</strong>
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
                <strong>ðŸ“‹ Official Status:</strong> This facility is in a BarentsWatch-declared disease zone. Follow official FKA (Fisheries and Food Authority) guidelines for the zone type.
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
      renderFacilityRisk();
    });
  });
}

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
  
  if (risk === "HÃ¸y") {
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

function renderFacilityRiskTable(rows) {
  if (!elements.facilityRiskTableBody) return;
  elements.facilityRiskTableBody.innerHTML = rows
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

// Global DataTable instance
let vesselRiskDataTable = null;

function getVesselRiskTbody() {
  return getByQuery("#vesselRiskTable tbody", "#vessel-risk-table", "#vessel-risk-table tbody");
}

function setVesselRiskHtml(html) {
  const tbody = getVesselRiskTbody();
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
      parsedTime: new Date(visit.timestamp)
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

function renderVesselRisk() {
  if (typeof AdminVesselRiskModule?.renderVesselRisk === "function") {
    try {
      AdminVesselRiskModule.renderVesselRisk({
        state,
        elements,
        formatNumber,
        showVesselDetail,
      });
      return;
    } catch (moduleError) {
      console.warn("Vessel risk module render failed, using fallback in app.js:", moduleError);
    }
  }

  if (!state.vesselRisk || !state.vesselRisk.length) {
    setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels at risk. Click 'Load vessel risk' to fetch data.</td></tr>");
    if (elements.vesselRiskSelectedMmsi) elements.vesselRiskSelectedMmsi.textContent = "Selected MMSI: -";
    return;
  }

  const visitFilter = elements.vesselRiskLevel?.value || "all";
  const chainFilter = elements.vesselChainFilter?.value || "all";
  let filtered = [...state.vesselRisk];

  const visitFilterMap = {
    infected: ['infected_facility', 'infected_facility_cluster'],
    risk_zone: ['risk_zone_facility', 'risk_zone_cluster'],
    near_10km: ['near_infected_10km', 'infected_facility_cluster', 'risk_zone_cluster']
  };

  // Apply visit category filter (infected, risk zone, 10km)
  if (visitFilter !== "all") {
    const categories = visitFilterMap[visitFilter] || [];
    filtered = filtered.filter((vessel) => vesselHasVisitCategory(vessel, categories));
  }

  // Apply chain filter
  if (chainFilter !== "all") {
    const hasChain = chainFilter === "true";
    filtered = filtered.filter((v) => v.has_48h_chain === hasChain);
  }

  // Apply visit category filter
  if (state.visitCategoryFilter !== "all") {
    filtered = filtered.filter((vessel) => vesselHasVisitCategory(vessel, [state.visitCategoryFilter]));
  }

  // Count vessels by visit category (from ALL vessels, not just filtered)
  const allVessels = state.vesselRisk;
  const infectedVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ['infected_facility', 'infected_facility_cluster'])).length;
  const riskZoneVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ['risk_zone_facility', 'risk_zone_cluster'])).length;
  const near10kmVesselCount = allVessels.filter((vessel) => vesselHasVisitCategory(vessel, ['near_infected_10km', 'infected_facility_cluster', 'risk_zone_cluster'])).length;

  // Update filter button counts
  const visitCategoryBtns = document.querySelectorAll('.visit-category-filter');
  const categoryLabels = {
    infected_facility: 'ðŸ¦  Smittet anlegg',
    risk_zone_facility: 'âš ï¸ Vernesone',
    near_infected_10km: 'ðŸ“ <10km',
    all: 'Vis alle'
  };
  visitCategoryBtns.forEach(btn => {
    const category = btn.dataset.category;
    let count = 0;
    if (category === 'infected_facility') count = infectedVesselCount;
    else if (category === 'risk_zone_facility') count = riskZoneVesselCount;
    else if (category === 'near_infected_10km') count = near10kmVesselCount;

    const baseLabel = categoryLabels[category] || 'Filter';
    if (category === 'all') {
      btn.textContent = baseLabel;
    } else {
      btn.textContent = `${baseLabel} (${count})`;
    }
  });

  if (!filtered.length) {
    setVesselRiskHtml("<tr><td colspan='8' style='padding: 20px; text-align: center; color: var(--muted);'>No vessels match your filters.</td></tr>");
    return;
  }

  // Update summary with chain count
  const chainCount = filtered.filter(v => v.has_48h_chain).length;
  elements.vesselRiskChainCount.textContent = formatNumber(chainCount);

  // Build table rows from filtered data
  const tableRows = filtered.map(vessel => {
    const riskLevel = vessel.highest_risk_level || vessel.risk_level || 'lav';
    const totalVisits = vessel.total_visits || 0;
    const has48hChain = vessel.has_48h_chain;
    const shortestGapHours = getShortestFacilityGapHours(vessel);
    
    // Build quarantine display with breach narrative
    let quarantineDisplay = '';
    if (has48hChain) {
      const breachDetails = vessel?.quarantine_analysis?.breach_details;
      let breachText = `ðŸš¨ BRUDD${shortestGapHours !== null ? ` (${shortestGapHours.toFixed(1)}t)` : ' (<48t)'}`;
      
      if (breachDetails) {
        const source = breachDetails.infected_source || 'ukjent';
        const destination = breachDetails.facility_name || 'ukjent';
        const hours = Number(breachDetails.hours_after_infection);
        const hoursText = Number.isFinite(hours) ? hours.toFixed(1) : '?';
        breachText += `<br><span style="font-size: 0.8rem; font-weight: 500;">Fra ${source} â†’ ${destination} (${hoursText}t)</span>`;
      }
      
      quarantineDisplay = `<span style="color: #dc2626; font-weight: 700;">${breachText}</span>`;
    } else {
      quarantineDisplay = '<span style="color: #16a34a; font-weight: 600;">âœ… OK</span>';
    }
    
    // Risk badge
    let riskIcon = 'ðŸŸ¢';
    let riskColor = '#22c55e';
    if (riskLevel === 'ekstrem') {
      riskIcon = 'ðŸ”´';
      riskColor = '#dc2626';
    } else if (riskLevel === 'hÃ¸y') {
      riskIcon = 'ðŸŸ ';
      riskColor = '#f97316';
    } else if (riskLevel === 'moderat') {
      riskIcon = 'ðŸŸ¡';
      riskColor = '#eab308';
    }
    
    // Count infected facility visits
    const visits = vessel.visits || [];
    const infectedCount = visits.filter(v => v.infected || ['infected_facility', 'infected_facility_cluster'].includes(v.visit_category)).length;
    const riskZoneCount = visits.filter(v => ['risk_zone_facility', 'risk_zone_cluster'].includes(v.visit_category)).length;
    const near10kmCount = visits.filter(v => ['near_infected_10km', 'infected_facility_cluster', 'risk_zone_cluster'].includes(v.visit_category)).length;
    
    // Infected visits display
    let infectedDisplay = infectedCount > 0 
      ? `<span style="color: #dc2626; font-weight: 600; font-size: 1.1rem;">ðŸ¦  ${infectedCount}</span>`
      : '<span style="color: #6b7280;">â€”</span>';
    
    // Risk zone/10km badges
    let riskBadges = '';
    if (riskZoneCount > 0) {
      riskBadges += `<span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block;">âš ï¸ Vernesone (${riskZoneCount})</span>`;
    }
    if (near10kmCount > 0) {
      riskBadges += `<span style="background: #eab308; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block;">ðŸ“ 10km-regel (${near10kmCount})</span>`;
    }
    if (!riskBadges) {
      riskBadges = '<span style="color: #6b7280; font-size: 0.8rem;">â€”</span>';
    }
    
    return `<tr${has48hChain ? " style='background: rgba(220,38,38,0.08);'" : ''}>
      <td>${vessel.mmsi}</td>
      <td>${vessel.vessel_name || `Vessel ${vessel.mmsi}`}</td>
      <td><span style="color: ${riskColor}; font-weight: 600; padding: 4px 8px; display: inline-block;">
        ${riskIcon} ${riskLevel.toUpperCase()}
      </span></td>
      <td style="text-align: center;">${infectedDisplay}</td>
      <td>${totalVisits}</td>
      <td>${riskBadges}</td>
      <td style="text-align: center;">${quarantineDisplay}</td>
      <td><button class="btn-view-details" data-mmsi="${vessel.mmsi}" style="padding: 4px 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">ðŸ‘ï¸ Vis</button></td>
    </tr>`;
  }).join('');
  
  // Insert rows into table tbody
  setVesselRiskHtml(tableRows);
  
  // Store data for modal display
  window.vesselRiskData = filtered;
  
  // Attach click handlers to view buttons
  document.querySelectorAll('.btn-view-details').forEach((btn) => {
    btn.addEventListener('click', function() {
      const mmsi = this.dataset.mmsi;
      const vesselData = window.vesselRiskData.find(v => String(v.mmsi) === String(mmsi));
      if (vesselData) {
        showVesselDetail(vesselData);
      }
    });
  });
}

function showVesselDetail(vessel) {
  if (!vessel) return;

  const getEffectiveQuarantineStatus = (vesselData) => {
    const q = vesselData?.quarantine_analysis || {};
    if (q.quarantine_status && q.quarantine_status !== 'NONE') {
      return q.quarantine_status;
    }
    if (vesselData?.has_48h_chain === true) {
      return 'QUARANTINE_BREACH';
    }
    return q.quarantine_status || 'NONE';
  };

  const dedupeVisitsForDisplay = (rawVisits, mergeWindowHours = 4) => {
    if (!Array.isArray(rawVisits) || rawVisits.length <= 1) return rawVisits || [];

    const categoryPriority = {
      infected_facility: 5,
      infected_facility_cluster: 4,
      risk_zone_facility: 3,
      risk_zone_cluster: 2,
      near_infected_10km: 1,
    };

    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const byTimestamp = new Map();
    for (const visit of rawVisits) {
      const ts = visit?.timestamp;
      if (!ts) continue;

      const existing = byTimestamp.get(ts);
      if (!existing) {
        byTimestamp.set(ts, visit);
        continue;
      }

      const visitDistance = toNumber(visit.distance_meters);
      const existingDistance = toNumber(existing.distance_meters);
      const visitPriority = categoryPriority[visit.visit_category] || 0;
      const existingPriority = categoryPriority[existing.visit_category] || 0;

      let chooseVisit = false;
      if (visitDistance !== null && existingDistance !== null) {
        if (visitDistance < existingDistance) chooseVisit = true;
        else if (visitDistance === existingDistance) {
          chooseVisit = visitPriority > existingPriority || (visit.infected && !existing.infected);
        }
      } else if (visitDistance !== null && existingDistance === null) {
        chooseVisit = true;
      } else if (visitDistance === null && existingDistance === null) {
        chooseVisit = visitPriority > existingPriority || (visit.infected && !existing.infected);
      }

      if (chooseVisit) byTimestamp.set(ts, visit);
    }

    const collapsed = Array.from(byTimestamp.values())
      .map((visit) => {
        const parsedTime = new Date(visit.timestamp);
        return Number.isNaN(parsedTime.getTime()) ? null : { ...visit, _parsedTime: parsedTime };
      })
      .filter(Boolean)
      .sort((a, b) => a._parsedTime - b._parsedTime);

    const sessions = [];
    let current = null;

    for (const visit of collapsed) {
      const facilityKey = visit.facility_code || visit.facility_name;
      if (!facilityKey) continue;

      const shouldStartNew = (
        !current ||
        current.facilityKey !== facilityKey ||
        (visit._parsedTime - current.sessionStart) / (1000 * 60 * 60) > mergeWindowHours
      );

      if (shouldStartNew) {
        if (current) sessions.push(current.visit);
        current = {
          facilityKey,
          sessionStart: visit._parsedTime,
          visit,
        };
      } else {
        if (visit.infected) current.visit.infected = true;
        if ((categoryPriority[visit.visit_category] || 0) > (categoryPriority[current.visit.visit_category] || 0)) {
          current.visit.visit_category = visit.visit_category;
        }
      }
    }

    if (current) sessions.push(current.visit);
    return sessions.map(({ _parsedTime, ...visit }) => visit);
  };

  const ensureVesselDetailModal = () => {
    let modal = document.getElementById('vesselDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'vesselDetailModal';
      modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:9999; padding:24px; overflow-y:auto;';
      modal.innerHTML = `
        <div style="max-width: 980px; margin: 0 auto; background: var(--panel); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 20px; position: relative;">
          <button id="closeVesselModal" aria-label="Lukk" style="position:absolute; top:12px; right:12px; background:transparent; border:none; color:var(--ink); font-size:1.3rem; cursor:pointer;">âœ•</button>
          <div id="vesselDetailContent"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    let content = document.getElementById('vesselDetailContent');
    if (!content) {
      content = document.createElement('div');
      content.id = 'vesselDetailContent';
      modal.appendChild(content);
    }

    let closeBtn = document.getElementById('closeVesselModal');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.id = 'closeVesselModal';
      closeBtn.textContent = 'âœ•';
      closeBtn.style.cssText = 'position:absolute; top:12px; right:12px; background:transparent; border:none; color:var(--ink); font-size:1.3rem; cursor:pointer;';
      modal.appendChild(closeBtn);
    }

    if (!modal.dataset.boundHandlers) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
      modal.dataset.boundHandlers = 'true';
    }

    return { modal, content };
  };
  
  const quarantineAnalysis = vessel.quarantine_analysis || {};
  const quarantineStatus = getEffectiveQuarantineStatus(vessel);
  const hasQuarantineBreach = quarantineAnalysis.has_quarantine_breach === true || quarantineStatus === 'QUARANTINE_BREACH';
  const hasActiveQuarantine = quarantineAnalysis.has_active_quarantine === true || quarantineStatus === 'QUARANTINE_ACTIVE';
  const confirmedInfectedCount = quarantineAnalysis.infected_facility_count ?? 0;
  const breachDetails = quarantineAnalysis.breach_details || null;

  const breachNarrativeHTML = hasQuarantineBreach && breachDetails
    ? (() => {
        const source = breachDetails.infected_source || 'Ukjent kilde';
        const destination = breachDetails.facility_name || 'ukjent anlegg';
        const hours = Number(breachDetails.hours_after_infection);
        const hoursText = Number.isFinite(hours) ? hours.toFixed(1) : 'ukjent';
        return `
          <div style="margin: 14px 0 18px 0; padding: 14px; background: rgba(220,38,38,0.12); border-left: 4px solid #dc2626; border-radius: 8px;">
            <div style="font-weight: 700; color: #fecaca; margin-bottom: 6px;">âš ï¸ Karantene-brudd oppdaget</div>
            <div style="color: #fee2e2; font-size: 0.95rem; line-height: 1.45;">
              Fra <strong>${source}</strong> til <strong>${destination}</strong> innen <strong>${hoursText} timer</strong>.
            </div>
          </div>
        `;
      })()
    : '';

  const visits = dedupeVisitsForDisplay(vessel.visits || []);
  const visitChain = visits
    .filter((visit) => !!visit.timestamp)
    .slice(-5)
    .reverse()
    .map((visit) => {
      const visitTime = new Date(visit.timestamp);
      const hoursAgo = Number.isNaN(visitTime.getTime())
        ? 0
        : ((Date.now() - visitTime.getTime()) / (1000 * 60 * 60));
      return {
        facility_code: visit.facility_code,
        facility_name: visit.facility_name,
        risk_level: visit.risk_level,
        infected: visit.infected,
        hours_ago: Math.max(0, Number.isFinite(hoursAgo) ? hoursAgo : 0),
      };
    });
  
  // Build timeline visualization
  let timelineHTML = '';
  if (visitChain.length > 0) {
    timelineHTML = `
      <div style="margin: 20px 0;">
        <h3 style="color: var(--accent); margin-bottom: 15px;">ðŸ“… 48-Hour Visit Timeline (Last 5 visits)</h3>
        <div style="position: relative; padding-left: 20px;">
          <div style="position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: var(--accent);"></div>
          ${visitChain.map((visit) => {
            const isInfected = visit.infected;
            const riskColor = visit.risk_level === 'ekstrem' || visit.risk_level === 'hÃ¸y' ? '#dc2626' : 
                             visit.risk_level === 'moderat' ? '#f97316' : '#6b7280';
            return `
              <div style="position: relative; margin-bottom: 20px; padding-left: 20px;">
                <div style="position: absolute; left: -12px; top: 5px; width: 16px; height: 16px; border-radius: 50%; background: ${riskColor}; border: 3px solid var(--darkBg);"></div>
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid ${riskColor};">
                  <div style="font-weight: 600; color: var(--ink);">
                    ${visit.facility_name || visit.facility_code || 'Unknown Facility'}
                    ${isInfected ? '<span style="color: #dc2626; margin-left: 8px;">ðŸ¦  INFECTED</span>' : ''}
                  </div>
                  <div style="color: var(--muted); font-size: 0.85rem; margin-top: 4px;">
                    ðŸ• ${visit.hours_ago.toFixed(1)} hours ago â€¢ 
                    ðŸŽ¯ Risk: ${visit.risk_level.toUpperCase()}
                  </div>
                </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // Build full visit details
  const allVisitsHTML = `
    <div style="margin: 20px 0;">
      <h3 style="color: var(--accent); margin-bottom: 15px;">ðŸ“ All Facility Visits (Last 7 days)</h3>
      <div style="display: grid; gap: 10px;">
        ${visits.map(visit => {
          const visitDate = visit.timestamp ? new Date(visit.timestamp).toLocaleString('no-NO') : 'Unknown';
          const isInfected = visit.infected;
          const riskColor = visit.risk_level === 'ekstrem' || visit.risk_level === 'hÃ¸y' ? '#dc2626' : 
                           visit.risk_level === 'moderat' ? '#f97316' : '#6b7280';
          return `
            <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 4px solid ${riskColor};">
              <div style="font-weight: 500; color: var(--ink);">
                ${visit.facility_name || visit.facility_code || 'Unknown'}
                ${isInfected ? '<span style="color: #dc2626; margin-left: 8px;">ðŸ¦  INFECTED</span>' : ''}
                ${(() => {
                  const cat = visit.visit_category;
                  if (cat === 'infected_facility' || cat === 'infected_facility_cluster') return '<span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">Infected</span>';
                  else if (cat === 'risk_zone_facility' || cat === 'risk_zone_cluster') return '<span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">Risk Zone</span>';
                  else if (cat === 'near_infected_10km') return '<span style="background: #eab308; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;"><10km</span>';
                  return '';
                })()}
              </div>
              <div style="color: var(--muted); font-size: 0.85rem; margin-top: 4px;">
                ðŸ“… ${visitDate} â€¢ â±ï¸ ${visit.duration_minutes || 0} min â€¢ 
                ðŸŽ¯ Risk: ${(visit.risk_level || 'unknown').toUpperCase()}
                ${visit.distance_meters ? ` â€¢ ðŸ“ ${(visit.distance_meters / 1000).toFixed(2)} km` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  // Build modal content
  const modalContent = `
    <h2 style="color: var(--accent); margin-bottom: 20px;">
      ðŸš¢ ${vessel.vessel_name || `Vessel ${vessel.mmsi}`}
    </h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">MMSI</div>
        <div style="color: var(--ink); font-weight: 600; font-size: 1.2rem;">${vessel.mmsi}</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">Risk Level</div>
        <div style="color: var(--ink); font-weight: 600; font-size: 1.2rem; text-transform: uppercase;">${vessel.highest_risk_level || 'lav'}</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">Visit Categories</div>
        <div style="margin-top: 8px;">
          ${(() => {
            const visits = vessel.visits || [];
            const categories = new Set();
            visits.forEach(visit => {
              const cat = visit.visit_category;
              if (cat === 'infected_facility' || cat === 'infected_facility_cluster') categories.add('infected');
              else if (cat === 'risk_zone_facility' || cat === 'risk_zone_cluster') categories.add('risk_zone');
              else if (cat === 'near_infected_10km') categories.add('near_10km');
            });
            let badges = '';
            if (categories.has('infected')) badges += '<span style="background: #dc2626; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block; margin-bottom: 4px;">ðŸ¦  Infected</span>';
            if (categories.has('risk_zone')) badges += '<span style="background: #f97316; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; display: inline-block; margin-bottom: 4px;">âš ï¸ Risk Zone</span>';
            if (categories.has('near_10km')) badges += '<span style="background: #eab308; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; display: inline-block; margin-bottom: 4px;">ðŸ“ <10km</span>';
            return badges || '<span style="color: #6b7280; font-size: 0.85rem;">No categories</span>';
          })()}
        </div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">Total Visits (7d)</div>
        <div style="color: var(--ink); font-weight: 600; font-size: 1.2rem;">${vessel.total_visits || 0}</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">Visited Infected</div>
        <div style="color: ${confirmedInfectedCount > 0 ? '#dc2626' : '#22c55e'}; font-weight: 600; font-size: 1.2rem;">${confirmedInfectedCount > 0 ? 'âš ï¸ YES' : 'NO'}</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
        <div style="color: var(--muted); font-size: 0.85rem;">48h Contact Chain</div>
        <div style="color: ${(hasQuarantineBreach || hasActiveQuarantine) ? '#f97316' : '#6b7280'}; font-weight: 600; font-size: 1.2rem;">${(hasQuarantineBreach || hasActiveQuarantine) ? 'ðŸ”— YES' : 'NO'}</div>
      </div>
    </div>
    ${breachNarrativeHTML}
    ${timelineHTML}
    ${allVisitsHTML}
  `;
  
  const modalElements = ensureVesselDetailModal();
  modalElements.content.innerHTML = modalContent;
  modalElements.modal.style.display = 'block';
}

async function loadFacilities() {
  if (typeof DataLoadingModule?.loadFacilities === "function") {
    try {
      await DataLoadingModule.loadFacilities();
      return;
    } catch (e) {
      console.warn("DataLoadingModule.loadFacilities failed:", e);
    }
  }
  const mode = getById("facilityMode")?.value || "all";
  const limit = Number(getById("facilityLimit")?.value || 50);
  const skip = Number(getById("facilitySkip")?.value || 0);
  const search = (getById("facilitySearch", "facility-search")?.value || "").toLowerCase();
  const lat = getById("facilityLat")?.value || "74.5";
  const lon = getById("facilityLon")?.value || "25";
  const radius = getById("facilityRadius")?.value || "10";

  elements.facilityTable.innerHTML = "<tr><td colspan=\"6\">Loading...</td></tr>";

  try {
    let data;
    if (mode === "near") {
      data = await apiFetch(`/api/facilities/near/${lat}/${lon}?radius_km=${radius}`);
      data.facilities = data.facilities || [];
    } else {
      data = await apiFetch(`/api/facilities?limit=${limit}&skip=${skip}&include_geo=true&refresh_geo=true`);
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
        return `
          <tr>
            <td>${item.code || "--"}</td>
            <td>${item.name || "--"}</td>
            <td>${item.municipality || "--"}</td>
            <td>${item.latitude?.toFixed(4) ?? "--"}</td>
            <td>${item.longitude?.toFixed(4) ?? "--"}</td>
            <td>${item.distance_km ?? "--"}</td>
          </tr>
        `;
      })
      .join("");

    state.loaded.facilities = true;
  } catch (error) {
    elements.facilityTable.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
  }
}

async function loadVessels() {
  if (typeof DataLoadingModule?.loadVessels === "function") {
    try {
      await DataLoadingModule.loadVessels();
      return;
    } catch (e) {
      console.warn("DataLoadingModule.loadVessels failed:", e);
    }
  }
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

async function searchVesselByName() {
  if (typeof DataLoadingModule?.searchVesselByName === "function") {
    try {
      await DataLoadingModule.searchVesselByName();
      return;
    } catch (e) {
      console.warn("DataLoadingModule.searchVesselByName failed:", e);
    }
  }
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

async function loadHealth() {
  if (typeof DataLoadingModule?.loadHealth === "function") {
    try {
      await DataLoadingModule.loadHealth();
      return;
    } catch (e) {
      console.warn("DataLoadingModule.loadHealth failed:", e);
    }
  }
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

async function loadOcean() {
  if (typeof DataLoadingModule?.loadOcean === "function") {
    try {
      await DataLoadingModule.loadOcean();
      return;
    } catch (e) {
      console.warn("DataLoadingModule.loadOcean failed:", e);
    }
  }
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

// ========================================
// CRITICAL ALERTS - QUARANTINE VESSELS AT HEALTHY FACILITIES
// ========================================

async function loadCriticalAlerts() {
  if (typeof AdminCoreModule?.loadCriticalAlerts === "function") {
    try {
      await AdminCoreModule.loadCriticalAlerts({
        apiFetch,
        documentRef: document
      });
      return;
    } catch (moduleError) {
      console.warn("Admin core module loadCriticalAlerts failed, using fallback in app.js:", moduleError);
    }
  }

  try {
    const data = await apiFetch("/api/admin/risk-alerts");
    
    // Update vessel category summary (based on facility type visited)
    const summary = data.summary || {};
    document.getElementById("statusInfectedVisit").textContent = summary.visited_infected_48h || 0;
    document.getElementById("statusRiskZoneVisit").textContent = summary.visited_risk_zone || 0;
    document.getElementById("status10kmVisit").textContent = summary.visited_10km_zone || 0;
    document.getElementById("statusCleared").textContent = summary.cleared || 0;
    
    // Update critical count
    const criticalCount = data.critical_events ? data.critical_events.length : 0;
    document.getElementById("criticalCount").textContent = criticalCount;
    
    // Render critical events
    const container = document.getElementById("criticalEventsContainer");
    
    if (criticalCount === 0) {
      container.innerHTML = `
        <div style="color: #10b981; padding: 2rem; text-align: center; font-size: 1rem;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">âœ…</div>
          <div><strong>Ingen karantenebrudd</strong></div>
          <div style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.85rem;">
            Alle bÃ¥ter med besÃ¸k ved smittet anlegg fÃ¸lger 48t karantenetid.
          </div>
        </div>
      `;
      return;
    }
    
    // Render each critical event
    let html = "";
    data.critical_events.forEach(event => {
      const vessel = event.vessel || {};
      const location = event.current_location || {};
      const assessment = event.risk_assessment || {};
      
      html += `
        <div style="background: #1f2937; border-left: 4px solid #dc2626; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
            <div>
              <div style="font-weight: 700; color: #f87171; font-size: 1rem; margin-bottom: 0.25rem;">
                ðŸš¢ ${vessel.name || "Ukjent bÃ¥t"}
              </div>
              <div style="font-size: 0.85rem; color: #9ca3af; font-family: 'IBM Plex Mono', monospace;">
                MMSI: ${vessel.mmsi || "N/A"} â€¢ ID: ${event.event_id || "N/A"}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
              <div style="background: #dc2626; color: white; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.85rem;">
                ${vessel.quarantine_hours_remaining || 0}t igjen
              </div>
              <div style="background: #f59e0b; color: white; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.75rem;">
                ${event.status || "uavklart"}
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <div style="font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                BesÃ¸kte smittet anlegg
              </div>
              <div style="color: #e5e7eb; font-size: 0.9rem;">
                ${vessel.last_infected_visit || "Ukjent anlegg"}
              </div>
              <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
                ${vessel.hours_since_infected || 0}t siden
              </div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                NÃ¥ observert ved
              </div>
              <div style="color: #10b981; font-weight: 600; font-size: 0.9rem;">
                ${location.facility_name || "Ukjent lokasjon"}
              </div>
              <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
                ${location.distance_km || "N/A"} km (${location.distance_meters || "N/A"}m)
              </div>
            </div>
          </div>
          
          <div style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 0.5rem; padding: 0.75rem;">
            <div style="display: flex; align-items: start; gap: 0.5rem; font-size: 0.85rem; color: #fca5a5; margin-bottom: 0.5rem;">
              <span style="font-size: 1.25rem;">âš ï¸</span>
              <div>
                <strong>RISIKO:</strong> ${assessment.description || "Karantenetid ikke oppfylt"}
              </div>
            </div>
            <div style="font-size: 0.8rem; color: #9ca3af; margin-left: 2rem;">
              ${assessment.biological_risk || ""}
            </div>
            <div style="font-size: 0.8rem; color: #fbbf24; margin-left: 2rem; margin-top: 0.25rem;">
              â†’ ${assessment.action_required || "Anlegget bÃ¸r varsles"}
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error("Error loading critical alerts:", error);
    document.getElementById("criticalEventsContainer").innerHTML = `
      <div style="color: #ef4444; padding: 2rem; text-align: center;">
        âŒ Feil ved lasting av kritiske hendelser: ${error.message}
      </div>
    `;
  }
}

function setupListeners() {
  if (typeof ListenersModule?.setupListeners === "function") {
    try {
      ListenersModule.setupListeners({
        elements,
        state,
        documentRef: document,
        alertFn: alert,
        loadAdmin,
        loadRisk,
        loadFacilityRisk,
        loadVesselRisk,
        loadPredictions,
        loadVesselClearing,
        loadConfirmedPlans,
        loadAuditLog,
        loadFacilities,
        loadVessels,
        loadOcean,
        loadSmittespredning,
        loadHealth,
        loadCriticalAlerts,
        searchVesselByName,
        renderVesselRisk,
        renderPredictions,
        renderVesselClearing,
        renderFacilityRisk,
        renderAdminVesselList,
        renderSmittespredning,
        showIsolateModal,
        showApproveModal,
        showFacilityDetails,
        showCorrelationDetail,
        closeModal,
        closeRiskFactorModal,
        openEventModal,
        getCorrelationData: () => correlationData,
        getNetworkGraph: () => networkGraph,
        resetGraphHighlight
      });
      return;
    } catch (moduleError) {
      console.warn("Listeners module setup failed, using fallback in app.js:", moduleError);
    }
  }

  console.log("[LISTENERS] Starting event listener setup...");
  console.log("[LISTENERS] Sample elements check:", {
    adminLoad: !!elements.adminLoad,
    loadRisk: !!elements.loadRisk,
    loadFacilityRisk: !!elements.loadFacilityRisk,
    loadVesselRisk: !!elements.loadVesselRisk
  });
  
  // Helper to safely attach event listener with logging
  const boundRegistry = new WeakMap();
  const safeAttach = (element, event, handler, debugName) => {
    if (element && typeof element.addEventListener === 'function') {
      const key = `${event}:${element.id || debugName || 'anonymous'}`;
      let boundKeys = boundRegistry.get(element);
      if (!boundKeys) {
        boundKeys = new Set();
        boundRegistry.set(element, boundKeys);
      }

      if (boundKeys.has(key)) {
        console.log(`[LISTENERS] ~ Skipped duplicate ${event} on ${debugName}`);
        return true;
      }

      element.addEventListener(event, handler);
      boundKeys.add(key);
      console.log(`[LISTENERS] âœ“ Attached ${event} to ${debugName}`);
      return true;
    } else {
      console.warn(`[LISTENERS] âœ— Failed to attach ${event} to ${debugName}`, element);
      return false;
    }
  };
  
  if (typeof coreLoadBindingsModule.setupCoreLoadBindings === "function") {
    try {
      coreLoadBindingsModule.setupCoreLoadBindings({
        documentRef: document,
        elements,
        safeAttach,
        loadAdmin,
        loadRisk,
        loadFacilityRisk,
        loadVesselRisk,
        loadPredictions,
        loadVesselClearing,
        loadConfirmedPlans,
        loadAuditLog,
        loadFacilities,
        loadVessels,
        loadOcean,
        loadSmittespredning,
        loadHealth,
        loadCriticalAlerts
      });
    } catch (moduleError) {
      console.warn("Core load bindings module setup failed, using fallback in app.js:", moduleError);
      safeAttach(elements.adminLoad, "click", () => { console.log("[CLICK] Admin Load"); loadAdmin(); }, "adminLoad");
      safeAttach(document.getElementById("admin-load"), "click", () => { console.log("[CLICK] Admin Load (admin-load)"); loadAdmin(); }, "admin-load");
      safeAttach(document.getElementById("admin-refresh"), "click", () => { console.log("[CLICK] Admin Refresh"); loadAdmin(); }, "admin-refresh");

      safeAttach(elements.loadRisk, "click", () => { console.log("[CLICK] Load Risk"); loadRisk(); }, "loadRisk");
      safeAttach(document.getElementById("risk-load"), "click", () => { console.log("[CLICK] Load Risk (risk-load)"); loadRisk(); }, "risk-load");

      safeAttach(elements.loadFacilityRisk, "click", () => { console.log("[CLICK] Load Facility Risk"); loadFacilityRisk(); }, "loadFacilityRisk");
      safeAttach(document.getElementById("facility-risk-load"), "click", () => { console.log("[CLICK] Facility Risk (facility-risk-load)"); loadFacilityRisk(); }, "facility-risk-load");

      safeAttach(elements.loadVesselRisk, "click", () => { console.log("[CLICK] Load Vessel Risk"); loadVesselRisk(); }, "loadVesselRisk");
      safeAttach(document.getElementById("vessel-risk-load"), "click", () => { console.log("[CLICK] Vessel Risk (vessel-risk-load)"); loadVesselRisk(); }, "vessel-risk-load");

      safeAttach(document.getElementById("predictionsLoad"), "click", () => { console.log("[CLICK] Predictions Load"); loadPredictions(); }, "predictionsLoad");
      safeAttach(document.getElementById("vessel-clearing-load"), "click", () => { console.log("[CLICK] Vessel Clearing"); loadVesselClearing(); }, "vessel-clearing-load");
      safeAttach(document.getElementById("confirmed-plans-load"), "click", () => { console.log("[CLICK] Confirmed Plans"); loadConfirmedPlans(); }, "confirmed-plans-load");
      safeAttach(document.getElementById("audit-load"), "click", () => { console.log("[CLICK] Audit Log"); loadAuditLog(); }, "audit-load");
      safeAttach(document.getElementById("facilities-load"), "click", () => { console.log("[CLICK] Facilities"); loadFacilities(); }, "facilities-load");
      safeAttach(document.getElementById("vessels-load"), "click", () => { console.log("[CLICK] Vessels"); loadVessels(); }, "vessels-load");
      safeAttach(document.getElementById("ocean-load"), "click", () => { console.log("[CLICK] Ocean"); loadOcean(); }, "ocean-load");
      safeAttach(document.getElementById("smitte-load"), "click", () => { console.log("[CLICK] Smitte"); loadSmittespredning(); }, "smitte-load");
      safeAttach(document.getElementById("health-load"), "click", () => { console.log("[CLICK] Health"); loadHealth(); }, "health-load");

      safeAttach(elements.loadVesselClearing, "click", () => { console.log("[CLICK] Load Vessel Clearing (legacy)"); loadVesselClearing(); }, "loadVesselClearing");
      safeAttach(elements.loadFacilities, "click", () => { console.log("[CLICK] Load Facilities (legacy)"); loadFacilities(); }, "loadFacilities");
      safeAttach(elements.loadVessels, "click", () => { console.log("[CLICK] Load Vessels (legacy)"); loadVessels(); }, "loadVessels");
      safeAttach(elements.loadHealth, "click", () => { console.log("[CLICK] Load Health (legacy)"); loadHealth(); }, "loadHealth");
      safeAttach(elements.loadOcean, "click", () => { console.log("[CLICK] Load Ocean (legacy)"); loadOcean(); }, "loadOcean");

      const refreshCriticalAlertsBtn = document.getElementById("refreshCriticalAlerts");
      safeAttach(refreshCriticalAlertsBtn, "click", loadCriticalAlerts);

      safeAttach(elements.confirmedPlansLoad, "click", () => { console.log("[CLICK] Confirmed Plans (legacy)"); loadConfirmedPlans(); }, "confirmedPlansLoad");
      if (elements.confirmedPlansMmsi) {
        safeAttach(elements.confirmedPlansMmsi, "keypress", (e) => {
          if (e.key === "Enter") loadConfirmedPlans();
        });
      }

      const auditLoadBtn = document.getElementById("loadAuditLog");
      safeAttach(auditLoadBtn, "click", () => { console.log("[CLICK] Audit Log (legacy loadAuditLog)"); loadAuditLog(); }, "loadAuditLog");
      const auditMmsiFilter = document.getElementById("auditMmsiFilter");
      if (auditMmsiFilter) {
        safeAttach(auditMmsiFilter, "keypress", (e) => {
          if (e.key === "Enter") loadAuditLog();
        });
      }

      safeAttach(elements.predictionsLoad, "click", () => { console.log("[CLICK] Predictions (legacy)"); loadPredictions(); }, "predictionsLoad-legacy");
    }
  } else {
    safeAttach(elements.adminLoad, "click", () => { console.log("[CLICK] Admin Load"); loadAdmin(); }, "adminLoad");
    safeAttach(document.getElementById("admin-load"), "click", () => { console.log("[CLICK] Admin Load (admin-load)"); loadAdmin(); }, "admin-load");
    safeAttach(document.getElementById("admin-refresh"), "click", () => { console.log("[CLICK] Admin Refresh"); loadAdmin(); }, "admin-refresh");

    safeAttach(elements.loadRisk, "click", () => { console.log("[CLICK] Load Risk"); loadRisk(); }, "loadRisk");
    safeAttach(document.getElementById("risk-load"), "click", () => { console.log("[CLICK] Load Risk (risk-load)"); loadRisk(); }, "risk-load");

    safeAttach(elements.loadFacilityRisk, "click", () => { console.log("[CLICK] Load Facility Risk"); loadFacilityRisk(); }, "loadFacilityRisk");
    safeAttach(document.getElementById("facility-risk-load"), "click", () => { console.log("[CLICK] Facility Risk (facility-risk-load)"); loadFacilityRisk(); }, "facility-risk-load");

    safeAttach(elements.loadVesselRisk, "click", () => { console.log("[CLICK] Load Vessel Risk"); loadVesselRisk(); }, "loadVesselRisk");
    safeAttach(document.getElementById("vessel-risk-load"), "click", () => { console.log("[CLICK] Vessel Risk (vessel-risk-load)"); loadVesselRisk(); }, "vessel-risk-load");

    safeAttach(document.getElementById("predictionsLoad"), "click", () => { console.log("[CLICK] Predictions Load"); loadPredictions(); }, "predictionsLoad");
    safeAttach(document.getElementById("vessel-clearing-load"), "click", () => { console.log("[CLICK] Vessel Clearing"); loadVesselClearing(); }, "vessel-clearing-load");
    safeAttach(document.getElementById("confirmed-plans-load"), "click", () => { console.log("[CLICK] Confirmed Plans"); loadConfirmedPlans(); }, "confirmed-plans-load");
    safeAttach(document.getElementById("audit-load"), "click", () => { console.log("[CLICK] Audit Log"); loadAuditLog(); }, "audit-load");
    safeAttach(document.getElementById("facilities-load"), "click", () => { console.log("[CLICK] Facilities"); loadFacilities(); }, "facilities-load");
    safeAttach(document.getElementById("vessels-load"), "click", () => { console.log("[CLICK] Vessels"); loadVessels(); }, "vessels-load");
    safeAttach(document.getElementById("ocean-load"), "click", () => { console.log("[CLICK] Ocean"); loadOcean(); }, "ocean-load");
    safeAttach(document.getElementById("smitte-load"), "click", () => { console.log("[CLICK] Smitte"); loadSmittespredning(); }, "smitte-load");
    safeAttach(document.getElementById("health-load"), "click", () => { console.log("[CLICK] Health"); loadHealth(); }, "health-load");

    safeAttach(elements.loadVesselClearing, "click", () => { console.log("[CLICK] Load Vessel Clearing (legacy)"); loadVesselClearing(); }, "loadVesselClearing");
    safeAttach(elements.loadFacilities, "click", () => { console.log("[CLICK] Load Facilities (legacy)"); loadFacilities(); }, "loadFacilities");
    safeAttach(elements.loadVessels, "click", () => { console.log("[CLICK] Load Vessels (legacy)"); loadVessels(); }, "loadVessels");
    safeAttach(elements.loadHealth, "click", () => { console.log("[CLICK] Load Health (legacy)"); loadHealth(); }, "loadHealth");
    safeAttach(elements.loadOcean, "click", () => { console.log("[CLICK] Load Ocean (legacy)"); loadOcean(); }, "loadOcean");

    const refreshCriticalAlertsBtn = document.getElementById("refreshCriticalAlerts");
    safeAttach(refreshCriticalAlertsBtn, "click", loadCriticalAlerts);

    safeAttach(elements.confirmedPlansLoad, "click", () => { console.log("[CLICK] Confirmed Plans (legacy)"); loadConfirmedPlans(); }, "confirmedPlansLoad");
    if (elements.confirmedPlansMmsi) {
      safeAttach(elements.confirmedPlansMmsi, "keypress", (e) => {
        if (e.key === "Enter") loadConfirmedPlans();
      });
    }

    const auditLoadBtn = document.getElementById("loadAuditLog");
    safeAttach(auditLoadBtn, "click", () => { console.log("[CLICK] Audit Log (legacy loadAuditLog)"); loadAuditLog(); }, "loadAuditLog");
    const auditMmsiFilter = document.getElementById("auditMmsiFilter");
    if (auditMmsiFilter) {
      safeAttach(auditMmsiFilter, "keypress", (e) => {
        if (e.key === "Enter") loadAuditLog();
      });
    }

    safeAttach(elements.predictionsLoad, "click", () => { console.log("[CLICK] Predictions (legacy)"); loadPredictions(); }, "predictionsLoad-legacy");
  }

  if (typeof vesselRiskFiltersModule.setupVesselRiskFilters === "function") {
    try {
      vesselRiskFiltersModule.setupVesselRiskFilters({
        documentRef: document,
        elements,
        state,
        safeAttach,
        renderVesselRisk
      });
    } catch (moduleError) {
      console.warn("Vessel risk filters module setup failed, using fallback in app.js:", moduleError);
      const visitCategoryFilterBtns = document.querySelectorAll('.visit-category-filter');

      const initializeFilterButtons = () => {
        visitCategoryFilterBtns.forEach(btn => {
          if (btn.dataset.category === state.visitCategoryFilter) {
            btn.style.opacity = '1';
          } else {
            btn.style.opacity = '0.6';
          }
        });
      };
      initializeFilterButtons();

      visitCategoryFilterBtns.forEach(btn => {
        safeAttach(btn, "click", function() {
          const category = this.dataset.category;
          state.visitCategoryFilter = category;
          initializeFilterButtons();
          renderVesselRisk();
        }, `visitCategoryFilter-${btn.dataset.category}`);
      });

      safeAttach(elements.vesselRiskLevel, "change", () => {
        renderVesselRisk();
      }, "vesselRiskLevel-change");

      safeAttach(elements.vesselChainFilter, "change", () => {
        renderVesselRisk();
      }, "vesselChainFilter-change");

      const vesselRiskCardInfected = document.getElementById('vesselRiskCardInfected');
      const vesselRiskCardHigh = document.getElementById('vesselRiskCardHigh');
      const vesselRiskCardChain = document.getElementById('vesselRiskCardChain');
      const vesselRiskCardTotal = document.getElementById('vesselRiskCardTotal');

      safeAttach(vesselRiskCardInfected, "click", () => {
        if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "infected";
        renderVesselRisk();
      }, "vesselRiskCardInfected");

      safeAttach(vesselRiskCardHigh, "click", () => {
        if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "risk_zone";
        renderVesselRisk();
      }, "vesselRiskCardHigh");

      safeAttach(vesselRiskCardChain, "click", () => {
        if (elements.vesselChainFilter) elements.vesselChainFilter.value = "true";
        renderVesselRisk();
      }, "vesselRiskCardChain");

      safeAttach(vesselRiskCardTotal, "click", () => {
        if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "all";
        if (elements.vesselChainFilter) elements.vesselChainFilter.value = "all";
        state.visitCategoryFilter = "all";
        initializeFilterButtons();
        renderVesselRisk();
      }, "vesselRiskCardTotal");
    }
  } else {
    const visitCategoryFilterBtns = document.querySelectorAll('.visit-category-filter');

    const initializeFilterButtons = () => {
      visitCategoryFilterBtns.forEach(btn => {
        if (btn.dataset.category === state.visitCategoryFilter) {
          btn.style.opacity = '1';
        } else {
          btn.style.opacity = '0.6';
        }
      });
    };
    initializeFilterButtons();

    visitCategoryFilterBtns.forEach(btn => {
      safeAttach(btn, "click", function() {
        const category = this.dataset.category;
        state.visitCategoryFilter = category;
        initializeFilterButtons();
        renderVesselRisk();
      }, `visitCategoryFilter-${btn.dataset.category}`);
    });

    safeAttach(elements.vesselRiskLevel, "change", () => {
      renderVesselRisk();
    }, "vesselRiskLevel-change");

    safeAttach(elements.vesselChainFilter, "change", () => {
      renderVesselRisk();
    }, "vesselChainFilter-change");

    const vesselRiskCardInfected = document.getElementById('vesselRiskCardInfected');
    const vesselRiskCardHigh = document.getElementById('vesselRiskCardHigh');
    const vesselRiskCardChain = document.getElementById('vesselRiskCardChain');
    const vesselRiskCardTotal = document.getElementById('vesselRiskCardTotal');

    safeAttach(vesselRiskCardInfected, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "infected";
      renderVesselRisk();
    }, "vesselRiskCardInfected");

    safeAttach(vesselRiskCardHigh, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "risk_zone";
      renderVesselRisk();
    }, "vesselRiskCardHigh");

    safeAttach(vesselRiskCardChain, "click", () => {
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "true";
      renderVesselRisk();
    }, "vesselRiskCardChain");

    safeAttach(vesselRiskCardTotal, "click", () => {
      if (elements.vesselRiskLevel) elements.vesselRiskLevel.value = "all";
      if (elements.vesselChainFilter) elements.vesselChainFilter.value = "all";
      state.visitCategoryFilter = "all";
      initializeFilterButtons();
      renderVesselRisk();
    }, "vesselRiskCardTotal");
  }

  const vesselLiceLoadBtn = document.getElementById("vessel-lice-risk-load");
  const vesselLiceSearchInput = document.getElementById("vesselLiceSearch");
  const vesselLiceRiskFilter = document.getElementById("vesselLiceRiskFilter");

  safeAttach(vesselLiceLoadBtn, "click", async () => {
    if (typeof vesselRiskModule.loadVesselLiceRiskOnly === "function") {
      await vesselRiskModule.loadVesselLiceRiskOnly({
        state,
        apiFetch,
        formatNumber,
      });
      return;
    }
    await loadVesselRisk();
  }, "vessel-lice-risk-load");

  safeAttach(vesselLiceSearchInput, "input", () => {
    if (typeof vesselRiskModule.renderVesselLiceRisk === "function") {
      vesselRiskModule.renderVesselLiceRisk({ state });
    }
  }, "vesselLiceSearch-input");

  safeAttach(vesselLiceRiskFilter, "change", () => {
    if (typeof vesselRiskModule.renderVesselLiceRisk === "function") {
      vesselRiskModule.renderVesselLiceRisk({ state });
    }
  }, "vesselLiceRiskFilter-change");

  // Predictions display filters (delegate to module with fallback)
  if (typeof predictionsZoneFiltersModule.setupPredictionsZoneFilters === "function") {
    try {
      predictionsZoneFiltersModule.setupPredictionsZoneFilters({
        documentRef: document,
        elements,
        state,
        safeAttach,
        renderPredictions
      });
    } catch (moduleError) {
      console.warn("Predictions zone filters module setup failed, using fallback in app.js:", moduleError);
      safeAttach(elements.showAllPredictionsToggle, "change", (e) => {
        state.filters.showAllPredictions = e.target.checked;
        renderPredictions();
        console.log("[FILTER] Show all predictions:", state.filters.showAllPredictions);
      }, "showAllPredictionsToggle");
      
      safeAttach(elements.showOnlyProtectionToggle, "change", (e) => {
        state.filters.showOnlyProtectionZones = e.target.checked;
        if (e.target.checked) {
          state.filters.showOnlySurveillanceZones = false;
          if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
        }
        renderPredictions();
        console.log("[FILTER] Show only protection zones:", state.filters.showOnlyProtectionZones);
      }, "showOnlyProtectionToggle");
      
      safeAttach(elements.showOnlySurveillanceToggle, "change", (e) => {
        state.filters.showOnlySurveillanceZones = e.target.checked;
        if (e.target.checked) {
          state.filters.showOnlyProtectionZones = false;
          if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
          if (elements.showOnlyWithin10kmToggle) elements.showOnlyWithin10kmToggle.checked = false;
          state.filters.showOnlyWithin10km = false;
        }
        renderPredictions();
        console.log("[FILTER] Show only surveillance zones:", state.filters.showOnlySurveillanceZones);
      }, "showOnlySurveillanceToggle");
      
      safeAttach(elements.showOnlyWithin10kmToggle, "change", (e) => {
        state.filters.showOnlyWithin10km = e.target.checked;
        if (e.target.checked) {
          state.filters.showOnlyProtectionZones = false;
          state.filters.showOnlySurveillanceZones = false;
          if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
          if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
        }
        renderPredictions();
        console.log("[FILTER] Show only within 10km zone:", state.filters.showOnlyWithin10km);
      }, "showOnlyWithin10kmToggle");
    }
  } else {
    safeAttach(elements.showAllPredictionsToggle, "change", (e) => {
      state.filters.showAllPredictions = e.target.checked;
      renderPredictions();
      console.log("[FILTER] Show all predictions:", state.filters.showAllPredictions);
    }, "showAllPredictionsToggle");
    
    safeAttach(elements.showOnlyProtectionToggle, "change", (e) => {
      state.filters.showOnlyProtectionZones = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlySurveillanceZones = false;
        if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
      }
      renderPredictions();
      console.log("[FILTER] Show only protection zones:", state.filters.showOnlyProtectionZones);
    }, "showOnlyProtectionToggle");
    
    safeAttach(elements.showOnlySurveillanceToggle, "change", (e) => {
      state.filters.showOnlySurveillanceZones = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlyProtectionZones = false;
        if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
        if (elements.showOnlyWithin10kmToggle) elements.showOnlyWithin10kmToggle.checked = false;
        state.filters.showOnlyWithin10km = false;
      }
      renderPredictions();
      console.log("[FILTER] Show only surveillance zones:", state.filters.showOnlySurveillanceZones);
    }, "showOnlySurveillanceToggle");
    
    safeAttach(elements.showOnlyWithin10kmToggle, "change", (e) => {
      state.filters.showOnlyWithin10km = e.target.checked;
      if (e.target.checked) {
        state.filters.showOnlyProtectionZones = false;
        state.filters.showOnlySurveillanceZones = false;
        if (elements.showOnlyProtectionToggle) elements.showOnlyProtectionToggle.checked = false;
        if (elements.showOnlySurveillanceToggle) elements.showOnlySurveillanceToggle.checked = false;
      }
      renderPredictions();
      console.log("[FILTER] Show only within 10km zone:", state.filters.showOnlyWithin10km);
    }, "showOnlyWithin10kmToggle");
  }
  
  // Vessel search by name (delegate to module with fallback)
  if (typeof vesselSearchModule.setupVesselSearch === "function") {
    try {
      vesselSearchModule.setupVesselSearch({
        documentRef: document,
        safeAttach,
        searchVesselByName
      });
    } catch (moduleError) {
      console.warn("Vessel search module setup failed, using fallback in app.js:", moduleError);
      const searchVesselBtn = document.getElementById("searchVesselBtn");
      safeAttach(searchVesselBtn, "click", searchVesselByName);
      const vesselSearchName = document.getElementById("vesselSearchName");
      if (vesselSearchName) {
        safeAttach(vesselSearchName, "keypress", (e) => {
          if (e.key === "Enter") searchVesselByName();
        });
      }
    }
  } else {
    const searchVesselBtn = document.getElementById("searchVesselBtn");
    safeAttach(searchVesselBtn, "click", searchVesselByName);
    const vesselSearchName = document.getElementById("vesselSearchName");
    if (vesselSearchName) {
      safeAttach(vesselSearchName, "keypress", (e) => {
        if (e.key === "Enter") searchVesselByName();
      });
    }
  }

  // Admin Correlation Actions
  if (typeof adminActionsModule.setupAdminActions === "function") {
    try {
      adminActionsModule.setupAdminActions({
        documentRef: document,
        safeAttach,
        showIsolateModal,
        showApproveModal,
        loadAdmin,
        alertFn: alert
      });
    } catch (moduleError) {
      console.warn("Admin actions module setup failed, using fallback in app.js:", moduleError);
      const adminActionIsolate = document.getElementById("adminActionIsolate");
      safeAttach(adminActionIsolate, "click", () => showIsolateModal());

      const adminActionApprove = document.getElementById("adminActionApprove");
      safeAttach(adminActionApprove, "click", () => showApproveModal());

      const adminActionRefresh = document.getElementById("adminActionRefresh");
      safeAttach(adminActionRefresh, "click", () => loadAdmin());

      const adminActionExport = document.getElementById("adminActionExport");
      safeAttach(adminActionExport, "click", () => {
        alert("ðŸ“„ EXPORT: Compliance report ready for download. (Coming soon)");
      });
    }
  } else {
    const adminActionIsolate = document.getElementById("adminActionIsolate");
    safeAttach(adminActionIsolate, "click", () => showIsolateModal());

    const adminActionApprove = document.getElementById("adminActionApprove");
    safeAttach(adminActionApprove, "click", () => showApproveModal());

    const adminActionRefresh = document.getElementById("adminActionRefresh");
    safeAttach(adminActionRefresh, "click", () => loadAdmin());

    const adminActionExport = document.getElementById("adminActionExport");
    safeAttach(adminActionExport, "click", () => {
      alert("ðŸ“„ EXPORT: Compliance report ready for download. (Coming soon)");
    });
  }

  // Priority list actions
  if (typeof priorityActionsModule.setupPriorityActions === "function") {
    try {
      priorityActionsModule.setupPriorityActions({
        documentRef: document,
        safeAttach,
        getCorrelationData: () => correlationData,
        showFacilityDetails,
        showCorrelationDetail,
        alertFn: alert
      });
    } catch (moduleError) {
      console.warn("Priority actions module setup failed, using fallback in app.js:", moduleError);
      document.addEventListener("click", (evt) => {
        const btn = evt.target.closest("button[data-action]");
        if (!btn) return;
        
        const priorityContainer = btn.closest("#adminPriorityList");
        if (!priorityContainer) return;

        const action = btn.dataset.action;
        
        if (action === "details") {
          const facilityCode = btn.dataset.facilityCode;
          if (facilityCode) {
            showFacilityDetails(facilityCode);
          }
        } else if (action === "notify") {
          const idx = parseInt(btn.dataset.index, 10);
          const top10 = correlationData.top_priority || [];
          if (idx >= 0 && idx < top10.length) {
            const link = top10[idx];
            alert(`Varsling sendt til ${link.facility_name} (${link.facility_code})`);
          }
        }
      });

      const priorityList = document.getElementById("adminPriorityList");
      if (priorityList) {
        safeAttach(priorityList, "click", (event) => {
          const button = event.target.closest("button[data-action]");
          if (!button) return;
          const index = Number(button.dataset.index || "0");
          const link = correlationData?.top_priority?.[index];
          if (!link) return;

          if (button.dataset.action === "details") {
            showCorrelationDetail(link);
          }

          if (button.dataset.action === "notify") {
            alert(`ðŸ“§ Notify: Sending alert to ${link.facility_name} regarding ${link.vessel_name}.`);
          }
        });
      }
    }
  } else {
    document.addEventListener("click", (evt) => {
      const btn = evt.target.closest("button[data-action]");
      if (!btn) return;
      
      const priorityContainer = btn.closest("#adminPriorityList");
      if (!priorityContainer) return;

      const action = btn.dataset.action;
      
      if (action === "details") {
        const facilityCode = btn.dataset.facilityCode;
        if (facilityCode) {
          showFacilityDetails(facilityCode);
        }
      } else if (action === "notify") {
        const idx = parseInt(btn.dataset.index, 10);
        const top10 = correlationData.top_priority || [];
        if (idx >= 0 && idx < top10.length) {
          const link = top10[idx];
          alert(`Varsling sendt til ${link.facility_name} (${link.facility_code})`);
        }
      }
    });

    const priorityList = document.getElementById("adminPriorityList");
    if (priorityList) {
      safeAttach(priorityList, "click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const index = Number(button.dataset.index || "0");
        const link = correlationData?.top_priority?.[index];
        if (!link) return;

        if (button.dataset.action === "details") {
          showCorrelationDetail(link);
        }

        if (button.dataset.action === "notify") {
          alert(`ðŸ“§ Notify: Sending alert to ${link.facility_name} regarding ${link.vessel_name}.`);
        }
      });
    }
  }

  // Graph controls
  if (typeof graphControlsModule.setupGraphControls === "function") {
    try {
      graphControlsModule.setupGraphControls({
        documentRef: document,
        safeAttach,
        getNetworkGraph: () => networkGraph,
        resetGraphHighlightFn: resetGraphHighlight
      });
    } catch (moduleError) {
      console.warn("Graph controls module setup failed, using fallback in app.js:", moduleError);
      const graphZoomIn = document.getElementById("graphZoomIn");
      safeAttach(graphZoomIn, "click", () => {
        if (!networkGraph) return;
        const scale = networkGraph.getScale();
        networkGraph.moveTo({ scale: scale * 1.2 });
      });

      const graphZoomOut = document.getElementById("graphZoomOut");
      safeAttach(graphZoomOut, "click", () => {
        if (!networkGraph) return;
        const scale = networkGraph.getScale();
        networkGraph.moveTo({ scale: scale / 1.2 });
      });

      const graphReset = document.getElementById("graphReset");
      safeAttach(graphReset, "click", () => {
        if (!networkGraph) return;
        resetGraphHighlight();
        networkGraph.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
      });
    }
  } else {
    const graphZoomIn = document.getElementById("graphZoomIn");
    safeAttach(graphZoomIn, "click", () => {
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale * 1.2 });
    });

    const graphZoomOut = document.getElementById("graphZoomOut");
    safeAttach(graphZoomOut, "click", () => {
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale / 1.2 });
    });

    const graphReset = document.getElementById("graphReset");
    safeAttach(graphReset, "click", () => {
      if (!networkGraph) return;
      resetGraphHighlight();
      networkGraph.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    });
  }

  // Modal events
  if (typeof modalEventsModule.setupModalEvents === "function") {
    try {
      modalEventsModule.setupModalEvents({
        documentRef: document,
        safeAttach,
        closeModal,
        closeRiskFactorModal,
        alertFn: alert
      });
    } catch (moduleError) {
      console.warn("Modal events module setup failed, using fallback in app.js:", moduleError);
      const isolateCancel = document.getElementById("isolateCancel");
      safeAttach(isolateCancel, "click", () => closeModal("isolateModal"));
      
      const isolateConfirm = document.getElementById("isolateConfirm");
      safeAttach(isolateConfirm, "click", () => {
        closeModal("isolateModal");
        alert("âœ… Isolation queued: High-risk vessels marked as pending.");
      });

      const approveCancel = document.getElementById("approveCancel");
      safeAttach(approveCancel, "click", () => closeModal("approveModal"));
      
      const approveConfirm = document.getElementById("approveConfirm");
      safeAttach(approveConfirm, "click", () => {
        closeModal("approveModal");
        alert("âœ… Approval queued: Cleared vessels marked as approved.");
      });

      const detailClose = document.getElementById("detailClose");
      safeAttach(detailClose, "click", () => closeModal("correlationDetailModal"));
      
      const detailNotify = document.getElementById("detailNotify");
      safeAttach(detailNotify, "click", () => {
        const modal = document.getElementById("correlationDetailModal");
        const facilityName = modal?.dataset?.facilityName || "Facility";
        const facilityEmail = modal?.dataset?.facilityEmail || "facility@example.com";
        alert(`ðŸ“§ Notify: Simulated email sent to ${facilityName} (${facilityEmail}).`);
        closeModal("correlationDetailModal");
      });

      ["isolateModal", "approveModal", "correlationDetailModal"].forEach((modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
          safeAttach(modal, "click", (event) => {
            if (event.target === modal) closeModal(modalId);
          });
        }
      });

      const riskFactorModal = document.getElementById("riskFactorModal");
      if (riskFactorModal) {
        riskFactorModal.querySelectorAll("[data-modal-close]").forEach((button) => {
          safeAttach(button, "click", closeRiskFactorModal);
        });
        safeAttach(riskFactorModal, "click", (event) => {
          if (event.target === riskFactorModal) closeRiskFactorModal();
        });
      }
    }
  } else {
    const isolateCancel = document.getElementById("isolateCancel");
    safeAttach(isolateCancel, "click", () => closeModal("isolateModal"));
    
    const isolateConfirm = document.getElementById("isolateConfirm");
    safeAttach(isolateConfirm, "click", () => {
      closeModal("isolateModal");
      alert("âœ… Isolation queued: High-risk vessels marked as pending.");
    });

    const approveCancel = document.getElementById("approveCancel");
    safeAttach(approveCancel, "click", () => closeModal("approveModal"));
    
    const approveConfirm = document.getElementById("approveConfirm");
    safeAttach(approveConfirm, "click", () => {
      closeModal("approveModal");
      alert("âœ… Approval queued: Cleared vessels marked as approved.");
    });

    const detailClose = document.getElementById("detailClose");
    safeAttach(detailClose, "click", () => closeModal("correlationDetailModal"));
    
    const detailNotify = document.getElementById("detailNotify");
    safeAttach(detailNotify, "click", () => {
      const modal = document.getElementById("correlationDetailModal");
      const facilityName = modal?.dataset?.facilityName || "Facility";
      const facilityEmail = modal?.dataset?.facilityEmail || "facility@example.com";
      alert(`ðŸ“§ Notify: Simulated email sent to ${facilityName} (${facilityEmail}).`);
      closeModal("correlationDetailModal");
    });

    ["isolateModal", "approveModal", "correlationDetailModal"].forEach((modalId) => {
      const modal = document.getElementById(modalId);
      if (modal) {
        safeAttach(modal, "click", (event) => {
          if (event.target === modal) closeModal(modalId);
        });
      }
    });

    const riskFactorModal = document.getElementById("riskFactorModal");
    if (riskFactorModal) {
      riskFactorModal.querySelectorAll("[data-modal-close]").forEach((button) => {
        safeAttach(button, "click", closeRiskFactorModal);
      });
      safeAttach(riskFactorModal, "click", (event) => {
        if (event.target === riskFactorModal) closeRiskFactorModal();
      });
    }
  }

  if (typeof uiFilterBindingsModule.setupUiFilterBindings === "function") {
    try {
      uiFilterBindingsModule.setupUiFilterBindings({
        documentRef: document,
        safeAttach,
        elements,
        state,
        renderVesselClearing,
        renderFacilityRisk,
        renderVesselRisk,
        renderAdminVesselList
      });
    } catch (moduleError) {
      console.warn("UI filter bindings module setup failed, using fallback in app.js:", moduleError);
      ["vesselStatusFilter", "vesselClearingSearch"].forEach((id) => {
        const el = document.getElementById(id);
        safeAttach(el, "input", renderVesselClearing);
      });

      if (elements.facilityViewList && elements.facilityViewTable) {
        safeAttach(elements.facilityViewList, "click", () => {
          state.facilityRiskView = "list";
          elements.facilityViewList.classList.add("active");
          elements.facilityViewTable.classList.remove("active");
          renderFacilityRisk();
        });

        safeAttach(elements.facilityViewTable, "click", () => {
          state.facilityRiskView = "table";
          elements.facilityViewTable.classList.add("active");
          elements.facilityViewList.classList.remove("active");
          renderFacilityRisk();
        });
      }

      ["vessel-risk-filter", "vessel-chain-filter", "vesselRiskLevel", "vesselChainFilter"].forEach((id) => {
        const el = document.getElementById(id);
        safeAttach(el, "input", renderVesselRisk);
      });

      ["adminVesselSpeed", "adminVesselSearch"].forEach((id) => {
        const el = document.getElementById(id);
        safeAttach(el, "input", renderAdminVesselList);
      });
    }
  } else {
    ["vesselStatusFilter", "vesselClearingSearch"].forEach((id) => {
      const el = document.getElementById(id);
      safeAttach(el, "input", renderVesselClearing);
    });

    if (elements.facilityViewList && elements.facilityViewTable) {
      safeAttach(elements.facilityViewList, "click", () => {
        state.facilityRiskView = "list";
        elements.facilityViewList.classList.add("active");
        elements.facilityViewTable.classList.remove("active");
        renderFacilityRisk();
      });

      safeAttach(elements.facilityViewTable, "click", () => {
        state.facilityRiskView = "table";
        elements.facilityViewTable.classList.add("active");
        elements.facilityViewList.classList.remove("active");
        renderFacilityRisk();
      });
    }

    ["vessel-risk-filter", "vessel-chain-filter", "vesselRiskLevel", "vesselChainFilter"].forEach((id) => {
      const el = document.getElementById(id);
      safeAttach(el, "input", renderVesselRisk);
    });

    ["adminVesselSpeed", "adminVesselSearch"].forEach((id) => {
      const el = document.getElementById(id);
      safeAttach(el, "input", renderAdminVesselList);
    });
  }

  if (typeof smitteListenersModule.setupSmitteListeners === "function") {
    try {
      smitteListenersModule.setupSmitteListeners({
        documentRef: document,
        safeAttach,
        elements,
        loadSmittespredning,
        renderSmittespredning,
        openEventModal
      });
    } catch (moduleError) {
      console.warn("Smitte listeners module setup failed, using fallback in app.js:", moduleError);
      safeAttach(elements.loadSmitte, "click", () => { console.log("[CLICK] Smitte (legacy loadSmitte)"); loadSmittespredning(); }, "loadSmitte-legacy");
      safeAttach(elements.refreshSmitte, "click", () => { console.log("[CLICK] Refresh Smitte"); loadSmittespredning(); }, "refreshSmitte");
      safeAttach(elements.smitteStatusFilter, "change", renderSmittespredning);

      const logEventBtn = document.getElementById("logEventBtn");
      safeAttach(logEventBtn, "click", openEventModal);
    }
  } else {
    safeAttach(elements.loadSmitte, "click", () => { console.log("[CLICK] Smitte (legacy loadSmitte)"); loadSmittespredning(); }, "loadSmitte-legacy");
    safeAttach(elements.refreshSmitte, "click", () => { console.log("[CLICK] Refresh Smitte"); loadSmittespredning(); }, "refreshSmitte");
    safeAttach(elements.smitteStatusFilter, "change", renderSmittespredning);

    const logEventBtn = document.getElementById("logEventBtn");
    safeAttach(logEventBtn, "click", openEventModal);
  }
  
  console.log("[LISTENERS] All event listeners attached successfully");
}

// ========================================
// SMITTESPREDNING (INFECTION PATHS) LOADER
// ========================================

async function loadSmittespredning() {
  if (typeof smittespredningModule.loadSmittespredning === "function") {
    try {
      await smittespredningModule.loadSmittespredning({
        elements,
        state,
        apiFetch,
        renderSmittespredning: smittespredningModule.renderSmittespredning,
      });
      return;
    } catch (moduleError) {
      console.warn("Smittespredning module load failed, using fallback in app.js:", moduleError);
    }
  }

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
    
    // Update stats
    const stats = {
      total: response.count || 0,
      DETECTED: 0,
      CONFIRMED_HEALTHY: 0,
      CONFIRMED_INFECTED: 0,
      UNCERTAIN: 0
    };
    
    state.smittespredning.forEach(event => {
      const status = event.path_risk_status; 
      if (stats[status] !== undefined) stats[status]++;
    });
    
    elements.smitteTotalPaths.textContent = stats.total;
    elements.smitteDetected.textContent = stats.DETECTED;
    elements.smitteHealthy.textContent = stats.CONFIRMED_HEALTHY;
    elements.smitteInfected.textContent = stats.CONFIRMED_INFECTED;
    elements.smitteUncertain.textContent = stats.UNCERTAIN;
    
    elements.smitteJson.textContent = JSON.stringify(response, null, 2);
    state.loaded.smittespredning = true;
    
    renderSmittespredning();
    if (window.updateInsightsPanel) window.updateInsightsPanel();
  } catch (error) {
    elements.smitteTableBody.innerHTML = `<tr><td colspan="8" class="text-center error">Error: ${error.message}</td></tr>`;
    elements.smitteJson.textContent = `Error: ${error.message}`;
  }
}

function renderSmittespredning() {
  if (typeof smittespredningModule.renderSmittespredning === "function") {
    try {
      smittespredningModule.renderSmittespredning({
        elements,
        state,
      });
      return;
    } catch (moduleError) {
      console.warn("Smittespredning module render failed, using fallback in app.js:", moduleError);
    }
  }

  const filter = elements.smitteStatusFilter?.value || "";
  const filtered = filter 
    ? state.smittespredning.filter(e => e.path_risk_status === filter)
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
  filtered.forEach(event => {
    const startTime = new Date(event.timestamp_start).toLocaleString("no-NO");
    const endTime = event.timestamp_end ? new Date(event.timestamp_end).toLocaleString("no-NO") : "--";
    const statusColor = {
      "DETECTED": "#fbbf24",
      "CONFIRMED_HEALTHY": "#10b981",
      "CONFIRMED_INFECTED": "#ef4444",
      "UNCERTAIN": "#6b7280"
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
          <div style="font-size: 0.8rem; color: #f87171;">ðŸ§¬ ${event.facility_start_disease}</div>
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

// ========================================
// EVENT LOGGING FORM (SMITTESPREDNING)
// ========================================

async function openEventModal() {
  const modal = document.getElementById("eventModal");
  if (!modal) return;
  
  // Load facilities list if not already loaded
  try {
    const resp = await apiFetch("/api/facilities?limit=3000");
    const facilities = resp.facilities || resp.items || [];
    
    const selectFrom = document.getElementById("eventFacilityFrom");
    const selectTo = document.getElementById("eventFacilityTo");
    
    if (selectFrom && selectTo) {
      selectFrom.innerHTML = '<option value="">-- Select facility --</option>';
      selectTo.innerHTML = '<option value="">-- Select if known --</option>';
      
      facilities.forEach(f => {
        const id = f.code || f.localityNo || f.id;
        const name = f.name || f.locality?.name || id;
        
        selectFrom.innerHTML += `<option value="${id}">${name}</option>`;
        selectTo.innerHTML += `<option value="${id}">${name}</option>`;
      });
    }
  } catch (e) {
    console.warn("Could not load facilities:", e);
  }
  
  modal.style.display = "flex";
}

function closeEventModal() {
  const modal = document.getElementById("eventModal");
  if (modal) {
    modal.style.display = "none";
    // Reset form
    document.getElementById("eventForm").reset();
    document.getElementById("eventFormError").style.display = "none";
  }
}

function validateEventForm() {
  const mmsi = document.getElementById("eventMMSI").value.trim();
  const facilityFrom = document.getElementById("eventFacilityFrom").value;
  const errorDiv = document.getElementById("eventFormError");
  const mmsiErrorDiv = document.getElementById("eventMMSIError");
  
  errorDiv.style.display = "none";
  mmsiErrorDiv.style.display = "none";
  
  // Validate MMSI (must be 9 digits)
  if (!mmsi || mmsi.length !== 9 || !/^\d+$/.test(mmsi)) {
    mmsiErrorDiv.textContent = "MMSI must be exactly 9 digits";
    mmsiErrorDiv.style.display = "block";
    return false;
  }
  
  // Validate facility selection
  if (!facilityFrom) {
    errorDiv.textContent = "Please select a facility (origin)";
    errorDiv.style.display = "block";
    return false;
  }
  
  return true;
}

async function submitEventForm() {
  if (!validateEventForm()) return;
  
  const mmsi = document.getElementById("eventMMSI").value.trim();
  const facilityFrom = document.getElementById("eventFacilityFrom").value;
  const facilityTo = document.getElementById("eventFacilityTo").value || null;
  const disease = document.querySelector("input[name='eventDisease']:checked")?.value || "ILA";
  const detectedVia = document.querySelector("input[name='eventDetected']:checked")?.value || "MANUAL";
  const status = document.getElementById("eventStatus").value;
  const notes = document.getElementById("eventNotes").value;
  
  const errorDiv = document.getElementById("eventFormError");
  
  try {
    const response = await apiFetch("/api/exposure/smittespredning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_mmsi: mmsi,
        vessel_name: `Vessel-${mmsi}`,
        facility_start_id: facilityFrom,
        facility_start_disease: disease,
        facility_end_id: facilityTo,
        path_risk_status: status,
        detected_via: detectedVia,
        notes: notes || "Manually logged via admin dashboard"
      })
    });
    
    if (response.event_id || response.id) {
      alert(`âœ“ Event created successfully (ID: ${response.event_id || response.id})`);
      closeEventModal();
      loadSmittespredning(); // Refresh the table
    } else {
      errorDiv.textContent = "Failed to create event";
      errorDiv.style.display = "block";
    }
  } catch (error) {
    errorDiv.textContent = `Error: ${error.message}`;
    errorDiv.style.display = "block";
    console.error("Form submission error:", error);
  }
}

// Close modal when clicking outside (delegate to module with fallback)
document.addEventListener("DOMContentLoaded", () => {
  if (!window.__kystDashboardInitialized) {
    window.__kystDashboardInitialized = true;
    initializeElements();
    setupTabs();
    setupListeners();
    loadOverview();
  }

  // Setup modal close handlers (delegate to module with fallback)
  if (typeof domInitModule.setupDOMInit === "function") {
    try {
      domInitModule.setupDOMInit({
        closeEventModalFn: closeEventModal,
        closeTransmissionModalFn: closeTransmissionModal,
        closeRiskFactorModalFn: closeRiskFactorModal
      });
    } catch (moduleError) {
      console.warn("DOM init module setup failed, using fallback in app.js:", moduleError);
      const eventModal = document.getElementById("eventModal");
      if (eventModal) {
        window.addEventListener("click", (e) => {
          if (e.target === eventModal) {
            closeEventModal();
          }
        });
      }

      const transmissionModal = document.getElementById("transmissionModal");
      if (transmissionModal) {
        const backdrop = transmissionModal.querySelector(".modal-backdrop");
        const closeBtn = transmissionModal.querySelector(".modal-close");
        
        if (backdrop) {
          backdrop.addEventListener("click", () => closeTransmissionModal());
        }
        if (closeBtn) {
          closeBtn.addEventListener("click", () => closeTransmissionModal());
        }
        
        window.addEventListener("click", (e) => {
          if (e.target === transmissionModal) {
            closeTransmissionModal();
          }
        });
      }

      const riskFactorModal = document.getElementById("riskFactorModal");
      if (riskFactorModal) {
        const backdrop = riskFactorModal.querySelector(".modal-backdrop");
        const closeBtn = riskFactorModal.querySelector(".modal-close");
        
        if (backdrop) {
          backdrop.addEventListener("click", () => closeRiskFactorModal());
        }
        if (closeBtn) {
          closeBtn.addEventListener("click", () => closeRiskFactorModal());
        }
      }
    }
  } else {
    const eventModal = document.getElementById("eventModal");
    if (eventModal) {
      window.addEventListener("click", (e) => {
        if (e.target === eventModal) {
          closeEventModal();
        }
      });
    }

    const transmissionModal = document.getElementById("transmissionModal");
    if (transmissionModal) {
      const backdrop = transmissionModal.querySelector(".modal-backdrop");
      const closeBtn = transmissionModal.querySelector(".modal-close");
      
      if (backdrop) {
        backdrop.addEventListener("click", () => closeTransmissionModal());
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => closeTransmissionModal());
      }
      
      window.addEventListener("click", (e) => {
        if (e.target === transmissionModal) {
          closeTransmissionModal();
        }
      });
    }

    const riskFactorModal = document.getElementById("riskFactorModal");
    if (riskFactorModal) {
      const backdrop = riskFactorModal.querySelector(".modal-backdrop");
      const closeBtn = riskFactorModal.querySelector(".modal-close");
      
      if (backdrop) {
        backdrop.addEventListener("click", () => closeRiskFactorModal());
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => closeRiskFactorModal());
      }
    }
  }

  // ========================================
  // LIVE SEARCH FUNCTIONALITY
  // ========================================
  
  function setupLiveSearch(searchInputId, tableSelector, columnIndices) {
    const searchInput = document.getElementById(searchInputId);
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      const tbody = document.querySelector(tableSelector);
      if (!tbody) return;

      const rows = tbody.getElementsByTagName('tr');
      
      for (let row of rows) {
        if (row.cells.length === 0) continue;
        
        let matchFound = false;
        for (let colIndex of columnIndices) {
          if (row.cells[colIndex]) {
            const cellText = row.cells[colIndex].textContent.toLowerCase();
            if (cellText.includes(searchTerm)) {
              matchFound = true;
              break;
            }
          }
        }
        
        row.style.display = matchFound ? '' : 'none';
      }
    });
  }

  // Setup search for each section
  setupLiveSearch('predictionsSearch', '#predictions-table', [1, 2]); // SÃ¸k i anlegg og score
  setupLiveSearch('facilityRiskSearch', '#facility-risk-table', [0, 1]); // SÃ¸k i anlegg og kommune
  setupLiveSearch('vesselRiskSearch', '#vessel-risk-table', [0, 1]); // SÃ¸k i MMSI og bÃ¥tnavn

  // ========================================
  // SORTABLE COLUMNS FUNCTIONALITY
  // ========================================
  
  function setupSortableColumns() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const table = this.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.cells.length > 1);
        const columnIndex = Array.from(this.parentNode.children).indexOf(this);
        const column = this.dataset.column;
        
        // Toggle sort direction
        const currentDir = this.dataset.sortDir || 'none';
        let newDir = 'asc';
        if (currentDir === 'asc') newDir = 'desc';
        if (currentDir === 'desc') newDir = 'none';
        
        // Reset all other headers
        sortableHeaders.forEach(h => {
          if (h !== this) {
            h.dataset.sortDir = 'none';
            const arrow = h.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = 'â†•ï¸';
          }
        });
        
        this.dataset.sortDir = newDir;
        const arrow = this.querySelector('.sort-arrow');
        if (arrow) {
          if (newDir === 'asc') arrow.textContent = 'â†‘';
          else if (newDir === 'desc') arrow.textContent = 'â†“';
          else arrow.textContent = 'â†•ï¸';
        }
        
        if (newDir === 'none') {
          // Return to original order - do nothing
          return;
        }
        
        // Sort rows
        rows.sort((a, b) => {
          const aText = a.cells[columnIndex]?.textContent.trim() || '';
          const bText = b.cells[columnIndex]?.textContent.trim() || '';
          
          // Try numeric comparison first
          const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
          const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
          
          let comparison = 0;
          if (!isNaN(aNum) && !isNaN(bNum)) {
            comparison = aNum - bNum;
          } else {
            comparison = aText.localeCompare(bText);
          }
          
          return newDir === 'asc' ? comparison : -comparison;
        });
        
        // Re-append rows in sorted order
        rows.forEach(row => tbody.appendChild(row));
      });
    });
  }

  setupSortableColumns();

  // ========================================
  // INSIGHTS PANEL UPDATE
  // ========================================
  
  function updateInsightsPanel() {
    // Update critical facilities count
    const criticalCount = state.predictions.filter(p => p.risk_level === 'Critical').length;
    const alertCritical = document.getElementById('alert-critical');
    if (alertCritical) {
      alertCritical.textContent = criticalCount;
    }

    // Update vessels at infected facilities
    const vesselsAtInfected = state.vesselRisk.filter(v => 
      v.visits?.some(visit => visit.visit_category === 'infected_facility')
    ).length;
    const alertVessels = document.getElementById('alert-vessels');
    if (alertVessels) {
      alertVessels.textContent = vesselsAtInfected;
    }

    // Update active chains (from smittespredning)
    const activeChains = state.smittespredning.filter(e => 
      e.path_risk_status === 'DETECTED' || e.path_risk_status === 'CONFIRMED_INFECTED'
    ).length;
    const alertChains = document.getElementById('alert-chains');
    if (alertChains) {
      alertChains.textContent = activeChains;
    }

    // Update cleared vessels
    const clearedVessels = state.vesselClearing.filter(v => v.status === 'cleared').length;
    const alertCleared = document.getElementById('alert-cleared');
    if (alertCleared) {
      alertCleared.textContent = clearedVessels;
    }

    // Update critical alerts list
    const criticalAlerts = [];
    
    if (criticalCount > 5) {
      criticalAlerts.push(`${criticalCount} anlegg med kritisk utbruddsrisiko`);
    }
    if (vesselsAtInfected > 10) {
      criticalAlerts.push(`${vesselsAtInfected} bÃ¥ter har besÃ¸kt smittede anlegg`);
    }
    if (activeChains > 3) {
      criticalAlerts.push(`${activeChains} aktive smittekjeder detektert`);
    }

    const alertsContainer = document.getElementById('criticalAlerts');
    const alertsList = document.getElementById('criticalAlertsList');
    if (alertsContainer && alertsList) {
      if (criticalAlerts.length > 0) {
        alertsContainer.style.display = 'block';
        alertsList.innerHTML = criticalAlerts.map(alert => 
          `<li>${alert}</li>`
        ).join('');
      } else {
        alertsContainer.style.display = 'none';
      }
    }
  }

  // Make updateInsightsPanel globally accessible so it can be called after data loads
  window.updateInsightsPanel = updateInsightsPanel;

  // ========================================
  // AUTO-REFRESH FUNCTIONALITY
  // ========================================
  
  let autoRefreshInterval = null;

  function setupAutoRefresh() {
    const toggleCheckbox = document.getElementById('autoRefreshToggle');
    const lastRefreshTime = document.getElementById('lastRefreshTime');

    if (!toggleCheckbox) return;

    toggleCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Start auto-refresh
        autoRefreshInterval = setInterval(async () => {
          console.log('Auto-refresh: Updating data...');
          
          // Get currently active section
          const activeSection = document.querySelector('.panel.active');
          if (!activeSection) return;

          const sectionId = activeSection.id;
          
          // Refresh based on active section
          switch(sectionId) {
            case 'predictions':
              await loadPredictions();
              break;
            case 'vessel-risk':
              await loadVesselRisk();
              break;
            case 'facility-risks':
              await loadFacilityRisk();
              break;
            case 'smittespredning':
              await loadSmittespredning();
              break;
            case 'vessel-clearing':
              await loadVesselClearing();
              break;
            case 'overview':
              await loadOverview();
              break;
          }

          // Update timestamp
          const now = new Date();
          if (lastRefreshTime) {
            lastRefreshTime.textContent = now.toTimeString().substring(0, 8);
          }
        }, 30000); // Refresh every 30 seconds

        console.log('Auto-refresh enabled (30s interval)');
      } else {
        // Stop auto-refresh
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
          autoRefreshInterval = null;
          console.log('Auto-refresh disabled');
        }
      }
    });
  }

  setupAutoRefresh();

  // Initial insights panel update
  updateInsightsPanel();
});

