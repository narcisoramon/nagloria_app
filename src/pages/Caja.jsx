import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import { ticketsApi } from '../api/tickets'
import { productosApi } from '../api/productos'
import { getErrorMessage } from '../api/client'
import client from '../api/client'
import logger from '../utils/logger'
import { noti, confirmar } from '../utils/alertify'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')
const mins = (ts) => Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
const semaforoColor = (m) => m < 5 ? '#1a7a4a' : m < 10 ? '#b36a00' : '#c0392b'
const semaforoBg = (m) => m < 5 ? '#f0fdf4' : m < 10 ? '#fffbf0' : '#fff5f5'
const semaforoBorder = (m) => m < 5 ? '#a9dfbf' : m < 10 ? '#ffe8a1' : '#f5c6c6'

export default function Caja() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { caja, limpiar } = useCajaStore()

  const [tickets, setTickets] = useState([])
  const [ticketSel, setTicketSel] = useState(null)
  const [productos, setProductos] = useState([])
  const [extras, setExtras] = useState([])
  const [formaPago, setFormaPago] = useState('efectivo')
  const [montoPagado, setMontoPagado] = useState('')
  const [modalCliente, setModalCliente] = useState(false)
  const [formCliente, setFormCliente] = useState({ nombre:'', documento:'', telefono:'', direccion:'' })
  const [guardandoCli, setGuardandoCli] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date())

  const [modalAnular, setModalAnular] = useState(false)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [anulando, setAnulando] = useState(false)

  const confirmarAnular = async () => {
    if (!motivoAnular.trim()) return
    setAnulando(true)
    try {
      await ticketsApi.anular(ticketSel.id, motivoAnular)
      setModalAnular(false)
      setMotivoAnular('')
      setTicketSel(null)
      await cargarTickets()
    } catch (e) {
      noti('error', getErrorMessage(e))
    } finally {
      setAnulando(false)
    }
  }

  const cargarTickets = useCallback(async () => {
    try {
      const { data } = await ticketsApi.listar({ estado: 'pendiente', per_page: 50 })
      setTickets(data.data || data)
      setUltimaActualizacion(new Date())
    } catch (e) { logger.error('Error cargando tickets') }
  }, [])

  useEffect(() => {
    const idPoll = setInterval(cargarTickets, 5000)
    return () => clearInterval(idPoll)
  }, [cargarTickets])

  useEffect(() => {
    cargarTickets()
    productosApi.listar({ activo: 1, per_page: 100 }).then(({ data }) => {
      setProductos(data.data || data)
    })
  }, [cargarTickets])

  const guardarCliente = async () => {
    if (!formCliente.nombre) { noti('error', 'El nombre es requerido'); return }
    setGuardandoCli(true)
    try {
      await client.post('/clientes', { ...formCliente, activo: true })
      setModalCliente(false)
      setFormCliente({ nombre:'', documento:'', telefono:'', direccion:'' })
      noti('success', 'Cliente creado correctamente')
    } catch (e) {
      noti('error', getErrorMessage(e))
    } finally {
      setGuardandoCli(false)
    }
  }

  const seleccionar = (t) => {
    setTicketSel(t); setExtras([]); setFormaPago('efectivo'); setMontoPagado('')
  }

  const agregarExtra = (prod) => {
    setExtras((prev) => {
      const idx = prev.findIndex((x) => x.prod_id === prod.id)
      if (idx >= 0) {
        const n = [...prev]
        n[idx] = { ...n[idx], cantidad: n[idx].cantidad + 1, subtotal: (n[idx].cantidad + 1) * parseFloat(prod.precio) }
        return n
      }
      return [...prev, { prod_id: prod.id, producto: prod, cantidad: 1, subtotal: parseFloat(prod.precio) }]
    })
  }

  const quitarExtra = (prod_id) => setExtras((prev) => prev.filter((x) => x.prod_id !== prod_id))

  const totalBase = ticketSel ? parseFloat(ticketSel.total) : 0
  const totalExtras = extras.reduce((s, e) => s + e.subtotal, 0)
  const totalFinal = totalBase + totalExtras

  const cobrar = async () => {
    if (!ticketSel) return
    const monto = parseFloat(montoPagado || totalFinal)
    if (formaPago !== 'credito' && monto < totalFinal) { noti('error', 'El monto pagado no cubre el total'); return }
    if (formaPago === 'credito' && !ticketSel.cliente_id) { noti('error', 'Para cuenta corriente el ticket debe tener cliente'); return }
    setCargando(true)
    try {
      const pagos = formaPago !== 'credito' ? [{ forma_pago: formaPago, monto: totalBase }] : []
      await ticketsApi.cobrar(ticketSel.id, {
        tipo_venta: formaPago === 'credito' ? 'credito' : 'contado',
        forma_pago: formaPago,
        cliente_id: ticketSel.cliente_id || null,
        pagos,
      })
      if (extras.length > 0) {
        const pagosExtras = formaPago !== 'credito' ? [{ forma_pago: formaPago, monto: totalExtras }] : []
        await ticketsApi.crear({
          cliente_id: ticketSel.cliente_id || null,
          tipo_venta: formaPago === 'credito' ? 'credito' : 'contado',
          forma_pago: formaPago,
          descuento: 0,
          items: extras.map((e) => ({ producto_id: e.prod_id, cantidad: e.cantidad })),
          pagos: pagosExtras,
        })
      }
      noti('success', `Ticket #${ticketSel.numero_ticket} cobrado correctamente`)
      setTicketSel(null); setExtras([]); setFormaPago('efectivo'); setMontoPagado('')
      await cargarTickets()
    } catch (e) {
      const data = e.response?.data
      if (data?.credito_disponible !== undefined) {
        const fmt2 = (n) => Math.round(n).toLocaleString('es-PY')
        noti('error',
          `Crédito insuficiente — Límite: Gs. ${fmt2(data.limite_credito)} · Saldo: Gs. ${fmt2(data.saldo_actual)} · Disponible: Gs. ${fmt2(data.credito_disponible)}`
        )
      } else {
        noti('error', getErrorMessage(e))
      }
    } finally {
      setCargando(false)
    }
  }

  const handleLogout = async () => { await logout(); limpiar(); navigate('/login', { replace: true }) }

  const ticketsFiltrados = filtro.trim()
    ? tickets.filter((t) => t.numero_ticket?.includes(filtro.trim()))
    : tickets

  const prodUnidad = productos.filter((p) => p.tipo_venta === 'UNIDAD' && Boolean(p.usar_como_extra))

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>LG</div>
          <span style={s.navTitulo}>Caja</span>
          {caja && <span style={s.navCaja}>Caja #{caja.id} · {user?.name}</span>}
        </div>
        <div style={s.navRight}>
          <button onClick={() => setModalCliente(true)} style={s.navCierre}>👤+ Cliente</button>
          <button onClick={() => navigate('/clientes')} style={s.navCierre}>👥 Clientes</button>
          <button onClick={() => navigate('/gastos')} style={s.navCierre}>💸 Gastos</button>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/configuracion')} style={s.navCierre}>⚙️ Config</button>
          )}
          <button onClick={() => navigate('/cierre-caja')} style={s.navCierre}>Cerrar caja</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      <div style={s.body}>
        <div style={s.panelLeft}>
          <div style={s.panelHeader}>
            <div>
              <h2 style={s.panelTitulo}>⏳ Pendientes <span style={s.badge}>{tickets.length}</span></h2>
              <p style={s.ultimaAct}>↻ {ultimaActualizacion.toLocaleTimeString('es-PY', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</p>
            </div>
            <button onClick={cargarTickets} style={s.refreshBtn} title="Refrescar">↻</button>
          </div>
          {tickets.length > 0 && (
            <div style={s.totalPendBox}>
              <span style={s.totalPendLabel}>Total pendiente</span>
              <span style={s.totalPendVal}>{fmt(tickets.reduce((a, t) => a + parseFloat(t.total), 0))}</span>
            </div>
          )}
          <div style={s.filtroBox}>
            <input type="text" value={filtro} onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por N° ticket…" style={s.filtroInput} />
          </div>
          {ticketsFiltrados.length === 0 ? (
            <div style={s.sinTickets}>{filtro ? 'Sin resultados' : 'Sin tickets pendientes'}</div>
          ) : (
            <div style={s.ticketList}>
              {ticketsFiltrados.map((t) => {
                const m = mins(t.fecha_hora)
                const selec = ticketSel?.id === t.id
                return (
                  <button key={t.id} onClick={() => seleccionar(t)}
                    style={{...s.ticketCard, background: selec ? '#fef9f0' : semaforoBg(m), border: `1px solid ${selec ? '#b8732a' : semaforoBorder(m)}`}}>
                    <div style={s.ticketCardTop}>
                      <span style={{...s.ticketNum, color: semaforoColor(m)}}>#{t.numero_ticket}</span>
                      <span style={{...s.ticketMins, color: semaforoColor(m)}}>{m}&nbsp;min</span>
                    </div>
                    <div style={s.ticketCardBot}>
                      <span style={s.ticketCliente}>{t.cliente?.nombre || 'Cliente casual'}</span>
                      <span style={s.ticketTotal}>{fmt(t.total)}</span>
                    </div>
                    <div style={s.ticketItems}>
                      {t.detalles?.slice(0, 2).map((d, i) => (
                        <span key={i} style={s.ticketItem}>{d.descripcion}</span>
                      ))}
                      {t.detalles?.length > 2 && <span style={s.ticketItem}>+{t.detalles.length - 2} más</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={s.panelRight}>
          {!ticketSel ? (
            <div style={s.sinSeleccion}><p>👆 Seleccioná un ticket para cobrar</p></div>
          ) : (
            <>
              <div style={s.detHeader}>
                <div>
                  <span style={s.detNum}>#{ticketSel.numero_ticket}</span>
                  {ticketSel.cliente && <span style={s.detCliente}> · {ticketSel.cliente.nombre}</span>}
                </div>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                  <button onClick={() => { setModalAnular(true); setMotivoAnular('') }} style={s.anularBtn}>
                    🗑 Anular
                  </button>
                  <button onClick={() => setTicketSel(null)} style={s.cerrarBtn}>✕</button>
                </div>
              </div>
              <div style={s.detBody}>
                <p style={s.secLabel}>Del mostrador</p>
                {ticketSel.detalles?.map((d, i) => (
                  <div key={i} style={s.detItem}>
                    <div style={s.detItemInfo}>
                      <span style={s.detItemNombre}>{d.descripcion}</span>
                      <span style={s.detItemDet}>
                        {d.tipo_venta === 'KILO'
                          ? `${parseFloat(d.peso_neto_kg).toFixed(3)}kg × ${fmt(d.precio_unitario)}/kg`
                          : `${parseFloat(d.cantidad)} und × ${fmt(d.precio_unitario)}`}
                      </span>
                    </div>
                    <span style={s.detItemSub}>{fmt(d.subtotal)}</span>
                  </div>
                ))}
                {extras.length > 0 && (
                  <>
                    <p style={{...s.secLabel, marginTop:'0.8rem'}}>Extras en caja</p>
                    {extras.map((e) => (
                      <div key={e.prod_id} style={s.detItem}>
                        <div style={s.detItemInfo}>
                          <span style={s.detItemNombre}>{e.producto.nombre}</span>
                          <span style={s.detItemDet}>{e.cantidad} und × {fmt(e.producto.precio)}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={s.detItemSub}>{fmt(e.subtotal)}</span>
                          <button onClick={() => quitarExtra(e.prod_id)} style={s.quitarBtn}>✕</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <p style={{...s.secLabel, marginTop:'0.8rem'}}>Agregar extras</p>
                <div style={s.extrasGrid}>
                  {prodUnidad.slice(0, 12).map((p) => (
                    <button key={p.id} style={s.extraBtn} onClick={() => agregarExtra(p)}>
                      <span style={s.extraNombre}>{p.nombre}</span>
                      <span style={s.extraPrecio}>{fmt(p.precio)}</span>
                    </button>
                  ))}
                </div>
                <div style={s.totalBox}>
                  {extras.length > 0 && <>
                    <div style={s.totalRow}><span style={s.totalSub}>Subtotal mostrador</span><span style={s.totalSub}>{fmt(totalBase)}</span></div>
                    <div style={s.totalRow}><span style={s.totalSub}>Extras</span><span style={s.totalSub}>{fmt(totalExtras)}</span></div>
                  </>}
                  <div style={{...s.totalRow, ...s.totalFinalRow}}><span>TOTAL A COBRAR</span><span>{fmt(totalFinal)}</span></div>
                </div>
                <p style={s.secLabel}>Forma de pago</p>
                <div style={s.pagoOpts}>
                  {[{val:'efectivo',label:'💵 Efectivo'},{val:'tarjeta',label:'💳 Tarjeta'},{val:'transferencia',label:'🏦 Transferencia'},{val:'credito',label:'📋 Cuenta corriente'}].map((o) => (
                    <button key={o.val} style={{...s.pagoBtn, ...(formaPago===o.val ? s.pagoBtnOn : {})}}
                      onClick={() => { setFormaPago(o.val); setMontoPagado('') }}>{o.label}</button>
                  ))}
                </div>
                {formaPago !== 'credito' && (
                  <div style={s.montoField}>
                    <label style={s.secLabel}>Monto recibido (Gs.)</label>
                    <input type="number" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)}
                      placeholder={Math.round(totalFinal).toString()} style={s.montoInput} />
                    {montoPagado && parseFloat(montoPagado) >= totalFinal && (
                      <p style={s.vueltaText}>Vuelto: {fmt(parseFloat(montoPagado) - totalFinal)}</p>
                    )}
                  </div>
                )}
              </div>
              <div style={s.detFooter}>
                <button onClick={cobrar} disabled={cargando} style={s.cobrarBtn}>
                  {cargando ? 'Procesando…' : `✓ Cobrar ${fmt(totalFinal)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {modalAnular && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>🗑 Anular ticket #{ticketSel?.numero_ticket}</h3>
              <button onClick={() => setModalAnular(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}>
              <p style={{ margin:0, fontSize:13, color:'#4a3520' }}>
                Total: <strong>{fmt(ticketSel?.total)}</strong>
                {ticketSel?.cliente && <> · Cliente: <strong>{ticketSel.cliente.nombre}</strong></>}
              </p>
              <div style={s.modalField}>
                <label style={s.modalLabel}>Motivo de anulación *</label>
                <input
                  value={motivoAnular}
                  onChange={(e) => setMotivoAnular(e.target.value)}
                  placeholder="Ej: Cliente no retiró el pedido"
                  style={s.modalInput}
                  autoFocus
                />
              </div>
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalAnular(false)} style={s.modalCancel}>Cancelar</button>
              <button onClick={confirmarAnular} disabled={anulando || !motivoAnular.trim()}
                style={{ ...s.modalConfirm, background:'#c0392b', opacity: !motivoAnular.trim() ? 0.4 : 1 }}>
                {anulando ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCliente && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Registrar cliente</h3>
              <button onClick={() => setModalCliente(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}>
              {[
                {label:'Nombre *', key:'nombre', placeholder:'Juan Pérez'},
                {label:'CI / Documento', key:'documento', placeholder:'1234567'},
                {label:'Teléfono', key:'telefono', placeholder:'0981123456'},
                {label:'Dirección', key:'direccion', placeholder:'Opcional'},
              ].map((f) => (
                <div key={f.key} style={s.modalField}>
                  <label style={s.modalLabel}>{f.label}</label>
                  <input value={formCliente[f.key]} onChange={(e) => setFormCliente({...formCliente, [f.key]: e.target.value})}
                    placeholder={f.placeholder} style={s.modalInput} />
                </div>
              ))}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalCliente(false)} style={s.modalCancel}>Cancelar</button>
              <button onClick={guardarCliente} disabled={guardandoCli} style={s.modalConfirm}>
                {guardandoCli ? 'Guardando…' : 'Guardar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { height:'100vh', display:'flex', flexDirection:'column', background:'#f5f0ea', fontFamily:'system-ui,sans-serif', overflow:'hidden' },
  nav: { background:'#2c1a08', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.55rem clamp(0.7rem, 3vw, 1.2rem)', minHeight:50, flexShrink:0, gap:'0.6rem', flexWrap:'wrap' },
  navLeft: { display:'flex', alignItems:'center', gap:'0.8rem', flexWrap:'wrap' },
  navLogo: { width:30, height:30, background:'#b8732a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 },
  navTitulo: { fontSize:15, fontWeight:600 },
  navCaja: { fontSize:12, color:'#c9b99a', background:'rgba(255,255,255,0.1)', padding:'2px 8px', borderRadius:6 },
  navRight: { display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', justifyContent:'flex-end' },
  navCierre: { background:'transparent', border:'1px solid #c0392b', color:'#f5c6c6', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  navLogout: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  body: { display:'flex', flex:1, overflow:'hidden', minHeight:0, height:'calc(100vh - 50px)', flexWrap:'nowrap' },
  panelLeft: { width:'min(100%, 420px)', background:'#fff', borderRight:'1px solid #e8e0d0', display:'flex', flexDirection:'column', flexShrink:0, minHeight:0, height:'100%', overflow:'hidden' },
  panelHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.8rem 1rem', borderBottom:'1px solid #f0e8dc', flexShrink:0 },
  panelTitulo: { margin:'0 0 2px', fontSize:15, fontWeight:700, color:'#2c1a08' },
  badge: { background:'#b8732a', color:'#fff', fontSize:11, fontWeight:700, borderRadius:10, padding:'1px 7px', marginLeft:6 },
  ultimaAct: { margin:0, fontSize:10, color:'#8a7560' },
  refreshBtn: { background:'transparent', border:'none', fontSize:18, cursor:'pointer', color:'#8a7560' },
  totalPendBox: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 1rem', background:'#fef9f0', borderBottom:'1px solid #f5e6cc', flexShrink:0 },
  totalPendLabel: { fontSize:11, fontWeight:600, color:'#6b4f2a' },
  totalPendVal: { fontSize:14, fontWeight:800, color:'#b8732a' },
  filtroBox: { padding:'0.4rem 0.6rem', borderBottom:'1px solid #f0e8dc', flexShrink:0 },
  filtroInput: { width:'100%', padding:'6px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:13, outline:'none', background:'#fdfaf6', boxSizing:'border-box' },
  sinTickets: { flex:1, minHeight:0, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', color:'#8a7560', fontSize:13, padding:'2rem', textAlign:'center' },
  ticketList: { flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden', padding:'0.6rem', WebkitOverflowScrolling:'touch' },
  ticketCard: { width:'100%', borderRadius:10, padding:'0.7rem 0.8rem', marginBottom:'0.5rem', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:4 },
  ticketCardTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  ticketNum: { fontSize:14, fontWeight:700 },
  ticketMins: { fontSize:12, fontWeight:600 },
  ticketCardBot: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  ticketCliente: { fontSize:12, color:'#4a3520' },
  ticketTotal: { fontSize:13, fontWeight:700, color:'#2c1a08' },
  ticketItems: { display:'flex', gap:4, flexWrap:'wrap' },
  ticketItem: { fontSize:10, background:'rgba(0,0,0,0.06)', borderRadius:4, padding:'1px 5px', color:'#4a3520' },
  panelRight: { flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0, height:'100%' },
  sinSeleccion: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#8a7560', fontSize:14 },
  detHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.8rem 1.2rem', background:'#fff', borderBottom:'1px solid #e8e0d0', flexShrink:0 },
  detNum: { fontSize:16, fontWeight:700, color:'#2c1a08' },
  detCliente: { fontSize:13, color:'#6b4f2a' },
  cerrarBtn: { background:'transparent', border:'none', fontSize:18, cursor:'pointer', color:'#8a7560' },
  anularBtn: { background:'transparent', border:'1px solid #f5c6c6', color:'#c0392b', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:500 },
  detBody: { flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden', padding:'1rem 1.2rem', WebkitOverflowScrolling:'touch' },
  secLabel: { fontSize:11, fontWeight:700, color:'#8a7560', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 6px' },
  detItem: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'6px 0', borderBottom:'1px solid #f5f0ea' },
  detItemInfo: { display:'flex', flexDirection:'column', gap:2 },
  detItemNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  detItemDet: { fontSize:11, color:'#6b4f2a' },
  detItemSub: { fontSize:13, fontWeight:700, color:'#b8732a' },
  quitarBtn: { background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:13 },
  extrasGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(120px,100%),1fr))', gap:'0.4rem', marginBottom:'0.8rem' },
  extraBtn: { background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:8, padding:'0.5rem', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:2 },
  extraNombre: { fontSize:12, fontWeight:600, color:'#2c1a08' },
  extraPrecio: { fontSize:11, color:'#b8732a', fontWeight:600 },
  totalBox: { background:'#faf7f2', border:'1px solid #e8e0d0', borderRadius:10, padding:'0.8rem', margin:'0.8rem 0', display:'flex', flexDirection:'column', gap:4 },
  totalRow: { display:'flex', justifyContent:'space-between', fontSize:13, color:'#4a3520' },
  totalSub: { color:'#8a7560', fontSize:12 },
  totalFinalRow: { fontWeight:800, fontSize:16, color:'#2c1a08', borderTop:'1px solid #e8e0d0', paddingTop:6, marginTop:4 },
  pagoOpts: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'0.4rem', marginBottom:'0.8rem' },
  pagoBtn: { padding:'8px', border:'1px solid #ddd0be', borderRadius:8, background:'#faf7f2', cursor:'pointer', fontSize:12, fontWeight:500, color:'#4a3520' },
  pagoBtnOn: { background:'#b8732a', color:'#fff', border:'1px solid #b8732a' },
  montoField: { display:'flex', flexDirection:'column', gap:4, marginBottom:'0.6rem' },
  montoInput: { padding:'8px 12px', border:'1px solid #ddd0be', borderRadius:8, fontSize:16, outline:'none', background:'#fdfaf6' },
  vueltaText: { fontSize:13, color:'#1a7a4a', fontWeight:600, margin:0 },
  error: { fontSize:12, color:'#c0392b', background:'#fdf0ef', borderRadius:6, padding:'6px 10px', margin:0 },
  detFooter: { padding:'0.8rem 1.2rem', borderTop:'1px solid #e8e0d0', background:'#fff', flexShrink:0 },
  cobrarBtn: { width:'100%', padding:'13px', background:'#1a7a4a', color:'#fff', border:'none', borderRadius:8, fontSize:16, fontWeight:700, cursor:'pointer' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'clamp(0.5rem, 3vw, 1rem)', boxSizing:'border-box' },
  modalBox: { background:'#fff', borderRadius:14, width:'100%', maxWidth:400, boxSizing:'border-box' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.2rem', borderBottom:'1px solid #e8e0d0' },
  modalTitulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  modalClose: { background:'transparent', border:'none', fontSize:18, cursor:'pointer', color:'#8a7560' },
  modalBody: { padding:'1.2rem', display:'flex', flexDirection:'column', gap:'0.8rem' },
  modalField: { display:'flex', flexDirection:'column', gap:4 },
  modalLabel: { fontSize:12, fontWeight:600, color:'#4a3520' },
  modalInput: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6' },
  modalError: { fontSize:12, color:'#c0392b', margin:0 },
  modalFooter: { display:'flex', justifyContent:'flex-end', gap:'0.6rem', flexWrap:'wrap', padding:'0.8rem 1.2rem', borderTop:'1px solid #e8e0d0' },
  modalCancel: { padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 },
  modalConfirm: { padding:'8px 16px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 },
}
