import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Dashboard.css'

function Dashboard() {
  const [facilities, setFacilities] = useState([])
  const [alerts, setAlerts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const user = localStorage.getItem('currentUser')
    if (!user) {
      navigate('/')
      return
    }

    setCurrentUser(JSON.parse(user))
    fetchFacilities()
  }, [navigate])

  const fetchFacilities = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('http://localhost:8000/api/facilities', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data && data.length > 0) {
        setFacilities(data)
        
        // Generate alerts from facilities with risk
        const newAlerts = data
          .filter(f => f.risk_score >= 40)
          .map((facility, idx) => ({
            id: idx,
            title: facility.risk_level === 'red' ? '⚠️ HØY RISIKO' : '⚠️ MODERAT RISIKO',
            message: `${facility.name}: ${facility.risk_factors.join(' • ')}`,
            level: facility.risk_level,
            facility_id: facility.id,
            created_at: new Date().toISOString(),
            is_read: false,
            risk_factors: facility.risk_factors,
            prediction_type: facility.prediction_type
          }))
        
        setAlerts(newAlerts)
      } else {
        setFacilities([])
        setAlerts([])
      }
    } catch (err) {
      console.error('Error fetching facilities:', err)
      setError(`Kunne ikke hente data fra BarentsWatch API: ${err.message}`)
      setFacilities([])
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    navigate('/')
  }

  const handleMarkAsRead = (alertId) => {
    setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a))
  }

  const handleRefresh = () => {
    fetchFacilities()
  }

  if (!currentUser) {
    return <div className="dashboard-loading">Laster...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🌊 AquaShield - Prediktiv Risiko Varsling</h1>
        <div className="header-right">
          <span className="current-user">{currentUser.name}</span>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Oppdater
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logg ut
          </button>
        </div>
      </header>

      <div className="dashboard-info">
        <p>ℹ️ Modellen varsler anlegg som står i FARE for å bli smittet fra andre anlegg og båter - ikke anlegg som allerede har kjente problemer</p>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Feil:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="dashboard-loading">Henter data fra BarentsWatch API...</div>
      )}

      {!loading && (
        <div className="dashboard-container">
          <div className="dashboard-grid">
            <section className="dashboard-section">
              <h2>📍 Anlegg Under Overvåking ({facilities.length})</h2>
              <div className="facilities-list">
                {facilities.length === 0 ? (
                  <p className="empty-state">Ingen anlegg tilgjengelig fra BarentsWatch API</p>
                ) : (
                  facilities.map((facility) => (
                    <div key={facility.id} className={`facility-card facility-risk-${facility.risk_level}`}>
                      <div className="facility-header">
                        <h3>{facility.name}</h3>
                        <span className={'badge badge-' + facility.risk_level}>
                          {getRiskLevelLabel(facility.risk_level)} ({facility.risk_score}pts)
                        </span>
                      </div>
                      
                      <div className="facility-meta">
                        <span>📊 Lus: {facility.lice_count}</span>
                        <span>🌡️ Temp: {facility.temperature}°C</span>
                        <span>🧬 Sykdommer: {facility.diseases?.length || 0}</span>
                      </div>

                      {facility.risk_factors && facility.risk_factors.length > 0 && (
                        <div className="facility-risk-factors">
                          <strong>Risikofaktorer:</strong>
                          <ul>
                            {facility.risk_factors.map((factor, idx) => (
                              <li key={idx}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <small className="facility-source">
                        🔄 Kilde: {facility.data_source || 'BarentsWatch API'}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <h2>🚨 Aktive Risiko Varsler ({alerts.length})</h2>
              <div className="alerts-list">
                {alerts.length === 0 ? (
                  <p className="empty-state">Ingen aktive varsler - alle anlegg er sikre</p>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className={'alert-item alert-item-' + alert.level + (alert.is_read ? ' is-read' : '')}>
                      <div className="alert-header">
                        <h4>{alert.title}</h4>
                        <span className={'badge badge-' + alert.level}>{alert.level}</span>
                      </div>
                      
                      <p className="alert-message">{alert.message}</p>
                      
                      {alert.risk_factors && alert.risk_factors.length > 0 && (
                        <div className="alert-details">
                          <strong>Varselstyper:</strong>
                          <ul>
                            {alert.risk_factors.map((factor, idx) => (
                              <li key={idx}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="alert-footer">
                        <small>
                          {alert.prediction_type === 'external_infection_risk' && '🔮 Prediktivt varsel'}
                          {' | '}
                          {new Date(alert.created_at).toLocaleString('no-NO')}
                        </small>
                        {!alert.is_read && (
                          <button className="btn btn-sm" onClick={() => handleMarkAsRead(alert.id)}>
                            Merk som lest
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function getRiskLevelLabel(level) {
  const labels = {
    'red': '🔴 HØY RISIKO',
    'yellow': '🟡 MODERAT RISIKO',
    'green': '🟢 LAV RISIKO',
    'monitored': '⚪ UNDER OVERVÅKING'
  }
  return labels[level] || level
}

export default Dashboard
