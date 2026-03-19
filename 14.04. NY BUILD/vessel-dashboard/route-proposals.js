/**
 * route-proposals.js
 * Håndterer ruteforespørsler mellom båt og anlegg
 * Real-time oppdatering med polling
 */

let routeProposalsPollingInterval = null;
let currentVesselMMSI = null;

/**
 * Start polling for route proposal updates
 */
function startRouteProposalsPolling(mmsi, intervalMs = 15 * 60 * 1000) {
  currentVesselMMSI = mmsi;

  if (routeProposalsPollingInterval) {
    clearInterval(routeProposalsPollingInterval);
  }

  // Initial load
  loadRouteProposals(mmsi);

  // Poll every intervalMs
  routeProposalsPollingInterval = setInterval(() => {
    loadRouteProposals(mmsi);
  }, intervalMs);

  
}

/**
 * Stop polling
 */
function stopRouteProposalsPolling() {
  if (routeProposalsPollingInterval) {
    clearInterval(routeProposalsPollingInterval);
    routeProposalsPollingInterval = null;
    
  }
}

/**
 * Load route proposals from API
 */
async function loadRouteProposals(mmsi) {
  try {
    const response = await fetch(`${VesselStorage.API_BASE}/api/route-proposals?mmsi=${mmsi}`);
    if (!response.ok) {
      console.warn('Failed to load route proposals');
      return;
    }

    const data = await response.json();
    

    // Update UI
    displayRouteProposals(data.proposals);

    // Check for new notifications
    checkForNewNotifications(data.proposals);
  } catch (error) {
    console.error('Error loading route proposals:', error);
  }
}

/**
 * Display route proposals in UI
 */
function displayRouteProposals(proposals) {
  const container = document.getElementById('routeProposalsContainer');
  if (!container) return;

  if (proposals.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">Ingen forespørsler sendt ennå</p>';
    return;
  }

  const html = proposals.map(proposal => {
    const statusColor = 
      proposal.status === 'approved' ? '#10b981' :
      proposal.status === 'rejected' ? '#ef4444' :
      proposal.status === 'alternative_suggested' ? '#f59e0b' :
      '#6b7280';

    const statusIcon =
      proposal.status === 'approved' ? '✅' :
      proposal.status === 'rejected' ? '❌' :
      proposal.status === 'alternative_suggested' ? '⏰' :
      '⏳';

    const statusText =
      proposal.status === 'approved' ? 'Godkjent' :
      proposal.status === 'rejected' ? 'Avvist' :
      proposal.status === 'alternative_suggested' ? 'Alternativ tid foreslått' :
      'Venter på svar';

    return `
      <div style="background: white; border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px; color: #1f2937; margin-bottom: 5px;">
              ${proposal.facility_name}
            </div>
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
              📅 ${proposal.proposed_date} kl. ${proposal.proposed_time}
            </div>
            ${proposal.notes ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 8px; font-style: italic;">"${proposal.notes}"</div>` : ''}
            
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
              <span style="font-size: 14px; font-weight: 600; color: ${statusColor};">
                ${statusIcon} ${statusText}
              </span>
              ${proposal.status === 'alternative_suggested' ? `
                <span style="font-size: 13px; color: #f59e0b;">
                  → ${proposal.alternative_date} kl. ${proposal.alternative_time}
                </span>
              ` : ''}
            </div>

            ${proposal.facility_comment ? `
              <div style="background: #f9fafb; padding: 10px; border-radius: 4px; margin-top: 10px; border-left: 3px solid #d1d5db;">
                <div style="font-weight: 600; font-size: 12px; color: #6b7280; margin-bottom: 3px;">Kommentar fra anlegget:</div>
                <div style="font-size: 13px; color: #374151;">${proposal.facility_comment}</div>
              </div>
            ` : ''}
          </div>

          ${proposal.status === 'alternative_suggested' ? `
            <div style="display: flex; flex-direction: column; gap: 6px; margin-left: 15px;">
              <button onclick="acceptAlternativeTime(${proposal.id})" style="padding: 6px 12px; font-size: 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✓ Aksepter</button>
              <button onclick="declineAlternativeTime(${proposal.id})" style="padding: 6px 12px; font-size: 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">✗ Avslå</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Update badge count
  const badge = document.getElementById('proposalsBadge');
  const pendingCount = proposals.filter(p => p.status === 'pending' || p.status === 'alternative_suggested').length;
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

/**
 * Check for new notifications
 */
let lastNotifiedProposals = new Set();

function checkForNewNotifications(proposals) {
  proposals.forEach(proposal => {
    const key = `${proposal.id}_${proposal.status}`;
    
    // New status change
    if (!lastNotifiedProposals.has(key)) {
      lastNotifiedProposals.add(key);
      
      // Show toast notification
      if (proposal.status === 'approved') {
        showToast(`✅ ${proposal.facility_name} har godkjent besøket!`, 'success', 5000);
      } else if (proposal.status === 'rejected') {
        showToast(`❌ ${proposal.facility_name} har avvist besøket`, 'error', 5000);
      } else if (proposal.status === 'alternative_suggested') {
        showToast(`⏰ ${proposal.facility_name} har foreslått en alternativ tid`, 'info', 5000);
      }
    }
  });
}

/**
 * Accept alternative time
 */
async function acceptAlternativeTime(proposalId) {
  try {
    // Update proposal to use alternative time (implement API endpoint if needed)
    showToast('✅ Alternativ tid akseptert', 'success');
    
    // Reload proposals
    if (currentVesselMMSI) {
      loadRouteProposals(currentVesselMMSI);
    }
  } catch (error) {
    console.error('Error accepting alternative:', error);
    showToast('Feil ved aksept av alternativ tid', 'error');
  }
}

/**
 * Decline alternative time
 */
async function declineAlternativeTime(proposalId) {
  try {
    const response = await fetch(`${VesselStorage.API_BASE}/api/route-proposals/${proposalId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Båten kunne ikke akseptere alternativ tid' })
    });

    if (response.ok) {
      showToast('Alternativ tid avslått', 'info');
      
      // Reload proposals
      if (currentVesselMMSI) {
        loadRouteProposals(currentVesselMMSI);
      }
    }
  } catch (error) {
    console.error('Error declining alternative:', error);
    showToast('Feil ved avslag av alternativ tid', 'error');
  }
}

/**
 * Show modal with all proposals
 */
function showRouteProposalsModal() {
  const modal = document.getElementById('routeProposalsModal');
  if (modal) {
    modal.style.display = 'block';
  }

  if (currentVesselMMSI) {
    loadRouteProposals(currentVesselMMSI);
  }
}

/**
 * Close proposals modal
 */
function closeRouteProposalsModal() {
  const modal = document.getElementById('routeProposalsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Export functions
window.RouteProposals = {
  startPolling: startRouteProposalsPolling,
  stopPolling: stopRouteProposalsPolling,
  loadProposals: loadRouteProposals,
  showModal: showRouteProposalsModal,
  closeModal: closeRouteProposalsModal
};
