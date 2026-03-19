/**
 * route-details.js
 * Shows detailed view of confirmed route plans
 */

// Show route details modal
async function showRouteDetailsModal() {
  const modal = document.getElementById('routeDetailsModal');
  const content = document.getElementById('routeDetailsContent');
  
  if (!modal || !content) return;
  
  modal.classList.add('show');
  content.innerHTML = '<p style="color: #6b7280; text-align: center;">Laster rutedetaljer...</p>';
  
  try {
    // Use API_BASE from vessel-storage.js (auto-detects Render vs localhost)
    const response = await fetch(`${API_BASE}/api/data/confirmed_plans`);
    
    if (!response.ok) {
      content.innerHTML = '<p style="color: #ef4444; text-align: center;">Kunne ikke hente rutedetaljer fra API</p>';
      return;
    }
    
    const plans = await response.json();
    
    if (!plans || plans.length === 0) {
      content.innerHTML = '<p style="color: #6b7280; text-align: center;">Ingen bekreftede ruter funnet</p>';
      return;
    }
    
    // Filter for current vessel
    const vesselData = VesselStorage.getVesselData();
    const mmsi = vesselData?.vessel?.mmsi;
    const vesselPlans = mmsi ? plans.filter(p => p.mmsi === mmsi) : plans;
    
    if (vesselPlans.length === 0) {
      content.innerHTML = `<p style="color: #6b7280; text-align: center;">Ingen ruter for denne båten (MMSI: ${mmsi})</p>`;
      return;
    }
    
    // Sort by confirmed_at (newest first)
    vesselPlans.sort((a, b) => new Date(b.confirmed_at) - new Date(a.confirmed_at));
    
    // Build HTML
    let html = `<p style="color: #6b7280; margin-bottom: 1rem;">Viser ${vesselPlans.length} bekreftede rute(r) for ${vesselData.vessel.name}</p>`;
    
    vesselPlans.forEach((plan, idx) => {
      const confirmedDate = new Date(plan.confirmed_at).toLocaleString('no-NO');
      const totalDays = plan.route ? plan.route.length : 0;
      const totalFacilities = plan.route ? plan.route.reduce((sum, day) => sum + (day.facilities?.length || 0), 0) : 0;
      const hasInfected = plan.route ? plan.route.some(day => day.has_infected) : false;
      const needsQuarantine = plan.route ? plan.route.some(day => day.needs_quarantine) : false;
      
      html += `
        <div style="border: 2px solid ${hasInfected ? '#ef4444' : '#e5e7eb'}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: ${hasInfected ? '#fef2f2' : 'white'};">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <h3 style="margin: 0; font-size: 1rem;">Rute #${idx + 1}</h3>
            <span style="font-size: 0.85rem; color: #6b7280;">ID: ${plan.plan_id}</span>
          </div>
          <p style="margin: 0.25rem 0; font-size: 0.85rem; color: #6b7280;">Bekreftet: ${confirmedDate}</p>
          <p style="margin: 0.25rem 0; font-size: 0.85rem;"><strong>Varighet:</strong> ${totalDays} dag(er) · <strong>Anlegg:</strong> ${totalFacilities}</p>
          ${plan.notes ? `<p style="margin: 0.25rem 0; font-size: 0.85rem; color: #6b7280;"><em>"${plan.notes}"</em></p>` : ''}
          ${needsQuarantine ? '<p style="margin: 0.5rem 0; padding: 0.5rem; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 0.85rem;"><strong>⚠️ Karantene påkrevd</strong></p>' : ''}
          ${hasInfected ? '<p style="margin: 0.5rem 0; padding: 0.5rem; background: #fee2e2; border-left: 3px solid #ef4444; font-size: 0.85rem;"><strong>🔴 Inneholder smittede/risikoanlegg</strong></p>' : ''}
          
          <details style="margin-top: 0.75rem;">
            <summary style="cursor: pointer; font-weight: 600; font-size: 0.9rem; color: #3b82f6;">Vis detaljer</summary>
            <div style="margin-top: 0.5rem; padding-left: 1rem; border-left: 2px solid #e5e7eb;">
      `;
      
      if (plan.route && plan.route.length > 0) {
        plan.route.forEach(day => {
          html += `
            <div style="margin-top: 0.75rem; padding: 0.5rem; background: #f9fafb; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; font-size: 0.9rem;">Dag ${day.day} · ${day.date}</p>
              ${day.facilities && day.facilities.length > 0 ? `
                <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.85rem;">
                  ${day.facilities.map(f => `
                    <li style="margin: 0.25rem 0;">
                      <strong>${f.name}</strong>
                      ${f.infected ? '<span style="color: #ef4444; font-weight: bold;"> · SMITTET</span>' : ''}
                      ${f.proximity_risk ? '<span style="color: #f59e0b;"> · NÆRHET RISIKO</span>' : ''}
                      ${f.operation_minutes > 0 ? `<span style="color: #6b7280;"> · ${f.operation_minutes} min</span>` : ''}
                      ${f.comment ? `<br><small style="color: #6b7280;">"${f.comment}"</small>` : ''}
                    </li>
                  `).join('')}
                </ul>
              ` : '<p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #6b7280;">Ingen anlegg denne dagen</p>'}
            </div>
          `;
        });
      }
      
      html += `
            </div>
          </details>
        </div>
      `;
    });
    
    content.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading route details:', error);
    content.innerHTML = '<p style="color: #ef4444; text-align: center;">Feil ved lasting av rutedetaljer</p>';
  }
}

function closeRouteDetailsModal() {
  const modal = document.getElementById('routeDetailsModal');
  if (modal) modal.classList.remove('show');
}


