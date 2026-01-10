import { useState, useEffect } from 'react';

const downloadCSV = (filename, data) => {
  const csv = data;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const farmToCSV = (farms) => {
  let csv = 'Navn,Region,Risiko (%),Status\n';
  farms.forEach(farm => {
    const status = farm.riskScore > 60 ? 'Kritisk' : farm.riskScore > 40 ? 'Advarsel' : 'OK';
    csv += `"${farm.name}","${farm.region}",${farm.riskScore},"${status}"\n`;
  });
  return csv;
};

const alertToCSV = (alerts) => {
  let csv = 'Tittel,Anlegg,Region,Alvorlighet,Dato\n';
  alerts.forEach(alert => {
    csv += `"${alert.title}","${alert.facilityName}","${alert.region}","${alert.severity}","${new Date(alert.timestamp).toLocaleDateString('no-NO')}"\n`;
  });
  return csv;
};

const vesselToCSV = (vessels) => {
  let csv = 'Navn,MMSI,Type,Status\n';
  vessels.forEach(v => {
    const status = v.certificates?.some(c => new Date(c.expires) < new Date()) ? 'Utgåtte sertifikater' : 'OK';
    csv += `"${v.name}","${v.mmsi}","${v.type}","${status}"\n`;
  });
  return csv;
};

export default function AdminMVP({ token, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [outbreakConfirmation, setOutbreakConfirmation] = useState({}); // Track confirmed/denied alerts
  const [backendAlerts, setBackendAlerts] = useState([]); // Alerts from backend datalogger

  // Fetch alerts from backend on mount
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/datalog/alerts');
        const data = await response.json();
        if (data.ok && data.alerts) {
          setBackendAlerts(data.alerts);
          console.log(`Fetched ${data.alerts.length} alerts from backend`);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };
    fetchAlerts();
  }, []);

  // Mock data for demo
  const farms = [
    { id: 1, name: 'Anlegg Nord-Trøndelag', region: 'Nord-Trøndelag', riskScore: 78 },
    { id: 2, name: 'Anlegg Troms', region: 'Troms & Finnmark', riskScore: 65 },
    { id: 3, name: 'Anlegg Hordaland', region: 'Hordaland', riskScore: 45 },
    { id: 4, name: 'Anlegg Sogn', region: 'Sogn & Fjordane', riskScore: 32 },
    { id: 5, name: 'Anlegg Møre', region: 'Møre og Romsdal', riskScore: 55 },
    { id: 6, name: 'Anlegg Vest-Agder', region: 'Vest-Agder', riskScore: 42 },
  ];

  const vessels = [
    { id: 1, name: 'MV Nordlys', mmsi: '123456789', type: 'Service Vessel', certificates: [] },
    { id: 2, name: 'MV Atlantica', mmsi: '987654321', type: 'Transport', certificates: [] },
  ];

  const allFarmAlerts = {
    1: [
      { title: 'Høy lus-risiko', severity: 'risikofylt', timestamp: new Date(), region: 'Nord-Trøndelag', facilityName: 'Anlegg Nord-Trøndelag' },
      { title: 'Temperatur over grense', severity: 'høy oppmerksomhet', timestamp: new Date(), region: 'Nord-Trøndelag', facilityName: 'Anlegg Nord-Trøndelag' },
    ],
    2: [
      { title: 'Båtkontakt registrert', severity: 'moderat', timestamp: new Date(), region: 'Troms & Finnmark', facilityName: 'Anlegg Troms' },
    ],
  };

  // Calculate stats - simplified
  const criticalFarms = farms.filter(f => f.riskScore > 60).length;
  const warningFarms = farms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
  
  const totalAlertCount = Object.values(allFarmAlerts).reduce((sum, alerts) => sum + alerts.length, 0);
  const criticalAlertCount = Object.values(allFarmAlerts).reduce((sum, alerts) => sum + alerts.filter(a => a.severity === 'risikofylt').length, 0);
  
  const totalAlerts = totalAlertCount;
  const criticalAlerts = criticalAlertCount;
  const avgRisk = farms.length > 0 ? Math.round(farms.reduce((sum, f) => sum + f.riskScore, 0) / farms.length) : 0;

  // Use backend alerts if available, otherwise fallback to mock data
  const allAlerts = backendAlerts.length > 0 ? backendAlerts : Object.values(allFarmAlerts).flat();
  const filteredAlerts = allAlerts.filter(a => {
    const matchesSearch = a.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = filterRegion === 'all' || a.region === filterRegion;
    return matchesSearch && matchesRegion;
  });

  const regions = [...new Set(farms.map(f => f.region))].filter(Boolean).sort();

  const expiredCerts = vessels.filter(v => 
    v.certificates?.some(c => new Date(c.expires) < new Date())
  ).length;

  // Handle outbreak confirmation
  const handleOutbreakConfirmation = async (alertIndex, confirmed) => {
    const alertId = `alert_${alertIndex}`;
    
    // Optimistically update UI
    setOutbreakConfirmation(prev => ({
      ...prev,
      [alertId]: confirmed ? 'confirmed' : 'denied'
    }));

    // Send to datalogger backend
    try {
      const response = await fetch('http://localhost:3001/api/datalog/alert/' + alertId + '/outbreak', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmed: confirmed,
          notes: `Confirmed by Admin on ${new Date().toLocaleDateString('no-NO')}`
        })
      });

      if (response.ok) {
        console.log(`✓ Alert ${alertId} marked as ${confirmed ? 'confirmed outbreak' : 'false positive'}`);
      }
    } catch (err) {
      console.error('Error updating outbreak confirmation:', err);
      // Revert optimistic update on error
      setOutbreakConfirmation(prev => {
        const newState = { ...prev };
        delete newState[alertId];
        return newState;
      });
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Master Stats */}
        <div style={{ background: 'var(--bg-dark)', padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Master oversikt
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {criticalFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(251, 146, 60, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Advarsel</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>
                {warningFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritiske varsler</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {criticalAlerts}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'overview', label: '📊 Oversikt', icon: '📊' },
            { id: 'alerts', label: '🚨 Varsler', icon: '🚨' },
            { id: 'farms', label: '🐟 Anlegg', icon: '🐟' },
            { id: 'vessels', label: '🚢 Båter', icon: '🚢' },
            { id: 'regions', label: '🗺️ Regioner', icon: '🗺️' }
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

        {/* Search/Filter - shown in alerts/farms tabs */}
        {(activeTab === 'alerts' || activeTab === 'farms') && (
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              placeholder="Søk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 11,
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            />
            {regions.length > 1 && (
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 6,
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
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>
            REGULATOR
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Mattilsynet - Master dashboard
          </p>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Totale anlegg
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                    {farms.length}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Kritisk risiko
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>
                    {criticalFarms}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Totale varsler
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>
                    {totalAlerts}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    Gj.snitt risiko
                  </p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>
                    {avgRisk}%
                  </p>
                </div>
              </div>

              {/* Regional Breakdown */}
              {regions.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                    🗺️ Regional fordeling
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {regions.map(region => {
                      const regionFarms = farms.filter(f => f.region === region);
                      const regionCritical = regionFarms.filter(f => f.riskScore > 60).length;
                      const regionAvgRisk = regionFarms.length > 0 ? Math.round(regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / regionFarms.length) : 0;
                      return (
                        <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 8 }}>
                            {region}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Anlegg</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {regionFarms.length}
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Kritisk</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent-red)' }}>
                                {regionCritical}
                              </p>
                            </div>
                            <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Gj.snitt risiko</p>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--accent-gold)' }}>
                                {regionAvgRisk}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vessel Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    🚢 Båter
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>
                    {vessels.length}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                    {expiredCerts} utgåtte sertifikater
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
                    ⏰ Anlegg oversikt
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>
                    {farms.length}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                    totalt registrert
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {activeTab === 'alerts' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                  🚨 Varsler ({filteredAlerts.length})
                </h3>
                <button
                  onClick={() => downloadCSV('varsler.csv', alertToCSV(filteredAlerts))}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-red)',
                    color: '#fff',
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
              <div style={{ display: 'grid', gap: 6, maxHeight: '600px', overflowY: 'auto' }}>
                {filteredAlerts.slice(0, 50).map((alert, idx) => {
                  const isCritical = alert.severity === 'risikofylt';
                  const isWarning = alert.severity === 'høy oppmerksomhet';
                  const alertId = `alert_${idx}`;
                  const confirmationStatus = outbreakConfirmation[alertId];

                  return (
                    <div
                      key={idx}
                      style={{
                        background: confirmationStatus === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' : confirmationStatus === 'denied' ? 'rgba(107, 114, 128, 0.1)' : isCritical ? 'rgba(220, 38, 38, 0.1)' : isWarning ? 'rgba(251, 146, 60, 0.1)' : 'var(--bg-surface)',
                        border: confirmationStatus === 'confirmed' ? '1.5px solid #22c55e' : confirmationStatus === 'denied' ? '1px solid var(--text-secondary)' : isCritical ? '1.5px solid var(--accent-red)' : isWarning ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)',
                        borderLeft: confirmationStatus === 'confirmed' ? '3px solid #22c55e' : confirmationStatus === 'denied' ? '3px solid #6b7280' : isCritical ? '3px solid var(--accent-red)' : isWarning ? '3px solid var(--accent-orange)' : '3px solid var(--border-color)',
                        borderRadius: 4,
                        padding: 10
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {alert.title} {alert.facilityName && `(${alert.facilityName})`}
                            {confirmationStatus === 'confirmed' && <span style={{ marginLeft: 6, color: '#22c55e', fontSize: 10 }}>✓ Bekreftet utbrudd</span>}
                            {confirmationStatus === 'denied' && <span style={{ marginLeft: 6, color: '#6b7280', fontSize: 10 }}>✗ Falsk alarm</span>}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                            {alert.region} • {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                          </p>
                        </div>
                        <span style={{ fontSize: 12, marginLeft: 8 }}>
                          {confirmationStatus === 'confirmed' ? '✅' : confirmationStatus === 'denied' ? '❌' : isCritical ? '🔴' : isWarning ? '🟠' : '🟢'}
                        </span>
                      </div>

                      {/* Confirmation Buttons */}
                      {!confirmationStatus && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                          <button
                            onClick={() => handleOutbreakConfirmation(idx, true)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            ✓ Bekreftet utbrudd
                          </button>
                          <button
                            onClick={() => handleOutbreakConfirmation(idx, false)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: '#6b7280',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: 600,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.opacity = '0.8'}
                            onMouseOut={(e) => e.target.style.opacity = '1'}
                          >
                            ✗ Falsk alarm
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FARMS TAB */}
          {activeTab === 'farms' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                  🐟 Anlegg ({farms.length})
                </h3>
                <button
                  onClick={() => downloadCSV('anlegg.csv', farmToCSV(farms))}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {farms.slice(0, 30).map(farm => (
                  <div 
                    key={farm.id} 
                    style={{ 
                      background: 'var(--bg-elevated)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 6, 
                      padding: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-gold)';
                      e.currentTarget.style.background = 'var(--bg-dark)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {farm.name}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                      {farm.region}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 9, color: farm.riskScore > 60 ? 'var(--accent-red)' : farm.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                      Risiko: {farm.riskScore}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VESSELS TAB */}
          {activeTab === 'vessels' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', margin: 0, paddingBottom: 6, borderBottom: '2px solid var(--accent-green)' }}>
                  🚢 Båter ({vessels.length})
                </h3>
                <button
                  onClick={() => downloadCSV('bater.csv', vesselToCSV(vessels))}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-green)',
                    color: '#fff',
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
                {vessels.slice(0, 20).map(vessel => (
                  <div key={vessel.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {vessel.name}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                      MMSI: {vessel.mmsi} • {vessel.type}
                    </p>
                    {vessel.certificates?.some(c => new Date(c.expires) < new Date()) && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 9, color: 'var(--accent-red)' }}>
                        🔴 Utgåtte sertifikater
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REGIONS TAB */}
          {activeTab === 'regions' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                🗺️ Regioner
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {regions.map(region => {
                  const regionFarms = farms.filter(f => f.region === region);
                  const regionCritical = regionFarms.filter(f => f.riskScore > 60).length;
                  const regionWarning = regionFarms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length;
                  const regionAvgRisk = regionFarms.length > 0 ? Math.round(regionFarms.reduce((sum, f) => sum + f.riskScore, 0) / regionFarms.length) : 0;
                  return (
                    <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 10 }}>
                        {region}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Anlegg</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {regionFarms.length}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Kritisk</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>
                            {regionCritical}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Advarsel</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>
                            {regionWarning}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Gj.snitt</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>
                            {regionAvgRisk}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )})}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
