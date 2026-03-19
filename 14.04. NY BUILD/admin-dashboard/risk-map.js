/**
 * risk-map.js
 * Risk prediction map visualization
 * Shows infected facilities and vessels at risk in quarantine zone (< 5km)
 */

let riskMap = null;
let infectedMarkers = [];
let vesselRiskMarkers = [];
let smittezoneCircles = [];

function hasHighLice(data) {
  if (!data || typeof data !== 'object') return false;
  return data.lice_over_threshold === true
    || data.liceHigh === true
    || data.high_lice === true
    || data?.lice?.over_threshold === true
    || data?.lice_data?.over_threshold === true;
}

function buildSplitCircleHtml({ baseColor, borderColor = '#ffffff', size = 20, label = '', liceHigh = false, fontSize = 10, borderWidth = 2 }) {
  const background = liceHigh
    ? `linear-gradient(90deg, ${baseColor} 0 50%, #7c3aed 50% 100%)`
    : baseColor;

  return `<div style="
    background: ${background};
    border: ${borderWidth}px solid ${borderColor};
    border-radius: 50%;
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: ${fontSize}px;
    box-shadow: 0 0 8px rgba(0,0,0,0.45);
  ">${label}</div>`;
}

/**
 * Initialize and show risk map
 * Only renders infected facilities + vessels within quarantine zone
 */
async function initRiskMap() {
  
  
  // Get center of Norway (approximation)
  const center = [66, 15];
  
  // Create map
  riskMap = L.map('riskMapContainer').setView(center, 6);
  
  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap | Disease Risk Visualization',
    maxZoom: 18
  }).addTo(riskMap);
  
  
  
  // Load and display infected facilities + at-risk vessels
  await loadRiskData();
}

/**
 * Load predictions and display infected facilities + vessels at risk
 */
async function loadRiskData() {
  try {
    // Get current predictions
    const data = await apiFetch("/api/risk/predictions/all");
    if (!data.top_20_by_risk || data.top_20_by_risk.length === 0) {
      
      const demoData = await apiFetch("/api/risk/predictions/demo");
      displayRiskOnMap(demoData.top_20_by_risk);
    } else {
      displayRiskOnMap(data.top_20_by_risk);
    }
  } catch (error) {
    console.error("Error loading risk data:", error);
  }
}

/**
 * Display risk predictions on map
 * Only show: Critical + Medium risk facilities
 */
function displayRiskOnMap(predictions) {
  if (!riskMap || !predictions) return;
  
  // Filter: Only show critical and medium risk
  const riskyFacilities = predictions.filter(p => 
    p.risk_level === "Critical" || p.risk_level === "Medium"
  );
  
  
  
  // Clear old markers
  infectedMarkers.forEach(m => riskMap.removeLayer(m));
  infectedMarkers = [];
  
  smittezoneCircles.forEach(c => riskMap.removeLayer(c));
  smittezoneCircles = [];
  
  // Add infected facility markers
  riskyFacilities.forEach(pred => {
    const liceHigh = hasHighLice(pred);

    // Source facility (infected)
    if (pred.source_latitude && pred.source_longitude) {
      const sourceIcon = L.divIcon({
        className: 'infected-marker',
        html: buildSplitCircleHtml({
          baseColor: '#dc2626',
          borderColor: '#991b1b',
          size: 24,
          label: '⚠',
          liceHigh,
          fontSize: 12,
          borderWidth: 3
        }),
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      const sourceMarker = L.marker(
        [pred.source_latitude, pred.source_longitude],
        { icon: sourceIcon }
      ).addTo(riskMap)
        .bindPopup(`
          <strong style="color: #dc2626;">🦟 INFECTED</strong><br>
          ${liceHigh ? '<strong style="color: #7c3aed;">🟣 Høge lusetal</strong><br>' : ''}
          <strong>${pred.source_facility_name}</strong><br>
          Disease: ${pred.primary_disease}<br>
          Coords: ${pred.source_latitude?.toFixed(3) || "?"}, ${pred.source_longitude?.toFixed(3) || "?"}
        `);
      
      infectedMarkers.push(sourceMarker);
      
      // Draw quarantine zone (5km radius)
      const quarantineZone = L.circle(
        [pred.source_latitude, pred.source_longitude],
        { radius: 5000, color: '#dc2626', fill: true, fillColor: '#fca5a5', weight: 2, opacity: 0.3 }
      ).addTo(riskMap);
      
      smittezoneCircles.push(quarantineZone);
    }
    
    // At-risk facility
    const riskColor = pred.risk_level === "Critical" ? "#ef4444" : "#eab308";
    const riskScore = pred.outbreak_risk_pct || pred.risk_score || 0;
    const riskIcon = L.divIcon({
      className: 'at-risk-marker',
      html: buildSplitCircleHtml({
        baseColor: riskColor,
        size: 20,
        label: riskScore > 50 ? '!' : '?',
        liceHigh,
        fontSize: 10,
        borderWidth: 2
      }),
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    const riskMarker = L.marker(
      [pred.latitude, pred.longitude],
      { icon: riskIcon }
    ).addTo(riskMap)
      .bindPopup(`
        <strong style="color: ${riskColor};">${pred.risk_level.toUpperCase()}</strong><br>
        ${liceHigh ? '<strong style="color: #7c3aed;">🟣 Luserisiko (delt markør)</strong><br>' : ''}
        <strong>${pred.facility_name}</strong><br>
        Risk: ${(pred.outbreak_risk_pct || pred.risk_score || 0).toFixed(1)}%<br>
        Distance to source: ${(pred.distance_to_nearest_infected_km || pred.distance_to_source_km || 0).toFixed(1)}km<br>
        Coords: ${pred.latitude?.toFixed(3) || "?"}, ${pred.longitude?.toFixed(3) || "?"}
      `);
    
    infectedMarkers.push(riskMarker);
  });
  
  // Set map bounds to show all markers
  if (infectedMarkers.length > 0) {
    const group = new L.featureGroup(infectedMarkers);
    riskMap.fitBounds(group.getBounds().pad(0.1));
  }
  
  
}

/**
 * Toggle risk map visibility (lazy-load)
 */
function toggleRiskMap() {
  const mapContainer = document.getElementById('riskMapContainer');
  if (!mapContainer) return;
  
  if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
    mapContainer.style.display = 'block';
    
    
    // Initialize map if not already done
    if (!riskMap) {
      setTimeout(() => initRiskMap(), 100);
    } else {
      riskMap.invalidateSize();
    }
  } else {
    mapContainer.style.display = 'none';
  }
}
