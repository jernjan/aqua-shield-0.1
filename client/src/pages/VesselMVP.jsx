import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function VesselMVP({ token }) {
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mvp/vessel')
      .then(r => r.json())
      .then(data => {
        setVessels(data.vessels);
        if (data.vessels.length > 0) {
          setSelectedVessel(data.vessels[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch vessels', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.container}>Laster båter...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>BRØNNBÅT</h1>
        <p className={styles.subtitle}>Transportbåter - Posisjoner, last og compliance</p>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>BÅTER ({vessels.length})</h3>
          <div className={styles.list}>
            {vessels.map(vessel => (
              <button
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel)}
                className={`${styles.listItem} ${selectedVessel?.id === vessel.id ? styles.active : ''}`}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{vessel.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>MMSI: {vessel.mmsi}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.main}>
          {selectedVessel && (
            <>
              <div className={styles.detail}>
                <div className={styles.detailTitle}>{selectedVessel.name}</div>
                <div className={styles.grid}>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Maritime Mobile Service Identity">MMSI</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.mmsi}</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Type transportbåt">Type</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 14 }}>{selectedVessel.type}</span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Siste kjent posisjon">Posisjon</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 13 }}>
                      {selectedVessel.lastPosition.lat.toFixed(2)}°N
                    </span>
                  </div>
                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Gjeldende last type">Last</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 14 }}>{selectedVessel.cargo}</span>
                  </div>
                </div>
              </div>

              {selectedVessel.complianceActions && selectedVessel.complianceActions.length > 0 && (
                <div className={styles.detail}>
                  <div className={styles.detailTitle}>Compliance-handlinger</div>
                  <div className={styles.table}>
                    <div className={styles.tableHead}>
                      <div>Handling</div>
                      <div>Lokasjon</div>
                      <div>Dato</div>
                      <div>Status</div>
                      <div>Verifisert</div>
                    </div>
                    {selectedVessel.complianceActions.map((action, idx) => (
                      <div key={idx} className={styles.tableRow}>
                        <div>{action.action}</div>
                        <div>{action.location}</div>
                        <div>{new Date(action.date).toLocaleDateString('no-NO')}</div>
                        <div><span className={`${styles.badge} ${styles.badgeLow}`}>{action.status}</span></div>
                        <div><span className={action.verified ? `${styles.badge} ${styles.badgeLow}` : `${styles.badge} ${styles.badgeHigh}`}>
                          {action.verified ? 'Ja' : 'Nei'}
                        </span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedVessel.riskZones && selectedVessel.riskZones.length > 0 && (
                <div className={styles.detail}>
                  <div className={styles.detailTitle}>Risikozone-passage</div>
                  <div className={styles.table}>
                    <div className={styles.tableHead}>
                      <div>Zone</div>
                      <div>Risiko</div>
                      <div>Avstand</div>
                      <div>Dato</div>
                      <div>Status</div>
                    </div>
                    {selectedVessel.riskZones.map((zone, idx) => (
                      <div key={idx} className={styles.tableRow}>
                        <div>{zone.name}</div>
                        <div><span className={`${styles.badge} ${styles.badgeMedium}`}>{zone.riskLevel}</span></div>
                        <div>{zone.distance} km</div>
                        <div>{new Date(zone.date).toLocaleDateString('no-NO')}</div>
                        <div>{zone.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
