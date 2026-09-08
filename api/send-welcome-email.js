// api/send-welcome-email.js
// Vercel serverless function — sends a branded welcome email via Resend.
// Triggered by the Postgres trigger in supabase/migrations/0002_welcome_email_webhook.sql
// on auth.users INSERT.

const FEATURES = [
  {
    icon: 'https://www.budgetcore.net/email-icon1.png',
    title: 'Track your spending',
    body: 'See where your money goes and understand your spending habits at a glance.',
  },
  {
    icon: 'https://www.budgetcore.net/email-icon2.png',
    title: 'Plan your budget',
    body: 'Organize your income and expenses and create a budget that works for you.',
  },
  {
    icon: 'https://www.budgetcore.net/email-icon3.png',
    title: 'Save toward your goals',
    body: 'Set financial goals, follow your progress, and stay motivated along the way.',
  },
  {
    icon: 'https://www.budgetcore.net/email-icon4.png',
    title: 'See your progress',
    body: 'See how your finances change over time and how everyday decisions bring you closer to your goals.',
  },
];

function buildWelcomeEmail() {
  const featureRows = FEATURES.map(f => `
    <tr>
      <td width="64" style="vertical-align:top;padding:14px 0">
        <img src="${f.icon}" width="48" height="48" alt="" style="display:block" />
      </td>
      <td style="vertical-align:top;padding:14px 0 14px 16px">
        <div style="font-weight:700;font-size:16px;color:#2a1f14;margin:0 0 3px">${f.title}</div>
        <div style="font-size:14px;color:#7a6a58;line-height:1.5">${f.body}</div>
      </td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:Inter,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#2a1f14;background:#fffaf5">
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fffaf5">
        A smarter way to plan, track, save, and grow.
      </div>

      <img src="https://www.budgetcore.net/email-welcome-banner.jpg" alt="Welcome to BudgetCore"
        width="560" style="display:block;width:100%;max-width:560px;height:auto" />

      <div style="padding:32px 36px 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${featureRows}
        </table>

        <div style="text-align:center;margin:28px 0 12px">
          <p style="font-size:18px;font-weight:700;margin:0 0 4px;color:#2a1f14">Your financial journey starts here.</p>
          <p style="font-size:14px;color:#7a6a58;margin:0 0 24px">Small steps today can make a big difference tomorrow.</p>
          <a href="https://budgetcore.net/app.html"
            style="display:inline-block;background:#c9a875;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;width:220px;height:52px;line-height:52px;border-radius:12px;box-shadow:0 4px 14px rgba(154,110,58,0.28)">
            Start with BudgetCore →
          </a>
        </div>
      </div>

      <div style="text-align:center;padding:24px 32px 32px;border-top:1px solid #e8dcd0;margin-top:8px">
        <p style="font-size:11px;letter-spacing:2px;color:#a8926f;font-weight:700;margin:0 0 8px">PLAN &middot; TRACK &middot; SAVE &middot; GROW</p>
        <p style="font-size:12px;color:#a8926f;margin:0 0 14px">A smarter way to manage your money.</p>
        <p style="font-size:13px;font-weight:700;color:#2a1f14;margin:0">BudgetCore</p>
        <p style="font-size:11px;color:#c0b09a;margin:4px 0 0">© 2026 BudgetCore</p>
      </div>
    </div>
  `;
  return { html, subject: 'Welcome to BudgetCore 📊' };
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
    const { subject, html } = buildWelcomeEmail();
    await sendEmail(record.email, subject, html);
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('welcome email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
