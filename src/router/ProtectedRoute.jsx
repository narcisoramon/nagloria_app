import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'

// Cualquier usuario autenticado
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

// Solo CAJERO — requiere caja abierta
export function CajeroRoute() {
  const { token, user } = useAuthStore()
  const { cajaAbierta } = useCajaStore()

  if (!token) return <Navigate to="/login" replace />

  // Admin y vendedor no entran por aquí
  if (user?.role === 'ADMINISTRADOR') return <Navigate to="/configuracion" replace />
  if (user?.role === 'VENDEDOR') return <Navigate to="/mostrador" replace />

  // Cajero sin caja → apertura
  if (!cajaAbierta()) return <Navigate to="/apertura-caja" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'CAJERO') return <Navigate to="/caja" replace />
  if (user?.role === 'VENDEDOR') return <Navigate to="/mostrador" replace />
  return <Outlet />
}
