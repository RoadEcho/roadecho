import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, platform, plate } = body;

    // Insert the share record using the service role client (bypasses RLS for anonymous users)
    const { error } = await supabase
      .from('shares')
      .insert([
        {
          user_id: user_id || null,
          platform: platform || 'Web App',
          plate: plate || null,
        }
      ]);

    if (error) {
      console.error('Database error inserting share:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Server error in /api/shares:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Fetch all shares to populate the admin dashboard log
    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shares:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shares = (data || []).map((s: any) => ({
      id: s.id,
      email: s.user_id ? 'Authenticated User' : 'Anonymous User',
      licensePlate: s.plate || 'N/A',
      platform: s.platform || 'Web App',
      createdAt: s.created_at,
    }));

    return NextResponse.json({ shares });
  } catch (err: any) {
    console.error('Server error fetching shares GET:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
