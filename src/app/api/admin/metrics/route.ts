import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
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

    // Fetch counts and raw data in parallel across all relevant tables
    const [
      messagesRes,
      sharesRes,
      referralsRes,
      profilesRes,
      subscriptionsRes,
      platesRes,
      passesRes,
      unlocksRes,
      userPassesRes,
      passVaultRes,
      sharesLogsRes,
      messagesLogsRes
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      supabase.from('referrals').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('plate_hash', { count: 'exact', head: true }),
      
      supabase.from('passes').select('*').order('created_at', { ascending: false }),
      supabase.from('unlocks').select('*').order('created_at', { ascending: false }),
      supabase.from('user_passes').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_pass_vault').select('*').order('updated_at', { ascending: false }),
      supabase.from('shares').select('*').order('created_at', { ascending: false }),
      supabase.from('messages').select('*').order('created_at', { ascending: false })
    ]);

    // Combine all unlock/pass logs into a single unified array with normalized timestamps
    const allUnlocks: any[] = [];

    (passesRes.data || []).forEach((item) => {
      allUnlocks.push({ ...item, created_at: item.created_at || new Date().toISOString() });
    });
    (unlocksRes.data || []).forEach((item) => {
      allUnlocks.push({ ...item, created_at: item.created_at || new Date().toISOString() });
    });
    (userPassesRes.data || []).forEach((item) => {
      allUnlocks.push({ ...item, created_at: item.updated_at || item.created_at || new Date().toISOString() });
    });
    (passVaultRes.data || []).forEach((item) => {
      if (item.available_passes > 0 || item.pass_expires_at) {
        allUnlocks.push({ ...item, created_at: item.updated_at || item.created_at || new Date().toISOString() });
      }
    });

    // Sort combined unlocks by date descending
    allUnlocks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ 
      success: true, 
      totalMessages: messagesRes.count || 0,
      platesMessaged: platesRes.count || messagesRes.count || 0,
      totalUnlocks: allUnlocks.length,
      totalSubscribers: subscriptionsRes.count || 0,
      totalShares: sharesRes.count || 0,
      totalReferrals: referralsRes.count || 0,
      totalAccounts: profilesRes.count || 0,
      breakdowns: {
        vaultActivations: allUnlocks,
        shares: sharesLogsRes.data || [],
        messages: messagesLogsRes.data || []
      },
      unlocks: allUnlocks,
      sharesList: sharesLogsRes.data || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
