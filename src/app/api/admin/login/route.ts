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
      console.error('Missing Supabase environment variables on server.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase service role key.' },
        { status: 500 }
      )
    }

    // Initialize Supabase Service Role client to bypass RLS securely on the server backend
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
      console.error('Admin check failed for email:', cleanEmail, adminError)
      return NextResponse.json(
        { error: 'Access denied. This account is not authorized as an administrator.' },
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
        { error: authError?.message || 'Invalid login credentials.' },
        { status: 401 }
      )
    }

    // 3. Record login into user_logins safely
    try {
      await supabaseAdmin.from('user_logins').insert({
        user_id: authData.user.id,
        email: authData.user.email,
      })
    } catch (err) {
      console.error('Failed to log admin login activity:', err)
    }

    return NextResponse.json({ success: true, session: authData.session })
  } catch (err: any) {
    console.error('Admin login fatal error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
