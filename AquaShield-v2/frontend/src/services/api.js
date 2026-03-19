import axios from 'axios'

const API_BASE_URL = '/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authService = {
  register: (email, password, fullName) =>
    client.post('/auth/register', { email, password, full_name: fullName }),
  
  login: (email, password) =>
    client.post('/auth/login', { email, password }),
}

export const facilitiesService = {
  list: () => client.get('/facilities'),
  get: (id) => client.get(`/facilities/${id}`),
  create: (data) => client.post('/facilities', data),
  update: (id, data) => client.put(`/facilities/${id}`, data),
}

export const alertsService = {
  list: (params) => client.get('/alerts', { params }),
  get: (id) => client.get(`/alerts/${id}`),
  update: (id, data) => client.put(`/alerts/${id}`, data),
  delete: (id) => client.delete(`/alerts/${id}`),
}

export default client
