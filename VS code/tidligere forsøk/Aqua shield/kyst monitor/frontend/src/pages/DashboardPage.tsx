import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import { dashboardApi } from '@/api/client'
import { DashboardStats } from '@/types/api'

function RiskBadge({ level }: { level: string }) {
  const colors = {
    CRITICAL: 'bg-red-900 text-red-100',
    HIGH: 'bg-orange-900 text-orange-100',
    MEDIUM: 'bg-yellow-900 text-yellow-100',
    LOW: 'bg-green-900 text-green-100',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[level as keyof typeof colors]}`}>
      {level}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number | string
  icon: any
  color: string
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dashboardApi.getStats()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !stats) {
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
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Real-time aquaculture monitoring and risk assessment
        </p>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="CRITICAL"
          value={stats.critical_alerts_count}
          icon={AlertTriangle}
          color="text-red-500"
        />
        <StatCard
          title="HIGH"
          value={stats.high_alerts_count}
          icon={AlertTriangle}
          color="text-orange-500"
        />
        <StatCard
          title="MEDIUM"
          value={stats.medium_alerts_count}
          icon={TrendingUp}
          color="text-yellow-500"
        />
        <StatCard
          title="LOW"
          value={stats.low_alerts_count}
          icon={Zap}
          color="text-green-500"
        />
      </div>

      {/* Farms Overview */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Farms ({stats.farms.length})</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-3">
          {stats.farms.map((farm) => (
            <div
              key={farm.id}
              className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{farm.name}</h3>
                  <p className="text-sm text-slate-400">
                    {farm.latitude.toFixed(2)}°, {farm.longitude.toFixed(2)}°
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-slate-400">Location</p>
                  <p className="text-white">{farm.description || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      {stats.alerts.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Recent Alerts</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {stats.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-6 py-4 flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-white font-medium">{alert.message}</p>
                  <p className="text-slate-400 text-sm mt-1">{alert.alert_type}</p>
                </div>
                <RiskBadge level={alert.severity} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
