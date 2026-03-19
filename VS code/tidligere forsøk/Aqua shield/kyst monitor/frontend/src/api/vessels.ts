import { getApiClient } from './client'

const apiClient = getApiClient()

export const vesselsAPI = {
  listVessels: async () => {
    const response = await apiClient.get('/vessels/')
    return response.data
  },

  getVessel: async (vesselId: number) => {
    const response = await apiClient.get(`/vessels/${vesselId}`)
    return response.data
  },

  getProximityRisks: async () => {
    const response = await apiClient.get('/vessels/proximity/risks')
    return response.data
  },

  getVesselsNearFarm: async (farmId: number, radiusKm: number = 20) => {
    const response = await apiClient.get(`/vessels/near-farm/${farmId}`, {
      params: { radius_km: radiusKm }
    })
    return response.data
  },
}
