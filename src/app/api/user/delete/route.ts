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

    // Check if Service Role Key is actually available in environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Clean up public tables
    await supabaseAdmin.from('user_plates').delete().eq('user_id', userId);
    await supabaseAdmin.from('plate_vault').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_pass_vault').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_passes').delete().eq('user_id', userId);
    await supabaseAdmin.from('unlocks').delete().eq('user_id', userId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_credits').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Delete user and return the exact Supabase error message if it fails
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
