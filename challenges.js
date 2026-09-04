import { initNav } from './nav.js';
// ============================================================
// BudgetCore — challenges.js
// Savings Challenges + Gamification
// ============================================================

import { auth, db } from './firebase.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, getDocs, serverTimestamp,
} from 'firebase/firestore';

// Challenge definitions
const CHALLENGE_DEFS = [
  {
    id: 'no_dining_7',
    title: 'No Dining Out',
    subtitle: '7-day challenge',
    emoji: '🥗',
    days: 7,
    color: '#5cba7d',
    description: 'Don\'t log any dining out or food delivery for 7 days straight. Cook at home instead.',
    badgeEmoji: '🥗',
    badgeLabel: 'Home Chef',
    checkFn: (txs, startDate, days) => checkNoCategory(txs, startDate, days, ['dining', 'fooddelivery']),
  },
  {
    id: 'no_coffee_7',
    title: 'Coffee-Free Week',
    subtitle: '7-day challenge',
    emoji: '☕',
    days: 7,
    color: '#9a6e3a',
    description: 'Skip the coffee shop for a week. Make it at home. Save ~$40.',
    badgeEmoji: '☕',
    badgeLabel: 'Home Brewer',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['coffee', 'starbucks', 'espresso', 'latte']),
  },
  {
    id: 'no_online_shopping_14',
    title: 'No Online Shopping',
    subtitle: '14-day challenge',
    emoji: '📦',
    days: 14,
    color: '#7b9fe0',
    description: 'Two weeks with no online purchases. If you survive 14 days, you probably didn\'t need it.',
    badgeEmoji: '📦',
    badgeLabel: 'Impulse Buster',
    checkFn: (txs, startDate, days) => checkNoCategory(txs, startDate, days, ['onlineshopping', 'shopping']),
  },
  {
    id: 'save_5_per_day_30',
    title: 'Save $5/Day',
    subtitle: '30-day challenge',
    emoji: '💰',
    days: 30,
    color: '#2d7a3a',
    description: 'Log at least $5 in savings or income every day for 30 days. Build the habit.',
    badgeEmoji: '💰',
    badgeLabel: 'Daily Saver',
    checkFn: checkSave5PerDay,
  },
  {
    id: 'no_subscriptions_30',
    title: 'Subscription Audit Month',
    subtitle: '30-day challenge',
    emoji: '📺',
    days: 30,
    color: '#9878c0',
    description: 'Cancel at least one subscription this month. Review every recurring charge you have.',
    badgeEmoji: '📺',
    badgeLabel: 'Subscription Slayer',
    checkFn: checkSubscriptionAudit,
  },
  {
    id: 'zero_spend_day_5',
    title: '5 Zero-Spend Days',
    subtitle: 'Monthly challenge',
    emoji: '🎯',
    days: 30,
    color: '#e07b54',
    description: 'Have at least 5 days this month with $0 in expenses. Rest days for your wallet.',
    badgeEmoji: '🎯',
    badgeLabel: 'Zero Day Hero',
    checkFn: checkZeroSpendDays,
  },
];

// --- Challenge check functions ---
function dateRange(startDate, days) {
  const start = new Date(startDate + 'T12:00:00');
  const end   = new Date(start);
  end.setDate(start.getDate() + days - 1);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { startISO: fmt(start), endISO: fmt(end) };
}

function checkNoCategory(txs, startDate, days, cats) {
  const { startISO, endISO } = dateRange(startDate, days);
  const violations = txs.filter(tx =>
    tx.type === 'expense' && cats.includes(tx.category) &&
    tx.date >= startISO && tx.date <= endISO
  );
  const today = todayISO();
  const endDate = endISO;
  const elapsed = Math.max(0, daysBetween(startISO, today < endDate ? today : endDate) + 1);
  return { progress: violations.length === 0 ? Math.min(elapsed, days) : 0, total: days, failed: violations.length > 0 };
}

function checkNoKeyword(txs, startDate, days, keywords) {
  const { startISO, endISO } = dateRange(startDate, days);
  const violations = txs.filter(tx =>
    tx.type === 'expense' &&
    keywords.some(kw => tx.description?.toLowerCase().includes(kw)) &&
    tx.date >= startISO && tx.date <= endISO
  );
  const today = todayISO();
  const elapsed = Math.max(0, daysBetween(startISO, today < endISO ? today : endISO) + 1);
  return { progress: violations.length === 0 ? Math.min(elapsed, days) : 0, total: days, failed: violations.length > 0 };
}

function checkSave5PerDay(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  const byDay = {};
  for (const tx of txs) {
    if (tx.date < startISO || tx.date > endISO) continue;
    if (tx.type === 'income') byDay[tx.date] = (byDay[tx.date] || 0) + tx.amount;
  }
  const goodDays = Object.values(byDay).filter(v => v >= 5).length;
  return { progress: goodDays, total: days, failed: false };
}

function checkSubscriptionAudit(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  // Credit: just having started counts as progress; completing means reviewing
  const today = todayISO();
  const elapsed = Math.max(0, daysBetween(startISO, today < endISO ? today : endISO));
  return { progress: Math.min(elapsed, days), total: days, failed: false };
}

function checkZeroSpendDays(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  const spendDays = new Set(
    txs.filter(tx => tx.type === 'expense' && tx.date >= startISO && tx.date <= endISO)
       .map(tx => tx.date)
  );
  // Count all days in range that had no spending
  const today = todayISO();
  let zeroDays = 0;
  const d = new Date(startISO + 'T12:00:00');
  while (d.toISOString().slice(0,10) <= (today < endISO ? today : endISO)) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!spendDays.has(ds)) zeroDays++;
    d.setDate(d.getDate() + 1);
  }
  return { progress: Math.min(zeroDays, 5), total: 5, failed: false };
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// --- Auth + Data ---
let transactions = [];
let activeChallenges = [];
let completedChallenges = [];
let unsubTx = null, unsubCh = null;

