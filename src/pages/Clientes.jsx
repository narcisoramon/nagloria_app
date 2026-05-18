import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')

export default function Clientes() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { limpiar } = useCajaStore()

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [clienteSel, setClienteSel] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  // Pago
  const [monto, setMonto] = useState('')
  const [formaPago, setFormaPago] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [pagando, setPagando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const [clientesDeudores, setClientesDeudores] = useState([])
  const [cargandoDeudores, setCargandoDeudores] = useState(false)

  const timerRef = useRef(null)

  useEffect(() => { cargarDeudores() }, [])

  const cargarDeudores = async () => {
    setCargandoDeudores(true)
    try {
      const { data } = await client.get('/clientes/con-saldo')
      setClientesDeudores(data.data || data)
    } catch (e) { console.error(e) }
    finally { setCargandoDeudores(false) }
  }

  const buscar = (texto) => {
    setBusqueda(texto)
    clearTimeout(timerRef.current)
    if (!texto.trim()) { setResultados([]); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await client.get('/clientes', { params: { buscar: texto, per_page: 10 } })
        setResultados(data.data || data)
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
  }

  const seleccionar = async (cli) => {
    setClienteSel(cli)
    setResultados([])
    setBusqueda('')
    setError('')
    setExito('')
    setMonto('')
    setCargandoDet(true)
    try {
      const { data } = await client.get(`/clientes/${cli.id}`)
      const cliente = data.data || data

      // Calcular saldo actual desde cuenta corriente
      const resCuenta = await client.get('/pago-clientes', {
        params: { cliente_id: cli.id, per_page: 1 }
      })

      // Obtener último saldo de cuenta corriente
      const resCuenta2 = await client.get('/tickets', {
        params: { cliente_id: cli.id, tipo_venta: 'credito', per_page: 200 }
      })

      setDetalle(cliente)
    } catch (e) { console.error(e) }
    finally { setCargandoDet(false) }
  }

  // Calcular saldo de cuenta corriente del cliente
  const saldoCC = detalle?.cuenta_corriente?.length > 0
    ? parseFloat(detalle.cuenta_corriente[detalle.cuenta_corriente.length - 1].saldo_actual)
    : 0

  const montoNum = parseInt(String(monto).replace(/\D/g, '') || '0')

  const registrarPago = async () => {
    if (!montoNum || montoNum <= 0) { setError('Ingresá un monto válido'); return }
    if (montoNum > saldoCC) { setError('El monto no puede superar el saldo pendiente'); return }
    setPagando(true)
    setError('')
    try {
      await client.post('/pago-clientes', {
        cliente_id: clienteSel.id,
        monto: montoNum,
        forma_pago: formaPago,
        referencia: referencia || null,
      })
      setExito(`Pago de ${fmt(montoNum)} registrado correctamente`)
      setMonto('')
      setReferencia('')
      setTimeout(() => setExito(''), 4000)
      // Recargar detalle y lista de deudores
      const { data } = await client.get(`/clientes/${clienteSel.id}`)
      setDetalle(data.data || data)
      cargarDeudores()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al registrar el pago')
    } finally {
      setPagando(false)
    }
  }

  const handleLogout = async () => {
    await logout(); limpiar()
    navigate('/login', { replace: true })
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>ÑG</div>
          <span style={s.navTitulo}>Clientes</span>
        </div>
        <div style={s.navRight}>
          <button onClick={() => navigate('/caja')} style={s.navBack}>← Caja</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      <div style={s.body}>
        {/* ── Panel izquierdo: buscador ── */}
        <div style={s.panelLeft}>
          <h2 style={s.secTitulo}>Buscar cliente</h2>

          <div style={s.buscadorBox}>
            <input
              type="text" value={busqueda} onChange={(e) => buscar(e.target.value)}
              placeholder="Nombre, CI o teléfono…"
              style={s.buscadorInput}
              autoFocus
            />
            {buscando && <p style={s.hint}>Buscando…</p>}
            {!buscando && busqueda && resultados.length === 0 && (
              <p style={s.hint}>Sin resultados</p>
            )}
            {resultados.map((c) => (
              <button key={c.id} onClick={() => seleccionar(c)} style={s.resultBtn}>
                <span style={s.resultNombre}>{c.nombre}</span>
                <span style={s.resultDoc}>{c.documento ? `CI: ${c.documento}` : c.telefono || ''}</span>
              </button>
            ))}
          </div>

          {/* Lista de deudores */}
          {!clienteSel && (
            <div style={s.deudoresBox}>
              <div style={s.deudoresHeader}>
                <span style={s.deudoresTitulo}>Con saldo pendiente</span>
                <button onClick={cargarDeudores} style={s.refreshBtn} title="Actualizar">↻</button>
              </div>
              {cargandoDeudores ? (
                <p style={s.hint}>Cargando…</p>
              ) : clientesDeudores.length === 0 ? (
                <p style={s.hint}>Sin clientes con deuda</p>
              ) : (
                clientesDeudores.map((c) => (
                  <button key={c.id} onClick={() => seleccionar(c)} style={s.deudorBtn}>
                    <span style={s.deudorNombre}>{c.nombre}</span>
                    <span style={s.deudorSaldo}>{fmt(c.saldo)}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {clienteSel && (
            <div style={s.clienteSelBox}>
              <div style={s.clienteSelInfo}>
                <span style={s.clienteSelNombre}>{clienteSel.nombre}</span>
                {clienteSel.documento && <span style={s.clienteSelDoc}>CI: {clienteSel.documento}</span>}
                {clienteSel.telefono && <span style={s.clienteSelDoc}>📞 {clienteSel.telefono}</span>}
              </div>
              <button onClick={() => { setClienteSel(null); setDetalle(null) }} style={s.limpiarBtn}>✕</button>
            </div>
          )}

          {/* Saldo cuenta corriente */}
          {clienteSel && !cargandoDet && (
            <div style={{
              ...s.saldoBox,
              background: saldoCC > 0 ? '#fdf0ef' : '#f0fdf4',
              border: `1px solid ${saldoCC > 0 ? '#f5c6c6' : '#a9dfbf'}`,
            }}>
              <span style={s.saldoLabel}>Saldo en cuenta corriente</span>
              <span style={{
                ...s.saldoVal,
                color: saldoCC > 0 ? '#c0392b' : '#1a7a4a'
              }}>
                {fmt(saldoCC)}
              </span>
              {saldoCC === 0 && <span style={s.saldoOk}>✓ Sin deuda pendiente</span>}
            </div>
          )}
        </div>

        {/* ── Panel derecho: pago y movimientos ── */}
        <div style={{...s.panelRight, overflow:'hidden', display:'flex', flexDirection:'column'}}>
          {!clienteSel ? (
            <div style={s.sinSeleccion}>
              <p>👈 Buscá y seleccioná un cliente</p>
            </div>
          ) : cargandoDet ? (
            <div style={s.sinSeleccion}><p>Cargando…</p></div>
          ) : (
            <>
              {/* Formulario de pago */}
              {saldoCC > 0 && (
                <div style={s.pagoBox}>
                  <h3 style={s.pagoTitulo}>Registrar pago</h3>

                  <div style={s.pagoOpts}>
                    {[
                      { val:'efectivo', label:'💵 Efectivo' },
                      { val:'tarjeta', label:'💳 Tarjeta' },
                      { val:'transferencia', label:'🏦 Transferencia' },
                    ].map((o) => (
                      <button key={o.val}
                        style={{...s.pagoBtn, ...(formaPago===o.val ? s.pagoBtnOn : {})}}
                        onClick={() => setFormaPago(o.val)}>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Monto (Gs.) *</label>
                    <input
                      type="text" inputMode="numeric"
                      value={monto}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setMonto(val ? parseInt(val).toLocaleString('es-PY') : '')
                      }}
                      placeholder="0"
                      style={s.montoInput}
                    />
                    <div style={s.montoBtns}>
                      <button onClick={() => setMonto(Math.round(saldoCC).toLocaleString('es-PY'))} style={s.montoBtn}>
                        Pago total ({fmt(saldoCC)})
                      </button>
                    </div>
                  </div>

                  {formaPago !== 'efectivo' && (
                    <div style={s.field}>
                      <label style={s.label}>Referencia</label>
                      <input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                        placeholder="N° comprobante" style={s.input} />
                    </div>
                  )}

                  {error && <p style={s.error}>{error}</p>}
                  {exito && <p style={s.exito}>{exito}</p>}

                  <button onClick={registrarPago} disabled={pagando || !montoNum}
                    style={{...s.pagarBtn, opacity: !montoNum ? 0.4 : 1}}>
                    {pagando ? 'Registrando…' : `✓ Registrar pago ${montoNum ? fmt(montoNum) : ''}`}
                  </button>
                </div>
              )}

              {saldoCC === 0 && (
                <div style={s.sinDeuda}>
                  <span style={s.sinDeudaIcon}>✓</span>
                  <p>Este cliente no tiene deuda pendiente</p>
                </div>
              )}

              {/* Historial cuenta corriente */}
              {detalle?.cuenta_corriente?.length > 0 && (
                <div style={s.histBox}>
                  <h3 style={s.histTitulo}>Historial cuenta corriente</h3>
                  <div style={s.histLista}>
                    {[...detalle.cuenta_corriente].reverse().map((m) => (
                      <div key={m.id} style={s.movRow}>
                        <div style={s.movInfo}>
                          <span style={{
                            ...s.movTipo,
                            background: m.tipo_movimiento === 'DEBITO' ? '#fdf0ef' : '#f0fdf4',
                            color: m.tipo_movimiento === 'DEBITO' ? '#c0392b' : '#1a7a4a',
                          }}>
                            {m.tipo_movimiento === 'DEBITO' ? '↑ Débito' : '↓ Crédito'}
                          </span>
                          <span style={s.movConcepto}>{m.concepto}</span>
                          <span style={s.movFecha}>
                            {new Date(m.fecha_hora).toLocaleDateString('es-PY')}
                          </span>
                        </div>
                        <div style={s.movRight}>
                          <span style={{
                            fontSize:13, fontWeight:700,
                            color: m.tipo_movimiento === 'DEBITO' ? '#c0392b' : '#1a7a4a'
                          }}>
                            {m.tipo_movimiento === 'DEBITO' ? '+' : '−'} {fmt(m.monto)}
                          </span>
                          <span style={s.movSaldo}>Saldo: {fmt(m.saldo_actual)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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

  panelLeft: { width:'min(100%, 420px)', background:'#fff', borderRight:'1px solid #e8e0d0', padding:'1.2rem', display:'flex', flexDirection:'column', gap:'0.8rem', flexShrink:0, overflowY:'auto' },
  secTitulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  buscadorBox: { display:'flex', flexDirection:'column', gap:4 },
  buscadorInput: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6' },
  hint: { fontSize:12, color:'#8a7560', margin:'4px 0 0' },
  resultBtn: { width:'100%', boxSizing:'border-box', background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:8, padding:'8px 10px', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:2 },
  resultNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  resultDoc: { fontSize:11, color:'#8a7560' },
  clienteSelBox: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fef9f0', border:'1px solid #f5e6cc', borderRadius:8, padding:'8px 10px' },
  clienteSelInfo: { display:'flex', flexDirection:'column', gap:2 },
  clienteSelNombre: { fontSize:14, fontWeight:700, color:'#2c1a08' },
  clienteSelDoc: { fontSize:11, color:'#6b4f2a' },
  limpiarBtn: { background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:16 },
  saldoBox: { borderRadius:10, padding:'0.8rem 1rem', display:'flex', flexDirection:'column', gap:4 },
  saldoLabel: { fontSize:11, fontWeight:600, color:'#4a3520', textTransform:'uppercase', letterSpacing:'0.06em' },
  saldoVal: { fontSize:22, fontWeight:800 },
  saldoOk: { fontSize:12, color:'#1a7a4a' },

  deudoresBox: { display:'flex', flexDirection:'column', gap:4, flex:1, overflowY:'auto' },
  deudoresHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  deudoresTitulo: { fontSize:12, fontWeight:700, color:'#4a3520', textTransform:'uppercase', letterSpacing:'0.06em' },
  refreshBtn: { background:'transparent', border:'none', fontSize:16, cursor:'pointer', color:'#8a7560' },
  deudorBtn: { width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fdf0ef', border:'1px solid #f5c6c6', borderRadius:8, padding:'8px 10px', cursor:'pointer', textAlign:'left' },
  deudorNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  deudorSaldo: { fontSize:13, fontWeight:700, color:'#c0392b' },
  panelRight: { flex:'1 1 520px', minWidth:'min(100%, 320px)' },
  sinSeleccion: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#8a7560', fontSize:14 },
  sinDeuda: { display:'flex', flexDirection:'column', alignItems:'center', padding:'2rem', color:'#1a7a4a' },
  sinDeudaIcon: { fontSize:40, marginBottom:'0.5rem' },
  histBox: { flex:1, overflowY:'auto', padding:'1.2rem' },

  pagoBox: { background:'#fff', borderBottom:'1px solid #e8e0d0', padding:'1.2rem', display:'flex', flexDirection:'column', gap:'0.8rem' },
  pagoTitulo: { margin:0, fontSize:15, fontWeight:700, color:'#2c1a08' },
  pagoOpts: { display:'flex', gap:'0.5rem', flexWrap:'wrap' },
  pagoBtn: { padding:'7px 12px', border:'1px solid #ddd0be', borderRadius:7, background:'#faf7f2', cursor:'pointer', fontSize:12, fontWeight:500, color:'#4a3520' },
  pagoBtnOn: { background:'#b8732a', color:'#fff', border:'1px solid #b8732a' },
  field: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:12, fontWeight:600, color:'#4a3520' },
  montoInput: { padding:'10px 14px', border:'2px solid #ddd0be', borderRadius:8, fontSize:18, outline:'none', background:'#fdfaf6', fontWeight:700 },
  montoBtns: { display:'flex', gap:'0.4rem', marginTop:4, flexWrap:'wrap' },
  montoBtn: { padding:'4px 10px', background:'#f0e8dc', border:'1px solid #ddd0be', borderRadius:6, fontSize:11, cursor:'pointer', color:'#4a3520' },
  input: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6' },
  error: { fontSize:12, color:'#c0392b', background:'#fdf0ef', borderRadius:6, padding:'6px 10px', margin:0 },
  exito: { fontSize:12, color:'#1a7a4a', background:'#f0fdf4', border:'1px solid #a9dfbf', borderRadius:6, padding:'6px 10px', margin:0 },
  pagarBtn: { padding:'11px', background:'#1a7a4a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' },

  histBox: { padding:'1.2rem', overflowY:'auto' },
  histTitulo: { margin:'0 0 0.8rem', fontSize:15, fontWeight:700, color:'#2c1a08' },
  histLista: { display:'flex', flexDirection:'column', gap:'0.4rem' },
  movRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.8rem', flexWrap:'wrap', background:'#fff', border:'1px solid #e8e0d0', borderRadius:8, padding:'0.6rem 0.8rem' },
  movInfo: { display:'flex', flexDirection:'column', gap:2 },
  movTipo: { fontSize:10, fontWeight:700, borderRadius:4, padding:'1px 6px', alignSelf:'flex-start' },
  movConcepto: { fontSize:13, color:'#2c1a08' },
  movFecha: { fontSize:11, color:'#8a7560' },
  movRight: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 },
  movSaldo: { fontSize:11, color:'#8a7560' },
}
