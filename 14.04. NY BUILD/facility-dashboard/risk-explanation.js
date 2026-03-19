/**
 * Risk Explanation Modal Component
 * "Why this risk?" - Operativ klarhet
 * 
 * Shows detailed explanation of risk factors with actionable information.
 */

class RiskExplanationModal {
  constructor() {
    this.modalElement = null;
    this.init();
  }

  init() {
    // Create modal HTML
    const modalHTML = `
      <div id="riskExplanationModal" class="risk-modal" style="display: none;">
        <div class="risk-modal-overlay" onclick="riskExplanationModal.close()"></div>
        <div class="risk-modal-content">
          <div class="risk-modal-header">
            <h3 id="riskModalTitle">🔍 Hvorfor denne risikoen?</h3>
            <button class="risk-modal-close" onclick="riskExplanationModal.close()">×</button>
          </div>
          <div class="risk-modal-body" id="riskModalBody">
            <!-- Dynamic content -->
          </div>
          <div class="risk-modal-footer">
            <button class="btn-secondary" onclick="riskExplanationModal.close()">Lukk</button>
          </div>
        </div>
      </div>
    `;
    
    // Inject into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('riskExplanationModal');
    
    // Inject styles
    this.injectStyles();
  }

  injectStyles() {
    const styles = `
      <style>
        .risk-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .risk-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
        }
        
        .risk-modal-content {
          position: relative;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          animation: modalSlideIn 0.2s ease-out;
        }
        
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .risk-modal-header {
          padding: 1.5rem;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .risk-modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #1f2937;
        }
        
        .risk-modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }
        
        .risk-modal-close:hover {
          background: #f3f4f6;
          color: #ef4444;
        }
        
        .risk-modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }
        
        .risk-modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        
        .risk-factor-section {
          margin-bottom: 1.5rem;
        }
        
        .risk-factor-section:last-child {
          margin-bottom: 0;
        }
        
        .risk-factor-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .risk-factor-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .risk-factor-badge.high {
          background: #fee2e2;
          color: #dc2626;
        }
        
        .risk-factor-badge.moderate {
          background: #fed7aa;
          color: #ea580c;
        }
        
        .risk-factor-badge.low {
          background: #fef3c7;
          color: #ca8a04;
        }
        
        .risk-factor-badge.none {
          background: #d1fae5;
          color: #059669;
        }
        
        .risk-factor-details {
          background: #f9fafb;
          border-left: 3px solid #e5e7eb;
          padding: 0.75rem;
          margin-top: 0.5rem;
          border-radius: 4px;
        }
        
        .risk-factor-details.high {
          border-left-color: #dc2626;
          background: #fef2f2;
        }
        
        .risk-factor-details.moderate {
          border-left-color: #ea580c;
          background: #fff7ed;
        }
        
        .risk-factor-details.low {
          border-left-color: #ca8a04;
          background: #fefce8;
        }
        
        .risk-factor-item {
          margin: 0.5rem 0;
          font-size: 0.9rem;
          color: #4b5563;
        }
        
        .risk-factor-item strong {
          color: #1f2937;
        }
        
        .risk-action-box {
          background: #eff6ff;
          border: 1px solid #3b82f6;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }
        
        .risk-action-box h4 {
          margin: 0 0 0.5rem 0;
          color: #1e40af;
          font-size: 0.95rem;
        }
        
        .risk-action-box ul {
          margin: 0;
          padding-left: 1.25rem;
          color: #1e40af;
        }
        
        .risk-action-box li {
          margin: 0.25rem 0;
          font-size: 0.9rem;
        }
        
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          background: #e5e7eb;
        }
        
        .why-link {
          color: #3b82f6;
          font-size: 0.85rem;
          cursor: pointer;
          text-decoration: underline;
          margin-left: 0.5rem;
        }
        
        .why-link:hover {
          color: #2563eb;
        }
      </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Show modal with risk explanation for a facility
   * @param {Object} facilityData - Current facility data
   * @param {Object} riskFactors - Risk analysis factors
   */
  show(facilityData, riskFactors) {
    const titleEl = document.getElementById('riskModalTitle');
    const bodyEl = document.getElementById('riskModalBody');
    
    titleEl.textContent = `🔍 Risikoforklaring: ${facilityData.name || 'Anlegg'}`;
    
    // Build explanation content
    const content = this.buildExplanationContent(facilityData, riskFactors);
    bodyEl.innerHTML = content;
    
    // Show modal
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modalElement.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Build detailed explanation content
   */
  buildExplanationContent(facility, factors) {
    let html = '';
    
    // Overall risk level
    const riskLevel = factors.overallRisk || 'green';
    const riskLabels = {
      red: { label: 'EKSTREM RISIKO', badge: 'high', emoji: '🔴' },
      orange: { label: 'HØY RISIKO', badge: 'high', emoji: '🟠' },
      yellow: { label: 'MODERAT RISIKO', badge: 'moderate', emoji: '🟡' },
      green: { label: 'LAV RISIKO', badge: 'none', emoji: '🟢' }
    };
    
    const risk = riskLabels[riskLevel] || riskLabels.green;
    
    html += `
      <div class="risk-factor-section">
        <div class="risk-factor-title">
          ${risk.emoji} Samlet vurdering:
          <span class="risk-factor-badge ${risk.badge}">${risk.label}</span>
        </div>
      </div>
    `;
    
    // Factor 1: Confirmed disease
    if (factors.confirmedDisease) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-title">
            ⚠️ Bekreftet sykdom på dette anlegget
          </div>
          <div class="risk-factor-details high">
            <div class="risk-factor-item">
              <strong>Sykdom:</strong> ${factors.diseaseType || 'ILA/PD'}
            </div>
            <div class="risk-factor-item">
              <strong>Status:</strong> Anlegget er registrert med aktiv sykdom
            </div>
          </div>
        </div>
      `;
    }
    
