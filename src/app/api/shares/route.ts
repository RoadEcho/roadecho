import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, user_id, platform, type, email, licensePlate, metadata = {} } = body;

    const finalUserId = userId || user_id || null;
    const finalPlatform = type || platform || 'general';

    // Try inserting with all fields (new schema)
    const insertData: any = {
      platform: finalPlatform,
      created_at: new Date().toISOString(),
    };

    if (finalUserId) insertData.user_id = finalUserId;
    if (email) insertData.email = email;
    if (licensePlate) insertData.licensePlate = licensePlate;
    if (metadata) insertData.metadata = metadata;

    let { data, error } = await supabase
      .from('shares')
      .insert([insertData])
      .select();

    // Fallback if strict schema columns (like user_id or metadata) don't exist yet in the table
    if (error) {
      const fallbackData: any = {
        platform: finalPlatform,
      };
      if (email) fallbackData.email = email;
      if (licensePlate) fallbackData.licensePlate = licensePlate;

      const fallbackResult = await supabase
        .from('shares')
        .insert([fallbackData])
        .select();
      
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error('Supabase share insert error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('API share error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error, count } = await supabase
      .from('shares')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback query if created_at column is missing
      const fallbackQuery = await supabase
        .from('shares')
        .select('*', { count: 'exact' });

      return NextResponse.json({ 
        success: true, 
        count: fallbackQuery.count ?? fallbackQuery.data?.length ?? 0, 
        shares: fallbackQuery.data || [] 
      });
    }

    return NextResponse.json({ 
      success: true, 
      count: count ?? data?.length ?? 0, 
      shares: data || [] 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
