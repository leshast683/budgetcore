// ============================================================
// Budgetly — profile.js
// ============================================================

import { auth, db } from './firebase.js';
import { initPageTransitions } from './transitions.js';
import {
  onAuthStateChanged, signOut, updateProfile, updatePassword, deleteUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
} from 'firebase/firestore';

// ── Badge definitions ────────────────────────────────────────────────────────
const BADGES = [
  {
    id:   'first_step',
    name: 'First Step',
    desc: 'Log your very first transaction',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v24"/><path d="M8 4l16 6-16 6"/></svg>`,
    color: '#f5a623',
    bg:    '#fff5e0',
    goal:  1,
    getProgress: d => ({ current: Math.min(d.totalTx, 1), total: 1 }),
  },
  {
    id:   'budget_setter',
    name: 'Budget Setter',
    desc: 'Set your first monthly budget goal',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="24" height="26" rx="3"/><path d="M9 4h14M8 12h16M8 17h10M8 22h6"/></svg>`,
    color: '#3a8a3a',
    bg:    '#e8f5e8',
    goal:  1,
    getProgress: d => ({ current: d.hasBudget ? 1 : 0, total: 1 }),
  },
  {
    id:   'saver_debut',
    name: "Saver's Debut",
    desc: 'Finish a month with a positive balance',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v10M16 3l-4 4M16 3l4 4"/><path d="M6 16c0 5.523 4.477 10 10 10s10-4.477 10-10"/></svg>`,
    color: '#2080c0',
    bg:    '#e0f0ff',
    goal:  1,
    getProgress: d => ({ current: Math.min(d.positiveMonths, 1), total: 1 }),
  },
  {
    id:   'data_driven',
    name: 'Data Driven',
    desc: 'Log 50 transactions total',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="28" x2="28" y2="28"/><line x1="4" y1="4" x2="4" y2="28"/><rect x="7" y="18" width="5" height="10" rx="1"/><rect x="14" y="12" width="5" height="16" rx="1"/><rect x="21" y="6" width="5" height="22" rx="1"/></svg>`,
    color: '#7040b0',
    bg:    '#f0e8ff',
    goal:  50,
    getProgress: d => ({ current: Math.min(d.totalTx, 50), total: 50 }),
  },
  {
    id:   'goal_creator',
    name: 'Goal Setter',
    desc: 'Create your first savings goal',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="3"/></svg>`,
    color: '#c07020',
    bg:    '#fff0d8',
    goal:  1,
    getProgress: d => ({ current: Math.min(d.totalGoals, 1), total: 1 }),
  },
  {
    id:   'goal_crusher',
    name: 'Goal Crusher',
    desc: 'Complete a savings goal',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2l3.09 6.26L26 9.27l-5 4.87 1.18 6.88L16 18l-6.18 3.02L11 14.14 6 9.27l6.91-1.01L16 2z"/></svg>`,
    color: '#d4a010',
    bg:    '#fffae0',
    goal:  1,
    getProgress: d => ({ current: Math.min(d.completedGoals, 1), total: 1 }),
  },
  {
    id:   'budget_master',
    name: 'Budget Master',
    desc: 'Stay under budget for a full month',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l3 6h7l-5.5 4 2 7L16 17l-6.5 3 2-7L6 9h7z"/><path d="M10 26h12M13 29h6"/></svg>`,
    color: '#d4a010',
    bg:    '#fff8d8',
    goal:  1,
    getProgress: d => ({ current: Math.min(d.monthsUnderBudget, 1), total: 1 }),
  },
  {
    id:   'recurring_pro',
    name: 'Recurring Pro',
    desc: 'Set up your first recurring transaction',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16A12 12 0 0116 4"/><path d="M28 16A12 12 0 0116 28"/><path d="M16 2l-4 4 4 4"/><path d="M16 30l4-4-4-4"/></svg>`,
    color: '#2080c0',
    bg:    '#dceeff',
    goal:  1,
    getProgress: d => ({ current: d.hasRecurring ? 1 : 0, total: 1 }),
  },
  {
    id:   'century_club',
    name: 'Century Club',
    desc: 'Log 100 transactions total',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="16" cy="16" r="13"/><path d="M11 16l3 3 7-7"/></svg>`,
    color: '#3a8a3a',
    bg:    '#d8f5d8',
    goal:  100,
    getProgress: d => ({ current: Math.min(d.totalTx, 100), total: 100 }),
  },
  {
    id:   'triple_threat',
    name: 'Triple Threat',
    desc: 'Stay under budget 3 months in a row',
    icon: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4L18.8 12H28L20.6 17.2L23.4 25.2L16 20L8.6 25.2L11.4 17.2L4 12H13.2Z"/></svg>`,
    color: '#7b68ee',
    bg:    '#efe8ff',
    goal:  3,
    getProgress: d => ({ current: Math.min(d.monthsUnderBudget, 3), total: 3 }),
  },
];

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
let earnedBadges = {};
let transactions = [];
let goals        = [];

