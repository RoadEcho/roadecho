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

    const [
      messagesRes,
      passesRes,
      unlocksRes,
      userPassesRes,
      sharesRes,
      referralsRes,
      profilesRes,
      subscriptionsRes,
      platesRes,
      sharesLogsRes,
      messagesLogsRes
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('passes').select('*', { count: 'exact', head: true }),
      supabase.from('unlocks').select('*', { count: 'exact', head: true }),
      supabase.from('user_passes').select('*', { count: 'exact', head: true }),
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      supabase.from('referrals').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('plate_hash', { count: 'exact', head: true }),
      
      supabase.from('shares').select('*').order('created_at', { ascending: false }),
      supabase.from('messages').select('*').order('created_at', { ascending: false })
    ]);

    const totalUnlocksCount = (passesRes.count || 0) + (unlocksRes.count || 0) + (userPassesRes.count || 0);

    return NextResponse.json({ 
      success: true, 
      totalMessages: messagesRes.count || 0,
      platesMessaged: platesRes.count || messagesRes.count || 0,
      totalUnlocks: totalUnlocksCount,
      totalSubscribers: subscriptionsRes.count || 0,
      totalShares: sharesRes.count || 0,
      totalReferrals: referralsRes.count || 0,
      totalAccounts: profilesRes.count || 0,
      breakdowns: {
        vaultActivations: passesRes.data || [],
        shares: sharesLogsRes.data || [],
        messages: messagesLogsRes.data || []
      },
      unlocks: passesRes.data || [],
      sharesList: sharesLogsRes.data || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
