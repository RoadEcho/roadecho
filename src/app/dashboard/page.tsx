'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Plate {
  id: string
  plate_number: string
  state: string
  created_at: string
}

export default function VaultDashboard() {
  const [plates, setPlates] = useState<Plate[]>([])
  const [plateInput, setPlateInput] = useState('')
  const [stateInput, setStateInput] = useState('CA')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserPlates()
  }, [])

  async function fetchUserPlates() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('user_plates')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      setError(error.message)
    } else {
      setPlates(data || [])
    }
    setLoading(false)
  }

  async function handleClaimPlate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to claim a plate.')
      return
    }

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
      fetchUserPlates()
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
      fetchUserPlates()
    }
  }

  if (loading) return <div className="p-6 text-white">Loading vault...</div>

  return (
    <div className="max-w-xl mx-auto p-6 bg-zinc-900 text-white rounded-xl shadow-lg mt-10">
      <h1 className="text-2xl font-bold mb-4">Your Plate Vault</h1>
      <p className="text-zinc-400 mb-6">Claim up to 3 license plates to monitor and receive notifications.</p>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">{error}</div>}

      <form onSubmit={handleClaimPlate} className="mb-8 flex gap-3">
        <input
          type="text"
          placeholder="Plate Number"
          value={plateInput}
          onChange={(e) => setPlateInput(e.target.value)}
          required
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white uppercase"
        />
        <input
          type="text"
          placeholder="State"
          maxLength={2}
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          required
          className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white uppercase text-center"
        />
        <button
          type="submit"
          disabled={plates.length >= 3}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed font-semibold rounded transition"
        >
          Claim Plate ({plates.length}/3)
        </button>
      </form>

      <div className="space-y-3">
        {plates.length === 0 ? (
          <p className="text-zinc-500 italic">No plates claimed yet.</p>
        ) : (
          plates.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div>
                <span className="font-mono font-bold text-lg tracking-wider">{p.plate_number}</span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded">{p.state}</span>
              </div>
              <button
                onClick={() => handleReleasePlate(p.id)}
                className="text-sm text-red-400 hover:text-red-300 underline"
              >
                Release
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
