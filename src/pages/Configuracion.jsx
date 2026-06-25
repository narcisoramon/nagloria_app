import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import { getErrorMessage } from '../api/client'
import client from '../api/client'
import { Package, FolderTree, Scale, Users, UserCog, LayoutDashboard, LogOut } from 'lucide-react'
import { noti, confirmar } from '../utils/alertify'
import logger from '../utils/logger'

const fmt = (n) => Math.round(n || 0).toLocaleString('es-PY')

function Modal({ titulo, onClose, children }) {
  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ms.header}>
          <h3 style={ms.titulo}>{titulo}</h3>
          <button onClick={onClose} style={ms.closeBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ms = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'clamp(0.5rem, 3vw, 1rem)', boxSizing:'border-box' },
  modal: { background:'#fff', borderRadius:14, width:'100%', maxWidth:460, boxSizing:'border-box', maxHeight:'90vh', overflowY:'auto' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.2rem', borderBottom:'1px solid #e8e0d0' },
  titulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  closeBtn: { background:'transparent', border:'none', fontSize:18, cursor:'pointer', color:'#8a7560' },
}

function Tabla({ cols, rows, onEdit, onDelete, emptyMsg }) {
  if (rows.length === 0) return <p style={t.empty}>{emptyMsg || 'Sin registros'}</p>
  return (
    <div style={t.wrap}>
      <table style={t.table}>
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={t.th}>{c.label}</th>)}
            <th style={t.th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#faf7f2' }}>
              {cols.map((c) => <td key={c.key} style={t.td}>{c.render ? c.render(row) : row[c.key]}</td>)}
              <td style={t.td}>
                <div style={t.acciones}>
                  <button onClick={() => onEdit(row)} style={t.editBtn}>Editar</button>
                  {onDelete && <button onClick={() => onDelete(row)} style={t.delBtn}>Eliminar</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const t = {
  wrap: { overflowX:'auto', WebkitOverflowScrolling:'touch' },
  table: { width:'100%', minWidth:680, borderCollapse:'collapse', fontSize:13 },
  th: { padding:'8px 12px', background:'#f5f0ea', color:'#4a3520', fontWeight:600, textAlign:'left', borderBottom:'1px solid #e8e0d0' },
  td: { padding:'8px 12px', borderBottom:'1px solid #f0e8dc', color:'#2c1a08', verticalAlign:'middle' },
  acciones: { display:'flex', gap:4 },
  editBtn: { padding:'3px 10px', background:'#b8732a', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:12 },
  delBtn: { padding:'3px 10px', background:'transparent', color:'#c0392b', border:'1px solid #f5c6c6', borderRadius:5, cursor:'pointer', fontSize:12 },
  empty: { color:'#8a7560', fontSize:13, padding:'2rem', textAlign:'center' },
}

function Campo({ label, children }) {
  return (
    <div style={f.field}>
      <label style={f.label}>{label}</label>
      {children}
    </div>
  )
}

const f = {
  field: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:12, fontWeight:600, color:'#4a3520' },
}

function ConfirmModal({ mensaje, onConfirm, onCancel }) {
  return (
    <div style={ms.overlay} onClick={onCancel}>
      <div style={{...ms.modal, maxWidth: 380}} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#2c1a08', lineHeight: 1.5 }}>
            {mensaje}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={onCancel} style={{ padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 }}>Cancelar</button>
            <button onClick={onConfirm} style={{ padding:'8px 16px', background:'#c0392b', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}>Sí, confirmar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const confirmarToast = (mensaje, onConfirm) => {
  confirmar(mensaje, onConfirm)
}

const inputStyle = { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6', width:'100%', boxSizing:'border-box' }
const selectStyle = { ...inputStyle }
const formStyle = { display:'flex', flexDirection:'column', gap:'0.8rem', padding:'1.2rem' }
const formBtns = { display:'flex', justifyContent:'flex-end', gap:'0.6rem', marginTop:'0.4rem', flexWrap:'wrap' }
const btnPrimary = { padding:'8px 20px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }
const btnSecondary = { padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 }

function SecProductos() {
  const [rows, setRows] = useState([])
  const [cats, setCats] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => { cargarCategorias() }, [])

  useEffect(() => {
    const timer = setTimeout(() => { cargar(1, busqueda, perPage) }, 350)
    return () => clearTimeout(timer)
  }, [busqueda, perPage, filtroCategoria, filtroEstado])

  const cargarCategorias = async () => {
    try {
      const { data } = await client.get('/categorias-productos', { params: { per_page: 100 } })
      setCats(data.data || data || [])
    } catch (e) {
      logger.error('Error cargando categorías')
      setCats([])
      noti('error', 'Error al cargar categorías')
    }
  }

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)
    try {
      const { data } = await client.get('/productos', {
        params: {
          page: pagina,
          per_page: cantidad,
          buscar: buscar || undefined,
          categoria_producto_id: filtroCategoria || undefined,
          activo: filtroEstado !== '' ? filtroEstado : undefined,
        },
      })
      if (Array.isArray(data)) {
        setRows(data); setTotal(data.length); setPage(1); setLastPage(1)
      } else {
        setRows(data.data || []); setTotal(data.total || 0)
        setPage(data.current_page || pagina); setLastPage(data.last_page || 1)
      }
    } catch (e) {
      logger.error('Error cargando productos')
      setRows([]); setTotal(0); setPage(1); setLastPage(1)
      noti('error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const limpiarFiltros = () => { setBusqueda(''); setFiltroCategoria(''); setFiltroEstado(''); cargar(1, '', perPage) }

  const abrir = (row) => {
    setForm(
      row
        ? {
            ...row,
            precio: row.precio !== null && row.precio !== undefined
              ? String(Math.round(Number(row.precio)))
              : '',
          }
        : { nombre: '', categoria_producto_id: '', precio: '', tipo_venta: 'UNIDAD', usar_como_extra: false, activo: true }
    )
    setImagenFile(null)
    setImagenPreview(null)
    setModal(row ? 'editar' : 'nuevo')
    setError('')
  }

  const guardar = async () => {
    setError('')
    try {
      const basePayload = {
        categoria_producto_id: Number(form.categoria_producto_id),
        nombre: form.nombre,
        precio: Number(String(form.precio).replace(/\D/g, '') || 0),
        tipo_venta: form.tipo_venta,
        usar_como_extra: form.usar_como_extra ? 1 : 0,
        activo: form.activo ? 1 : 0,
        controla_stock: form.controla_stock ? 1 : 0,
      }

      if (imagenFile) {
        const fd = new FormData()
        Object.entries(basePayload).forEach(([key, val]) => {
          fd.append(key, val)
        })
        fd.append('imagen', imagenFile)

        if (form.id) {
          fd.append('_method', 'PUT')
          await client.post(`/productos/${form.id}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          await client.post('/productos', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }
      } else {
        const jsonPayload = {
          ...basePayload,
          usar_como_extra: Boolean(form.usar_como_extra),
          activo: Boolean(form.activo),
          controla_stock: Boolean(form.controla_stock),
        }
        if (form.id) {
          await client.put(`/productos/${form.id}`, jsonPayload)
        } else {
          await client.post('/productos', jsonPayload)
        }
      }

      setModal(null)
      noti('success', form.id ? 'Producto actualizado correctamente' : 'Producto registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      noti('error', msg)
    }
  }

  const eliminar = async (row) => {
    setConfirmDelete(row)
  }

  const confirmarEliminarProducto = async () => {
    if (!confirmDelete) return
    const row = confirmDelete
    setConfirmDelete(null)
    try {
      await client.delete(`/productos/${row.id}`)
      noti('success', 'Producto eliminado correctamente')
      const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
      cargar(nuevaPagina, busqueda, perPage)
    } catch (e) {
      noti('error', getErrorMessage(e))
    }
  }

  const cambiarEstado = async (row) => {
    const nuevoEstado = !row.activo
    confirmarToast(
      `¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} el producto "${row.nombre}"?`,
      async () => {
        try {
          await client.put(`/productos/${row.id}`, {
            categoria_producto_id: Number(row.categoria_producto_id),
            nombre: row.nombre,
            precio: Number(row.precio || 0),
            tipo_venta: row.tipo_venta,
            usar_como_extra: Boolean(row.usar_como_extra),
            controla_stock: Boolean(row.controla_stock ?? false),
            activo: nuevoEstado,
          })
          noti('success', `Producto ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`)
          cargar(page, busqueda, perPage)
        } catch (e) {
          noti('error', getErrorMessage(e))
        }
      }
    )
  }

  const cambiarExtraCaja = async (row) => {
    const nuevoValor = !Boolean(row.usar_como_extra)
    confirmarToast(
      `¿Desea ${nuevoValor ? 'mostrar' : 'ocultar'} el producto "${row.nombre}" como extra en caja?`,
      async () => {
        try {
          await client.put(`/productos/${row.id}`, {
            categoria_producto_id: Number(row.categoria_producto_id),
            nombre: row.nombre,
            precio: Number(row.precio || 0),
            tipo_venta: row.tipo_venta,
            usar_como_extra: nuevoValor,
            controla_stock: Boolean(row.controla_stock ?? false),
            activo: Boolean(row.activo),
          })
          noti('success', nuevoValor ? 'Producto habilitado como extra en caja' : 'Producto ocultado de extras en caja')
          cargar(page, busqueda, perPage)
        } catch (e) {
          noti('error', getErrorMessage(e))
        }
      }
    )
  }

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage) return
    cargar(nuevaPagina, busqueda, perPage)
  }

  const paginasVisibles = () => {
    const paginas = []
    const inicio = Math.max(1, page - 2)
    const fin = Math.min(lastPage, page + 2)
    for (let i = inicio; i <= fin; i++) paginas.push(i)
    return paginas
  }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)
  const hayFiltros = busqueda || filtroCategoria || filtroEstado !== ''

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <h3 style={sec.titulo}>Productos</h3>
          <p style={productosStyles.resumen}>
            {loading ? 'Cargando...' : `${total} producto${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nuevo</button>
      </div>

      <div style={cardStyles.filtros}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          style={cardStyles.searchInput}
        />
        <select
          value={filtroCategoria}
          onChange={(e) => { setFiltroCategoria(e.target.value); cargar(1) }}
          style={cardStyles.filterSelect}
        >
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); cargar(1) }}
          style={cardStyles.filterSelect}
        >
          <option value="">Todos los estados</option>
          <option value="1">Activos</option>
          <option value="0">Inactivos</option>
        </select>
        {hayFiltros && (
          <button onClick={limpiarFiltros} style={cardStyles.clearBtn}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <div style={cardStyles.loadingWrap}>
          <p style={{ color: '#8a7560', fontSize: 14 }}>Cargando productos...</p>
        </div>
      ) : rows.length === 0 ? (
        <div style={cardStyles.emptyWrap}>
          <span style={{ fontSize: 48, opacity: 0.2 }}>📦</span>
          <p style={{ color: '#8a7560', fontSize: 14, margin: '0.5rem 0 0' }}>
            {hayFiltros ? 'No se encontraron productos con esos filtros' : 'Sin productos registrados'}
          </p>
        </div>
      ) : (
        <div style={cardStyles.grid}>
          {rows.map((r) => (
            <div key={r.id} style={{ ...cardStyles.card, opacity: r.activo ? 1 : 0.65, borderStyle: r.activo ? 'solid' : 'dashed' }}>
              <div style={cardStyles.imgWrap}>
                {r.imagen_url ? (
                  <img src={r.imagen_url} alt={r.nombre} style={cardStyles.img} />
                ) : (
                  <div style={cardStyles.imgPlaceholder}>📦</div>
                )}
                <span style={{ ...cardStyles.badge, background: r.activo ? '#dcfce7' : '#fee2e2', color: r.activo ? '#166534' : '#991b1b' }}>
                  {r.activo ? 'Activo' : 'Inactivo'}
                </span>
                {Boolean(r.usar_como_extra) && (
                  <span style={cardStyles.badgeExtra}>★ Extra</span>
                )}
              </div>

              <div style={cardStyles.info}>
                {r.categoria_producto && (
                  <span style={cardStyles.catPill}>{r.categoria_producto.nombre}</span>
                )}
                <p style={cardStyles.nombre}>{r.nombre}</p>
                <p style={cardStyles.precio}>Gs. {fmt(r.precio)}</p>
                <span style={cardStyles.tipoPill}>
                  {r.tipo_venta === 'KILO' ? '⚖ Kilo' : '▣ Unidad'}
                </span>
              </div>

              <div style={cardStyles.acciones}>
                <button onClick={() => abrir(r)} style={cardStyles.editBtn}>Editar</button>
                <button
                  onClick={() => cambiarEstado(r)}
                  style={{ ...cardStyles.toggleBtn, color: r.activo ? '#c0392b' : '#1a7a4a', borderColor: r.activo ? '#f5c6c6' : '#a9dfbf' }}
                >
                  {r.activo ? 'Desact.' : 'Activar'}
                </button>
                <button onClick={() => eliminar(r)} style={cardStyles.delBtn} title="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div style={productosStyles.paginado}>
          <button onClick={() => irPagina(page - 1)} disabled={page <= 1 || loading}
            style={{ ...productosStyles.pageBtn, ...(page <= 1 || loading ? productosStyles.pageBtnDisabled : {}) }}>
            ← Anterior
          </button>
          <div style={productosStyles.numerosPagina}>
            {page > 3 && lastPage > 5 && (<><button onClick={() => irPagina(1)} style={productosStyles.pageNumberBtn}>1</button><span style={productosStyles.puntos}>...</span></>)}
            {paginasVisibles().map((n) => (
              <button key={n} onClick={() => irPagina(n)} disabled={loading}
                style={{ ...productosStyles.pageNumberBtn, ...(page === n ? productosStyles.pageNumberBtnActive : {}) }}>{n}</button>
            ))}
            {page < lastPage - 2 && lastPage > 5 && (<><span style={productosStyles.puntos}>...</span><button onClick={() => irPagina(lastPage)} style={productosStyles.pageNumberBtn}>{lastPage}</button></>)}
          </div>
          <button onClick={() => irPagina(page + 1)} disabled={page >= lastPage || loading}
            style={{ ...productosStyles.pageBtn, ...(page >= lastPage || loading ? productosStyles.pageBtnDisabled : {}) }}>
            Siguiente →
          </button>
        </div>
      )}
      <div style={productosStyles.pageInfoMobile}>
        {total > 0 && <>Mostrando {desde}–{hasta} de {total}</>}
      </div>

      {modal && (
        <Modal
          titulo={modal === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
          onClose={() => setModal(null)}
        >
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input
                value={form.nombre || ''}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                style={inputStyle}
              />
            </Campo>

            <Campo label="Foto del producto">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ padding: '8px 14px', background: '#f5f0ea', border: '1px solid #ddd0be', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#4a3520', whiteSpace: 'nowrap' }}>
                  {imagenFile ? 'Cambiar imagen' : 'Seleccionar imagen'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) { setImagenFile(file); setImagenPreview(URL.createObjectURL(file)) }
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                {(imagenPreview || form.imagen_url) && (
                  <button
                    onClick={() => { setImagenFile(null); setImagenPreview(null) }}
                    style={{ background: 'transparent', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  >
                    Quitar
                  </button>
                )}
              </div>
              {imagenPreview && (
                <img src={imagenPreview} alt="preview" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', marginTop: 6, border: '1px solid #e8e0d0' }} />
              )}
              {!imagenPreview && form.imagen_url && (
                <img src={form.imagen_url} alt={form.nombre} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', marginTop: 6, border: '1px solid #e8e0d0' }} />
              )}
            </Campo>

            <Campo label="Categoría *">
              <select
                value={form.categoria_producto_id || ''}
                onChange={(e) => setForm({ ...form, categoria_producto_id: e.target.value })}
                style={selectStyle}
              >
                <option value="">— Seleccionar —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Precio (Gs.) *">
              <input
                type="text"
                inputMode="numeric"
                value={
                  form.precio !== null && form.precio !== undefined && form.precio !== ''
                    ? Number(String(form.precio).replace(/\D/g, '')).toLocaleString('es-PY')
                    : ''
                }
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setForm({ ...form, precio: val }) }}
                style={inputStyle}
                placeholder="0"
              />
            </Campo>

            <Campo label="Tipo de venta *">
              <select
                value={form.tipo_venta || 'UNIDAD'}
                onChange={(e) => setForm({ ...form, tipo_venta: e.target.value })}
                style={selectStyle}
              >
                <option value="UNIDAD">Por unidad</option>
                <option value="KILO">Por kilo</option>
              </select>
            </Campo>

            <Campo label="Mostrar como extra en caja">
              <select
                value={form.usar_como_extra ? '1' : '0'}
                onChange={(e) => setForm({ ...form, usar_como_extra: e.target.value === '1' })}
                style={selectStyle}
              >
                <option value="1">Sí, mostrar en caja</option>
                <option value="0">No mostrar</option>
              </select>
            </Campo>

            <Campo label="Estado">
              <select
                value={form.activo ? '1' : '0'}
                onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })}
                style={selectStyle}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Campo>

            {error && <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>{error}</p>}

            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} style={btnPrimary}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          mensaje={`¿Eliminar "${confirmDelete.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={confirmarEliminarProducto}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function SecCategorias() {
  const [sub, setSub] = useState('productos')
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const url = sub === 'productos' ? '/categorias-productos' : '/categorias-gastos'

  useEffect(() => {
    const timer = setTimeout(() => { cargar(1, busqueda, perPage) }, 350)
    return () => clearTimeout(timer)
  }, [sub, busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)
    try {
      const { data } = await client.get(url, {
        params: { page: pagina, per_page: cantidad, buscar: buscar || undefined },
      })
      if (Array.isArray(data)) {
        setRows(data); setTotal(data.length); setPage(1); setLastPage(1)
      } else {
        setRows(data.data || []); setTotal(data.total || 0)
        setPage(data.current_page || pagina); setLastPage(data.last_page || 1)
      }
    } catch (e) {
      logger.error('Error cargando categorías')
      setRows([]); setTotal(0); setPage(1); setLastPage(1)
      noti('error', 'Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => { setBusqueda(''); cargar(1, '', perPage) }
  const abrir = (row) => { setForm(row ? { ...row } : { nombre: '', activo: true }); setModal(row ? 'editar' : 'nuevo'); setError('') }

  const guardar = async () => {
    setError('')
    try {
      if (form.id) { await client.put(`${url}/${form.id}`, form) }
      else { await client.post(url, form) }
      setModal(null)
      noti('success', form.id ? 'Categoría actualizada correctamente' : 'Categoría registrada correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg); noti('error', msg)
    }
  }

  const eliminar = async (row) => {
    confirmarToast(`¿Eliminar la categoría "${row.nombre}"?`, async () => {
      try {
        await client.delete(`${url}/${row.id}`)
        noti('success', 'Categoría eliminada correctamente')
        const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
        cargar(nuevaPagina, busqueda, perPage)
      } catch (e) {
        noti('error', getErrorMessage(e))
      }
    })
  }

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage) return
    cargar(nuevaPagina, busqueda, perPage)
  }

  const paginasVisibles = () => {
    const paginas = []
    const inicio = Math.max(1, page - 2)
    const fin = Math.min(lastPage, page + 2)
    for (let i = inicio; i <= fin; i++) paginas.push(i)
    return paginas
  }

  const cambiarSub = (nuevoSub) => { setSub(nuevoSub); setBusqueda(''); setPage(1); setTotal(0); setLastPage(1); setRows([]) }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['productos', 'gastos'].map((s) => (
              <button key={s} onClick={() => cambiarSub(s)}
                style={{ ...sec.subTab, ...(sub === s ? sec.subTabOn : {}) }}>
                {s === 'productos' ? 'Productos' : 'Gastos'}
              </button>
            ))}
          </div>
          <p style={categoriasStyles.resumen}>
            {loading ? 'Cargando categorías...' : `Mostrando ${desde} a ${hasta} de ${total} categorías`}
          </p>
        </div>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nueva</button>
      </div>

      <div style={categoriasStyles.filtros}>
        <div style={categoriasStyles.buscarBox}>
          <label style={categoriasStyles.label}>Buscar por nombre</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar categoría..." style={categoriasStyles.buscarInput} />
        </div>
        <div style={categoriasStyles.perPageBox}>
          <label style={categoriasStyles.label}>Mostrar</label>
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} style={categoriasStyles.select}>
            <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        <button onClick={limpiarBusqueda} disabled={!busqueda}
          style={{ ...categoriasStyles.clearBtn, opacity: !busqueda ? 0.5 : 1, cursor: !busqueda ? 'not-allowed' : 'pointer' }}>
          Limpiar
        </button>
      </div>

      {loading ? <p style={t.empty}>Cargando categorías...</p> : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'activo', label: 'Estado', render: (r) => <span style={{ color: r.activo ? '#1a7a4a' : '#c0392b' }}>{r.activo ? 'Activo' : 'Inactivo'}</span> },
          ]}
          rows={rows} onEdit={abrir} onDelete={eliminar}
          emptyMsg={busqueda ? 'No se encontraron categorías con ese nombre' : 'Sin categorías registradas'}
        />
      )}

      <div style={categoriasStyles.paginado}>
        <button onClick={() => irPagina(page - 1)} disabled={page <= 1 || loading}
          style={{ ...categoriasStyles.pageBtn, ...(page <= 1 || loading ? categoriasStyles.pageBtnDisabled : {}) }}>← Anterior</button>
        <div style={categoriasStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (<><button onClick={() => irPagina(1)} style={categoriasStyles.pageNumberBtn}>1</button><span style={categoriasStyles.puntos}>...</span></>)}
          {paginasVisibles().map((n) => (
            <button key={n} onClick={() => irPagina(n)} disabled={loading}
              style={{ ...categoriasStyles.pageNumberBtn, ...(page === n ? categoriasStyles.pageNumberBtnActive : {}) }}>{n}</button>
          ))}
          {page < lastPage - 2 && lastPage > 5 && (<><span style={categoriasStyles.puntos}>...</span><button onClick={() => irPagina(lastPage)} style={categoriasStyles.pageNumberBtn}>{lastPage}</button></>)}
        </div>
        <button onClick={() => irPagina(page + 1)} disabled={page >= lastPage || loading}
          style={{ ...categoriasStyles.pageBtn, ...(page >= lastPage || loading ? categoriasStyles.pageBtnDisabled : {}) }}>Siguiente →</button>
      </div>
      <div style={categoriasStyles.pageInfoMobile}>Página <strong>{page}</strong> de <strong>{lastPage}</strong></div>

      {modal && (
        <Modal titulo={modal === 'nuevo' ? 'Nueva categoría' : 'Editar categoría'} onClose={() => setModal(null)}>
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Estado">
              <select value={form.activo ? '1' : '0'} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })} style={selectStyle}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </select>
            </Campo>
            {error && <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} style={btnPrimary}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SecRecipientes() {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => { cargar(1, busqueda, perPage) }, 350)
    return () => clearTimeout(timer)
  }, [busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)
    try {
      const { data } = await client.get('/recipientes', {
        params: { page: pagina, per_page: cantidad, buscar: buscar || undefined },
      })
      if (Array.isArray(data)) {
        setRows(data); setTotal(data.length); setPage(1); setLastPage(1)
      } else {
        setRows(data.data || []); setTotal(data.total || 0)
        setPage(data.current_page || pagina); setLastPage(data.last_page || 1)
      }
    } catch (e) {
      logger.error('Error cargando recipientes')
      setRows([]); setTotal(0); setPage(1); setLastPage(1)
      noti('error', 'Error al cargar recipientes')
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => { setBusqueda(''); cargar(1, '', perPage) }
  const abrir = (row) => { setForm(row ? { ...row } : { nombre: '', tara_kg: '', activo: true }); setModal(row ? 'editar' : 'nuevo'); setError('') }

  const guardar = async () => {
    setError('')
    try {
      const payload = { ...form, tara_kg: parseFloat(form.tara_kg || 0) }
      if (form.id) { await client.put(`/recipientes/${form.id}`, payload) }
      else { await client.post('/recipientes', payload) }
      setModal(null)
      noti('success', form.id ? 'Recipiente actualizado correctamente' : 'Recipiente registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg); noti('error', msg)
    }
  }

  const eliminar = async (row) => {
    confirmarToast(`¿Eliminar el recipiente "${row.nombre}"?`, async () => {
      try {
        await client.delete(`/recipientes/${row.id}`)
        noti('success', 'Recipiente eliminado correctamente')
        const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
        cargar(nuevaPagina, busqueda, perPage)
      } catch (e) {
        noti('error', getErrorMessage(e))
      }
    })
  }

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage) return
    cargar(nuevaPagina, busqueda, perPage)
  }

  const paginasVisibles = () => {
    const paginas = []
    const inicio = Math.max(1, page - 2)
    const fin = Math.min(lastPage, page + 2)
    for (let i = inicio; i <= fin; i++) paginas.push(i)
    return paginas
  }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <h3 style={sec.titulo}>Recipientes</h3>
          <p style={recipientesStyles.resumen}>
            {loading ? 'Cargando recipientes...' : `Mostrando ${desde} a ${hasta} de ${total} recipientes`}
          </p>
        </div>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nuevo</button>
      </div>

      <div style={recipientesStyles.filtros}>
        <div style={recipientesStyles.buscarBox}>
          <label style={recipientesStyles.label}>Buscar por nombre</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar recipiente..." style={recipientesStyles.buscarInput} />
        </div>
        <div style={recipientesStyles.perPageBox}>
          <label style={recipientesStyles.label}>Mostrar</label>
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} style={recipientesStyles.select}>
            <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        <button onClick={limpiarBusqueda} disabled={!busqueda}
          style={{ ...recipientesStyles.clearBtn, opacity: !busqueda ? 0.5 : 1, cursor: !busqueda ? 'not-allowed' : 'pointer' }}>
          Limpiar
        </button>
      </div>

      {loading ? <p style={t.empty}>Cargando recipientes...</p> : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'tara_kg', label: 'Tara (kg)', render: (r) => `${parseFloat(r.tara_kg || 0).toFixed(3)} kg` },
            { key: 'activo', label: 'Estado', render: (r) => <span style={{ color: r.activo ? '#1a7a4a' : '#c0392b' }}>{r.activo ? 'Activo' : 'Inactivo'}</span> },
          ]}
          rows={rows} onEdit={abrir} onDelete={eliminar}
          emptyMsg={busqueda ? 'No se encontraron recipientes con ese nombre' : 'Sin recipientes registrados'}
        />
      )}

      <div style={recipientesStyles.paginado}>
        <button onClick={() => irPagina(page - 1)} disabled={page <= 1 || loading}
          style={{ ...recipientesStyles.pageBtn, ...(page <= 1 || loading ? recipientesStyles.pageBtnDisabled : {}) }}>← Anterior</button>
        <div style={recipientesStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (<><button onClick={() => irPagina(1)} style={recipientesStyles.pageNumberBtn}>1</button><span style={recipientesStyles.puntos}>...</span></>)}
          {paginasVisibles().map((n) => (
            <button key={n} onClick={() => irPagina(n)} disabled={loading}
              style={{ ...recipientesStyles.pageNumberBtn, ...(page === n ? recipientesStyles.pageNumberBtnActive : {}) }}>{n}</button>
          ))}
          {page < lastPage - 2 && lastPage > 5 && (<><span style={recipientesStyles.puntos}>...</span><button onClick={() => irPagina(lastPage)} style={recipientesStyles.pageNumberBtn}>{lastPage}</button></>)}
        </div>
        <button onClick={() => irPagina(page + 1)} disabled={page >= lastPage || loading}
          style={{ ...recipientesStyles.pageBtn, ...(page >= lastPage || loading ? recipientesStyles.pageBtnDisabled : {}) }}>Siguiente →</button>
      </div>
      <div style={recipientesStyles.pageInfoMobile}>Página <strong>{page}</strong> de <strong>{lastPage}</strong></div>

      {modal && (
        <Modal titulo={modal === 'nuevo' ? 'Nuevo recipiente' : 'Editar recipiente'} onClose={() => setModal(null)}>
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Tara (kg) *">
              <input type="number" step="0.001" min="0" value={form.tara_kg || ''} onChange={(e) => setForm({ ...form, tara_kg: e.target.value })} style={inputStyle} placeholder="0.000" />
            </Campo>
            <Campo label="Estado">
              <select value={form.activo ? '1' : '0'} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })} style={selectStyle}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </select>
            </Campo>
            {error && <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} style={btnPrimary}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SecClientes() {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => { cargar(1, busqueda, perPage) }, 350)
    return () => clearTimeout(timer)
  }, [busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)
    try {
      const { data } = await client.get('/clientes', {
        params: { page: pagina, per_page: cantidad, buscar: buscar || undefined },
      })
      if (Array.isArray(data)) {
        setRows(data); setTotal(data.length); setPage(1); setLastPage(1)
      } else {
        setRows(data.data || []); setTotal(data.total || 0)
        setPage(data.current_page || pagina); setLastPage(data.last_page || 1)
      }
    } catch (e) {
      logger.error('Error cargando clientes')
      noti('error', 'Error al cargar clientes')
      setRows([]); setTotal(0); setPage(1); setLastPage(1)
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => { setBusqueda(''); cargar(1, '', perPage) }

  const abrir = (row) => {
    setForm(row ? { ...row } : { nombre: '', documento: '', telefono: '', direccion: '', limite_credito: '0', activo: true })
    setModal(row ? 'editar' : 'nuevo'); setError('')
  }

  const guardar = async () => {
    setError('')
    try {
      const payload = { ...form, limite_credito: Number(String(form.limite_credito || '0').replace(/\D/g, '') || 0) }
      if (form.id) { await client.put(`/clientes/${form.id}`, payload) }
      else { await client.post('/clientes', payload) }
      setModal(null)
      noti('success', form.id ? 'Cliente actualizado correctamente' : 'Cliente registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg); noti('error', msg)
    }
  }

  const eliminar = async (row) => {
    setConfirmDelete(row)
  }

  const confirmarEliminarCliente = async () => {
    if (!confirmDelete) return
    const row = confirmDelete
    setConfirmDelete(null)
    try {
      await client.delete(`/clientes/${row.id}`)
      noti('success', 'Cliente eliminado correctamente')
      const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
      cargar(nuevaPagina, busqueda, perPage)
    } catch (e) {
      noti('error', getErrorMessage(e))
    }
  }

  const cambiarEstado = async (row) => {
    const nuevoEstado = !row.activo
    confirmarToast(
      `¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} el cliente "${row.nombre}"?`,
      async () => {
        try {
          await client.put(`/clientes/${row.id}`, { ...row, activo: nuevoEstado, limite_credito: Number(row.limite_credito || 0) })
          noti('success', `Cliente ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`)
          cargar(page, busqueda, perPage)
        } catch (e) {
          noti('error', getErrorMessage(e))
        }
      }
    )
  }

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage) return
    cargar(nuevaPagina, busqueda, perPage)
  }

  const paginasVisibles = () => {
    const paginas = []
    const inicio = Math.max(1, page - 2)
    const fin = Math.min(lastPage, page + 2)
    for (let i = inicio; i <= fin; i++) paginas.push(i)
    return paginas
  }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <h3 style={sec.titulo}>Clientes</h3>
          <p style={clientesStyles.resumen}>
            {loading ? 'Cargando clientes...' : `Mostrando ${desde} a ${hasta} de ${total} clientes`}
          </p>
        </div>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nuevo</button>
      </div>

      <div style={clientesStyles.filtros}>
        <div style={clientesStyles.buscarBox}>
          <label style={clientesStyles.label}>Buscar por nombre o CI</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: Bart o 9522544..." style={clientesStyles.buscarInput} />
        </div>
        <div style={clientesStyles.perPageBox}>
          <label style={clientesStyles.label}>Mostrar</label>
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} style={clientesStyles.select}>
            <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        {busqueda && (
          <button onClick={limpiarBusqueda} style={clientesStyles.clearBtn}>Limpiar</button>
        )}
      </div>

      {loading ? <p style={t.empty}>Cargando clientes...</p> : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'documento', label: 'CI', render: (r) => r.documento || '—' },
            { key: 'telefono', label: 'Teléfono', render: (r) => r.telefono || '—' },
            { key: 'limite_credito', label: 'Límite crédito', render: (r) => parseFloat(r.limite_credito || 0) > 0 ? `Gs. ${parseInt(r.limite_credito).toLocaleString('es-PY')}` : 'Sin límite' },
            {
              key: 'activo', label: 'Estado',
              render: (r) => (
                <button onClick={() => cambiarEstado(r)} title={r.activo ? 'Click para desactivar' : 'Click para activar'}
                  style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '4px 10px', border: 'none', cursor: 'pointer',
                    background: r.activo ? '#f0fdf4' : '#fdf0ef', color: r.activo ? '#1a7a4a' : '#c0392b' }}>
                  {r.activo ? 'Activo' : 'Inactivo'}
                </button>
              ),
            },
          ]}
          rows={rows} onEdit={abrir} onDelete={eliminar}
          emptyMsg={busqueda ? 'No se encontraron clientes con ese nombre o CI' : 'Sin clientes registrados'}
        />
      )}

      <div style={clientesStyles.paginado}>
        <button onClick={() => irPagina(page - 1)} disabled={page <= 1 || loading}
          style={{ ...clientesStyles.pageBtn, ...(page <= 1 || loading ? clientesStyles.pageBtnDisabled : {}) }}>← Anterior</button>
        <div style={clientesStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (<><button onClick={() => irPagina(1)} style={clientesStyles.pageNumberBtn}>1</button><span style={clientesStyles.puntos}>...</span></>)}
          {paginasVisibles().map((n) => (
            <button key={n} onClick={() => irPagina(n)} disabled={loading}
              style={{ ...clientesStyles.pageNumberBtn, ...(page === n ? clientesStyles.pageNumberBtnActive : {}) }}>{n}</button>
          ))}
          {page < lastPage - 2 && lastPage > 5 && (<><span style={clientesStyles.puntos}>...</span><button onClick={() => irPagina(lastPage)} style={clientesStyles.pageNumberBtn}>{lastPage}</button></>)}
        </div>
        <button onClick={() => irPagina(page + 1)} disabled={page >= lastPage || loading}
          style={{ ...clientesStyles.pageBtn, ...(page >= lastPage || loading ? clientesStyles.pageBtnDisabled : {}) }}>Siguiente →</button>
      </div>
      <div style={clientesStyles.pageInfoMobile}>Página <strong>{page}</strong> de <strong>{lastPage}</strong></div>

      {modal && (
        <Modal titulo={modal === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'} onClose={() => setModal(null)}>
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="CI / Documento">
              <input value={form.documento || ''} onChange={(e) => setForm({ ...form, documento: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Teléfono">
              <input value={form.telefono || ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Dirección">
              <input value={form.direccion || ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Límite de crédito (Gs.) — 0 = sin límite">
              <input
                type="text" inputMode="numeric"
                value={
                  form.limite_credito && parseInt(String(form.limite_credito).replace(/\D/g, '') || '0') > 0
                    ? parseInt(String(form.limite_credito).replace(/\D/g, '')).toLocaleString('es-PY')
                    : form.limite_credito === '0' || form.limite_credito === 0 ? '0' : ''
                }
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setForm({ ...form, limite_credito: val || '0' }) }}
                style={inputStyle} placeholder="0"
              />
            </Campo>
            <Campo label="Estado">
              <select value={form.activo ? '1' : '0'} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })} style={selectStyle}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </select>
            </Campo>
            {error && <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} style={btnPrimary}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          mensaje={`¿Eliminar "${confirmDelete.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={confirmarEliminarCliente}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function SecUsuarios() {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const { data } = await client.get('/usuarios', { params: { per_page: 100 } })
      setRows(data.data || data)
    } catch { setRows([]) }
  }

  const abrir = (row) => {
    setForm(row
      ? { id: row.id, name: row.name, email: row.email, role: row.role, pin: row.pin || '', activo: row.activo, password: '' }
      : { name: '', email: '', role: 'VENDEDOR', pin: '', activo: true, password: '' }
    )
    setModal(row ? 'editar' : 'nuevo'); setError('')
  }

  const guardar = async () => {
    setError('')
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (!payload.pin) delete payload.pin
      if (form.id) await client.put(`/usuarios/${form.id}`, payload)
      else await client.post('/usuarios', payload)
      setModal(null); cargar()
    } catch (e) { setError(getErrorMessage(e)) }
  }

  const cambiarEstado = async (row) => {
    try {
      await client.patch(`/usuarios/${row.id}/estado`, { activo: !row.activo })
      noti('success', `Usuario ${!row.activo ? 'activado' : 'desactivado'} correctamente`)
      cargar()
    } catch (e) { noti('error', getErrorMessage(e)) }
  }

  const eliminar = async (row) => {
    setConfirmDelete(row)
  }

  const confirmarEliminarUsuario = async () => {
    if (!confirmDelete) return
    const row = confirmDelete
    setConfirmDelete(null)
    try { await client.delete(`/usuarios/${row.id}`); noti('success', 'Usuario eliminado correctamente'); cargar() }
    catch (e) { noti('error', getErrorMessage(e)) }
  }

  const rolColor = { admin: '#6b4f2a', cajero: '#185FA5', vendedor: '#1a7a4a' }
  const rolBg = { admin: '#f0e8dc', cajero: '#e8f0fe', vendedor: '#f0fdf4' }

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <h3 style={sec.titulo}>Usuarios ({rows.length})</h3>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nuevo</button>
      </div>
      <Tabla
        cols={[
          { key: 'name', label: 'Nombre' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Rol', render: (r) => (
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', background: rolBg[r.role] || '#f5f5f5', color: rolColor[r.role] || '#4a3520' }}>
              {r.role}
            </span>
          )},
          { key: 'pin', label: 'PIN', render: (r) => r.pin || '—' },
          { key: 'activo', label: 'Estado', render: (r) => (
            <button onClick={() => cambiarEstado(r)}
              style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px', border: 'none', cursor: 'pointer',
                background: r.activo ? '#f0fdf4' : '#fdf0ef', color: r.activo ? '#1a7a4a' : '#c0392b' }}>
              {r.activo ? 'Activo' : 'Inactivo'}
            </button>
          )},
        ]}
        rows={rows} onEdit={abrir} onDelete={eliminar}
      />
      {modal && (
        <Modal titulo={modal === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setModal(null)}>
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Email *">
              <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </Campo>
            <Campo label="Rol *">
              <select value={form.role || 'VENDEDOR'} onChange={(e) => setForm({ ...form, role: e.target.value })} style={selectStyle}>
                <option value="vendedor">Vendedor</option>
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
            <Campo label="PIN (opcional)">
              <input type="text" maxLength={6} value={form.pin || ''} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} style={inputStyle} placeholder="Ej: 1234" />
            </Campo>
            <Campo label={form.id ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
              <input type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />
            </Campo>
            {error && <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} style={btnPrimary}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          mensaje={`¿Eliminar el usuario "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
          onConfirm={confirmarEliminarUsuario}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

const sec = {
  wrap: { padding: '1.2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.8rem', flexWrap: 'wrap' },
  titulo: { margin: 0, fontSize: 16, fontWeight: 700, color: '#2c1a08' },
  addBtn: { padding: '6px 14px', background: '#b8732a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  subTab: { padding: '5px 14px', border: '1px solid #ddd0be', borderRadius: 16, background: '#faf7f2', cursor: 'pointer', fontSize: 13, color: '#4a3520' },
  subTabOn: { background: '#b8732a', color: '#fff', border: '1px solid #b8732a' },
}

const baseListStyles = {
  resumen: { margin: '4px 0 0', fontSize: 12, color: '#8a7560' },
  filtros: { display: 'flex', alignItems: 'flex-end', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' },
  buscarBox: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 260px' },
  perPageBox: { display: 'flex', flexDirection: 'column', gap: 4, width: 110 },
  label: { fontSize: 12, fontWeight: 600, color: '#4a3520' },
  buscarInput: { ...inputStyle, width: '100%' },
  select: { ...selectStyle, width: '100%' },
  clearBtn: { padding: '8px 14px', background: 'transparent', border: '1px solid #ddd0be', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#4a3520' },
  paginado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', marginTop: '1rem', flexWrap: 'wrap' },
  numerosPagina: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
  pageBtn: { padding: '7px 14px', background: '#b8732a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  pageBtnDisabled: { background: '#d6c5b1', cursor: 'not-allowed', opacity: 0.7 },
  pageNumberBtn: { minWidth: 32, height: 32, padding: '0 8px', background: '#fff', border: '1px solid #ddd0be', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#4a3520' },
  pageNumberBtnActive: { background: '#b8732a', borderColor: '#b8732a', color: '#fff', fontWeight: 700 },
  puntos: { color: '#8a7560', fontSize: 13, padding: '0 3px' },
  pageInfoMobile: { marginTop: '0.5rem', textAlign: 'center', fontSize: 13, color: '#4a3520' },
}

const cardStyles = {
  filtros: { display: 'flex', gap: '0.6rem', marginBottom: '1.2rem', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { ...inputStyle, flex: '1 1 220px', minWidth: 180 },
  filterSelect: { ...selectStyle, flex: '0 1 180px', minWidth: 140 },
  clearBtn: { padding: '8px 14px', background: '#fdf0ef', border: '1px solid #f5c6c6', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#c0392b', whiteSpace: 'nowrap' },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '3rem' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', gap: 8 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
    padding: '0.2rem 0 1.2rem',
  },
  card: {
    background: '#fff',
    border: '1px solid #e8e0d0',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
  },
  imgWrap: { position: 'relative', width: '100%', paddingTop: '70%', background: '#f5f0ea', flexShrink: 0 },
  img: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, opacity: 0.18 },
  badge: { position: 'absolute', top: 7, right: 7, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 },
  badgeExtra: { position: 'absolute', top: 7, left: 7, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#fef9c3', color: '#854d0e' },
  info: { padding: '0.7rem 0.8rem 0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  catPill: { fontSize: 10, fontWeight: 600, color: '#6b4f2a', background: '#f0e8dc', borderRadius: 4, padding: '2px 7px', alignSelf: 'flex-start' },
  nombre: { margin: 0, fontSize: 14, fontWeight: 700, color: '#2c1a08', lineHeight: 1.3 },
  precio: { margin: 0, fontSize: 16, fontWeight: 800, color: '#b8732a' },
  tipoPill: { fontSize: 10, color: '#8a7560', marginTop: 1 },
  acciones: { display: 'flex', gap: 5, padding: '0.55rem 0.7rem', borderTop: '1px solid #f0e8dc', background: '#fdfaf6' },
  editBtn: { flex: 1, padding: '6px 0', background: '#b8732a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  toggleBtn: { flex: 1, padding: '6px 0', background: 'transparent', border: '1px solid #e8e0d0', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  delBtn: { padding: '6px 9px', background: 'transparent', border: '1px solid #f5c6c6', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#c0392b', fontWeight: 700 },
}

const productosStyles = { ...baseListStyles }
const clientesStyles = { ...baseListStyles }
const categoriasStyles = { ...baseListStyles }
const recipientesStyles = { ...baseListStyles }

const TABS = [
  { key: 'productos', label: 'Productos', icon: Package },
  { key: 'categorias', label: 'Categorías', icon: FolderTree },
  { key: 'recipientes', label: 'Recipientes', icon: Scale },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'usuarios', label: 'Usuarios', icon: UserCog },
]

export default function Configuracion() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { limpiar } = useCajaStore()
  const [tab, setTab] = useState('productos')

  const handleLogout = async () => { await logout(); limpiar(); navigate('/login', { replace: true }) }

  return (
    <div style={p.root}>
      <nav style={p.nav}>
        <div style={p.navLeft}>
          <div style={p.navLogo}>ÑG</div>
          <span style={p.navTitulo}>Configuración</span>
        </div>
        <div style={p.navRight}>
          <button onClick={() => navigate('/admin/dashboard')} style={p.navBack}>
            <LayoutDashboard size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Dashboard
          </button>
          <span style={{ fontSize: 12, color: '#c9b99a' }}>Administrador</span>
          <button onClick={handleLogout} style={p.navLogout}>
            <LogOut size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Salir
          </button>
        </div>
      </nav>

      <div style={p.body}>
        <div style={p.sidebar}>
          {TABS.map((tb) => {
            const Icon = tb.icon
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                style={{ ...p.tabBtn, ...(tab === tb.key ? p.tabBtnOn : {}) }}>
                <Icon size={16} style={{ marginRight: 8, flexShrink: 0 }} />
                {tb.label}
              </button>
            )
          })}
        </div>

        <div style={p.content}>
          {tab === 'productos' && <SecProductos />}
          {tab === 'categorias' && <SecCategorias />}
          {tab === 'recipientes' && <SecRecipientes />}
          {tab === 'clientes' && <SecClientes />}
          {tab === 'usuarios' && <SecUsuarios />}
        </div>
      </div>
    </div>
  )
}

const p = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f0ea', fontFamily: 'system-ui,sans-serif' },
  nav: { background: '#2c1a08', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem clamp(0.7rem, 3vw, 1.2rem)', minHeight: 50, flexShrink: 0, gap: '0.6rem', flexWrap: 'wrap' },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.8rem' },
  navLogo: { width: 30, height: 30, background: '#b8732a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  navTitulo: { fontSize: 15, fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' },
  navBack: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  navLogout: { background: 'transparent', border: '1px solid #c0392b', color: '#f5c6c6', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  body: { display: 'flex', flex: 1, overflow: 'auto', flexWrap: 'wrap' },
  sidebar: { flex: '0 0 min(100%, 200px)', background: '#fff', borderRight: '1px solid #e8e0d0', display: 'flex', flexDirection: 'column', padding: '0.8rem', gap: '0.3rem', flexShrink: 0 },
  tabBtn: { padding: '8px 12px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#4a3520', fontWeight: 500, display: 'flex', alignItems: 'center' },
  tabBtnOn: { background: '#fef9f0', color: '#b8732a', fontWeight: 700 },
  content: { flex: '1 1 520px', minWidth: 'min(100%, 320px)', overflowY: 'auto', background: '#fff' },
}
