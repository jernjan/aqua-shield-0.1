/**
 * correlation-network-module.js
 * 
 * Handles correlation network visualization and outbreak cluster analysis:
 * - Network graph rendering with vis-network
 * - Priority list of high-risk vessel-facility connections
 * - Outbreak cluster detection and visualization
 * - Infected and affected facilities lists
 */

window.AdminCorrelationNetworkModule = (function() {
  'use strict';

  // Module-scoped state
  let correlationData = null;
  let networkGraph = null;
  let selectedNodeId = null;
  let highlightedNodes = new Set();
  let highlightedEdges = new Set();

  // Global cluster color mapping (consistent colors across views)
  const clusterColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

  /**
   * Set correlation data for rendering
   */
  function setCorrelationData(data) {
    correlationData = data;
  }

  /**
   * Get correlation data (for external access if needed)
   */
  function getCorrelationData() {
    return correlationData;
  }

  /**
   * Helper: Calculate days since last contact from various link properties
   */
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

  /**
   * Helper: Get cluster color by cluster ID
   */
  function getClusterColor(clusterId) {
    return clusterColors[(clusterId - 1) % clusterColors.length];
  }

  /**
   * Helper: Find which cluster a facility belongs to
   */
  function getFacilityCluster(facilityCode) {
    const clusters = correlationData?.outbreak_clusters || [];
    for (const cluster of clusters) {
      if (cluster.facilities && cluster.facilities.some(f => f.code === facilityCode)) {
        return cluster;
      }
    }
    return null;
  }

  /**
   * Reset network graph highlight (show all nodes/edges normally)
   */
  function resetGraphHighlight() {
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

  /**
   * Apply highlight to specific node and its connections
   */
  function applyGraphHighlight(nodeId) {
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

  /**
   * Render network graph visualization using vis-network
   */
  function renderNetworkGraph() {
    const container = document.getElementById("adminNetworkContainer");
    if (!container) return;

    if (typeof vis === "undefined" || !vis.Network || !vis.DataSet) {
      container.innerHTML = '<div style="padding: 1rem; color: #f59e0b; text-align: center;">⚠️ Network-graf kunne ikkje lastast (vis-network manglar).</div>';
      networkGraph = null;
      return;
    }

    const infected = correlationData?.infected_facilities || [];
    const links = correlationData?.vessel_facility_links || [];

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

  /**
   * Render priority list of high-risk vessel-facility connections
   */
  function renderPriorityList() {
    const container = document.getElementById("adminPriorityList");
    if (!container) return;
    const top10 = correlationData?.top_priority || [];

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
        💡 Fargede striper = anlegget er del av en utbruddsklynge (se under for detaljer)
      </div>
    `;
  }

  /**
   * Render outbreak clusters visualization
   */
  function renderOutbreakClusters() {
    const container = document.getElementById("adminOutbreakClusters");
    if (!container) return;

    const clusters = correlationData?.outbreak_clusters || [];
    const summary = correlationData?.outbreak_cluster_summary || {};

    if (!clusters.length) {
      container.innerHTML = `
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;color:#9ca3af;">
          Ingen tydelige utbruddsklynger i 120-dagers vindu. Dette kan bety god smittekontroll! ✓
        </div>
      `;
      return;
    }

    const summaryBar = `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
        <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Klynger</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_clusters ?? clusters.length}</div></div>
        <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Anlegg i klynger</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_facilities_in_clusters ?? "-"}</div></div>
        <div style="padding:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.78rem;">Brobåter</div><div style="color:#e5e7eb;font-weight:700;">${summary.total_bridge_vessels ?? "-"}</div></div>
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
              <div style="color:#9ca3af;font-size:0.75rem;">Kode: ${f.code} · ${f.vessel_count} båter</div>
            </div>
            <div style="color:#9ca3af;font-size:0.75rem;text-align:right;">
              <div>Dag +${daysSinceFirst}</div>
            </div>
          </div>
        `;
      }).join("");

      const topPath = (cluster.top_paths && cluster.top_paths.length)
        ? `${cluster.top_paths[0].from_facility} → ${cluster.top_paths[0].to_facility} (${cluster.top_paths[0].vessel_count} båter, ${cluster.top_paths[0].distance_km?.toFixed(1) || '?'} km)`
        : "-";

      return `
        <div style="border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${clusterColor};border-radius:8px;background:#0b1424;padding:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="color:${clusterColor};font-weight:700;font-size:0.9rem;">🔗 Klynge #${cluster.cluster_id}</div>
              <div style="color:#9ca3af;font-size:0.8rem;margin-top:2px;">Startet: ${cluster.start_facility_name}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:#e5e7eb;font-size:1.1rem;font-weight:700;">${cluster.duration_days} dager</div>
              <div style="color:#9ca3af;font-size:0.75rem;">${cluster.facility_count} anlegg · ${cluster.vessel_count} båter</div>
            </div>
          </div>
          
          <div style="background:#111827;border-radius:6px;padding:8px;margin-bottom:10px;">
            <div style="color:#9ca3af;font-size:0.75rem;margin-bottom:4px;">📍 Sterkeste forbindelse:</div>
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
        💡 <strong>Slik leser du klyngene:</strong> Hver fargekode representerer en separat smitteklynge. "Dag +0" er første registrerte infeksjon i klyngen. 
        Anlegg med samme fargekode er koblet via felles båttrafikk eller geografisk nærhet (< 20 km) innenfor 90-dagers vinduer.
      </div>
    `;
  }

  /**
   * Render list of infected facilities
   */
  function renderInfectedFacilities() {
    const container = document.getElementById("adminInfectedList");
    if (!container) return;
    const infected = correlationData?.infected_facilities || [];

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

  /**
   * Render list of affected (at-risk) facilities
   */
  function renderAffectedFacilities() {
    const container = document.getElementById("adminAffectedList");
    if (!container) return;
    const affected = correlationData?.affected_facilities || [];

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

  // Public API
  return {
    setCorrelationData: setCorrelationData,
    getCorrelationData: getCorrelationData,
    renderNetworkGraph: renderNetworkGraph,
    renderPriorityList: renderPriorityList,
    renderOutbreakClusters: renderOutbreakClusters,
    renderInfectedFacilities: renderInfectedFacilities,
    renderAffectedFacilities: renderAffectedFacilities,
    resetGraphHighlight: resetGraphHighlight
  };
})();
