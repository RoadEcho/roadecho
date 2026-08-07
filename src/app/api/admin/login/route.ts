import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server config error: Missing Supabase URL or Service Role Key.' },
        { status: 500 }
      )
    }

    // Initialize Supabase Service Role client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const cleanEmail = email.trim().toLowerCase()

    // 1. Verify if the email exists in the admin_users table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', cleanEmail)
      .single()

    if (adminError || !adminCheck) {
      // Return the exact database error message to the screen for debugging
      return NextResponse.json(
        { error: `DB Error: ${adminError?.message || 'No matching admin user row found'}` },
        { status: 403 }
      )
    }

    // 2. Authenticate credentials via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: `Auth Error: ${authError?.message || 'Invalid login credentials'}` },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true, session: authData.session })
  } catch (err: any) {
    return NextResponse.json({ error: `Fatal Error: ${err.message}` }, { status: 500 })
  }
}
