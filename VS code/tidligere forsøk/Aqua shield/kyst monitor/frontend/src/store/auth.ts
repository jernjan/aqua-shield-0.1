import { create } from 'zustand'
import { authAPI } from '@/api/auth'

interface User {
  id: number
  username: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  register: (username: string, email: string, password: string) => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  setDemoMode: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setDemoMode: () => {
    const demoToken = 'demo-token-' + Date.now()
    localStorage.setItem('token', demoToken)
    set({
      user: {
        id: 1,
        username: 'demo_user',
        email: 'demo@aquashield.local',
      },
      token: demoToken,
      isAuthenticated: true,
    })
  },

  register: async (username, email, password) => {
    set({ isLoading: true })
    try {
      await authAPI.register({ username, email, password })
      // Auto-login after registration
      const response = await authAPI.login({ username, password })
      localStorage.setItem('token', response.access_token)
      const user = await authAPI.getCurrentUser()
      set({
        user,
        token: response.access_token,
        isAuthenticated: true,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const response = await authAPI.login({ username, password })
      localStorage.setItem('token', response.access_token)
      const user = await authAPI.getCurrentUser()
      set({
        user,
        token: response.access_token,
        isAuthenticated: true,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isAuthenticated: false })
      return
    }

    try {
      const user = await authAPI.getCurrentUser()
      set({ user, isAuthenticated: true })
    } catch {
      localStorage.removeItem('token')
      set({ isAuthenticated: false })
    }
  },
}))
