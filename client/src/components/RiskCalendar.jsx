import React, { useEffect, useState } from 'react'

const RiskCalendar = ({ farmId, diseaseRisks = [] }) => {
  const [algaeAlerts, setAlgaeAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    if (!farmId) return

    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/mvp/farm/${farmId}/algae-alerts`)
        if (!res.ok) throw new Error('Failed to fetch alerts')
        const data = await res.json()
        setAlgaeAlerts(data.algaeAlerts || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [farmId])

  if (loading) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4 }}>Laster risikokalender...</div>
  if (error) return <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 4, color: 'var(--accent-red)' }}>Feil: {error}</div>

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

  const getRisksForDay = (day) => {
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const checkStart = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate())
    const checkEnd = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() + 1)

    const risks = {
      algae: [],
      disease: [],
      parasite: []
    }

    // Algae alerts
    algaeAlerts.forEach(alert => {
      const startDate = new Date(alert.startDate)
      const endDate = new Date(alert.endDate)
      if (startDate < checkEnd && endDate > checkStart) {
        risks.algae.push({ ...alert, type: 'algae' })
      }
    })

    // Disease & Parasite risks (from diseaseRisks)
    diseaseRisks.forEach(risk => {
      if (risk.manifestationDay) {
        const manifestDate = new Date(risk.manifestationDay)
        // Show risk on manifestation day and 3 days before
        for (let i = -3; i <= 0; i++) {
          const riskDate = new Date(manifestDate.getTime() + i * 24 * 60 * 60 * 1000)
          if (riskDate >= checkStart && riskDate < checkEnd) {
            const isParasite = ['Gyrodactylus', 'Lus', 'Lice', 'Parasite'].some(word => 
              risk.disease.toLowerCase().includes(word.toLowerCase())
            )
            risks[isParasite ? 'parasite' : 'disease'].push({
              ...risk,
              type: isParasite ? 'parasite' : 'disease'
            })
          }
        }
      }
    })

    return risks
  }

  const getHighestRiskLevel = (risks) => {
    if (risks.algae.some(a => a.concentration === 'høy') ||
        risks.disease.some(d => d.riskScore > 70) ||
        risks.parasite.some(p => p.riskScore > 70)) {
      return 'høy'
    }
    if (risks.algae.some(a => a.concentration === 'moderat') ||
        risks.disease.some(d => d.riskScore > 40) ||
        risks.parasite.some(p => p.riskScore > 40)) {
      return 'moderat'
    }
    if (risks.algae.length > 0 || risks.disease.length > 0 || risks.parasite.length > 0) {
      return 'lav'
    }
    return 'ingen'
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const totalRisks = algaeAlerts.length + diseaseRisks.length

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--accent-gold)' }}>
        📅 Risikokalender - Alger, Sykdommer & Lus
      </h3>

      {/* Month navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={previousMonth}
          style={{ padding: '6px 12px', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={nextMonth}
          style={{ padding: '6px 12px', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
        >
          →
        </button>
      </div>

      {/* Calendar */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, padding: 12, marginBottom: 12, border: '1px solid var(--border-color)' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((day) => (
            <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: 6 }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array(firstDay)
            .fill(null)
            .map((_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1' }}></div>
            ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const risks = getRisksForDay(day)
            const riskLevel = getHighestRiskLevel(risks)
            const hasRisks = risks.algae.length + risks.disease.length + risks.parasite.length

            const bgColor = riskLevel === 'høy' 
              ? 'rgba(220, 38, 38, 0.2)'
              : riskLevel === 'moderat'
              ? 'rgba(234, 88, 12, 0.2)'
              : riskLevel === 'lav'
              ? 'rgba(234, 179, 8, 0.2)'
              : 'var(--bg-surface)'

            const textColor = riskLevel === 'høy'
              ? 'var(--accent-red)'
              : riskLevel === 'moderat'
              ? 'var(--accent-orange)'
              : riskLevel === 'lav'
              ? 'var(--accent-gold)'
              : 'var(--text-primary)'

            return (
              <div
                key={day}
                style={{
                  aspectRatio: '1',
                  padding: 4,
                  borderRadius: 3,
                  border: '1px solid var(--border-color)',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  background: bgColor,
                  color: textColor,
                  position: 'relative'
                }}
                title={hasRisks > 0 ? `${risks.algae.length} alger, ${risks.disease.length} sykdommer, ${risks.parasite.length} lus` : 'Ingen risiko'}
              >
                <span style={{ fontWeight: 700, fontSize: 10 }}>{day}</span>
                {hasRisks > 0 && (
                  <div style={{ display: 'flex', gap: 1 }}>
                    {risks.algae.length > 0 && <span style={{ fontSize: 8, background: 'var(--accent-orange)', color: '#fff', padding: '1px 3px', borderRadius: 2 }}>🌊</span>}
                    {risks.disease.length > 0 && <span style={{ fontSize: 8, background: 'var(--accent-red)', color: '#fff', padding: '1px 3px', borderRadius: 2 }}>🦠</span>}
                    {risks.parasite.length > 0 && <span style={{ fontSize: 8, background: 'var(--accent-red)', color: '#fff', padding: '1px 3px', borderRadius: 2 }}>🪱</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Risiko-indikatorer:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🌊</span>
            <span style={{ color: 'var(--text-secondary)' }}>Alger</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🦠</span>
            <span style={{ color: 'var(--text-secondary)' }}>Sykdommer</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🪱</span>
            <span style={{ color: 'var(--text-secondary)' }}>Lus/Parasitter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: 'rgba(220, 38, 38, 0.3)', border: '1px solid var(--accent-red)', borderRadius: 2 }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Høy risiko</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, padding: 12, border: '1px solid var(--border-color)', fontSize: 11 }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--text-primary)' }}>
          Totalt {totalRisks} risiko-elementer denne måneden
        </p>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          🌊 {algaeAlerts.length} alge-varsler • 🦠 {diseaseRisks.filter(r => !['Gyrodactylus', 'Lus', 'Lice', 'Parasite'].some(w => r.disease.toLowerCase().includes(w.toLowerCase()))).length} sykdommer • 🪱 {diseaseRisks.filter(r => ['Gyrodactylus', 'Lus', 'Lice', 'Parasite'].some(w => r.disease.toLowerCase().includes(w.toLowerCase()))).length} parasitter
        </p>
      </div>
    </div>
  )
}

export default RiskCalendar
