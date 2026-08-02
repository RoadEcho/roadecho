import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Fetch user vault
    const { data: vault, error } = await supabase
      .from('user_pass_vault')
      .select('available_passes, pass_expires_at')
      .eq('user_id', userId)
      .single()

    if (error || !vault || vault.available_passes <= 0) {
      return NextResponse.json({ error: 'No available passes in your vault!' }, { status: 400 })
    }

    const now = new Date()
    const currentExpiry = vault.pass_expires_at ? new Date(vault.pass_expires_at) : now
    const baseTime = currentExpiry > now ? currentExpiry : now
    
    // Add 24 hours to active pass
    const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString()

    // Deduct 1 available pass and update active expiration
    await supabase.from('user_pass_vault').upsert({
      user_id: userId,
      available_passes: vault.available_passes - 1,
      pass_expires_at: newExpiry,
      updated_at: now.toISOString()
    })

    return NextResponse.json({ success: true, pass_expires_at: newExpiry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
