import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const newUser = payload.record;
    
    if (!newUser || !newUser.email) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const userEmail = newUser.email;
    const userId = newUser.id;
    const createdAt = newUser.created_at;

    // Use the exact same working admin email address used by your plate claim notifications
    const adminEmail = process.env.ADMIN_EMAIL || process.env.NOTIFICATION_EMAIL || 'roadecho.admin@gmail.com';

    await resend.emails.send({
      from: 'RoadEcho <noreply@roadecho.vercel.app>',
      to: adminEmail,
      subject: 'New User Signup - RoadEcho',
      html: `
        <h2>A new user just signed up on RoadEcho:</h2>
        <ul>
          <li><strong>Email:</strong> ${userEmail}</li>
          <li><strong>User ID:</strong> ${userId}</li>
          <li><strong>Time:</strong> ${createdAt}</li>
        </ul>
      `,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing signup webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
