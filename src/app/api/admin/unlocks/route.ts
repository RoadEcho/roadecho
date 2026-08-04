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

    // Fetch from all unlock and pass tables in parallel
    const [passesRes, unlocksRes, userPassesRes, passVaultRes] = await Promise.all([
      supabase.from('passes').select('*').order('created_at', { ascending: false }),
      supabase.from('unlocks').select('*').order('created_at', { ascending: false }),
      supabase.from('user_passes').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_pass_vault').select('*').order('updated_at', { ascending: false })
    ]);

    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];
    const emailMap = new Map<string, string>(
      authUsers.map((u): [string, string] => [u.id, u.email || 'Unknown'])
    );

    const now = new Date();
    const combinedUnlocks: any[] = [];

    // 1. Format standard passes
    (passesRes.data || []).forEach((u: any) => {
      const createdAt = new Date(u.created_at || Date.now());
      const expiresAt = u.expires_at ? new Date(u.expires_at) : new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const isExpired = expiresAt.getTime() <= now.getTime();
      combinedUnlocks.push({
        id: `pass-${u.id}`,
        email: emailMap.get(u.user_id) || 'Customer Pass',
        licensePlate: u.plate || 'Vault Unlock',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        timeLeft: isExpired ? 'Expired' : 'Active',
        isExpired,
        status: isExpired ? 'Expired' : 'Active',
        transactionRef: u.stripe_session_id || 'N/A'
      });
    });

    // 2. Format message unlocks / test unlocks
    (unlocksRes.data || []).forEach((u: any) => {
      const createdAt = new Date(u.created_at || Date.now());
      const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      combinedUnlocks.push({
        id: `unlock-${u.id}`,
        email: emailMap.get(u.user_id) || 'Test Unlock User',
        licensePlate: 'Message Unlock',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        timeLeft: 'Active',
        isExpired: false,
        status: 'Active',
        transactionRef: u.amount ? `Amount: $${u.amount}` : 'Test Unlock'
      });
    });

    // 3. Format user token passes
    (userPassesRes.data || []).forEach((u: any) => {
      const updatedAt = new Date(u.updated_at || Date.now());
      const expiresAt = u.unlock_expires_at ? new Date(u.unlock_expires_at) : new Date(updatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const isExpired = expiresAt.getTime() <= now.getTime();
      combinedUnlocks.push({
        id: `userpass-${u.user_id}`,
        email: emailMap.get(u.user_id) || 'Token User',
        licensePlate: 'Stored Token Pass',
        createdAt: updatedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        timeLeft: isExpired ? 'Expired' : 'Active',
        isExpired,
        status: isExpired ? 'Expired' : 'Active',
        transactionRef: 'Token/Pass Vault'
      });
    });

    // 4. Format pass vault records
    (passVaultRes.data || []).forEach((u: any) => {
      if (u.available_passes > 0 || u.pass_expires_at) {
        const updatedAt = new Date(u.updated_at || Date.now());
        const expiresAt = u.pass_expires_at ? new Date(u.pass_expires_at) : new Date(updatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        const isExpired = expiresAt.getTime() <= now.getTime();
        combinedUnlocks.push({
          id: `vault-${u.user_id}`,
          email: emailMap.get(u.user_id) || 'Vault User',
          licensePlate: `${u.available_passes || 1} Passes Available`,
          createdAt: updatedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          timeLeft: isExpired ? 'Expired' : 'Active',
          isExpired,
          status: isExpired ? 'Expired' : 'Active',
          transactionRef: 'Pass Vault Balance'
        });
      }
    });

    return NextResponse.json({ success: true, unlocks: combinedUnlocks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
