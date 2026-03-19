import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapProps {
  farms: Array<{
    id: number
    name: string
    latitude: number
    longitude: number
    riskLevel?: string
  }>
  onFarmClick?: (farmId: number) => void
}

const getRiskMarkerColor = (riskLevel?: string) => {
  switch (riskLevel?.toUpperCase()) {
    case 'CRITICAL':
      return '#DC2626' // Red
    case 'HIGH':
      return '#F97316' // Orange
    case 'MEDIUM':
      return '#EAB308' // Yellow
    case 'LOW':
      return '#22C55E' // Green
    default:
      return '#3B82F6' // Blue
  }
}

export const FarmMap: React.FC<MapProps> = ({ farms, onFarmClick }) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || !farms.length) return

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([60, 10], 5)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current)
    }

    // Add farm markers
    farms.forEach((farm) => {
      const color = getRiskMarkerColor(farm.riskLevel)
      const marker = L.circleMarker([farm.latitude, farm.longitude], {
        color: color,
        fillColor: color,
        fillOpacity: 0.7,
        radius: 8,
        weight: 2,
      })
        .bindPopup(`<strong>${farm.name}</strong><br/>Risk: ${farm.riskLevel || 'Unknown'}`)
        .addTo(map.current!)

      if (onFarmClick) {
        marker.on('click', () => onFarmClick(farm.id))
      }
    })

    // Fit bounds
    const bounds = L.latLngBounds(farms.map((f) => [f.latitude, f.longitude]))
    map.current.fitBounds(bounds, { padding: [50, 50] })

    return () => {
      // Cleanup
      if (map.current) {
        map.current.eachLayer((layer) => {
          if (layer instanceof L.CircleMarker) {
            map.current?.removeLayer(layer)
          }
        })
      }
    }
  }, [farms, onFarmClick])

  return <div ref={mapContainer} className="w-full h-full rounded-lg" />
}
