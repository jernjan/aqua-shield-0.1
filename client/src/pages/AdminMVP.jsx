import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function AdminMVP({ token }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('severity');
  const [filterRegion, setFilterRegion] = useState('alle');

  useEffect(() => {
    Promise.all([
      fetch('/api/mvp/admin/stats').then(r => r.json()),
      fetch('/api/mvp/admin/alerts').then(r => r.json()),
    ])
      .then(([statsData, alertsData]) => {
        setStats(statsData);
        setAlerts(alertsData.alerts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch admin data', err);
        setLoading(false);
      });
  }, []);

  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const filteredAlerts = filterRegion === 'alle' 
    ? sortedAlerts 
    : sortedAlerts.filter(a => a.region === filterRegion);

  const regions = stats?.regionBreakdown?.map(r => r.name) || [];

  if (loading) return <div className={styles.container}>Laster admin-data...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>REGULATOR</h1>
          <p className={styles.subtitle}>Mattilsynet - Overordnet statistikk og compliance monitoring</p>
        </div>
      </div>

      {stats && (
        <div className={styles.main}>
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
                        alert.severity === 'critical' ? 'var(--accent-red)' :
                        alert.severity === 'high' ? 'var(--accent-orange)' :
                        alert.severity === 'medium' ? 'var(--accent-gold)' :
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
                            alert.severity === 'critical' ? 'rgba(231, 76, 60, 0.2)' :
                            alert.severity === 'high' ? 'rgba(255, 107, 53, 0.2)' :
                            alert.severity === 'medium' ? 'rgba(212, 165, 116, 0.2)' :
                            'rgba(39, 174, 96, 0.2)',
                          color:
                            alert.severity === 'critical' ? 'var(--accent-red)' :
                            alert.severity === 'high' ? 'var(--accent-orange)' :
                            alert.severity === 'medium' ? 'var(--accent-gold)' :
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
        </div>
      )}
    </div>
  );
}
