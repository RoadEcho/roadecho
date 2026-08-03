import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session.' }, { status: 401 });
    }

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
      .select('pass_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const isVaultPassActive = vaultVaultData?.pass_expires_at && new Date(vaultVaultData.pass_expires_at) > new Date();

    const hasAccess = !!subData || !!passData || !!isVaultPassActive;

    let messages: any[] = [];
    if (plates && plates.length > 0) {
      // 3. Extract the pre-computed plate hashes directly (since user_plates stores the hash)
      const plateHashes = plates.map(p => p.plate_number);

      // 4. Fetch matching messages using the hashes
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('license_plate', plateHashes)
        .order('created_at', { ascending: false });

      if (!msgError && msgData) {
        // 5. Mask message content if the user hasn't paid/subscribed or activated a pass
        messages = msgData.map(m => ({
          ...m,
          message: hasAccess ? m.message : '🔒 [Locked Message]'
        }));
      }
    }

    return NextResponse.json({ plates: plates || [], messages, hasAccess });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
