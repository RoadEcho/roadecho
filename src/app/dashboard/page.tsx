'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Plate {
  id: string
  plate_number: string
  state: string
}

interface Message {
  id: string
  license_plate: string
  state_region: string
  message: string
  created_at: string
}

export default function VaultDashboard() {
  const [plates, setPlates] = useState<Plate[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [plateInput, setPlateInput] = useState('')
  const [stateInput, setStateInput] = useState('DE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [])

  async function fetchUserData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: plateData, error: plateError } = await supabase
      .from('user_plates')
      .select('*')
      .eq('user_id', user.id)

    if (plateError) {
      setError(plateError.message)
    } else {
      setPlates(plateData || [])
      
      if (plateData && plateData.length > 0) {
        const plateNumbers = plateData.map(p => p.plate_number)
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .in('license_plate', plateNumbers)
          .order('created_at', { ascending: false })

        if (!msgError) {
          setMessages(msgData || [])
        }
      }
    }
    setLoading(false)
  }

  async function handleClaimPlate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (plates.length >= 3) {
      setError('You have reached the maximum limit of 3 claimed plates.')
      return
    }

    const { error: insertError } = await supabase
      .from('user_plates')
      .insert([
        {
          user_id: user.id,
          plate_number: plateInput.trim().toUpperCase(),
          state: stateInput.trim().toUpperCase()
        }
      ])

    if (insertError) {
      setError(insertError.message)
    } else {
      setPlateInput('')
      fetchUserData()
    }
  }

  async function handleReleasePlate(plateId: string) {
    setError(null)
    const { error } = await supabase
      .from('user_plates')
      .delete()
      .eq('id', plateId)

    if (error) {
      setError(error.message)
    } else {
      fetchUserData()
    }
  }

  if (loading) return <div className="p-6 text-white text-center mt-20">Loading vault...</div>

  return (
    <div className="max-w-2xl mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white mt-10">
      <h1 className="text-2xl font-bold mb-2">Your Plate Vault</h1>
      <p className="text-slate-400 text-sm mb-6">Claim up to 3 license plates to monitor messages.</p>

      {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>}

      <form onSubmit={handleClaimPlate} className="mb-8 flex gap-3">
        <input
          type="text"
          placeholder="Plate Number"
          value={plateInput}
          onChange={(e) => setPlateInput(e.target.value)}
          required
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white uppercase placeholder-slate-600 focus:outline-none focus:border-cyan-500"
        />
        <input
          type="text"
          placeholder="State"
          maxLength={2}
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          required
          className="w-24 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white uppercase text-center placeholder-slate-600 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={plates.length >= 3}
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          Claim ({plates.length}/3)
        </button>
      </form>

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-300">Claimed Plates</h2>
        {plates.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No plates claimed yet.</p>
        ) : (
          plates.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <span className="font-mono font-bold text-lg tracking-wider text-cyan-400">{p.plate_number}</span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded">{p.state}</span>
              </div>
              <button
                onClick={() => handleReleasePlate(p.id)}
                className="text-sm text-red-400 hover:text-red-300 transition"
              >
                Release
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Messages Received</h2>
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No messages found for your plates.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Plate: {m.license_plate} ({m.state_region})</span>
                <span>{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-200 text-sm">{m.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
