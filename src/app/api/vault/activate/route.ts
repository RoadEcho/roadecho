import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()

    // 1. Create a secure server-side client to verify the actual logged-in user session
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The method was called from a Server Component.
            }
          },
        },
      }
    )

    // 2. Authenticate the user (prevents malicious ID spoofing)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // 3. Initialize admin client for safe database operations after user is verified
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 4. Fetch the user's current vault state
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

    // 5. Atomic Update with Optimistic Locking (prevents race conditions/double-activation)
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

    return NextResponse.json({ success: true, pass_expires_at: newExpiry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
