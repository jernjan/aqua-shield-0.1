import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [outbreakConfirmation, setOutbreakConfirmation] = useState({});
  const [backendAlerts, setBackendAlerts] = useState([]);
  const [realOutbreaks, setRealOutbreaks] = useState([]);
  const [outbreakStats, setOutbreakStats] = useState(null);
  const [loadingOutbreaks, setLoadingOutbreaks] = useState(false);
  const [lastOutbreakRefresh, setLastOutbreakRefresh] = useState(null);
  const [facilityAlerts, setFacilityAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState(null);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [selectedRiskyFacility, setSelectedRiskyFacility] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [sortBy, setSortBy] = useState('risk');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    const fetchRisks = async () => {
      try {
        setLoadingRisks(true);
        const data = await apiClient.get('/api/admin/risks');
        if (data && data.summary) {
          setRiskAssessment(data);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Error fetching risk assessment:', err);
      } finally {
        setLoadingRisks(false);
      }
    };
    fetchRisks();
    const interval = setInterval(fetchRisks, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)', background: 'var(--bg-dark)' }}>
      <div style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Risiko oppsummering
          </h3>
          {riskAssessment ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
              <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Kritisk</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{riskAssessment.summary.critical}</p>
              </div>
              <div style={{ background: 'rgba(251, 146, 60, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Høy</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-orange)' }}>{riskAssessment.summary.high}</p>
              </div>
              <div style={{ background: 'rgba(220, 38, 38, 0.15)', borderRadius: 3, padding: '6px 8px', textAlign: 'center', gridColumn: '1 / -1' }}>
                <p style={{ margin: 0, fontSize: 8, color: 'var(--text-secondary)' }}>Total anlegg</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-gold)' }}>{riskAssessment.metadata.total_facilities}</p>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>Laster...</p>
          )}
        </div>

        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'dashboard', label: '📊 Dashboard', color: 'var(--accent-gold)' },
            { id: 'risks', label: '⚠️ Risiko', color: '#DC2626' },
            { id: 'distribution', label: '📦 Fordeling', color: '#3B82F6' },
            { id: 'vessels', label: '🚢 Båter', color: '#8B5CF6' },
            { id: 'facilities', label: '🏭 Anlegg', color: '#14B8A6' },
            { id: 'monitoring', label: '👁️ Overvåking', color: '#F59E0B' },
            { id: 'history', label: '📚 Historikk', color: '#06B6D4' }
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderBottom: '2px solid var(--accent-gold)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>ADMIN</h1>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Ditt administratorpanel</p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {riskAssessment?.summary?.critical > 0 && (
              <div style={{ background: 'rgba(220, 38, 38, 0.2)', border: '2px solid #DC2626', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{riskAssessment.summary.critical} Kritisk</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>Trenger handling</p>
                </div>
              </div>
            )}
            {lastUpdated && (
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>🔄 Oppdatert: {lastUpdated.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</p>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, marginBottom: 20, marginTop: 0 }}>Administrativ Oversikt</h2>
              {riskAssessment ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '2px solid #DC2626', borderRadius: 6, padding: 16, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>🔴 Kritisk</p>
                      <p style={{ fontSize: 36, fontWeight: 700, color: '#DC2626', margin: 0 }}>{riskAssessment.summary.critical}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>Krever øyeblikkelig handling</p>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', border: '2px solid #F59E0B', borderRadius: 6, padding: 16, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>🟠 Høy</p>
                      <p style={{ fontSize: 36, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{riskAssessment.summary.high}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>Trenger oppfølging</p>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', border: '2px solid #3B82F6', borderRadius: 6, padding: 16, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>🟡 Medium</p>
                      <p style={{ fontSize: 36, fontWeight: 700, color: '#3B82F6', margin: 0 }}>{riskAssessment.summary.medium}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>Under observasjon</p>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', border: '2px solid #10B981', borderRadius: 6, padding: 16, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>📊 Totalt</p>
                      <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>{riskAssessment.metadata.total_facilities}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>Anlegg totalt</p>
                    </div>
                  </div>
                  <h3 style={{ color: 'var(--accent-gold)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Regional Status</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    {[...new Set(riskAssessment.risky.map(f => f.municipality))].map((region, idx) => {
                      const regionFacilities = riskAssessment.risky.filter(f => f.municipality === region);
                      const critical = regionFacilities.filter(f => f.riskLevel === 'CRITICAL').length;
                      const high = regionFacilities.filter(f => f.riskLevel === 'HIGH').length;
                      const avgRisk = Math.round(regionFacilities.reduce((sum, f) => sum + (f.ownRisk || 0), 0) / regionFacilities.length);
                      return (
                        <div key={idx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)' }}>{region}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                            <div><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Kritisk</p><p style={{ margin: '2px 0 0 0', fontSize: 16, fontWeight: 700, color: '#DC2626' }}>{critical}</p></div>
                            <div><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Høy</p><p style={{ margin: '2px 0 0 0', fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>{high}</p></div>
                            <div style={{ gridColumn: '1 / -1' }}><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 9 }}>Gjennomsnittlig risiko</p><p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)' }}>{avgRisk}%</p></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Laster oversikt...</div>
              )}
            </div>
          )}

          {/* DISTRIBUTION TAB */}
          {activeTab === 'distribution' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, margin: 0 }}>Fordeling til Undergrupper</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    const criticals = riskAssessment.risky.filter(f => f.riskLevel === 'CRITICAL');
                    setAssignments(prev => ({
                      ...prev,
                      ...criticals.reduce((acc, f) => ({ ...acc, [f.id]: 'mattilsynet' }), {})
                    }));
                  }} style={{ background: '#DC2626', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Tilordne Alle Kritisk</button>
                  <button onClick={() => {
                    const highs = riskAssessment.risky.filter(f => f.riskLevel === 'HIGH');
                    setAssignments(prev => ({
                      ...prev,
                      ...highs.reduce((acc, f) => ({ ...acc, [f.id]: 'regional' }), {})
                    }));
                  }} style={{ background: '#F59E0B', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Tilordne Alle Høy</button>
                </div>
              </div>
              {riskAssessment ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                  <div style={{ background: 'rgba(220, 38, 38, 0.1)', border: '2px solid #DC2626', borderRadius: 6, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>🔴 Mattilsynet - Kritisk</h3>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>Anlegg som krever øyeblikkelig tilsyn</p>
                    <div style={{ background: 'var(--bg-dark)', padding: 10, borderRadius: 4, maxHeight: '300px', overflowY: 'auto' }}>
                      {riskAssessment.risky.filter(f => f.riskLevel === 'CRITICAL').length > 0 ? (
                        riskAssessment.risky.filter(f => f.riskLevel === 'CRITICAL').map((f, i) => (
                          <div key={i} style={{ fontSize: 10, padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</p>
                              <p style={{ margin: '2px 0 0 0' }}>{f.municipality} • Risiko: {f.ownRisk}%</p>
                            </div>
                            {assignments[f.id] === 'mattilsynet' && (
                              <span style={{ fontSize: 9, background: '#DC2626', color: 'white', padding: '2px 6px', borderRadius: 3, marginLeft: 6, whiteSpace: 'nowrap' }}>✓ Tildelt</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '10px', margin: 0 }}>Ingen kritiske anlegg</p>
                      )}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '2px solid #F59E0B', borderRadius: 6, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>🟠 Regionalt Helseteam - Høy</h3>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>Anlegg som trenger oppfølging</p>
                    <div style={{ background: 'var(--bg-dark)', padding: 10, borderRadius: 4, maxHeight: '300px', overflowY: 'auto' }}>
                      {riskAssessment.risky.filter(f => f.riskLevel === 'HIGH').length > 0 ? (
                        riskAssessment.risky.filter(f => f.riskLevel === 'HIGH').map((f, i) => (
                          <div key={i} style={{ fontSize: 10, padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</p>
                              <p style={{ margin: '2px 0 0 0' }}>{f.municipality} • Risiko: {f.ownRisk}%</p>
                            </div>
                            {assignments[f.id] === 'regional' && (
                              <span style={{ fontSize: 9, background: '#F59E0B', color: 'white', padding: '2px 6px', borderRadius: 3, marginLeft: 6, whiteSpace: 'nowrap' }}>✓ Tildelt</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '10px', margin: 0 }}>Ingen høy-risiko anlegg</p>
                      )}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '2px solid #3B82F6', borderRadius: 6, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#3B82F6' }}>🟡 Oppdrettere - Medium</h3>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>Anlegg under observasjon</p>
                    <div style={{ background: 'var(--bg-dark)', padding: 10, borderRadius: 4, maxHeight: '300px', overflowY: 'auto' }}>
                      {riskAssessment.risky.filter(f => f.riskLevel === 'MEDIUM').length > 0 ? (
                        riskAssessment.risky.filter(f => f.riskLevel === 'MEDIUM').map((f, i) => (
                          <div key={i} style={{ fontSize: 10, padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</p>
                              <p style={{ margin: '2px 0 0 0' }}>{f.municipality} • Risiko: {f.ownRisk}%</p>
                            </div>
                            {assignments[f.id] === 'farmer' && (
                              <span style={{ fontSize: 9, background: '#3B82F6', color: 'white', padding: '2px 6px', borderRadius: 3, marginLeft: 6, whiteSpace: 'nowrap' }}>✓ Tildelt</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '10px', margin: 0 }}>Ingen medium-risiko anlegg</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Laster fordeling...</div>
              )}
              {lastUpdated && (
                <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-elevated)', borderRadius: 4, textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                  Sist oppdatert: {lastUpdated.toLocaleString('no-NO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
            </div>
          )}

          {/* RISK ANALYSIS TAB */}
          {activeTab === 'risks' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              {loadingRisks ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  ⏳ Laster risiko-analyse...
                </div>
              ) : riskAssessment ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Total</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-gold)', margin: 0 }}>{riskAssessment.metadata.total_facilities}</p>
                    </div>
                    <div style={{ background: 'rgba(220, 38, 38, 0.1)', border: '2px solid #DC2626', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🔴 Kritisk</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#DC2626', margin: 0 }}>{riskAssessment.summary.critical}</p>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '2px solid #F59E0B', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🟠 Høy</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{riskAssessment.summary.high}</p>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '2px solid #3B82F6', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>🟡 Medium</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6', margin: 0 }}>{riskAssessment.summary.medium}</p>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10B981', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#10B981', margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Gj.snitt risiko</p>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#10B981', margin: 0 }}>{Math.round((riskAssessment.risky.reduce((sum, f) => sum + (f.ownRisk || 0), 0) / Math.max(riskAssessment.metadata.total_facilities, 1)) * 100)}%</p>
                    </div>
                  </div>

                  <h3 style={{ color: 'var(--accent-gold)', fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 20 }}>🗺️ Regional fordeling</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 24 }}>
                    {riskAssessment.risky.length > 0 && [...new Set(riskAssessment.risky.map(f => f.municipality))].map((region, idx) => {
                      const regionFacilities = riskAssessment.risky.filter(f => f.municipality === region);
                      const avgRegionRisk = Math.round(regionFacilities.reduce((sum, f) => sum + (f.ownRisk || 0), 0) / regionFacilities.length);
                      const criticalCount = regionFacilities.filter(f => f.riskLevel === 'CRITICAL').length;
                      return (
                        <div key={idx} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12 }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{region}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Anlegg</p>
                              <p style={{ margin: '2px 0 0 0', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{regionFacilities.length}</p>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)' }}>Kritisk</p>
                              <p style={{ margin: '2px 0 0 0', fontSize: 16, fontWeight: 700, color: criticalCount > 0 ? '#DC2626' : '#10B981' }}>{criticalCount}</p>
                            </div>
                          </div>
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                            <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>Gj. risiko</p>
                            <div style={{ width: '100%', height: 20, background: 'var(--bg-dark)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ width: `${Math.min(avgRegionRisk, 100)}%`, height: '100%', background: avgRegionRisk >= 75 ? '#DC2626' : avgRegionRisk >= 60 ? '#F59E0B' : avgRegionRisk >= 45 ? '#3B82F6' : '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'white' }}>{avgRegionRisk}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {riskAssessment.risky.length > 0 ? (
                    <>
                      <h3 style={{ color: 'var(--accent-gold)', fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>⚠️ Risiko-anlegg ({riskAssessment.risky.length})</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        {riskAssessment.risky.map((facility, idx) => (
                          <div key={idx} onClick={() => setSelectedRiskyFacility(selectedRiskyFacility?.id === facility.id ? null : facility)} style={{ background: 'var(--bg-elevated)', border: facility.riskLevel === 'CRITICAL' ? '2px solid #DC2626' : facility.riskLevel === 'HIGH' ? '2px solid #F59E0B' : '2px solid #3B82F6', borderRadius: 6, padding: 12, cursor: 'pointer', transition: 'all 0.15s ease' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 165, 116, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{facility.name} ({facility.municipality})</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>Lus: {facility.liceCount} | Status: {facility.diseaseStatus || 'OK'}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: facility.riskLevel === 'CRITICAL' ? '#DC2626' : facility.riskLevel === 'HIGH' ? '#F59E0B' : '#3B82F6' }}>{facility.ownRisk}</p>
                                <p style={{ margin: '2px 0 0 0', fontSize: 10, fontWeight: 600, color: facility.riskLevel === 'CRITICAL' ? '#DC2626' : facility.riskLevel === 'HIGH' ? '#F59E0B' : '#3B82F6' }}>{facility.riskLevel}</p>
                              </div>
                            </div>
                            {selectedRiskyFacility?.id === facility.id && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Kan smitte følgende anlegg:</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                  {facility.transmissionTargets.slice(0, 6).sort((a, b) => (b.transmissionRisk?.score || 0) - (a.transmissionRisk?.score || 0)).map((target, tidx) => {
                                    const riskScore = target.transmissionRisk?.score || 0;
                                    const distance = target.transmissionRisk?.distance || 0;
                                    return <div key={tidx} style={{ background: riskScore >= 75 ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-dark)', padding: 8, borderRadius: 4, fontSize: 10, border: riskScore >= 75 ? '1px solid #DC2626' : '1px solid transparent' }}><p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--text-primary)' }}>{target.name}</p><p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)' }}>Risk: <span style={{ color: riskScore >= 75 ? '#DC2626' : riskScore >= 60 ? '#F59E0B' : riskScore >= 45 ? '#3B82F6' : '#10B981', fontWeight: 600 }}>{riskScore}</span></p><p style={{ margin: 0, color: 'var(--text-secondary)' }}>📍 {distance.toFixed(1)} km</p></div>;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ background: 'var(--bg-elevated)', padding: 40, textAlign: 'center', borderRadius: 6 }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>✓ Ingen anlegg over risikoterskelen (70+)</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Ingen risiko-data tilgjengelig</div>
              )}
            </div>
          )}

          {activeTab === 'vessels' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>🚢 Båter & Sertifikater</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '2px solid #8B5CF6', borderRadius: 6, padding: 16 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#8B5CF6' }}>Total Båter</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--accent-gold)' }}>4047+</p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>AIS-sporede fartøy</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '2px solid #F59E0B', borderRadius: 6, padding: 16 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>Utgåtte Sertifikater</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--accent-gold)' }}>--</p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Krever oppmerksomhet</p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '2px solid #14B8A6', borderRadius: 6, padding: 16 }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: '#14B8A6' }}>Aktive i Risikosone</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--accent-gold)' }}>--</p>
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Nær kritiske anlegg</p>
                </div>
              </div>
              <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                💡 Data fra: <code style={{ fontSize: 10, background: 'var(--bg-dark)', padding: '2px 4px', borderRadius: 2 }}>/api/mvp/admin/vessels</code>
              </div>
            </div>
          )}

          {activeTab === 'facilities' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>🏭 Anlegg Oversikt</h2>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ padding: 12, maxHeight: '500px', overflowY: 'auto' }}>
                  {riskAssessment?.risky?.slice(0, 20).map((f, i) => (
                    <div key={i} style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</p>
                        <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: 9 }}>{f.municipality}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: f.ownRisk >= 85 ? '#DC2626' : f.ownRisk >= 75 ? '#F59E0B' : '#3B82F6' }}>{f.ownRisk}%</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ background: f.ownRisk >= 85 ? 'rgba(220,38,38,0.3)' : f.ownRisk >= 75 ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)', padding: '2px 6px', borderRadius: 3, fontSize: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.riskLevel}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 10, background: 'var(--bg-dark)', textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>Viser 20 av {riskAssessment?.risky?.length || 0} anlegg</div>
              </div>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>👁️ Overvåking & Sensorer</h2>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 20, textAlign: 'center', border: '2px dashed var(--border-color)' }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Samlegruppe for Forskere, Studenter & Forsikringsselskaper</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', borderRadius: 4, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#F59E0B', fontSize: 12 }}>Forskere</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>Sensordata & feltobservasjoner</p>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3B82F6', borderRadius: 4, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#3B82F6', fontSize: 12 }}>Studenter</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>Prosjekt & validering</p>
                  </div>
                  <div style={{ background: 'rgba(14, 182, 210, 0.1)', border: '1px solid #06B6D4', borderRadius: 4, padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#06B6D4', fontSize: 12 }}>Forsikring</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>Risikovurdering & data</p>
                  </div>
                </div>
                <p style={{ margin: '16px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>🚀 Kommer snart: Sensor-integrasjon og validerings-data</p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px 16px' }}>
              <h2 style={{ color: 'var(--accent-gold)', fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>📚 Modellhistorikk & Trening</h2>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 20, textAlign: 'center', border: '2px dashed var(--border-color)' }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Predikert vs. Faktisk Data</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Batch-oppdateringer når modellen er i produksjon</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 20 }}>
                  <div style={{ background: 'rgba(220, 38, 38, 0.1)', borderRadius: 4, padding: 12, border: '1px solid #DC2626' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#DC2626' }}>🎯 Accuracy</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)' }}>--</p>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: 4, padding: 12, border: '1px solid #F59E0B' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#F59E0B' }}>📈 Sensitivity</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)' }}>--</p>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderRadius: 4, padding: 12, border: '1px solid #3B82F6' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#3B82F6' }}>📊 Precision</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)' }}>--</p>
                  </div>
                </div>
                <p style={{ margin: '16px 0 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>🔄 Starter når modellen er operativ (estimert 1-2 dager)</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
