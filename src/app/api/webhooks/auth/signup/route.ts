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

    // Dispatch email to admin via Resend
    await resend.emails.send({
      from: 'RoadEcho <noreply@roadecho.vercel.app>',
      to: process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com', // Replace with your admin email
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

    console.log(`Signup email notification successfully sent for: ${userEmail}`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing signup webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
