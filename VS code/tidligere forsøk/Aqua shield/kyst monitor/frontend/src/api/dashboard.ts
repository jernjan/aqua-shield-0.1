import { getApiClient } from './client'

const client = getApiClient()

export interface DashboardFarmData {
  id: number
  name: string
  latitude: number
  longitude: number
  water_temperature: number
  oxygen_level: number
  ph_level: number
  disease_risk: number
  escape_risk: number
  water_quality_risk: number
  sea_lice_risk: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  created_at: string
}

export interface DashboardResponse {
  farms: DashboardFarmData[]
  alerts: any[]
  critical_alerts_count: number
  high_alerts_count: number
  medium_alerts_count: number
  low_alerts_count: number
}

export const dashboardAPI = {
  getDashboard: async (): Promise<DashboardResponse> => {
    const response = await client.get('/api/dashboard')
    return response.data
  },
}
