import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Verify admin privileges against the admin_users table
    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // FIXED: Query the correct 'vault_activations' table
    const { data: unlocks, error } = await supabase
      .from('vault_activations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Fetch auth users safely
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];
    
    const emailMap = new Map<string, string>(
      authUsers.map((u): [string, string] => [u.id, u.email || 'Unknown'])
    );

    const now = new Date();

    const formattedUnlocks = (unlocks || []).map((u: any) => {
      const createdAt = new Date(u.created_at || u.timestamp || Date.now());
      
      const expiresAt = u.expires_at 
        ? new Date(u.expires_at) 
        : new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

      const timeLeftMs = expiresAt.getTime() - now.getTime();
      const isExpired = timeLeftMs <= 0;

      let timeLeftFormatted = 'Expired';
      if (!isExpired) {
        const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (daysLeft > 0) {
          timeLeftFormatted = `${daysLeft}d ${hoursLeft}h left`;
        } else {
          timeLeftFormatted = `${hoursLeft}h left`;
        }
      }

      return {
        id: u.id,
        email: emailMap.get(u.user_id) || u.email || 'Customer Pass',
        licensePlate: u.license_plate || u.plate || 'Vault Unlock',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        timeLeft: timeLeftFormatted,
        isExpired: isExpired,
        status: u.status || (isExpired ? 'Expired' : 'Active'),
        transactionRef: u.stripe_session_id || u.transaction_ref || 'N/A'
      };
    });

    return NextResponse.json({ success: true, unlocks: formattedUnlocks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