// ── Init ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  currentUser = user;
  document.getElementById('nav-signout-li').style.display = '';
  document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

  // Load data in parallel
  const [profileSnap, badgesSnap, txSnap, goalsSnap] = await Promise.all([
    getDoc(doc(db, 'users', user.uid, 'settings', 'userProfile')),
    getDoc(doc(db, 'users', user.uid, 'settings', 'badges')),
    getDocs(collection(db, 'users', user.uid, 'transactions')),
    getDocs(collection(db, 'users', user.uid, 'goals')),
  ]);

  profileData  = profileSnap.exists()  ? profileSnap.data()  : {};
  earnedBadges = badgesSnap.exists()   ? badgesSnap.data()   : {};
  transactions = txSnap.docs.map(d => d.data());
  goals        = goalsSnap.docs.map(d => d.data());

  renderHero(user);
  renderTypeGrid();
  renderTip();
  await checkAndAwardBadges(user.uid);
  renderBadges();

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

// ── Badge computation ─────────────────────────────────────────────────────────
async function checkAndAwardBadges(uid) {
  const data = computeBadgeData();
  const updates = {};

  for (const badge of BADGES) {
    if (earnedBadges[badge.id]) continue; // already earned
    const { current, total } = badge.getProgress(data);
    if (current >= total) {
      const earned = { earnedAt: new Date().toISOString(), desc: badge.desc };
      earnedBadges[badge.id] = earned;
      updates[badge.id] = earned;
    }
  }

  if (Object.keys(updates).length) {
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'badges'), earnedBadges, { merge: true });
    } catch (e) { console.error('Badge save failed', e); }
  }
}

function computeBadgeData() {
  const totalTx = transactions.length;

  // Positive balance months
  const monthMap = {};
  for (const tx of transactions) {
    const m = (tx.date || '').substring(0, 7);
    if (!m) continue;
    if (!monthMap[m]) monthMap[m] = { income: 0, expenses: 0 };
    if (tx.type === 'income')   monthMap[m].income   += tx.amount;
    if (tx.type === 'expense')  monthMap[m].expenses += tx.amount;
  }
  const positiveMonths    = Object.values(monthMap).filter(m => m.income - m.expenses > 0).length;
  const monthsUnderBudget = positiveMonths; // simplified — positive balance ≈ under budget

  const totalGoals     = goals.length;
  const completedGoals = goals.filter(g => g.current >= g.target).length;
  const hasRecurring   = transactions.some(tx => tx.isRecurring);
  const hasBudget      = !!profileData.monthlyBudget || totalTx > 0; // rough check

  return { totalTx, positiveMonths, monthsUnderBudget, totalGoals, completedGoals, hasRecurring, hasBudget };
}

// ── Render badges ─────────────────────────────────────────────────────────────
function renderBadges() {
  const grid        = document.getElementById('badges-grid');
  const countEl     = document.getElementById('badges-count');
  const data        = computeBadgeData();
  const earnedCount = BADGES.filter(b => earnedBadges[b.id]).length;

  countEl.textContent = `${earnedCount} / ${BADGES.length}`;

  grid.innerHTML = BADGES.map(badge => {
    const earned   = earnedBadges[badge.id];
    const { current, total } = badge.getProgress(data);
    const pct      = Math.round((current / total) * 100);
    const earnedDate = earned
      ? new Date(earned.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return `
      <div class="badge-card ${earned ? 'badge-earned' : 'badge-locked'}" data-badge="${badge.id}">
        <div class="badge-icon-wrap" style="background:${badge.bg}; color:${badge.color}">
          ${badge.icon}
        </div>
        <span class="badge-name">${badge.name}</span>
        ${earned
          ? `<span class="badge-earned-label">Earned</span>
             <div class="badge-tooltip">
               <strong>${badge.name}</strong><br>${badge.desc}<br>
               <em>${earnedDate}</em>
             </div>`
          : `<div class="badge-progress-wrap">
               <div class="badge-progress-fill" style="width:${pct}%"></div>
             </div>
             <span class="badge-progress-text">${current} / ${total}</span>
             <div class="badge-tooltip">
               <strong>${badge.name}</strong><br>${badge.desc}<br>
               Progress: ${current} / ${total}
             </div>`
        }
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
