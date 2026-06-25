import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'

function Cargando() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#8a7560',background:'#faf7f2',fontSize:16}}>
      Verificando sesión…
    </div>
  )
}

// Verifica la sesión contra el backend antes de renderizar
function useVerificarSesion() {
  const token = useAuthStore((s) => s.token)
  const verificarSesion = useAuthStore((s) => s.verificarSesion)
  const [ok, setOk] = useState(null)

  useEffect(() => {
    if (!token) { setOk(false); return }
    verificarSesion().then(setOk)
  }, [])

  if (ok === null) return 'cargando'
  if (!ok) return 'no-auth'
  return 'ok'
}

// Cualquier usuario autenticado
export function ProtectedRoute() {
  const estado = useVerificarSesion()
  if (estado === 'cargando') return <Cargando />
  if (estado === 'no-auth') return <Navigate to="/login" replace />
  return <Outlet />
}

// Solo CAJERO — requiere caja abierta
export function CajeroRoute() {
  const estado = useVerificarSesion()
  const user = useAuthStore((s) => s.user)
  const { cajaAbierta } = useCajaStore()

  if (estado === 'cargando') return <Cargando />
  if (estado === 'no-auth') return <Navigate to="/login" replace />

  // Admin y vendedor no entran por aquí
  if (user?.role === 'admin') return <Navigate to="/configuracion" replace />
  if (user?.role === 'vendedor') return <Navigate to="/mostrador" replace />

  // Cajero sin caja → apertura
  if (!cajaAbierta()) return <Navigate to="/apertura-caja" replace />

  return <Outlet />
}

export function AdminRoute() {
  const estado = useVerificarSesion()
  const user = useAuthStore((s) => s.user)

  if (estado === 'cargando') return <Cargando />
  if (estado === 'no-auth') return <Navigate to="/login" replace />

  if (user?.role === 'cajero') return <Navigate to="/caja" replace />
  if (user?.role === 'vendedor') return <Navigate to="/mostrador" replace />
  return <Outlet />
}

// Solo VENDEDOR (o admin que quiere ver mostrador)
export function VendedorRoute({ children }) {
  const estado = useVerificarSesion()
  const user = useAuthStore((s) => s.user)

  if (estado === 'cargando') return <Cargando />
  if (estado === 'no-auth') return <Navigate to="/login" replace />

  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user?.role === 'cajero') return <Navigate to="/caja" replace />
  return children
}
