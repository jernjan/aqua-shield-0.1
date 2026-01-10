import { useState } from 'react';

const downloadCSV = (filename, data) => {
  const csv = data;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export default function AnalyticsMVP({ token, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const [selectedRegion, setSelectedRegion] = useState('all');

  // Mock data
  const mockRegions = [
    'Nord-Trøndelag', 'Troms & Finnmark', 'Hordaland', 
    'Sogn & Fjordane', 'Møre og Romsdal', 'Vest-Agder'
  ];

  const mockTimeSeries = [
    { date: '2026-01-01', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 1, 'Hordaland': 1, 'Sogn & Fjordane': 0, 'Møre og Romsdal': 1, 'Vest-Agder': 0 },
    { date: '2026-01-02', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 1, 'Hordaland': 2, 'Sogn & Fjordane': 1, 'Møre og Romsdal': 1, 'Vest-Agder': 1 },
    { date: '2026-01-03', 'Nord-Trøndelag': 1, 'Troms & Finnmark': 1, 'Hordaland': 0, 'Sogn & Fjordane': 1, 'Møre og Romsdal': 1, 'Vest-Agder': 0 },
    { date: '2026-01-04', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 1, 'Hordaland': 1, 'Sogn & Fjordane': 0, 'Møre og Romsdal': 1, 'Vest-Agder': 1 },
    { date: '2026-01-05', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 1, 'Hordaland': 1, 'Sogn & Fjordane': 0, 'Møre og Romsdal': 1, 'Vest-Agder': 0 },
    { date: '2026-01-06', 'Nord-Trøndelag': 1, 'Troms & Finnmark': 2, 'Hordaland': 1, 'Sogn & Fjordane': 1, 'Møre og Romsdal': 1, 'Vest-Agder': 1 },
    { date: '2026-01-07', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 0, 'Hordaland': 1, 'Sogn & Fjordane': 0, 'Møre og Romsdal': 1, 'Vest-Agder': 0 },
    { date: '2026-01-08', 'Nord-Trøndelag': 1, 'Troms & Finnmark': 1, 'Hordaland': 2, 'Sogn & Fjordane': 1, 'Møre og Romsdal': 1, 'Vest-Agder': 1 },
    { date: '2026-01-09', 'Nord-Trøndelag': 2, 'Troms & Finnmark': 1, 'Hordaland': 0, 'Sogn & Fjordane': 0, 'Møre og Romsdal': 1, 'Vest-Agder': 1 },
    { date: '2026-01-10', 'Nord-Trøndelag': 1, 'Troms & Finnmark': 2, 'Hordaland': 1, 'Sogn & Fjordane': 1, 'Møre og Romsdal': 1, 'Vest-Agder': 0 },
  ];

  const mockRegionalData = {
    'Nord-Trøndelag': { facilities: 1, critical: 1, warning: 0, avgRisk: 78, recentAlerts: 2 },
    'Troms & Finnmark': { facilities: 1, critical: 0, warning: 1, avgRisk: 65, recentAlerts: 1 },
    'Hordaland': { facilities: 1, critical: 0, warning: 1, avgRisk: 45, recentAlerts: 0 },
    'Sogn & Fjordane': { facilities: 1, critical: 0, warning: 0, avgRisk: 32, recentAlerts: 0 },
    'Møre og Romsdal': { facilities: 1, critical: 0, warning: 1, avgRisk: 55, recentAlerts: 0 },
    'Vest-Agder': { facilities: 1, critical: 0, warning: 0, avgRisk: 42, recentAlerts: 0 },
  };

  const mockDiseaseTimeSeries = {
    'Sea Lice': [
      { date: '2026-01-01', count: 5 },
      { date: '2026-01-02', count: 4 },
      { date: '2026-01-03', count: 6 },
      { date: '2026-01-04', count: 5 },
      { date: '2026-01-05', count: 7 },
      { date: '2026-01-06', count: 4 },
      { date: '2026-01-07', count: 5 },
      { date: '2026-01-08', count: 6 },
      { date: '2026-01-09', count: 8 },
      { date: '2026-01-10', count: 6 },
    ],
    'Fish Allergy Syndrome': [
      { date: '2026-01-01', count: 2 },
      { date: '2026-01-02', count: 3 },
      { date: '2026-01-03', count: 2 },
      { date: '2026-01-04', count: 2 },
      { date: '2026-01-05', count: 1 },
      { date: '2026-01-06', count: 3 },
      { date: '2026-01-07', count: 1 },
      { date: '2026-01-08', count: 2 },
      { date: '2026-01-09', count: 2 },
      { date: '2026-01-10', count: 2 },
    ],
    'Infectious Pancreatic Necrosis': [
      { date: '2026-01-01', count: 1 },
      { date: '2026-01-02', count: 0 },
      { date: '2026-01-03', count: 1 },
      { date: '2026-01-04', count: 2 },
      { date: '2026-01-05', count: 1 },
      { date: '2026-01-06', count: 0 },
      { date: '2026-01-07', count: 1 },
      { date: '2026-01-08', count: 1 },
      { date: '2026-01-09', count: 0 },
      { date: '2026-01-10', count: 1 },
    ]
  };

  // Calculate totals
  const totalAlerts = mockTimeSeries.reduce((sum, d) => sum + d.critical + d.warning + d.info, 0);
  const totalCritical = mockTimeSeries.reduce((sum, d) => sum + d.critical, 0);
  const totalFacilities = Object.values(mockRegionalData).reduce((sum, r) => sum + r.facilities, 0);

  const exportRegionalReport = () => {
    let csv = 'Region,Anlegg,Kritisk,Advarsel,Gj.snitt Risiko,Varsler (7d)\n';
    Object.entries(mockRegionalData).forEach(([region, data]) => {
      csv += `"${region}",${data.facilities},${data.critical},${data.warning},${data.avgRisk}%,${data.recentAlerts}\n`;
    });
    downloadCSV('regional-rapport.csv', csv);
  };

  const exportDiseaseReport = () => {
    let csv = 'Sykdom,Anlegg Berørt,Trend,Alvorlighet,Tilfeller\n';
    mockDiseaseData.forEach(disease => {
      csv += `"${disease.name}",${disease.facilities},"${disease.trend}","${disease.severity}",${disease.cases}\n`;
    });
    downloadCSV('sykdom-rapport.csv', csv);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Analyse & Rapporter
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Varsler (30d)</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{totalAlerts}</p>
            </div>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{totalCritical}</p>
            </div>
            <div style={{ background: 'rgba(212, 165, 116, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Anlegg Totalt</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)' }}>{totalFacilities}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'overview', label: '📊 Oversikt', icon: '📊' },
            { id: 'timeseries', label: '📈 Tidsserier', icon: '📈' },
            { id: 'regional', label: '🗺️ Regional', icon: '🗺️' },
            { id: 'diseases', label: '🦠 Sykdommer', icon: '🦠' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 10px',
                background: activeTab === tab.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--accent-gold)' : '1px solid transparent',
                borderRadius: 3,
                color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = activeTab === tab.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent';
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Tidsperiode</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 10,
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              boxSizing: 'border-box'
            }}
          >
            <option value="7d">Siste 7 dager</option>
            <option value="30d">Siste 30 dager</option>
            <option value="90d">Siste 90 dager</option>
            <option value="1y">Siste år</option>
          </select>
        </div>

        {activeTab === 'regional' && (
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 10,
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">Alle regioner</option>
              {mockRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>
            ANALYSE & RAPPORTER
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Data for forskere og regulatorer
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ maxWidth: '1400px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Varsler (30d)</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>{totalAlerts}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Kritisk</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>{totalCritical}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Regioner</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>{mockRegions.length}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Anlegg</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>{totalFacilities}</p>
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 12px 0' }}>Top Sykdommer</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.keys(mockDiseaseTimeSeries).map((disease, idx) => {
                    const data = mockDiseaseTimeSeries[disease];
                    const total = data.reduce((sum, d) => sum + d.count, 0);
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--bg-dark)', borderRadius: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{disease}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-red)' }}>{total} tilfeller</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TIMESERIES TAB */}
          {activeTab === 'timeseries' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 12px 0' }}>Varsler Per Region ({dateRange})</h3>
                <div style={{ height: 300, background: 'var(--bg-dark)', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, justifyContent: 'space-around' }}>
                    {mockTimeSeries.map((d, idx) => {
                      const regionColors = {
                        'Nord-Trøndelag': 'var(--accent-red)',
                        'Troms & Finnmark': 'var(--accent-orange)',
                        'Hordaland': 'var(--accent-gold)',
                        'Sogn & Fjordane': 'var(--accent-green)',
                        'Møre og Romsdal': '#4da6ff',
                        'Vest-Agder': '#b366ff'
                      };
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 1, height: 150, alignItems: 'flex-end' }}>
                            {mockRegions.map(region => (
                              <div 
                                key={region}
                                style={{ 
                                  width: '10px', 
                                  height: `${(d[region] / 2) * 150}px`, 
                                  background: regionColors[region], 
                                  borderRadius: 2,
                                  opacity: d[region] > 0 ? 1 : 0.2
                                }} 
                                title={`${region}: ${d[region]}`}
                              ></div>
                            ))}
                          </div>
                          <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 10 }}>
                  {mockRegions.map((region, idx) => {
                    const regionColors = {
                      'Nord-Trøndelag': 'var(--accent-red)',
                      'Troms & Finnmark': 'var(--accent-orange)',
                      'Hordaland': 'var(--accent-gold)',
                      'Sogn & Fjordane': 'var(--accent-green)',
                      'Møre og Romsdal': '#4da6ff',
                      'Vest-Agder': '#b366ff'
                    };
                    return (
                      <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 12, height: 12, background: regionColors[region], borderRadius: 2 }}></div>
                        <span>{region}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* REGIONAL TAB */}
          {activeTab === 'regional' && (
            <div style={{ maxWidth: '1400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                  🗺️ Regional Data
                </h3>
                <button
                  onClick={exportRegionalReport}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-gold)',
                    color: '#111',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  📥 Eksporter CSV
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {mockRegions.map(region => {
                  const data = mockRegionalData[region];
                  return (
                    <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 10 }}>{region}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Anlegg</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{data.facilities}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Kritisk</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{data.critical}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Advarsel</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>{data.warning}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Gj.snitt Risiko</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>{data.avgRisk}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DISEASES TAB */}
          {activeTab === 'diseases' && (
            <div style={{ maxWidth: '1400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                  🦠 Sykdomsdata
                </h3>
                <button
                  onClick={exportDiseaseReport}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-gold)',
                    color: '#111',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600
                  }}
                >
                  📥 Eksporter CSV
                </button>
              </div>

              {/* Disease Graphs */}
              <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
                {Object.entries(mockDiseaseTimeSeries).map(([disease, data]) => (
                  <div key={disease} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 10px 0' }}>{disease}</h4>
                    <div style={{ height: 200, background: 'var(--bg-dark)', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, justifyContent: 'space-around' }}>
                        {data.map((d, idx) => {
                          const maxCount = Math.max(...data.map(x => x.count));
                          const color = disease === 'Sea Lice' ? 'var(--accent-red)' : 
                                       disease === 'Fish Allergy Syndrome' ? 'var(--accent-orange)' : 
                                       'var(--accent-gold)';
                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                flex: 1, 
                                height: `${(d.count / (maxCount || 1)) * 150}px`, 
                                background: color, 
                                borderRadius: 3,
                                opacity: d.count > 0 ? 0.8 : 0.2,
                                transition: 'all 0.2s ease'
                              }} 
                              title={`${d.date}: ${d.count} varsler`}
                            ></div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 9, color: 'var(--text-secondary)' }}>
                        <span>{data[0].date}</span>
                        <span>{data[data.length - 1].date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disease Stats */}
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', margin: '20px 0 12px 0' }}>Statistikk</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {Object.entries(mockDiseaseTimeSeries).map(([disease, data]) => {
                  const totalCases = data.reduce((sum, d) => sum + d.count, 0);
                  const avgCases = Math.round(totalCases / data.length);
                  const maxCases = Math.max(...data.map(d => d.count));
                  return (
                    <div key={disease} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{disease}</p>
                      <div style={{ display: 'grid', gap: 6, fontSize: 10 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Totalt</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>{totalCases}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Gj.snitt/dag</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>{avgCases}</p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Peak</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{maxCases}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
