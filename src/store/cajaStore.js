import { create } from 'zustand'
import { cajaApi } from '../api/caja'
import { getErrorMessage } from '../api/client'
import logger from '../utils/logger'

const getStoredCaja = () => {
  try { return JSON.parse(localStorage.getItem('caja')) || null } catch { return null }
}

export const useCajaStore = create((set, get) => ({
  caja: getStoredCaja(),
  loading: false,
  error: null,

  cajaAbierta: () => !!get().caja,
  cajaId: () => get().caja?.id || null,

  verificar: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await cajaApi.verificar()
      if (data.abierta) {
        localStorage.setItem('caja', JSON.stringify(data.data))
        set({ caja: data.data, loading: false })
      } else {
        localStorage.removeItem('caja')
        set({ caja: null, loading: false })
      }
      return data.abierta
    } catch (err) {
      logger.error('Error verificando caja')
      set({ loading: false })
      return false
    }
  },

  abrir: async (montoInicial, observacion) => {
    set({ loading: true, error: null })
    try {
      const { data } = await cajaApi.abrir({ monto_inicial: montoInicial, observacion })
      localStorage.setItem('caja', JSON.stringify(data.data))
      set({ caja: data.data, loading: false })
      return { success: true }
    } catch (err) {
      const message = getErrorMessage(err)
      set({ loading: false, error: message })
      return { success: false, error: message }
    }
  },

  cerrar: async (montoReal, observacion) => {
    set({ loading: true, error: null })
    try {
      const { data } = await cajaApi.cerrar({ monto_real: montoReal, observacion })
      localStorage.removeItem('caja')
      set({ caja: null, loading: false })
      return { success: true, resumen: data.resumen }
    } catch (err) {
      const message = getErrorMessage(err)
      set({ loading: false, error: message })
      return { success: false, error: message }
    }
  },

  limpiar: () => {
    localStorage.removeItem('caja')
    set({ caja: null, error: null })
  },
}))
