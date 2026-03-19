// API Response Types
export interface Farm {
  id: number
  owner_id: number
  name: string
  latitude: number
  longitude: number
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Vessel {
  id: number
  mmsi: string
  name: string
  vessel_type?: string
  latitude: number
  longitude: number
  speed: number
  course?: number
  heading?: number
  status: string
  last_position_update: string
  callsign?: string
  length?: number
  width?: number
  source?: string
  is_fishing?: boolean
  updated_at?: string
}

export interface Alert {
  id: number
  user_id: number
  farm_id: number
  alert_type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  message: string
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  farms: Farm[]
  alerts: Alert[]
  critical_alerts_count: number
  high_alerts_count: number
  medium_alerts_count: number
  low_alerts_count: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface VesselHistory {
  id: number
  vessel_id: number
  farm_id: number
  latitude: number
  longitude: number
  distance_m: number
  timestamp: string
  risk_level: string
}
