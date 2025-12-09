import { useState, useEffect } from 'react'
import axios from 'axios'

function Dashboard({ token, user, onLogout, onToast }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
  }, [token])

  const loadAlerts = async () => {
    try {
      const response = await axios.get('/api/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setAlerts(response.data)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (alertId) => {
    try {
      await axios.post(`/api/alerts/${alertId}/read`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a))
      onToast('Varsel markert som lest')
    } catch (err) {
      onToast('Feil ved oppdatering', 'error')
    }
  }

  const handleSendTestAlert = async () => {
    try {
      await axios.post('/api/alerts/test', 
        { facilityName: 'Test Anlegg', type: 'facility' },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      onToast('🧪 Test-varsel sendt (se konsoll)')
      // Reload alerts
      setTimeout(loadAlerts, 500)
    } catch (err) {
      onToast('Feil ved sending av test-varsel', 'error')
    }
  }

  const handleDownloadFacilityPDF = () => {
    onToast('📄 Facility PDF vil bli lastet ned (implementeres snart)')
  }

  const handleDownloadVesselPDF = () => {
    onToast('📄 Vessel PDF vil bli lastet ned (implementeres snart)')
  }

  const getAlertColor = (riskLevel) => {
    switch (riskLevel) {
      case 'kritisk': return '#dc2626'
      case 'varsel': return '#f59e0b'
      default: return '#10b981'
    }
  }

  const unreadCount = alerts.filter(a => !a.isRead).length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0066cc', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>🐟 AquaShield</h1>
            <p style={{ margin: '0 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Hei, {user?.name || 'bruker'}
            </p>
          </div>
          <button onClick={onLogout} className="secondary" style={{ backgroundColor: '#fff', color: '#0066cc' }}>
            Logg ut
          </button>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '30px' }}>
          <button onClick={handleSendTestAlert} className="primary">
            🧪 Send test-varsel
          </button>
          <button onClick={handleDownloadFacilityPDF} className="primary">
            📄 Last ned anlegg-PDF
          </button>
          <button onClick={handleDownloadVesselPDF} className="primary">
            📄 Last ned båt-PDF
          </button>
        </div>

        {/* Alerts */}
        <div className="card">
          <h2>📬 Varsler ({unreadCount} ulest)</h2>
          
          {loading && <p>Laster...</p>}
          
          {!loading && alerts.length === 0 && (
            <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
              ✓ Ingen varsler. Systemet overvåker dine anlegg og båter 24/7.
            </p>
          )}

          {!loading && alerts.length > 0 && (
            <div>
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  style={{
                    borderLeft: `4px solid ${getAlertColor(alert.riskLevel)}`,
                    padding: '16px',
                    marginBottom: '12px',
                    backgroundColor: alert.isRead ? '#fafafa' : '#fff',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>
                      {alert.title}
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                      {alert.message}
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
                      {new Date(alert.createdAt).toLocaleString('no-NO')}
                    </p>
                  </div>
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="secondary"
                      style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}
                    >
                      Lukk
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
