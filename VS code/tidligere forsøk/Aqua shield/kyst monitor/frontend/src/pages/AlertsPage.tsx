import { useEffect, useState } from 'react'
import { Filter, Trash2 } from 'lucide-react'
import { alertApi } from '@/api/client'
import { Alert } from '@/types/api'

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    CRITICAL: 'bg-red-900 text-red-100',
    HIGH: 'bg-orange-900 text-orange-100',
    MEDIUM: 'bg-yellow-900 text-yellow-100',
    LOW: 'bg-green-900 text-green-100',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[severity as keyof typeof colors]}`}>
      {severity}
    </span>
  )
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)
  const [showRead, setShowRead] = useState(false)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true)
        const data = await alertApi.getAll()
        setAlerts(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts')
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
    // Refresh every minute
    const interval = setInterval(fetchAlerts, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let filtered = alerts

    if (!showRead) {
      filtered = filtered.filter((a) => !a.is_read)
    }

    if (filterSeverity) {
      filtered = filtered.filter((a) => a.severity === filterSeverity)
    }

    setFilteredAlerts(filtered)
  }, [alerts, filterSeverity, showRead])

  const handleMarkAsRead = async (id: number) => {
    try {
      await alertApi.markAsRead(id)
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)))
    } catch (err) {
      console.error('Failed to mark alert as read:', err)
    }
  }

  const handleClearAll = async () => {
    try {
      for (const alert of alerts) {
        if (!alert.is_read) {
          await alertApi.markAsRead(alert.id)
        }
      }
      setAlerts(alerts.map((a) => ({ ...a, is_read: true })))
    } catch (err) {
      console.error('Failed to clear alerts:', err)
    }
  }

  if (error) {
    return (
      <div className="bg-red-900 text-red-100 p-4 rounded-lg">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Alerts</h1>
        <p className="text-slate-400 mt-1">
          Manage aquaculture monitoring alerts and notifications
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterSeverity || ''}
              onChange={(e) => setFilterSeverity(e.target.value || null)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 hover:border-slate-500 transition"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRead}
              onChange={(e) => setShowRead(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600"
            />
            <span className="text-slate-300 text-sm">Show read alerts</span>
          </label>

          <button
            onClick={handleClearAll}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center text-slate-400 py-12 bg-slate-800 rounded-lg border border-slate-700">
            {alerts.length === 0 ? 'No alerts found' : 'No alerts match the current filter'}
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${
                alert.is_read ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm text-slate-400">{alert.alert_type}</span>
                  </div>
                  <p className="text-white font-medium">{alert.message}</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Farm #{alert.farm_id} • {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>

                {!alert.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(alert.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm whitespace-nowrap"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
