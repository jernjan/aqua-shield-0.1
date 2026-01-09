import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function AdminMVP({ token }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/mvp/admin/stats').then(r => r.json()),
      fetch('/api/mvp/admin/alerts').then(r => r.json()),
    ])
      .then(([statsData, alertsData]) => {
        setStats(statsData);
        setAlerts(alertsData.alerts);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch admin data', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.container}>Laster admin-data...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>REGULATOR</h1>
        <p className={styles.subtitle}>Mattilsynet - Overordnet statistikk og compliance monitoring</p>
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
                  <Tooltip text="Antall varsler generert">Varsler</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-orange)' }}>
                  {stats.summary.totalAlerts}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Gjennomsnittlig risikoscore">Gj.snitt risiko</Tooltip>
                </span>
                <span className={styles.cardValue}>{stats.summary.averageRiskScore}%</span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Anlegg med godkjent dokumentasjon">Dokumentert</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-green)' }}>
                  {stats.summary.totalFacilities - stats.complianceStatus.undocumented}
                </span>
              </div>

              <div className={styles.card}>
                <span className={styles.cardLabel}>
                  <Tooltip text="Registrerte transportbåter">Båter</Tooltip>
                </span>
                <span className={styles.cardValue} style={{ color: 'var(--accent-blue)' }}>
                  {stats.summary.totalVessels}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailTitle}>Fordeling etter region</div>
            <div className={styles.grid}>
              {Object.entries(stats.byRegion).map(([region, count]) => (
                <div key={region} className={styles.card}>
                  <span className={styles.cardLabel}>{region}</span>
                  <span className={styles.cardValue}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailTitle}>
              Varsler - Siste 7 dager ({stats.alertsBy7Days})
            </div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                Ingen varsler
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <div>Farm</div>
                  <div>Type</div>
                  <div>Alvorlighetsgrad</div>
                  <div>Region</div>
                  <div>Dato</div>
                </div>
                {alerts.slice(0, 20).map(alert => (
                  <div key={alert.id} className={styles.tableRow}>
                    <div>{alert.farmName}</div>
                    <div>{alert.type}</div>
                    <div>
                      <span className={`${styles.badge} ${
                        alert.severity === 'critical' ? styles.badgeHigh :
                        alert.severity === 'high' ? styles.badgeMedium :
                        styles.badgeLow
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div>{alert.region}</div>
                    <div>{new Date(alert.timestamp).toLocaleDateString('no-NO')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
