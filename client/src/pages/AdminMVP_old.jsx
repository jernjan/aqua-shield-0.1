import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import AdminQuarantineCalendar from '../components/AdminQuarantineCalendar';
import InfectionChainVisualization from '../components/InfectionChainVisualization';
import styles from './Dashboard.module.css';

export default function AdminMVP({ token, currentUser }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [vesselTasks, setVesselTasks] = useState([]);
  const [quarantineRecommendations, setQuarantineRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('severity');
  const [filterRegion, setFilterRegion] = useState('alle');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      fetch('/api/mvp/admin/stats').then(r => r.json()),
      fetch('/api/mvp/admin/alerts').then(r => r.json()),
      fetch('/api/mvp/admin/vessels').then(r => r.json()),
      fetch('/api/mvp/admin/quarantine-recommendations').then(r => r.json()),
    ])
      .then(([statsData, alertsData, vesselsData, quarantineData]) => {
        setStats(statsData);
        setAlerts(alertsData.alerts || []);
        setVessels(vesselsData.vessels || []);
        setQuarantineRecommendations(quarantineData.recommendations || []);
        if ((vesselsData.vessels || []).length > 0) setSelectedVessel(vesselsData.vessels[0]);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch admin data', err);
        setLoading(false);
      });
  }, []);

  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { 'risikofylt': 0, 'høy oppmerksomhet': 1, 'moderat': 2, 'lav': 3 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const filteredAlerts = filterRegion === 'alle' 
    ? sortedAlerts 
    : sortedAlerts.filter(a => a.region === filterRegion);

  const regions = stats?.regionBreakdown?.map(r => r.name) || [];

  if (loading) return <div className={styles.container}>Laster admin-data...</div>;

  if (!stats) return <div className={styles.container}><p>Ingen data tilgjengelig</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>REGULATOR</h1>
          <p className={styles.subtitle}>Mattilsynet - Overordnet statistikk og compliance monitoring</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Oversikt' },
          { id: 'alerts', label: 'Varsler' },
          { id: 'infection', label: 'Smitte-kjede' },
          { id: 'quarantine', label: 'Karantener' },
          { id: 'vessels', label: 'Båter' },
          { id: 'compliance', label: 'Compliance' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              background: activeTab === tab.id ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--accent-gold)' : '1px solid transparent',
              borderRadius: 4,
              color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {stats && (
        <div className={styles.main}>
          {/* OVERVIEW TAB */}
          {(activeTab === 'overview') && (
            <>
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Nøkkeltall</div>
            <div className={styles.grid}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Totalt antall fiskeoppdrettsanlegg">Anlegg</Tooltip>
                </span>
                <span className={styles.cardValue}>{stats.summary.totalFacilities}</span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Anlegg med kritisk risikoscore > 60%">Kritisk risiko</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-red)' }}>
                  {stats.summary.criticalRiskFacilities}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Antall varsler totalt">Varsler</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>
                  {stats.summary.totalAlerts}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Kritiske varsler som krever handling">Kritiske</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-red)' }}>
                  {stats.summary.criticalAlerts}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Gjennomsnittlig risikoscore på tvers av alle anlegg">Gj.snitt risiko</Tooltip>
                </span>
                <span className={styles.cardValue}>{stats.summary.averageRiskScore}%</span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Anlegg med fullstendig dokumentasjon">Dokumentert</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-green)' }}>
                  {stats.complianceStatus.documented}
                </span>
              </div>
            </div>
          </div>

          {stats.regionBreakdown && stats.regionBreakdown.length > 0 && (
            <div className={styles.detail}>
              <div className={styles.detailTitle}>Regional fordeling</div>
              <div className={styles.grid}>
                {stats.regionBreakdown.map(region => (
                  <div key={region.name} className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text={`Statistikk for region ${region.name}`}>
                        {region.name}
                      </Tooltip>
                    </span>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div>Anlegg: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{region.totalFacilities}</span></div>
                      <div>Kritisk: <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{region.criticalRisk}</span></div>
                      <div>Høy: <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>{region.highRisk}</span></div>
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                        Gj.snitt: <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{region.averageRisk}%</span>
                      </div>
                      <div style={{ color: 'var(--accent-blue)' }}>
                        {region.recentAlerts} varsler (7d)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            </>
          )}

          {/* ALERTS TAB */}
          {(activeTab === 'alerts') && (
            <>
          {alerts.length > 0 && (
            <div className={styles.detail}>
              <div className={styles.detailTitle}>Nylige varsler ({filteredAlerts.length})</div>
              
              <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                <div>
                  <label style={{ color: 'var(--text-secondary)', marginRight: 6 }}>Sorter etter:</label>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 3,
                      color: 'var(--text-primary)',
                      fontSize: 11,
                    }}
                  >
                    <option value="severity">Alvorlighetsgrad</option>
                    <option value="date">Nyeste først</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ color: 'var(--text-secondary)', marginRight: 6 }}>Region:</label>
                  <select 
                    value={filterRegion} 
                    onChange={(e) => setFilterRegion(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      background: 'var(--bg-dark)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 3,
                      color: 'var(--text-primary)',
                      fontSize: 11,
                    }}
                  >
                    <option value="alle">Alle regioner</option>
                    {regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredAlerts.slice(0, 20).map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${
                        alert.severity === 'risikofylt' ? 'var(--accent-red)' :
                        alert.severity === 'høy oppmerksomhet' ? 'var(--accent-orange)' :
                        alert.severity === 'moderat' ? 'var(--accent-gold)' :
                        'var(--accent-green)'
                      }`,
                      borderRadius: 2,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr 100px',
                      gap: 12,
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{alert.farmName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{alert.region}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{alert.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{alert.dataSource}</div>
                    </div>
                    <div>
                      <span 
                        style={{
                          padding: '4px 8px',
                          borderRadius: 3,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: 
                            alert.severity === 'risikofylt' ? 'rgba(231, 76, 60, 0.2)' :
                            alert.severity === 'høy oppmerksomhet' ? 'rgba(255, 107, 53, 0.2)' :
                            alert.severity === 'moderat' ? 'rgba(212, 165, 116, 0.2)' :
                            'rgba(39, 174, 96, 0.2)',
                          color:
                            alert.severity === 'risikofylt' ? 'var(--accent-red)' :
                            alert.severity === 'høy oppmerksomhet' ? 'var(--accent-orange)' :
                            alert.severity === 'moderat' ? 'var(--accent-gold)' :
                            'var(--accent-green)',
                        }}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                    </div>
                    {alert.daysSince <= 1 && (
                      <div style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>
                        NY
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {filteredAlerts.length > 20 && (
                <div style={{ marginTop: 12, padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
                  Viser {filteredAlerts.slice(0, 20).length} av {filteredAlerts.length} varsler
                </div>
              )}
            </div>
          )}
            </>
          )}

          {/* INFECTION CHAIN TAB */}
          {(activeTab === 'infection') && (
            <>
          {/* Infection Chain Visualization */}
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Smitte-kjede analyse (havstrøm)</div>
            <InfectionChainVisualization />
          </div>
            </>
          )}

          {/* QUARANTINE TAB */}
          {(activeTab === 'quarantine') && (
            <>
          {/* Fleet-wide quarantine calendar */}
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Flåte-karantener (oversikt)</div>
            <AdminQuarantineCalendar vessels={vessels} allTasks={[]} />
          </div>
            </>
          )}

          {/* VESSELS TAB */}
          {(activeTab === 'vessels') && (
            <>
          {/* Vessels overview for Admin */}
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Båter (Admin)</div>
            <div className={styles.grid}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Totalt</span>
                <span className={styles.cardValue}>{vessels.length}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Utgåtte sertifikater</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>
                  {vessels.filter(v => v.certificates.some(c => new Date(c.expires) < new Date())).length}
                </span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Sist oppdatert (24t)</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-gold)' }}>
                  {vessels.filter(v => (Date.now() - new Date(v.lastPosition.timestamp)) / (3600*1000) <= 24).length}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.main}>
            <div className={styles.detail}>
              <div className={styles.sidebar}>
                <h3 className={styles.sidebarTitle}>BÅTER ({vessels.length})</h3>
                <div className={styles.list}>
                  {vessels.map(v => (
                    <button key={v.id} onClick={() => setSelectedVessel(v)} className={`${styles.listItem} ${selectedVessel?.id === v.id ? styles.active : ''}`}>
                      <div style={{ fontWeight: 600 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>MMSI: {v.mmsi}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.content}>
                {selectedVessel && (
                  <>
                    <div className={styles.detail}>
                      <div className={styles.detailTitle}>{selectedVessel.name} — Oppgaver ({vesselTasks.length})</div>
                      {vesselTasks.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Ingen oppgaver for denne båten</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {vesselTasks.map(t => (
                            <div key={t.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{t.name} <span style={{ marginLeft: 8, color: 'var(--accent-gold)', fontSize: 11 }}>({t.type})</span></div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Frist: {new Date(t.dueDate).toLocaleDateString('no-NO')} • Varighet: {t.duration} dager</div>
                              {t.chemicals && t.chemicals.length > 0 && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Kjemikalier: {t.chemicals.join(', ')}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
            </>
          )}

          {/* COMPLIANCE TAB */}
          {(activeTab === 'compliance') && (
            <>
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Compliance — Karantene-anbefalinger (høyeste prioritet)</div>
            
            {/* Quarantine Recommendations Summary */}
            <div className={styles.grid}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Krever umiddelbar karantene</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-red)' }}>
                  {quarantineRecommendations.filter(r => r.status === 'critical').length}
                </span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Utdatert (>7 dager)</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>
                  {quarantineRecommendations.filter(r => r.status === 'outdated').length}
                </span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Totale anbefalinger</span>
                <span className={styles.cardValue}>{quarantineRecommendations.length}</span>
              </div>
            </div>
          </div>

          {/* Quarantine Recommendations List */}
          {quarantineRecommendations.length > 0 && (
            <div className={styles.main}>
              <div className={styles.detail}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>KARANTENE-ANBEFALINGER ETTER PRIORITET</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quarantineRecommendations
                    .sort((a, b) => {
                      const severityOrder = { 'critical': 0, 'outdated': 1 };
                      return (severityOrder[a.status] || 2) - (severityOrder[b.status] || 2);
                    })
                    .map(rec => (
                      <div 
                        key={rec.id}
                        style={{
                          padding: 12,
                          background: 'var(--bg-elevated)',
                          border: rec.status === 'critical' ? '1px solid var(--accent-red)' : '1px solid var(--accent-orange)',
                          borderLeft: rec.status === 'critical' ? '4px solid var(--accent-red)' : '4px solid var(--accent-orange)',
                          borderRadius: 3,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr auto auto',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                            {rec.vesselName} → {rec.farmName}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                            {rec.vesselMmsi}
                          </div>
                        </div>
                        
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Årsak</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            {rec.status === 'critical' ? 'INGEN desinfeksjon' : `Utdatert (${rec.daysAgo} dager)`}
                          </div>
                        </div>
                        
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Alvorlighet</div>
                          <div style={{
                            padding: '4px 8px',
                            background: rec.status === 'critical' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(234, 88, 12, 0.2)',
                            color: rec.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-orange)',
                            borderRadius: 2,
                            fontSize: 11,
                            fontWeight: 600,
                            width: 'fit-content'
                          }}>
                            {rec.severity === 'høy' ? '🔴 Høy' : '🟠 Moderat'}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            fetch('/api/mvp/admin/quarantine-trigger', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                farmId: rec.farmId,
                                vesselId: rec.vesselId,
                                reason: rec.status === 'critical' ? 'Båt uten desinfeksjon' : 'Desinfeksjon utdatert',
                                durationDays: rec.status === 'critical' ? 14 : 7
                              })
                            })
                            .then(r => r.json())
                            .then(data => {
                              if (data.ok) {
                                alert('Karantene aktivert!');
                                window.location.reload();
                              }
                            })
                            .catch(err => console.error(err));
                          }}
                          style={{
                            padding: '8px 14px',
                            background: rec.status === 'critical' ? 'var(--accent-red)' : 'var(--accent-orange)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {rec.isActive ? '✓ Aktivert' : 'Sett i karantene'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {quarantineRecommendations.length === 0 && (
            <div className={styles.detail} style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                ✓ Alle båter har rapportert desinfeksjon — ingen karantene nødvendig
              </div>
            </div>
          )}

          <div className={styles.detail} style={{ marginTop: 20 }}>
            <div className={styles.detailTitle}>Rapporteringsstatus for alle båter</div>
            
            {/* Summary Cards */}
            <div className={styles.grid}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Anlegg som overvåkes</span>
                <span className={styles.cardValue}>{Array.from(new Set(vessels.flatMap(v => v.visitedFarms || []).map(f => f.id))).length || 0}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Båter som skal rapportere</span>
                <span className={styles.cardValue}>{vessels.length}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Uten desinfeksjon (kritisk)</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-red)' }}>
                  {vessels.filter(v => !v.lastDisinfection).length}
                </span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Rapportert siste 7 dager</span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-green)' }}>
                  {vessels.filter(v => v.lastDisinfection && (Date.now() - new Date(v.lastDisinfection.date)) / (24*3600*1000) <= 7).length}
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Matrix */}
          <div className={styles.main}>
            <div className={styles.detail}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>BÅTER MED RAPPORTERINGSSTATUS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vessels.map(vessel => {
                    const lastDisinfection = vessel.lastDisinfection;
                    const daysSinceReport = lastDisinfection ? 
                      Math.floor((Date.now() - new Date(lastDisinfection.date)) / (24*3600*1000)) : 
                      null;
                    
                    return (
                      <div 
                        key={vessel.id}
                        style={{
                          padding: 12,
                          background: 'var(--bg-elevated)',
                          border: `1px solid ${!lastDisinfection ? 'var(--accent-red)' : daysSinceReport > 7 ? 'var(--accent-orange)' : 'var(--accent-green)'}`,
                          borderLeft: `4px solid ${!lastDisinfection ? 'var(--accent-red)' : daysSinceReport > 7 ? 'var(--accent-orange)' : 'var(--accent-green)'}`,
                          borderRadius: 3,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{vessel.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>MMSI: {vessel.mmsi}</div>
                        </div>
                        
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Status</div>
                          <div style={{
                            padding: '4px 8px',
                            background: !lastDisinfection ? 'rgba(220, 38, 38, 0.2)' : daysSinceReport > 7 ? 'rgba(234, 88, 12, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            color: !lastDisinfection ? 'var(--accent-red)' : daysSinceReport > 7 ? 'var(--accent-orange)' : 'var(--accent-green)',
                            borderRadius: 2,
                            fontSize: 11,
                            fontWeight: 500,
                            width: 'fit-content'
                          }}>
                            {!lastDisinfection ? '✗ Ikke rapportert' : daysSinceReport > 7 ? '⚠ Utdatert' : '✓ Godkjent'}
                          </div>
                        </div>
                        
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Siste rapportering</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            {lastDisinfection 
                              ? `${daysSinceReport} dag${daysSinceReport !== 1 ? 'er' : ''} siden`
                              : 'Aldri'
                            }
                          </div>
                        </div>
                        
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Kjemikalie</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            {lastDisinfection ? lastDisinfection.chemical : '—'}
                          </div>
                        </div>
                        
                        <button
                          style={{
                            padding: '6px 12px',
                            background: !lastDisinfection ? 'var(--accent-red)' : 'var(--accent-green)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {!lastDisinfection ? 'Purring' : 'Godkjent'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}