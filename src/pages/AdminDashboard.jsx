import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmt = (n) => 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY')
const fmtNum = (n) => Math.round(n || 0).toLocaleString('es-PY')

const PERIODOS = [
  { val: 'hoy', label: 'Hoy' },
  { val: 'semana', label: 'Esta semana' },
  { val: 'mes', label: 'Este mes' },
]

function getFechas(periodo) {
  // Fecha actual en Paraguay (GMT-4)
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
  const pad = (n) => String(n).padStart(2, '0')
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  if (periodo === 'hoy') {
    return { desde: fmtDate(hoy), hasta: fmtDate(hoy) }
  }
  if (periodo === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1))
    return { desde: fmtDate(lunes), hasta: fmtDate(hoy) }
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  return { desde: fmtDate(inicio), hasta: fmtDate(hoy) }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { limpiar } = useCajaStore()

  const [periodo, setPeriodo] = useState('hoy')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [periodo])

  const cargar = async () => {
    setCargando(true)
    const { desde, hasta } = getFechas(periodo)
    try {
      const [resTickets, resGastos, resCCsaldo] = await Promise.all([
        client.get('/tickets', { params: { estado: 'pagado', desde, hasta, per_page: 500 } }),
        client.get('/gastos', { params: { estado: 'activo', desde, hasta, per_page: 500 } }),
        client.get('/clientes/con-saldo'),
      ])

      const tickets = resTickets.data.data || resTickets.data
      const gastos  = resGastos.data.data  || resGastos.data
      const deudores = resCCsaldo.data.data || resCCsaldo.data

      // Totales
      const totalVentas = tickets
        .filter((t) => t.tipo_venta !== 'credito')
        .reduce((s, t) => s + parseFloat(t.total), 0)

      const totalCredito = tickets
        .filter((t) => t.tipo_venta === 'credito')
        .reduce((s, t) => s + parseFloat(t.total), 0)

      const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.monto), 0)
      const neto = totalVentas - totalGastos

      // Top productos
      const prodMap = {}
      tickets.forEach((t) => {
        t.detalles?.forEach((d) => {
          if (!prodMap[d.descripcion]) prodMap[d.descripcion] = { nombre: d.descripcion, cantidad: 0, total: 0 }
          prodMap[d.descripcion].cantidad += parseFloat(d.cantidad)
          prodMap[d.descripcion].total += parseFloat(d.subtotal)
        })
      })
      const topProductos = Object.values(prodMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)

      // Ventas por forma de pago
      const pagoMap = {}
      tickets.forEach((t) => {
        const fp = t.forma_pago || 'otros'
        pagoMap[fp] = (pagoMap[fp] || 0) + parseFloat(t.total)
      })

      // Últimos tickets
      const ultimosTickets = [...tickets].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)).slice(0, 8)

      setDatos({
        totalVentas, totalCredito, totalGastos, neto,
        cantTickets: tickets.length,
        topProductos,
        pagoMap,
        ultimosTickets,
        deudores: deudores.slice(0, 6),
        totalDeuda: deudores.reduce((s, c) => s + parseFloat(c.saldo), 0),
      })
    } catch (e) { console.error(e) }
    finally { setCargando(false) }
  }

  const handleLogout = async () => { await logout(); limpiar(); navigate('/login', { replace: true }) }

  // ── Exportar cuenta corriente ──────────────────────────────────────────────
  const [modalExport, setModalExport] = useState(false)
  const [expDesde, setExpDesde] = useState('')
  const [expHasta, setExpHasta] = useState('')
  const [expCliente, setExpCliente] = useState('')
  const [expBusqueda, setExpBusqueda] = useState('')
  const [expResultados, setExpResultados] = useState([])
  const [expClienteNombre, setExpClienteNombre] = useState('')
  const [exportando, setExportando] = useState(false)
  const timerExpRef = { current: null }

  const buscarClienteExp = (texto) => {
    setExpBusqueda(texto)
    setExpCliente('')
    setExpClienteNombre('')
    clearTimeout(timerExpRef.current)
    if (!texto.trim()) { setExpResultados([]); return }
    timerExpRef.current = setTimeout(async () => {
      const { data } = await client.get('/clientes', { params: { buscar: texto, per_page: 10 } })
      setExpResultados(data.data || data)
    }, 300)
  }

  const abrirExport = () => {
    const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
    const pad = (n) => String(n).padStart(2, '0')
    const fmtD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    setExpDesde(fmtD(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
    setExpHasta(fmtD(hoy))
    setExpCliente(''); setExpClienteNombre(''); setExpBusqueda(''); setExpResultados([])
    setModalExport(true)
  }

  const selClienteExp = (c) => {
    setExpCliente(c.id)
    setExpClienteNombre(c.nombre)
    setExpBusqueda(c.nombre)
    setExpResultados([])
  }

  const exportarCC = async () => {
    if (!expDesde || !expHasta) return
    setExportando(true)
    try {
      const params = { desde: expDesde, hasta: expHasta, per_page: 5000 }
      if (expCliente) params.cliente_id = expCliente

      const { data } = await client.get('/cuenta-corriente', { params })
      const movimientos = data.data || data

      if (movimientos.length === 0) {
        alert('No hay movimientos en el período seleccionado')
        setExportando(false)
        return
      }

      const todosModo = !expCliente
      const fmtGs = (n) => Math.round(parseFloat(n) || 0).toLocaleString('es-PY')

      // Construir filas según modo
      const filas = movimientos.map((m) => {
        const fila = {
          'Fecha': new Date(m.fecha_hora).toLocaleString('es-PY'),
        }
        if (todosModo) fila['Cliente'] = m.cliente?.nombre || '—'
        fila['Tipo']             = m.tipo_movimiento === 'DEBITO' ? 'Compra' : 'Pago'
        fila['Concepto']         = m.concepto || '—'
        fila['Monto (Gs.)']      = Math.round(parseFloat(m.monto) || 0)
        fila['Saldo ant. (Gs.)'] = Math.round(parseFloat(m.saldo_anterior) || 0)
        fila['Saldo act. (Gs.)'] = Math.round(parseFloat(m.saldo_actual) || 0)
        return fila
      })

      // Totales
      const totalCompras = movimientos.filter((m) => m.tipo_movimiento === 'DEBITO').reduce((s, m) => s + parseFloat(m.monto), 0)
      const totalPagos   = movimientos.filter((m) => m.tipo_movimiento === 'CREDITO').reduce((s, m) => s + parseFloat(m.monto), 0)
      const saldoFinal   = movimientos.length ? parseFloat(movimientos[0].saldo_actual) : 0

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet([])

      // ── Encabezado ────────────────────────────────────────────────────────
      const titulo = todosModo ? 'ESTADO DE CUENTA - TODOS LOS CLIENTES' : `ESTADO DE CUENTA - ${expClienteNombre}`
      XLSX.utils.sheet_add_aoa(ws, [
        ['LA GLORIA - Restaurante & Comedor'],
        [titulo],
        [`Período: ${expDesde} al ${expHasta}`],
        [`Generado: ${new Date().toLocaleString('es-PY')}`],
        [],
      ], { origin: 'A1' })

      // ── Tabla de datos ────────────────────────────────────────────────────
      XLSX.utils.sheet_add_json(ws, filas, { origin: 'A6', skipHeader: false })

      const nCols = todosModo ? 7 : 6
      const nRows = filas.length

      // ── Resumen al pie ────────────────────────────────────────────────────
      const filaResumen = 6 + nRows + 2
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['', 'Total compras a crédito:', '', '', `Gs. ${fmtGs(totalCompras)}`],
        ['', 'Total pagos realizados:', '', '', `Gs. ${fmtGs(totalPagos)}`],
        ['', 'Saldo pendiente:', '', '', `Gs. ${fmtGs(saldoFinal)}`],
        [],
        ['', 'Este documento es un resumen de su cuenta corriente en La Gloria.'],
      ], { origin: { r: filaResumen, c: 0 } })

      // ── Anchos ────────────────────────────────────────────────────────────
      ws['!cols'] = todosModo
        ? [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
        : [{ wch: 22 }, { wch: 10 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]

      XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta')

      const nombre = todosModo
        ? `estado-cuenta-todos_${expDesde}_${expHasta}.xlsx`
        : `estado-cuenta_${expClienteNombre.replace(/\s+/g,'-')}_${expDesde}_${expHasta}.xlsx`

      XLSX.writeFile(wb, nombre)
    } catch (e) {
      console.error(e)
      alert('Error al exportar')
    } finally {
      setExportando(false)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const maxProd = datos?.topProductos?.[0]?.total || 1

  const exportarPDF = async () => {
    if (!expDesde || !expHasta) return
    setExportando(true)
    try {
      const params = { desde: expDesde, hasta: expHasta, per_page: 5000 }
      if (expCliente) params.cliente_id = expCliente

      const { data } = await client.get('/cuenta-corriente', { params })
      const movimientos = data.data || data

      if (movimientos.length === 0) {
        alert('No hay movimientos en el período seleccionado')
        setExportando(false)
        return
      }

      const todosModo = !expCliente
      const fmtGs = (n) => 'Gs. ' + Math.round(parseFloat(n)||0).toLocaleString('es-PY')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()

      // ── Colores ──────────────────────────────────────────────────────────
      const MARRON  = [44, 26, 8]
      const DORADO  = [184, 115, 42]
      const DORADO2 = [245, 230, 204]
      const VERDE   = [26, 122, 74]
      const VERDE2  = [232, 245, 238]
      const ROJO    = [192, 57, 43]
      const ROJO2   = [253, 236, 234]
      const GRIS    = [245, 245, 245]
      const BLANCO  = [255, 255, 255]

      // ── Header banda marrón ───────────────────────────────────────────────
      doc.setFillColor(...MARRON)
      doc.rect(0, 0, W, 32, 'F')

      // Banda dorada
      doc.setFillColor(...DORADO)
      doc.rect(0, 32, W, 3, 'F')

      // Nombre empresa
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(...BLANCO)
      doc.text('LA GLORIA', 14, 14)

      // Subtítulo
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(...DORADO2)
      doc.text('Restaurante & Comedor', 14, 21)

      // Estado de cuenta - derecha
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...BLANCO)
      doc.text('ESTADO DE CUENTA', W - 14, 12, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...DORADO2)
      doc.text(`Período: ${expDesde} al ${expHasta}`, W - 14, 19, { align: 'right' })
      doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, W - 14, 25, { align: 'right' })

      // ── Info cliente ──────────────────────────────────────────────────────
      doc.setFillColor(...DORADO2)
      doc.roundedRect(10, 38, W - 20, 12, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...MARRON)
      const labelCliente = todosModo ? 'Todos los clientes' : expClienteNombre
      doc.text(`👤  ${labelCliente}`, 15, 46)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120, 100, 80)
      doc.text(`${movimientos.length} movimientos`, W - 15, 46, { align: 'right' })

      // ── Tabla ─────────────────────────────────────────────────────────────
      const colsTodos = ['Fecha', 'Cliente', 'Tipo', 'Concepto', 'Monto', 'Saldo Ant.', 'Saldo Act.']
      const colsUno   = ['Fecha', 'Tipo', 'Concepto', 'Monto', 'Saldo Anterior', 'Saldo Actual']
      const columns   = todosModo ? colsTodos : colsUno

      const rows = movimientos.map((m) => {
        const esCompra = m.tipo_movimiento === 'DEBITO'
        const fecha = new Date(m.fecha_hora).toLocaleString('es-PY', {
          day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
        })
        const base = [fecha]
        if (todosModo) base.push(m.cliente?.nombre || '—')
        base.push(
          esCompra ? 'Compra' : 'Pago',
          m.concepto || '—',
          fmtGs(m.monto),
          fmtGs(m.saldo_anterior),
          fmtGs(m.saldo_actual),
        )
        return base
      })

      autoTable(doc, {
        startY: 54,
        head: [columns],
        body: rows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'middle',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: DORADO,
          textColor: BLANCO,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
        },
        columnStyles: todosModo ? {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        } : {
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const colTipo = todosModo ? 2 : 1
            if (data.column.index === colTipo) {
              const val = data.cell.raw
              if (val === 'Compra') {
                data.cell.styles.textColor = ROJO
                data.cell.styles.fillColor = ROJO2
              } else {
                data.cell.styles.textColor = VERDE
                data.cell.styles.fillColor = VERDE2
              }
            }
            // Saldo actual coloreado
            const colSaldo = todosModo ? 6 : 5
            if (data.column.index === colSaldo) {
              const saldo = parseFloat(movimientos[data.row.index]?.saldo_actual || 0)
              data.cell.styles.textColor = saldo > 0 ? ROJO : VERDE
            }
            // Monto coloreado
            const colMonto = todosModo ? 4 : 3
            if (data.column.index === colMonto) {
              const esCompra = movimientos[data.row.index]?.tipo_movimiento === 'DEBITO'
              data.cell.styles.textColor = esCompra ? ROJO : VERDE
            }
            // Filas alternas
            if (data.row.index % 2 === 0) {
              if (!data.cell.styles.fillColor || data.cell.styles.fillColor === BLANCO) {
                data.cell.styles.fillColor = GRIS
              }
            }
          }
        },
        margin: { left: 10, right: 10 },
        tableLineColor: [220, 210, 200],
        tableLineWidth: 0.2,
      })

      // ── Resumen al pie ─────────────────────────────────────────────────────
      const finalY = (doc.lastAutoTable?.finalY || 54) + 8
      const totalCompras = movimientos.filter((m) => m.tipo_movimiento === 'DEBITO').reduce((s, m) => s + parseFloat(m.monto), 0)
      const totalPagos   = movimientos.filter((m) => m.tipo_movimiento === 'CREDITO').reduce((s, m) => s + parseFloat(m.monto), 0)
      const saldoFinal   = parseFloat(movimientos[0]?.saldo_actual || 0)

      autoTable(doc, {
        startY: finalY,
        body: [
          ['Total compras a crédito', fmtGs(totalCompras)],
          ['Total pagos realizados',  fmtGs(totalPagos)],
          ['Saldo pendiente',         fmtGs(saldoFinal)],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'right', fontStyle: 'bold', cellWidth: 130, textColor: MARRON, fillColor: DORADO2 },
          1: { halign: 'right', fontStyle: 'bold', cellWidth: 45,
            textColor: (data) => data === fmtGs(totalPagos) ? VERDE : ROJO,
            fillColor: DORADO2 },
        },
        didParseCell: (data) => {
          if (data.column.index === 1) {
            if (data.row.index === 1) data.cell.styles.textColor = VERDE
            else data.cell.styles.textColor = ROJO
          }
          data.cell.styles.fillColor = DORADO2
        },
        margin: { left: 10, right: 10 },
      })

      // ── Pie de página ──────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const H = doc.internal.pageSize.getHeight()
        doc.setFillColor(...MARRON)
        doc.rect(0, H - 12, W, 12, 'F')
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(...DORADO2)
        doc.text('La Gloria - Documento confidencial para uso del cliente', 14, H - 5)
        doc.text(`Página ${i} de ${pageCount}`, W - 14, H - 5, { align: 'right' })
      }

      const nombre = todosModo
        ? `estado-cuenta-todos_${expDesde}_${expHasta}.pdf`
        : `estado-cuenta_${expClienteNombre.replace(/\s+/g,'-')}_${expDesde}_${expHasta}.pdf`

      doc.save(nombre)
    } catch (e) {
      console.error(e)
      alert('Error al generar PDF')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={s.root}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>ÑG</div>
          <span style={s.navTitulo}>Dashboard</span>
          <span style={s.navSub}>{user?.name}</span>
        </div>
        <div style={s.navCenter}>
          {PERIODOS.map((p) => (
            <button key={p.val} onClick={() => setPeriodo(p.val)}
              style={{...s.periodoBtn, ...(periodo===p.val ? s.periodoBtnOn : {})}}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={s.navRight}>
          <button onClick={abrirExport} style={s.navBtn}>📥 Exportar CC</button>
          <button onClick={() => navigate('/admin/reporte-ventas')} style={s.navBtn}>🧾 Ventas</button>
          <button onClick={() => navigate('/configuracion')} style={s.navBtn}>⚙️ Config</button>
          <button onClick={handleLogout} style={s.navLogout}>Salir</button>
        </div>
      </nav>

      {cargando ? (
        <div style={s.loading}>Cargando datos…</div>
      ) : (
        <div style={s.body}>

          {/* ── Tarjetas resumen ── */}
          <div style={s.cards}>
            <div style={{...s.card, borderTop:'3px solid #1a7a4a'}}>
              <span style={s.cardLabel}>Ventas cobradas</span>
              <span style={{...s.cardVal, color:'#1a7a4a'}}>{fmt(datos.totalVentas)}</span>
              <span style={s.cardSub}>{datos.cantTickets} tickets</span>
            </div>
            <div style={{...s.card, borderTop:'3px solid #185FA5'}}>
              <span style={s.cardLabel}>Ventas a crédito</span>
              <span style={{...s.cardVal, color:'#185FA5'}}>{fmt(datos.totalCredito)}</span>
              <span style={s.cardSub}>pendiente en cuentas</span>
            </div>
            <div style={{...s.card, borderTop:'3px solid #c0392b'}}>
              <span style={s.cardLabel}>Gastos del turno</span>
              <span style={{...s.cardVal, color:'#c0392b'}}>{fmt(datos.totalGastos)}</span>
              <span style={s.cardSub}>egresos registrados</span>
            </div>
            <div style={{...s.card, borderTop:'3px solid #b8732a'}}>
              <span style={s.cardLabel}>Neto (ventas − gastos)</span>
              <span style={{...s.cardVal, color: datos.neto >= 0 ? '#1a7a4a' : '#c0392b'}}>
                {fmt(datos.neto)}
              </span>
              <span style={s.cardSub}>resultado del período</span>
            </div>
          </div>

          <div style={s.grid}>
            {/* ── Top productos ── */}
            <div style={s.panel}>
              <h3 style={s.panelTitulo}>🏆 Top productos</h3>
              {datos.topProductos.length === 0 ? (
                <p style={s.vacio}>Sin datos</p>
              ) : (
                <div style={s.barras}>
                  {datos.topProductos.map((p, i) => (
                    <div key={i} style={s.barraRow}>
                      <span style={s.barraLabel}>{p.nombre}</span>
                      <div style={s.barraTrack}>
                        <div style={{
                          ...s.barraFill,
                          width: `${(p.total / maxProd) * 100}%`,
                          background: i === 0 ? '#b8732a' : i < 3 ? '#d4964a' : '#e8c090',
                        }} />
                      </div>
                      <span style={s.barraVal}>{fmt(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Forma de pago ── */}
            <div style={s.panel}>
              <h3 style={s.panelTitulo}>💳 Por forma de pago</h3>
              {Object.keys(datos.pagoMap).length === 0 ? (
                <p style={s.vacio}>Sin datos</p>
              ) : (
                <div style={s.pagoList}>
                  {Object.entries(datos.pagoMap).map(([fp, monto]) => {
                    const icons = { efectivo:'💵', tarjeta:'💳', transferencia:'🏦', credito:'📋', pendiente:'⏳', mixto:'🔀' }
                    const colors = { efectivo:'#1a7a4a', tarjeta:'#185FA5', transferencia:'#6b4f2a', credito:'#c0392b', pendiente:'#b36a00', mixto:'#5a3a7a' }
                    return (
                      <div key={fp} style={s.pagoRow}>
                        <span style={s.pagoIcon}>{icons[fp] || '💰'}</span>
                        <span style={s.pagoNombre}>{fp.charAt(0).toUpperCase()+fp.slice(1)}</span>
                        <span style={{...s.pagoMonto, color: colors[fp]||'#2c1a08'}}>{fmt(monto)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Deudores ── */}
            <div style={s.panel}>
              <h3 style={s.panelTitulo}>⚠️ Cuentas por cobrar</h3>
              <div style={s.deudaTotal}>
                <span style={s.deudaTotalLabel}>Total deuda</span>
                <span style={s.deudaTotalVal}>{fmt(datos.totalDeuda)}</span>
              </div>
              {datos.deudores.length === 0 ? (
                <p style={s.vacio}>Sin deudores</p>
              ) : (
                datos.deudores.map((c, i) => (
                  <div key={i} style={s.deudorRow}>
                    <span style={s.deudorNombre}>{c.nombre}</span>
                    <span style={s.deudorMonto}>{fmt(c.saldo)}</span>
                  </div>
                ))
              )}
            </div>

            {/* ── Últimos tickets ── */}
            <div style={{...s.panel, gridColumn:'span 2'}}>
              <h3 style={s.panelTitulo}>🧾 Últimos tickets cobrados</h3>
              {datos.ultimosTickets.length === 0 ? (
                <p style={s.vacio}>Sin tickets</p>
              ) : (
                <table style={s.tabla}>
                  <thead>
                    <tr>
                      {['N° Ticket','Cliente','Forma pago','Total','Hora'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.ultimosTickets.map((t, i) => (
                      <tr key={t.id} style={{ background: i%2===0?'#fff':'#faf7f2' }}>
                        <td style={s.td}>
                          <span style={s.ticketNum}>#{t.numero_ticket}</span>
                        </td>
                        <td style={s.td}>{t.cliente?.nombre || <span style={{color:'#8a7560'}}>Casual</span>}</td>
                        <td style={s.td}>{t.forma_pago}</td>
                        <td style={{...s.td, fontWeight:700, color:'#1a7a4a'}}>{fmt(t.total)}</td>
                        <td style={{...s.td, color:'#8a7560', fontSize:11}}>
                          {new Date(t.fecha_hora).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal exportar cuenta corriente ── */}
      {modalExport && (
        <div style={sx.overlay}>
          <div style={sx.modal}>
            <div style={sx.modalHeader}>
              <h3 style={sx.modalTitulo}>📥 Exportar Cuenta Corriente</h3>
              <button onClick={() => setModalExport(false)} style={sx.closeBtn}>✕</button>
            </div>
            <div style={sx.modalBody}>
              <div style={sx.field}>
                <label style={sx.label}>Desde *</label>
                <input type="date" value={expDesde} onChange={(e) => setExpDesde(e.target.value)} style={sx.input} />
              </div>
              <div style={sx.field}>
                <label style={sx.label}>Hasta *</label>
                <input type="date" value={expHasta} onChange={(e) => setExpHasta(e.target.value)} style={sx.input} />
              </div>
              <div style={sx.field}>
                <label style={sx.label}>Cliente (opcional — vacío = todos)</label>
                <input
                  type="text"
                  value={expBusqueda}
                  onChange={(e) => buscarClienteExp(e.target.value)}
                  placeholder="Buscar por nombre o CI…"
                  style={sx.input}
                />
                {expResultados.length > 0 && (
                  <div style={sx.dropdown}>
                    {expResultados.map((c) => (
                      <button key={c.id} onClick={() => selClienteExp(c)} style={sx.dropItem}>
                        <span style={{fontWeight:600}}>{c.nombre}</span>
                        {c.documento && <span style={{fontSize:11,color:'#8a7560'}}> · CI: {c.documento}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {expCliente && (
                  <div style={sx.clienteSel}>
                    ✓ {expClienteNombre}
                    <button onClick={() => { setExpCliente(''); setExpClienteNombre(''); setExpBusqueda(''); setExpResultados([]) }} style={sx.clearBtn}>✕</button>
                  </div>
                )}
              </div>
            </div>
            <div style={sx.modalFooter}>
              <button onClick={() => setModalExport(false)} style={sx.cancelBtn}>Cancelar</button>
              <button onClick={exportarCC} disabled={exportando || !expDesde || !expHasta} style={sx.exportBtn}>
                {exportando ? 'Generando…' : '📊 Excel'}
              </button>
              <button onClick={exportarPDF} disabled={exportando || !expDesde || !expHasta} style={{...sx.exportBtn, background:'#c0392b'}}>
                {exportando ? 'Generando…' : '📄 PDF'}
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
  nav: { background:'#2c1a08', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.2rem', height:54, flexShrink:0, gap:'1rem' },
  navLeft: { display:'flex', alignItems:'center', gap:'0.8rem', flexShrink:0 },
  navLogo: { width:32, height:32, background:'#b8732a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 },
  navTitulo: { fontSize:15, fontWeight:700 },
  navSub: { fontSize:12, color:'#c9b99a' },
  navCenter: { display:'flex', gap:'0.4rem' },
  navRight: { display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0 },
  navBtn: { background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:500 },
  navLogout: { background:'transparent', border:'1px solid #c0392b', color:'#f5c6c6', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12 },
  periodoBtn: { padding:'5px 14px', border:'1px solid rgba(255,255,255,0.25)', borderRadius:16, background:'transparent', color:'#e0d0bb', cursor:'pointer', fontSize:12 },
  periodoBtnOn: { background:'#b8732a', color:'#fff', border:'1px solid #b8732a' },
  loading: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#8a7560', fontSize:14 },
  body: { flex:1, padding:'1.2rem', display:'flex', flexDirection:'column', gap:'1rem' },

  cards: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem' },
  card: { background:'#fff', borderRadius:12, padding:'1rem 1.2rem', display:'flex', flexDirection:'column', gap:4, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  cardLabel: { fontSize:11, fontWeight:600, color:'#8a7560', textTransform:'uppercase', letterSpacing:'0.06em' },
  cardVal: { fontSize:22, fontWeight:800, color:'#2c1a08' },
  cardSub: { fontSize:11, color:'#8a7560' },

  grid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', flex:1 },
  panel: { background:'#fff', borderRadius:12, padding:'1.2rem', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', gap:'0.6rem' },
  panelTitulo: { margin:0, fontSize:14, fontWeight:700, color:'#2c1a08', paddingBottom:'0.4rem', borderBottom:'1px solid #f0e8dc' },
  vacio: { color:'#8a7560', fontSize:13, textAlign:'center', padding:'1rem 0', margin:0 },

  barras: { display:'flex', flexDirection:'column', gap:'0.5rem', flex:1 },
  barraRow: { display:'flex', alignItems:'center', gap:'0.5rem' },
  barraLabel: { fontSize:11, color:'#4a3520', width:120, flexShrink:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  barraTrack: { flex:1, background:'#f5f0ea', borderRadius:4, height:8, overflow:'hidden' },
  barraFill: { height:'100%', borderRadius:4, transition:'width 0.6s ease' },
  barraVal: { fontSize:11, fontWeight:700, color:'#b8732a', width:90, textAlign:'right', flexShrink:0 },

  pagoList: { display:'flex', flexDirection:'column', gap:'0.4rem' },
  pagoRow: { display:'flex', alignItems:'center', gap:'0.6rem', padding:'6px 0', borderBottom:'1px solid #f5f0ea' },
  pagoIcon: { fontSize:16 },
  pagoNombre: { flex:1, fontSize:13, color:'#4a3520' },
  pagoMonto: { fontSize:14, fontWeight:700 },

  deudaTotal: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fdf0ef', borderRadius:8, padding:'6px 10px', marginBottom:'0.2rem' },
  deudaTotalLabel: { fontSize:12, fontWeight:600, color:'#6b4f2a' },
  deudaTotalVal: { fontSize:16, fontWeight:800, color:'#c0392b' },
  deudorRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f5f0ea' },
  deudorNombre: { fontSize:12, color:'#2c1a08', flex:1 },
  deudorMonto: { fontSize:13, fontWeight:700, color:'#c0392b' },

  tabla: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { padding:'6px 10px', background:'#f5f0ea', color:'#4a3520', fontWeight:600, textAlign:'left', borderBottom:'1px solid #e8e0d0' },
  td: { padding:'7px 10px', borderBottom:'1px solid #f5f0ea', color:'#2c1a08' },
  ticketNum: { fontWeight:700, color:'#b8732a' },
}

const sx = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' },
  modal: { background:'#fff', borderRadius:14, width:'100%', maxWidth:420 },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.2rem', borderBottom:'1px solid #e8e0d0' },
  modalTitulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  closeBtn: { background:'transparent', border:'none', fontSize:18, cursor:'pointer', color:'#8a7560' },
  modalBody: { padding:'1.2rem', display:'flex', flexDirection:'column', gap:'0.8rem' },
  field: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:12, fontWeight:600, color:'#4a3520' },
  input: { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6' },
  modalFooter: { display:'flex', justifyContent:'flex-end', gap:'0.6rem', padding:'0.8rem 1.2rem', borderTop:'1px solid #e8e0d0' },
  cancelBtn: { padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 },
  exportBtn: { padding:'8px 20px', background:'#1a7a4a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 },
  dropdown: { border:'1px solid #ddd0be', borderRadius:7, background:'#fff', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', maxHeight:180, overflowY:'auto' },
  dropItem: { padding:'8px 12px', border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontSize:13, borderBottom:'1px solid #f5f0ea' },
  clienteSel: { fontSize:12, color:'#1a7a4a', background:'#f0fdf4', border:'1px solid #a9dfbf', borderRadius:6, padding:'5px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  clearBtn: { background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:13 },
}
