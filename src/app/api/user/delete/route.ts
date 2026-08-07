import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function DELETE(request: Request) {
  try {
    const cookieStore = cookies();
    
    // Initialize Supabase server client with cookie persistence for session check
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

    // 1. Check for Authorization Bearer token first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: tokenData, error: tokenError } = await supabase.auth.getUser(token);
      if (!tokenError && tokenData?.user) {
        user = tokenData.user;
      }
    }

    // 2. Fallback to cookie session check if no bearer token
    if (!user) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (!sessionError && sessionData?.user) {
        user = sessionData.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Active session required.' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Initialize Supabase Admin client (Service Role) to bypass RLS and delete auth user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Optional manual cleanup of specific tables matching your actual schema
    await supabaseAdmin.from('user_plates').delete().eq('user_id', userId);
    await supabaseAdmin.from('plate_vault').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_pass_vault').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_passes').delete().eq('user_id', userId);
    await supabaseAdmin.from('unlocks').delete().eq('user_id', userId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_credits').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Permanently delete the user account from Supabase Auth (auth.users)
    // Cascades will handle any remaining linked rows automatically
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error('Error deleting user from auth.users:', deleteUserError);
      return NextResponse.json(
        { error: 'Failed to purge account from authentication system.' },
        { status: 500 }
      );
    }

    // Invalidate active session/cookies client-side
    await supabase.auth.signOut();

    return NextResponse.json(
      { 
        success: true, 
        message: 'Account data and associated records have been successfully and permanently purged.' 
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error during DSR account deletion:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
