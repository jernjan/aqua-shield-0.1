import React, { useState, useEffect } from 'react'
import './VesselDashboard.css'

export default function VesselDashboard() {
  const [vessel, setVessel] = useState(null)
  const [contamination, setContamination] = useState(null)
  const [nearbyFacilities, setNearbyFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [vessels, setVessels] = useState([])

  // Load list of vessels
  useEffect(() => {
    loadVessels()
  }, [])

  async function loadVessels() {
    try {
      setError(null)
      // Get all vessels from MVP API
      const res = await fetch(`/api/mvp/vessel`, { timeout: 10000 })
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      const data = await res.json()
      setVessels(data.vessels || [])
      // Select first vessel by default
      if (data.vessels && data.vessels.length > 0) {
        selectVessel(data.vessels[0].id)
      } else {
        setLoading(false)
        setError('Ingen båter funnet')
      }
    } catch (err) {
      console.error('[VesselDashboard] Error loading vessels:', err)
      setError(`Kunne ikke laste båtdata: ${err.message}`)
      setLoading(false)
    }
  }

  async function selectVessel(vesselId) {
    try {
      setError(null)
      setLoading(true)
      setSelectedVessel(vesselId)
      
      // Find the vessel in our list
      const selectedVesselData = vessels.find(v => v.id === vesselId);
      
      if (selectedVesselData) {
        setVessel(selectedVesselData)
        // For now, no nearby facilities calculation
        setNearbyFacilities([])
        
        // Fetch contamination status for this vessel
        try {
          const contRes = await fetch(`/api/vessel/contamination?mmsi=${selectedVesselData.mmsi}`)
          if (contRes.ok) {
            const contData = await contRes.json()
            setContamination(contData)
          }
        } catch (err) {
          console.log('[VesselDashboard] No contamination data available')
          setContamination(null)
        }
      } else {
        setError('Skip ikke funnet')
      }
    } catch (err) {
      console.error('[VesselDashboard] Error selecting vessel:', err)
      setError(`Feil: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getMeasureColor = (grad) => {
    if (grad === 3) return '#DC2626'; // Red
    if (grad === 2) return '#F59E0B'; // Orange
    if (grad === 1) return '#3B82F6'; // Blue
    return '#10B981'; // Green
  };

  const getMeasureEmoji = (grad) => {
    if (grad === 3) return '🚨';
    if (grad === 2) return '⚠️';
    if (grad === 1) return 'ℹ️';
    return '✅';
  };

  if (loading && vessels.length === 0) {
    return (
      <div className="vessel-dashboard loading">
        {error ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#DC2626', fontWeight: 700, marginBottom: '8px' }}>❌ Feil ved lasting</p>
            <p style={{ color: '#888', fontSize: '14px' }}>{error}</p>
            <p style={{ color: '#666', fontSize: '12px', marginTop: '12px' }}>Sjekk at API-serveren kjører</p>
          </div>
        ) : (
          'Laster båtdata...'
        )}
      </div>
    )
  }

  if (error && vessels.length === 0) {
    return (
      <div className="vessel-dashboard loading">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#DC2626', fontWeight: 700, marginBottom: '8px' }}>❌ {error}</p>
          <button onClick={() => window.location.reload()} style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'var(--accent-gold)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600
          }}>
            Prøv på nytt
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="vessel-dashboard">
      <h1>⛵ Båt-Oversikt & Nærbyvarslinger</h1>
      <p className="subtitle">Se hvilke anlegg som er i nærheten og anbefalte tiltak</p>

      {/* NEW: Measures Quick Reference */}
      <div style={{
        background: '#FFF8F0',
        border: '2px solid #F59E0B',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
          📋 Tiltaksnivåer - Hva Du Skal Gjøre
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ background: 'white', padding: 12, borderRadius: 6, borderLeft: '4px solid #3B82F6' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>ℹ️ Grad 1: Info</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              Anlegget er i varslingssone. Moniter situasjonen fortsatt jobbing normalt.
            </div>
          </div>
          <div style={{ background: 'white', padding: 12, borderRadius: 6, borderLeft: '4px solid #F59E0B' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>⚠️ Grad 2: Karantene</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              Båten må i 48h karantene før neste arbeid. Vask dekk grundig før du forlater området.
            </div>
          </div>
          <div style={{ background: 'white', padding: 12, borderRadius: 6, borderLeft: '4px solid #DC2626' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>🚨 Grad 3: Desinfeksjon</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              IKKE arbeid her. Båten må fulldesinfiseres før neste anlegg. Kontakt rederiet nå.
            </div>
          </div>
        </div>
      </div>

      {/* Vessel Selector */}
      {vessels.length > 1 && (
        <div className="vessel-selector">
          <label>Velg båt:</label>
          <select 
            value={selectedVessel || ''} 
            onChange={(e) => selectVessel(e.target.value)}
          >
            {vessels.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.mmsi})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Vessel Info */}
      {vessel && (
        <>
          {/* CONTAMINATION STATUS - CRITICAL ALERT */}
          {contamination && contamination.isContaminated && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.15)',
              border: '2px solid #DC2626',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20
            }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
                🚨 BÅTEN ER KONTAMINERT
              </h2>
              <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                Du besøkte et smittet anlegg. Båten kan være vektor for smitte i {contamination.hoursRemaining} timer.
              </p>
              {contamination.records && contamination.records.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--accent-gold)' }}>
                    Var på smittet anlegg:
                  </p>
                  {contamination.records.map((source, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#DC2626' }}>
                        📍 {source.facility_name} ({source.facility_risk_score}% risiko)
                      </p>
                      <p style={{ margin: '2px 0 0 0' }}>
                        📅 {new Date(source.timestamp).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 8 }}>
                  ✓ PÅKREVD TILTAK:
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <li>IKKE arbeid på nye anlegg nå</li>
                  <li>Gjør full desinfeksjon av båten</li>
                  <li>Vask alt utstyr og drenering</li>
                  <li>Vent {contamination.hoursRemaining} timer før neste arbeid</li>
                </ul>
              </div>
            </div>
          )}

          {/* Normal Vessel Info */}
          <div className="vessel-info">
            <div className="info-card">
              <div className="info-label">Båtnavn</div>
              <div className="info-value">{vessel.name}</div>
            </div>
            <div className="info-card">
              <div className="info-label">MMSI</div>
              <div className="info-value">{vessel.mmsi}</div>
            </div>
            <div className="info-card">
              <div className="info-label">Status</div>
              <div className="info-value">{contamination?.isContaminated ? '🚨 KONTAMINERT' : '✅ Ren'}</div>
            </div>
            <div className="info-card">
              <div className="info-label">Posisjon</div>
              <div className="info-value">{vessel.latitude?.toFixed(3)}, {vessel.longitude?.toFixed(3)}</div>
            </div>
          </div>
        </>
      )}

      {/* Nearby Facilities */}
      <div className="nearby-section">
        <h2>📍 Anlegg i nærheten (innenfor 3km)</h2>
        
        {nearbyFacilities.length === 0 ? (
          <div className="empty-state">
            <p>Ingen anlegg innenfor 3km</p>
            <p style={{ fontSize: 12, color: '#999' }}>Du er på sikker avstand fra alle risikosoner</p>
          </div>
        ) : (
          <div className="facilities-list">
            {nearbyFacilities.map((facility, idx) => (
              <div key={idx} className="facility-card">
                <div className="facility-header">
                  <div className="facility-name-section">
                    <h3>{facility.name}</h3>
                    <p className="municipality">{facility.municipality}</p>
                  </div>
                  <div className="distance-badge">
                    <div className="distance-value">{facility.distanceKm} km</div>
                    <div className="distance-label">avstand</div>
                  </div>
                </div>

                {/* Risk Info */}
                <div className="facility-details">
                  <div className="detail-item">
                    <span className="detail-label">Risiko:</span>
                    <span className="detail-value" style={{ 
                      color: facility.riskScore >= 70 ? '#DC2626' : facility.riskScore >= 50 ? '#F59E0B' : '#10B981'
                    }}>
                      {facility.riskScore}%
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Lus:</span>
                    <span className="detail-value">{facility.liceCount}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Sykdom:</span>
                    <span className="detail-value">{facility.diseaseStatus}</span>
                  </div>
                </div>

                {/* Measure/Recommendation */}
                <div 
                  className="measure-box"
                  style={{ borderLeft: `4px solid ${getMeasureColor(facility.measure.grad)}` }}
                >
                  <div className="measure-header">
                    <span className="measure-emoji">{getMeasureEmoji(facility.measure.grad)}</span>
                    <div className="measure-title">
                      <div className="measure-grad">Grad {facility.measure.grad}</div>
                      <div className="measure-label">{facility.measure.label}</div>
                    </div>
                  </div>
                  <p className="measure-description">{facility.measure.description}</p>
                  
                  {/* NEW: Concrete instructions */}
                  <div style={{
                    marginTop: 12,
                    padding: 10,
                    background: facility.measure.grad === 3 ? 'rgba(220,38,38,0.1)' : facility.measure.grad === 2 ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#333',
                    lineHeight: 1.5
                  }}>
                    {facility.measure.grad === 3 && (
                      <>
                        <strong style={{ color: '#DC2626' }}>❌ DU KAN IKKE GÅ HER NÅ</strong>
                        <div style={{ marginTop: 6 }}>
                          Båten må minst {facility.distanceKm}km unna. Desinfeksjonsprotokoll aktivert.
                        </div>
                      </>
                    )}
                    {facility.measure.grad === 2 && (
                      <>
                        <strong style={{ color: '#F59E0B' }}>⚠️ 48 TIMER KARANTENE</strong>
                        <div style={{ marginTop: 6 }}>
                          Du kan fortsette jobbing, men må vente 48h eller være mer enn 1km fra {facility.name} før neste arbeid.
                        </div>
                      </>
                    )}
                    {facility.measure.grad === 1 && (
                      <>
                        <strong style={{ color: '#3B82F6' }}>ℹ️ MONITER SITUASJONEN</strong>
                        <div style={{ marginTop: 6 }}>
                          Du kan jobbe normalt, men følg med på endringer hos {facility.name}.
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="info-box">
        <h4>📋 Tiltaksgrader Forklart:</h4>
        <div className="grade-explanation">
          <div className="grade">
            <div className="grade-label" style={{ background: '#10B981' }}>Grad 1</div>
            <div className="grade-content">
              <strong>Info</strong>
              <p>Anlegget er innenfor varslingsavstand. Moniter situasjonen.</p>
            </div>
          </div>
          <div className="grade">
            <div className="grade-label" style={{ background: '#F59E0B' }}>Grad 2</div>
            <div className="grade-content">
              <strong>Karantene</strong>
              <p>Båten må holdes i karantene i 48 timer før annet arbeid. Vask dekk før arbeid på andre anlegg.</p>
            </div>
          </div>
          <div className="grade">
            <div className="grade-label" style={{ background: '#DC2626' }}>Grad 3</div>
            <div className="grade-content">
              <strong>Desinfeksjon + Karantene</strong>
              <p>Båten må fulldesinfiseres før annet arbeid. Minst 48 timer karantene. Kontakt båteier for prosedyre.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend-box">
        <h4>🔍 Om Varslinger:</h4>
        <ul>
          <li>Varslinger baseres på båtens AIS-posisjon (oppdateres kontinuerlig)</li>
          <li>Anlegg innenfor <strong>3km</strong> vises her</li>
          <li>Tiltaksnivå baseres på <strong>avstand</strong> og <strong>risiko</strong></li>
          <li>Sykdommer hentes fra <strong>BarentsWatch</strong> (offisiell data)</li>
          <li>Lusetall og risiko oppdateres daglig</li>
        </ul>
      </div>
    </div>
  )
}
