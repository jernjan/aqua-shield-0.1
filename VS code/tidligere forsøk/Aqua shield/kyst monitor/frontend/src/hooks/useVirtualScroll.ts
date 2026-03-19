import { useState, useEffect } from 'react'

export function useVirtualScroll(
  items: any[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.floor(scrollTop / itemHeight)
  const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight)
  
  const visibleItems = items.slice(
    Math.max(0, startIndex - 5),
    Math.min(items.length, endIndex + 5)
  )

  const totalHeight = items.length * itemHeight
  const offsetY = Math.max(0, startIndex - 5) * itemHeight

  return {
    visibleItems,
    offsetY,
    totalHeight,
    setScrollTop,
  }
}
