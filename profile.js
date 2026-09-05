// ============================================================
// BudgetCore — profile.js
// ============================================================

import { auth, db } from './firebase.js';
import { initPageTransitions } from './transitions.js';
import { initNav } from './nav.js';
import {
  onAuthStateChanged, signOut, updateProfile, updatePassword, deleteUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
  addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

// ── Savings Challenge definitions ───────────────────────────────────────────
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
  {
    id: 'no_fastfood_7',
    title: 'Skip Fast Food',
    subtitle: '7-day challenge',
    emoji: '🍔',
    days: 7,
    color: '#e0a020',
    description: 'No fast food for a full week. Cook or order healthy. Your wallet and body will thank you.',
    badgeEmoji: '🍔',
    badgeLabel: 'Burger Buster',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['mcdonald', 'burger king', 'kfc', 'wendys', 'taco bell', 'subway', 'popeyes', 'chick-fil', 'fastfood', 'fast food']),
  },
  {
    id: 'no_rideshare_14',
    title: 'No Rideshare Fortnight',
    subtitle: '14-day challenge',
    emoji: '🚌',
    days: 14,
    color: '#3aa0c8',
    description: 'Ditch Uber & Lyft for 2 weeks. Walk, bike, or take public transit. Save $50+.',
    badgeEmoji: '🚌',
    badgeLabel: 'Transit Champ',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['uber', 'lyft', 'taxi', 'rideshare', 'grab', 'bolt ride']),
  },
  {
    id: 'weekend_no_spend_2',
    title: 'Spend-Free Weekends',
    subtitle: '2-weekend challenge',
    emoji: '🌿',
    days: 14,
    color: '#58b078',
    description: 'No spending on Saturdays or Sundays for 2 full weekends. Find free ways to enjoy your time.',
    badgeEmoji: '🌿',
    badgeLabel: 'Weekend Zen',
    checkFn: checkWeekendNoSpend,
  },
  {
    id: 'no_delivery_7',
    title: 'No Food Delivery',
    subtitle: '7-day challenge',
    emoji: '🛵',
    days: 7,
    color: '#e05c5c',
    description: 'Skip DoorDash, UberEats, and Deliveroo for a week. Cook or pick it up yourself.',
    badgeEmoji: '🛵',
    badgeLabel: 'Kitchen Hero',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['doordash', 'ubereats', 'grubhub', 'deliveroo', 'postmates', 'delivery']),
  },
  {
    id: 'no_alcohol_30',
    title: 'Dry Month',
    subtitle: '30-day challenge',
    emoji: '🚱',
    days: 30,
    color: '#7e57c2',
    description: 'No spending at bars or on alcohol for a full month. Your liver and budget will both recover.',
    badgeEmoji: '🚱',
    badgeLabel: 'Sober Saver',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['bar', 'pub', 'brewery', 'winery', 'liquor', 'alcohol', 'beer', 'wine', 'spirits', 'cocktail']),
  },
  {
    id: 'no_clothing_14',
    title: 'No New Clothes',
    subtitle: '14-day challenge',
    emoji: '👕',
    days: 14,
    color: '#c0766a',
    description: 'Two weeks without buying clothes, shoes, or accessories. Wear what you already own.',
    badgeEmoji: '👕',
    badgeLabel: 'Closet Master',
    checkFn: (txs, startDate, days) => checkNoCategory(txs, startDate, days, ['clothing', 'fashion', 'shopping']),
  },
  {
    id: 'no_gaming_14',
    title: 'No Gaming Spend',
    subtitle: '14-day challenge',
    emoji: '🎮',
    days: 14,
    color: '#5c8fe0',
    description: 'No in-game purchases, game downloads, or gaming subscriptions for 2 weeks.',
    badgeEmoji: '🎮',
    badgeLabel: 'Free-to-Play',
    checkFn: (txs, startDate, days) => checkNoKeyword(txs, startDate, days, ['steam', 'xbox', 'playstation', 'nintendo', 'in-game', 'gaming', 'game pass', 'apple arcade']),
  },
  {
    id: 'track_every_day_7',
    title: 'Log Every Day',
    subtitle: '7-day habit challenge',
    emoji: '📓',
    days: 7,
    color: '#20a0a0',
    description: 'Add at least one transaction every day for 7 days. Build the tracking habit.',
    badgeEmoji: '📓',
    badgeLabel: 'Habit Builder',
    checkFn: checkLogEveryDay,
  },
  {
    id: 'daily_under_30',
    title: 'Under $30/Day',
    subtitle: '14-day challenge',
    emoji: '🪙',
    days: 14,
    color: '#b89a30',
    description: 'Keep your daily spending under $30 for 14 days straight. Every day counts.',
    badgeEmoji: '🪙',
    badgeLabel: 'Penny Pilot',
    checkFn: checkDailyUnder30,
  },
  {
    id: 'save_200_month',
    title: 'Save $200 This Month',
    subtitle: '30-day challenge',
    emoji: '🏦',
    days: 30,
    color: '#2d8a6a',
    description: 'Log at least $200 in savings or income above your expenses this month.',
    badgeEmoji: '🏦',
    badgeLabel: 'Big Saver',
    checkFn: checkSave200Month,
  },
  {
    id: 'no_entertainment_14',
    title: 'No Entertainment Spend',
    subtitle: '14-day challenge',
    emoji: '🎬',
    days: 14,
    color: '#c060a0',
    description: 'No movies, concerts, clubs, or paid streaming add-ons for 2 weeks. Find free fun.',
    badgeEmoji: '🎬',
    badgeLabel: 'Frugal Fun',
    checkFn: (txs, startDate, days) => checkNoCategory(txs, startDate, days, ['entertainment', 'events']),
  },
  {
    id: 'no_impulse_3days',
    title: '3-Day Cooling Rule',
    subtitle: 'Mindfulness challenge',
    emoji: '🧘',
    days: 21,
    color: '#78a060',
    description: 'For 3 weeks, log every non-essential purchase you want but wait 3 days before buying. Track the ones you skip.',
    badgeEmoji: '🧘',
    badgeLabel: 'Mindful Spender',
    checkFn: (txs, startDate, days) => checkSubscriptionAudit(txs, startDate, days),
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

function checkLogEveryDay(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  const today = todayISO();
  const cap = today < endISO ? today : endISO;
  const txDays = new Set(
    txs.filter(tx => tx.date >= startISO && tx.date <= endISO).map(tx => tx.date)
  );
  let streak = 0;
  const d = new Date(startISO + 'T12:00:00');
  while (d.toISOString().slice(0,10) <= cap) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (txDays.has(ds)) streak++;
    else break;
    d.setDate(d.getDate() + 1);
  }
  return { progress: Math.min(streak, days), total: days, failed: streak === 0 && daysBetween(startISO, today) > 1 };
}

