import { create } from 'zustand'
import { authApi } from '../api/auth'
import { getErrorMessage } from '../api/client'
import logger from '../utils/logger'

const normalizarRol = (user) => {
  if (!user) return user
  if (user.rol && !user.role) user.role = user.rol
  if (user?.role) user.role = user.role.toLowerCase()
  return user
}

const getStoredUser = () => {
  try {
    return normalizarRol(JSON.parse(localStorage.getItem('user'))) || null
  } catch {
    return null
  }
}

const limpiarSesion = (set) => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  set({ user: null, token: null, verificando: false })
}

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('token') || null,
  loading: false,
  verificando: false,
  error: null,

  isVendedor: () => get().user?.role === 'vendedor',
  isCajero: () => get().user?.role === 'cajero',
  isAdmin: () => get().user?.role === 'admin',
  isCajeroOAdmin: () => ['cajero', 'admin'].includes(get().user?.role),
  isAuthenticated: () => !!get().token,

  verificarSesion: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      limpiarSesion(set)
      return false
    }
    set({ verificando: true })
    try {
      const { data: raw } = await authApi.perfil()
      const userData = raw.user || raw.data || raw
      normalizarRol(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      set({ user: userData, token, verificando: false })
      return true
    } catch (err) {
      logger.error('Error verificando sesión')
      limpiarSesion(set)
      return false
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.login({ email, password })
      const { access_token, user } = data
      normalizarRol(user)

      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(user))

      set({ token: access_token, user, loading: false })
      return { success: true, rol: user.role }
    } catch (err) {
      const message = getErrorMessage(err)
      set({ loading: false, error: message })
      return { success: false, error: message }
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // Aunque falle en el server, limpiamos local
    } finally {
      limpiarSesion(set)
    }
  },

  clearError: () => set({ error: null }),
}))
