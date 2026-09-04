// api/weekly-digest.js
// Vercel Cron: runs every Monday at 8 AM UTC
// Sends a weekly spending summary to all opted-in users via Resend

import admin from 'firebase-admin';

// Lazy-init Firebase Admin (Vercel functions are stateless but instances may be reused)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

const db = admin.firestore();

function fmtUSD(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getWeekRange() {
  const now  = new Date();
  const dow  = now.getUTCDay();
  const mon  = new Date(now); mon.setUTCDate(now.getUTCDate() - ((dow + 6) % 7) - 7); // last Mon
  const sun  = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt  = d => d.toISOString().slice(0, 10);
  return { start: fmt(mon), end: fmt(sun) };
}

async function buildDigest(uid, email, name) {
  const { start, end } = getWeekRange();

  const snap = await db.collection('users').doc(uid).collection('transactions')
    .where('date', '>=', start)
    .where('date', '<=', end)
    .get();

  const txs = snap.docs.map(d => d.data());
  if (!txs.length) return null;

  const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const saved    = income - expenses;

  const catTotals = txs
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + Number(t.amount); return acc; }, {});
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `<li><b>${cat}</b>: ${fmtUSD(amt)}</li>`)
    .join('');

  const greeting = name || email.split('@')[0];
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#2a1f14">
      <div style="background:#9a6e3a;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">BudgetCore Weekly Digest</h1>
        <p style="color:#f5e6d0;margin:4px 0 0;font-size:13px">${start} – ${end}</p>
      </div>
      <div style="background:#fffaf5;padding:28px 32px;border:1px solid #e8dcd0;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:16px">Hi ${greeting} 👋</p>
        <p>Here's your spending summary for last week:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e8dcd0">💰 Income</td><td style="text-align:right;font-weight:600;color:#2d7a3a">${fmtUSD(income)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e8dcd0">💸 Expenses</td><td style="text-align:right;font-weight:600;color:#c03a2b">${fmtUSD(expenses)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700">📊 Net Saved</td><td style="text-align:right;font-weight:700;color:${saved >= 0 ? '#2d7a3a' : '#c03a2b'}">${fmtUSD(Math.abs(saved))} ${saved >= 0 ? '🎉' : '📉'}</td></tr>
        </table>
        ${topCats ? `<p style="font-weight:600;margin-bottom:6px">Top spending categories:</p><ul style="margin:0;padding-left:20px;line-height:2">${topCats}</ul>` : ''}
        <div style="margin-top:24px;text-align:center">
          <a href="https://budgetcore.net/app.html" style="background:#9a6e3a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Open BudgetCore →</a>
        </div>
        <p style="font-size:11px;color:#a89070;margin-top:24px;text-align:center">You're receiving this because you have an account at BudgetCore. <a href="https://budgetcore.net/profile.html" style="color:#9a6e3a">Manage email preferences</a>.</p>
      </div>
    </div>
  `;

  return { html, subject: `Your BudgetCore week: ${fmtUSD(expenses)} spent, ${fmtUSD(Math.abs(saved))} ${saved >= 0 ? 'saved' : 'over'} 📊` };
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'BudgetCore <digest@budgetly-sage.vercel.app>',
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
  // Verify cron secret to prevent unauthorized invocations
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sent = 0, skipped = 0, errors = 0;

  try {
    // Fetch all users — in production you'd paginate, but for small user bases this is fine
    const usersSnap = await db.collection('users').listDocuments();

    for (const userRef of usersSnap) {
      try {
        const profileSnap = await userRef.collection('settings').doc('profile').get();
        const emailDigest = profileSnap.data()?.emailDigest !== false; // default opt-in
        if (!emailDigest) { skipped++; continue; }

        // Get user email via Firebase Auth Admin
        const userRecord = await admin.auth().getUser(userRef.id).catch(() => null);
        if (!userRecord?.email) { skipped++; continue; }

        const digest = await buildDigest(userRef.id, userRecord.email, userRecord.displayName);
        if (!digest) { skipped++; continue; }

        await sendEmail(userRecord.email, digest.subject, digest.html);
        sent++;
      } catch (err) {
        console.error(`digest error for ${userRef.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('weekly-digest fatal:', err);
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ sent, skipped, errors });
}