function checkDailyUnder30(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  const today = todayISO();
  const cap = today < endISO ? today : endISO;
  const byDay = {};
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.date < startISO || tx.date > endISO) continue;
    byDay[tx.date] = (byDay[tx.date] || 0) + tx.amount;
  }
  const failed = Object.values(byDay).some(v => v > 30);
  const elapsed = Math.max(0, daysBetween(startISO, cap) + 1);
  return { progress: failed ? 0 : Math.min(elapsed, days), total: days, failed };
}

function checkSave200Month(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  let income = 0, expenses = 0;
  for (const tx of txs) {
    if (tx.date < startISO || tx.date > endISO) continue;
    if (tx.type === 'income') income += tx.amount;
    else expenses += tx.amount;
  }
  const saved = Math.max(0, income - expenses);
  return { progress: Math.min(saved, 200), total: 200, failed: false };
}

function checkWeekendNoSpend(txs, startDate, days) {
  const { startISO, endISO } = dateRange(startDate, days);
  const today = todayISO();
  const spendDays = new Set(
    txs.filter(tx => tx.type === 'expense' && tx.date >= startISO && tx.date <= endISO)
       .map(tx => tx.date)
  );
  let cleanWeekendDays = 0;
  let totalWeekendDays = 0;
  const d = new Date(startISO + 'T12:00:00');
  const cap = today < endISO ? today : endISO;
  while (d.toISOString().slice(0,10) <= cap) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      totalWeekendDays++;
      if (!spendDays.has(ds)) cleanWeekendDays++;
    }
    d.setDate(d.getDate() + 1);
  }
  const failed = totalWeekendDays > 0 && cleanWeekendDays < totalWeekendDays;
  return { progress: Math.min(cleanWeekendDays, 4), total: 4, failed };
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const USER_TYPE_TIPS = {
  spender: { icon: '🛍️', texts: [
    'Try the 24-hour rule: wait a day before any non-essential purchase.',
    'Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
    'Track every impulse buy this month — awareness is the first step.',
  ]},
  saver: { icon: '🐷', texts: [
    'Automate your savings — treat it like a non-negotiable bill.',
    'Small wins count: every $10 saved adds up to $120 a year.',
    'Review your subscriptions monthly and cancel what you don\'t use.',
  ]},
  learner: { icon: '📚', texts: [
    'Start with an emergency fund: aim for 1 month of expenses first.',
    'The budget you actually follow is better than the perfect one.',
    'Learning to track spending is the foundation of every money goal.',
  ]},
  investor: { icon: '📈', texts: [
    'Time in the market beats timing the market — stay consistent.',
    'Track your net worth monthly, not just your spending.',
    'Reduce lifestyle inflation: every raise is a savings opportunity.',
  ]},
  fighter: { icon: '⚔️', texts: [
    'Target the highest-interest debt first — the avalanche method saves money.',
    'Even $20 extra toward debt each month compounds into hundreds saved.',
    'Celebrate every debt payoff milestone — momentum is powerful.',
  ]},
};

