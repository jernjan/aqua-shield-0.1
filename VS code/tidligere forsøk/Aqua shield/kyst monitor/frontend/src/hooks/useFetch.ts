import { useState, useEffect } from 'react'

interface UseFetchOptions {
  skip?: boolean
  refetchInterval?: number
}

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url || options.skip) {
      setLoading(false)
      return
    }

    let isMounted = true
    let intervalId: NodeJS.Timeout | null = null

    const fetchData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('access_token') || 'demo-token-test'
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const result = await response.json()
        if (isMounted) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    if (options.refetchInterval) {
      intervalId = setInterval(fetchData, options.refetchInterval)
    }

    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [url, options.skip, options.refetchInterval])

  return { data, loading, error }
}
