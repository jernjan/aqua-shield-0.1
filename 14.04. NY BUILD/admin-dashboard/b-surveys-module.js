/**
 * B-SURVEYS MODULE
 * Handles B-undersøkelse (environmental survey) overview for admin dashboard
 * Shows facilities with upcoming B-survey deadlines and compliance status
 */

const BSurveysModule = (() => {
  let allFacilities = [];
  let bSurveyData = [];

  /**
   * Checks if B-survey is required for facility based on production type and species
   * B-surveys are only required for marine fish farms (laks, regnbueørret, etc.)
   * Not required for: mollusks, algae, or facilities without fish
   */
  function isBSurveyRequired(facility) {
    if (!facility || !facility.fdir) return false;
    
    const prodCategory = (facility.fdir.production_category || '').toLowerCase();
    const species = (facility.fdir.species || '').toLowerCase();
    
    // NOT required for mollusks/crustaceans/echinoderms
    if (prodCategory.includes('blødyr') || prodCategory.includes('krepsdyr') || prodCategory.includes('pigghuder')) {
      return false;
    }
    
    // NOT required for algae
    if (prodCategory.includes('alger')) {
      return false;
    }
    
    // NOT required if no species specified (no fish)
    if (!species || species.trim() === '') {
      return false;
    }
    
    // Marine fish farms should have B-surveys
    // Check if species contains relevant fish types
    const marineFish = ['laks', 'regnbueørret', 'ørret', 'torsk', 'kveite', 'sei', 'berggylt'];
    return marineFish.some(fish => species.includes(fish));
  }

  /**
   * Calculates B-survey status based on site condition and measurement date
   * @param {Object} bSurveyData - B-survey data from FDIR API
   * @returns {Object} Contains status, statusText, statusBadge, daysUntilDeadline, and other display values
   */
  function calculateBSurveyStatus(bSurveyData) {
    if (!bSurveyData || !bSurveyData.measurement_date) {
      return {
        status: 'unknown',
        statusBadge: '❓ Ukjent',
        infoText: 'Ingen dato tilgjengeleg',
        lastDate: '-',
        siteCondition: '-',
        siteConditionText: 'Ukjent',
        recommendedDate: '-',
        daysUntilDeadline: null
      };
    }

    const lastDate = new Date(bSurveyData.measurement_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine frequency (in months) based on site condition (risikobasert)
    let frequencyMonths = 24; // default for condition 1-2
    const condition = bSurveyData.site_condition;
    if (condition === 4) frequencyMonths = 6;      // meget dårlig
    else if (condition === 3) frequencyMonths = 12; // dårlig
    // 1-2: god/meget god = 24 months

    // Calculate deadline
    const recommendedDate = new Date(lastDate);
    recommendedDate.setMonth(recommendedDate.getMonth() + frequencyMonths);
    recommendedDate.setHours(0, 0, 0, 0);

    // Calculate days until deadline
    const daysUntilDeadline = Math.floor((recommendedDate - today) / (1000 * 60 * 60 * 24));

    // Determine status
    let status = 'unknown';
    let statusBadge = '❓ Ukjent';
    let infoText = 'Ukjend status';

    if (daysUntilDeadline < 0) {
      status = 'alert';
      statusBadge = '🔴 Utgått';
      infoText = `${Math.abs(daysUntilDeadline)} dagar overskreden`;
    } else if (daysUntilDeadline <= 60) {
      status = 'warning';
      statusBadge = '🟡 Snart';
      infoText = `Forfall om ${daysUntilDeadline} dagar`;
    } else {
      status = 'ok';
      statusBadge = '🟢 OK';
      infoText = `${daysUntilDeadline} dagar til fristen`;
    }

    // Format dates
    const lastDateStr = lastDate.toLocaleDateString('no-NO');
    const recommendedDateStr = recommendedDate.toLocaleDateString('no-NO');

    // Format condition
    let siteConditionText = 'Ukjent';
    if (condition === 1) siteConditionText = '1 - Meget god';
    else if (condition === 2) siteConditionText = '2 - God';
    else if (condition === 3) siteConditionText = '3 - Dårlig';
    else if (condition === 4) siteConditionText = '4 - Meget dårlig';

    return {
      status,
      statusBadge,
      infoText,
      lastDate: lastDateStr,
      siteCondition: condition,
      siteConditionText,
      recommendedDate: recommendedDateStr,
      daysUntilDeadline
    };
  }

  /**
   * Loads and processes B-survey data
   */
  async function loadBSurveys() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const apiBase = urlParams.get('api_base') || 'http://127.0.0.1:8000';

      // Show loading state
      document.getElementById('b-surveys-table').innerHTML = 
        '<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--muted);">Lastar inn...</td></tr>';

      // Fetch facilities with FDIR metadata
      const response = await fetch(`${apiBase}/api/facilities?include_fdir_metadata=true&limit=500`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      allFacilities = Array.isArray(data) ? data : data.facilities || [];

      // Calculate B-survey status for all facilities
      bSurveyData = allFacilities
        .filter(f => f.fdir && f.fdir.latest_b_survey) // Only facilities with B-survey data
        .filter(f => isBSurveyRequired(f)) // Only facilities that actually require B-surveys
        .map(f => {
          const bStatus = calculateBSurveyStatus(f.fdir.latest_b_survey);
          // Format species list for display
          const species = (f.fdir.species || '-').split(',').map(s => s.trim()).join(', ');
          return {
            code: f.code || '-',
            name: f.name || '-',
            locality_no: f.locality_no || '-',
            species: species,
            ...bStatus
          };
        })
        .sort((a, b) => {
          // Sort by days until deadline (ascending - most urgent first)
          const aDays = a.daysUntilDeadline !== null ? a.daysUntilDeadline : 999999;
          const bDays = b.daysUntilDeadline !== null ? b.daysUntilDeadline : 999999;
          return aDays - bDays;
        });

      // Display summary
      displaySummary();

      // Display table
      renderTable(bSurveyData);

      showToast(`Lasta inn ${bSurveyData.length} anlegg me B-prøvedata`, 'success');
    } catch (error) {
      console.error('B-surveys load error:', error);
      document.getElementById('b-surveys-table').innerHTML = 
        `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #dc2626;">Feil ved lasting: ${error.message}</td></tr>`;
      showToast(`Feil: ${error.message}`, 'error');
    }
  }

  /**
   * Displays summary statistics
   */
  function displaySummary() {
    const alert = bSurveyData.filter(d => d.status === 'alert').length;
    const warning = bSurveyData.filter(d => d.status === 'warning').length;
    const ok = bSurveyData.filter(d => d.status === 'ok').length;

    let summary = `
      <strong>Samla B-prøver:</strong> ${bSurveyData.length} | 
      <span style="color: #dc2626;">🔴 Utgått: ${alert}</span> | 
      <span style="color: #ea580c;">🟡 Snart frå: ${warning}</span> | 
      <span style="color: #16a34a;">🟢 OK: ${ok}</span>
    `;

    document.getElementById('b-surveys-summary').innerHTML = summary;
  }

  /**
   * Renders B-survey table with filtering and sorting
   */
  function renderTable(data) {
    const filterValue = document.getElementById('b-survey-filter').value;
    const sortValue = document.getElementById('b-survey-sort').value;

    // Filter data
    let filtered = data;
    if (filterValue) {
      filtered = data.filter(d => d.status === filterValue);
    }

    // Sort data
    if (sortValue === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    } else if (sortValue === 'condition') {
      filtered.sort((a, b) => b.siteCondition - a.siteCondition);
    }
    // Default: already sorted by days in loadBSurveys

    // Render rows
    const tbody = document.getElementById('b-surveys-table');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--muted);">Ingen anlegg funne me valt filter</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const statusClass = `status-${d.status}`;
      const statusColor = {
        'alert': '#dc2626',
        'warning': '#ea580c',
        'ok': '#16a34a',
        'unknown': '#6b7280'
      }[d.status];

      const freqLabel = {
        6: '6 mnd',
        12: '12 mnd',
        24: '24 mnd'
      }[(() => {
        if (d.siteCondition === 4) return 6;
        if (d.siteCondition === 3) return 12;
        return 24;
      })()];

      const daysText = d.daysUntilDeadline !== null 
        ? d.daysUntilDeadline.toString() 
        : '-';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); hover: background: rgba(255,255,255,0.02);">
          <td style="padding: 12px; font-weight: 500; color: var(--accent);">${d.code}</td>
          <td style="padding: 12px;">${d.name}</td>
          <td style="padding: 12px; font-size: 0.85rem; color: var(--muted);">${d.species}</td>
          <td style="padding: 12px; font-size: 0.85rem; color: var(--muted);">${d.lastDate}</td>
          <td style="padding: 12px; text-align: center; font-size: 0.85rem; color: var(--accent);">${freqLabel}</td>
          <td style="padding: 12px; font-size: 0.85rem; color: var(--muted);">${d.recommendedDate}</td>
          <td style="padding: 12px; text-align: center; font-weight: 500; color: ${statusColor};">${daysText}</td>
          <td style="padding: 12px; text-align: center;">
            <span style="background: ${statusColor === '#dc2626' ? '#fee2e2' : statusColor === '#ea580c' ? '#fef08a' : statusColor === '#16a34a' ? '#d1fae5' : '#f3f4f6'}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
              ${d.statusBadge}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Initialize event listeners
   */
  function initListeners() {
    const filterEl = document.getElementById('b-survey-filter');
    const sortEl = document.getElementById('b-survey-sort');
    const loadBtn = document.getElementById('b-surveys-load');

    if (filterEl) {
      filterEl.addEventListener('change', () => renderTable(bSurveyData));
    }

    if (sortEl) {
      sortEl.addEventListener('change', () => renderTable(bSurveyData));
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', loadBSurveys);
    }
  }

  /**
   * Public API
   */
  return {
    init: initListeners,
    load: loadBSurveys,
    calculateBSurveyStatus
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BSurveysModule.init());
} else {
  BSurveysModule.init();
}
