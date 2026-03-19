/**
 * Correlation Detail Module
 * Handles admin correlation detail modal and related layout helpers.
 */

window.AdminCorrelationDetailModule = (function () {
  'use strict';

  function ensureCorrelationDetailModal(deps = {}) {
    const {
      documentRef = document,
      closeModal = () => {},
      alertFn = alert,
    } = deps;

    let modal = documentRef.getElementById("correlationDetailModal");
    if (modal) return modal;

    modal = documentRef.createElement("div");
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
    documentRef.body.appendChild(modal);

    const closeBtn = modal.querySelector("#detailClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => closeModal("correlationDetailModal"));
    }

    const notifyBtn = modal.querySelector("#detailNotify");
    if (notifyBtn) {
      notifyBtn.addEventListener("click", () => {
        const facilityName = modal?.dataset?.facilityName || "Facility";
        const facilityEmail = modal?.dataset?.facilityEmail || "facility@example.com";
        alertFn(`📧 Notify: Simulated email sent to ${facilityName} (${facilityEmail}).`);
        closeModal("correlationDetailModal");
      });
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal("correlationDetailModal");
    });

    return modal;
  }

  function ensureAdminCorrelationLayout(deps = {}) {
    const {
      documentRef = document,
    } = deps;

    const adminData = documentRef.getElementById("admin-data");
    if (!adminData) return;

    const hasLayout = documentRef.getElementById("adminNetworkContainer") &&
      documentRef.getElementById("adminPriorityList") &&
      documentRef.getElementById("adminInfectedList") &&
      documentRef.getElementById("adminAffectedList");

    if (hasLayout) return;

    adminData.innerHTML = `
      <div style="margin-bottom:12px;padding:10px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;color:#9ca3af;font-size:0.88rem;">
        <strong style="color:#e5e7eb;">Forklaring:</strong>
        Nettverket viser koblinger mellom båter og anlegg i smittesoner. Rader med høy risiko betyr nylig kontakt eller høy sannsynlighet for videre smittespredning.
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Infiserte anlegg</div><div id="correlationInfected" style="color:#e5e7eb;font-weight:700;">0</div></div>
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Høy risiko båter</div><div id="correlationHighBoats" style="color:#e5e7eb;font-weight:700;">0</div></div>
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Moderat risiko båter</div><div id="correlationModBoats" style="color:#e5e7eb;font-weight:700;">0</div></div>
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Berørte anlegg</div><div id="correlationAffected" style="color:#e5e7eb;font-weight:700;">0</div></div>
        <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;"><div style="color:#9ca3af;font-size:0.8rem;">Totale koblinger</div><div id="correlationLinks" style="color:#e5e7eb;font-weight:700;">0</div></div>
      </div>

      <div id="adminNetworkContainer" style="height:360px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:#0b1424;margin-bottom:12px;"></div>

      <h3 style="color:#e5e7eb;margin:8px 0;">Top prioritet (tabell)</h3>
      <div id="adminPriorityList" style="margin-bottom:14px;"></div>

      <h3 style="color:#e5e7eb;margin:8px 0;">Utbruddsklynger over tid (måneder)</h3>
      <div id="adminOutbreakClusters" style="margin-bottom:14px;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><h3 style="color:#e5e7eb;margin:8px 0;">Infiserte anlegg</h3><div id="adminInfectedList"></div></div>
        <div><h3 style="color:#e5e7eb;margin:8px 0;">Potensielt berørte anlegg</h3><div id="adminAffectedList"></div></div>
      </div>
    `;
  }

  function showCorrelationDetail(link, deps = {}) {
    const {
      documentRef = document,
      showModal = () => {},
      ensureCorrelationDetailModalFn = ensureCorrelationDetailModal,
      closeModal = () => {},
      alertFn = alert,
    } = deps;

    const modal = ensureCorrelationDetailModalFn({
      documentRef,
      closeModal,
      alertFn,
    });

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
              ${link.risk_level === 'HIGH' ? '🔴 HIGH RISK' : '⚠️ MODERATE'}
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
        <div style="color: #9ca3af; margin-bottom: 0.5rem; font-size: 0.9rem;">📋 Diseases Detected</div>
        <div style="color: #e5e7eb;">${link.diseases.length > 0 ? link.diseases.join(', ') : 'No diseases detected'}</div>
      </div>
    `;

    const titleEl = documentRef.getElementById("detailTitle");
    const contentEl = documentRef.getElementById("detailContent");
    if (titleEl) titleEl.textContent = `${link.vessel_name} → ${link.facility_name}`;
    if (contentEl) contentEl.innerHTML = content;

    if (modal) {
      modal.dataset.facilityCode = link.facility_code;
      modal.dataset.facilityName = link.facility_name;
      modal.dataset.facilityEmail = `facility_${link.facility_code}@farm.no`;
    }

    showModal("correlationDetailModal");
  }

  function showFacilityDetails(facilityCode, deps = {}) {
    const {
      documentRef = document,
      showModal = () => {},
      ensureCorrelationDetailModalFn = ensureCorrelationDetailModal,
      getCorrelationData = () => null,
      getFacilityCluster = () => null,
      getClusterColor = () => '#3b82f6',
      closeModal = () => {},
      alertFn = alert,
    } = deps;

    const correlationData = getCorrelationData() || {};

    const allLinks = correlationData.vessel_facility_links || [];
    const facilityLinks = allLinks.filter((l) => l.facility_code === facilityCode);

    if (!facilityLinks.length) {
      alertFn("Ingen data funnet for dette anlegget");
      return;
    }

    const firstLink = facilityLinks[0];
    const cluster = getFacilityCluster(facilityCode);

    const vesselRows = facilityLinks.map((link) => {
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

    const clusterSection = cluster ? `
      <div style="margin-top:16px;padding:12px;background:#111827;border-left:4px solid ${getClusterColor(cluster.cluster_id)};border-radius:6px;">
        <div style="color:${getClusterColor(cluster.cluster_id)};font-weight:700;margin-bottom:8px;">🔗 Klynge #${cluster.cluster_id} - Smittekjede</div>
        <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">
          Dette anlegget er del av en klynge med <strong>${cluster.facility_count} anlegg</strong> koblet over <strong>${cluster.duration_days} dager</strong>.
        </div>
        <div style="color:#9ca3af;font-size:0.8rem;">
          <strong>Anlegg i klyngen:</strong>
        </div>
        ${(cluster.facilities || []).map((f) => `
          <div style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="color:#e5e7eb;font-size:0.85rem;">${f.name} <span style="color:#9ca3af;">(${f.code})</span></div>
            <div style="color:#9ca3af;font-size:0.75rem;">${f.vessel_count} båter · Siste besøk: ${new Date(f.last_seen).toLocaleDateString('no-NO')}</div>
          </div>
        `).join("")}
      </div>
    ` : `
      <div style="margin-top:16px;padding:12px;background:#111827;border-radius:6px;color:#10b981;">
        ✓ Dette anlegget er <strong>ikke</strong> del av en identifisert smitteklynge.
      </div>
    `;

    ensureCorrelationDetailModalFn({
      documentRef,
      closeModal,
      alertFn,
    });

    const titleEl = documentRef.getElementById("detailTitle");
    const contentEl = documentRef.getElementById("detailContent");

    if (titleEl) titleEl.textContent = `${firstLink.facility_name} (${facilityCode})`;
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="margin-bottom:16px;">
          <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">📊 Eksponeringsdetaljer</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="padding:10px;background:#111827;border-radius:6px;">
              <div style="color:#9ca3af;font-size:0.75rem;">Totalt båter</div>
              <div style="color:#e5e7eb;font-size:1.3rem;font-weight:700;">${facilityLinks.length}</div>
            </div>
            <div style="padding:10px;background:#111827;border-radius:6px;">
              <div style="color:#9ca3af;font-size:0.75rem;">Høy risiko</div>
              <div style="color:#ef4444;font-size:1.3rem;font-weight:700;">${facilityLinks.filter((l) => l.risk_level === "HIGH").length}</div>
            </div>
            <div style="padding:10px;background:#111827;border-radius:6px;">
              <div style="color:#9ca3af;font-size:0.75rem;">Anleggsscore</div>
              <div style="color:#e5e7eb;font-size:1.3rem;font-weight:700;">${firstLink.facility_risk_score ?? "-"}</div>
            </div>
          </div>
        </div>

        <div style="color:#9ca3af;font-size:0.85rem;margin-bottom:8px;">🚢 Båter som har besøkt</div>
        <div style="max-height:240px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px;background:#0b1424;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr style="background:#111827;color:#9ca3af;text-align:left;position:sticky;top:0;">
                <th style="padding:8px;">Båt</th>
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

  return {
    ensureCorrelationDetailModal,
    ensureAdminCorrelationLayout,
    showCorrelationDetail,
    showFacilityDetails,
  };
})();
