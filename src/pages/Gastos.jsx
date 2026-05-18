import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')
const parseFmt = (raw) => parseInt(raw.replace(/\D/g, '') || '0')

export default function Gastos() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { caja, limpiar } = useCajaStore()

  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Formulario
  const [categoriaId, setCategoriaId] = useState('')
  const [concepto, setConcepto] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precioRaw, setPrecioRaw] = useState('')
  const [observacion, setObservacion] = useState('')

  // Modal anulación
  const [anulando, setAnulando] = useState(null)
  const [motivo, setMotivo] = useState('')

  const precio = parseFmt(precioRaw)
  const cant = Math.max(1, parseInt(cantidad) || 1)
  const montoTotal = cant * precio

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const [resGastos, resCats] = await Promise.all([
        client.get('/gastos', { params: { apertura_caja_id: caja?.id, per_page: 100 } }),
        client.get('/categorias-gastos', { params: { per_page: 100 } }),
      ])
      setGastos(resGastos.data.data || resGastos.data)
      setCategorias(resCats.data.data || resCats.data)
    } catch (e) { console.error(e) }
  }

  const handlePrecio = (e) => {
    const val = e.target.value.replace(/\D/g, '')
    setPrecioRaw(val ? parseInt(val).toLocaleString('es-PY') : '')
  }

  const registrar = async (e) => {
    e.preventDefault()
    if (!concepto || !precio) return
    setCargando(true)
    setError('')
    setExito('')
    try {
      const conceptoFinal = cant > 1 ? `${concepto} (x${cant})` : concepto
      await client.post('/gastos', {
        categoria_gasto_id: categoriaId || null,
        concepto: conceptoFinal,
        monto: montoTotal,
        observacion: observacion || null,
      })
      setConcepto('')
      setCantidad('1')
      setPrecioRaw('')
      setObservacion('')
      setCategoriaId('')
      setExito('Gasto registrado correctamente')
      setTimeout(() => setExito(''), 3000)
      await cargarDatos()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al registrar gasto')
    } finally {
      setCargando(false)
    }
  }

  const anular = async () => {
    if (!motivo.trim()) return
    try {
      await client.post(`/gastos/${anulando.id}/anular`, { motivo })
      setAnulando(null)
      setMotivo('')
      await cargarDatos()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al anular')
    }
  }

  const totalActivos = gastos
    .filter((g) => g.estado === 'activo')
    .reduce((s, g) => s + parseFloat(g.monto), 0)

  const handleLogout = async () => {
    await logout(); limpiar()
    navigate('/login', { replace: true })
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>ÑG</div>
          <span style={s.navTitulo}>Gastos</span>
        </div>
        <div style={s.navRight}>
          <button onClick={() => navigate('/caja')} style={s.navBack}>← Caja</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      <div style={s.body}>
        {/* ── Formulario ── */}
        <div style={s.panelForm}>
          <h2 style={s.formTitulo}>Registrar gasto</h2>

          <form onSubmit={registrar} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Categoría</label>
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={s.input}>
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Concepto *</label>
              <input
                value={concepto} onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Pack de cubiertos"
                style={s.input} required
              />
            </div>

            <div style={s.rowFields}>
              <div style={{...s.field, flex:1}}>
                <label style={s.label}>Cantidad</label>
                <input
                  type="number" min="1" value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  style={s.input}
                />
              </div>
              <div style={{...s.field, flex:2}}>
                <label style={s.label}>Precio unitario (Gs.) *</label>
                <input
                  type="text" inputMode="numeric"
                  value={precioRaw}
                  onChange={handlePrecio}
                  placeholder="0"
                  style={s.input} required
                />
              </div>
            </div>

            {/* Preview del total */}
            {montoTotal > 0 && (
              <div style={s.totalPreview}>
                <span style={s.totalPreviewLabel}>
                  {cant} × {fmt(precio)} =
                </span>
                <span style={s.totalPreviewVal}>{fmt(montoTotal)}</span>
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Observación</label>
              <input
                value={observacion} onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
                style={s.input}
              />
            </div>

            {error && <p style={s.error}>{error}</p>}
            {exito && <p style={s.exito}>{exito}</p>}

            <button type="submit" disabled={cargando || !montoTotal} style={{...s.btn, opacity: !montoTotal ? 0.4 : 1}}>
              {cargando ? 'Registrando…' : `+ Registrar ${montoTotal ? fmt(montoTotal) : ''}`}
            </button>
          </form>

          <div style={s.resumen}>
            <div style={s.resumenRow}>
              <span>Total gastos del turno</span>
              <span style={s.resumenVal}>{fmt(totalActivos)}</span>
            </div>
            <div style={s.resumenRow}>
              <span>Cantidad</span>
              <span>{gastos.filter((g) => g.estado === 'activo').length} gastos</span>
            </div>
          </div>
        </div>

        {/* ── Lista ── */}
        <div style={s.panelLista}>
          <h2 style={s.listaTitulo}>Gastos del turno</h2>

          {gastos.length === 0 ? (
            <div style={s.vacio}>Sin gastos registrados en este turno</div>
          ) : (
            <div style={s.lista}>
              {gastos.map((g) => (
                <div key={g.id} style={{
                  ...s.gastoCard,
                  opacity: g.estado === 'anulado' ? 0.5 : 1,
                  background: g.estado === 'anulado' ? '#f9f9f9' : '#fff',
                }}>
                  <div style={s.gastoTop}>
                    <div style={s.gastoInfo}>
                      {g.categoria_gasto && (
                        <span style={s.gastoCat}>{g.categoria_gasto.nombre}</span>
                      )}
                      <span style={s.gastoConcepto}>{g.concepto}</span>
                      {g.observacion && <span style={s.gastoObs}>{g.observacion}</span>}
                    </div>
                    <div style={s.gastoRight}>
                      <span style={{
                        ...s.gastoMonto,
                        textDecoration: g.estado === 'anulado' ? 'line-through' : 'none',
                        color: g.estado === 'anulado' ? '#8a7560' : '#c0392b',
                      }}>
                        {fmt(g.monto)}
                      </span>
                      {g.estado === 'anulado' ? (
                        <span style={s.anulBadge}>Anulado</span>
                      ) : (
                        <button onClick={() => { setAnulando(g); setMotivo('') }} style={s.anularBtn}>
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={s.gastoFecha}>
                    {new Date(g.fecha_hora).toLocaleTimeString('es-PY', { hour:'2-digit', minute:'2-digit' })}
                    {' · '}{g.user?.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal anulación */}
      {anulando && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitulo}>Anular gasto</h3>
            <p style={s.modalSub}><strong>{anulando.concepto}</strong> · {fmt(anulando.monto)}</p>
            <div style={s.field}>
              <label style={s.label}>Motivo *</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Carga duplicada" style={s.input} autoFocus />
            </div>
            <div style={s.modalBtns}>
              <button onClick={() => setAnulando(null)} style={s.modalCancel}>Cancelar</button>
              <button onClick={anular} disabled={!motivo.trim()} style={s.modalConfirm}>
                Confirmar anulación
              </button>
            </div>
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
  navRight: { display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap', justifyContent:'flex-end' },
  navBack: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  navLogout: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  body: { display:'flex', flex:1, overflow:'auto', flexWrap:'wrap' },
  panelForm: { width:'min(100%, 420px)', background:'#fff', borderRight:'1px solid #e8e0d0', padding:'1.2rem', display:'flex', flexDirection:'column', gap:'1rem', flexShrink:0, overflowY:'auto' },
  formTitulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  form: { display:'flex', flexDirection:'column', gap:'0.8rem' },
  field: { display:'flex', flexDirection:'column', gap:4 },
  rowFields: { display:'flex', gap:'0.6rem', alignItems:'flex-end', flexWrap:'wrap' },
  label: { fontSize:12, fontWeight:600, color:'#4a3520' },
  input: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6', width:'100%', boxSizing:'border-box' },
  totalPreview: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fef9f0', border:'1px solid #f5e6cc', borderRadius:8, padding:'8px 12px' },
  totalPreviewLabel: { fontSize:13, color:'#6b4f2a' },
  totalPreviewVal: { fontSize:16, fontWeight:800, color:'#b8732a' },
  error: { fontSize:12, color:'#c0392b', background:'#fdf0ef', borderRadius:6, padding:'6px 10px', margin:0 },
  exito: { fontSize:12, color:'#1a7a4a', background:'#f0fdf4', border:'1px solid #a9dfbf', borderRadius:6, padding:'6px 10px', margin:0 },
  btn: { padding:'10px', background:'#b8732a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
  resumen: { background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:10, padding:'0.8rem', marginTop:'auto', display:'flex', flexDirection:'column', gap:6 },
  resumenRow: { display:'flex', justifyContent:'space-between', fontSize:13, color:'#4a3520' },
  resumenVal: { fontWeight:700, color:'#c0392b' },
  panelLista: { flex:'1 1 480px', minWidth:'min(100%, 320px)' , display:'flex', flexDirection:'column', padding:'1.2rem', overflow:'hidden' },
  listaTitulo: { margin:'0 0 0.8rem', fontSize:16, fontWeight:700, color:'#2c1a08' },
  vacio: { color:'#8a7560', fontSize:13, textAlign:'center', marginTop:'3rem' },
  lista: { overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'0.5rem' },
  gastoCard: { border:'1px solid #e8e0d0', borderRadius:10, padding:'0.8rem 1rem' },
  gastoTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.8rem', flexWrap:'wrap' },
  gastoInfo: { display:'flex', flexDirection:'column', gap:2 },
  gastoCat: { fontSize:10, background:'#f0e8dc', color:'#6b4f2a', borderRadius:4, padding:'1px 6px', fontWeight:600, alignSelf:'flex-start' },
  gastoConcepto: { fontSize:14, fontWeight:600, color:'#2c1a08' },
  gastoObs: { fontSize:11, color:'#8a7560' },
  gastoRight: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 },
  gastoMonto: { fontSize:15, fontWeight:700 },
  anulBadge: { fontSize:10, background:'#f5f5f5', color:'#8a7560', borderRadius:4, padding:'2px 6px', fontWeight:600 },
  anularBtn: { background:'transparent', border:'1px solid #f5c6c6', color:'#c0392b', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer' },
  gastoFecha: { fontSize:11, color:'#8a7560', marginTop:4 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'clamp(0.5rem, 3vw, 1rem)', boxSizing:'border-box' },
  modal: { background:'#fff', borderRadius:14, padding:'clamp(1rem, 4vw, 1.5rem)', width:'100%', maxWidth:380, boxSizing:'border-box', display:'flex', flexDirection:'column', gap:'0.8rem' },
  modalTitulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  modalSub: { margin:0, fontSize:13, color:'#4a3520' },
  modalBtns: { display:'flex', gap:'0.6rem', justifyContent:'flex-end', flexWrap:'wrap' },
  modalCancel: { padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 },
  modalConfirm: { padding:'8px 16px', background:'#c0392b', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 },
}
