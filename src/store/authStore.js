import { create } from 'zustand'
import { authApi } from '../api/auth'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null
  } catch {
    return null
  }
}

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('token') || null,
  loading: false,
  error: null,

  // Roles: el backend devuelve user.role en mayúsculas ('VENDEDOR' | 'CAJERO')
  isVendedor: () => get().user?.role === 'VENDEDOR',
  isCajero: () => get().user?.role === 'CAJERO',
  isAdmin: () => get().user?.role === 'ADMINISTRADOR',
  isCajeroOAdmin: () => ['CAJERO', 'ADMINISTRADOR'].includes(get().user?.role),
  isAuthenticated: () => !!get().token,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authApi.login({ email, password })
      // La API devuelve access_token y user.role en mayúsculas
      const { access_token, user } = data

      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(user))

      set({ token: access_token, user, loading: false })
      return { success: true, rol: user.role }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Credenciales incorrectas'
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
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ user: null, token: null, error: null })
    }
  },

  clearError: () => set({ error: null }),
}))
