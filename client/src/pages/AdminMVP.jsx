import { useEffect, useState } from 'react'

export default function AdminMVP({ token }) {
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/mvp/admin/stats').then(r => r.json()),
      fetch('/api/mvp/admin/alerts').then(r => r.json()),
    ])
      .then(([statsData, alertsData]) => {
        setStats(statsData)
        setAlerts(alertsData.alerts)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch admin data', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Laster...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h1>📊 Regulator/Admin-Dashboard</h1>
      <p style={{ color: '#666' }}>Overordnet statistikk, compliance monitoring, og alert management</p>

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            <div style={{ padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '4px', border: '1px solid #0066cc' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Totalt anlegg</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0066cc' }}>{stats.summary.totalFacilities}</div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ff6600' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Kritisk risiko</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff6600' }}>{stats.summary.criticalRiskFacilities}</div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#ffe6f0', borderRadius: '4px', border: '1px solid #cc0099' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Totalt varsler</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#cc0099' }}>{stats.summary.totalAlerts}</div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#e6f9ff', borderRadius: '4px', border: '1px solid #0099cc' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Gjennomsnittlig risiko</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0099cc' }}>{stats.summary.averageRiskScore}%</div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#e6ffe6', borderRadius: '4px', border: '1px solid #006600' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Anlegg med dokumentasjon</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#006600' }}>{stats.summary.totalFacilities - stats.complianceStatus.undocumented}</div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#f9e6ff', borderRadius: '4px', border: '1px solid #9900cc' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Båter</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9900cc' }}>{stats.summary.totalVessels}</div>
            </div>
          </div>

          <h2>By Region</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '30px' }}>
            {Object.entries(stats.byRegion).map(([region, count]) => (
              <div
                key={region}
                style={{
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{region}</div>
                <div style={{ fontSize: '18px', color: '#0066cc', fontWeight: 'bold' }}>{count} anlegg</div>
              </div>
            ))}
          </div>

          <h2>Recent Alerts (Last 7 days: {stats.alertsBy7Days})</h2>
          {alerts.length === 0 ? (
            <div style={{ color: '#666' }}>No alerts.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Farm</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Severity</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Region</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 20).map(alert => (
                    <tr key={alert.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{alert.farmName}</td>
                      <td style={{ padding: '10px' }}>{alert.type}</td>
                      <td style={{ padding: '10px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '3px',
                            backgroundColor:
                              alert.severity === 'kritisk' ? '#ffcccc' :
                              alert.severity === 'høy' ? '#ffe6cc' : '#e6ffe6',
                            color:
                              alert.severity === 'kritisk' ? '#cc0000' :
                              alert.severity === 'høy' ? '#ff6600' : '#006600',
                            fontSize: '12px',
                          }}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{alert.region}</td>
                      <td style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
                        {new Date(alert.timestamp).toLocaleDateString('nb-NO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
