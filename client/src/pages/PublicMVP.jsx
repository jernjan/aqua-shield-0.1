import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function PublicMVP({ token, currentUser }) {
  const [publicData, setPublicData] = useState(null);
  const [vesselMetrics, setVesselMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    // Mock data for public view
    const mockPublicData = {
      topAlerts: [
        { id: 1, region: 'Nord-Trøndelag', severity: 'risikofylt', title: 'Høy lus-risiko', timestamp: new Date().toISOString() },
        { id: 2, region: 'Troms & Finnmark', severity: 'høy oppmerksomhet', title: 'Temperatur over grense', timestamp: new Date().toISOString() },
        { id: 3, region: 'Hordaland', severity: 'moderat', title: 'Båtkontakt registrert', timestamp: new Date().toISOString() },
      ],
      regions: [
        { name: 'Nord-Trøndelag', facilityCount: 1, recentAlerts: 2, riskLevel: 'Høy' },
        { name: 'Troms & Finnmark', facilityCount: 1, recentAlerts: 1, riskLevel: 'Moderat' },
        { name: 'Hordaland', facilityCount: 1, recentAlerts: 0, riskLevel: 'Lav' },
        { name: 'Sogn & Fjordane', facilityCount: 1, recentAlerts: 0, riskLevel: 'Lav' },
        { name: 'Møre og Romsdal', facilityCount: 1, recentAlerts: 0, riskLevel: 'Lav' },
        { name: 'Vest-Agder', facilityCount: 1, recentAlerts: 0, riskLevel: 'Lav' },
      ],
    };

    const mockVesselMetrics = {
      activeVessels: 2,
      quarantineActive: 0,
      disinfectionsThisWeek: 1,
    };

    setPublicData(mockPublicData);
    setVesselMetrics(mockVesselMetrics);
    setLoading(false);
  }, []);

  if (loading) return <div className={styles.container}>Laster områdedata...</div>;

  const sortedAlerts = publicData?.topAlerts 
    ? [...publicData.topAlerts].sort((a, b) => {
        if (sortBy === 'severity') {
          const severityOrder = { 'risikofylt': 0, 'høy oppmerksomhet': 1, 'moderat': 2, 'lav': 3 };
          return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
      })
    : [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>OMRÅDEVARSLER</h1>
          <p className={styles.subtitle}>Offentlig informasjon - Anonyme regionale varsler for nordiske kystsamfunn</p>
        </div>
      </div>

      {publicData && (
        <div className={styles.main}>
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Regionale oversikter</div>
            <div className={styles.grid}>
              {publicData.regions.map(region => (
                <div key={region.name} className={styles.card}>
                  <span className={styles.cardLabel}>
                    <Tooltip text={`Statistikk for region ${region.name}`}>
                      {region.name}
                    </Tooltip>
                  </span>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div>
                      <span style={{ color: 'var(--text-primary)' }}>{region.facilityCount}</span> anlegg
                    </div>
                    <div>
                      <span style={{ color: 'var(--accent-orange)' }}>{region.recentAlerts}</span> varsler (7d)
                    </div>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                      Risiko:{' '}
                      <span 
                        style={{
                          color: region.riskLevel === 'Høy' ? 'var(--accent-red)' :
                                 region.riskLevel === 'Moderat' ? 'var(--accent-orange)' :
                                 'var(--accent-green)',
                          fontWeight: 600,
                        }}
                      >
                        {region.riskLevel}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-secondary)' }}>
                      Score: {region.averageRisk}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {publicData.topAlerts && publicData.topAlerts.length > 0 && (
            <div className={styles.detail}>
              <div className={styles.detailTitle}>Nyeste varsler</div>
              
              <div style={{ marginBottom: 12, fontSize: 12 }}>
                <label style={{ color: 'var(--text-secondary)', marginRight: 8 }}>Sorter etter:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3,
                    color: 'var(--text-primary)',
                    fontSize: 11,
                  }}
                >
                  <option value="date">Nyeste først</option>
                  <option value="severity">Alvorlighetsgrad</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sortedAlerts.slice(0, 15).map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${
                        alert.severity === 'risikofylt' ? 'var(--accent-red)' :
                        alert.severity === 'høy oppmerksomhet' ? 'var(--accent-orange)' :
                        alert.severity === 'moderat' ? 'var(--accent-gold)' :
                        'var(--accent-green)'
                      }`,
                      borderRadius: 3,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                          {alert.region}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {alert.type}
                        </div>
                      </div>
                      <div>
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
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
                                {vesselMetrics && (
                                  <div className={styles.detail}>
                                    <div className={styles.detailTitle}>Transportbåter (aggregert)</div>
                                    <div className={styles.grid}>
                                      <div className={styles.card}>
                                        <span className={styles.cardLabel}>Totalt</span>
                                        <span className={styles.cardValue}>{vesselMetrics.total}</span>
                                      </div>
                                      <div className={styles.card}>
                                        <span className={styles.cardLabel}>Utgåtte sertifikater</span>
                                        <span className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>{vesselMetrics.expiredCerts}</span>
                                      </div>
                                      <div className={styles.card}>
                                        <span className={styles.cardLabel}>Sist oppdatert (24t)</span>
                                        <span className={styles.cardValue} style={{ color: 'var(--accent-gold)' }}>{vesselMetrics.recentPositions24h}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {alert.daysSince === 0 ? 'I dag' : alert.daysSince === 1 ? 'Igår' : `${alert.daysSince} dager siden`} — 
                      {' '}
                      {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                    </div>
                  </div>
                ))}
              </div>

              {publicData.topAlerts.length > 15 && (
                <div style={{ marginTop: 12, padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
                  Viser {Math.min(15, sortedAlerts.length)} av {publicData.topAlerts.length} varsler
                </div>
              )}
            </div>
          )}

          {publicData.disclaimer && (
            <div 
              style={{
                margin: '20px 20px',
                padding: 14,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderLeft: '3px solid var(--accent-gold)',
                borderRadius: 3,
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 6 }}>
                ℹ️ Om disse varslene
              </div>
              {publicData.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
