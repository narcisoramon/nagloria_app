import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'

export default function EsperandoCaja() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { verificar, limpiar } = useCajaStore()
  const [verificando, setVerificando] = useState(false)
  const [intentos, setIntentos] = useState(0)

  const reintentar = async () => {
    setVerificando(true)
    const abierta = await verificar()
    setVerificando(false)
    setIntentos((n) => n + 1)
    if (abierta) {
      navigate('/mostrador', { replace: true })
    }
  }

  const handleLogout = async () => {
    await logout()
    limpiar()
    navigate('/login', { replace: true })
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.icono}>🔒</div>
        <h2 style={s.titulo}>Caja no disponible</h2>
        <p style={s.texto}>
          El cajero aún no ha abierto la caja del día.
          <br />
          Avisale para que pueda comenzar a operar.
        </p>

        {intentos > 0 && (
          <p style={s.hint}>
            Sin caja abierta — intentá de nuevo en unos minutos.
          </p>
        )}

        <div style={s.botones}>
          <button onClick={reintentar} disabled={verificando} style={s.btnReintentar}>
            {verificando ? 'Verificando…' : '🔄 Reintentar'}
          </button>
          <button onClick={handleLogout} style={s.btnSalir}>
            Cerrar sesión
          </button>
        </div>

        <div style={s.userInfo}>
          Conectado como <strong>{user?.name}</strong> · {user?.role}
        </div>
      </div>
    </div>
  )
}

const s = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf7f2',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    border: '1px solid #e8e0d0',
    borderRadius: 16,
    padding: 'clamp(1.3rem, 6vw, 2.5rem) clamp(1rem, 5vw, 2rem)',
    width: '100%',
    maxWidth: 400,
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  icono: { fontSize: 48, marginBottom: '1rem' },
  titulo: { fontSize: 'clamp(18px, 6vw, 22px)' , fontWeight: 700, color: '#2c1a08', margin: '0 0 0.8rem' },
  texto: { fontSize: 14, color: '#6b4f2a', lineHeight: 1.6, margin: '0 0 1rem' },
  hint: {
    fontSize: 12,
    color: '#c0392b',
    background: '#fdf0ef',
    border: '1px solid #f5c6c6',
    borderRadius: 8,
    padding: '8px 12px',
    margin: '0 0 1rem',
  },
  botones: { display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '1.5rem' },
  btnReintentar: {
    padding: '11px',
    background: '#b8732a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSalir: {
    padding: '9px',
    background: 'transparent',
    border: '1px solid #ddd0be',
    color: '#6b4f2a',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
  userInfo: { fontSize: 12, color: '#8a7560' },
}
