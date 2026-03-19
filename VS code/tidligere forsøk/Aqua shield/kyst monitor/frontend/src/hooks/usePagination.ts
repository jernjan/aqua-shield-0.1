import { useState, useCallback } from 'react'

interface UsePaginationParams {
  initialPage?: number
  pageSize?: number
}

export function usePagination({ initialPage = 1, pageSize = 50 } = {}) {
  const [page, setPage] = useState(initialPage)
  const [pageSize_, setPageSize] = useState(pageSize)
  const [totalPages, setTotalPages] = useState(0)

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setPage((p) => (p < totalPages ? p + 1 : p))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage((p) => (p > 1 ? p - 1 : p))
  }, [])

  return {
    page,
    pageSize: pageSize_,
    totalPages,
    setTotalPages,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
  }
}
