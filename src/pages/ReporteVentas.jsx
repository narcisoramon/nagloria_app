import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'
import logger from '../utils/logger'
import { alertar } from '../utils/alertify'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmt = (n) => 'Gs. ' + Math.round(parseFloat(n) || 0).toLocaleString('es-PY')
const fmtGs = (n) => 'Gs. ' + Math.round(parseFloat(n) || 0).toLocaleString('es-PY')

function hoy() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const saldoPendienteReal = (t) => {
  return parseFloat(t.saldo_pendiente_real ?? t.saldo_pendiente ?? 0) || 0
}

const estadoCuenta = (t) => {
  if (t.estado === 'anulado') return 'ANULADO'

  if (t.estado_reporte) return String(t.estado_reporte).toUpperCase()
  if (t.estado_cuenta) return String(t.estado_cuenta).toUpperCase()

  const saldo = saldoPendienteReal(t)

  if (t.tipo_venta === 'credito' && saldo > 0) return 'PENDIENTE'

  if (t.estado === 'pendiente') return 'PENDIENTE'

  return 'PAGADO'
}

const colorEstadoCuenta = (t) => {
  const estado = estadoCuenta(t)

  if (estado === 'ANULADO') {
    return {
      background: '#f5f5f5',
      color: '#8a7560',
      border: '1px solid #ddd',
    }
  }

  if (estado === 'PENDIENTE') {
    return {
      background: '#fdf0ef',
      color: '#c0392b',
      border: '1px solid #f3b7b0',
    }
  }

  return {
    background: '#f0fdf4',
    color: '#1a7a4a',
    border: '1px solid #b8e6c5',
  }
}

const nombreFormaPago = (fp) => {
  if (!fp) return '—'

  const nombres = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    credito: 'Crédito',
    mixto: 'Mixto',
  }

  return nombres[fp] || String(fp).charAt(0).toUpperCase() + String(fp).slice(1)
}

const nombreTipoVenta = (tipo) => {
  if (!tipo) return '—'

  const nombres = {
    contado: 'Contado',
    credito: 'Crédito',
  }

  return nombres[tipo] || String(tipo).charAt(0).toUpperCase() + String(tipo).slice(1)
}

export default function ReporteVentas() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { limpiar } = useCajaStore()

  const [desde, setDesde] = useState(() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Asuncion' }))
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  })

  const [hasta, setHasta] = useState(hoy)
  const [formaPago, setFormaPago] = useState('')
  const [tipoVenta, setTipoVenta] = useState('')
  const [estado, setEstado] = useState('')
  const [tickets, setTickets] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)

  const POR_PAGINA = 20

