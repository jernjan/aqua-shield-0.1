import { create } from 'zustand'
import { farmsAPI, Farm } from '@/api/farms'

interface FarmState {
  farms: Farm[]
  selectedFarm: Farm | null
  isLoading: boolean
  error: string | null
  fetchFarms: () => Promise<void>
  selectFarm: (farm: Farm) => void
  addFarm: (farmData: any) => Promise<void>
  updateFarm: (farmId: number, farmData: any) => Promise<void>
  deleteFarm: (farmId: number) => Promise<void>
}

export const useFarmStore = create<FarmState>((set) => ({
  farms: [],
  selectedFarm: null,
  isLoading: false,
  error: null,

  fetchFarms: async () => {
    set({ isLoading: true, error: null })
    try {
      const farms = await farmsAPI.getAll()
      set({ farms })
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  selectFarm: (farm) => {
    set({ selectedFarm: farm })
  },

  addFarm: async (farmData) => {
    try {
      const newFarm = await farmsAPI.create(farmData)
      set((state) => ({
        farms: [...state.farms, newFarm]
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  updateFarm: async (farmId, farmData) => {
    try {
      const updated = await farmsAPI.update(farmId, farmData)
      set((state) => ({
        farms: state.farms.map((f) => f.id === farmId ? updated : f),
        selectedFarm: state.selectedFarm?.id === farmId ? updated : state.selectedFarm,
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },

  deleteFarm: async (farmId) => {
    try {
      await farmsAPI.delete(farmId)
      set((state) => ({
        farms: state.farms.filter((f) => f.id !== farmId),
        selectedFarm: state.selectedFarm?.id === farmId ? null : state.selectedFarm,
      }))
    } catch (error) {
      set({ error: String(error) })
      throw error
    }
  },
}))