    // Factor 2: BarentsWatch quarantine zone
    if (factors.inBarentsWatchZone) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-title">
            🟠 BarentsWatch karantenesone
          </div>
          <div class="risk-factor-details ${factors.bwZoneType === 'protection' ? 'high' : 'moderate'}">
            <div class="risk-factor-item">
              <strong>Sone type:</strong> ${factors.bwZoneType === 'protection' ? 'Bekjempelsessone' : 'Overvåkingssone'}
            </div>
            <div class="risk-factor-item">
              <strong>Kilde:</strong> Mattilsynet via BarentsWatch (offisiell)
            </div>
            <div class="risk-factor-item">
              Dette anlegget ligger innenfor en offentlig karantenesone. Alle båter som besøker 
              får automatisk karantenestatus i 48 timer.
            </div>
          </div>
        </div>
      `;
    }
    
    // Factor 3: Nearby infected facilities
    if (factors.nearbyInfected > 0) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-title">
            📍 Smittede anlegg i nærheten
          </div>
          <div class="risk-factor-details ${factors.nearbyInfected >= 3 ? 'high' : 'moderate'}">
            <div class="risk-factor-item">
              <strong>Antall innen 15 km:</strong> ${factors.nearbyInfected}
            </div>
            <div class="risk-factor-item">
              <strong>Nærmeste avstand:</strong> ${factors.closestDistance || '-'}
            </div>
            ${factors.inLocalRadius ? `
              <div class="risk-factor-item">
                <strong>🟡 Lokal smitteradius:</strong> Dette anlegget er innenfor 10 km fra bekreftet smittet anlegg
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Factor 4: Recent vessel visits
    if (factors.recentVisits > 0) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-title">
            🚤 Båtbesøk siste 48 timer
          </div>
          <div class="risk-factor-details low">
            <div class="risk-factor-item">
              <strong>Antall besøk:</strong> ${factors.recentVisits}
            </div>
            <div class="risk-factor-item">
              Båter som har besøkt andre anlegg kan være smittebærere. 
              Sjekk båthistorikk for nærmere detaljer.
            </div>
          </div>
        </div>
      `;
    }
    
    // Factor 5: Ocean currents
    if (factors.oceanCurrents) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-title">
            🌊 Havstrømmer
          </div>
          <div class="risk-factor-details low">
            <div class="risk-factor-item">
              <strong>Retning:</strong> ${factors.oceanCurrents.direction || '-'}°
            </div>
            <div class="risk-factor-item">
              <strong>Hastighet:</strong> ${factors.oceanCurrents.speed || '-'} m/s
            </div>
            <div class="risk-factor-item">
              Havstrømmer kan spre smittestoffer fra smittede anlegg.
              Oppdateres fra NorKyst-800 (Meteorologisk institutt).
            </div>
          </div>
        </div>
      `;
    }
    
    // No risk factors
    if (!factors.confirmedDisease && !factors.inBarentsWatchZone && factors.nearbyInfected === 0) {
      html += `
        <div class="risk-factor-section">
          <div class="risk-factor-details none">
            <div class="risk-factor-item">
              ✅ Ingen kjente risikofaktorer for dette anlegget akkurat nå.
            </div>
            <div class="risk-factor-item">
              Fortsett å følge med på båtbesøk og oppdateringer fra BarentsWatch.
            </div>
          </div>
        </div>
      `;
    }
    
    // Recommended actions
    html += this.buildRecommendedActions(factors);
    
    return html;
  }

  /**
   * Build recommended actions based on risk factors
   */
  buildRecommendedActions(factors) {
    let actions = [];
    
    if (factors.confirmedDisease || factors.inBarentsWatchZone) {
      actions.push('Nekt all båttrafikk uten godkjenning fra veterinær');
      actions.push('Krev desinfeksjon av alle båter før og etter besøk');
      actions.push('Dokumenter alle besøk i detalj');
    } else if (factors.nearbyInfected >= 3) {
      actions.push('Vurder proaktiv karantene for innkommende båter');
      actions.push('Øk overvåking av fisk for tidlige tegn på sykdom');
      actions.push('Kontakt veterinær for risikovurdering');
    } else if (factors.nearbyInfected > 0) {
      actions.push('Kontroller båthistorikk før godkjenning av besøk');
      actions.push('Følg med på oppdateringer fra naboer');
    } else {
      actions.push('Fortsett normal drift med standard biosikkerhet');
      actions.push('Følg med på karantene-status for innkommende båter');
    }
    
    if (actions.length === 0) return '';
    
    let html = `
      <div class="risk-action-box">
        <h4>💡 Anbefalte tiltak</h4>
        <ul>
          ${actions.map(action => `<li>${action}</li>`).join('')}
        </ul>
      </div>
    `;
    
    return html;
  }
}

// Global instance
let riskExplanationModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    riskExplanationModal = new RiskExplanationModal();
  });
} else {
  riskExplanationModal = new RiskExplanationModal();
}

/**
 * Helper function to show risk explanation
 * Can be called from anywhere in the application
 */
function showRiskExplanation(facilityData, riskFactors) {
  if (!riskExplanationModal) {
    riskExplanationModal = new RiskExplanationModal();
  }
  riskExplanationModal.show(facilityData, riskFactors);
}
