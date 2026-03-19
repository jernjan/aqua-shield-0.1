import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000/api',
})

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface User {
  id: number
  username: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const authAPI = {
  register: async (data: RegisterData): Promise<User> => {
    const response = await client.post('/api/auth/register', data)
    return response.data
  },

  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const response = await client.post('/api/auth/login', credentials)
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await client.get('/api/auth/me')
    return response.data
  },
}
