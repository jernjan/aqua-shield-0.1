import React, { useEffect, useState } from 'react'

const CurrentSeaConditions = ({ farmId }) => {
  const [conditions, setConditions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!farmId) return

    const fetchConditions = async () => {
      try {
        const res = await fetch(`/api/mvp/farm/${farmId}/current-conditions`)
        if (!res.ok) throw new Error('Failed to fetch current conditions')
        const data = await res.json()
        setConditions(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchConditions()
  }, [farmId])

  if (loading) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4 }}>Laster strøm-forhold...</div>
  if (error) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4, color: 'var(--accent-red)' }}>Feil: {error}</div>
  if (!conditions) return null

  const { current, algae } = conditions

  const currentArrows = {
    vestlig: '←',
    østlig: '→',
    nordlig: '↓',
    sørlig: '↑',
  }

  const arrow = currentArrows[current.direction] || '→'

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent-gold)' }}>NÅVÆRENDE FORHOLD</h3>

      {/* Havstrøm-seksjon */}
      <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 3, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Havstrøm</span>
          <span style={{ fontSize: 20, color: 'var(--accent-blue)' }}>{arrow}</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Retning: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{current.direction}</span>
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--accent-orange)' }}>{current.downstreamFarmsAtRisk}</strong> nedstrøms anlegg med smitterisiko
        </p>
      </div>

      {/* Alge-seksjon */}
      <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-elevated)', borderRadius: 3, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Alge-aktivitet</span>
          <span style={{
            padding: '4px 8px',
            fontSize: 10,
            borderRadius: 3,
            fontWeight: 600,
            background: algae.activeAlerts > 2 ? 'rgba(231, 76, 60, 0.2)' : algae.activeAlerts > 0 ? 'rgba(255, 107, 53, 0.2)' : 'rgba(39, 174, 96, 0.2)',
            color: algae.activeAlerts > 2 ? 'var(--accent-red)' : algae.activeAlerts > 0 ? 'var(--accent-orange)' : 'var(--accent-green)'
          }}>
            {algae.activeAlerts === 0 ? 'Lav' : algae.activeAlerts === 1 ? 'Moderat' : 'Høy'}
          </span>
        </div>

        {algae.activeAlerts > 0 ? (
          <div style={{ fontSize: 10 }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--accent-orange)' }}>{algae.activeAlerts}</strong> aktive alge-varsler
            </p>
            {algae.strains.length > 0 && (
              <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                Stammer: <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--text-primary)' }}>{algae.strains.join(', ')}</span>
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Ingen aktive alge-varsler</p>
        )}
      </div>

      {/* Smitte-risiko-status */}
      <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 3, border: '1px solid var(--border-color)', borderLeft: `3px solid var(--accent-blue)` }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>SMITTERISIKO-STATUS</p>
        <p style={{ fontSize: 11, color: current.downstreamFarmsAtRisk > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
          {current.downstreamFarmsAtRisk > 0 ? (
            <span>⚠️ {current.downstreamFarmsAtRisk} nedstrøms anlegg i fare om dette anlegget blir infisert</span>
          ) : (
            <span>✓ Ingen kritisk smitterisiko fra strømforhold</span>
          )}
        </p>
      </div>
    </div>
  )
}

export default CurrentSeaConditions
