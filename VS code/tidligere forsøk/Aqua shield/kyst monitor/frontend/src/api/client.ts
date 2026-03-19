import axios from 'axios'
import { PaginatedResponse, Farm, Vessel, Alert, DashboardStats, VesselHistory } from '@/types/api'

const API_BASE = 'http://localhost:8000/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

// Add authorization token to requests (but not to preflight OPTIONS)
apiClient.interceptors.request.use((config) => {
  if (config.method !== 'options') {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || 'demo-token-test'
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Enhanced error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Network error'
    console.error('API Error:', { status: error.response?.status, message })
    throw new Error(message)
  }
)

export const farmApi = {
  getAll: async (page: number = 1, pageSize: number = 50) => {
    const response = await apiClient.get<PaginatedResponse<Farm>>('/farms', {
      params: { page, page_size: pageSize },
    })
    return response.data
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Farm>(`/farms/${id}`)
    return response.data
  },
}

export const vesselApi = {
  getAll: async () => {
    const response = await apiClient.get<Vessel[]>('/vessels')
    return Array.isArray(response.data) ? response.data : response.data.data || []
  },

  getById: async (id: number) => {
    const response = await apiClient.get<Vessel>(`/vessels/${id}`)
    return response.data
  },

  sync: async () => {
    const response = await apiClient.post('/vessels/sync-from-barentswatch', {})
    return response.data
  },

  getSyncStatus: async () => {
    const response = await apiClient.get('/vessels/sync-status')
    return response.data
  },

  getHistory: async (vesselId: number, farmId: number) => {
    const response = await apiClient.get<VesselHistory[]>(
      `/vessels/${vesselId}/history?farm_id=${farmId}`
    )
    return response.data
  },

  getNearFarm: async (farmId: number) => {
    const response = await apiClient.get<Vessel[]>(`/vessels/near-farm/${farmId}`)
    return response.data
  },

  getProximityRisks: async () => {
    const response = await apiClient.get('/vessels/proximity/risks')
    return response.data
  },
}

export const alertApi = {
  getAll: async () => {
    const response = await apiClient.get<Alert[]>('/alerts')
    return response.data
  },

  markAsRead: async (id: number) => {
    const response = await apiClient.put(`/alerts/${id}/read`, {})
    return response.data
  },
}

export const dashboardApi = {
  getStats: async () => {
    const response = await apiClient.get('/dashboard')
    return response.data
  },
}

export const riskApi = {
  assessFarm: async (farmId: number) => {
    const response = await apiClient.get(`/risk/assess-farm/${farmId}`)
    return response.data
  },
}
