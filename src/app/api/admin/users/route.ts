import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    // Fetch Supabase Auth users and admin_users table records in parallel
    const [authUsersRes, adminsRes] = await Promise.all([
      supabase.auth.admin.listUsers(),
      supabase.from('admin_users').select('id, email, created_at').order('created_at', { ascending: false })
    ]);

    if (authUsersRes.error) {
      return NextResponse.json({ error: authUsersRes.error.message }, { status: 400 });
    }

    const users = authUsersRes.data.users || [];
    const admins = adminsRes.data || [];
    const totalUsers = users.length;

    // Define active users as anyone who logged in within the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = users.filter(user => {
      const lastSignIn = (user as any).last_sign_in_at || (user as any).lastSignInAt;
      if (!lastSignIn) return false;
      return new Date(lastSignIn) >= thirtyDaysAgo;
    }).length;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      admins, // <--- Added admins array here so the dashboard displays them
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignIn: (u as any).last_sign_in_at || (u as any).lastSignInAt,
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
