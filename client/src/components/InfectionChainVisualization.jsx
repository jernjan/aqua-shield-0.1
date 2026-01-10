import React, { useEffect, useState } from 'react'

const InfectionChainVisualization = () => {
  const [chainData, setChainData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedPath, setExpandedPath] = useState(null)

  useEffect(() => {
    const fetchChain = async () => {
      try {
        const res = await fetch('/api/mvp/admin/infection-chain')
        if (!res.ok) throw new Error('Failed to fetch infection chain')
        const data = await res.json()
        setChainData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchChain()
  }, [])

  if (loading) return <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>⏳ Laster smitte-kjede...</div>
  if (error) return <div style={{ padding: '16px', color: 'var(--accent-red)' }}>❌ Feil: {error}</div>
  if (!chainData) return null

  const { summary, infectionPaths, criticalFarms } = chainData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{
          padding: '16px',
          background: 'rgba(231, 76, 60, 0.1)',
          border: '2px solid var(--accent-red)',
          borderRadius: '4px'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            ANLEGG I RISIKOKJEDE
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '8px' }}>
            {summary.totalFarmsInRiskChain}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Anlegg med kritisk eller nedstrøms risiko
          </p>
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(255, 107, 53, 0.1)',
          border: '2px solid var(--accent-orange)',
          borderRadius: '4px'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            SMITTE-KJEDER AKTIVE
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-orange)', marginBottom: '8px' }}>
            {summary.potentialInfectionPaths}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Mulige smitte-ruter via havstrøm
          </p>
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(212, 165, 116, 0.1)',
          border: '2px solid var(--accent-gold)',
          borderRadius: '4px'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            NEDSTRØMS-EKSPONERING
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '8px' }}>
            {summary.downstreamExposure}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Anlegg i fare hvis kilder infiseres
          </p>
        </div>
      </div>

      {/* Critical Farms List */}
      {criticalFarms.length > 0 && (
        <div style={{
          padding: '16px',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          background: 'var(--bg-elevated)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--accent-red)' }}>
            🔴 KRITISKE ANLEGG I KJEDEN
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {criticalFarms.slice(0, 6).map((farm) => (
              <div key={farm.farmId} style={{
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                background: 'var(--bg-surface)',
                borderLeft: '4px solid var(--accent-red)'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {farm.farmName}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {farm.region}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Risikoscore: <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{farm.riskScore}%</span>
                  </p>
                  <span style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-red)',
                    color: 'white',
                    borderRadius: '2px'
                  }}>
                    {farm.riskLevel}
                  </span>
                </div>
                {farm.downstreamFarms.length > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: 600 }}>
                    ⚠️ Kan smitte {farm.downstreamFarms.length} anlegg nedstrøms
                  </p>
                )}
              </div>
            ))}
          </div>

          {criticalFarms.length > 6 && (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px', textAlign: 'center' }}>
              + {criticalFarms.length - 6} flere kritiske anlegg
            </p>
          )}
        </div>
      )}

      {/* Infection Paths */}
      {infectionPaths.length > 0 && (
        <div style={{
          padding: '16px',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          background: 'var(--bg-elevated)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--accent-orange)' }}>
            🔗 SMITTE-KJEDER (HAVSTRØM-BASERT)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {infectionPaths.map((path, idx) => (
              <div key={idx} style={{
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                overflow: 'hidden',
                background: 'var(--bg-surface)'
              }}>
                <button
                  onClick={() => setExpandedPath(expandedPath === idx ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: expandedPath === idx ? '1px solid var(--border-color)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {path.sourceName}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Kan smitte <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>
                        {path.potentialInfectionCount}
                      </span> anlegg nedstrøms
                    </p>
                  </div>
                  <span style={{ fontSize: '16px', color: 'var(--accent-orange)', marginLeft: '12px' }}>
                    {expandedPath === idx ? '▼' : '▶'}
                  </span>
                </button>

                {expandedPath === idx && (
                  <div style={{
                    padding: '12px',
                    background: 'var(--bg-dark)',
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      NEDSTRØMS MÅL (I FARE):
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {path.downstreamTargets.map((target, tidx) => (
                        <div key={tidx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px',
                          background: 'var(--bg-surface)',
                          borderRadius: '2px',
                          borderLeft: '3px solid var(--accent-red)'
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {target.name}
                            </p>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {(target.distance || 0).toFixed(1)} km away
                            </p>
                          </div>
                          <span style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: 'var(--accent-orange)',
                            color: 'white',
                            borderRadius: '2px'
                          }}>
                            {target.riskLevel}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      padding: '8px',
                      background: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid var(--accent-red)',
                      borderRadius: '2px'
                    }}>
                      <p style={{ fontSize: '11px', color: 'var(--accent-red)' }}>
                        <strong>⚠️ ANBEFALT HANDLING:</strong> Hvis {path.sourceName} blir infisert, 
                        implementer karantene for alle {path.potentialInfectionCount} nedstrøms anlegg umiddelbart.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {infectionPaths.length === 0 && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          background: 'rgba(39, 174, 96, 0.1)',
          border: '2px solid var(--accent-green)',
          borderRadius: '4px'
        }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-green)' }}>
            ✓ Ingen aktive smitte-kjeder
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Alle anlegg har lav risiko eller har ingen anlegg nedstrøms
          </p>
        </div>
      )}
    </div>
  )
}

export default InfectionChainVisualization
