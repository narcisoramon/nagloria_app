import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCajaStore } from '../store/cajaStore'
import client from '../api/client'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const fmt = (n) => Math.round(n || 0).toLocaleString('es-PY')

// ── Modal genérico ────────────────────────────────────────────────────────────
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

// ── Tabla genérica ────────────────────────────────────────────────────────────
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

// ── Campo de formulario ───────────────────────────────────────────────────────
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

const confirmarToast = (mensaje, onConfirm) => {
  toast.info(
    ({ closeToast }) => (
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 14 }}>
          {mensaje}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              closeToast()
              onConfirm()
            }}
            style={{
              padding: '6px 12px',
              background: '#1a7a4a',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Sí, confirmar
          </button>

          <button
            onClick={closeToast}
            style={{
              padding: '6px 12px',
              background: '#fff',
              color: '#4a3520',
              border: '1px solid #ddd0be',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    ),
    {
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      closeButton: false,
      position: 'top-center',
      theme: 'light',
    }
  )
}



const inputStyle = { padding:'8px 10px', border:'1px solid #ddd0be', borderRadius:7, fontSize:14, outline:'none', background:'#fdfaf6', width:'100%', boxSizing:'border-box' }
const selectStyle = { ...inputStyle }
const formStyle = { display:'flex', flexDirection:'column', gap:'0.8rem', padding:'1.2rem' }
const formBtns = { display:'flex', justifyContent:'flex-end', gap:'0.6rem', marginTop:'0.4rem', flexWrap:'wrap' }
const btnPrimary = { padding:'8px 20px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }
const btnSecondary = { padding:'8px 16px', background:'transparent', border:'1px solid #ddd0be', borderRadius:7, cursor:'pointer', fontSize:13 }

// ══════════════════════════════════════════════════════════════════════════════
// SECCIONES
// ══════════════════════════════════════════════════════════════════════════════

function SecProductos() {
  const [rows, setRows] = useState([])
  const [cats, setCats] = useState([])
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
    cargarCategorias()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      cargar(1, busqueda, perPage)
    }, 350)

    return () => clearTimeout(timer)
  }, [busqueda, perPage])

  const cargarCategorias = async () => {
    try {
      const { data } = await client.get('/categorias-productos', {
        params: { per_page: 100 },
      })

      setCats(data.data || data || [])
    } catch (e) {
      console.error(e)
      setCats([])
      toast.error(e.response?.data?.message || 'Error al cargar categorías')
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
        },
      })

      if (Array.isArray(data)) {
        setRows(data)
        setTotal(data.length)
        setPage(1)
        setLastPage(1)
      } else {
        setRows(data.data || [])
        setTotal(data.total || 0)
        setPage(data.current_page || pagina)
        setLastPage(data.last_page || 1)
      }
    } catch (e) {
      console.error(e)
      setRows([])
      setTotal(0)
      setPage(1)
      setLastPage(1)
      toast.error(e.response?.data?.message || 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => {
    setBusqueda('')
    cargar(1, '', perPage)
  }

  const abrir = (row) => {
    setForm(
      row
        ? {
            ...row,
            precio:
              row.precio !== null && row.precio !== undefined
                ? String(Math.round(Number(row.precio)))
                : '',
          }
        : {
            nombre: '',
            categoria_producto_id: '',
            precio: '',
            tipo_venta: 'UNIDAD',
            usar_como_extra: false,
            activo: true,
          }
    )

    setModal(row ? 'editar' : 'nuevo')
    setError('')
  }

  const guardar = async () => {
    setError('')

    try {
      const payload = {
        ...form,
        precio: Number(String(form.precio).replace(/\D/g, '') || 0),
        usar_como_extra: Boolean(form.usar_como_extra),
      }

      if (form.id) {
        await client.put(`/productos/${form.id}`, payload)
      } else {
        await client.post('/productos', payload)
      }

      setModal(null)
      toast.success(form.id ? 'Producto actualizado correctamente' : 'Producto registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al guardar producto'
      setError(msg)
      toast.error(msg)
    }
  }

  const eliminar = async (row) => {
    if (!confirm(`¿Eliminar "${row.nombre}"?`)) return

    try {
      await client.delete(`/productos/${row.id}`)
      toast.success('Producto eliminado correctamente')

      const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
      cargar(nuevaPagina, busqueda, perPage)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al eliminar producto')
    }
  }

const cambiarEstado = async (row) => {
  const nuevoEstado = !row.activo

  confirmarToast(
    `¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} el producto "${row.nombre}"?`,
    async () => {
      try {
        const payload = {
          categoria_producto_id: row.categoria_producto_id,
          nombre: row.nombre,
          precio: Number(row.precio || 0),
          tipo_venta: row.tipo_venta,
          usar_como_extra: Boolean(row.usar_como_extra),
          controla_stock: row.controla_stock ?? false,
          activo: nuevoEstado,
        }

        await client.put(`/productos/${row.id}`, payload)

        toast.success(
          `Producto ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`
        )

        cargar(page, busqueda, perPage)
      } catch (e) {
        toast.error(
          e.response?.data?.message ||
            'Error al cambiar el estado del producto'
        )
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
          const payload = {
            categoria_producto_id: row.categoria_producto_id,
            nombre: row.nombre,
            precio: Number(row.precio || 0),
            tipo_venta: row.tipo_venta,
            usar_como_extra: nuevoValor,
            controla_stock: row.controla_stock ?? false,
            activo: Boolean(row.activo),
          }

          await client.put(`/productos/${row.id}`, payload)

          toast.success(
            nuevoValor
              ? 'Producto habilitado como extra en caja'
              : 'Producto ocultado de extras en caja'
          )

          cargar(page, busqueda, perPage)
        } catch (e) {
          toast.error(
            e.response?.data?.message ||
              'Error al cambiar configuración de extra en caja'
          )
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

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i)
    }

    return paginas
  }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <h3 style={sec.titulo}>Productos</h3>
          <p style={productosStyles.resumen}>
            {loading
              ? 'Cargando productos...'
              : `Mostrando ${desde} a ${hasta} de ${total} productos`}
          </p>
        </div>

        <button onClick={() => abrir(null)} style={sec.addBtn}>
          + Nuevo
        </button>
      </div>

      <div style={productosStyles.filtros}>
        <div style={productosStyles.buscarBox}>
          <label style={productosStyles.label}>Buscar por nombre</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: agua, milanesa, gaseosa..."
            style={productosStyles.buscarInput}
          />
        </div>

        <div style={productosStyles.perPageBox}>
          <label style={productosStyles.label}>Mostrar</label>
          <select
            value={perPage}
            onChange={(e) => {
              const value = Number(e.target.value)
              setPerPage(value)
              setPage(1)
            }}
            style={productosStyles.select}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {busqueda && (
<button
  onClick={limpiarBusqueda}
  disabled={!busqueda}
  style={{
    ...productosStyles.clearBtn,
    opacity: !busqueda ? 0.5 : 1,
    cursor: !busqueda ? 'not-allowed' : 'pointer',
  }}
>
  Limpiar
</button>
        )}
      </div>

      {loading ? (
        <p style={t.empty}>Cargando productos...</p>
      ) : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            {
              key: 'categoria',
              label: 'Categoría',
              render: (r) => r.categoria_producto?.nombre || '—',
            },
            {
              key: 'precio',
              label: 'Precio',
              render: (r) => `Gs. ${fmt(r.precio)}`,
            },
            { key: 'tipo_venta', label: 'Tipo' },
            {
              key: 'usar_como_extra',
              label: 'Extra caja',
              render: (r) => (
                <button
                  onClick={() => cambiarExtraCaja(r)}
                  title={Boolean(r.usar_como_extra) ? 'Click para ocultar de extras' : 'Click para mostrar como extra'}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '4px 10px',
                    border: 'none',
                    cursor: 'pointer',
                    background: Boolean(r.usar_como_extra) ? '#f0fdf4' : '#fdf0ef',
                    color: Boolean(r.usar_como_extra) ? '#1a7a4a' : '#c0392b',
                  }}
                >
                  {Boolean(r.usar_como_extra) ? 'Sí' : 'No'}
                </button>
              ),
            },
            {
              key: 'activo',
              label: 'Estado',
              render: (r) => (
                <button
                  onClick={() => cambiarEstado(r)}
                  title={r.activo ? 'Click para desactivar' : 'Click para activar'}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '4px 10px',
                    border: 'none',
                    cursor: 'pointer',
                    background: r.activo ? '#f0fdf4' : '#fdf0ef',
                    color: r.activo ? '#1a7a4a' : '#c0392b',
                  }}
                >
                  {r.activo ? 'Activo' : 'Inactivo'}
                </button>
              ),
            },
            
          ]}
          rows={rows}
          onEdit={abrir}
          onDelete={eliminar}
          emptyMsg={
            busqueda
              ? 'No se encontraron productos con ese nombre'
              : 'Sin productos registrados'
          }
        />
      )}

      <div style={productosStyles.paginado}>
        <button
          onClick={() => irPagina(page - 1)}
          disabled={page <= 1 || loading}
          style={{
            ...productosStyles.pageBtn,
            ...(page <= 1 || loading ? productosStyles.pageBtnDisabled : {}),
          }}
        >
          ← Anterior
        </button>

        <div style={productosStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (
            <>
              <button onClick={() => irPagina(1)} style={productosStyles.pageNumberBtn}>
                1
              </button>
              <span style={productosStyles.puntos}>...</span>
            </>
          )}

          {paginasVisibles().map((n) => (
            <button
              key={n}
              onClick={() => irPagina(n)}
              disabled={loading}
              style={{
                ...productosStyles.pageNumberBtn,
                ...(page === n ? productosStyles.pageNumberBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}

          {page < lastPage - 2 && lastPage > 5 && (
            <>
              <span style={productosStyles.puntos}>...</span>
              <button onClick={() => irPagina(lastPage)} style={productosStyles.pageNumberBtn}>
                {lastPage}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => irPagina(page + 1)}
          disabled={page >= lastPage || loading}
          style={{
            ...productosStyles.pageBtn,
            ...(page >= lastPage || loading ? productosStyles.pageBtnDisabled : {}),
          }}
        >
          Siguiente →
        </button>
      </div>

      <div style={productosStyles.pageInfoMobile}>
        Página <strong>{page}</strong> de <strong>{lastPage}</strong>
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

            <Campo label="Categoría *">
              <select
                value={form.categoria_producto_id || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoria_producto_id: e.target.value,
                  })
                }
                style={selectStyle}
              >
                <option value="">— Seleccionar —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Precio (Gs.) *">
              <input
                type="text"
                inputMode="numeric"
                value={
                  form.precio !== null &&
                  form.precio !== undefined &&
                  form.precio !== ''
                    ? Number(String(form.precio).replace(/\D/g, '')).toLocaleString('es-PY')
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setForm({ ...form, precio: val })
                }}
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    usar_como_extra: e.target.value === '1',
                  })
                }
                style={selectStyle}
              >
                <option value="1">Sí, mostrar en caja</option>
                <option value="0">No mostrar</option>
              </select>
            </Campo>

            <Campo label="Estado">
              <select
                value={form.activo ? '1' : '0'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    activo: e.target.value === '1',
                  })
                }
                style={selectStyle}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Campo>

            {error && (
              <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>
                {error}
              </p>
            )}

            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>
                Cancelar
              </button>
              <button onClick={guardar} style={btnPrimary}>
                Guardar
              </button>
            </div>
          </div>
        </Modal>
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
    const timer = setTimeout(() => {
      cargar(1, busqueda, perPage)
    }, 350)

    return () => clearTimeout(timer)
  }, [sub, busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)

    try {
      const { data } = await client.get(url, {
        params: {
          page: pagina,
          per_page: cantidad,
          buscar: buscar || undefined,
        },
      })

      if (Array.isArray(data)) {
        setRows(data)
        setTotal(data.length)
        setPage(1)
        setLastPage(1)
      } else {
        setRows(data.data || [])
        setTotal(data.total || 0)
        setPage(data.current_page || pagina)
        setLastPage(data.last_page || 1)
      }
    } catch (e) {
      console.error(e)
      setRows([])
      setTotal(0)
      setPage(1)
      setLastPage(1)
      toast.error(e.response?.data?.message || 'Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => {
    setBusqueda('')
    cargar(1, '', perPage)
  }

  const abrir = (row) => {
    setForm(row ? { ...row } : { nombre: '', activo: true })
    setModal(row ? 'editar' : 'nuevo')
    setError('')
  }

  const guardar = async () => {
    setError('')

    try {
      if (form.id) {
        await client.put(`${url}/${form.id}`, form)
      } else {
        await client.post(url, form)
      }

      setModal(null)
      toast.success(form.id ? 'Categoría actualizada correctamente' : 'Categoría registrada correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al guardar categoría'
      setError(msg)
      toast.error(msg)
    }
  }

  const eliminar = async (row) => {
    confirmarToast(`¿Eliminar la categoría "${row.nombre}"?`, async () => {
      try {
        await client.delete(`${url}/${row.id}`)
        toast.success('Categoría eliminada correctamente')

        const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
        cargar(nuevaPagina, busqueda, perPage)
      } catch (e) {
        toast.error(e.response?.data?.message || 'Error al eliminar categoría')
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

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i)
    }

    return paginas
  }

  const cambiarSub = (nuevoSub) => {
    setSub(nuevoSub)
    setBusqueda('')
    setPage(1)
    setTotal(0)
    setLastPage(1)
    setRows([])
  }

  const desde = total === 0 ? 0 : (page - 1) * perPage + 1
  const hasta = Math.min(page * perPage, total)

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['productos', 'gastos'].map((s) => (
              <button
                key={s}
                onClick={() => cambiarSub(s)}
                style={{ ...sec.subTab, ...(sub === s ? sec.subTabOn : {}) }}
              >
                {s === 'productos' ? 'Productos' : 'Gastos'}
              </button>
            ))}
          </div>

          <p style={categoriasStyles.resumen}>
            {loading
              ? 'Cargando categorías...'
              : `Mostrando ${desde} a ${hasta} de ${total} categorías`}
          </p>
        </div>

        <button onClick={() => abrir(null)} style={sec.addBtn}>
          + Nueva
        </button>
      </div>

      <div style={categoriasStyles.filtros}>
        <div style={categoriasStyles.buscarBox}>
          <label style={categoriasStyles.label}>Buscar por nombre</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar categoría..."
            style={categoriasStyles.buscarInput}
          />
        </div>

        <div style={categoriasStyles.perPageBox}>
          <label style={categoriasStyles.label}>Mostrar</label>
          <select
            value={perPage}
            onChange={(e) => {
              const value = Number(e.target.value)
              setPerPage(value)
              setPage(1)
            }}
            style={categoriasStyles.select}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button
          onClick={limpiarBusqueda}
          disabled={!busqueda}
          style={{
            ...categoriasStyles.clearBtn,
            opacity: !busqueda ? 0.5 : 1,
            cursor: !busqueda ? 'not-allowed' : 'pointer',
          }}
        >
          Limpiar
        </button>
      </div>

      {loading ? (
        <p style={t.empty}>Cargando categorías...</p>
      ) : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            {
              key: 'activo',
              label: 'Estado',
              render: (r) => (
                <span style={{ color: r.activo ? '#1a7a4a' : '#c0392b' }}>
                  {r.activo ? 'Activo' : 'Inactivo'}
                </span>
              ),
            },
          ]}
          rows={rows}
          onEdit={abrir}
          onDelete={eliminar}
          emptyMsg={
            busqueda
              ? 'No se encontraron categorías con ese nombre'
              : 'Sin categorías registradas'
          }
        />
      )}

      <div style={categoriasStyles.paginado}>
        <button
          onClick={() => irPagina(page - 1)}
          disabled={page <= 1 || loading}
          style={{
            ...categoriasStyles.pageBtn,
            ...(page <= 1 || loading ? categoriasStyles.pageBtnDisabled : {}),
          }}
        >
          ← Anterior
        </button>

        <div style={categoriasStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (
            <>
              <button onClick={() => irPagina(1)} style={categoriasStyles.pageNumberBtn}>
                1
              </button>
              <span style={categoriasStyles.puntos}>...</span>
            </>
          )}

          {paginasVisibles().map((n) => (
            <button
              key={n}
              onClick={() => irPagina(n)}
              disabled={loading}
              style={{
                ...categoriasStyles.pageNumberBtn,
                ...(page === n ? categoriasStyles.pageNumberBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}

          {page < lastPage - 2 && lastPage > 5 && (
            <>
              <span style={categoriasStyles.puntos}>...</span>
              <button onClick={() => irPagina(lastPage)} style={categoriasStyles.pageNumberBtn}>
                {lastPage}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => irPagina(page + 1)}
          disabled={page >= lastPage || loading}
          style={{
            ...categoriasStyles.pageBtn,
            ...(page >= lastPage || loading ? categoriasStyles.pageBtnDisabled : {}),
          }}
        >
          Siguiente →
        </button>
      </div>

      <div style={categoriasStyles.pageInfoMobile}>
        Página <strong>{page}</strong> de <strong>{lastPage}</strong>
      </div>

      {modal && (
        <Modal
          titulo={modal === 'nuevo' ? 'Nueva categoría' : 'Editar categoría'}
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

            <Campo label="Estado">
              <select
                value={form.activo ? '1' : '0'}
                onChange={(e) =>
                  setForm({ ...form, activo: e.target.value === '1' })
                }
                style={selectStyle}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Campo>

            {error && (
              <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>
                {error}
              </p>
            )}

            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>
                Cancelar
              </button>
              <button onClick={guardar} style={btnPrimary}>
                Guardar
              </button>
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
    const timer = setTimeout(() => {
      cargar(1, busqueda, perPage)
    }, 350)

    return () => clearTimeout(timer)
  }, [busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)

    try {
      const { data } = await client.get('/recipientes', {
        params: {
          page: pagina,
          per_page: cantidad,
          buscar: buscar || undefined,
        },
      })

      if (Array.isArray(data)) {
        setRows(data)
        setTotal(data.length)
        setPage(1)
        setLastPage(1)
      } else {
        setRows(data.data || [])
        setTotal(data.total || 0)
        setPage(data.current_page || pagina)
        setLastPage(data.last_page || 1)
      }
    } catch (e) {
      console.error(e)
      setRows([])
      setTotal(0)
      setPage(1)
      setLastPage(1)
      toast.error(e.response?.data?.message || 'Error al cargar recipientes')
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => {
    setBusqueda('')
    cargar(1, '', perPage)
  }

  const abrir = (row) => {
    setForm(row ? { ...row } : { nombre: '', tara_kg: '', activo: true })
    setModal(row ? 'editar' : 'nuevo')
    setError('')
  }

  const guardar = async () => {
    setError('')

    try {
      const payload = {
        ...form,
        tara_kg: parseFloat(form.tara_kg || 0),
      }

      if (form.id) {
        await client.put(`/recipientes/${form.id}`, payload)
      } else {
        await client.post('/recipientes', payload)
      }

      setModal(null)
      toast.success(form.id ? 'Recipiente actualizado correctamente' : 'Recipiente registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al guardar recipiente'
      setError(msg)
      toast.error(msg)
    }
  }

  const eliminar = async (row) => {
    confirmarToast(`¿Eliminar el recipiente "${row.nombre}"?`, async () => {
      try {
        await client.delete(`/recipientes/${row.id}`)
        toast.success('Recipiente eliminado correctamente')

        const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page
        cargar(nuevaPagina, busqueda, perPage)
      } catch (e) {
        toast.error(e.response?.data?.message || 'Error al eliminar recipiente')
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

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i)
    }

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
            {loading
              ? 'Cargando recipientes...'
              : `Mostrando ${desde} a ${hasta} de ${total} recipientes`}
          </p>
        </div>

        <button onClick={() => abrir(null)} style={sec.addBtn}>
          + Nuevo
        </button>
      </div>

      <div style={recipientesStyles.filtros}>
        <div style={recipientesStyles.buscarBox}>
          <label style={recipientesStyles.label}>Buscar por nombre</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar recipiente..."
            style={recipientesStyles.buscarInput}
          />
        </div>

        <div style={recipientesStyles.perPageBox}>
          <label style={recipientesStyles.label}>Mostrar</label>
          <select
            value={perPage}
            onChange={(e) => {
              const value = Number(e.target.value)
              setPerPage(value)
              setPage(1)
            }}
            style={recipientesStyles.select}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button
          onClick={limpiarBusqueda}
          disabled={!busqueda}
          style={{
            ...recipientesStyles.clearBtn,
            opacity: !busqueda ? 0.5 : 1,
            cursor: !busqueda ? 'not-allowed' : 'pointer',
          }}
        >
          Limpiar
        </button>
      </div>

      {loading ? (
        <p style={t.empty}>Cargando recipientes...</p>
      ) : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            {
              key: 'tara_kg',
              label: 'Tara (kg)',
              render: (r) => `${parseFloat(r.tara_kg || 0).toFixed(3)} kg`,
            },
            {
              key: 'activo',
              label: 'Estado',
              render: (r) => (
                <span style={{ color: r.activo ? '#1a7a4a' : '#c0392b' }}>
                  {r.activo ? 'Activo' : 'Inactivo'}
                </span>
              ),
            },
          ]}
          rows={rows}
          onEdit={abrir}
          onDelete={eliminar}
          emptyMsg={
            busqueda
              ? 'No se encontraron recipientes con ese nombre'
              : 'Sin recipientes registrados'
          }
        />
      )}

      <div style={recipientesStyles.paginado}>
        <button
          onClick={() => irPagina(page - 1)}
          disabled={page <= 1 || loading}
          style={{
            ...recipientesStyles.pageBtn,
            ...(page <= 1 || loading ? recipientesStyles.pageBtnDisabled : {}),
          }}
        >
          ← Anterior
        </button>

        <div style={recipientesStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (
            <>
              <button onClick={() => irPagina(1)} style={recipientesStyles.pageNumberBtn}>
                1
              </button>
              <span style={recipientesStyles.puntos}>...</span>
            </>
          )}

          {paginasVisibles().map((n) => (
            <button
              key={n}
              onClick={() => irPagina(n)}
              disabled={loading}
              style={{
                ...recipientesStyles.pageNumberBtn,
                ...(page === n ? recipientesStyles.pageNumberBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}

          {page < lastPage - 2 && lastPage > 5 && (
            <>
              <span style={recipientesStyles.puntos}>...</span>
              <button onClick={() => irPagina(lastPage)} style={recipientesStyles.pageNumberBtn}>
                {lastPage}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => irPagina(page + 1)}
          disabled={page >= lastPage || loading}
          style={{
            ...recipientesStyles.pageBtn,
            ...(page >= lastPage || loading ? recipientesStyles.pageBtnDisabled : {}),
          }}
        >
          Siguiente →
        </button>
      </div>

      <div style={recipientesStyles.pageInfoMobile}>
        Página <strong>{page}</strong> de <strong>{lastPage}</strong>
      </div>

      {modal && (
        <Modal
          titulo={modal === 'nuevo' ? 'Nuevo recipiente' : 'Editar recipiente'}
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

            <Campo label="Tara (kg) *">
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.tara_kg || ''}
                onChange={(e) => setForm({ ...form, tara_kg: e.target.value })}
                style={inputStyle}
                placeholder="0.000"
              />
            </Campo>

            <Campo label="Estado">
              <select
                value={form.activo ? '1' : '0'}
                onChange={(e) =>
                  setForm({ ...form, activo: e.target.value === '1' })
                }
                style={selectStyle}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Campo>

            {error && (
              <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>
                {error}
              </p>
            )}

            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>
                Cancelar
              </button>
              <button onClick={guardar} style={btnPrimary}>
                Guardar
              </button>
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

  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      cargar(1, busqueda, perPage)
    }, 350)

    return () => clearTimeout(timer)
  }, [busqueda, perPage])

  const cargar = async (pagina = 1, buscar = busqueda, cantidad = perPage) => {
    setLoading(true)

    try {
      const { data } = await client.get('/clientes', {
        params: {
          page: pagina,
          per_page: cantidad,
          buscar: buscar || undefined,
        },
      })

      if (Array.isArray(data)) {
        setRows(data)
        setTotal(data.length)
        setPage(1)
        setLastPage(1)
      } else {
        setRows(data.data || [])
        setTotal(data.total || 0)
        setPage(data.current_page || pagina)
        setLastPage(data.last_page || 1)
      }
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message || 'Error al cargar clientes')
      setRows([])
      setTotal(0)
      setPage(1)
      setLastPage(1)
    } finally {
      setLoading(false)
    }
  }

  const limpiarBusqueda = () => {
    setBusqueda('')
    cargar(1, '', perPage)
  }

  const abrir = (row) => {
    setForm(
      row
        ? { ...row }
        : {
            nombre: '',
            documento: '',
            telefono: '',
            direccion: '',
            limite_credito: '0',
            activo: true,
          }
    )

    setModal(row ? 'editar' : 'nuevo')
    setError('')
  }

  const guardar = async () => {
    setError('')

    try {
      const payload = {
        ...form,
        limite_credito: Number(
          String(form.limite_credito || '0').replace(/\D/g, '') || 0
        ),
      }

      if (form.id) {
        await client.put(`/clientes/${form.id}`, payload)
      } else {
        await client.post('/clientes', payload)
      }

      setModal(null)
      toast.success(form.id ? 'Cliente actualizado correctamente' : 'Cliente registrado correctamente')
      cargar(page, busqueda, perPage)
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al guardar cliente'
      setError(msg)
      toast.error(msg)
    }
  }

  const eliminar = async (row) => {
    if (!confirm(`¿Eliminar "${row.nombre}"?`)) return

    try {
      await client.delete(`/clientes/${row.id}`)
      toast.success('Cliente eliminado correctamente')

      const nuevaPagina = rows.length === 1 && page > 1 ? page - 1 : page

      cargar(nuevaPagina, busqueda, perPage)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al eliminar cliente')
    }
  }

  const cambiarEstado = async (row) => {
    const nuevoEstado = !row.activo

    const confirmar = confirm(
      `¿Desea ${nuevoEstado ? 'activar' : 'desactivar'} el cliente "${row.nombre}"?`
    )

    if (!confirmar) return

    try {
      const payload = {
        ...row,
        activo: nuevoEstado,
        limite_credito: Number(row.limite_credito || 0),
      }

      await client.put(`/clientes/${row.id}`, payload)
      toast.success(`Cliente ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`)
      cargar(page, busqueda, perPage)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cambiar el estado del cliente')
    }
  }

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > lastPage) return
    cargar(nuevaPagina, busqueda, perPage)
  }

  const paginasVisibles = () => {
    const paginas = []
    const inicio = Math.max(1, page - 2)
    const fin = Math.min(lastPage, page + 2)

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i)
    }

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
            {loading
              ? 'Cargando clientes...'
              : `Mostrando ${desde} a ${hasta} de ${total} clientes`}
          </p>
        </div>

        <button onClick={() => abrir(null)} style={sec.addBtn}>
          + Nuevo
        </button>
      </div>

      <div style={clientesStyles.filtros}>
        <div style={clientesStyles.buscarBox}>
          <label style={clientesStyles.label}>Buscar por nombre o CI</label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: Bart o 9522544..."
            style={clientesStyles.buscarInput}
          />
        </div>

        <div style={clientesStyles.perPageBox}>
          <label style={clientesStyles.label}>Mostrar</label>
          <select
            value={perPage}
            onChange={(e) => {
              const value = Number(e.target.value)
              setPerPage(value)
              setPage(1)
            }}
            style={clientesStyles.select}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {busqueda && (
<button
  onClick={limpiarBusqueda}
  disabled={!busqueda}
  style={{
    ...clientesStyles.clearBtn,
    opacity: !busqueda ? 0.5 : 1,
    cursor: !busqueda ? 'not-allowed' : 'pointer',
  }}
>
  Limpiar
</button>
        )}
      </div>

      {loading ? (
        <p style={t.empty}>Cargando clientes...</p>
      ) : (
        <Tabla
          cols={[
            { key: 'nombre', label: 'Nombre' },
            {
              key: 'documento',
              label: 'CI',
              render: (r) => r.documento || '—',
            },
            {
              key: 'telefono',
              label: 'Teléfono',
              render: (r) => r.telefono || '—',
            },
            {
              key: 'limite_credito',
              label: 'Límite crédito',
              render: (r) =>
                parseFloat(r.limite_credito || 0) > 0
                  ? `Gs. ${parseInt(r.limite_credito).toLocaleString('es-PY')}`
                  : 'Sin límite',
            },
            {
              key: 'activo',
              label: 'Estado',
              render: (r) => (
                <button
                  onClick={() => cambiarEstado(r)}
                  title={r.activo ? 'Click para desactivar' : 'Click para activar'}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '4px 10px',
                    border: 'none',
                    cursor: 'pointer',
                    background: r.activo ? '#f0fdf4' : '#fdf0ef',
                    color: r.activo ? '#1a7a4a' : '#c0392b',
                  }}
                >
                  {r.activo ? 'Activo' : 'Inactivo'}
                </button>
              ),
            },
          ]}
          rows={rows}
          onEdit={abrir}
          onDelete={eliminar}
          emptyMsg={
            busqueda
              ? 'No se encontraron clientes con ese nombre o CI'
              : 'Sin clientes registrados'
          }
        />
      )}

      <div style={clientesStyles.paginado}>
        <button
          onClick={() => irPagina(page - 1)}
          disabled={page <= 1 || loading}
          style={{
            ...clientesStyles.pageBtn,
            ...(page <= 1 || loading ? clientesStyles.pageBtnDisabled : {}),
          }}
        >
          ← Anterior
        </button>

        <div style={clientesStyles.numerosPagina}>
          {page > 3 && lastPage > 5 && (
            <>
              <button
                onClick={() => irPagina(1)}
                style={clientesStyles.pageNumberBtn}
              >
                1
              </button>
              <span style={clientesStyles.puntos}>...</span>
            </>
          )}

          {paginasVisibles().map((n) => (
            <button
              key={n}
              onClick={() => irPagina(n)}
              disabled={loading}
              style={{
                ...clientesStyles.pageNumberBtn,
                ...(page === n ? clientesStyles.pageNumberBtnActive : {}),
              }}
            >
              {n}
            </button>
          ))}

          {page < lastPage - 2 && lastPage > 5 && (
            <>
              <span style={clientesStyles.puntos}>...</span>
              <button
                onClick={() => irPagina(lastPage)}
                style={clientesStyles.pageNumberBtn}
              >
                {lastPage}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => irPagina(page + 1)}
          disabled={page >= lastPage || loading}
          style={{
            ...clientesStyles.pageBtn,
            ...(page >= lastPage || loading
              ? clientesStyles.pageBtnDisabled
              : {}),
          }}
        >
          Siguiente →
        </button>
      </div>

      <div style={clientesStyles.pageInfoMobile}>
        Página <strong>{page}</strong> de <strong>{lastPage}</strong>
      </div>

      {modal && (
        <Modal
          titulo={modal === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}
          onClose={() => setModal(null)}
        >
          <div style={formStyle}>
            <Campo label="Nombre *">
              <input
                value={form.nombre || ''}
                onChange={(e) =>
                  setForm({ ...form, nombre: e.target.value })
                }
                style={inputStyle}
              />
            </Campo>

            <Campo label="CI / Documento">
              <input
                value={form.documento || ''}
                onChange={(e) =>
                  setForm({ ...form, documento: e.target.value })
                }
                style={inputStyle}
              />
            </Campo>

            <Campo label="Teléfono">
              <input
                value={form.telefono || ''}
                onChange={(e) =>
                  setForm({ ...form, telefono: e.target.value })
                }
                style={inputStyle}
              />
            </Campo>

            <Campo label="Dirección">
              <input
                value={form.direccion || ''}
                onChange={(e) =>
                  setForm({ ...form, direccion: e.target.value })
                }
                style={inputStyle}
              />
            </Campo>

            <Campo label="Límite de crédito (Gs.) — 0 = sin límite">
              <input
                type="text"
                inputMode="numeric"
                value={
                  form.limite_credito &&
                  parseInt(
                    String(form.limite_credito).replace(/\D/g, '') || '0'
                  ) > 0
                    ? parseInt(
                        String(form.limite_credito).replace(/\D/g, '')
                      ).toLocaleString('es-PY')
                    : form.limite_credito === '0' ||
                      form.limite_credito === 0
                    ? '0'
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  setForm({ ...form, limite_credito: val || '0' })
                }}
                style={inputStyle}
                placeholder="0"
              />
            </Campo>

            <Campo label="Estado">
              <select
                value={form.activo ? '1' : '0'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    activo: e.target.value === '1',
                  })
                }
                style={selectStyle}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </Campo>

            {error && (
              <p style={{ color: '#c0392b', fontSize: 12, margin: 0 }}>
                {error}
              </p>
            )}

            <div style={formBtns}>
              <button onClick={() => setModal(null)} style={btnSecondary}>
                Cancelar
              </button>

              <button onClick={guardar} style={btnPrimary}>
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}


function SecUsuarios() {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const { data } = await client.get('/usuarios', { params: { per_page: 100 } })
      setRows(data.data || data)
    } catch { setRows([]) }
  }

  const abrir = (row) => {
    setForm(row
      ? { id:row.id, name:row.name, email:row.email, role:row.role, pin:row.pin||'', activo:row.activo, password:'' }
      : { name:'', email:'', role:'VENDEDOR', pin:'', activo:true, password:'' }
    )
    setModal(row ? 'editar' : 'nuevo')
    setError('')
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
    } catch (e) { setError(e.response?.data?.message || 'Error al guardar') }
  }

  const cambiarEstado = async (row) => {
    try {
      await client.patch(`/usuarios/${row.id}/estado`, { activo: !row.activo })
      toast.success(`Usuario ${!row.activo ? 'activado' : 'desactivado'} correctamente`)
      cargar()
    } catch (e) { toast.error(e.response?.data?.message || 'Error al cambiar estado') }
  }

  const eliminar = async (row) => {
    if (!confirm(`¿Eliminar usuario "${row.name}"?`)) return
    try { await client.delete(`/usuarios/${row.id}`); toast.success('Usuario eliminado correctamente'); cargar() }
    catch (e) { toast.error(e.response?.data?.message || 'No se puede eliminar') }
  }

  const rolColor = { ADMINISTRADOR:'#6b4f2a', CAJERO:'#185FA5', VENDEDOR:'#1a7a4a' }
  const rolBg = { ADMINISTRADOR:'#f0e8dc', CAJERO:'#e8f0fe', VENDEDOR:'#f0fdf4' }

  return (
    <div style={sec.wrap}>
      <div style={sec.header}>
        <h3 style={sec.titulo}>Usuarios ({rows.length})</h3>
        <button onClick={() => abrir(null)} style={sec.addBtn}>+ Nuevo</button>
      </div>
      <Tabla
        cols={[
          { key:'name', label:'Nombre' },
          { key:'email', label:'Email' },
          { key:'role', label:'Rol', render: (r) => (
            <span style={{ fontSize:11, fontWeight:700, borderRadius:4, padding:'2px 8px', background: rolBg[r.role]||'#f5f5f5', color: rolColor[r.role]||'#4a3520' }}>
              {r.role}
            </span>
          )},
          { key:'pin', label:'PIN', render: (r) => r.pin || '—' },
          { key:'activo', label:'Estado', render: (r) => (
            <button onClick={() => cambiarEstado(r)}
              style={{ fontSize:11, fontWeight:600, borderRadius:4, padding:'2px 8px', border:'none', cursor:'pointer',
                background: r.activo ? '#f0fdf4' : '#fdf0ef',
                color: r.activo ? '#1a7a4a' : '#c0392b' }}>
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
              <input value={form.name||''} onChange={(e) => setForm({...form, name:e.target.value})} style={inputStyle} />
            </Campo>
            <Campo label="Email *">
              <input type="email" value={form.email||''} onChange={(e) => setForm({...form, email:e.target.value})} style={inputStyle} />
            </Campo>
            <Campo label="Rol *">
              <select value={form.role||'VENDEDOR'} onChange={(e) => setForm({...form, role:e.target.value})} style={selectStyle}>
                <option value="vendedor">Vendedor</option>
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
            <Campo label="PIN (opcional)">
              <input type="text" maxLength={6} value={form.pin||''} onChange={(e) => setForm({...form, pin:e.target.value.replace(/\D/g,'')})} style={inputStyle} placeholder="Ej: 1234" />
            </Campo>
            <Campo label={form.id ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
              <input type="password" value={form.password||''} onChange={(e) => setForm({...form, password:e.target.value})} style={inputStyle} />
            </Campo>
            {error && <p style={{ color:'#c0392b', fontSize:12, margin:0 }}>{error}</p>}
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

const sec = {
  wrap: { padding:'1.2rem' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', gap:'0.8rem', flexWrap:'wrap' },
  titulo: { margin:0, fontSize:16, fontWeight:700, color:'#2c1a08' },
  addBtn: { padding:'6px 14px', background:'#b8732a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 },
  subTab: { padding:'5px 14px', border:'1px solid #ddd0be', borderRadius:16, background:'#faf7f2', cursor:'pointer', fontSize:13, color:'#4a3520' },
  subTabOn: { background:'#b8732a', color:'#fff', border:'1px solid #b8732a' },
}



const productosStyles = {
  resumen: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#8a7560',
  },

  filtros: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.8rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },

  buscarBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '1 1 260px',
  },

  perPageBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: 110,
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#4a3520',
  },

  buscarInput: {
    ...inputStyle,
    width: '100%',
  },

  select: {
    ...selectStyle,
    width: '100%',
  },

  clearBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid #ddd0be',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    color: '#4a3520',
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

const clientesStyles = {
  resumen: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#8a7560',
  },

  filtros: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.8rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },

  buscarBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '1 1 260px',
  },

  perPageBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: 110,
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#4a3520',
  },

  buscarInput: {
    ...inputStyle,
    width: '100%',
  },

  select: {
    ...selectStyle,
    width: '100%',
  },

  clearBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid #ddd0be',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    color: '#4a3520',
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

const categoriasStyles = {
  ...clientesStyles,
}

const recipientesStyles = {
  ...clientesStyles,
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { key:'productos', label:'🥩 Productos' },
  { key:'categorias', label:'📂 Categorías' },
  { key:'recipientes', label:'⚖️ Recipientes' },
  { key:'clientes', label:'👥 Clientes' },
  { key:'usuarios', label:'👤 Usuarios' },
]

export default function Configuracion() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { limpiar } = useCajaStore()
  const [tab, setTab] = useState('productos')

  const handleLogout = async () => { await logout(); limpiar(); navigate('/login', { replace: true }) }

  return (
    <div style={p.root}>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />

      <nav style={p.nav}>
        <div style={p.navLeft}>
          <div style={p.navLogo}>ÑG</div>
          <span style={p.navTitulo}>Configuración</span>
        </div>
        <div style={p.navRight}>
          <button onClick={() => navigate('/admin/dashboard')} style={p.navBack}>📊 Dashboard</button>
          <span style={{ fontSize:12, color:'#c9b99a' }}>Administrador</span>
          <button onClick={handleLogout} style={p.navLogout}>Salir</button>
        </div>
      </nav>

      <div style={p.body}>
        {/* Sidebar tabs */}
        <div style={p.sidebar}>
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ ...p.tabBtn, ...(tab===tb.key ? p.tabBtnOn : {}) }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
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
  root: { minHeight:'100vh', display:'flex', flexDirection:'column', background:'#f5f0ea', fontFamily:'system-ui,sans-serif' },
  nav: { background:'#2c1a08', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.55rem clamp(0.7rem, 3vw, 1.2rem)', minHeight:50, flexShrink:0, gap:'0.6rem', flexWrap:'wrap' },
  navLeft: { display:'flex', alignItems:'center', gap:'0.8rem' },
  navLogo: { width:30, height:30, background:'#b8732a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 },
  navTitulo: { fontSize:15, fontWeight:600 },
  navRight: { display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap', justifyContent:'flex-end' },
  navBack: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  navLogout: { background:'transparent', border:'1px solid #5a3a1a', color:'#c9b99a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 },
  body: { display:'flex', flex:1, overflow:'auto', flexWrap:'wrap' },
  sidebar: { flex:'0 0 min(100%, 200px)', background:'#fff', borderRight:'1px solid #e8e0d0', display:'flex', flexDirection:'column', padding:'0.8rem', gap:'0.3rem', flexShrink:0 },
  tabBtn: { padding:'8px 12px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer', textAlign:'left', fontSize:13, color:'#4a3520', fontWeight:500 },
  tabBtnOn: { background:'#fef9f0', color:'#b8732a', fontWeight:700 },
  content: { flex:'1 1 520px', minWidth:'min(100%, 320px)', overflowY:'auto', background:'#fff' },
}
