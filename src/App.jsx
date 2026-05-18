import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useCajaStore } from './store/cajaStore'
import { ProtectedRoute, CajeroRoute, AdminRoute } from './router/ProtectedRoute'
import Login from './pages/Login'
import AperturaCaja from './pages/AperturaCaja'
import EsperandoCaja from './pages/EsperandoCaja'
import Mostrador from './pages/Mostrador'
import Caja from './pages/Caja'
import Gastos from './pages/Gastos'
import CierreCaja from './pages/CierreCaja'
import Clientes from './pages/Clientes'
import Configuracion from './pages/Configuracion'
import AdminDashboard from './pages/AdminDashboard'

function VendedorRoute({ children }) {
  const { user } = useAuthStore()
  if (user?.role === 'ADMINISTRADOR') return <Navigate to="/admin/dashboard" replace />
  if (user?.role === 'CAJERO') return <Navigate to="/caja" replace />
  return children
}

function RootRedirect() {
  const { token, user } = useAuthStore()
  const { verificar } = useCajaStore()
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }

    const role = user?.role

    if (role === 'ADMINISTRADOR') {
      navigate('/admin/dashboard', { replace: true })
      setChecking(false)
      return
    }

    verificar().then((abierta) => {
      if (role === 'VENDEDOR') {
        navigate(abierta ? '/mostrador' : '/esperando-caja', { replace: true })
      } else if (role === 'CAJERO') {
        navigate(abierta ? '/caja' : '/apertura-caja', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
      setChecking(false)
    })
  }, [])

  if (checking) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#8a7560',background:'#faf7f2'}}>
      Cargando…
    </div>
  )
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/apertura-caja" element={<AperturaCaja />} />
          <Route path="/esperando-caja" element={<EsperandoCaja />} />
          <Route path="/mostrador" element={<VendedorRoute><Mostrador /></VendedorRoute>} />
        </Route>

        <Route element={<CajeroRoute />}>
          <Route path="/caja" element={<Caja />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/cierre-caja" element={<CierreCaja />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
