// api/send-welcome-email.js
// Vercel serverless function — sends a branded welcome email via Resend.
// Triggered by a Supabase Database Webhook on auth.users INSERT
// (Dashboard → Database → Webhooks), configured to send
// `Authorization: Bearer <WELCOME_EMAIL_SECRET>` as a custom header.

function greetingName(record) {
  return record.raw_user_meta_data?.full_name
    || record.raw_user_meta_data?.name
    || (record.email || '').split('@')[0]
    || 'there';
}

function buildWelcomeEmail(name) {
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#2a1f14">
      <img src="https://www.budgetcore.net/email-welcome-banner.jpg" alt="Welcome to BudgetCore"
        width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0" />
      <div style="background:#fffaf5;padding:28px 32px;border:1px solid #e8dcd0;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:16px">Hi ${name} 👋</p>
        <p>Your account is ready. BudgetCore helps you track income and expenses, understand your spending habits, and work toward your savings goals.</p>
        <p>A few things to try first:</p>
        <ul style="line-height:2">
          <li>Log your first transaction</li>
          <li>Set a monthly budget goal</li>
          <li>Start a savings goal</li>
        </ul>
        <div style="margin-top:24px;text-align:center">
          <a href="https://budgetcore.net/app.html" style="background:#9a6e3a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Open BudgetCore →</a>
        </div>
      </div>
    </div>
  `;
  return { html, subject: 'Welcome to BudgetCore 🎉' };
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      // Falls back to Resend's shared test sender (only delivers to your own
      // Resend account email) until budgetcore.net is verified in Resend —
      // then set RESEND_FROM_EMAIL to something like "BudgetCore <welcome@budgetcore.net>".
      from: process.env.RESEND_FROM_EMAIL || 'BudgetCore <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Resend error ${res.status}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['authorization'] !== `Bearer ${process.env.WELCOME_EMAIL_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const record = req.body?.record;
  if (!record?.email) return res.status(400).json({ error: 'Missing user record.' });

  try {
    const { subject, html } = buildWelcomeEmail(greetingName(record));
    await sendEmail(record.email, subject, html);
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('welcome email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
