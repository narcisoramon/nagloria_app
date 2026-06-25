import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const RUTAS = { admin: '/admin/dashboard', cajero: '/caja', vendedor: '/mostrador' }

export function useSeguridad(rolesPermitidos = []) {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const verificarSesion = useAuthStore((s) => s.verificarSesion)
  const [estado, setEstado] = useState({ autorizado: false, verificando: true })

  useEffect(() => {
    let activo = true
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    verificarSesion().then((valida) => {
      if (!activo) return
      if (!valida) {
        navigate('/login', { replace: true })
        return
      }
      const role = useAuthStore.getState().user?.role
      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(role)) {
        navigate(RUTAS[role] || '/login', { replace: true })
        return
      }
      setEstado({ autorizado: true, verificando: false })
    })
    return () => { activo = false }
  }, [])

  return estado
}
