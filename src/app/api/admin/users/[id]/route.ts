import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (adminErr || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const params = await Promise.resolve(context.params);
    const rawId = params.id;

    if (!rawId) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
    }

    let authUserId = rawId;
    let userEmail: string | null = null;

    if (rawId.includes('@')) {
      userEmail = rawId;
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = (listData?.users as any[])?.find(u => u.email?.toLowerCase() === rawId.toLowerCase());
      if (found) {
        authUserId = found.id;
        userEmail = found.email || userEmail;
      }
    } else {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(rawId);
      if (userData?.user) {
        authUserId = userData.user.id;
        userEmail = userData.user.email || (userData.user as any).user_metadata?.email || null;
      }
    }

    const idTargets = [authUserId, rawId].filter(Boolean);
    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    // 1. Delete from Supabase Auth permanently and check for errors
    if (authUserId && !authUserId.includes('@')) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        console.error('Supabase Auth deleteUser error:', deleteAuthError);
        return NextResponse.json({ error: `Failed to delete auth user: ${deleteAuthError.message}` }, { status: 500 });
      }
    }

    // 2. Comprehensive multi-table cleanup
    const tables = [
      'user_plates',
      'plate_vault',
      'passes',
      'subscriptions',
      'unlocks',
      'user_credits',
      'user_logins',
      'user_pass_vault',
      'user_passes',
      'user_milestone_claims',
      'reward_events',
      'shares',
      'messages',
      'user_access',
      'admin_users'
    ];

    for (const table of tables) {
      for (const targetId of idTargets) {
        try {
          await supabaseAdmin.from(table).delete().eq('user_id', targetId);
          await supabaseAdmin.from(table).delete().eq('id', targetId);
        } catch (e) {
          // Suppress individual table errors
        }
      }

      if (cleanEmail) {
        try {
          await supabaseAdmin.from(table).delete().eq('email', cleanEmail);
          await supabaseAdmin.from(table).delete().ilike('email', cleanEmail);
        } catch (e) {
          // Suppress
        }
      }
    }

    if (cleanEmail) {
      try {
        await supabaseAdmin.from('messages').delete().ilike('sender_email', cleanEmail);
      } catch (e) {}
    }

    return NextResponse.json({ success: true, message: 'User permanently purged from system' });
  } catch (err: any) {
    console.error('API Error deleting user:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 });
  }
}
