import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './Dashboard.module.css';

export default function VesselMVP({ token }) {
  const [vessels, setVessels] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    fetch('/api/mvp/vessel')
      .then(r => r.json())
      .then(data => {
        const sortedVessels = [...data.vessels].sort((a, b) => {
          if (sortBy === 'name') return a.name.localeCompare(b.name);
          if (sortBy === 'recent') return new Date(b.lastPosition.timestamp) - new Date(a.lastPosition.timestamp);
          return 0;
        });
        setVessels(sortedVessels);
        if (sortedVessels.length > 0) {
          setSelectedVessel(sortedVessels[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch vessels', err);
        setLoading(false);
      });
  }, [sortBy]);

  if (loading) return <div className={styles.container}>Laster båter...</div>;

  const expiredCerts = vessels.filter(v => 
    v.certificates.some(c => new Date(c.expires) < new Date())
  ).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>BRØNNBÅT</h1>
          <p className={styles.subtitle}>Transportbåter - Posisjoner, last og compliance</p>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Flåte</span>
            <span className={styles.statValue}>{vessels.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Utgåtte sertifikater</span>
            <span className={`${styles.statValue} ${expiredCerts > 0 ? styles.critical : ''}`}>
              {expiredCerts}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div style={{ marginBottom: 12 }}>
            <h3 className={styles.sidebarTitle}>BÅTER ({vessels.length})</h3>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Sorter etter:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                }}
              >
                <option value="name">Navn</option>
                <option value="recent">Sist oppdatert</option>
              </select>
            </div>
          </div>
          
          <div className={styles.list}>
            {vessels.map(vessel => (
              <button
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel)}
                className={`${styles.listItem} ${selectedVessel?.id === vessel.id ? styles.active : ''}`}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{vessel.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  MMSI: {vessel.mmsi}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {vessel.type}
                </div>
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
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.mmsi}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Internasjonalt skip-identifikasjonsnummer">IMO</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.imoNumber}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Kallsignal for radiokommunikasjon">Kallsignal</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedVessel.callSign}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Type transportbåt">Type</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.type}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Båtens eier">Rederiet</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.owner}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Ansvarlig kaptein">Kaptein</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.captain}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Siste kjent posisjon">Posisjon</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 12 }}>
                      {selectedVessel.lastPosition.lat.toFixed(2)}°N / {selectedVessel.lastPosition.lng.toFixed(2)}°E
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Når posisjonen sist ble oppdatert">Oppdatert</Tooltip>
                    </span>
                    <span className={styles.cardValue} style={{ fontSize: 11 }}>
                      {new Date(selectedVessel.lastPosition.timestamp).toLocaleDateString('no-NO')}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Type last i hold">Last</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.cargo.type}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Mengde last">Antall tonn</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.cargo.quantity}</span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Dokumentasjonsstatus">Status</Tooltip>
                    </span>
                    <span className={`${styles.cardValue} ${
                      selectedVessel.documentationStatus === 'godkjent' ? '' : 
                      selectedVessel.documentationStatus === 'utløpt' ? styles.warning : ''
                    }`}>
                      {selectedVessel.documentationStatus}
                    </span>
                  </div>

                  <div className={styles.card}>
                    <span className={styles.cardLabel}>
                      <Tooltip text="Antall dokumenterte fangster">Fangster</Tooltip>
                    </span>
                    <span className={styles.cardValue}>{selectedVessel.catches}</span>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Sertifikater
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedVessel.certificates.map((cert, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: 10,
                        background: 'var(--bg-elevated)',
                        border: `1px solid ${new Date(cert.expires) < new Date() ? 'var(--accent-red)' : 'var(--border-color)'}`,
                        borderRadius: 3,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {cert.type}
                        {new Date(cert.expires) < new Date() && (
                          <span style={{ marginLeft: 8, color: 'var(--accent-red)', fontSize: 11 }}>⚠️ UTGÅTT</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                        Utløper: {new Date(cert.expires).toLocaleDateString('no-NO')}
                      </div>
                    </div>
                  ))}
                </div>

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Risikoflater
                </h4>
                {selectedVessel.riskZonesEntered.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                    Ingen risikosoner besøkt
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedVessel.riskZonesEntered.map((zone, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: 10,
                          background: 'var(--bg-elevated)',
                          border: `1px solid ${
                            zone.riskLevel === 'høy' ? 'var(--accent-orange)' :
                            zone.riskLevel === 'moderat' ? 'var(--accent-gold)' :
                            'var(--border-color)'
                          }`,
                          borderLeft: `3px solid ${
                            zone.riskLevel === 'høy' ? 'var(--accent-orange)' :
                            zone.riskLevel === 'moderat' ? 'var(--accent-gold)' :
                            'var(--accent-green)'
                          }`,
                          borderRadius: 3,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {zone.zone}
                          <span style={{ marginLeft: 8, color: 'var(--accent-gold)', fontSize: 11 }}>
                            {zone.riskLevel}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>
                          {zone.distance} km away
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {new Date(zone.timestamp).toLocaleDateString('no-NO')} — {zone.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ fontSize: 13, marginTop: 20, marginBottom: 12, color: 'var(--accent-gold)', fontWeight: 600 }}>
                  Compliance-handlinger
                </h4>
                {selectedVessel.complianceActions.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 10 }}>
                    Ingen handlinger registrert
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedVessel.complianceActions.map((action, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: 10,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-color)',
                          borderLeft: action.verified ? '3px solid var(--accent-green)' : '3px solid var(--accent-gold)',
                          borderRadius: 3,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {action.action}
                          {action.verified && (
                            <span style={{ marginLeft: 8, color: 'var(--accent-green)', fontSize: 11 }}>✓ VERIFISERT</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2 }}>
                          {action.location}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {new Date(action.date).toLocaleDateString('no-NO')}
                        </div>
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
  );
}
