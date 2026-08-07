import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Initialize Supabase Service Role client to bypass RLS securely on the server
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // 1. Verify if the email exists in the admin_users table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (adminError || !adminCheck) {
      return NextResponse.json(
        { error: 'Access denied. This account is not authorized as an administrator.' },
        { status: 403 }
      )
    }

    // 2. Authenticate credentials via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid login credentials.' },
        { status: 401 }
      )
    }

    // 3. Record login into user_logins
    await supabaseAdmin.from('user_logins').insert({
      user_id: authData.user.id,
      email: authData.user.email,
    })

    return NextResponse.json({ success: true, session: authData.session })
  } catch (err: any) {
    console.error('Admin login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
