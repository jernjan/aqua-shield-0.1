import { useEffect, useState } from 'react'

export default function VesselMVP({ token }) {
  const [vessels, setVessels] = useState([])
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/mvp/vessel')
      .then(r => r.json())
      .then(data => {
        setVessels(data.vessels)
        if (data.vessels.length > 0) {
          setSelectedVessel(data.vessels[0])
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch vessels', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Laster...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h1>⛵ Brønnbåt-Dashboard</h1>
      <p style={{ color: '#666' }}>Posisjoner, last, og compliance-logging for alle båter</p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Vessel List */}
        <div style={{ borderRight: '1px solid #ddd', paddingRight: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>Båter ({vessels.length})</h2>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {vessels.map(vessel => (
              <div
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel)}
                style={{
                  padding: '10px',
                  marginBottom: '8px',
                  border: selectedVessel?.id === vessel.id ? '2px solid #0066cc' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: selectedVessel?.id === vessel.id ? '#f0f7ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{vessel.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>MMSI: {vessel.mmsi}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{vessel.type}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Vessel Details */}
        <div>
          {selectedVessel && (
            <>
              <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                <h2 style={{ marginTop: 0 }}>{selectedVessel.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>MMSI</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedVessel.mmsi}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Type</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedVessel.type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Siste posisjon (Lat, Lng)</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      {selectedVessel.lastPosition.lat.toFixed(2)}, {selectedVessel.lastPosition.lng.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Cargo / Art</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{selectedVessel.cargo}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Compliance Status</div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: selectedVessel.documentationStatus === 'godkjent' ? '#006600' : '#ff6600',
                      }}
                    >
                      {selectedVessel.documentationStatus === 'godkjent' ? '✓ Godkjent' : '⏳ Under gjennomgang'}
                    </div>
                  </div>
                </div>
              </div>

              <h3>Compliance Actions</h3>
              <div>
                {selectedVessel.complianceActions.map((action, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      marginBottom: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: action.verified ? '#ccffcc' : '#ffffcc',
                      borderLeft: action.verified ? '4px solid #006600' : '4px solid #ff6600',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{action.action}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Lokasjon: {action.location} | {new Date(action.date).toLocaleDateString('nb-NO')}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {action.verified ? '✓ Verifisert' : '⚠️ Ej verifisert av Mattilsynet'}
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: '20px' }}>Risikosoner oppgitt</h3>
              {selectedVessel.riskZonesEntered.length === 0 ? (
                <div style={{ color: '#666' }}>Ingen risikosoner oppgitt.</div>
              ) : (
                <div>
                  {selectedVessel.riskZonesEntered.map((zone, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px',
                        marginBottom: '8px',
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{zone.zone}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Avstand: ~{zone.distance} km | {new Date(zone.timestamp).toLocaleDateString('nb-NO')}
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
