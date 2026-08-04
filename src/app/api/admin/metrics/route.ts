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

    // Verify admin privileges against the admin_users table
    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // Fetch core metric counts and raw log data in parallel
    const [
      messagesRes,
      vaultRes,
      sharesRes,
      referralsRes,
      profilesRes,
      subscriptionsRes,
      platesRes,
      vaultLogsRes,
      sharesLogsRes,
      messagesLogsRes
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('vault_activations').select('*', { count: 'exact', head: true }), // Correctly queries vault_activations[span_4](start_span)[span_4](end_span)
      supabase.from('shares').select('*', { count: 'exact', head: true }),
      supabase.from('referrals').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('plate_hash', { count: 'exact', head: true }),
      
      // Fetch raw logs for activity breakdowns
      supabase.from('vault_activations').select('created_at'),
      supabase.from('shares').select('created_at, share_type'),
      supabase.from('messages').select('created_at')
    ]);

    return NextResponse.json({ 
      success: true, 
      totalMessages: messagesRes.count || 0,
      platesMessaged: platesRes.count || messagesRes.count || 0,
      totalUnlocks: vaultRes.count || 0,
      totalSubscribers: subscriptionsRes.count || 0,
      totalShares: sharesRes.count || 0,
      totalReferrals: referralsRes.count || 0,
      totalAccounts: profilesRes.count || 0,
      breakdowns: {
        vaultActivations: vaultLogsRes.data || [],
        shares: sharesLogsRes.data || [],
        messages: messagesLogsRes.data || []
      },
      messagesBreakdown: { daily: {}, weekly: {}, monthly: {}, yearly: {} },
      unlocksBreakdown: { daily: {}, weekly: {}, monthly: {}, yearly: {} }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
