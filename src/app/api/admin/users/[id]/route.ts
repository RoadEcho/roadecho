import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)

    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify requester is an admin in admin_users table
    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (adminErr || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Resolve params (handles both synchronous and Next.js 15+ Promise-based params)
    const params = await Promise.resolve(context.params)
    const userId = params.id

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 1. Attempt to delete user from Supabase Auth (wrapped gracefully so missing users don't break cleanup)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteErr) {
      console.warn(`Auth deletion warning for user ${userId}:`, deleteErr.message)
    }

    // 2. Clean up all public tables referencing user_id or id to prevent foreign key constraint crashes[span_1](start_span)[span_1](end_span)
    const cleanupOperations = [
      supabaseAdmin.from('user_plates').delete().eq('user_id', userId),
      supabaseAdmin.from('plate_vault').delete().eq('user_id', userId),
      supabaseAdmin.from('passes').delete().eq('user_id', userId),
      supabaseAdmin.from('subscriptions').delete().eq('user_id', userId),
      supabaseAdmin.from('unlocks').delete().eq('user_id', userId),
      supabaseAdmin.from('user_credits').delete().eq('user_id', userId),
      supabaseAdmin.from('user_logins').delete().eq('user_id', userId),
      supabaseAdmin.from('user_pass_vault').delete().eq('user_id', userId),
      supabaseAdmin.from('user_passes').delete().eq('user_id', userId),
      supabaseAdmin.from('user_milestone_claims').delete().eq('user_id', userId),
      supabaseAdmin.from('reward_events').delete().eq('user_id', userId),
      supabaseAdmin.from('shares').delete().eq('user_id', userId),
      supabaseAdmin.from('user_access').delete().eq('id', userId),
    ]

    await Promise.all(cleanupOperations)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API Error deleting user:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 })
  }
}