const USER_TYPE_LABELS = {
  spender: 'Spender', saver: 'Saver', learner: 'Budget Learner',
  investor: 'Investor', fighter: 'Debt-Fighter',
};

let currentUser  = null;
let profileData  = {};
let transactions = [];
let goals        = [];
let activeChallenges    = [];
let completedChallenges = [];

// ── Init ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  currentUser = user;
  document.getElementById('nav-signout-li').style.display = '';
  document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

  // Load data in parallel
  const [profileSnap, txSnap, goalsSnap, challengesSnap] = await Promise.all([
    getDoc(doc(db, 'users', user.uid, 'settings', 'userProfile')),
    getDocs(collection(db, 'users', user.uid, 'transactions')),
    getDocs(collection(db, 'users', user.uid, 'goals')),
    getDocs(collection(db, 'users', user.uid, 'challenges')),
  ]);

  profileData  = profileSnap.exists()  ? profileSnap.data()  : {};
  transactions = txSnap.docs.map(d => d.data());
  goals        = goalsSnap.docs.map(d => d.data());

  const allChallenges = challengesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  activeChallenges     = allChallenges.filter(c => c.status === 'active');
  completedChallenges  = allChallenges.filter(c => c.status === 'completed');

  renderHero(user);
  renderTypeGrid();
  renderTip();
  renderChallengeStats();
  renderActiveChallenges();
  renderAvailableChallenges();
  renderChallengeBadges();

  document.getElementById('profile-content').style.display = '';
  setupSettings(user);
});

// ── Render: Hero ─────────────────────────────────────────────────────────────
function renderHero(user) {
  const name  = user.displayName || user.email.split('@')[0];
  document.getElementById('prof-name').textContent  = name;
  document.getElementById('prof-email').textContent = user.email;
  document.getElementById('settings-name-value').textContent = name;
  document.getElementById('new-name-input').value = name;

  // Avatar
  if (profileData.avatarData) {
    setAvatarImage(profileData.avatarData);
  } else if (profileData.avatar) {
    setAvatarDefault(profileData.avatar);
  }

  // Avatar defaults — mark active
  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.avatar === String(profileData.avatar));
  });

  // Type badge
  if (profileData.userType) {
    const badge = document.getElementById('prof-type-badge');
    badge.textContent = USER_TYPE_LABELS[profileData.userType] || profileData.userType;
    badge.style.display = '';
  }
}

function setAvatarImage(src) {
  const el = document.getElementById('prof-avatar');
  el.innerHTML = `<img src="${src}" alt="Avatar" class="prof-avatar-img" />`;
}

function setAvatarDefault(num) {
  const btn = document.querySelector(`.avatar-opt[data-avatar="${num}"]`);
  if (!btn) return;
  const el = document.getElementById('prof-avatar');
  el.innerHTML = btn.innerHTML;
}

// ── Avatar picker ─────────────────────────────────────────────────────────────
let pendingAvatarUpdate = null;

