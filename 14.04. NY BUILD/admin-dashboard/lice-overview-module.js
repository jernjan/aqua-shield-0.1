/**
 * LICE OVERVIEW MODULE
 * Dedicated admin overview for lice threshold status, report freshness and fish presence hints.
 */

const LiceOverviewModule = (() => {
  let allFacilities = [];
  let liceRows = [];

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '-';
    return Number(value).toFixed(digits);
  }

  function inferFishStatus(liceData) {
    if (!liceData || typeof liceData !== 'object') return 'Ukjent';
    if (liceData.likely_without_fish === true) return 'Truleg nei';
    if (liceData.has_fish === true) return 'Ja';
    if (liceData.has_fish === false) return 'Nei';
    return 'Ukjent';
  }

  function buildStatus(liceData) {
    if (!liceData || typeof liceData !== 'object') {
      return { key: 'normal', badge: '⚪ Ingen data', color: '#6b7280' };
    }

    if (liceData.over_threshold === true) {
      return { key: 'high', badge: '🔴 Over terskel', color: '#dc2626' };
    }

    if (liceData.is_non_lice_relevant === true || liceData.is_lice_relevant === false) {
      return { key: 'not_relevant', badge: '⚪ Ikkje luse-relevant', color: '#64748b' };
    }

    if (liceData.likely_without_fish === true) {
      return { key: 'likely_without_fish', badge: '⚪ Truleg utan fisk', color: '#64748b' };
    }

    if (liceData.has_fish === true && liceData.has_recent_report !== true) {
      return { key: 'stale_report', badge: '🟡 Manglar fersk rapport', color: '#d97706' };
    }

    return { key: 'normal', badge: '🟢 Under terskel', color: '#16a34a' };
  }

  function buildRows(facilities) {
    return facilities
      .map(facility => {
        const lice = facility.lice || {};
        const status = buildStatus(lice);
        const adultFemaleLice = Number(lice.adult_female_lice);
        const totalLice = Number(lice.total_lice);
        const hasReported = lice.has_reported === true;
        const hasAnyLiceValue = Number.isFinite(adultFemaleLice) || Number.isFinite(totalLice);
        const hasAnyData = hasAnyLiceValue || lice.over_threshold === true || hasReported || lice.has_recent_report === true;

        return {
          code: facility.localityNo || facility.locality_no || facility.code || '-',
          name: facility.name || '-',
          adultFemaleLice,
          totalLice,
          reportDate: lice.report_date || '-',
          fishStatus: inferFishStatus(lice),
          statusKey: status.key,
          statusBadge: status.badge,
          statusColor: status.color,
          hasRecentReport: lice.has_recent_report === true,
          hasAnyData
        };
      })
      .filter(row => row.name && row.code);
  }

  function updateSummary(rows) {
    const high = rows.filter(r => r.statusKey === 'high').length;
    const likelyNoFish = rows.filter(r => r.statusKey === 'likely_without_fish').length;
    const notRelevant = rows.filter(r => r.statusKey === 'not_relevant').length;
    const stale = rows.filter(r => r.statusKey === 'stale_report').length;
    const recent = rows.filter(r => r.hasRecentReport).length;

    const summaryEl = document.getElementById('lice-summary');
    if (!summaryEl) return;

    summaryEl.innerHTML = `
      <strong>Samla anlegg med lusedata:</strong> ${rows.length} |
      <span style="color: #dc2626;">🔴 Over terskel: ${high}</span> |
      <span style="color: #d97706;">🟡 Manglar fersk rapport: ${stale}</span> |
      <span style="color: #64748b;">⚪ Ikkje luse-relevant: ${notRelevant}</span> |
      <span style="color: #64748b;">⚪ Truleg utan fisk: ${likelyNoFish}</span> |
      <span style="color: #16a34a;">🟢 Nyleg rapport (&lt;14 dagar): ${recent}</span>
    `;
  }

  function renderTable(rows) {
    const filterValue = document.getElementById('lice-filter')?.value || '';
    const sortValue = document.getElementById('lice-sort')?.value || 'severity';

    let filtered = rows;
    if (filterValue) {
      filtered = rows.filter(row => row.statusKey === filterValue);
    }

    filtered = filtered.slice();
    if (sortValue === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    } else if (sortValue === 'recent') {
      filtered.sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)));
    } else {
      filtered.sort((a, b) => {
        const aScore = Number.isFinite(a.adultFemaleLice) ? a.adultFemaleLice : -1;
        const bScore = Number.isFinite(b.adultFemaleLice) ? b.adultFemaleLice : -1;
        return bScore - aScore;
      });
    }

    const tbody = document.getElementById('lice-table');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--muted);">Ingen anlegg funne med valt filter</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(row => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 12px; font-weight: 500; color: var(--accent);">${row.code}</td>
        <td style="padding: 12px;">${row.name}</td>
        <td style="padding: 12px; text-align: center; font-weight: 600; color: ${row.statusColor};">${formatNumber(row.adultFemaleLice)}</td>
        <td style="padding: 12px; text-align: center;">${formatNumber(row.totalLice)}</td>
        <td style="padding: 12px;">${row.reportDate}</td>
        <td style="padding: 12px; text-align: center;">${row.fishStatus}</td>
        <td style="padding: 12px; text-align: center;"><span style="color: ${row.statusColor}; font-weight: 600;">${row.statusBadge}</span></td>
      </tr>
    `).join('');
  }

  async function loadLiceOverview() {
    try {
      const tbody = document.getElementById('lice-table');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--muted);">Lastar inn...</td></tr>';
      }

      const urlParams = new URLSearchParams(window.location.search);
      const apiBase = urlParams.get('api_base') || 'http://127.0.0.1:8000';

      const response = await fetch(`${apiBase}/api/facilities?include_geo=true&include_fdir_metadata=true&limit=500`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      allFacilities = Array.isArray(data) ? data : data.facilities || [];
      liceRows = buildRows(allFacilities).filter(row => row.hasAnyData);

      updateSummary(liceRows);
      renderTable(liceRows);
      if (typeof showToast === 'function') {
        showToast(`Lasta inn ${liceRows.length} anlegg med lusedata`, 'success');
      }
    } catch (error) {
      console.error('Lice overview load error:', error);
      const tbody = document.getElementById('lice-table');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #dc2626;">Feil ved lasting: ${error.message}</td></tr>`;
      }
      if (typeof showToast === 'function') {
        showToast(`Feil: ${error.message}`, 'error');
      }
    }
  }

  function initListeners() {
    const loadBtn = document.getElementById('lice-load');
    const filterEl = document.getElementById('lice-filter');
    const sortEl = document.getElementById('lice-sort');

    if (loadBtn) loadBtn.addEventListener('click', loadLiceOverview);
    if (filterEl) filterEl.addEventListener('change', () => renderTable(liceRows));
    if (sortEl) sortEl.addEventListener('change', () => renderTable(liceRows));
  }

  return {
    init: initListeners,
    load: loadLiceOverview
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LiceOverviewModule.init());
} else {
  LiceOverviewModule.init();
}
