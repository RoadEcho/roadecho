import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Create a request-scoped Supabase client using the user's bearer token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Admin client for fetching profile details securely
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session.' }, { status: 401 });
    }

    // Fetch user profile (includes subscription_tier, status, and stripe_customer_id for banner & portal)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // 1. Fetch user's claimed plates
    const { data: plates, error: plateError } = await supabase
      .from('user_plates')
      .select('*')
      .eq('user_id', user.id);

    if (plateError) {
      return NextResponse.json({ error: plateError.message }, { status: 500 });
    }

    // 2. Check if user has an active subscription, legacy pass, or active vault pass
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const { data: passData } = await supabase
      .from('passes')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const { data: vaultVaultData } = await supabase
      .from('user_pass_vault')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const isVaultPassActive = vaultVaultData?.pass_expires_at && new Date(vaultVaultData.pass_expires_at) > new Date();

    const hasAccess = !!subData || !!passData || !!isVaultPassActive || profile?.subscription_tier === 'pro';

    let messages: any[] = [];
    if (plates && plates.length > 0) {
      // 3. Extract the pre-computed plate hashes directly
      const plateHashes = plates.map(p => p.plate_number);
      const plateMap = new Map(plates.map(p => [p.plate_number, p]));

      // 4. Fetch matching messages using the hashes
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('license_plate', plateHashes)
        .order('created_at', { ascending: false });

      if (!msgError && msgData) {
        // 5. Attach matched plate info and mask content if unauthorized
        messages = msgData.map(m => {
          const matchedPlate = plateMap.get(m.license_plate);
          return {
            ...m,
            plate_display: matchedPlate?.display_plate || 'Vehicle Plate',
            plate_state: matchedPlate?.state || m.state_region,
            message: hasAccess ? m.message : '🔒 [Locked Message]'
          };
        });
      }
    }

    return NextResponse.json({ 
      plates: plates || [], 
      messages, 
      hasAccess,
      profile: profile || { subscription_tier: 'free', subscription_status: 'inactive' },
      vault: vaultVaultData || { available_passes: 0 }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