document.querySelectorAll('.avatar-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setAvatarDefault(btn.dataset.avatar);
    pendingAvatarUpdate = { avatar: btn.dataset.avatar, avatarData: null };
    document.getElementById('avatar-save-btn').style.display = '';
  });
});

document.getElementById('avatar-save-btn').addEventListener('click', async () => {
  if (!pendingAvatarUpdate) return;
  const btn = document.getElementById('avatar-save-btn');
  btn.textContent = 'Saving…';
  btn.disabled = true;
  await saveProfile(pendingAvatarUpdate);
  Object.assign(profileData, pendingAvatarUpdate);
  pendingAvatarUpdate = null;
  btn.style.display = 'none';
  btn.textContent = 'Save Avatar';
  btn.disabled = false;
});

document.getElementById('avatar-upload').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const data = e.target.result;
    setAvatarImage(data);
    document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
    pendingAvatarUpdate = { avatarData: data, avatar: null };
    document.getElementById('avatar-save-btn').style.display = '';
  };
  reader.readAsDataURL(file);
});

// ── User type grid ────────────────────────────────────────────────────────────
function renderTypeGrid() {
  document.querySelectorAll('.type-card').forEach(card => {
    card.classList.toggle('active', card.dataset.type === profileData.userType);
    card.addEventListener('click', async () => {
      document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      profileData.userType = card.dataset.type;
      const badge = document.getElementById('prof-type-badge');
      badge.textContent = USER_TYPE_LABELS[card.dataset.type];
      badge.style.display = '';
      await saveProfile({ userType: card.dataset.type });
      renderTip();
    });
  });
}

// ── Tip card ─────────────────────────────────────────────────────────────────
function renderTip() {
  const type   = profileData.userType;
  const tipSec = document.getElementById('tip-section');
  if (!type) { tipSec.style.display = 'none'; return; }

  const tipData = USER_TYPE_TIPS[type];
  if (!tipData) { tipSec.style.display = 'none'; return; }

  // Pick tip based on spending data for some variation
  const totalTx   = transactions.length;
  const idx       = totalTx % tipData.texts.length;
  const text      = tipData.texts[idx];

  document.getElementById('tip-icon').textContent = tipData.icon;
  document.getElementById('tip-text').textContent = text;
  tipSec.style.display = '';
}

// ── Savings Challenges ───────────────────────────────────────────────────────
async function refreshChallenges() {
  if (!currentUser) return;
  const snap = await getDocs(collection(db, 'users', currentUser.uid, 'challenges'));
  const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  activeChallenges    = all.filter(c => c.status === 'active');
  completedChallenges = all.filter(c => c.status === 'completed');
  renderChallengeStats();
  renderActiveChallenges();
  renderAvailableChallenges();
  renderChallengeBadges();
}

function renderChallengeStats() {
  document.getElementById('ch-active-count').textContent = activeChallenges.length;
  document.getElementById('ch-done-count').textContent   = completedChallenges.length;
  document.getElementById('ch-streak').textContent = activeChallenges.length > 0
    ? Math.max(...activeChallenges.map(c => daysBetween(c.startDate, todayISO()) + 1), 0)
    : 0;
}

function renderActiveChallenges() {
  const section = document.getElementById('active-challenges-section');
  const list    = document.getElementById('active-challenges-list');
  const count   = document.getElementById('active-ch-count');

  if (!activeChallenges.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  count.textContent = activeChallenges.length;

  list.innerHTML = activeChallenges.map(ch => {
    const def = CHALLENGE_DEFS.find(d => d.id === ch.defId);
    if (!def) return '';

    const result    = def.checkFn(transactions, ch.startDate, def.days);
    const pct       = Math.min(100, Math.round((result.progress / result.total) * 100));
    const daysSince = daysBetween(ch.startDate, todayISO()) + 1;
    const daysLeft  = Math.max(0, def.days - daysSince);
    const isComplete = result.progress >= result.total;

    if (isComplete && currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid, 'challenges', ch.id), { status: 'completed', completedAt: todayISO() })
        .then(refreshChallenges).catch(() => {});
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
      if (currentUser) {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'challenges', btn.dataset.id)).catch(() => {});
        refreshChallenges();
      }
    });
  });
}

