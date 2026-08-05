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

    // Fetch Auth users, admin list, and auxiliary login/access records in parallel
    const [authUsersRes, adminsRes, userLoginsRes, userAccessRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('admin_users').select('id, email, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_logins').select('user_id, email, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_access').select('id, email, created_at')
    ]);

    if (authUsersRes.error) {
      return NextResponse.json({ error: authUsersRes.error.message }, { status: 400 });
    }

    const authUsers = authUsersRes.data.users || [];
    const admins = adminsRes.data || [];
    const logins = userLoginsRes.data || [];
    const accessList = userAccessRes.data || [];

    const usersMap = new Map<string, { id: string; email: string; createdAt: string; lastSignIn: string | null }>();

    // 1. Populate from Supabase Auth users
    authUsers.forEach(u => {
      if (u.id) {
        usersMap.set(u.id, {
          id: u.id,
          email: u.email || u.user_metadata?.email || 'Unknown',
          createdAt: u.created_at,
          lastSignIn: (u as any).last_sign_in_at || (u as any).lastSignInAt || null,
        });
      }
    });

    // 2. Merge from user_logins (ensures active session users are always tracked)
    logins.forEach((l: any) => {
      const uid = l.user_id || l.email;
      if (uid && !usersMap.has(uid)) {
        // Check if email already exists under another key
        const existing = Array.from(usersMap.values()).find(u => u.email.toLowerCase() === l.email?.toLowerCase());
        if (!existing && l.email) {
          usersMap.set(uid, {
            id: l.user_id || l.email,
            email: l.email,
            createdAt: l.created_at || new Date().toISOString(),
            lastSignIn: l.created_at || null,
          });
        }
      }
    });

    // 3. Merge from user_access
    accessList.forEach((a: any) => {
      const uid = a.id || a.email;
      if (uid && !usersMap.has(uid)) {
        const existing = Array.from(usersMap.values()).find(u => u.email.toLowerCase() === a.email?.toLowerCase());
        if (!existing && a.email) {
          usersMap.set(uid, {
            id: a.id || a.email,
            email: a.email,
            createdAt: a.created_at || new Date().toISOString(),
            lastSignIn: null,
          });
        }
      }
    });

    const users = Array.from(usersMap.values());
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
