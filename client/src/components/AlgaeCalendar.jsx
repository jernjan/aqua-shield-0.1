import React, { useEffect, useState } from 'react'

const AlgaeCalendar = ({ farmId }) => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    if (!farmId) return

    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/mvp/farm/${farmId}/algae-alerts`)
        if (!res.ok) throw new Error('Failed to fetch algae alerts')
        const data = await res.json()
        setAlerts(data.algaeAlerts || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [farmId])

  if (loading) return <div className="card p-4 bg-orange-50">Laster alge-varsler...</div>
  if (error) return <div className="card p-4 bg-red-50 text-red-700">Feil: {error}</div>

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

  const getDaysWithAlerts = (day) => {
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return alerts.filter((alert) => {
      const startDate = new Date(alert.startDate)
      const endDate = new Date(alert.endDate)
      const checkStart = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate(),
      )
      const checkEnd = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate() + 1,
      )
      return startDate < checkEnd && endDate > checkStart
    })
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 4, padding: 12 }}>
      <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--accent-orange)' }}>📅 Alge-kalender</h3>

      {/* Month navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={previousMonth}
          style={{ padding: '6px 12px', background: 'var(--accent-orange)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={nextMonth}
          style={{ padding: '6px 12px', background: 'var(--accent-orange)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
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
            const dayAlerts = getDaysWithAlerts(day)

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
                  background: dayAlerts.length === 0
                    ? 'var(--bg-surface)'
                    : dayAlerts.some((a) => a.concentration === 'høy')
                      ? 'rgba(220, 38, 38, 0.2)'
                      : dayAlerts.some((a) => a.concentration === 'moderat')
                        ? 'rgba(234, 88, 12, 0.2)'
                        : 'rgba(234, 179, 8, 0.2)',
                  color: dayAlerts.length === 0 ? 'var(--text-primary)' : dayAlerts.some((a) => a.concentration === 'høy') ? 'var(--accent-red)' : dayAlerts.some((a) => a.concentration === 'moderat') ? 'var(--accent-orange)' : 'var(--accent-gold)'
                }}
              >
                <span style={{ fontWeight: 700 }}>{day}</span>
                {dayAlerts.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{dayAlerts.length}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Alge-konsentrasjon:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: 'rgba(220, 38, 38, 0.2)', border: '1px solid var(--accent-red)', borderRadius: 2 }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Høy</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: 'rgba(234, 88, 12, 0.2)', border: '1px solid var(--accent-orange)', borderRadius: 2 }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Moderat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: 'rgba(234, 179, 8, 0.2)', border: '1px solid var(--accent-gold)', borderRadius: 2 }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Lav</span>
          </div>
        </div>
      </div>

      {/* Upcoming alerts */}
      {alerts.length > 0 ? (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 3, padding: 12, border: '1px solid var(--border-color)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Kommende alge-varsler</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
            {alerts
              .filter((a) => new Date(a.startDate) > new Date())
              .slice(0, 5)
              .map((alert, idx) => (
                <div key={idx} style={{ fontSize: 11, borderLeft: '3px solid var(--accent-orange)', paddingLeft: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.strain}</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {new Date(alert.startDate).toLocaleDateString('no-NO')} –{' '}
                    {new Date(alert.endDate).toLocaleDateString('no-NO')}
                  </p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Konsentrasjon:{' '}
                    <span style={{ fontWeight: 700, color: alert.concentration === 'høy' ? 'var(--accent-red)' : alert.concentration === 'moderat' ? 'var(--accent-orange)' : 'var(--accent-gold)' }}>
                      {alert.concentration}
                    </span>
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 12, background: 'var(--bg-elevated)', borderRadius: 3, border: '1px solid var(--border-color)' }}>
          Ingen alge-varsler for dette anlegget
        </p>
      )}
    </div>
  )
}

export default AlgaeCalendar
