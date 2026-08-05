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
      supabase.from('messages').select('*').order('created_at', { ascending: false }),
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      supabase.from('referrals').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('passes').select('*').order('created_at', { ascending: false }),
      supabase.from('unlocks').select('*').order('created_at', { ascending: false }),
      supabase.from('user_passes').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_pass_vault').select('*').order('updated_at', { ascending: false }),
      supabase.from('messages').select('plate_hash', { count: 'exact', head: true })
    ]);

    // 1. True Unlocks & Passes (Powers Total Unlocks card & Unlocks Daily timeline without clumping)
    const actualUnlocks: any[] = [];
    (passesRes.data || []).forEach((u: any) => {
      actualUnlocks.push({
        id: `pass-${u.id}`,
        created_at: u.created_at || new Date().toISOString(),
        ...u
      });
    });
    (unlocksRes.data || []).forEach((u: any) => {
      actualUnlocks.push({
        id: `unlock-${u.id}`,
        created_at: u.created_at || new Date().toISOString(),
        ...u
      });
    });
    actualUnlocks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 2. User Passes & Vault State Updates (Powers Total Logins card & Logins Daily breakdown)
    const vaultLogins: any[] = [];
    (userPassesRes.data || []).forEach((u: any) => {
      vaultLogins.push({
        id: `userpass-${u.user_id || u.id}`,
        created_at: u.updated_at || u.created_at || new Date().toISOString(),
        ...u
      });
    });
    (passVaultRes.data || []).forEach((u: any) => {
      vaultLogins.push({
        id: `vault-${u.user_id || u.id}`,
        created_at: u.updated_at || u.created_at || new Date().toISOString(),
        ...u
      });
    });
    vaultLogins.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const sharesLogs = sharesRes.data || [];
    const messagesLogs = messagesRes.data || [];

    return NextResponse.json({ 
      success: true, 
      totalMessages: messagesLogs.length,
      platesMessaged: platesCountRes.count || messagesLogs.length,
      totalUnlocks: actualUnlocks.length,
      totalLogins: vaultLogins.length,
      totalSubscribers: subscriptionsRes.count || 0,
      totalShares: sharesRes.count || 0,
      totalReferrals: referralsRes.count || 0,
      totalAccounts: totalAccountsCount,
      breakdowns: {
        vaultActivations: vaultLogins,
        shares: sharesLogs,
        messages: messagesLogs
      },
      unlocks: actualUnlocks,
      sharesList: sharesLogs,
      messagesList: messagesLogs
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
