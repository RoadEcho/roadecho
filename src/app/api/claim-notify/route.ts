import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, plateNumber, state } = await request.json()

    const dashboardUrl = 'https://roadecho.vercel.app/dashboard'

    // Send confirmation email to the user with dashboard link
    if (email) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [email],
        subject: `Plate Claimed Successfully: ${plateNumber} (${state})`,
        text: `You have successfully claimed plate ${plateNumber} (${state}) on RoadEcho. You can manage your plates and view incoming messages in your vault dashboard: ${dashboardUrl}`,
        html: `
          <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
            <h2 style="color: #06b6d4; margin-top: 0;">Plate Successfully Claimed</h2>
            <p>You have successfully claimed <strong>${plateNumber} (${state})</strong> to your RoadEcho vault.</p>
            <p>You will now monitor and receive alerts for incoming messages. Manage your claimed plates and view messages anytime here:</p>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
          </div>
        `
      })
    }

    // Send notification email to the admin audit log with dashboard link
    const adminEmail = process.env.ADMIN_EMAIL || 'onboarding@resend.dev'
    await resend.emails.send({
      from: 'RoadEcho System <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[Audit] New Plate Claimed: ${plateNumber} (${state})`,
      text: `User (${email || 'Unknown'}) successfully claimed plate ${plateNumber} (${state}). Access dashboard: ${dashboardUrl}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
          <h2 style="color: #06b6d4; margin-top: 0;">[Audit] New Plate Claimed</h2>
          <p>User (<strong>${email || 'Unknown'}</strong>) successfully claimed plate <strong>${plateNumber} (${state})</strong>.</p>
          <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">View Admin Dashboard</a>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
