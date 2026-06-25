import axios from 'axios'
import { sanitizeNumeric } from '../utils/sanitize'
import logger from '../utils/logger'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const paths = ['/login', '/apertura-caja', '/esperando-caja']
      if (!paths.includes(window.location.pathname)) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function safeErrorMessage(error) {
  if (!error) return 'Error de conexión'
  const status = error.response?.status
  const data = error.response?.data

  if (!status && !data) return 'Error de conexión'

  if (status === 401) return 'Sesión expirada. Iniciá sesión de nuevo.'
  if (status === 403) return 'No tenés permiso para realizar esta acción.'
  if (status === 404) return 'El recurso solicitado no existe.'
  if (status === 422) return data?.message || 'Datos inválidos. Revisá los campos.'
  if (status === 429) return 'Demasiadas solicitudes. Esperá un momento.'
  if (status >= 500) return 'Error del servidor. Intentalo de nuevo más tarde.'

  return data?.message || 'Ocurrió un error inesperado.'
}

export function getErrorMessage(error) {
  return safeErrorMessage(error)
}

export default client