document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  document.getElementById('app-content').style.display = '';
  document.getElementById('nav-user').style.display    = 'flex';
  document.getElementById('user-email').textContent    = user.displayName || user.email;
  document.getElementById('welcome-email').textContent = user.displayName || user.email;
  document.getElementById('welcome-date').textContent  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  subscribeData(user.uid);
});

function subscribeData(uid) {
  if (unsubTx) unsubTx();
  if (unsubCh) unsubCh();

  unsubTx = onSnapshot(collection(db, 'users', uid, 'transactions'), snap => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  unsubCh = onSnapshot(collection(db, 'users', uid, 'challenges'), snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    activeChallenges    = all.filter(c => c.status === 'active');
    completedChallenges = all.filter(c => c.status === 'completed');
    renderAll();
  });
}

// --- Render ---
function renderAll() {
  renderStats();
  renderActive();
  renderAvailable();
  renderBadges();
}

function renderStats() {
  document.getElementById('ch-active-count').textContent = activeChallenges.length;
  document.getElementById('ch-done-count').textContent   = completedChallenges.length;

  // Simple streak: count consecutive days with at least one completed challenge or active days
  document.getElementById('ch-streak').textContent = activeChallenges.length > 0
    ? Math.max(...activeChallenges.map(c => daysBetween(c.startDate, todayISO()) + 1), 0)
    : 0;
}

function renderActive() {
  const section = document.getElementById('active-challenges-section');
  const list    = document.getElementById('active-challenges-list');
  const count   = document.getElementById('active-ch-count');

  if (!activeChallenges.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  count.textContent = activeChallenges.length;

  list.innerHTML = activeChallenges.map(ch => {
    const def     = CHALLENGE_DEFS.find(d => d.id === ch.defId);
    if (!def) return '';

    const result  = def.checkFn(transactions, ch.startDate, def.days);
    const pct     = Math.min(100, Math.round((result.progress / result.total) * 100));
    const daysSince = daysBetween(ch.startDate, todayISO()) + 1;
    const daysLeft  = Math.max(0, def.days - daysSince);
    const isComplete = result.progress >= result.total;

    // Auto-complete
    if (isComplete && auth.currentUser) {
      updateDoc(doc(db, 'users', auth.currentUser.uid, 'challenges', ch.id), { status: 'completed', completedAt: todayISO() }).catch(() => {});
    }

    return `
      <div class="challenge-active-card" style="border-left-color:${def.color}">
        <div class="cha-top">
          <span class="cha-emoji">${def.emoji}</span>
          <div class="cha-info">
            <span class="cha-title">${def.title}</span>
            <span class="cha-sub">${result.failed ? '❌ Failed — restart to try again' : daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'Almost done!'}</span>
          </div>
          <span class="cha-pct" style="color:${def.color}">${pct}%</span>
        </div>
        <div class="cha-track">
          <div class="cha-fill" style="width:${pct}%;background:${def.color}"></div>
        </div>
        <div class="cha-actions">
          <span class="cha-detail">${result.progress} / ${result.total} ${isComplete ? '🎉' : ''}</span>
          <button type="button" class="btn-ghost btn-sm ch-abandon-btn" data-id="${ch.id}">Abandon</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.ch-abandon-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Abandon this challenge?')) return;
      const uid = auth.currentUser?.uid;
      if (uid) await deleteDoc(doc(db, 'users', uid, 'challenges', btn.dataset.id)).catch(() => {});
    });
  });
}

function renderAvailable() {
  const activeDefIds = new Set(activeChallenges.map(c => c.defId));
  const completedDefIds = new Set(completedChallenges.map(c => c.defId));

  document.getElementById('available-challenges').innerHTML = CHALLENGE_DEFS.map(def => {
    const isActive    = activeDefIds.has(def.id);
    const isCompleted = completedDefIds.has(def.id);
    return `
      <div class="challenge-card" style="--ch-color:${def.color}">
        <div class="chc-emoji">${def.emoji}</div>
        <h3 class="chc-title">${def.title}</h3>
        <span class="chc-sub">${def.subtitle}</span>
        <p class="chc-desc">${def.description}</p>
        <div class="chc-footer">
          ${isCompleted
            ? `<span class="chc-badge chc-badge--done">✓ Completed</span>`
            : isActive
              ? `<span class="chc-badge chc-badge--active">🔥 In Progress</span>`
              : `<button type="button" class="btn chc-start-btn" data-id="${def.id}">Start Challenge</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.chc-start-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      btn.disabled = true; btn.textContent = 'Starting…';
      try {
        await addDoc(collection(db, 'users', uid, 'challenges'), {
          defId:     btn.dataset.id,
          status:    'active',
          startDate: todayISO(),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Start Challenge';
        console.error(err);
      }
    });
  });
}

function renderBadges() {
  const section = document.getElementById('badges-section');
  if (!completedChallenges.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  document.getElementById('badges-grid').innerHTML = completedChallenges.map(ch => {
    const def = CHALLENGE_DEFS.find(d => d.id === ch.defId);
    if (!def) return '';
    return `
      <div class="badge-item">
        <span class="badge-emoji">${def.badgeEmoji}</span>
        <span class="badge-label">${def.badgeLabel}</span>
        <span class="badge-date">${ch.completedAt || ''}</span>
      </div>
    `;
  }).join('');
}
initNav();
