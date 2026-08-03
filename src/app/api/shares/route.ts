import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, platform, plate } = body;

    // Insert the share record into the database table
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
