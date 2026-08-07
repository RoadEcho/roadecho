import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function DELETE(request: Request) {
  try {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: tokenData, error: tokenError } = await supabase.auth.getUser(token);
      if (!tokenError && tokenData?.user) {
        user = tokenData.user;
      }
    }

    if (!user) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (!sessionError && sessionData?.user) {
        user = sessionData.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Active session required.' }, { status: 401 });
    }

    const userId = user.id;
    const userEmail = user.email || null;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Explicitly clean up related public table rows first to prevent foreign key constraint violations
    await supabaseAdmin.from('claims').delete().eq('user_id', userId);
    if (userEmail) {
      await supabaseAdmin.from('messages').delete().eq('email', userEmail);
      await supabaseAdmin.from('vault').delete().eq('email', userEmail);
      await supabaseAdmin.from('vault_unlocks').delete().eq('email', userEmail);
      await supabaseAdmin.from('admin_users').delete().eq('email', userEmail);
    }
    await supabaseAdmin.from('shares').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_logins').delete().eq('user_id', userId);

    // Directly delete the user from auth.users safely on the first try.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error('Error deleting user from auth.users:', deleteUserError);
      return NextResponse.json({ error: `Supabase Error: ${deleteUserError.message}` }, { status: 500 });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: 'Account purged successfully.' }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error during deletion:', err);
    return NextResponse.json({ error: `Catch Error: ${err.message || err}` }, { status: 500 });
  }
}
