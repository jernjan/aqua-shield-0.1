import { useEffect, useState } from 'react'
import { Anchor } from 'lucide-react'
import { vesselApi } from '@/api/client'
import { Vessel } from '@/types/api'

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: 'bg-green-900 text-green-100',
    inactive: 'bg-slate-700 text-slate-300',
  }
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[status as keyof typeof colors] || colors.inactive}`}>
      {status}
    </span>
  )
}

function VesselRow({ vessel }: { vessel: Vessel }) {
  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between hover:bg-slate-750 transition">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Anchor className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-white font-medium">{vessel.name}</p>
            <p className="text-sm text-slate-400">MMSI: {vessel.mmsi}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 text-sm">
        <p className="text-slate-400">Position</p>
        <p className="text-white">{vessel.latitude.toFixed(4)}°, {vessel.longitude.toFixed(4)}°</p>
      </div>

      <div className="w-24 text-right">
        <p className="text-slate-400 text-sm">Speed</p>
        <p className="text-white font-semibold">{(vessel.speed ?? 0).toFixed(1)} kn</p>
      </div>

      <div className="w-32 text-right">
        <p className="text-slate-400 text-sm">Status</p>
        <StatusBadge status={vessel.status} />
      </div>
    </div>
  )
}

export function VesselsPage() {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)

  useEffect(() => {
    const fetchVessels = async () => {
      try {
        setLoading(true)
        const data = await vesselApi.getAll() as Vessel[]
        setVessels(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vessels')
      } finally {
        setLoading(false)
      }
    }

    const fetchSyncStatus = async () => {
      try {
        // Temporarily disabled - /api/vessels/sync-status returns 405
        // const status = await vesselApi.getSyncStatus()
        // setSyncStatus(status)
      } catch (err) {
        console.error('Failed to fetch sync status:', err)
      }
    }

    fetchVessels()
    fetchSyncStatus()

    // Refresh vessels every hour
    const interval = setInterval(fetchVessels, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

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
        <h1 className="text-3xl font-bold text-white">Vessels</h1>
        <p className="text-slate-400 mt-1">
          Monitor fishing vessels and their proximity to farms
        </p>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Last Sync</p>
              <p className="text-slate-400 text-sm mt-1">{syncStatus.last_sync || 'Never'}</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await vesselApi.sync()
                  const status = await vesselApi.getSyncStatus()
                  setSyncStatus(status)
                } catch (err) {
                  console.error('Sync failed:', err)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Sync Now
            </button>
          </div>
        </div>
      )}

      {/* Vessels List */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="bg-slate-900 px-4 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Vessels ({loading ? '...' : vessels.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : vessels.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            No vessels found
          </div>
        ) : (
          <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
            {vessels.map((vessel) => (
              <VesselRow key={vessel.id} vessel={vessel} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
