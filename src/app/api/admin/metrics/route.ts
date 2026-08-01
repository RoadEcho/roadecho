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

    // Fetch total message submissions count
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Fetch total vault unlocks count (from Stripe checkouts/passes)
    const { count: totalUnlocks } = await supabase
      .from('user_access')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({ 
      success: true, 
      totalMessages: totalMessages || 0,
      totalUnlocks: totalUnlocks || 0,
      messagesBreakdown: { daily: {}, weekly: {}, monthly: {}, yearly: {} },
      unlocksBreakdown: { daily: {}, weekly: {}, monthly: {}, yearly: {} }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
