import { getApiClient } from './client'

const client = getApiClient()

export interface RiskAssessment {
  id: number
  farm_id: number
  risk_level: string
  disease_risk: number
  escape_risk: number
  water_quality_risk: number
  sea_lice_risk: number
  details?: string
  assessed_at: string
  created_at: string
}

export const riskAPI = {
  assess: async (farmId: number): Promise<RiskAssessment> => {
    const response = await client.post(`/api/risk/assess/${farmId}`)
    return response.data
  },

  getHistory: async (farmId: number, limit: number = 30): Promise<RiskAssessment[]> => {
    const response = await client.get(`/api/risk/history/${farmId}`, {
      params: { limit }
    })
    return response.data
  },

  getLatest: async (farmId: number): Promise<RiskAssessment> => {
    const response = await client.get(`/api/risk/latest/${farmId}`)
    return response.data
  },
}
