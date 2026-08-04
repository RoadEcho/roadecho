import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session.' }, { status: 401 });
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // Fetch total accounts directly from Supabase Auth admin API (source of truth)
    const { data: authUsersData } = await supabase.auth.admin.listUsers();
    const totalAccountsCount = authUsersData?.users?.length || 0;

    const [
      messagesRes,
      sharesRes,
      referralsRes,
      subscriptionsRes,
      passesRes,
      unlocksRes,
      userPassesRes,
      passVaultRes,
      platesCountRes
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      supabase.from('referrals').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('passes').select('*').order('created_at', { ascending: false }),
      supabase.from('unlocks').select('*').order('created_at', { ascending: false }),
      supabase.from('user_passes').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_pass_vault').select('*').order('updated_at', { ascending: false }),
      supabase.from('messages').select('plate_hash', { count: 'exact', head: true })
    ]);

    const combinedUnlocks: any[] = [];

    (passesRes.data || []).forEach((u: any) => {
      combinedUnlocks.push({
        id: `pass-${u.id}`,
        created_at: u.created_at || new Date().toISOString(),
        ...u
      });
    });

    (unlocksRes.data || []).forEach((u: any) => {
      combinedUnlocks.push({
        id: `unlock-${u.id}`,
        created_at: u.created_at || new Date().toISOString(),
        ...u
      });
    });

    (userPassesRes.data || []).forEach((u: any) => {
      combinedUnlocks.push({
        id: `userpass-${u.user_id}`,
        created_at: u.updated_at || u.created_at || new Date().toISOString(),
        ...u
      });
    });

    (passVaultRes.data || []).forEach((u: any) => {
      if (u.available_passes > 0 || u.pass_expires_at) {
        combinedUnlocks.push({
          id: `vault-${u.user_id}`,
          created_at: u.updated_at || u.created_at || new Date().toISOString(),
          ...u
        });
      }
    });

    combinedUnlocks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const sharesLogs = sharesRes.data || [];
    const messagesLogs = messagesRes.data || [];

    return NextResponse.json({ 
      success: true, 
      totalMessages: messagesRes.count || 0,
      platesMessaged: platesCountRes.count || messagesRes.count || 0,
      totalUnlocks: combinedUnlocks.length,
      totalSubscribers: subscriptionsRes.count || 0,
      totalShares: sharesRes.count || 0,
      totalReferrals: referralsRes.count || 0,
      totalAccounts: totalAccountsCount,
      breakdowns: {
        vaultActivations: combinedUnlocks,
        shares: sharesLogs,
        messages: messagesLogs
      },
      unlocks: combinedUnlocks,
      sharesList: sharesLogs
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
