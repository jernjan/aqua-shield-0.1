import { useEffect, useState } from 'react'

export default function FarmerDashboard({ token }) {
  const [farms, setFarms] = useState([])
  const [selectedFarm, setSelectedFarm] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch all farms
    fetch('/api/mvp/farmer')
      .then(r => r.json())
      .then(data => {
        setFarms(data.farms)
        if (data.farms.length > 0) {
          setSelectedFarm(data.farms[0])
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch farms', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedFarm) return
    
    // Fetch alerts for selected farm
    fetch(`/api/mvp/farmer/${selectedFarm.id}`)
      .then(r => r.json())
      .then(data => setAlerts(data.alerts))
      .catch(err => console.error('Failed to fetch farm alerts', err))
  }, [selectedFarm])

  const handleMarkAsRead = (alertId) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isRead: true } : a))
  }

  const handleDownloadPDF = () => {
    if (!selectedFarm) return
    alert(`PDF-rapporteksport for ${selectedFarm.name} (implementeres med jsPDF)`)
  }

  if (loading) return <div style={{ padding: '20px' }}>Laster...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h1>🐟 Anleggseier-Dashboard</h1>
      <p style={{ color: '#666' }}>Oversikt over dine akvakulturanlegg og risikoindikatorer</p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Farm List */}
        <div style={{ borderRight: '1px solid #ddd', paddingRight: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>Dine anlegg ({farms.length})</h2>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {farms.map(farm => (
              <div
                key={farm.id}
                onClick={() => setSelectedFarm(farm)}
                style={{
                  padding: '10px',
                  marginBottom: '8px',
                  border: selectedFarm?.id === farm.id ? '2px solid #0066cc' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: selectedFarm?.id === farm.id ? '#f0f7ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{farm.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{farm.region}</div>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    marginTop: '4px',
                    backgroundColor:
                      farm.riskLevel === 'kritisk' ? '#ffcccc' :
                      farm.riskLevel === 'høy' ? '#ffe6cc' : '#ccffcc',
                    color: farm.riskLevel === 'kritisk' ? '#cc0000' : farm.riskLevel === 'høy' ? '#ff6600' : '#006600',
                  }}
                >
                  {farm.riskLevel.charAt(0).toUpperCase() + farm.riskLevel.slice(1)} risiko
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Farm Details & Alerts */}
        <div>
          {selectedFarm && (
            <>
              <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                <h2 style={{ marginTop: 0 }}>{selectedFarm.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Region</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedFarm.region}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Art</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedFarm.species}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Kapasitet</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedFarm.capacity.toLocaleString()} tonn</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Risikoscore</div>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color:
                          selectedFarm.riskScore > 60 ? '#cc0000' :
                          selectedFarm.riskScore > 40 ? '#ff6600' : '#006600',
                      }}
                    >
                      {selectedFarm.riskScore}%
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={handleDownloadPDF}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0066cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  📄 Last ned risiko-rapport (PDF)
                </button>
              </div>

              <h3>Varsler ({alerts.length})</h3>
              {alerts.length === 0 ? (
                <div style={{ color: '#666' }}>Ingen varsler for dette anlegget.</div>
              ) : (
                <div>
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      style={{
                        padding: '12px',
                        marginBottom: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: alert.isRead ? '#fafafa' : '#fffbf0',
                        borderLeft:
                          alert.severity === 'kritisk' ? '4px solid #cc0000' :
                          alert.severity === 'høy' ? '4px solid #ff6600' : '4px solid #ffcc00',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{alert.message}</div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            Type: {alert.type} | Kilde: {alert.dataSource}
                          </div>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                            {new Date(alert.timestamp).toLocaleDateString('nb-NO')}
                          </div>
                        </div>
                        {!alert.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(alert.id)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              backgroundColor: '#0066cc',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              marginLeft: '10px',
                            }}
                          >
                            ✓ Markér lest
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
