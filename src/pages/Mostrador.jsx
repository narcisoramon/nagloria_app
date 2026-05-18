import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import { productosApi } from '../api/productos'
import { recipientesApi } from '../api/recipientes'
import { ticketsApi } from '../api/tickets'
import client from '../api/client'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')

// ── Buscador de clientes con autocompletado ──────────────────────────────────
function BuscadorCliente({ clienteSeleccionado, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const timerRef = useRef(null)
  const wrapRef = useRef(null)

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscar = (texto) => {
    setBusqueda(texto)
    setAbierto(true)
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

  const seleccionar = (cli) => {
    onSeleccionar(cli)
    setBusqueda('')
    setResultados([])
    setAbierto(false)
  }

  const limpiar = () => { onSeleccionar(null); setBusqueda(''); setResultados([]) }

  if (clienteSeleccionado) {
    return (
      <div style={bc.selBox}>
        <div style={bc.selInfo}>
          <span style={bc.selNombre}>{clienteSeleccionado.nombre}</span>
          {clienteSeleccionado.documento && <span style={bc.selDoc}>CI: {clienteSeleccionado.documento}</span>}
        </div>
        <button onClick={limpiar} style={bc.selQuitar}>✕</button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => buscar(e.target.value)}
        onFocus={() => busqueda && setAbierto(true)}
        placeholder="Buscar por nombre, CI o teléfono…"
        style={bc.input}
      />
      {abierto && (busqueda.trim()) && (
        <div style={bc.dropdown}>
          {buscando && <div style={bc.dropItem}>Buscando…</div>}
          {!buscando && resultados.length === 0 && (
            <div style={bc.dropItem}>Sin resultados</div>
          )}
          {resultados.map((c) => (
            <button key={c.id} style={bc.dropBtn} onClick={() => seleccionar(c)}>
              <span style={bc.dropNombre}>{c.nombre}</span>
              {c.documento && <span style={bc.dropDoc}>CI: {c.documento}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const bc = {
  input: { width:'100%', padding:'7px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:13, background:'#fdfaf6', outline:'none', boxSizing:'border-box' },
  dropdown: { position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ddd0be', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:50, maxHeight:200, overflowY:'auto' },
  dropItem: { padding:'8px 12px', fontSize:13, color:'#8a7560' },
  dropBtn: { width:'100%', padding:'8px 12px', background:'transparent', border:'none', borderBottom:'1px solid #f0e8dc', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:2 },
  dropNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  dropDoc: { fontSize:11, color:'#8a7560' },
  selBox: { display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fef9f0', border:'1px solid #f5e6cc', borderRadius:7, padding:'6px 10px' },
  selInfo: { display:'flex', flexDirection:'column', gap:1 },
  selNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  selDoc: { fontSize:11, color:'#8a7560' },
  selQuitar: { background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:14, padding:0 },
}

export default function Mostrador() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { caja, limpiar } = useCajaStore()

  const [productos, setProductos] = useState([])
  const [recipientes, setRecipientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [catActiva, setCatActiva] = useState(null)

  // Carrito
  const [items, setItems] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  // Pesaje inline
  const [pesando, setPesando] = useState(false)
  const [recIdx, setRecIdx] = useState(0)
  const [pesoBruto, setPesoBruto] = useState('')
  const [prodPeso, setProdPeso] = useState(null)

  // Estado
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ticketOk, setTicketOk] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const [resCat, resProd, resRec] = await Promise.all([
        productosApi.categorias({ per_page: 100 }),
        productosApi.listar({ activo: 1, per_page: 100 }),
        recipientesApi.listar({ activo: 1, per_page: 100 }),
      ])
      const cats = resCat.data.data || resCat.data
      const prods = resProd.data.data || resProd.data
      const recs = resRec.data.data || resRec.data
      setCategorias(cats)
      setProductos(prods)
      setRecipientes(recs)
      if (cats.length > 0) setCatActiva(cats[0].id)
    } catch (e) { console.error(e) }
  }

  const productosFiltrados = catActiva
    ? productos.filter((p) => p.categoria_producto_id === catActiva)
    : productos

  // Clic en producto por UNIDAD → suma directo
  const clickProducto = (prod) => {
    if (prod.tipo_venta === 'KILO') {
      setProdPeso(prod)
      setPesando(true)
      setPesoBruto('')
      return
    }
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.prod_id === prod.id && x.tipo === 'UNIDAD')
      if (idx >= 0) {
        const n = [...prev]
        n[idx] = { ...n[idx], cantidad: n[idx].cantidad + 1, subtotal: (n[idx].cantidad + 1) * parseFloat(prod.precio) }
        return n
      }
      return [...prev, {
        key: Date.now(),
        prod_id: prod.id,
        producto: prod,
        tipo: 'UNIDAD',
        cantidad: 1,
        precio_unitario: parseFloat(prod.precio),
        subtotal: parseFloat(prod.precio),
        recipiente: null,
        peso_bruto_kg: null,
        tara_kg: null,
        peso_neto_kg: null,
      }]
    })
  }

  const agregarPesado = () => {
    const rec = recipientes[recIdx]
    const bruto = parseFloat(pesoBruto) || 0
    const neto = Math.max(0, bruto - (rec?.tara_kg || 0))
    if (neto <= 0 || !prodPeso) return
    const subtotal = neto * parseFloat(prodPeso.precio)
    setItems((prev) => [...prev, {
      key: Date.now(),
      prod_id: prodPeso.id,
      producto: prodPeso,
      tipo: 'KILO',
      cantidad: neto,
      precio_unitario: parseFloat(prodPeso.precio),
      subtotal,
      recipiente: rec,
      peso_bruto_kg: bruto,
      tara_kg: rec?.tara_kg || 0,
      peso_neto_kg: neto,
    }])
    setPesoBruto('')
    setPesando(false)
    setProdPeso(null)
  }

  const quitarItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key))
  const total = items.reduce((s, i) => s + i.subtotal, 0)

  const recActual = recipientes[recIdx]
  const netoPreview = recActual ? Math.max(0, (parseFloat(pesoBruto) || 0) - recActual.tara_kg) : 0

  const emitirTicket = async () => {
    if (!items.length) return
    setEnviando(true)
    setError('')
    try {
      // El backend calcula subtotales — solo mandamos producto_id, cantidad, recipiente_id, peso_bruto_kg
      const itemsPayload = items.map((i) => ({
        producto_id: i.prod_id,
        cantidad: i.tipo === 'UNIDAD' ? i.cantidad : null,
        recipiente_id: i.recipiente?.id || null,
        peso_bruto_kg: i.peso_bruto_kg || null,
      }))

      const { data } = await ticketsApi.crear({
        cliente_id: clienteSeleccionado ? clienteSeleccionado.id : null,
        tipo_venta: 'pendiente',
        forma_pago: 'pendiente',
        descuento: 0,
        items: itemsPayload,
      })

      setTicketOk(data.data || data)
      setItems([])
      setClienteSeleccionado(null)
      setPesando(false)
    } catch (e) {
      setError(e.response?.data?.message || 'Error al emitir el ticket')
      console.error(e.response?.data)
    } finally {
      setEnviando(false)
    }
  }

  const handleLogout = async () => {
    await logout(); limpiar()
    navigate('/login', { replace: true })
  }

  // ── Pantalla de confirmación ──
  if (ticketOk) {
    return (
      <div style={s.root}>
        <nav style={s.nav}>
          <div style={s.navLeft}><div style={s.navLogo}>ÑG</div><span style={s.navTitulo}>Mostrador</span></div>
          <div style={s.navRight}><span style={s.navUser}>{user?.name}</span><button onClick={handleLogout} style={s.navLogout}>Salir</button></div>
        </nav>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#faf7f2'}}>
          <div style={s.ticketOkBox}>
            <div style={s.ticketOkCheck}>✓</div>
            <p style={s.ticketOkLabel}>Ticket emitido</p>
            <div style={s.ticketOkNum}>#{ticketOk.numero_ticket || ticketOk.id}</div>
            <div style={s.ticketOkTotal}>{fmt(ticketOk.total)}</div>
            {ticketOk.cliente && <p style={s.ticketOkCli}>Cliente: {ticketOk.cliente.nombre}</p>}
            <p style={s.ticketOkHint}>El cliente presenta este número en caja</p>
            <button onClick={() => setTicketOk(null)} style={s.nuevoBtn}>+ Nuevo ticket</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}><div style={s.navLogo}>ÑG</div><span style={s.navTitulo}>Mostrador</span></div>
        <div style={s.navRight}><span style={s.navUser}>{user?.name}</span><button onClick={handleLogout} style={s.navLogout}>Salir</button></div>
      </nav>

      <div style={s.body}>
        {/* ── Panel izquierdo ── */}
        <div style={s.panelIzq}>
          <div style={s.cats}>
            <button
              style={{...s.catBtn, ...(catActiva===null ? s.catBtnOn : {})}}
              onClick={() => setCatActiva(null)}>
              Todos
            </button>
            {categorias.map((c) => (
              <button key={c.id}
                style={{...s.catBtn, ...(catActiva===c.id ? s.catBtnOn : {})}}
                onClick={() => setCatActiva(c.id)}>
                {c.nombre}
              </button>
            ))}
          </div>
          <p style={s.hint}>Tocá para agregar · ⚖️ = por peso</p>
          <div style={s.grid}>
            {productosFiltrados.map((p) => (
              <button key={p.id} style={s.prodCard} onClick={() => clickProducto(p)}>
                <span style={s.prodIcon}>{p.tipo_venta==='KILO' ? '⚖️' : '📦'}</span>
                <span style={s.prodNombre}>{p.nombre}</span>
                <span style={s.prodPrecio}>
                  {fmt(p.precio)}<span style={s.prodUnit}>/{p.tipo_venta==='KILO'?'kg':'und'}</span>
                </span>
              </button>
            ))}
            {productosFiltrados.length === 0 && <p style={s.empty}>Sin productos</p>}
          </div>

          {/* Panel pesaje inline */}
          {pesando && prodPeso && (
            <div style={s.pesoPanel}>
              <div style={s.pesoPanelHeader}>
                <span style={s.pesoPanelTitulo}>⚖️ {prodPeso.nombre} — {fmt(prodPeso.precio)}/kg</span>
                <button onClick={() => {setPesando(false);setProdPeso(null);setPesoBruto('')}} style={s.pesoCancelBtn}>✕ Cancelar</button>
              </div>
              <div style={s.pesoRow}>
                <div style={s.pesoField}>
                  <label style={s.pesoLabel}>Recipiente</label>
                  <select value={recIdx} onChange={(e) => setRecIdx(parseInt(e.target.value))} style={s.pesoSelect}>
                    {recipientes.map((r, i) => (
                      <option key={r.id} value={i}>{r.nombre} (tara {Math.round(r.tara_kg*1000)}g)</option>
                    ))}
                  </select>
                </div>
                <div style={s.pesoField}>
                  <label style={s.pesoLabel}>Peso bruto (kg)</label>
                  <input type="number" step="0.001" min="0"
                    value={pesoBruto}
                    onChange={(e) => setPesoBruto(e.target.value)}
                    onKeyDown={(e) => e.key==='Enter' && agregarPesado()}
                    placeholder="0.000" style={s.pesoInput} autoFocus />
                </div>
                <button onClick={agregarPesado} disabled={netoPreview<=0}
                  style={{...s.pesoAgregarBtn, opacity: netoPreview>0?1:0.4}}>
                  Agregar
                </button>
              </div>
              {netoPreview > 0 && (
                <p style={s.pesoPreview}>
                  Neto: {netoPreview.toFixed(3)} kg → {fmt(netoPreview * parseFloat(prodPeso.precio))}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Panel ticket ── */}
        <div style={s.panelTicket}>
          <div style={s.ticketHeader}>
            <h2 style={s.ticketTitulo}>🧾 Ticket</h2>
            {items.length > 0 && <button onClick={() => setItems([])} style={s.limpiarBtn}>Limpiar</button>}
          </div>

          {/* Buscador cliente */}
          <div style={s.clienteBox}>
            <label style={s.clienteLabel}>Cliente</label>
            <BuscadorCliente
              clienteSeleccionado={clienteSeleccionado}
              onSeleccionar={setClienteSeleccionado}
            />
          </div>

          <div style={s.itemsList}>
            {items.length === 0 ? (
              <div style={s.vacio}>Seleccioná productos</div>
            ) : (
              items.map((item) => (
                <div key={item.key} style={s.itemRow}>
                  <div style={s.itemInfo}>
                    <span style={s.itemNombre}>{item.producto.nombre}</span>
                    <span style={s.itemDet}>
                      {item.tipo==='KILO'
                        ? `${item.peso_neto_kg.toFixed(3)}kg × ${fmt(item.precio_unitario)}/kg · ${item.recipiente?.nombre}`
                        : `${item.cantidad} und × ${fmt(item.precio_unitario)}`}
                    </span>
                  </div>
                  <div style={s.itemRight}>
                    <span style={s.itemSub}>{fmt(item.subtotal)}</span>
                    <button onClick={() => quitarItem(item.key)} style={s.quitarBtn}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={s.ticketFooter}>
            <div style={s.totalRow}>
              <span style={s.totalLabel}>TOTAL</span>
              <span style={s.totalVal}>{fmt(total)}</span>
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button onClick={emitirTicket} disabled={items.length===0||enviando}
              style={{...s.emitirBtn, opacity: items.length===0?0.4:1}}>
              {enviando ? 'Emitiendo…' : '✓ Emitir Ticket'}
            </button>
          </div>
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
  navUser: { fontSize:13, color:'#c9b99a' },
  navLogout: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  body: { display:'flex', flex:1, overflow:'auto', flexWrap:'wrap', minHeight:0 },
  panelIzq: { flex:'1 1 520px', minWidth:'min(100%, 320px)', display:'flex', flexDirection:'column', overflow:'hidden' },
  cats: { display:'flex', gap:'0.4rem', padding:'0.7rem', background:'#fff', borderBottom:'1px solid #e8e0d0', flexWrap:'wrap' },
  catBtn: { padding:'5px 12px', borderRadius:16, border:'1px solid #ddd0be', background:'#faf7f2', color:'#4a3520', fontSize:12, cursor:'pointer', fontWeight:500 },
  catBtnOn: { background:'#b8732a', color:'#fff', border:'1px solid #b8732a' },
  hint: { fontSize:11, color:'#8a7560', padding:'4px 0.7rem', background:'#faf7f2', borderBottom:'1px solid #f0e8dc' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(140px, 100%),1fr))', gap:'0.7rem', padding:'0.8rem', overflowY:'auto', flex:1 },
  prodCard: { background:'#fff', border:'1px solid #e8e0d0', borderRadius:10, padding:'0.8rem', display:'flex', flexDirection:'column', gap:5, cursor:'pointer', textAlign:'left' },
  prodIcon: { fontSize:18 },
  prodNombre: { fontSize:13, fontWeight:600, color:'#2c1a08', lineHeight:1.3 },
  prodPrecio: { fontSize:12, color:'#b8732a', fontWeight:700 },
  prodUnit: { fontSize:10, fontWeight:400, color:'#8a7560', marginLeft:2 },
  empty: { color:'#8a7560', fontSize:13, gridColumn:'1/-1', textAlign:'center', marginTop:'2rem' },
  pesoPanel: { background:'#fff', borderTop:'2px solid #b8732a', padding:'0.8rem 1rem', flexShrink:0 },
  pesoPanelHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem' },
  pesoPanelTitulo: { fontSize:13, fontWeight:700, color:'#2c1a08' },
  pesoCancelBtn: { background:'transparent', border:'none', color:'#c0392b', fontSize:12, cursor:'pointer' },
  pesoRow: { display:'flex', gap:'0.8rem', alignItems:'flex-end', flexWrap:'wrap' },
  pesoField: { display:'flex', flexDirection:'column', gap:4, flex:1 },
  pesoLabel: { fontSize:11, fontWeight:600, color:'#4a3520' },
  pesoSelect: { padding:'7px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:13, background:'#fdfaf6', outline:'none' },
  pesoInput: { padding:'7px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:15, background:'#fdfaf6', outline:'none', width:'100%' },
  pesoAgregarBtn: { padding:'8px 18px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 },
  pesoPreview: { fontSize:12, color:'#6b4f2a', marginTop:6, fontWeight:600 },
  panelTicket: { width:'min(100%, 340px)', background:'#fff', borderLeft:'1px solid #e8e0d0', display:'flex', flexDirection:'column', flexShrink:0 },
  ticketHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.8rem 1rem', borderBottom:'1px solid #f0e8dc' },
  ticketTitulo: { margin:0, fontSize:15, fontWeight:700, color:'#2c1a08' },
  limpiarBtn: { background:'transparent', border:'none', color:'#c0392b', fontSize:12, cursor:'pointer' },
  clienteBox: { padding:'0.6rem 1rem', borderBottom:'1px solid #f0e8dc' },
  clienteLabel: { fontSize:11, fontWeight:600, color:'#4a3520', display:'block', marginBottom:4 },
  clienteSelect: { width:'100%', padding:'6px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:13, background:'#fdfaf6', outline:'none' },
  itemsList: { flex:1, overflowY:'auto', padding:'0.4rem' },
  vacio: { display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#8a7560', fontSize:13, padding:'2rem', textAlign:'center' },
  itemRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'0.6rem 0.4rem', borderBottom:'1px solid #f5f0ea', gap:'0.4rem' },
  itemInfo: { display:'flex', flexDirection:'column', gap:2, flex:1 },
  itemNombre: { fontSize:13, fontWeight:600, color:'#2c1a08' },
  itemDet: { fontSize:11, color:'#6b4f2a' },
  itemRight: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 },
  itemSub: { fontSize:12, fontWeight:700, color:'#b8732a', whiteSpace:'nowrap' },
  quitarBtn: { background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:13, padding:0 },
  ticketFooter: { padding:'0.8rem 1rem', borderTop:'1px solid #e8e0d0', display:'flex', flexDirection:'column', gap:'0.7rem' },
  totalRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  totalLabel: { fontSize:12, fontWeight:700, color:'#4a3520', letterSpacing:1 },
  totalVal: { fontSize:18, fontWeight:800, color:'#2c1a08' },
  error: { fontSize:12, color:'#c0392b', background:'#fdf0ef', borderRadius:6, padding:'6px 10px', margin:0 },
  emitirBtn: { padding:'11px', background:'#b8732a', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' },
  ticketOkBox: { background:'#fff', border:'1px solid #a9dfbf', borderRadius:16, padding:'clamp(1.2rem, 5vw, 2rem)', textAlign:'center', maxWidth:320, width:'calc(100% - 2rem)', boxSizing:'border-box' },
  ticketOkCheck: { fontSize:40, color:'#1a7a4a', marginBottom:'0.5rem' },
  ticketOkLabel: { fontSize:11, color:'#1a7a4a', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, margin:'0 0 4px' },
  ticketOkNum: { fontSize:'clamp(36px, 12vw, 52px)' , fontWeight:800, color:'#1a7a4a', lineHeight:1 },
  ticketOkTotal: { fontSize:22, fontWeight:700, color:'#1a7a4a', marginTop:8 },
  ticketOkCli: { fontSize:13, color:'#1a7a4a', marginTop:6 },
  ticketOkHint: { fontSize:12, color:'#2ecc71', marginTop:8, opacity:.8 },
  nuevoBtn: { marginTop:'1.2rem', padding:'10px 24px', background:'#185FA5', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' },
}
