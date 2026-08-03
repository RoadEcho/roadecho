import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: Request) {
  try {
    // 1. Authenticate user via Bearer token sent from the frontend
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // 2. Initialize admin client for safe database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Fetch the user's current vault state
    const { data: vault, error: fetchError } = await supabaseAdmin
      .from('user_pass_vault')
      .select('available_passes, pass_expires_at')
      .eq('user_id', userId)
      .single()

    if (fetchError || !vault || vault.available_passes <= 0) {
      return NextResponse.json({ error: 'No available passes in your vault!' }, { status: 400 })
    }

    const now = new Date()
    const currentExpiry = vault.pass_expires_at ? new Date(vault.pass_expires_at) : now
    const baseTime = currentExpiry > now ? currentExpiry : now
    
    // Add 24 hours to active pass expiration
    const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString()

    // 4. Atomic Update with Optimistic Locking (prevents race conditions/double-activation)
    const { data: updatedVault, error: updateError } = await supabaseAdmin
      .from('user_pass_vault')
      .update({
        available_passes: vault.available_passes - 1,
        pass_expires_at: newExpiry,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId)
      .eq('available_passes', vault.available_passes) // Ensures pass count hasn't changed concurrently
      .select()
      .single()

    if (updateError || !updatedVault) {
      return NextResponse.json({ error: 'Conflict detected, please try again.' }, { status: 409 })
    }

    // 5. Log unlock event for admin analytics metrics
    try {
      await supabaseAdmin.from('unlocks').insert({
        user_id: userId,
        type: 'stored_pass_activation',
        created_at: now.toISOString()
      })
    } catch (analyticsErr) {
      console.error('Failed to log admin unlock analytics:', analyticsErr)
    }

    // 6. Return updated pass count so frontend state updates from 2 to 1 instantly
    return NextResponse.json({
      success: true,
      available_passes: updatedVault.available_passes,
      pass_expires_at: newExpiry
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
