import { getApiClient } from './client'

const client = getApiClient()

export interface Alert {
  id: number
  user_id: number
  farm_id: number
  alert_type: string
  severity: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface AlertSummary {
  critical: number
  high: number
  medium: number
  total_unread: number
}

export const alertsAPI = {
  getAll: async (unreadOnly: boolean = false, farmId?: number): Promise<Alert[]> => {
    const response = await client.get('/api/alerts', {
      params: {
        unread_only: unreadOnly,
        farm_id: farmId,
      }
    })
    return response.data
  },

  getById: async (alertId: number): Promise<Alert> => {
    const response = await client.get(`/api/alerts/${alertId}`)
    return response.data
  },

  markAsRead: async (alertId: number): Promise<Alert> => {
    const response = await client.patch(`/api/alerts/${alertId}`, {
      is_read: true
    })
    return response.data
  },

  delete: async (alertId: number): Promise<void> => {
    await client.delete(`/api/alerts/${alertId}`)
  },

  getSummary: async (): Promise<AlertSummary> => {
    const response = await client.get('/api/alerts/stats/summary')
    return response.data
  },
}
