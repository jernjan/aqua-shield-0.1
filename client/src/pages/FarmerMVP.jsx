import { useEffect, useState } from 'react';
import Tooltip from '../components/Tooltip';
import styles from './FarmerMVP.module.css';

export default function FarmerMVP({ token }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('severity');

  useEffect(() => {
    fetch('/api/mvp/farmer')
      .then(r => r.json())
      .then(data => {
        setFarms(data.farms);
        if (data.farms.length > 0) {
          setSelectedFarm(data.farms[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch farms', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedFarm) return;
    
    fetch(`/api/mvp/farmer/${selectedFarm.id}`)
      .then(r => r.json())
      .then(data => setAlerts(data.alerts))
      .catch(err => console.error('Failed to fetch farm alerts', err));
  }, [selectedFarm]);

  const handleMarkAsRead = (alertId) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isRead: true } : a));
  };

  const handleDownloadPDF = () => {
    if (!selectedFarm) return;
    alert(`PDF-rapporteksport for ${selectedFarm.name} (implementeres)`);
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  if (loading) return <div className={styles.loading}>Laster anlegg...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>ANLEGGSEIER</h1>
          <p className={styles.subtitle}>Fiskeoppdrett - Oversikt og varsler</p>
        </div>
        
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Aktive anlegg</span>
            <span className={styles.statValue}>{farms.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Kritiske varsler</span>
            <span className={`${styles.statValue} ${criticalCount > 0 ? styles.critical : ''}`}>
              {criticalCount}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Ulesle</span>
            <span className={styles.statValue}>{unreadCount}</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>ANLEGG</h3>
          <div className={styles.farmList}>
            {farms.map(farm => (
              <button
                key={farm.id}
                onClick={() => setSelectedFarm(farm)}
                className={`${styles.farmItem} ${selectedFarm?.id === farm.id ? styles.active : ''}`}
              >
                <div className={styles.farmName}>{farm.name}</div>
                <div className={styles.farmRegion}>{farm.region}</div>
                <div className={`${styles.farmRisk} ${styles[`risk${farm.riskLevel}`.toLowerCase()]}`}>
                  {farm.riskScore}%
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.main}>
          {selectedFarm && (
            <>
              <div className={styles.farmDetail}>
                <div className={styles.detailHeader}>
                  <h2>{selectedFarm.name}</h2>
                  <button onClick={handleDownloadPDF} className={styles.pdfBtn}>
                    Eksporter PDF
                  </button>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Geografisk område hvor anlegget er lokalisert">
                        Region
                      </Tooltip>
                    </span>
                    <span className={styles.value}>{selectedFarm.region}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Type og art som oppdresses i anlegget">
                        Art
                      </Tooltip>
                    </span>
                    <span className={styles.value}>{selectedFarm.species.join(', ')}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Maksimal biomasse som anlegget kan holde">
                        Kapasitet
                      </Tooltip>
                    </span>
                    <span className={styles.value}>{selectedFarm.capacity} tonn</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Risikonivå basert på historiske hendelser">
                        Risiko
                      </Tooltip>
                    </span>
                    <span className={`${styles.value} ${styles[`risk${selectedFarm.riskLevel}`.toLowerCase()]}`}>
                      {selectedFarm.riskScore}%
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Dato for siste mattilsyns inspeksjon">
                        Sist inspeksjon
                      </Tooltip>
                    </span>
                    <span className={styles.value}>
                      {new Date(selectedFarm.lastInspection).toLocaleDateString('no-NO')}
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.label}>
                      <Tooltip text="Antall etterlevelsepunkter som er dokumentert">
                        Etterlevelse
                      </Tooltip>
                    </span>
                    <span className={styles.value}>{selectedFarm.complianceLogs.length}</span>
                  </div>
                </div>
              </div>

              <div className={styles.alertsSection}>
                <div className={styles.alertsHeader}>
                  <h3>VARSLER</h3>
                  <div className={styles.sortControl}>
                    <label>Sorter etter:</label>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className={styles.sortSelect}
                    >
                      <option value="severity">Alvorlighetsgrad</option>
                      <option value="date">Nyeste først</option>
                    </select>
                  </div>
                </div>

                {sortedAlerts.length === 0 ? (
                  <div className={styles.noAlerts}>
                    <p>Ingen varsler for dette anlegget</p>
                  </div>
                ) : (
                  <div className={styles.alertsTable}>
                    <div className={styles.tableHeader}>
                      <div className={styles.colType}>Type</div>
                      <div className={styles.colSeverity}>Alvorlighetsgrad</div>
                      <div className={styles.colSource}>Kilde</div>
                      <div className={styles.colDate}>Dato</div>
                      <div className={styles.colAction}>Handling</div>
                    </div>
                    {sortedAlerts.map(alert => (
                      <div 
                        key={alert.id} 
                        className={`${styles.tableRow} ${alert.isRead ? styles.read : styles.unread}`}
                      >
                        <div className={styles.colType}>{alert.type}</div>
                        <div className={styles.colSeverity}>
                          <span className={`${styles.severity} ${styles[`sev${alert.severity}`.toLowerCase()]}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <div className={styles.colSource}>{alert.source}</div>
                        <div className={styles.colDate}>
                          {new Date(alert.timestamp).toLocaleDateString('no-NO')}
                        </div>
                        <div className={styles.colAction}>
                          {!alert.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(alert.id)}
                              className={styles.readBtn}
                            >
                              Markert som lest
                            </button>
                          )}
                          {alert.isRead && <span className={styles.readLabel}>Lest</span>}
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