function renderAvailableChallenges() {
  const activeDefIds    = new Set(activeChallenges.map(c => c.defId));
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
      if (!currentUser) return;
      btn.disabled = true; btn.textContent = 'Starting…';
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'challenges'), {
          defId:     btn.dataset.id,
          status:    'active',
          startDate: todayISO(),
          createdAt: serverTimestamp(),
        });
        refreshChallenges();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Start Challenge';
        console.error(err);
      }
    });
  });
}

function renderChallengeBadges() {
  const section = document.getElementById('challenge-badges-section');
  if (!completedChallenges.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  document.getElementById('challenge-badges-grid').innerHTML = completedChallenges.map(ch => {
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

// ── Account settings ──────────────────────────────────────────────────────────
function setupSettings(user) {

  // Change name
  document.getElementById('settings-name-btn').addEventListener('click', () => {
    document.getElementById('settings-name-form').style.display = '';
    document.getElementById('settings-name-btn').style.display = 'none';
    document.getElementById('new-name-input').focus();
  });
  document.getElementById('settings-name-cancel').addEventListener('click', () => {
    document.getElementById('settings-name-form').style.display = 'none';
    document.getElementById('settings-name-btn').style.display = '';
    document.getElementById('settings-name-error').textContent = '';
  });
  document.getElementById('settings-name-save').addEventListener('click', async () => {
    const name    = document.getElementById('new-name-input').value.trim();
    const errorEl = document.getElementById('settings-name-error');
    errorEl.textContent = '';
    if (!name) { errorEl.textContent = 'Name cannot be empty.'; return; }
    try {
      await updateProfile(user, { displayName: name });
      document.getElementById('prof-name').textContent = name;
      document.getElementById('settings-name-value').textContent = name;
      document.getElementById('settings-name-form').style.display = 'none';
      document.getElementById('settings-name-btn').style.display = '';
    } catch (e) { errorEl.textContent = 'Could not update name. Please try again.'; }
  });

  // Change password
  document.getElementById('settings-pw-btn').addEventListener('click', () => {
    document.getElementById('settings-pw-form').style.display = '';
    document.getElementById('settings-pw-btn').style.display = 'none';
    document.getElementById('new-pw-input').focus();
  });
  document.getElementById('settings-pw-cancel').addEventListener('click', () => {
    document.getElementById('settings-pw-form').style.display = 'none';
    document.getElementById('settings-pw-btn').style.display = '';
    document.getElementById('new-pw-input').value = '';
    document.getElementById('settings-pw-error').textContent = '';
  });
  document.getElementById('settings-pw-save').addEventListener('click', async () => {
    const pw      = document.getElementById('new-pw-input').value;
    const errorEl = document.getElementById('settings-pw-error');
    errorEl.textContent = '';
    if (!pw || pw.length < 6) { errorEl.textContent = 'Minimum 6 characters.'; return; }
    try {
      await updatePassword(user, pw);
      errorEl.style.color = '#2d7a3a';
      errorEl.textContent = 'Password updated!';
      document.getElementById('new-pw-input').value = '';
      setTimeout(() => {
        document.getElementById('settings-pw-form').style.display = 'none';
        document.getElementById('settings-pw-btn').style.display = '';
        errorEl.textContent = ''; errorEl.style.color = '';
      }, 2000);
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        errorEl.textContent = 'Please sign out and back in first, then try again.';
      } else { errorEl.textContent = 'Failed to update password.'; }
    }
  });

  // Password toggle in settings
  document.querySelectorAll('#settings-pw-form .password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.querySelector('.eye-icon').style.display     = isText ? '' : 'none';
      btn.querySelector('.eye-off-icon').style.display = isText ? 'none' : '';
    });
  });

  // Delete account
  document.getElementById('settings-delete-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm-overlay').style.display = 'flex';
  });
  document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-confirm-overlay').style.display = 'none';
    document.getElementById('delete-error').textContent = '';
  });
  document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('delete-error');
    errorEl.textContent = '';
    try {
      await deleteUser(user);
      window.location.replace('./index.html');
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        errorEl.textContent = 'Please sign out and sign back in, then try deleting again.';
      } else { errorEl.textContent = 'Could not delete account. Try again.'; }
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function saveProfile(updates) {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'userProfile'), updates, { merge: true });
    Object.assign(profileData, updates);
  } catch (e) { console.error('Profile save error', e); }
}

initPageTransitions();
initNav();
