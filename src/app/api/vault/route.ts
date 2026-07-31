import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlateHash } from '../../../lib/hash';

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

    let messages: any[] = [];
    if (plates && plates.length > 0) {
      // 2. Compute cryptographic hashes for the user's plates on the server
      const plateHashes = plates.map(p => getPlateHash(p.plate_number, p.state, 'USA'));

      // 3. Fetch matching messages using the hashes
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('license_plate', plateHashes)
        .order('created_at', { ascending: false });

      if (!msgError) {
        messages = msgData || [];

        // 4. Record vault unlock events for admin command center tracking
        if (messages.length > 0) {
          for (const _ of messages) {
            await supabase.from('unlocks').insert({ amount: 1 });
          }
        }
      }
    }

    return NextResponse.json({ plates, messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
