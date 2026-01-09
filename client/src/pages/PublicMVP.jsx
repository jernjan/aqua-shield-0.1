import { useEffect, useState } from 'react'

export default function PublicMVP({ token }) {
  const [publicData, setPublicData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/mvp/public')
      .then(r => r.json())
      .then(data => {
        setPublicData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch public data', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Laster...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h1>🌍 Offentlig Informasjon</h1>
      <p style={{ color: '#666' }}>Anonyme regionale data og varsler (tilgjengelig for alle uten innlogging)</p>

      {publicData && (
        <>
          <h2>Regioner</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {publicData.regions.map(region => (
              <div
                key={region.name}
                style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>{region.name}</h3>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Anlegg i området</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0066cc' }}>{region.facilityCount}</div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Nylige varsler</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6600' }}>{region.recentAlerts}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Risiko-nivå</div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color:
                        region.averageRisk === 'Høy' ? '#cc0000' :
                        region.averageRisk === 'Moderat' ? '#ff9900' : '#006600',
                    }}
                  >
                    {region.averageRisk}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2>Siste varsler</h2>
          {publicData.topAlerts.length === 0 ? (
            <div style={{ color: '#666' }}>Ingen varsler.</div>
          ) : (
            <div>
              {publicData.topAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#fffbf0',
                    borderLeft:
                      alert.severity === 'kritisk' ? '4px solid #cc0000' :
                      alert.severity === 'høy' ? '4px solid #ff6600' : '4px solid #ffcc00',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {alert.region} — {alert.type}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Severity:{' '}
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor:
                          alert.severity === 'kritisk' ? '#ffcccc' :
                          alert.severity === 'høy' ? '#ffe6cc' : '#e6ffe6',
                        color:
                          alert.severity === 'kritisk' ? '#cc0000' :
                          alert.severity === 'høy' ? '#ff6600' : '#006600',
                        fontSize: '11px',
                      }}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    {new Date(alert.timestamp).toLocaleDateString('nb-NO')}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: '30px',
              padding: '15px',
              backgroundColor: '#f0f7ff',
              borderRadius: '4px',
              border: '1px solid #0066cc',
            }}
          >
            <h3 style={{ marginTop: 0 }}>ℹ️ Om denne siden</h3>
            <p style={{ color: '#666', marginBottom: 0 }}>
              Denne siden viser aggregert, anonymisert data fra akvakulturanlegg i Norge.
              Data oppdateres daglig. For detaljert informasjon, kontakt Mattilsynet eller logg inn som anleggseier.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
