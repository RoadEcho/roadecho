'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.updateUser({ password })
    
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      alert('Password updated successfully!')
      router.push('/admin') 
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleUpdatePassword} style={{ background: '#0f172a', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #1e293b' }}>
        <h2 style={{ marginBottom: '20px' }}>Set New Admin Password</h2>
        {errorMsg && <p style={{ color: '#ef4444', marginBottom: '15px' }}>{errorMsg}</p>}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>New Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#06b6d4', color: '#020617', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
