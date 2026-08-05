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

    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (!adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch Auth users with pagination and public users table in parallel
    const [authUsersRes, adminsRes, publicUsersRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('admin_users').select('id, email, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('users').select('*')
    ]);

    if (authUsersRes.error) {
      return NextResponse.json({ error: authUsersRes.error.message }, { status: 400 });
    }

    const authUsers = authUsersRes.data.users || [];
    const publicUsers = publicUsersRes.data || [];
    const admins = adminsRes.data || [];

    const usersMap = new Map();

    // Map all Supabase Auth users
    authUsers.forEach(u => {
      usersMap.set(u.id, {
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignIn: (u as any).last_sign_in_at || (u as any).lastSignInAt || null,
      });
    });

    // Ensure public table users are also merged (catches newly registered profiles instantly)
    publicUsers.forEach((pu: any) => {
      const id = pu.id || pu.user_id;
      const email = pu.email;
      const exists = Array.from(usersMap.values()).some((u: any) => 
        (id && u.id === id) || (email && u.email && u.email.toLowerCase() === email.toLowerCase())
      );

      if (!exists && (id || email)) {
        usersMap.set(id || email, {
          id: id || email,
          email: email || 'Unknown',
          createdAt: pu.created_at || new Date().toISOString(),
          lastSignIn: pu.last_sign_in_at || null,
        });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
