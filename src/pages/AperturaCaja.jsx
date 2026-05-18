import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'

const fmt = (n) =>
  new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(n || 0)

export default function AperturaCaja() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { abrir, verificar, loading, error, cajaAbierta } = useCajaStore()

  const [monto, setMonto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [localError, setLocalError] = useState('')

  // Si ya tiene caja abierta, redirigir
  useEffect(() => {
    verificar().then((abierta) => {
      if (abierta) {
        const dest = ['CAJERO', 'ADMINISTRADOR'].includes(user?.role) ? '/caja' : '/mostrador'
        navigate(dest, { replace: true })
      }
    })
  }, [])

  const handleMonto = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    setMonto(val)
    setLocalError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const montoNum = parseInt(monto, 10)
    if (!monto || montoNum < 0) {
      setLocalError('Ingresá un monto inicial válido')
      return
    }
    const result = await abrir(montoNum, observacion)
    if (result.success) {
      // Verificar para sincronizar el store
      await verificar()
      const dest = ['CAJERO', 'ADMINISTRADOR'].includes(user?.role) ? '/caja' : '/mostrador'
      navigate(dest, { replace: true })
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>ÑG</div>
          <div>
            <h1 style={styles.titulo}>Apertura de Caja</h1>
            <p style={styles.subtitulo}>Hola, {user?.name}</p>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Info */}
        <div style={styles.infoBox}>
          <span style={styles.infoIcon}>ℹ️</span>
          <p style={styles.infoText}>
            Para comenzar a operar necesitás abrir la caja registrando el monto inicial disponible.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Monto inicial (Gs.)</label>
            <input
              type="text"
              inputMode="numeric"
              value={monto ? fmt(parseInt(monto, 10)) : ''}
              onChange={handleMonto}
              placeholder="0"
              style={styles.input}
              autoFocus
            />
            {monto && (
              <span style={styles.montoPreview}>
                Gs. {fmt(parseInt(monto, 10))}
              </span>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Observación (opcional)</label>
            <input
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Apertura turno mañana"
              style={styles.input}
            />
          </div>

          {(localError || error) && (
            <p style={styles.error}>{localError || error}</p>
          )}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Abriendo caja…' : '🔓 Abrir Caja'}
          </button>
        </form>

        {/* Logout */}
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

const styles = {
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
    padding: 'clamp(1.2rem, 5vw, 2rem)',
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.2rem',
  },
  logo: {
    width: 48,
    height: 48,
    background: '#b8732a',
    color: '#fff',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  titulo: {
    fontSize: 'clamp(18px, 5vw, 20px)',
    fontWeight: 700,
    color: '#2c1a08',
    margin: 0,
  },
  subtitulo: {
    fontSize: 13,
    color: '#8a7560',
    margin: 0,
  },
  divider: {
    height: 1,
    background: '#f0e8dc',
    marginBottom: '1.2rem',
  },
  infoBox: {
    display: 'flex',
    gap: '0.6rem',
    background: '#fef9f0',
    border: '1px solid #f5e6cc',
    borderRadius: 10,
    padding: '0.8rem',
    marginBottom: '1.5rem',
  },
  infoIcon: { fontSize: 16, flexShrink: 0 },
  infoText: { fontSize: 13, color: '#6b4f2a', margin: 0, lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#4a3520' },
  input: {
    padding: '10px 14px',
    border: '1px solid #ddd0be',
    borderRadius: 8,
    fontSize: 16,
    background: '#fdfaf6',
    outline: 'none',
    color: '#2c1a08',
  },
  montoPreview: {
    fontSize: 13,
    color: '#b8732a',
    fontWeight: 600,
    paddingLeft: 4,
  },
  error: {
    fontSize: 13,
    color: '#c0392b',
    background: '#fdf0ef',
    border: '1px solid #f5c6c6',
    borderRadius: 8,
    padding: '8px 12px',
    margin: 0,
  },
  btn: {
    padding: '12px',
    background: '#b8732a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: '1rem',
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: '#8a7560',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}
