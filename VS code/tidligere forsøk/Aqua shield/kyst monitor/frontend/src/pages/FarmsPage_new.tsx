import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePagination } from '@/hooks/usePagination'
import { farmApi } from '@/api/client'
import { Farm } from '@/types/api'

export function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pagination = usePagination({ initialPage: 1, pageSize: 20 })

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        setLoading(true)
        const data = await farmApi.getAll(pagination.page, pagination.pageSize)
        setFarms(data.data || data)
        pagination.setTotalPages(data.total_pages || 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load farms')
      } finally {
        setLoading(false)
      }
    }

    fetchFarms()
  }, [pagination.page, pagination.pageSize])

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
        <h1 className="text-3xl font-bold text-white">Farms</h1>
        <p className="text-slate-400 mt-1">
          Monitor all aquaculture farms
        </p>
      </div>

      {/* Farms Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <div className="flex items-center justify-center col-span-full h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : farms.length === 0 ? (
          <div className="col-span-full text-center text-slate-400 py-12">
            No farms found
          </div>
        ) : (
          farms.map((farm) => (
            <div
              key={farm.id}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{farm.name}</h3>
                <p className="text-sm text-slate-400">
                  {farm.latitude.toFixed(4)}°, {farm.longitude.toFixed(4)}°
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Location</p>
                  <p className="text-white">{farm.description || 'No description available'}</p>
                </div>
                
                <div>
                  <p className="text-slate-400">Owner ID</p>
                  <p className="text-white">#{farm.owner_id}</p>
                </div>

                <div>
                  <p className="text-slate-400">Status</p>
                  <p className={farm.is_active ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {farm.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700">
                  <p className="text-slate-400 text-xs">Created</p>
                  <p className="text-white text-xs">{new Date(farm.created_at).toLocaleDateString('no-NO')}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && farms.length > 0 && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-4 border border-slate-700">
          <button
            onClick={() => pagination.prevPage()}
            disabled={pagination.page === 1}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = i + 1
              return (
                <button
                  key={pageNum}
                  onClick={() => pagination.goToPage(pageNum)}
                  className={`w-10 h-10 rounded-lg transition ${
                    pagination.page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => pagination.nextPage()}
            disabled={pagination.page === pagination.totalPages}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
