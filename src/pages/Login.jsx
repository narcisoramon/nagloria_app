import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })

  const handleChange = (e) => {
    clearError()
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form.email, form.password)
    if (result.success) {
      navigate(result.rol === 'CAJERO' ? '/caja' : '/mostrador', { replace: true })
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#faf7f2',padding:'1rem',boxSizing:'border-box'}}>
      <div style={{background:'#fff',border:'1px solid #e8e0d0',borderRadius:16,padding:'clamp(1.4rem, 5vw, 2.5rem) clamp(1rem, 5vw, 2rem)',width:'100%',maxWidth:360,boxSizing:'border-box'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{width:56,height:56,background:'#b8732a',color:'#fff',borderRadius:14,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,marginBottom:'1rem'}}>ÑG</div>
          <h1 style={{fontSize:22,fontWeight:600,color:'#2c1a08',margin:'0 0 4px'}}>Ña Gloria</h1>
          <p style={{fontSize:14,color:'#8a7560',margin:0}}>Sistema de ventas</p>
        </div>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'1.2rem'}}>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={{fontSize:13,fontWeight:500,color:'#4a3520'}}>Usuario</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" required
              style={{padding:'10px 14px',border:'1px solid #ddd0be',borderRadius:8,fontSize:15,background:'#fdfaf6',outline:'none'}} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={{fontSize:13,fontWeight:500,color:'#4a3520'}}>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" required
              style={{padding:'10px 14px',border:'1px solid #ddd0be',borderRadius:8,fontSize:15,background:'#fdfaf6',outline:'none'}} />
          </div>
          {error && <p style={{fontSize:13,color:'#c0392b',background:'#fdf0ef',border:'1px solid #f5c6c6',borderRadius:8,padding:'8px 12px',margin:0}}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{padding:11,background:'#b8732a',color:'#fff',border:'none',borderRadius:8,fontSize:15,fontWeight:600,cursor:'pointer',opacity:loading?0.6:1}}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}