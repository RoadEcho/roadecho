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

    // Retrieve and verify the authenticated user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Purge user-associated records across target tables using admin client
    
    // 1. Purge user plates
    const { error: platesError } = await supabaseAdmin
      .from('user_plates')
      .delete()
      .eq('user_id', userId);

    if (platesError) {
      console.error('Error purging user_plates:', platesError);
    }

    // 2. Purge pass vault items
    const { error: passVaultError } = await supabaseAdmin
      .from('pass_vault')
      .delete()
      .eq('user_id', userId);

    if (passVaultError) {
      console.error('Error purging pass_vault:', passVaultError);
    }

    // 3. Purge associated messages
    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('sender_id', userId);

    if (messagesError) {
      console.error('Error purging messages:', messagesError);
    }

    // 4. Permanently delete the user account from Supabase Auth (auth.users)
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
