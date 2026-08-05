import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Verify admin access
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (!adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch Auth users and admin list in parallel (Single Source of Truth)
    const [authUsersRes, adminsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('admin_users').select('id, email, created_at').order('created_at', { ascending: false })
    ]);

    if (authUsersRes.error) {
      return NextResponse.json({ error: authUsersRes.error.message }, { status: 400 });
    }

    const authUsers = authUsersRes.data.users || [];
    const admins = adminsRes.data || [];

    // Map Supabase Auth users directly without ghost-user resurrection from logs
    const users = authUsers.map((u: any) => ({
      id: u.id,
      email: u.email || u.user_metadata?.email || 'Unknown',
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at || u.lastSignInAt || null,
    }));

    const totalUsers = users.length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = users.filter(user => {
      if (!user.lastSignIn) return false;
      return new Date(user.lastSignIn) >= thirtyDaysAgo;
    }).length;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      admins,
      users
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
