import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'
import logger from '../utils/logger'
import { noti, confirmar } from '../utils/alertify'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')
const parseFmt = (raw) => parseInt(String(raw).replace(/\D/g, '') || '0')

export default function CierreCaja() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { caja, limpiar } = useCajaStore()

  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cerrando, setCerrando] = useState(false)
  const [error, setError] = useState('')
  const [montoRealRaw, setMontoRealRaw] = useState('')
  const [observacion, setObservacion] = useState('')
  const [cierreFinal, setCierreFinal] = useState(null)

  useEffect(() => { cargarResumen() }, [])

  const cargarResumen = async () => {
    if (!caja?.id) return
    try {
      const [resTickets, resGastos, resPagos] = await Promise.all([
        client.get('/tickets', { params: { apertura_caja_id: caja.id, estado: 'pagado', per_page: 200 } }),
        client.get('/gastos', { params: { apertura_caja_id: caja.id, estado: 'activo', per_page: 200 } }),
        client.get('/pago-clientes', { params: { apertura_caja_id: caja.id, per_page: 200 } }),
      ])

      const tickets = resTickets.data.data || resTickets.data
      const gastos = resGastos.data.data || resGastos.data
      const pagos = resPagos.data.data || resPagos.data

      const totalVentas = tickets
        .filter((t) => t.tipo_venta !== 'credito')
        .reduce((s, t) => s + parseFloat(t.monto_pagado), 0)

      const totalCredito = tickets
        .filter((t) => t.tipo_venta === 'credito')
        .reduce((s, t) => s + parseFloat(t.total), 0)

      const totalPagosClientes = pagos.reduce((s, p) => s + parseFloat(p.monto), 0)
      const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.monto), 0)
      const montoInicial = parseFloat(caja.monto_inicial)
      const totalSistema = montoInicial + totalVentas + totalPagosClientes - totalGastos

      setResumen({
        montoInicial,
        totalVentas,
        totalCredito,
        totalPagosClientes,
        totalGastos,
        totalSistema,
        cantTickets: tickets.length,
        cantGastos: gastos.length,
        tickets,
        gastos,
      })
    } catch (e) {
      logger.error(e)
      noti('error', 'Error al cargar el resumen de caja')
    } finally {
      setCargando(false)
    }
  }

  const montoReal = parseFmt(montoRealRaw)
  const diferencia = resumen ? montoReal - resumen.totalSistema : 0

  const cerrar = async () => {
    if (!montoReal) { noti('error', 'Ingresá el monto real en caja'); return }
    setCerrando(true)
    try {
      const { data } = await client.post('/cierre-cajas/cerrar', {
        monto_real: montoReal,
        observacion: observacion || null,
      })
      limpiar()
      setCierreFinal(data)
    } catch (e) {
      noti('error', e.response?.data?.message || 'Error al cerrar la caja')
    } finally {
      setCerrando(false)
    }
  }

  const handleLogout = async () => {
    await logout(); limpiar()
    navigate('/login', { replace: true })
  }

  // ── Pantalla de cierre exitoso ──
  if (cierreFinal) {
    const r = cierreFinal.resumen || {}
    const dif = parseFloat(r.diferencia || 0)
    return (
      <div style={s.root}>
        <nav style={s.nav}>
          <div style={s.navLeft}><div style={s.navLogo}>ÑG</div><span style={s.navTitulo}>Caja cerrada</span></div>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </nav>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#faf7f2' }}>
          <div style={s.cierreOkBox}>
            <div style={s.cierreOkIcon}>🔒</div>
            <h2 style={s.cierreOkTitulo}>Caja cerrada</h2>
            <p style={s.cierreOkSub}>Turno finalizado correctamente</p>

            <div style={s.cierreResumen}>
              <div style={s.cierreRow}><span>Monto inicial</span><span>{fmt(r.monto_inicial)}</span></div>
              <div style={s.cierreRow}><span>Total ingresos</span><span>{fmt(r.total_ingresos)}</span></div>
              <div style={s.cierreRow}><span>Total gastos</span><span style={{color:'#c0392b'}}>− {fmt(r.total_gastos)}</span></div>
              <div style={{...s.cierreRow, ...s.cierreRowTotal}}><span>Total sistema</span><span>{fmt(r.total_sistema)}</span></div>
              <div style={s.cierreRow}><span>Monto real</span><span>{fmt(r.monto_real)}</span></div>
              <div style={{...s.cierreRow, ...s.cierreRowDif, color: dif >= 0 ? '#1a7a4a' : '#c0392b'}}>
                <span>Diferencia</span>
                <span>{dif >= 0 ? '+' : ''}{fmt(dif)}</span>
              </div>
            </div>

            <button onClick={handleLogout} style={s.salirBtn}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>LG</div>
          <span style={s.navTitulo}>Cierre de Caja</span>
        </div>
        <div style={s.navRight}>
          <button onClick={() => navigate('/caja')} style={s.navBack}>← Caja</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      {cargando ? (
        <div style={s.loading}>Calculando resumen del turno…</div>
      ) : (
        <div style={s.body}>
          {/* ── Panel izquierdo: resumen ── */}
          <div style={s.panelResumen}>
            <h2 style={s.secTitulo}>Resumen del turno</h2>

            <div style={s.resumenBox}>
              <div style={s.resRow}>
                <span style={s.resLabel}>Monto inicial</span>
                <span style={s.resVal}>{fmt(resumen?.montoInicial)}</span>
              </div>
              <div style={s.divider} />
              <div style={s.resRow}>
                <span style={s.resLabel}>Ventas cobradas</span>
                <span style={s.resVal}>{fmt(resumen?.totalVentas)}</span>
              </div>
              <div style={s.resRow}>
                <span style={s.resLabelSub}>Ventas a crédito</span>
                <span style={s.resValSub}>{fmt(resumen?.totalCredito)}</span>
              </div>
              <div style={s.resRow}>
                <span style={s.resLabel}>Pagos de clientes</span>
                <span style={s.resVal}>{fmt(resumen?.totalPagosClientes)}</span>
              </div>
              <div style={s.resRow}>
                <span style={s.resLabel}>Gastos del turno</span>
                <span style={{...s.resVal, color:'#c0392b'}}>− {fmt(resumen?.totalGastos)}</span>
              </div>
              <div style={s.divider} />
              <div style={{...s.resRow, ...s.resRowTotal}}>
                <span>Total sistema</span>
                <span>{fmt(resumen?.totalSistema)}</span>
              </div>
            </div>

            {/* Stats rápidos */}
            <div style={s.statsGrid}>
              <div style={s.statCard}>
                <span style={s.statNum}>{resumen?.cantTickets}</span>
                <span style={s.statLabel}>Tickets cobrados</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statNum}>{resumen?.cantGastos}</span>
                <span style={s.statLabel}>Gastos</span>
              </div>
            </div>
          </div>

          {/* ── Panel derecho: formulario cierre ── */}
          <div style={s.panelCierre}>
            <h2 style={s.secTitulo}>Conteo de caja</h2>
            <p style={s.cierreHint}>
              Contá el dinero físico en caja y registrá el monto real.
            </p>

            <div style={s.field}>
              <label style={s.label}>Monto real en caja (Gs.) *</label>
              <input
                type="text" inputMode="numeric"
                value={montoRealRaw}
                onChange={(e) => setMontoRealRaw(e.target.value.replace(/\D/g, '') ? parseInt(e.target.value.replace(/\D/g, '')).toLocaleString('es-PY') : '')}
                placeholder="0"
                style={s.montoInput}
                autoFocus
              />
            </div>

            {/* Diferencia en tiempo real */}
            {montoReal > 0 && resumen && (
              <div style={{
                ...s.difBox,
                background: diferencia === 0 ? '#f0fdf4' : diferencia > 0 ? '#f0fdf4' : '#fdf0ef',
                border: `1px solid ${diferencia === 0 ? '#a9dfbf' : diferencia > 0 ? '#a9dfbf' : '#f5c6c6'}`,
              }}>
                <div style={s.difRow}>
                  <span style={s.difLabel}>Monto sistema</span>
                  <span>{fmt(resumen.totalSistema)}</span>
                </div>
                <div style={s.difRow}>
                  <span style={s.difLabel}>Monto real</span>
                  <span>{fmt(montoReal)}</span>
                </div>
                <div style={{...s.difRow, fontWeight:700, color: diferencia >= 0 ? '#1a7a4a' : '#c0392b'}}>
                  <span>Diferencia</span>
                  <span>{diferencia >= 0 ? '+' : ''}{fmt(diferencia)}</span>
                </div>
                {diferencia === 0 && <p style={s.difOk}>✓ Caja cuadrada perfectamente</p>}
                {diferencia > 0 && <p style={s.difPos}>Sobrante en caja</p>}
                {diferencia < 0 && <p style={s.difNeg}>Faltante en caja</p>}
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Observación (opcional)</label>
              <input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Ej: Turno sin novedades"
                style={s.input}
              />
            </div>

            <div style={s.aviso}>
              ⚠️ Esta acción cerrará la caja del turno. El vendedor no podrá emitir más tickets hasta que se abra una nueva caja.
            </div>

            <button
              onClick={cerrar}
              disabled={cerrando || !montoReal}
              style={{...s.cerrarBtn, opacity: !montoReal ? 0.4 : 1}}
            >
              {cerrando ? 'Cerrando caja…' : '🔒 Cerrar Caja'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', display:'flex', flexDirection:'column', background:'#f5f0ea', fontFamily:'system-ui,sans-serif' },
  nav: { background:'#2c1a08', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.55rem clamp(0.7rem, 3vw, 1.2rem)', minHeight:50, flexShrink:0, gap:'0.6rem', flexWrap:'wrap' },
  navLeft: { display:'flex', alignItems:'center', gap:'0.8rem' },
  navLogo: { width:30, height:30, background:'#b8732a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 },
  navTitulo: { fontSize:15, fontWeight:600 },
  navRight: { display:'flex', alignItems:'center', gap:'0.6rem' },
  navBack: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  navLogout: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  loading: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#8a7560', fontSize:14 },
  body: { display:'flex', flex:1, overflow:'auto', flexWrap:'wrap' },

  panelResumen: { width:'min(100%, 360px)' , background:'#fff', borderRight:'1px solid #e8e0d0', padding:'1.2rem', overflowY:'auto', flexShrink:0 },
  secTitulo: { margin:'0 0 1rem', fontSize:16, fontWeight:700, color:'#2c1a08' },
  resumenBox: { background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:12, padding:'1rem', display:'flex', flexDirection:'column', gap:8, marginBottom:'1rem' },
  resRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, color:'#4a3520' },
  resLabel: { color:'#4a3520', fontWeight:500 },
  resLabelSub: { color:'#8a7560', fontSize:12, paddingLeft:8 },
  resVal: { fontWeight:700, color:'#2c1a08' },
  resValSub: { color:'#8a7560', fontSize:12 },
  resRowTotal: { fontWeight:800, fontSize:15, color:'#2c1a08', paddingTop:4 },
  divider: { height:1, background:'#e8e0d0', margin:'4px 0' },
  statsGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' },
  statCard: { background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:10, padding:'0.8rem', textAlign:'center' },
  statNum: { display:'block', fontSize:24, fontWeight:800, color:'#b8732a' },
  statLabel: { fontSize:11, color:'#8a7560' },

  panelCierre: { flex:'1 1 420px', minWidth:'min(100%, 320px)' , padding:'1.5rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:'1rem', maxWidth:520 },
  cierreHint: { fontSize:13, color:'#6b4f2a', margin:0 },
  field: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:12, fontWeight:600, color:'#4a3520' },
  montoInput: { padding:'12px 14px', border:'2px solid #ddd0be', borderRadius:8, fontSize:20, outline:'none', background:'#fdfaf6', fontWeight:700 },
  input: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6' },
  difBox: { borderRadius:10, padding:'0.8rem 1rem', display:'flex', flexDirection:'column', gap:6 },
  difRow: { display:'flex', justifyContent:'space-between', fontSize:13, color:'#4a3520' },
  difLabel: { color:'#6b4f2a' },
  difOk: { margin:0, fontSize:12, color:'#1a7a4a', fontWeight:600 },
  difPos: { margin:0, fontSize:12, color:'#1a7a4a' },
  difNeg: { margin:0, fontSize:12, color:'#c0392b', fontWeight:600 },
  aviso: { fontSize:12, color:'#6b4f2a', background:'#fef9f0', border:'1px solid #f5e6cc', borderRadius:8, padding:'8px 12px' },
  error: { fontSize:12, color:'#c0392b', background:'#fdf0ef', borderRadius:6, padding:'6px 10px', margin:0 },
  cerrarBtn: { padding:'13px', background:'#c0392b', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' },

  cierreOkBox: { background:'#fff', border:'1px solid #a9dfbf', borderRadius:16, padding:'2rem', maxWidth:400, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem' },
  cierreOkIcon: { fontSize:48 },
  cierreOkTitulo: { margin:0, fontSize:22, fontWeight:700, color:'#2c1a08' },
  cierreOkSub: { margin:0, fontSize:13, color:'#6b4f2a' },
  cierreResumen: { width:'100%', background:'#faf7f2', borderRadius:10, padding:'1rem', display:'flex', flexDirection:'column', gap:6 },
  cierreRow: { display:'flex', justifyContent:'space-between', fontSize:13, color:'#4a3520' },
  cierreRowTotal: { fontWeight:700, fontSize:14, borderTop:'1px solid #e8e0d0', paddingTop:6, marginTop:4 },
  cierreRowDif: { fontWeight:800, fontSize:15 },
  salirBtn: { padding:'10px 28px', background:'#2c1a08', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:'0.5rem' },
}
