import React, { useState, useEffect } from 'react'
import './VesselDashboard.css'

export default function VesselDashboard() {
  const [vessel, setVessel] = useState(null)
  const [nearbyFacilities, setNearbyFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [vessels, setVessels] = useState([])

  // Load list of vessels
  useEffect(() => {
    loadVessels()
  }, [])

  async function loadVessels() {
    try {
      const res = await fetch('/api/mvp/vessel')
      const data = await res.json()
      setVessels(data.vessels || [])
      // Select first vessel by default
      if (data.vessels && data.vessels.length > 0) {
        selectVessel(data.vessels[0].id)
      }
    } catch (err) {
      console.error('Error loading vessels:', err)
    }
  }

  async function selectVessel(vesselId) {
    try {
      setLoading(true)
      setSelectedVessel(vesselId)
      const res = await fetch(`/api/vessel/${vesselId}/nearby`)
      const data = await res.json()
      setVessel(data.vessel)
      setNearbyFacilities(data.nearbyFacilities || [])
    } catch (err) {
      console.error('Error loading vessel nearby facilities:', err)
      setNearbyFacilities([])
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
    return <div className="vessel-dashboard loading">Laster båtdata...</div>
  }

  return (
    <div className="vessel-dashboard">
      <h1>⛵ Båt-Oversikt & Nærbyvarslinger</h1>
      <p className="subtitle">Se hvilke anlegg som er i nærheten og anbefalte tiltak</p>

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
            <div className="info-value">{vessel.status}</div>
          </div>
          <div className="info-card">
            <div className="info-label">Posisjon</div>
            <div className="info-value">{vessel.latitude?.toFixed(3)}, {vessel.longitude?.toFixed(3)}</div>
          </div>
        </div>
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
