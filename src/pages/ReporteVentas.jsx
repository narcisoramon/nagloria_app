import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')
const fmtGs = (n) => 'Gs. ' + Math.round(parseFloat(n) || 0).toLocaleString('es-PY')

function hoy() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

const FORMAS_PAGO = ['', 'efectivo', 'tarjeta', 'transferencia', 'credito']
const TIPOS_VENTA = ['', 'contado', 'credito']

export default function ReporteVentas() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { limpiar } = useCajaStore()

  const [desde, setDesde] = useState(() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`
  })
  const [hasta, setHasta]           = useState(hoy)
  const [formaPago, setFormaPago]   = useState('')
  const [tipoVenta, setTipoVenta]   = useState('')
  const [estado, setEstado]         = useState('pagado')
  const [tickets, setTickets]       = useState([])
  const [buscando, setBuscando]     = useState(false)
  const [buscado, setBuscado]       = useState(false)
  const [exportando, setExportando] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)
  const POR_PAGINA = 20

  const buscar = async () => {
    setBuscando(true)
    setBuscado(false)
    setPaginaActual(1)
    try {
      const params = { desde, hasta, estado, per_page: 500 }
      if (formaPago) params.forma_pago = formaPago
      if (tipoVenta) params.tipo_venta = tipoVenta
      const { data } = await client.get('/tickets', { params })
      setTickets(data.data || data)
      setBuscado(true)
    } catch (e) { console.error(e) }
    finally { setBuscando(false) }
  }

  // Resumen
  const totalVentas   = tickets.reduce((s, t) => s + parseFloat(t.total), 0)
  const totalCobrado  = tickets.reduce((s, t) => s + parseFloat(t.monto_pagado), 0)
  const promedio      = tickets.length ? totalVentas / tickets.length : 0
  const porFormaPago  = tickets.reduce((acc, t) => {
    acc[t.forma_pago] = (acc[t.forma_pago] || 0) + parseFloat(t.total)
    return acc
  }, {})

  // Paginación
  const totalPaginas = Math.ceil(tickets.length / POR_PAGINA)
  const ticketsPagina = tickets.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  const exportarExcel = () => {
    if (!tickets.length) return
    setExportando(true)
    try {
      const filas = tickets.map((t) => ({
        'N° Ticket':    t.numero_ticket,
        'Fecha':        new Date(t.fecha_hora).toLocaleString('es-PY'),
        'Cliente':      t.cliente?.nombre || 'Casual',
        'Tipo venta':   t.tipo_venta,
        'Forma pago':   t.forma_pago,
        'Productos':    t.detalles?.map((d) => d.descripcion).join(', ') || '—',
        'Subtotal (Gs.)': Math.round(parseFloat(t.subtotal)),
        'Descuento (Gs.)': Math.round(parseFloat(t.descuento)),
        'Total (Gs.)':  Math.round(parseFloat(t.total)),
        'Estado':       t.estado,
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet([])

      XLSX.utils.sheet_add_aoa(ws, [
        ['LA GLORIA - Reporte de Ventas'],
        [`Período: ${desde} al ${hasta}`],
        [`Total tickets: ${tickets.length}  |  Total ventas: ${fmtGs(totalVentas)}  |  Promedio: ${fmtGs(promedio)}`],
        [],
      ], { origin: 'A1' })

      XLSX.utils.sheet_add_json(ws, filas, { origin: 'A5' })

      ws['!cols'] = [
        {wch:12},{wch:22},{wch:28},{wch:12},{wch:14},{wch:40},{wch:16},{wch:16},{wch:16},{wch:10}
      ]

      // Totales al pie
      const filaPie = 5 + tickets.length + 2
      XLSX.utils.sheet_add_aoa(ws, [
        ['', '', '', '', '', 'TOTAL', '', '', Math.round(totalVentas)],
      ], { origin: { r: filaPie, c: 0 } })

      XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
      XLSX.writeFile(wb, `reporte-ventas_${desde}_${hasta}.xlsx`)
    } finally { setExportando(false) }
  }

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const exportarPDF = () => {
    if (!tickets.length) return
    setExportando(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()

      const MARRON = [44,26,8], DORADO = [184,115,42], DORADO2 = [245,230,204]
      const VERDE  = [26,122,74], ROJO  = [192,57,43]
      const BLANCO = [255,255,255], GRIS = [245,245,245]

      // Header
      doc.setFillColor(...MARRON); doc.rect(0, 0, W, 28, 'F')
      doc.setFillColor(...DORADO); doc.rect(0, 28, W, 2.5, 'F')

      doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(...BLANCO)
      doc.text('LA GLORIA', 12, 12)
      doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(...DORADO2)
      doc.text('Restaurante & Comedor', 12, 18)

      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...BLANCO)
      doc.text('REPORTE DE VENTAS', W-12, 11, {align:'right'})
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...DORADO2)
      doc.text(`Período: ${desde} al ${hasta}`, W-12, 17, {align:'right'})
      doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, W-12, 22, {align:'right'})

      // Tarjetas resumen
      const cards = [
        {label:'Total Tickets', val:tickets.length, color:DORADO},
        {label:'Total Ventas', val:fmtGs(totalVentas), color:VERDE},
        {label:'Promedio/Ticket', val:fmtGs(promedio), color:MARRON},
        {label:'Total Cobrado', val:fmtGs(totalCobrado), color:VERDE},
      ]
      cards.forEach((c, i) => {
        const x = 12 + i * 69
        doc.setFillColor(...DORADO2); doc.roundedRect(x, 33, 65, 14, 2, 2, 'F')
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(100,80,40)
        doc.text(c.label.toUpperCase(), x+4, 39)
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...c.color)
        doc.text(String(c.val), x+4, 44)
      })

      // Forma de pago mini
      let xFP = 12
      const yFP = 50
      Object.entries(porFormaPago).forEach(([fp, monto]) => {
        doc.setFillColor(...GRIS); doc.roundedRect(xFP, yFP, 42, 8, 1, 1, 'F')
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...MARRON)
        doc.text(`${fp}: ${fmtGs(monto)}`, xFP+3, yFP+5)
        xFP += 45
      })

      // Tabla
      autoTable(doc, {
        startY: 62,
        head: [['N° Ticket','Fecha','Cliente','Tipo','Forma Pago','Productos','Total']],
        body: tickets.map((t) => [
          t.numero_ticket,
          new Date(t.fecha_hora).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
          t.cliente?.nombre || 'Casual',
          t.tipo_venta,
          t.forma_pago,
          (t.detalles||[]).slice(0,3).map((d)=>d.descripcion).join(', ') + (t.detalles?.length>3?` +${t.detalles.length-3}…`:''),
          fmtGs(t.total),
        ]),
        theme: 'grid',
        styles: { font:'helvetica', fontSize:7, cellPadding:2, valign:'middle' },
        headStyles: { fillColor:DORADO, textColor:BLANCO, fontStyle:'bold', fontSize:7.5, halign:'center' },
        columnStyles: {
          0: {cellWidth:20, halign:'center', fontStyle:'bold'},
          1: {cellWidth:32, halign:'center'},
          2: {cellWidth:38},
          3: {cellWidth:18, halign:'center'},
          4: {cellWidth:22, halign:'center'},
          5: {cellWidth:'auto'},
          6: {cellWidth:26, halign:'right', fontStyle:'bold', textColor:VERDE},
        },
        alternateRowStyles: { fillColor: GRIS },
        didParseCell: (data) => {
          if (data.section==='body' && data.column.index===3) {
            data.cell.styles.textColor = data.cell.raw==='credito' ? ROJO : VERDE
          }
        },
        foot: [[
          '','','','','', `TOTAL (${tickets.length} tickets)`, fmtGs(totalVentas)
        ]],
        footStyles: { fillColor:DORADO2, textColor:MARRON, fontStyle:'bold', halign:'right', fontSize:8 },
        margin: { left:12, right:12 },
      })

      // Pie
      const pages = doc.internal.getNumberOfPages()
      for (let i=1; i<=pages; i++) {
        doc.setPage(i)
        const H = doc.internal.pageSize.getHeight()
        doc.setFillColor(...MARRON); doc.rect(0, H-10, W, 10, 'F')
        doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(...DORADO2)
        doc.text('La Gloria - Reporte de Ventas', 12, H-4)
        doc.text(`Página ${i} de ${pages}`, W-12, H-4, {align:'right'})
      }

      doc.save(`reporte-ventas_${desde}_${hasta}.pdf`)
    } catch(e) { console.error(e) }
    finally { setExportando(false) }
  }

  const handleLogout = async () => { await logout(); limpiar(); navigate('/login', {replace:true}) }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>ÑA</div>
          <span style={s.navTitulo}>Reporte de Ventas</span>
        </div>
        <div style={s.navRight}>
          <button onClick={() => navigate('/admin/dashboard')} style={s.navBtn}>📊 Dashboard</button>
          <button onClick={() => navigate('/configuracion')} style={s.navBtn}>⚙️ Config</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      {/* Filtros */}
      <div style={s.filtrosBar}>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={s.filtroInput} />
        </div>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={s.filtroInput} />
        </div>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Forma de pago</label>
          <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} style={s.filtroInput}>
            <option value="">Todas</option>
            {['efectivo','tarjeta','transferencia','credito','mixto'].map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>
            ))}
          </select>
        </div>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Tipo de venta</label>
          <select value={tipoVenta} onChange={(e) => setTipoVenta(e.target.value)} style={s.filtroInput}>
            <option value="">Todos</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={s.filtroInput}>
            <option value="pagado">Pagados</option>
            <option value="anulado">Anulados</option>
            <option value="">Todos</option>
          </select>
        </div>
        <button onClick={buscar} disabled={buscando} style={s.btnBuscar}>
          {buscando ? 'Buscando…' : '🔍 Buscar'}
        </button>
      </div>

      {/* Resumen */}
      {buscado && (
        <>
          <div style={s.cards}>
            {[
              {label:'Tickets', val:tickets.length, sub:'encontrados', color:'#b8732a'},
              {label:'Total ventas', val:fmt(totalVentas), sub:'suma de tickets', color:'#1a7a4a'},
              {label:'Promedio', val:fmt(promedio), sub:'por ticket', color:'#185FA5'},
              {label:'Total cobrado', val:fmt(totalCobrado), sub:'efectivo recibido', color:'#1a7a4a'},
            ].map((c, i) => (
              <div key={i} style={s.card}>
                <span style={s.cardLabel}>{c.label}</span>
                <span style={{...s.cardVal, color:c.color}}>{c.val}</span>
                <span style={s.cardSub}>{c.sub}</span>
              </div>
            ))}
          </div>

          {/* Por forma de pago */}
          {Object.keys(porFormaPago).length > 0 && (
            <div style={s.fpBar}>
              {Object.entries(porFormaPago).map(([fp, monto]) => {
                const icons = {efectivo:'💵',tarjeta:'💳',transferencia:'🏦',credito:'📋',mixto:'🔀'}
                const colors = {efectivo:'#1a7a4a',tarjeta:'#185FA5',transferencia:'#6b4f2a',credito:'#c0392b',mixto:'#5a3a7a'}
                return (
                  <div key={fp} style={s.fpItem}>
                    <span style={s.fpIcon}>{icons[fp]||'💰'}</span>
                    <span style={s.fpNombre}>{fp.charAt(0).toUpperCase()+fp.slice(1)}</span>
                    <span style={{...s.fpMonto, color:colors[fp]||'#2c1a08'}}>{fmt(monto)}</span>
                  </div>
                )
              })}

              {/* Botones exportar */}
              <div style={{marginLeft:'auto', display:'flex', gap:'0.5rem'}}>
                <button onClick={exportarExcel} disabled={exportando} style={s.btnExcel}>
                  📊 Excel
                </button>
                <button onClick={exportarPDF} disabled={exportando} style={s.btnPDF}>
                  📄 PDF
                </button>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div style={s.tablaWrap}>
            {tickets.length === 0 ? (
              <div style={s.vacio}>Sin tickets en el período seleccionado</div>
            ) : (
              <>
                <table style={s.tabla}>
                  <thead>
                    <tr>
                      {['N° Ticket','Fecha','Cliente','Tipo','Forma pago','Productos','Total','Estado'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsPagina.map((t, i) => (
                      <tr key={t.id} style={{background: i%2===0?'#fff':'#faf7f2'}}>
                        <td style={{...s.td, fontWeight:700, color:'#b8732a'}}>#{t.numero_ticket}</td>
                        <td style={{...s.td, fontSize:11, color:'#6b4f2a'}}>
                          {new Date(t.fecha_hora).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={s.td}>{t.cliente?.nombre || <span style={{color:'#8a7560'}}>Casual</span>}</td>
                        <td style={s.td}>
                          <span style={{
                            fontSize:10, fontWeight:700, borderRadius:4, padding:'2px 8px',
                            background: t.tipo_venta==='credito'?'#fdf0ef':'#f0fdf4',
                            color: t.tipo_venta==='credito'?'#c0392b':'#1a7a4a'
                          }}>{t.tipo_venta}</span>
                        </td>
                        <td style={s.td}>{t.forma_pago}</td>
                        <td style={{...s.td, fontSize:11, maxWidth:200}}>
                          {(t.detalles||[]).slice(0,2).map((d) => d.descripcion).join(', ')}
                          {t.detalles?.length > 2 && ` +${t.detalles.length-2} más`}
                        </td>
                        <td style={{...s.td, fontWeight:700, color:'#1a7a4a', textAlign:'right'}}>{fmt(t.total)}</td>
                        <td style={s.td}>
                          <span style={{
                            fontSize:10, borderRadius:4, padding:'2px 6px',
                            background: t.estado==='anulado'?'#f5f5f5':'#f0fdf4',
                            color: t.estado==='anulado'?'#8a7560':'#1a7a4a'
                          }}>{t.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{...s.td, fontWeight:700, textAlign:'right', color:'#2c1a08', background:'#f5e6cc'}}>
                        TOTAL ({tickets.length} tickets)
                      </td>
                      <td style={{...s.td, fontWeight:800, color:'#1a7a4a', fontSize:15, textAlign:'right', background:'#f5e6cc'}}>
                        {fmt(totalVentas)}
                      </td>
                      <td style={{background:'#f5e6cc'}} />
                    </tr>
                  </tfoot>
                </table>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <>
                    <div style={s.paginado}>
                      <button
                        onClick={() => setPaginaActual((p) => Math.max(1, p-1))}
                        disabled={paginaActual <= 1}
                        style={{...s.pageBtn, ...(paginaActual <= 1 ? s.pageBtnDisabled : {})}}
                      >
                        ← Anterior
                      </button>

                      <div style={s.numerosPagina}>
                        {paginaActual > 3 && totalPaginas > 5 && (
                          <>
                            <button onClick={() => setPaginaActual(1)} style={s.pageNumberBtn}>1</button>
                            <span style={s.puntos}>...</span>
                          </>
                        )}
                        {Array.from({length: totalPaginas}, (_, i) => i+1)
                          .filter((n) => Math.abs(n - paginaActual) <= 2)
                          .map((n) => (
                            <button key={n} onClick={() => setPaginaActual(n)}
                              style={{...s.pageNumberBtn, ...(paginaActual===n ? s.pageNumberBtnActive : {})}}>
                              {n}
                            </button>
                          ))
                        }
                        {paginaActual < totalPaginas - 2 && totalPaginas > 5 && (
                          <>
                            <span style={s.puntos}>...</span>
                            <button onClick={() => setPaginaActual(totalPaginas)} style={s.pageNumberBtn}>{totalPaginas}</button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p+1))}
                        disabled={paginaActual >= totalPaginas}
                        style={{...s.pageBtn, ...(paginaActual >= totalPaginas ? s.pageBtnDisabled : {})}}
                      >
                        Siguiente →
                      </button>
                    </div>
                    <div style={s.pageInfoMobile}>
                      Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong> · Mostrando {((paginaActual-1)*POR_PAGINA)+1}–{Math.min(paginaActual*POR_PAGINA, tickets.length)} de {tickets.length}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!buscado && !buscando && (
        <div style={s.inicio}>
          <p style={{fontSize:40, margin:0}}>📊</p>
          <p style={{color:'#8a7560', fontSize:14, margin:0}}>Seleccioná el período y pulsá Buscar</p>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', display:'flex', flexDirection:'column', background:'#f5f0ea', fontFamily:'system-ui,sans-serif' },
  nav: { background:'#2c1a08', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.2rem', height:50, flexShrink:0 },
  navLeft: { display:'flex', alignItems:'center', gap:'0.8rem' },
  navLogo: { width:30, height:30, background:'#b8732a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 },
  navTitulo: { fontSize:15, fontWeight:700 },
  navRight: { display:'flex', gap:'0.6rem' },
  navBtn: { background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:500 },
  navLogout: { background:'transparent', border:'1px solid #c0392b', color:'#f5c6c6', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12 },

  filtrosBar: { display:'flex', alignItems:'flex-end', gap:'0.8rem', padding:'1rem 1.2rem', background:'#fff', borderBottom:'2px solid #e8e0d0', flexWrap:'wrap', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' },
  filtroGroup: { display:'flex', flexDirection:'column', gap:4 },
  filtroLabel: { fontSize:11, fontWeight:700, color:'#2c1a08', textTransform:'uppercase', letterSpacing:'0.05em' },
  filtroInput: { padding:'8px 12px', border:'1.5px solid #ddd0be', borderRadius:7, fontSize:13, outline:'none', background:'#fdfaf6', minWidth:140, color:'#2c1a08' },
  btnBuscar: { padding:'9px 24px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:14, fontWeight:700, alignSelf:'flex-end', boxShadow:'0 2px 6px rgba(184,115,42,0.3)' },

  cards: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', padding:'1rem 1.2rem 0' },
  card: { background:'#fff', borderRadius:12, padding:'0.8rem 1rem', display:'flex', flexDirection:'column', gap:2, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  cardLabel: { fontSize:11, fontWeight:600, color:'#8a7560', textTransform:'uppercase' },
  cardVal: { fontSize:20, fontWeight:800 },
  cardSub: { fontSize:11, color:'#8a7560' },

  fpBar: { display:'flex', alignItems:'center', gap:'1rem', padding:'0.8rem 1.2rem', background:'#fff', margin:'0.8rem 1.2rem 0', borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', flexWrap:'wrap' },
  fpItem: { display:'flex', alignItems:'center', gap:'0.4rem', padding:'4px 10px', background:'#faf7f2', borderRadius:8 },
  fpIcon: { fontSize:14 },
  fpNombre: { fontSize:12, color:'#4a3520', fontWeight:500 },
  fpMonto: { fontSize:13, fontWeight:700 },
  btnExcel: { padding:'6px 14px', background:'#1a7a4a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 },
  btnPDF: { padding:'6px 14px', background:'#c0392b', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 },

  tablaWrap: { flex:1, overflowX:'auto', padding:'0.8rem 1.2rem 1.2rem' },
  tabla: { width:'100%', borderCollapse:'collapse', fontSize:12, background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  th: { padding:'8px 12px', background:'#f5f0ea', color:'#4a3520', fontWeight:600, textAlign:'left', borderBottom:'2px solid #e8e0d0', whiteSpace:'nowrap' },
  td: { padding:'7px 12px', borderBottom:'1px solid #f5f0ea', color:'#2c1a08' },
  vacio: { textAlign:'center', padding:'3rem', color:'#8a7560', fontSize:13 },
  inicio: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.5rem' },
  paginado: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.8rem', marginTop:'1rem', flexWrap:'wrap' },
  numerosPagina: { display:'flex', alignItems:'center', justifyContent:'center', gap:4, flexWrap:'wrap' },
  pageBtn: { padding:'7px 14px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 },
  pageBtnDisabled: { background:'#d6c5b1', cursor:'not-allowed', opacity:0.7 },
  pageNumberBtn: { minWidth:32, height:32, padding:'0 8px', background:'#fff', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13, color:'#4a3520' },
  pageNumberBtnActive: { background:'#b8732a', borderColor:'#b8732a', color:'#fff', fontWeight:700 },
  puntos: { color:'#8a7560', fontSize:13, padding:'0 3px' },
  pageInfoMobile: { marginTop:'0.5rem', textAlign:'center', fontSize:13, color:'#4a3520' },
}
