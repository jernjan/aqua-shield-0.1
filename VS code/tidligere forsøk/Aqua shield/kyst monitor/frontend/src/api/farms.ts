import { getApiClient } from './client'

const client = getApiClient()

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

export interface CreateFarmData {
  name: string
  latitude: number
  longitude: number
  description?: string
}

export interface UpdateFarmData {
  name?: string
  latitude?: number
  longitude?: number
  description?: string
  is_active?: boolean
}

export const farmsAPI = {
  create: async (data: CreateFarmData): Promise<Farm> => {
    const response = await client.post('/api/farms', data)
    return response.data
  },

  getAll: async (): Promise<Farm[]> => {
    const response = await client.get('/api/farms')
    return response.data
  },

  getById: async (farmId: number): Promise<Farm> => {
    const response = await client.get(`/api/farms/${farmId}`)
    return response.data
  },

  update: async (farmId: number, data: UpdateFarmData): Promise<Farm> => {
    const response = await client.put(`/api/farms/${farmId}`, data)
    return response.data
  },

  delete: async (farmId: number): Promise<void> => {
    await client.delete(`/api/farms/${farmId}`)
  },
}
