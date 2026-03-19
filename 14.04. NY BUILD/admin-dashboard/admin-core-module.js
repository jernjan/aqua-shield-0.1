/**
 * Admin Core Module
 * Handles core admin and risk loading functions.
 *
 * Dependencies are injected from app.js to preserve safe fallback behavior.
 */

window.AdminCoreModule = (function () {
  'use strict';

  async function loadRisk(deps) {
    const { getById, elements, apiFetch, state, renderRisk } = deps;

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

  async function loadAdmin(deps) {
    const {
      apiFetch,
      setCorrelationData,
      state,
      renderAdminCorrelations,
      documentRef = document,
      setModuleCorrelationData
    } = deps;

    try {
      const loadedCorrelationData = await apiFetch("/api/risk/correlations");
      setCorrelationData(loadedCorrelationData);

      if (typeof setModuleCorrelationData === "function") {
        setModuleCorrelationData(loadedCorrelationData);
      }

      if (!loadedCorrelationData || !loadedCorrelationData.summary || loadedCorrelationData.summary.total_correlations === 0) {
        documentRef.getElementById("admin-data").innerHTML = `
          <div style="padding: 2rem; text-align: center; color: #10b981; font-size: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">✅</div>
            <div><strong>Great news!</strong> Ingen høyrisiko-koblinger akkurat nå.</div>
            <div style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.9rem;">Systemet overvåker kontinuerlig for endringer.</div>
          </div>
        `;
      } else {
        state.loaded.admin = true;
        renderAdminCorrelations();
      }
    } catch (error) {
      console.error("Error loading correlations:", error);
      documentRef.getElementById("admin-data").innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;">❌ Feil ved lasting av risiko-nettverk: ${error.message}</div>`;
    }
  }

  async function loadCriticalAlerts(deps) {
    const { apiFetch, documentRef = document } = deps;

    try {
      const data = await apiFetch("/api/admin/risk-alerts");

      const summary = data.summary || {};
      documentRef.getElementById("statusInfectedVisit").textContent = summary.visited_infected_48h || 0;
      documentRef.getElementById("statusRiskZoneVisit").textContent = summary.visited_risk_zone || 0;
      documentRef.getElementById("status10kmVisit").textContent = summary.visited_10km_zone || 0;
      documentRef.getElementById("statusCleared").textContent = summary.cleared || 0;

      const criticalCount = data.critical_events ? data.critical_events.length : 0;
      documentRef.getElementById("criticalCount").textContent = criticalCount;

      const container = documentRef.getElementById("criticalEventsContainer");

      if (criticalCount === 0) {
        container.innerHTML = `
          <div style="color: #10b981; padding: 2rem; text-align: center; font-size: 1rem;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">✅</div>
            <div><strong>Ingen karantenebrudd</strong></div>
            <div style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.85rem;">
              Alle båter med besøk ved smittet anlegg følger 48t karantenetid.
            </div>
          </div>
        `;
        return;
      }

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
                  🚢 ${vessel.name || "Ukjent båt"}
                </div>
                <div style="font-size: 0.85rem; color: #9ca3af; font-family: 'IBM Plex Mono', monospace;">
                  MMSI: ${vessel.mmsi || "N/A"} • ID: ${event.event_id || "N/A"}
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
                  Besøkte smittet anlegg
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
                  Nå observert ved
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
                <span style="font-size: 1.25rem;">⚠️</span>
                <div>
                  <strong>RISIKO:</strong> ${assessment.description || "Karantenetid ikke oppfylt"}
                </div>
              </div>
              <div style="font-size: 0.8rem; color: #9ca3af; margin-left: 2rem;">
                ${assessment.biological_risk || ""}
              </div>
              <div style="font-size: 0.8rem; color: #fbbf24; margin-left: 2rem; margin-top: 0.25rem;">
                → ${assessment.action_required || "Anlegget bør varsles"}
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (error) {
      console.error("Error loading critical alerts:", error);
      documentRef.getElementById("criticalEventsContainer").innerHTML = `
        <div style="color: #ef4444; padding: 2rem; text-align: center;">
          ❌ Feil ved lasting av kritiske hendelser: ${error.message}
        </div>
      `;
    }
  }

  return {
    loadRisk,
    loadAdmin,
    loadCriticalAlerts
  };
})();
