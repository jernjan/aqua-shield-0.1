import React, { useEffect, useState } from 'react'

const NearbyFarmsRisk = ({ farmId }) => {
  const [nearbyData, setNearbyData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!farmId) return

    const fetchNearby = async () => {
      try {
        const res = await fetch(`/api/mvp/farm/${farmId}/nearby`)
        if (!res.ok) throw new Error('Failed to fetch nearby farms')
        const data = await res.json()
        setNearbyData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchNearby()
  }, [farmId])

  if (loading) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4 }}>Laster nærliggende anlegg...</div>
  if (error) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4, color: 'var(--accent-red)' }}>Feil: {error}</div>
  if (!nearbyData || nearbyData.nearby.length === 0) {
    return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4, color: 'var(--text-secondary)' }}>Ingen nærliggende anlegg innen 30 km</div>
  }

  const { nearby, currentConditions } = nearbyData

  const getRiskLabel = (category) => {
    const labels = {
      downstream: '🔴 Nedstrøms (mottaker av smitte)',
      'same-area': '🟠 Samme område',
      upstream: '🟢 Oppstrøms (sikker)',
    }
    return labels[category] || category
  }

  const riskBg = {
    red: { background: 'rgba(231, 76, 60, 0.1)', borderColor: 'var(--accent-red)' },
    orange: { background: 'rgba(255, 107, 53, 0.1)', borderColor: 'var(--accent-orange)' },
    green: { background: 'rgba(39, 174, 96, 0.1)', borderColor: 'var(--accent-green)' },
  }

  const riskColor = {
    red: 'var(--accent-red)',
    orange: 'var(--accent-orange)',
    green: 'var(--accent-green)',
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent-gold)' }}>NÆRLIGGENDE ANLEGG</h3>

      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Strømretning: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentConditions.direction}</span> — Sortert etter smitterisiko
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
        {nearby.map((farm, idx) => (
          <div
            key={idx}
            style={{
              padding: 10,
              borderRadius: 3,
              border: `1px solid ${riskBg[farm.riskColor].borderColor}`,
              ...riskBg[farm.riskColor]
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-primary)' }}>{farm.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{getRiskLabel(farm.riskCategory)}</p>
              </div>
              <span style={{ 
                padding: '4px 8px', 
                fontSize: 10, 
                borderRadius: 3, 
                fontWeight: 600,
                background: 'var(--bg-elevated)',
                color: riskColor[farm.riskColor]
              }}>
                {(farm.distance || 0).toFixed(1)} km
              </span>
            </div>

            {/* Risk details */}
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ marginBottom: 4 }}>
                Art: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{farm.species}</span>
              </p>
              <p>
                Risikonivå: <span style={{ fontWeight: 700, color: farm.riskLevel === 'risikofylt' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{farm.riskLevel}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 3, border: '1px solid var(--border-color)' }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>OPPSUMMERING</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-red)', marginBottom: 4 }}>
              {nearby.filter((n) => n.riskCategory === 'downstream').length}
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>nedstrøms</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-orange)', marginBottom: 4 }}>
              {nearby.filter((n) => n.riskCategory === 'same-area').length}
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>samme område</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-green)', marginBottom: 4 }}>
              {nearby.filter((n) => n.riskCategory === 'upstream').length}
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>oppstrøms</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NearbyFarmsRisk
