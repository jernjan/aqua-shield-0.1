import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function PublicMVP({ token }) {
  const [publicData, setPublicData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mvp/public')
      .then(r => r.json())
      .then(data => {
        setPublicData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch public data', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.container}>Laster områdedata...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>OMRÅDEVARSLER</h1>
        <p className={styles.subtitle}>Offentlig informasjon - Anonyme regionale varsler for nordiske kystsamfunn</p>
      </div>

      {publicData && (
        <div className={styles.main}>
          <div className={styles.detail}>
            <div className={styles.detailTitle}>Regionale oversikter</div>
            <div className={styles.grid}>
              {publicData.regions.map(region => (
                <div key={region.name} className={styles.card}>
                  <span className={styles.cardLabel}>
                    <Tooltip text="Geografisk område">
                      {region.name}
                    </Tooltip>
                  </span>
                  <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <div>{region.facilityCount} anlegg</div>
                    <div>{region.recentAlerts} varsler</div>
                    <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--accent-gold)' }}>
                      {region.averageRisk}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailTitle}>Siste varsler</div>
            {publicData.topAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                Ingen varsler
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {publicData.topAlerts.slice(0, 10).map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      border: `1px solid var(--border-color)`,
                      borderLeft: `4px solid ${
                        alert.severity === 'critical' ? 'var(--accent-red)' :
                        alert.severity === 'high' ? 'var(--accent-orange)' :
                        'var(--accent-gold)'
                      }`,
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {alert.region} — {alert.type}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span className={`${styles.badge} ${
                        alert.severity === 'critical' ? styles.badgeHigh :
                        alert.severity === 'high' ? styles.badgeMedium :
                        styles.badgeLow
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.detail} style={{ background: 'rgba(212, 165, 116, 0.1)', borderColor: 'var(--accent-gold)' }}>
            <div className={styles.detailTitle} style={{ color: 'var(--text-secondary)' }}>Om denne siden</div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Denne siden viser aggregert, anonymisert data fra fiskeoppdrettsanlegg i Norge. 
              Data oppdateres daglig basert på varsler fra Mattilsynet, BarentsWatch og meteorologiske kilder.
              For detaljert informasjon om spesifikke anlegg, kontakt Mattilsynet eller logg inn som anleggseier.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