const buscar = async () => {
  setBuscando(true)
  setBuscado(false)
  setPaginaActual(1)

  try {
    const params = {
      desde,
      hasta,
      per_page: 500,
    }

    if (formaPago) params.forma_pago = formaPago
    if (tipoVenta) params.tipo_venta = tipoVenta

    // IMPORTANTE:
    // No enviamos "estado" al backend porque este filtro corresponde
    // al estado de cuenta calculado: PAGADO, PENDIENTE, ANULADO.
    // El backend filtra por estado real del ticket y por eso no traía resultados.

    const { data } = await client.get('/tickets', { params })

    let lista = data.data || data || []
    lista = Array.isArray(lista) ? lista : []

    if (estado) {
      lista = lista.filter((t) => {
        const e = estadoCuenta(t).toLowerCase()

        if (estado === 'pendiente') return e === 'pendiente'
        if (estado === 'pagado') return e === 'pagado'
        if (estado === 'anulado') return e === 'anulado'

        return true
      })
    }

    setTickets(lista)
    setBuscado(true)
  } catch (e) {
    logger.error(e)
    alertar('No se pudo obtener el reporte de ventas.')
  } finally {
    setBuscando(false)
  }
}

  const totalVentas = tickets.reduce((s, t) => s + (parseFloat(t.total) || 0), 0)

  const totalCobrado = tickets.reduce((s, t) => {
    const saldo = saldoPendienteReal(t)
    const total = parseFloat(t.total) || 0

    if (t.estado === 'anulado') return s

    if (t.tipo_venta === 'credito') {
      return s + Math.max(total - saldo, 0)
    }

    return s + (parseFloat(t.monto_pagado) || total)
  }, 0)

  const totalPendiente = tickets.reduce((s, t) => {
    if (t.estado === 'anulado') return s
    return s + saldoPendienteReal(t)
  }, 0)

  const promedio = tickets.length ? totalVentas / tickets.length : 0

  const ticketsPendientes = tickets.filter((t) => estadoCuenta(t) === 'PENDIENTE').length
  const ticketsPagados = tickets.filter((t) => estadoCuenta(t) === 'PAGADO').length
  const ticketsAnulados = tickets.filter((t) => estadoCuenta(t) === 'ANULADO').length

  const porFormaPago = tickets.reduce((acc, t) => {
    const fp = t.forma_pago || 'sin_definir'
    acc[fp] = (acc[fp] || 0) + (parseFloat(t.total) || 0)
    return acc
  }, {})

  const totalPaginas = Math.ceil(tickets.length / POR_PAGINA)
  const ticketsPagina = tickets.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  )

  const exportarExcel = () => {
    if (!tickets.length) return

    setExportando(true)

    try {
      const filas = tickets.map((t) => ({
        'N° Ticket': t.numero_ticket,
        'Fecha': new Date(t.fecha_hora).toLocaleString('es-PY'),
        'Cliente': t.cliente?.nombre || 'Casual',
        'Tipo venta': nombreTipoVenta(t.tipo_venta),
        'Forma pago': nombreFormaPago(t.forma_pago),
        'Productos': t.detalles?.map((d) => d.descripcion).join(', ') || '—',
        'Subtotal (Gs.)': Math.round(parseFloat(t.subtotal) || 0),
        'Descuento (Gs.)': Math.round(parseFloat(t.descuento) || 0),
        'Total (Gs.)': Math.round(parseFloat(t.total) || 0),
        'Monto cobrado (Gs.)': Math.round(
          t.tipo_venta === 'credito'
            ? Math.max((parseFloat(t.total) || 0) - saldoPendienteReal(t), 0)
            : parseFloat(t.monto_pagado || t.total) || 0
        ),
        'Saldo pendiente (Gs.)': Math.round(saldoPendienteReal(t)),
        'Estado ticket': t.estado,
        'Estado cuenta': estadoCuenta(t),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet([])

      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ['ÑA GLORIA - Reporte de Ventas'],
          [`Período: ${desde} al ${hasta}`],
          [
            `Total tickets: ${tickets.length} | Total ventas: ${fmtGs(totalVentas)} | Total cobrado: ${fmtGs(totalCobrado)} | Saldo pendiente: ${fmtGs(totalPendiente)}`,
          ],
          [
            `Pagados: ${ticketsPagados} | Pendientes: ${ticketsPendientes} | Anulados: ${ticketsAnulados}`,
          ],
          [],
        ],
        { origin: 'A1' }
      )

      XLSX.utils.sheet_add_json(ws, filas, { origin: 'A6' })

      ws['!cols'] = [
        { wch: 12 },
        { wch: 22 },
        { wch: 28 },
        { wch: 14 },
        { wch: 16 },
        { wch: 42 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 18 },
      ]

      const filaPie = 6 + tickets.length + 2

      XLSX.utils.sheet_add_aoa(
        ws,
        [
          ['', '', '', '', '', 'TOTALES', '', '', Math.round(totalVentas), Math.round(totalCobrado), Math.round(totalPendiente), '', ''],
        ],
        { origin: { r: filaPie, c: 0 } }
      )

      XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
      XLSX.writeFile(wb, `reporte-ventas_${desde}_${hasta}.xlsx`)
    } finally {
      setExportando(false)
    }
  }

  const exportarPDF = () => {
    if (!tickets.length) return

    setExportando(true)

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const W = doc.internal.pageSize.getWidth()

      const MARRON = [44, 26, 8]
      const DORADO = [184, 115, 42]
      const DORADO2 = [245, 230, 204]
      const VERDE = [26, 122, 74]
      const ROJO = [192, 57, 43]
      const BLANCO = [255, 255, 255]
      const GRIS = [245, 245, 245]

      doc.setFillColor(...MARRON)
      doc.rect(0, 0, W, 28, 'F')

      doc.setFillColor(...DORADO)
      doc.rect(0, 28, W, 2.5, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(...BLANCO)
      doc.text('ÑA GLORIA', 12, 12)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...DORADO2)
      doc.text('Restaurante & Comedor', 12, 18)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...BLANCO)
      doc.text('REPORTE DE VENTAS', W - 12, 11, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...DORADO2)
      doc.text(`Período: ${desde} al ${hasta}`, W - 12, 17, { align: 'right' })
      doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, W - 12, 22, { align: 'right' })

      const cards = [
        { label: 'Total Tickets', val: tickets.length, color: DORADO },
        { label: 'Total Ventas', val: fmtGs(totalVentas), color: VERDE },
        { label: 'Total Cobrado', val: fmtGs(totalCobrado), color: VERDE },
        { label: 'Saldo Pendiente', val: fmtGs(totalPendiente), color: ROJO },
      ]

      cards.forEach((c, i) => {
        const x = 12 + i * 69

        doc.setFillColor(...DORADO2)
        doc.roundedRect(x, 33, 65, 14, 2, 2, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(100, 80, 40)
        doc.text(c.label.toUpperCase(), x + 4, 39)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...c.color)
        doc.text(String(c.val), x + 4, 44)
      })

      let xFP = 12
      const yFP = 50

      Object.entries(porFormaPago).forEach(([fp, monto]) => {
        doc.setFillColor(...GRIS)
        doc.roundedRect(xFP, yFP, 48, 8, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...MARRON)
        doc.text(`${nombreFormaPago(fp)}: ${fmtGs(monto)}`, xFP + 3, yFP + 5)

        xFP += 51
      })

      autoTable(doc, {
        startY: 62,
        head: [[
          'N° Ticket',
          'Fecha',
          'Cliente',
          'Tipo',
          'Forma Pago',
          'Productos',
          'Total',
          'Cobrado',
          'Saldo',
          'Estado',
        ]],
        body: tickets.map((t) => {
          const total = parseFloat(t.total) || 0
          const saldo = saldoPendienteReal(t)
          const cobrado = t.tipo_venta === 'credito'
            ? Math.max(total - saldo, 0)
            : parseFloat(t.monto_pagado || t.total) || 0

          return [
            t.numero_ticket,
            new Date(t.fecha_hora).toLocaleString('es-PY', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            t.cliente?.nombre || 'Casual',
            nombreTipoVenta(t.tipo_venta),
            nombreFormaPago(t.forma_pago),
            (t.detalles || [])
              .slice(0, 3)
              .map((d) => d.descripcion)
              .join(', ') + (t.detalles?.length > 3 ? ` +${t.detalles.length - 3}…` : ''),
            fmtGs(total),
            fmtGs(cobrado),
            fmtGs(saldo),
            estadoCuenta(t),
          ]
        }),
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 6.6,
          cellPadding: 1.8,
          valign: 'middle',
        },
        headStyles: {
          fillColor: DORADO,
          textColor: BLANCO,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 32 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 58 },
          6: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: VERDE },
          7: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: VERDE },
          8: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: ROJO },
          9: { cellWidth: 23, halign: 'center', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: GRIS,
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            data.cell.styles.textColor = data.cell.raw === 'Crédito' ? ROJO : VERDE
          }

          if (data.section === 'body' && data.column.index === 9) {
            if (data.cell.raw === 'PENDIENTE') {
              data.cell.styles.textColor = ROJO
            } else if (data.cell.raw === 'PAGADO') {
              data.cell.styles.textColor = VERDE
            } else {
              data.cell.styles.textColor = [120, 120, 120]
            }
          }
        },
        foot: [[
          '',
          '',
          '',
          '',
          '',
          `TOTAL (${tickets.length} tickets)`,
          fmtGs(totalVentas),
          fmtGs(totalCobrado),
          fmtGs(totalPendiente),
          '',
        ]],
        footStyles: {
          fillColor: DORADO2,
          textColor: MARRON,
          fontStyle: 'bold',
          halign: 'right',
          fontSize: 7.5,
        },
        margin: {
          left: 12,
          right: 12,
        },
      })

      const pages = doc.internal.getNumberOfPages()

      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)

        const H = doc.internal.pageSize.getHeight()

        doc.setFillColor(...MARRON)
        doc.rect(0, H - 10, W, 10, 'F')

        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(...DORADO2)
        doc.text('ÑA GLORIA - Reporte de Ventas', 12, H - 4)
        doc.text(`Página ${i} de ${pages}`, W - 12, H - 4, { align: 'right' })
      }

      doc.save(`reporte-ventas_${desde}_${hasta}.pdf`)
    } catch (e) {
      logger.error(e)
      alertar('No se pudo generar el PDF.')
    } finally {
      setExportando(false)
    }
  }

  const limpiarFiltros = () => {
    setFormaPago('')
    setTipoVenta('')
    setEstado('')
    setPaginaActual(1)
  }

  const handleLogout = async () => {
    await logout()
    limpiar()
    navigate('/login', { replace: true })
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>ÑA</div>
          <span style={s.navTitulo}>Reporte de Ventas</span>
        </div>

        <div style={s.navRight}>
          <button onClick={() => navigate('/admin/dashboard')} style={s.navBtn}>
            📊 Dashboard
          </button>
          <button onClick={() => navigate('/configuracion')} style={s.navBtn}>
            ⚙️ Config
          </button>
          <button onClick={handleLogout} style={s.navLogout}>
            Salir
          </button>
        </div>
      </nav>

      <div style={s.filtrosBar}>
        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            style={s.filtroInput}
          />
        </div>

        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            style={s.filtroInput}
          />
        </div>

        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Forma de pago</label>
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            style={s.filtroInput}
          >
            <option value="">Todas</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="credito">Crédito</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>

        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Tipo de venta</label>
          <select
            value={tipoVenta}
            onChange={(e) => setTipoVenta(e.target.value)}
            style={s.filtroInput}
          >
            <option value="">Todos</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </select>
        </div>

        <div style={s.filtroGroup}>
          <label style={s.filtroLabel}>Estado cuenta</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={s.filtroInput}
          >
            <option value="">Todos</option>
            <option value="pagado">Pagados</option>
            <option value="pendiente">Pendientes</option>
            <option value="anulado">Anulados</option>
          </select>
        </div>

        <button onClick={buscar} disabled={buscando} style={s.btnBuscar}>
          {buscando ? 'Buscando…' : '🔍 Buscar'}
        </button>

        <button onClick={limpiarFiltros} disabled={buscando} style={s.btnLimpiar}>
          Limpiar
        </button>
      </div>

      {buscado && (
        <>
          <div style={s.cards}>
            <div style={s.card}>
              <span style={s.cardLabel}>Tickets</span>
              <span style={{ ...s.cardVal, color: '#b8732a' }}>{tickets.length}</span>
              <span style={s.cardSub}>encontrados</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Total ventas</span>
              <span style={{ ...s.cardVal, color: '#1a7a4a' }}>{fmt(totalVentas)}</span>
              <span style={s.cardSub}>suma de tickets</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Total cobrado</span>
              <span style={{ ...s.cardVal, color: '#185FA5' }}>{fmt(totalCobrado)}</span>
              <span style={s.cardSub}>monto recibido</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Saldo pendiente</span>
              <span style={{ ...s.cardVal, color: '#c0392b' }}>{fmt(totalPendiente)}</span>
              <span style={s.cardSub}>créditos por cobrar</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Promedio</span>
              <span style={{ ...s.cardVal, color: '#6b4f2a' }}>{fmt(promedio)}</span>
              <span style={s.cardSub}>por ticket</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Pagados</span>
              <span style={{ ...s.cardVal, color: '#1a7a4a' }}>{ticketsPagados}</span>
              <span style={s.cardSub}>estado cuenta</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Pendientes</span>
              <span style={{ ...s.cardVal, color: '#c0392b' }}>{ticketsPendientes}</span>
              <span style={s.cardSub}>estado cuenta</span>
            </div>

            <div style={s.card}>
              <span style={s.cardLabel}>Anulados</span>
              <span style={{ ...s.cardVal, color: '#8a7560' }}>{ticketsAnulados}</span>
              <span style={s.cardSub}>sin efecto</span>
            </div>
          </div>

          {Object.keys(porFormaPago).length > 0 && (
            <div style={s.fpBar}>
              {Object.entries(porFormaPago).map(([fp, monto]) => {
                const icons = {
                  efectivo: '💵',
                  tarjeta: '💳',
                  transferencia: '🏦',
                  credito: '📋',
                  mixto: '🔀',
                  sin_definir: '💰',
                }

                const colors = {
                  efectivo: '#1a7a4a',
                  tarjeta: '#185FA5',
                  transferencia: '#6b4f2a',
                  credito: '#c0392b',
                  mixto: '#5a3a7a',
                  sin_definir: '#2c1a08',
                }

                return (
                  <div key={fp} style={s.fpItem}>
                    <span style={s.fpIcon}>{icons[fp] || '💰'}</span>
                    <span style={s.fpNombre}>{nombreFormaPago(fp)}</span>
                    <span style={{ ...s.fpMonto, color: colors[fp] || '#2c1a08' }}>
                      {fmt(monto)}
                    </span>
                  </div>
                )
              })}

              <div style={s.exportBtns}>
                <button onClick={exportarExcel} disabled={exportando} style={s.btnExcel}>
                  📊 Excel
                </button>
                <button onClick={exportarPDF} disabled={exportando} style={s.btnPDF}>
                  📄 PDF
                </button>
              </div>
            </div>
          )}

          <div style={s.tablaWrap}>
            {tickets.length === 0 ? (
              <div style={s.vacio}>Sin tickets en el período seleccionado</div>
            ) : (
              <>
                <table style={s.tabla}>
                  <thead>
                    <tr>
                      {[
                        'N° Ticket',
                        'Fecha',
                        'Cliente',
                        'Tipo',
                        'Forma pago',
                        'Productos',
                        'Total',
                        'Cobrado',
                        'Saldo',
                        'Estado cuenta',
                      ].map((h) => (
                        <th key={h} style={s.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {ticketsPagina.map((t, i) => {
                      const total = parseFloat(t.total) || 0
                      const saldo = saldoPendienteReal(t)
                      const cobrado = t.tipo_venta === 'credito'
                        ? Math.max(total - saldo, 0)
                        : parseFloat(t.monto_pagado || t.total) || 0

                      return (
                        <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#faf7f2' }}>
                          <td style={{ ...s.td, fontWeight: 700, color: '#b8732a' }}>
                            #{t.numero_ticket}
                          </td>

                          <td style={{ ...s.td, fontSize: 11, color: '#6b4f2a' }}>
                            {new Date(t.fecha_hora).toLocaleString('es-PY', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td style={s.td}>
                            {t.cliente?.nombre || <span style={{ color: '#8a7560' }}>Casual</span>}
                          </td>

                          <td style={s.td}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 4,
                                padding: '2px 8px',
                                background: t.tipo_venta === 'credito' ? '#fdf0ef' : '#f0fdf4',
                                color: t.tipo_venta === 'credito' ? '#c0392b' : '#1a7a4a',
                              }}
                            >
                              {nombreTipoVenta(t.tipo_venta)}
                            </span>
                          </td>

                          <td style={s.td}>{nombreFormaPago(t.forma_pago)}</td>

                          <td style={{ ...s.td, fontSize: 11, maxWidth: 220 }}>
                            {(t.detalles || []).slice(0, 2).map((d) => d.descripcion).join(', ')}
                            {t.detalles?.length > 2 && ` +${t.detalles.length - 2} más`}
                          </td>

                          <td style={{ ...s.td, fontWeight: 700, color: '#1a7a4a', textAlign: 'right' }}>
                            {fmt(total)}
                          </td>

                          <td style={{ ...s.td, fontWeight: 700, color: '#185FA5', textAlign: 'right' }}>
                            {fmt(cobrado)}
                          </td>

                          <td
                            style={{
                              ...s.td,
                              fontWeight: 700,
                              color: saldo > 0 ? '#c0392b' : '#1a7a4a',
                              textAlign: 'right',
                            }}
                          >
                            {fmt(saldo)}
                          </td>

                          <td style={s.td}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                borderRadius: 4,
                                padding: '3px 7px',
                                whiteSpace: 'nowrap',
                                ...colorEstadoCuenta(t),
                              }}
                            >
                              {estadoCuenta(t)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          ...s.td,
                          fontWeight: 700,
                          textAlign: 'right',
                          color: '#2c1a08',
                          background: '#f5e6cc',
                        }}
                      >
                        TOTAL ({tickets.length} tickets)
                      </td>

                      <td
                        style={{
                          ...s.td,
                          fontWeight: 800,
                          color: '#1a7a4a',
                          fontSize: 15,
                          textAlign: 'right',
                          background: '#f5e6cc',
                        }}
                      >
                        {fmt(totalVentas)}
                      </td>

                      <td
                        style={{
                          ...s.td,
                          fontWeight: 800,
                          color: '#185FA5',
                          fontSize: 15,
                          textAlign: 'right',
                          background: '#f5e6cc',
                        }}
                      >
                        {fmt(totalCobrado)}
                      </td>

                      <td
                        style={{
                          ...s.td,
                          fontWeight: 800,
                          color: totalPendiente > 0 ? '#c0392b' : '#1a7a4a',
                          fontSize: 15,
                          textAlign: 'right',
                          background: '#f5e6cc',
                        }}
                      >
                        {fmt(totalPendiente)}
                      </td>

                      <td style={{ background: '#f5e6cc' }} />
                    </tr>
                  </tfoot>
                </table>

                {totalPaginas > 1 && (
                  <>
                    <div style={s.paginado}>
                      <button
                        onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                        disabled={paginaActual <= 1}
                        style={{
                          ...s.pageBtn,
                          ...(paginaActual <= 1 ? s.pageBtnDisabled : {}),
                        }}
                      >
                        ← Anterior
                      </button>

                      <div style={s.numerosPagina}>
                        {paginaActual > 3 && totalPaginas > 5 && (
                          <>
                            <button onClick={() => setPaginaActual(1)} style={s.pageNumberBtn}>
                              1
                            </button>
                            <span style={s.puntos}>...</span>
                          </>
                        )}

                        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                          .filter((n) => Math.abs(n - paginaActual) <= 2)
                          .map((n) => (
                            <button
                              key={n}
                              onClick={() => setPaginaActual(n)}
                              style={{
                                ...s.pageNumberBtn,
                                ...(paginaActual === n ? s.pageNumberBtnActive : {}),
                              }}
                            >
                              {n}
                            </button>
                          ))}

                        {paginaActual < totalPaginas - 2 && totalPaginas > 5 && (
                          <>
                            <span style={s.puntos}>...</span>
                            <button
                              onClick={() => setPaginaActual(totalPaginas)}
                              style={s.pageNumberBtn}
                            >
                              {totalPaginas}
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                        disabled={paginaActual >= totalPaginas}
                        style={{
                          ...s.pageBtn,
                          ...(paginaActual >= totalPaginas ? s.pageBtnDisabled : {}),
                        }}
                      >
                        Siguiente →
                      </button>
                    </div>

                    <div style={s.pageInfoMobile}>
                      Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong> ·
                      Mostrando {((paginaActual - 1) * POR_PAGINA) + 1}–
                      {Math.min(paginaActual * POR_PAGINA, tickets.length)} de {tickets.length}
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
          <p style={{ fontSize: 40, margin: 0 }}>📊</p>
          <p style={{ color: '#8a7560', fontSize: 14, margin: 0 }}>
            Seleccioná el período y pulsá Buscar
          </p>
        </div>
      )}
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f5f0ea',
    fontFamily: 'system-ui,sans-serif',
  },

  nav: {
    background: '#2c1a08',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.2rem',
    height: 50,
    flexShrink: 0,
  },

  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },

  navLogo: {
    width: 30,
    height: 30,
    background: '#b8732a',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
  },

  navTitulo: {
    fontSize: 15,
    fontWeight: 700,
  },

  navRight: {
    display: 'flex',
    gap: '0.6rem',
  },

  navBtn: {
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },

  navLogout: {
    background: 'transparent',
    border: '1px solid #c0392b',
    color: '#f5c6c6',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },

  filtrosBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.8rem',
    padding: '1rem 1.2rem',
    background: '#fff',
    borderBottom: '2px solid #e8e0d0',
    flexWrap: 'wrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },

  filtroGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  filtroLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#2c1a08',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  filtroInput: {
    padding: '8px 12px',
    border: '1.5px solid #ddd0be',
    borderRadius: 7,
    fontSize: 13,
    outline: 'none',
    background: '#fdfaf6',
    minWidth: 140,
    color: '#2c1a08',
  },

  btnBuscar: {
    padding: '9px 24px',
    background: '#b8732a',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    alignSelf: 'flex-end',
    boxShadow: '0 2px 6px rgba(184,115,42,0.3)',
  },

  btnLimpiar: {
    padding: '9px 18px',
    background: '#f5f0ea',
    color: '#4a3520',
    border: '1px solid #ddd0be',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    alignSelf: 'flex-end',
  },

  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    padding: '1rem 1.2rem 0',
  },

  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '0.8rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },

  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#8a7560',
    textTransform: 'uppercase',
  },

  cardVal: {
    fontSize: 20,
    fontWeight: 800,
  },

  cardSub: {
    fontSize: 11,
    color: '#8a7560',
  },

  fpBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.8rem 1.2rem',
    background: '#fff',
    margin: '0.8rem 1.2rem 0',
    borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    flexWrap: 'wrap',
  },

  fpItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '4px 10px',
    background: '#faf7f2',
    borderRadius: 8,
  },

  fpIcon: {
    fontSize: 14,
  },

  fpNombre: {
    fontSize: 12,
    color: '#4a3520',
    fontWeight: 500,
  },

  fpMonto: {
    fontSize: 13,
    fontWeight: 700,
  },

  exportBtns: {
    marginLeft: 'auto',
    display: 'flex',
    gap: '0.5rem',
  },

  btnExcel: {
    padding: '6px 14px',
    background: '#1a7a4a',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },

  btnPDF: {
    padding: '6px 14px',
    background: '#c0392b',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },

  tablaWrap: {
    flex: 1,
    overflowX: 'auto',
    padding: '0.8rem 1.2rem 1.2rem',
  },

  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },

  th: {
    padding: '8px 12px',
    background: '#f5f0ea',
    color: '#4a3520',
    fontWeight: 600,
    textAlign: 'left',
    borderBottom: '2px solid #e8e0d0',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '7px 12px',
    borderBottom: '1px solid #f5f0ea',
    color: '#2c1a08',
  },

  vacio: {
    textAlign: 'center',
    padding: '3rem',
    color: '#8a7560',
    fontSize: 13,
  },

  inicio: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },

  paginado: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.8rem',
    marginTop: '1rem',
    flexWrap: 'wrap',
  },

  numerosPagina: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },

  pageBtn: {
    padding: '7px 14px',
    background: '#b8732a',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },

  pageBtnDisabled: {
    background: '#d6c5b1',
    cursor: 'not-allowed',
    opacity: 0.7,
  },

  pageNumberBtn: {
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    background: '#fff',
    border: '1px solid #ddd0be',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    color: '#4a3520',
  },

  pageNumberBtnActive: {
    background: '#b8732a',
    borderColor: '#b8732a',
    color: '#fff',
    fontWeight: 700,
  },

  puntos: {
    color: '#8a7560',
    fontSize: 13,
    padding: '0 3px',
  },

  pageInfoMobile: {
    marginTop: '0.5rem',
    textAlign: 'center',
    fontSize: 13,
    color: '#4a3520',
  },
}