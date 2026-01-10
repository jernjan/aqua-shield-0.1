import { useState } from 'react';

export default function AdminMVP({ token, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data
  const stats = {
    totalFarms: 127,
    criticalFarms: 12,
    warningFarms: 34,
    totalAlerts: 89,
    criticalAlerts: 23,
    avgRisk: 42,
    regions: ['Nord-Trøndelag', 'Troms & Finnmark', 'Hordaland', 'Sogn & Fjordane'],
  };

  const farms = [
    { id: 1, name: 'Anlegg Nord', region: 'Nord-Trøndelag', riskScore: 78, alerts: 5 },
    { id: 2, name: 'Anlegg Midt', region: 'Troms & Finnmark', riskScore: 65, alerts: 3 },
    { id: 3, name: 'Anlegg Vest', region: 'Hordaland', riskScore: 45, alerts: 2 },
    { id: 4, name: 'Anlegg Sogn', region: 'Sogn & Fjordane', riskScore: 32, alerts: 1 },
  ];

  const vessels = [
    { id: 1, name: 'MV Nordlys', mmsi: '123456789', type: 'Service Vessel', expiredCerts: 0 },
    { id: 2, name: 'MV Atlantica', mmsi: '987654321', type: 'Transport', expiredCerts: 1 },
    { id: 3, name: 'MV Polaris', mmsi: '555666777', type: 'Service Vessel', expiredCerts: 0 },
  ];

  const allAlerts = [
    { id: 1, title: 'Høy lus-risiko', farm: 'Anlegg Nord', severity: 'risikofylt', date: '2026-01-10' },
    { id: 2, title: 'Temperatur over grense', farm: 'Anlegg Midt', severity: 'høy oppmerksomhet', date: '2026-01-09' },
    { id: 3, title: 'Båtkontakt registrert', farm: 'Anlegg Vest', severity: 'moderat', date: '2026-01-08' },
    { id: 4, title: 'Dødeligheit opp 15%', farm: 'Anlegg Sogn', severity: 'lav', date: '2026-01-07' },
  ];

  const getRegionStats = (region) => {
    const regionFarms = farms.filter(f => f.region === region);
    return {
      total: regionFarms.length,
      critical: regionFarms.filter(f => f.riskScore > 60).length,
      warning: regionFarms.filter(f => f.riskScore > 40 && f.riskScore <= 60).length,
      avgRisk: regionFarms.length > 0 ? Math.round(regionFarms.reduce((s, f) => s + f.riskScore, 0) / regionFarms.length) : 0,
    };
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {stats.criticalFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(251, 146, 60, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Advarsel</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>
                {stats.warningFarms}
              </p>
            </div>
            <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritiske varsler</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                {stats.criticalAlerts}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'overview', label: '📊 Oversikt' },
            { id: 'alerts', label: '🚨 Varsler' },
            { id: 'farms', label: '🐟 Anlegg' },
            { id: 'vessels', label: '🚢 Båter' },
            { id: 'regions', label: '🗺️ Regioner' }
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
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>
            REGULATOR
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Mattilsynet - Master dashboard (test data)
          </p>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>Totale anlegg</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>{stats.totalFarms}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>Kritisk risiko</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-red)', margin: 0 }}>{stats.criticalFarms}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>Totale varsler</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>{stats.totalAlerts}</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>Gj.snitt risiko</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-green)', margin: 0 }}>{stats.avgRisk}%</p>
                </div>
              </div>

              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                🗺️ Regional oversikt
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {stats.regions.map(region => {
                  const r = getRegionStats(region);
                  return (
                    <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 8 }}>{region}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
                        <div><p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Anlegg</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{r.total}</p></div>
                        <div><p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{r.critical}</p></div>
                        <div><p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Advarsel</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>{r.warning}</p></div>
                        <div><p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Gj.snitt</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)' }}>{r.avgRisk}%</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ALERTS */}
          {activeTab === 'alerts' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-red)' }}>
                🚨 Varsler ({allAlerts.length})
              </h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {allAlerts.map(alert => (
                  <div key={alert.id} style={{
                    background: alert.severity === 'risikofylt' ? 'rgba(220, 38, 38, 0.1)' : alert.severity === 'høy oppmerksomhet' ? 'rgba(251, 146, 60, 0.1)' : 'var(--bg-surface)',
                    border: alert.severity === 'risikofylt' ? '1.5px solid var(--accent-red)' : alert.severity === 'høy oppmerksomhet' ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)',
                    borderLeft: alert.severity === 'risikofylt' ? '3px solid var(--accent-red)' : alert.severity === 'høy oppmerksomhet' ? '3px solid var(--accent-orange)' : '3px solid var(--border-color)',
                    borderRadius: 4,
                    padding: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {alert.title} ({alert.farm})
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>
                          {alert.date}
                        </p>
                      </div>
                      <span style={{ fontSize: 12 }}>
                        {alert.severity === 'risikofylt' ? '🔴' : alert.severity === 'høy oppmerksomhet' ? '🟠' : '🟢'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FARMS */}
          {activeTab === 'farms' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-gold)' }}>
                🐟 Anlegg ({farms.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {farms.map(farm => (
                  <div key={farm.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{farm.name}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>{farm.region}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 9, color: farm.riskScore > 60 ? 'var(--accent-red)' : farm.riskScore > 40 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                      Risiko: {farm.riskScore}% • {farm.alerts} varsler
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VESSELS */}
          {activeTab === 'vessels' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-green)' }}>
                🚢 Båter ({vessels.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {vessels.map(v => (
                  <div key={v.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>MMSI: {v.mmsi} • {v.type}</p>
                    {v.expiredCerts > 0 && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 9, color: 'var(--accent-red)' }}>🔴 {v.expiredCerts} utgåtte sertifikater</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REGIONS */}
          {activeTab === 'regions' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid var(--accent-orange)' }}>
                🗺️ Regionalt detaljnivå
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {stats.regions.map(region => {
                  const r = getRegionStats(region);
                  return (
                    <div key={region} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 10 }}>{region}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                        <div><p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Anlegg</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{r.total}</p></div>
                        <div><p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Kritisk</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>{r.critical}</p></div>
                        <div><p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Advarsel</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-orange)' }}>{r.warning}</p></div>
                        <div><p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Gj.snitt risiko</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>{r.avgRisk}%</p></div>
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
