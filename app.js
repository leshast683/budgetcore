// ============================================================
// Budgetly — app.js
// ============================================================

import Chart from 'chart.js/auto';
import { auth, db } from './firebase.js';
import { loadAndApplyAvatar } from './avatarUtils.js';
import { initPageTransitions } from './transitions.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, getDoc, setDoc,
  serverTimestamp,
} from 'firebase/firestore';

// --- Constants ---
const EXPENSE_CATEGORIES = [
  'housing', 'mortgage', 'utilities',
  'groceries', 'dining', 'fooddelivery',
  'transport', 'gascharging', 'carpayment', 'carinsurance',
  'healthins', 'medical',
  'phone', 'internet', 'subscriptions',
  'childcare', 'education', 'creditcards',
  'personalcare', 'clothing',
  'shopping', 'onlineshopping',
  'entertainment', 'other',
];
const INCOME_CATEGORIES  = ['paycheck', 'salary', 'freelance', 'bonuses', 'stocks', 'gift', 'benefits', 'retirement', 'other'];

const CATEGORY_LABELS = {
  // Income
  paycheck:      'Paycheck',
  salary:        'Salary',
  freelance:     'Freelance',
  bonuses:       'Bonuses',
  stocks:        'Stocks',
  gift:          'Gift',
  benefits:      'Gov. Benefits',
  retirement:    'Retirement',
  // Expense
  housing:       'Housing / Rent',
  mortgage:      'Mortgage',
  utilities:     'Utilities',
  groceries:     'Groceries',
  dining:        'Dining Out',
  fooddelivery:  'Food Delivery',
  transport:     'Transportation',
  gas:           'Gas / Fuel',       // legacy
  gascharging:   'Gas / Charging',
  carpayment:    'Car Payment',
  carinsurance:  'Car Insurance',
  healthins:     'Health Insurance',
  medical:       'Medical',
  phone:         'Phone Bill',
  internet:      'Internet',
  subscriptions: 'Subscriptions',
  childcare:     'Childcare',
  education:     'Education',
  creditcards:   'Credit Cards',
  personalcare:  'Personal Care',
  clothing:      'Clothing',
  shopping:      'Shopping',
  onlineshopping: 'Online Shopping',
  entertainment: 'Entertainment',
  // Legacy (existing saved transactions)
  bills:         'Bills',
  health:        'Health',
  other:         'Other',
};

const CATEGORY_STYLES = {
  // Income
  paycheck:      { bg: '#d4eccc', color: '#1a5010' },
  salary:        { bg: '#d8e8f0', color: '#1e4868' },
  freelance:     { bg: '#d8d8f0', color: '#30288a' },
  bonuses:       { bg: '#f0e4c4', color: '#6c4810' },
  stocks:        { bg: '#c8edd8', color: '#1a5034' },
  gift:          { bg: '#f0d4e8', color: '#6c1848' },
  benefits:      { bg: '#e0d4f0', color: '#3c2070' },
  retirement:    { bg: '#f0dcd4', color: '#6c2c18' },
  // Expense — Housing
  housing:       { bg: '#f0e4cc', color: '#7a4820' },
  mortgage:      { bg: '#eddcc8', color: '#6c3c18' },
  utilities:     { bg: '#e8e4c8', color: '#5c5020' },
  // Expense — Food
  groceries:     { bg: '#f5e6cf', color: '#7c5020' },
  dining:        { bg: '#f5eac4', color: '#7a6010' },
  fooddelivery:  { bg: '#fce8d4', color: '#8c4810' },
  // Expense — Transport
  transport:     { bg: '#e8dece', color: '#5c3d18' },
  gas:           { bg: '#f5e0c4', color: '#7c4010' },   // legacy
  gascharging:   { bg: '#f5e0c4', color: '#7c4010' },
  carpayment:    { bg: '#d8e4f0', color: '#24446c' },
  carinsurance:  { bg: '#d4ddf0', color: '#1e3c6c' },
  // Expense — Health
  healthins:     { bg: '#c8e8d0', color: '#1a5c2a' },
  medical:       { bg: '#deecd8', color: '#2e6030' },
  // Expense — Bills / Tech
  phone:         { bg: '#dcd8f0', color: '#342880' },
  internet:      { bg: '#d0e4f8', color: '#1a4470' },
  subscriptions: { bg: '#e4d4f0', color: '#5c2470' },
  // Expense — Personal / Family
  childcare:     { bg: '#f8d8e8', color: '#7c2050' },
  education:     { bg: '#e4e8cc', color: '#4c5420' },
  creditcards:   { bg: '#f5d8cc', color: '#8c2c1c' },
  personalcare:  { bg: '#f0d8e4', color: '#782448' },
  clothing:      { bg: '#d4e8e4', color: '#1c5850' },
  shopping:      { bg: '#e8d8f0', color: '#5c2478' },
  onlineshopping: { bg: '#dcd4f0', color: '#4c2478' },
  // Shared
  entertainment: { bg: '#ead4e8', color: '#6a2868' },
  bills:         { bg: '#e0d4c4', color: '#4a3020' },  // legacy
  health:        { bg: '#deecd8', color: '#2e6030' },  // legacy
  other:         { bg: '#e4e4e8', color: '#404050' },
};

const CATEGORY_ICONS = {
  // Income
  paycheck:       '💵', salary:        '💼', freelance:     '💻', bonuses:       '🎁',
  stocks:         '📈', gift:          '🎀', benefits:      '🏛️', retirement:    '🏖️',
  // Expense — Housing
  housing:        '🏠', mortgage:      '🏦', utilities:     '⚡',
  // Expense — Food
  groceries:      '🛒', dining:        '🍽️', fooddelivery:  '🛵',
  // Expense — Transport
  transport:      '🚌', gas:           '⛽', gascharging:   '⛽',
  carpayment:     '🚗', carinsurance:  '🛡️',
  // Expense — Health
  healthins:      '❤️', medical:       '💊',
  // Expense — Bills / Tech
  phone:          '📱', internet:      '🌐', subscriptions: '📺',
  // Expense — Personal / Family
  childcare:      '👶', education:     '🎓', creditcards:   '💳',
  personalcare:   '💆', clothing:      '👕',
  // Expense — Shopping
  shopping:       '🛍️', onlineshopping:'📦', entertainment: '🎬',
  // Legacy
  bills:          '📋', health:        '🏥', other:         '📌',
};

const CATEGORY_COLORS = {
  // Expense
  housing:       '#c49060',
  mortgage:      '#a87448',
  utilities:     '#9a9860',
  groceries:     '#c4a46b',
  dining:        '#d4b888',
  fooddelivery:  '#e0a878',
  transport:     '#a07848',
  gas:           '#c48448',   // legacy
  gascharging:   '#c48448',
  carpayment:    '#8090b0',
  carinsurance:  '#7080a8',
  healthins:     '#70a880',
  medical:       '#8faa7c',
  phone:         '#9888c8',
  internet:      '#7898c8',
  subscriptions: '#a878c0',
  childcare:     '#c878a0',
  education:     '#a0a068',
  creditcards:   '#c07068',
  personalcare:  '#c888a0',
  clothing:      '#68a898',
  shopping:      '#9878c0',
  onlineshopping: '#8068b0',
  entertainment: '#b07498',
  // Legacy
  bills:         '#7c5c34',
  health:        '#8faa7c',
  other:         '#9aa0ac',
};

// --- Global State ---
let transactions      = [];
let investments       = [];
let currentUser       = null;
let unsubTransactions = null;
let unsubInvestments  = null;
let paycheckReminder  = null;

const state = {
  filters: { search: '', category: 'all', type: 'all', dateFrom: '', dateTo: '' },
};

let monthlyBudget    = null;
let incomeTarget     = null;
let expenseLimit     = null;
let catMenuOpen      = false;
let editingId        = null;
let preEditType      = null;
let pieChartInstance   = null;
let dailyChartInstance = null;

// Cache for AI Budget Insights.
// Stores the fingerprint of the last analyzed dataset and its result so we
// can skip the API call when nothing has changed since the last analysis.
const insightCache = {
  key:     null,   // stable string fingerprint of the last payload sent
  insight: null,   // the text returned by the API for that payload
};

// Monthly view
let currentMonth     = todayISO().substring(0, 7);   // YYYY-MM
let alertDismissed   = false;


function todayMonth() { return todayISO().substring(0, 7); }
function monthFromDate(dateStr) { return (dateStr || todayISO()).substring(0, 7); }
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Transactions scoped to the currently viewed month
function getMonthTransactions() {
  return transactions.filter(tx => monthFromDate(tx.date) === currentMonth);
}

// All distinct months that have transactions, sorted descending
function getAvailableMonths() {
  const set = new Set(transactions.map(tx => monthFromDate(tx.date)));
  return [...set].sort().reverse();
}

// --- Signed-in toast ---
function showSigninToast(name) {
  const toast  = document.getElementById('signin-toast');
  const msgEl  = document.getElementById('signin-toast-msg');
  if (!toast) return;
  msgEl.textContent = `Welcome back, ${name}! You're signed in.`;
  toast.style.display = 'flex';
  const close = document.getElementById('signin-toast-close');
  const dismiss = () => {
    toast.classList.add('signin-toast--out');
    setTimeout(() => { toast.style.display = 'none'; toast.classList.remove('signin-toast--out'); }, 400);
  };
  close.addEventListener('click', dismiss, { once: true });
  setTimeout(dismiss, 3000);
}

// --- Firestore: Transactions ---
function hideLoader() {
  document.getElementById('auth-loading').style.display = 'none';
}

function subscribeTransactions(uid) {
  if (unsubTransactions) unsubTransactions();

  let firstSnap = true;

  // Safety net: if Firestore hasn't responded in 1 s (slow network / offline),
  // show the app anyway so the user is never stuck on the loading screen.
  const loadTimeout = setTimeout(() => {
    if (firstSnap) { firstSnap = false; hideLoader(); }
  }, 1000);

  unsubTransactions = onSnapshot(
    collection(db, 'users', uid, 'transactions'),
    snap => {
      clearTimeout(loadTimeout);
      transactions = snap.docs.map(d => {
        const data = d.data();
        return {
          id:          d.id,
          userId:      data.userId,
          type:        data.type,
          description: data.description,
          amount:      Number(data.amount),
          category:    data.category,
          date:        data.date,
          month:       data.month || (data.date ? data.date.substring(0, 7) : todayMonth()),
          isRecurring: data.isRecurring || false,
          location:    data.location   || null,
          createdAt:   data.createdAt?.seconds ?? 0,
        };
      });

      // Auto-create recurring transactions for current month if needed
      autoCreateRecurring(currentUser?.uid);

      if (firstSnap) {
        firstSnap = false;
        hideLoader();
      }

      renderAll();
    },
    err => {
      clearTimeout(loadTimeout);
      console.error('Firestore sync error:', err);
      hideLoader();
      // Show a visible error so the user knows something is wrong
      const errBanner = document.getElementById('firestore-error');
      if (errBanner) {
        errBanner.textContent = 'Could not connect to database. Check your internet connection or Firestore rules.';
        errBanner.style.display = '';
      }
    }
  );
}

// --- Firestore: Investments ---
function subscribeInvestments(uid) {
  if (unsubInvestments) unsubInvestments();
  unsubInvestments = onSnapshot(
    collection(db, 'users', uid, 'investments'),
    snap => {
      investments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDailySpendingChart();
    },
    () => {}
  );
}

// --- Firestore: Profile / Budget Goal ---
async function loadProfileSettings(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'profile'));
    if (snap.exists()) {
      monthlyBudget = snap.data().monthlyBudget ?? null;
      incomeTarget  = snap.data().incomeTarget  ?? null;
      expenseLimit  = snap.data().expenseLimit  ?? null;
    } else {
      monthlyBudget = incomeTarget = expenseLimit = null;
    }
  } catch {
    monthlyBudget = incomeTarget = expenseLimit = null;
  }
}

// --- Recurring: auto-create this month's instances ---
async function autoCreateRecurring(uid) {
  if (!uid) return;
  const thisMonth = todayMonth();

  // Find all recurring templates (transactions marked isRecurring from any past month)
  const templates = transactions.filter(tx =>
    tx.isRecurring && monthFromDate(tx.date) !== thisMonth
  );

  if (!templates.length) return;

  // Check which recurring transactions already exist for this month
  const thisMonthIds = new Set(
    transactions
      .filter(tx => tx.isRecurring && monthFromDate(tx.date) === thisMonth)
      .map(tx => tx.description + '|' + tx.type + '|' + tx.category)
  );

  // Deduplicate templates by description+type+category (latest version wins)
  const seen = new Map();
  for (const tx of [...templates].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = tx.description + '|' + tx.type + '|' + tx.category;
    if (!seen.has(key)) seen.set(key, tx);
  }

  const toCreate = [...seen.values()].filter(tx => {
    const key = tx.description + '|' + tx.type + '|' + tx.category;
    return !thisMonthIds.has(key);
  });

  for (const tx of toCreate) {
    // Create a new date in the current month (same day of month, or 1st if overflow)
    const [, , day] = tx.date.split('-');
    const [y, m]    = thisMonth.split('-');
    const daysInMonth = new Date(+y, +m, 0).getDate();
    const newDay    = String(Math.min(+day, daysInMonth)).padStart(2, '0');
    const newDate   = `${thisMonth}-${newDay}`;

    try {
      await addDoc(collection(db, 'users', uid, 'transactions'), {
        userId:      uid,
        type:        tx.type,
        description: tx.description,
        amount:      tx.amount,
        category:    tx.category,
        date:        newDate,
        month:       thisMonth,
        isRecurring: true,
        createdAt:   serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to auto-create recurring tx:', err);
    }
  }
}


// --- Firestore: Paycheck Reminder ---
async function loadPaycheckReminder(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'paycheck'));
    paycheckReminder = snap.exists() ? snap.data() : null;
  } catch {
    paycheckReminder = null;
  }
}

// --- Calculations ---
function getTotalIncome() {
  return getMonthTransactions()
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function getTotalExpenses() {
  return getMonthTransactions()
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function getBalance() {
  return getTotalIncome() - getTotalExpenses();
}

function getSpentByCategory() {
  return getMonthTransactions()
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});
}

function getFilteredTransactions() {
  const { search, category, type, dateFrom, dateTo } = state.filters;
  return getMonthTransactions().filter(tx => {
    const catLabel    = (CATEGORY_LABELS[tx.category] || tx.category).toLowerCase();
    const matchSearch = !search   || tx.description.toLowerCase().includes(search.toLowerCase()) || catLabel.includes(search.toLowerCase());
    const matchCat    = category === 'all' || tx.category === category;
    const matchType   = type === 'all'     || tx.type === type;
    const matchFrom   = !dateFrom || tx.date >= dateFrom;
    const matchTo     = !dateTo   || tx.date <= dateTo;
    return matchSearch && matchCat && matchType && matchFrom && matchTo;
  });
}

// --- Render: Dashboard ---
function renderDashboard() {
  const income   = getTotalIncome();
  const expenses = getTotalExpenses();
  const balance  = getBalance();

  const monthTx      = getMonthTransactions();
  const incomeCount  = monthTx.filter(tx => tx.type === 'income').length;
  const expenseCount = monthTx.filter(tx => tx.type === 'expense').length;

  document.getElementById('stat-income-val').textContent     = formatCurrency(income);
  document.getElementById('stat-income-count').textContent   = incomeCount + ' transaction' + (incomeCount !== 1 ? 's' : '');
  document.getElementById('stat-expenses-val').textContent   = formatCurrency(expenses);
  document.getElementById('stat-expenses-count').textContent = expenseCount + ' transaction' + (expenseCount !== 1 ? 's' : '');
  document.getElementById('stat-balance-val').textContent    = formatCurrency(balance);

  const balanceCard = document.querySelector('.stat-card--balance');
  const balanceVal  = document.getElementById('stat-balance-val');
  balanceCard.classList.toggle('is-positive', balance > 0);
  balanceCard.classList.toggle('is-negative', balance < 0);
  balanceVal.classList.toggle('positive', balance > 0);
  balanceVal.classList.toggle('negative', balance < 0);

  // Safe to Spend card
  const safeCard = document.getElementById('stat-safe-card');
  const safeVal  = document.getElementById('stat-safe-val');
  const safeSub  = document.getElementById('stat-safe-sub');
  if (income > 0 || monthlyBudget > 0) {
    safeCard.style.display = '';
    const safe = monthlyBudget > 0 ? monthlyBudget - expenses : balance;
    safeVal.textContent = formatCurrency(Math.max(0, safe));
    safeSub.textContent = monthlyBudget > 0 ? 'budget − expenses' : 'income − expenses';
    safeCard.classList.toggle('is-positive', safe > 0);
    safeCard.classList.toggle('is-negative', safe < 0);
    safeVal.classList.toggle('positive', safe > 0);
    safeVal.classList.toggle('negative', safe < 0);
  } else {
    safeCard.style.display = 'none';
  }
}

// --- Render: 50/30/20 Rule ---
const NEEDS_CATS  = new Set(['housing','mortgage','utilities','groceries','transport','gascharging','carpayment','carinsurance','healthins','medical','phone','internet','childcare','creditcards','gas','bills','health']);
const WANTS_CATS  = new Set(['dining','fooddelivery','entertainment','subscriptions','shopping','onlineshopping','clothing','personalcare','education']);

function render503020() {
  const section = document.getElementById('rule503020-section');
  const income  = getTotalIncome();
  if (income <= 0) { section.style.display = 'none'; return; }

  section.style.display = '';
  document.getElementById('rule503020-month').textContent = monthLabel(currentMonth);

  const monthTx = getMonthTransactions().filter(tx => tx.type === 'expense');
  let needs = 0, wants = 0;
  for (const tx of monthTx) {
    if (NEEDS_CATS.has(tx.category))       needs += tx.amount;
    else if (WANTS_CATS.has(tx.category))  wants += tx.amount;
  }
  const savings = Math.max(0, income - needs - wants);

  const rows = [
    { label: 'Needs',   actual: needs,   target: income * 0.50, color: '#e07b54', targetPct: 50 },
    { label: 'Wants',   actual: wants,   target: income * 0.30, color: '#7b9fe0', targetPct: 30 },
    { label: 'Savings', actual: savings, target: income * 0.20, color: '#5cba7d', targetPct: 20 },
  ];

  document.getElementById('rule503020-bars').innerHTML = rows.map(r => {
    const pct    = Math.min((r.actual / income) * 100, 100);
    const status = r.actual <= r.target ? 'ok' : 'over';
    return `
      <div class="rule-row">
        <div class="rule-label-row">
          <span class="rule-label">${r.label}</span>
          <span class="rule-amounts">${formatCurrency(r.actual)} <span class="rule-target">/ ${r.targetPct}% target (${formatCurrency(r.target)})</span></span>
        </div>
        <div class="rule-track">
          <div class="rule-fill rule-fill--${status}" style="width:${pct.toFixed(1)}%;background:${r.color}"></div>
          <div class="rule-target-mark" style="left:${r.targetPct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render: Budget Progress Card ---
function renderBudgetCard() {
  const card = document.getElementById('budget-card');

  if (!monthlyBudget || monthlyBudget <= 0) {
    card.style.display = 'none';
    return;
  }

  const expenses  = getTotalExpenses();
  const remaining = monthlyBudget - expenses;
  const isOver    = remaining < 0;
  const pct       = Math.min((expenses / monthlyBudget) * 100, 100);

  card.style.display = '';

  document.getElementById('budget-card-values').textContent =
    `${formatCurrency(expenses)} spent of ${formatCurrency(monthlyBudget)}`;

  const fill = document.getElementById('budget-fill');
  fill.style.width = pct.toFixed(1) + '%';
  fill.className   = 'budget-fill' + (isOver ? ' budget-fill--over' : (pct >= 85 ? ' budget-fill--warn' : ''));

  const rem = document.getElementById('budget-remaining');
  rem.textContent = isOver
    ? formatCurrency(Math.abs(remaining)) + ' over budget'
    : formatCurrency(remaining) + ' remaining';
  rem.className = 'budget-remaining' + (isOver ? ' budget-remaining--over' : '');
}

// --- Render: Profile Section ---
function renderProfileSection() {
  const savedView = document.getElementById('profile-saved');
  const formView  = document.getElementById('profile-form');
  const cancelBtn = document.getElementById('profile-cancel-btn');

  const hasAny = (monthlyBudget > 0) || (incomeTarget > 0) || (expenseLimit > 0);
  if (hasAny) {
    savedView.style.display = 'flex';
    formView.style.display  = 'none';
    document.getElementById('profile-saved-value').textContent   = monthlyBudget > 0 ? formatCurrency(monthlyBudget) : '—';
    document.getElementById('profile-saved-income').textContent  = incomeTarget  > 0 ? formatCurrency(incomeTarget)  : '—';
    document.getElementById('profile-saved-expense').textContent = expenseLimit  > 0 ? formatCurrency(expenseLimit)  : '—';
  } else {
    savedView.style.display = 'none';
    formView.style.display  = 'block';
    cancelBtn.style.display = 'none';
  }
  document.getElementById('profile-error').textContent = '';
}

// --- Render: Pie Chart (dashboard) ---
function renderPieChart() {
  const card   = document.getElementById('pie-chart-card');
  const canvas = document.getElementById('pie-chart');

  const totals = {};
  getMonthTransactions().forEach(tx => {
    if (tx.type === 'expense') totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  });

  const cats = Object.keys(totals).filter(c => totals[c] > 0);

  if (!cats.length) {
    card.style.display = 'none';
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    return;
  }

  card.style.display = 'block';

  const labels = cats.map(c => CATEGORY_LABELS[c] || capitalize(c));
  const data   = cats.map(c => parseFloat(totals[c].toFixed(2)));
  const colors = cats.map(c => CATEGORY_COLORS[c] || '#a07848');

  if (pieChartInstance) {
    pieChartInstance.data.labels                       = labels;
    pieChartInstance.data.datasets[0].data             = data;
    pieChartInstance.data.datasets[0].backgroundColor  = colors;
    pieChartInstance.update();
    return;
  }

  pieChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     '#fffdf9',
        borderWidth:     3,
        borderRadius:    6,
        hoverOffset:     10,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font:            { family: 'Inter, -apple-system, sans-serif', size: 11, weight: '600' },
            color:           '#4a3020',
            padding:         16,
            usePointStyle:   true,
            pointStyle:      'circle',
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(26,14,6,0.92)',
          padding:         10,
          cornerRadius:    10,
          callbacks: {
            label: ctx => `  ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data.length) return;
        const { x, y } = meta.data[0];
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = '700 18px Inter, -apple-system, sans-serif';
        ctx.fillStyle    = '#1a0e06';
        ctx.fillText(formatCurrency(total), x, y - 9);
        ctx.font         = '500 10px Inter, -apple-system, sans-serif';
        ctx.fillStyle    = '#957560';
        ctx.fillText('this month', x, y + 10);
        ctx.restore();
      },
    }],
  });
}

// --- Render: Bar Chart (history) ---
let _chartFingerprint = '';
function renderChart() {
  const barsEl  = document.getElementById('chart-bars');
  const totalEl = document.getElementById('chart-total-badge');
  const wrap    = document.getElementById('chart-wrap');
  const byCategory = getSpentByCategory();

  const entries = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (!entries.length) {
    wrap.style.display = 'none';
    _chartFingerprint = '';
    return;
  }

  // Skip rebuild + animation if data hasn't changed
  const fingerprint = entries.map(([c, v]) => `${c}:${v}`).join('|');
  if (fingerprint === _chartFingerprint) return;
  _chartFingerprint = fingerprint;

  wrap.style.display = 'block';
  const total  = entries.reduce((s, [, v]) => s + v, 0);
  const maxVal = entries[0][1];

  if (totalEl) totalEl.textContent = formatCurrency(total);

  barsEl.innerHTML = entries.map(([cat, amount], i) => {
    const pct   = Math.round((amount / total) * 100);
    const barW  = ((amount / maxVal) * 100).toFixed(1);
    const { bg, color } = CATEGORY_STYLES[cat] || { bg: '#e8e4f0', color: '#6040a0' };
    const label = CATEGORY_LABELS[cat] || capitalize(cat);
    const icon  = CATEGORY_ICONS[cat]  || '📌';
    return `
      <div class="cbar-row" style="--i:${i}">
        <div class="cbar-label">
          <span class="cbar-icon">${icon}</span>
          <span class="cbar-name">${label}</span>
        </div>
        <div class="cbar-track">
          <div class="cbar-fill" data-w="${barW}%"
               style="background:${bg};box-shadow:inset 3px 0 0 ${color}"></div>
        </div>
        <div class="cbar-meta">
          <span class="cbar-amount">${formatCurrency(amount)}</span>
          <span class="cbar-pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');

  // Trigger width transition after two frames (first frame paints at width:0)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      barsEl.querySelectorAll('.cbar-fill').forEach(el => {
        el.style.width = el.dataset.w;
      });
    });
  });
}

// --- Render: Daily Spending Chart ---
function renderDailySpendingChart() {
  const section = document.getElementById('daily-chart-section');
  const canvas  = document.getElementById('daily-spending-chart');
  if (!section || !canvas) return;

  const monthTx = getMonthTransactions().filter(tx => tx.type === 'expense');
  if (!monthTx.length) {
    section.style.display = 'none';
    if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
    return;
  }
  section.style.display = '';

  const [y, m] = currentMonth.split('-');
  const daysInMonth = new Date(+y, +m, 0).getDate();
  const byDay = {};
  monthTx.forEach(tx => { byDay[tx.date] = (byDay[tx.date] || 0) + tx.amount; });

  const labels = [], spendData = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${currentMonth}-${String(d).padStart(2,'0')}`;
    labels.push(d);
    spendData.push(parseFloat((byDay[key] || 0).toFixed(2)));
  }

  const totalPortfolio = investments.reduce((s, inv) => s + ((inv.currentPrice || 0) * (inv.shares || 0)), 0);
  const datasets = [{
    label: 'Daily Spending',
    data: spendData,
    borderColor: '#c8943a',
    backgroundColor: 'rgba(200,148,58,0.12)',
    fill: true,
    tension: 0.4,
    pointRadius: spendData.map(v => v > 0 ? 4 : 2),
    pointBackgroundColor: '#c8943a',
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
  }];

  if (totalPortfolio > 0) {
    datasets.push({
      label: 'Portfolio Value',
      data: Array(daysInMonth).fill(parseFloat(totalPortfolio.toFixed(2))),
      borderColor: '#2d7a3a',
      backgroundColor: 'transparent',
      borderDash: [6, 3],
      fill: false,
      tension: 0,
      pointRadius: 0,
    });
  }

  if (dailyChartInstance) {
    dailyChartInstance.data.labels = labels;
    dailyChartInstance.data.datasets = datasets;
    dailyChartInstance.update();
    return;
  }

  dailyChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { font: { family: 'Inter, sans-serif', size: 11 }, color: '#6b5040', usePointStyle: true },
        },
        tooltip: {
          backgroundColor: 'rgba(26,14,6,0.9)',
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            title: ctx => `Day ${ctx[0].label}`,
            label: ctx => `  ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 10 }, color: '#9a7a5a', maxTicksLimit: 10 },
          grid:  { color: 'rgba(200,148,58,0.08)' },
        },
        y: {
          ticks: { font: { size: 10 }, color: '#9a7a5a', callback: v => '$' + v },
          grid:  { color: 'rgba(200,148,58,0.08)' },
          beginAtZero: true,
        },
      },
    },
  });
}

// --- Render: Recurring Timeline ---
function renderRecurringTimeline() {
  const section = document.getElementById('recurring-timeline-section');
  if (!section) return;

  const today = todayISO();
  const [ty, tm] = today.split('-');
  const thisMonth = `${ty}-${tm}`;

  // Deduplicate recurring items by description+type+category (most recent wins)
  const seen = new Map();
  for (const tx of [...transactions].filter(t => t.isRecurring).sort((a, b) => b.createdAt - a.createdAt)) {
    const key = tx.description + '|' + tx.type + '|' + tx.category;
    if (!seen.has(key)) seen.set(key, tx);
  }

  const items = [...seen.values()].map(tx => {
    const dayOfMonth = parseInt(tx.date.split('-')[2], 10);
    const daysInMonth = new Date(+ty, +tm, 0).getDate();
    const nextDay = Math.min(dayOfMonth, daysInMonth);
    const nextDate = `${thisMonth}-${String(nextDay).padStart(2,'0')}`;
    const todayDate = new Date(today + 'T12:00:00');
    const targetDate = new Date(nextDate + 'T12:00:00');
    const diffDays = Math.round((targetDate - todayDate) / 86400000);
    return { ...tx, nextDate, diffDays };
  }).sort((a, b) => a.diffDays - b.diffDays);

  if (!items.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  const lane = section.querySelector('#recurring-lane');
  lane.innerHTML = items.map(item => {
    const icon   = CATEGORY_ICONS[item.category] || '📌';
    const { bg, color } = CATEGORY_STYLES[item.category] || { bg: '#e4e4e8', color: '#404050' };
    const isOverdue = item.diffDays < 0;
    const isToday   = item.diffDays === 0;
    const daysLabel = isOverdue ? `${Math.abs(item.diffDays)}d ago` : isToday ? 'Today' : `in ${item.diffDays}d`;
    const badgeClass = isOverdue ? 'rec-days rec-days--overdue' : isToday ? 'rec-days rec-days--today' : 'rec-days';
    return `
      <div class="rec-card" style="--rec-bg:${bg};--rec-color:${color}">
        <div class="rec-icon">${icon}</div>
        <div class="rec-info">
          <span class="rec-desc">${escapeHtml(item.description)}</span>
          <span class="rec-amount">${item.type === 'income' ? '+' : '−'}${formatCurrency(item.amount)}</span>
        </div>
        <span class="${badgeClass}">${daysLabel}</span>
      </div>`;
  }).join('');
}

// --- Render: Transaction List ---
let txFirstRender = true;
function renderTransactions() {
  const list     = document.getElementById('transaction-list');
  const empty    = document.getElementById('list-empty');
  const counter  = document.getElementById('tx-count');
  const filtered = getFilteredTransactions();

  counter.textContent = filtered.length + ' transaction' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    list.innerHTML = '';
    const hasFilters = state.filters.search || state.filters.category !== 'all' ||
      state.filters.type !== 'all' || state.filters.dateFrom || state.filters.dateTo;
    empty.textContent   = hasFilters ? 'No transactions match your filters.' : 'No transactions yet. Add one above!';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  // Group by date
  const groups = {};
  sorted.forEach(tx => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });

  const todayStr     = todayISO();
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); })();

  function dateLabel(iso) {
    if (iso === todayStr)     return 'Today';
    if (iso === yesterdayStr) return 'Yesterday';
    const [y, m, d] = iso.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const isFirst = txFirstRender;
  txFirstRender = false;

  // Global row counter so delays cascade across all groups on first render
  let rowIdx = 0;
  const BASE = 0.07;  // start after page fade-in settles
  const STEP = isFirst ? 0.055 : 0.02;
  const MAX  = 0.65;

  list.innerHTML = Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((date, gIdx) => {
      const dayTxs   = groups[date];
      const dayInc   = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const dayExp   = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const daySummary = [
        dayInc > 0 ? `<span class="txg-inc">+${formatCurrency(dayInc)}</span>` : '',
        dayExp > 0 ? `<span class="txg-exp">−${formatCurrency(dayExp)}</span>` : '',
      ].filter(Boolean).join('');
      const headerDelay = isFirst ? (BASE + gIdx * 0.1).toFixed(2) : '0';

      const rows = dayTxs.map((tx) => {
        const delay = Math.min(BASE + rowIdx * STEP, MAX).toFixed(2);
        rowIdx++;
        const isIncome    = tx.type === 'income';
        const amountText  = (isIncome ? '+' : '−') + formatCurrency(tx.amount);
        const amountClass = isIncome ? 'tx-amount tx-amount--income' : 'tx-amount tx-amount--expense';
        const catStyle    = CATEGORY_STYLES[tx.category] || { bg: '#e4e4e8', color: '#404050' };
        const catLabel    = CATEGORY_LABELS[tx.category] || capitalize(tx.category);
        const catIcon     = CATEGORY_ICONS[tx.category]  || '📌';
        const typeIcon    = isIncome ? '↑' : '↓';
        const recurringBadge = tx.isRecurring ? `<span class="tx-recurring-badge" title="Recurring monthly">↻</span>` : '';
        const locationBadge  = tx.location ? `<span class="tx-location-badge" title="${escapeHtml(tx.location)}">📍 ${escapeHtml(tx.location)}</span>` : '';

        return `
          <div class="tx-item" data-id="${tx.id}" style="animation-delay:${delay}s">
            <div class="tx-type-dot tx-type-dot--${tx.type}">${typeIcon}</div>
            <div class="tx-info">
              <span class="tx-desc">${escapeHtml(tx.description)}${recurringBadge}</span>
              <span class="tx-badge tx-badge--${tx.category}" style="background:${catStyle.bg};color:${catStyle.color}">${catIcon} ${catLabel}</span>
              ${locationBadge}
            </div>
            <span class="${amountClass}">${amountText}</span>
            <div class="tx-actions">
              <button class="tx-edit"   data-id="${tx.id}" title="Edit"   aria-label="Edit">✎</button>
              <button class="tx-delete" data-id="${tx.id}" title="Delete" aria-label="Delete">✕</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="tx-date-group">
          <div class="txg-header" style="animation-delay:${headerDelay}s">
            <span class="txg-date">${dateLabel(date)}</span>
            <div class="txg-summary">${daySummary}</div>
          </div>
          ${rows}
        </div>
      `;
    }).join('');
}

// --- Weekly Digest helpers ---
function getWeekRange() {
  const today = new Date();
  const dow   = today.getDay(); // 0=Sun local
  const mon   = new Date(today); mon.setDate(today.getDate() - ((dow + 6) % 7));
  const sun   = new Date(mon);  sun.setDate(mon.getDate() + 6);
  // Use LOCAL date (not UTC) to match how transaction dates are stored
  const fmt = d => {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { start: fmt(mon), end: fmt(sun) };
}

function getWeekTransactions() {
  const { start, end } = getWeekRange();
  return transactions.filter(tx => tx.date >= start && tx.date <= end);
}

// --- Render: Weekly Digest ---
function renderWeeklyDigest() {
  const card   = document.getElementById('weekly-digest');
  const weekTx = getWeekTransactions();

  if (!weekTx.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  const income   = weekTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = weekTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const saved    = income - expenses;

  // Week range label
  const { start, end } = getWeekRange();
  const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('digest-range').textContent     = `${fmtShort(start)} – ${fmtShort(end)}`;
  document.getElementById('digest-income').textContent    = formatCurrency(income);
  document.getElementById('digest-expenses').textContent  = formatCurrency(expenses);

  const savedEl = document.getElementById('digest-saved');
  savedEl.textContent = formatCurrency(Math.abs(saved));
  savedEl.className   = 'digest-stat-value ' + (saved >= 0 ? 'digest-income' : 'digest-expense');

  // Highlights: top category + biggest single expense
  const catTotals = weekTx
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
  const topCat   = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const bigTx    = weekTx.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0];

  let html = '';
  if (topCat) html += `<span class="digest-chip">Top spend: <b>${CATEGORY_LABELS[topCat[0]] || topCat[0]}</b> ${formatCurrency(topCat[1])}</span>`;
  if (bigTx)  html += `<span class="digest-chip">Biggest: <b>${escapeHtml(bigTx.description)}</b> ${formatCurrency(bigTx.amount)}</span>`;
  if (income > 0) {
    const rate = Math.max(0, Math.round((saved / income) * 100));
    html += `<span class="digest-chip">Savings rate: <b>${rate}%</b></span>`;
  }
  document.getElementById('digest-highlights').innerHTML = html;
}


// --- Render: Month Picker ---
function renderMonthPicker() {
  const months  = getAvailableMonths();
  const picker  = document.getElementById('month-picker');
  const label   = document.getElementById('month-label');
  const prevBtn = document.getElementById('month-prev');
  const nextBtn = document.getElementById('month-next');

  // Only show if there is data from a month other than the current calendar month
  const hasPrevious = months.some(m => m !== todayMonth());
  picker.style.display = hasPrevious ? 'flex' : 'none';

  label.textContent = monthLabel(currentMonth);

  const idx = months.indexOf(currentMonth);
  prevBtn.disabled = idx >= months.length - 1;   // oldest = no more prev
  nextBtn.disabled = idx <= 0;                    // newest = no more next
  nextBtn.style.opacity = nextBtn.disabled ? '0.3' : '';
  prevBtn.style.opacity = prevBtn.disabled ? '0.3' : '';
}

// --- Render: Month-end Goal Recap ---
let recapDismissed = false;

function renderMonthRecap() {
  const banner = document.getElementById('month-recap');
  if (!banner || recapDismissed) { if (banner) banner.style.display = 'none'; return; }
  if (!monthlyBudget || monthlyBudget <= 0) { banner.style.display = 'none'; return; }

  const today    = new Date();
  const day      = today.getDate();
  const year     = today.getFullYear();
  const month    = today.getMonth(); // 0-indexed
  const lastDay  = new Date(year, month + 1, 0).getDate();

  // 2 days before end of month OR first 2 days of month (reviewing last month)
  const isNearEnd   = day >= lastDay - 1;   // last 2 days
  const isEarlyNext = day <= 2;             // first 2 days

  if (!isNearEnd && !isEarlyNext) { banner.style.display = 'none'; return; }

  let reviewMonth, reviewLabel;
  if (isEarlyNext) {
    // Look back at previous month
    const prev = new Date(year, month - 1, 1);
    reviewMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    reviewLabel = prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else {
    // Current month so far
    reviewMonth = todayMonth();
    reviewLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const monthTxs  = transactions.filter(tx => monthFromDate(tx.date) === reviewMonth);
  const expenses  = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const income    = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const goalMet   = expenses <= monthlyBudget;
  const overBy    = expenses - monthlyBudget;

  const iconEl  = document.getElementById('month-recap-icon');
  const titleEl = document.getElementById('month-recap-title');
  const tipEl   = document.getElementById('month-recap-tip');

  if (isEarlyNext) {
    // Show result for last month
    if (goalMet) {
      banner.className = 'month-recap month-recap--success';
      iconEl.textContent  = '🎉';
      titleEl.textContent = `${reviewLabel}: Budget goal achieved!`;
      tipEl.textContent   = `You spent ${formatCurrency(expenses)} of your ${formatCurrency(monthlyBudget)} budget. Well done!`;
    } else {
      banner.className = 'month-recap month-recap--missed';
      iconEl.textContent  = '📊';
      titleEl.textContent = `${reviewLabel}: Over budget by ${formatCurrency(overBy)}`;
      tipEl.textContent   = income > 0
        ? `Try allocating ${Math.round((overBy / income) * 100)}% less of your income to discretionary spending next month.`
        : 'Consider reviewing your biggest expense categories and setting sub-limits.';
    }
  } else {
    // Upcoming end of month warning/encouragement
    const remaining = monthlyBudget - expenses;
    if (remaining >= 0) {
      banner.className = 'month-recap month-recap--success';
      iconEl.textContent  = '✅';
      titleEl.textContent = `On track for ${reviewLabel}!`;
      tipEl.textContent   = `${formatCurrency(remaining)} left in your budget — ${lastDay - day + 1} day${lastDay - day + 1 !== 1 ? 's' : ''} to go.`;
    } else {
      banner.className = 'month-recap month-recap--missed';
      iconEl.textContent  = '⚠️';
      titleEl.textContent = `Over budget with ${lastDay - day + 1} day${lastDay - day + 1 !== 1 ? 's' : ''} left`;
      tipEl.textContent   = `You're ${formatCurrency(Math.abs(remaining))} over your goal. Reduce spending in the final days of ${reviewLabel}.`;
    }
  }

  banner.style.display = '';
}

// --- Render: Budget Alert ---
function renderBudgetAlert() {
  const banner  = document.getElementById('budget-alert');
  const msg     = document.getElementById('budget-alert-msg');
  if (alertDismissed || !expenseLimit || expenseLimit <= 0) {
    banner.style.display = 'none';
    return;
  }
  const expenses = getTotalExpenses();
  const pct      = expenses / expenseLimit;
  if (pct >= 1) {
    banner.className     = 'budget-alert budget-alert--danger';
    msg.textContent      = `You've exceeded your ${monthLabel(currentMonth)} expense limit of ${formatCurrency(expenseLimit)}! (${formatCurrency(expenses)} spent)`;
    banner.style.display = '';
  } else if (pct >= 0.8) {
    banner.className     = 'budget-alert budget-alert--warn';
    msg.textContent      = `Heads up — you've used ${Math.round(pct * 100)}% of your ${monthLabel(currentMonth)} expense limit (${formatCurrency(expenses)} of ${formatCurrency(expenseLimit)}).`;
    banner.style.display = '';
  } else {
    banner.style.display = 'none';
  }
}

// --- Render: Financial Health Score ---
function renderHealthScore() {
  const section = document.getElementById('health-score-section');
  const income   = getTotalIncome();
  const expenses = getTotalExpenses();
  if (income === 0 && expenses === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  let score = 0;
  const factors = [];

  // 1. Savings rate (30 pts)
  const savingsRate = income > 0 ? (income - expenses) / income : 0;
  const srPts = income > 0
    ? savingsRate >= 0.20 ? 30 : savingsRate >= 0.10 ? 20 : savingsRate >= 0 ? 10 : 0
    : 0;
  score += srPts;
  factors.push({ label: 'Savings Rate', pts: srPts, max: 30, detail: income > 0 ? Math.round(savingsRate * 100) + '%' : 'n/a' });

  // 2. Budget adherence (25 pts)
  let baPts = 0;
  if (monthlyBudget > 0) {
    const ratio = expenses / monthlyBudget;
    baPts = ratio <= 0.9 ? 25 : ratio <= 1.0 ? 18 : ratio <= 1.15 ? 8 : 0;
  } else {
    baPts = 12; // partial credit for not having set a budget yet
  }
  score += baPts;
  factors.push({ label: 'Budget Adherence', pts: baPts, max: 25, detail: monthlyBudget > 0 ? (expenses <= monthlyBudget ? 'On track' : 'Over budget') : 'No budget set' });

  // 3. Data history (20 pts)
  const months = getAvailableMonths();
  const histPts = months.length >= 3 ? 20 : months.length === 2 ? 13 : months.length === 1 ? 7 : 0;
  score += histPts;
  factors.push({ label: 'History & Consistency', pts: histPts, max: 20, detail: months.length + ' month' + (months.length !== 1 ? 's' : '') + ' of data' });

  // 4. Balanced activity (15 pts) — both income and expense tracked
  const monthTx  = getMonthTransactions();
  const hasInc   = monthTx.some(tx => tx.type === 'income');
  const hasExp   = monthTx.some(tx => tx.type === 'expense');
  const balPts   = hasInc && hasExp ? 15 : (hasInc || hasExp) ? 8 : 0;
  score += balPts;
  factors.push({ label: 'Balanced Tracking', pts: balPts, max: 15, detail: hasInc && hasExp ? 'Income & expenses' : 'Partial data' });

  // 5. Debt/credit control (10 pts)
  const ccSpend = getMonthTransactions().filter(tx => tx.type === 'expense' && tx.category === 'creditcards').reduce((s, t) => s + t.amount, 0);
  const debtPct = expenses > 0 ? ccSpend / expenses : 0;
  const debtPts = debtPct < 0.10 ? 10 : debtPct < 0.20 ? 6 : debtPct < 0.35 ? 3 : 0;
  score += debtPts;
  factors.push({ label: 'Credit Card Usage', pts: debtPts, max: 10, detail: expenses > 0 ? Math.round(debtPct * 100) + '% of expenses' : 'None' });

  score = Math.min(100, Math.max(0, Math.round(score)));

  // Grade
  const grade  = score >= 85 ? { label: 'Excellent', color: '#2d7a3a' }
               : score >= 70 ? { label: 'Good',      color: '#5a9e3a' }
               : score >= 55 ? { label: 'Fair',       color: '#c8943a' }
               : score >= 35 ? { label: 'Needs Work', color: '#d06820' }
               :               { label: 'Poor',       color: '#c03a2b' };

  // SVG gauge — arc from 225° to 315° (270° sweep = 3/4 circle)
  const R         = 48;
  const CIRCUM    = 2 * Math.PI * R;
  const ARC_PCT   = 0.75; // 3/4 circle
  const arcLen    = CIRCUM * ARC_PCT;
  const fillLen   = arcLen * (score / 100);
  const gap       = CIRCUM - arcLen;

  const trackEl = document.querySelector('.gauge-track');
  const fillEl  = document.getElementById('gauge-fill');
  if (trackEl) {
    trackEl.style.strokeDasharray  = `${arcLen} ${gap}`;
    trackEl.style.strokeDashoffset = `${-(gap / 2 + CIRCUM * 0.125)}`; // rotate start to 7 o'clock
  }
  if (fillEl) {
    fillEl.style.stroke            = grade.color;
    fillEl.style.strokeDasharray   = `${fillLen} ${CIRCUM - fillLen}`;
    fillEl.style.strokeDashoffset  = `${-(gap / 2 + CIRCUM * 0.125)}`;
    fillEl.style.transition        = 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)';
  }

  document.getElementById('health-score-num').textContent  = score;
  document.getElementById('health-score-num').style.color  = grade.color;
  document.getElementById('health-score-grade').textContent = grade.label;
  document.getElementById('health-score-grade').style.color = grade.color;

  document.getElementById('health-factors').innerHTML = factors.map(f => {
    const pct = (f.pts / f.max) * 100;
    const barColor = pct >= 80 ? '#2d7a3a' : pct >= 50 ? '#c8943a' : '#c03a2b';
    return `
      <div class="hf-row">
        <div class="hf-label-row">
          <span class="hf-label">${f.label}</span>
          <span class="hf-detail">${f.detail}</span>
          <span class="hf-pts">${f.pts}/${f.max}</span>
        </div>
        <div class="hf-track">
          <div class="hf-fill" style="width:${pct.toFixed(0)}%;background:${barColor}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render: Bill Negotiation Alerts ---
const BILL_TIPS = {
  subscriptions: { title: 'Negotiation tip: Streaming', msg: 'Call your streaming provider and ask for a retention discount — many offer 2–3 months free to customers who threaten to cancel. Bundling services can save 20%+.' },
  phone:         { title: 'Negotiation tip: Phone Bill', msg: 'Check if you\'re paying for data you don\'t use. Carriers match competitor prices if you call and ask. Switching to an MVNO (Mint, Visible) often cuts bills in half.' },
  internet:      { title: 'Negotiation tip: Internet', msg: 'ISPs offer promotional rates to new customers. Call retention and ask to match them — most will. Even a $10/mo reduction saves $120/year.' },
  carinsurance:  { title: 'Negotiation tip: Car Insurance', msg: 'Comparing quotes annually saves an average of $400/year. Ask your current insurer to price-match. Bundling home+auto can save 15–25%.' },
  healthins:     { title: 'Tip: Health Insurance', msg: 'If you haven\'t reviewed your plan during open enrollment, you may be over-insured. HSA-eligible high-deductible plans can save significantly on premiums.' },
  creditcards:   { title: 'Tip: Credit Card Interest', msg: 'Call your card issuer and ask for a rate reduction — a 2019 CreditCards.com study found 69% of those who asked got one. Balance transfer cards at 0% APR can save hundreds.' },
};

let dismissedBillAlerts = new Set(JSON.parse(localStorage.getItem('dismissed_bill_alerts') || '[]'));

function renderBillAlerts() {
  const container = document.getElementById('bill-alerts-container');
  if (!container) return;

  // Find recurring expenses active for 3+ months
  const catMonths = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.isRecurring) continue;
    const cat   = tx.category;
    const month = monthFromDate(tx.date);
    if (!catMonths[cat]) catMonths[cat] = new Set();
    catMonths[cat].add(month);
  }

  const alerts = [];
  for (const [cat, months] of Object.entries(catMonths)) {
    if (months.size >= 2 && BILL_TIPS[cat] && !dismissedBillAlerts.has(cat)) {
      alerts.push({ cat, tip: BILL_TIPS[cat] });
    }
  }

  container.innerHTML = alerts.map(a => `
    <div class="bill-alert-card" id="bill-alert-${a.cat}">
      <div class="bill-alert-icon">💡</div>
      <div class="bill-alert-body">
        <span class="bill-alert-title">${a.tip.title}</span>
        <p class="bill-alert-msg">${a.tip.msg}</p>
      </div>
      <button type="button" class="bill-alert-dismiss" data-cat="${a.cat}" title="Dismiss">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.bill-alert-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      dismissedBillAlerts.add(cat);
      localStorage.setItem('dismissed_bill_alerts', JSON.stringify([...dismissedBillAlerts]));
      document.getElementById(`bill-alert-${cat}`)?.remove();
    });
  });
}

// --- Render: AI Spending Predictions ---
function renderSpendingPredictions() {
  const section = document.getElementById('predictions-section');
  const income  = getTotalIncome();
  if (income === 0 && transactions.length < 4) { section.style.display = 'none'; return; }

  const today    = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;
  if (monthProgress < 0.25) { section.style.display = 'none'; return; } // need enough data

  // Historical category averages (past months only, not current)
  const pastMonths = getAvailableMonths().filter(m => m !== currentMonth);
  if (pastMonths.length < 1) { section.style.display = 'none'; return; }

  const histByCat = {};
  for (const month of pastMonths) {
    const txs = transactions.filter(tx => monthFromDate(tx.date) === month && tx.type === 'expense');
    for (const tx of txs) {
      if (!histByCat[tx.category]) histByCat[tx.category] = [];
      histByCat[tx.category].push(tx.amount);
    }
  }

  // Average per category across past months
  const avgByCat = {};
  for (const [cat, amounts] of Object.entries(histByCat)) {
    // sum per month
    const perMonth = {};
    for (const tx of transactions.filter(t => t.type === 'expense' && t.category === cat && pastMonths.includes(monthFromDate(t.date)))) {
      const m = monthFromDate(tx.date);
      perMonth[m] = (perMonth[m] || 0) + tx.amount;
    }
    const vals = Object.values(perMonth);
    avgByCat[cat] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // Current month per category
  const currentByCat = {};
  for (const tx of getMonthTransactions().filter(t => t.type === 'expense')) {
    currentByCat[tx.category] = (currentByCat[tx.category] || 0) + tx.amount;
  }

  // Project end-of-month for each category
  const predictions = [];
  for (const [cat, currentSpend] of Object.entries(currentByCat)) {
    if (!avgByCat[cat]) continue;
    const projected = currentSpend / monthProgress;
    const avg       = avgByCat[cat];
    const overage   = projected - avg;
    const overPct   = avg > 0 ? overage / avg : 0;
    if (overPct > 0.2) { // only show if 20%+ over average
      predictions.push({ cat, projected, avg, overage, overPct });
    }
  }

  if (!predictions.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  document.getElementById('predictions-month').textContent = monthLabel(currentMonth);

  predictions.sort((a, b) => b.overPct - a.overPct);

  document.getElementById('predictions-list').innerHTML = predictions.map(p => {
    const icon    = CATEGORY_ICONS[p.cat] || '📌';
    const label   = CATEGORY_LABELS[p.cat] || p.cat;
    const pctStr  = '+' + Math.round(p.overPct * 100) + '%';
    const severity = p.overPct >= 0.5 ? 'high' : p.overPct >= 0.3 ? 'med' : 'low';
    return `
      <div class="prediction-row prediction-row--${severity}">
        <span class="prediction-icon">${icon}</span>
        <div class="prediction-info">
          <span class="prediction-label">${label}</span>
          <span class="prediction-detail">Projected: ${formatCurrency(p.projected)} · Avg: ${formatCurrency(p.avg)}</span>
        </div>
        <div class="prediction-badge prediction-badge--${severity}">${pctStr} over</div>
      </div>
    `;
  }).join('');
}

// --- Export: CSV ---
function exportCSV() {
  const txs = getMonthTransactions();
  if (!txs.length) { showTxToast('No transactions to export for this month.'); return; }

  const headers = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Recurring', 'Location'];
  const rows    = txs.map(tx => [
    tx.date,
    tx.type,
    `"${(tx.description || '').replace(/"/g, '""')}"`,
    CATEGORY_LABELS[tx.category] || tx.category || '',
    tx.amount.toFixed(2),
    tx.isRecurring ? 'Yes' : 'No',
    `"${(tx.location || '').replace(/"/g, '""')}"`,
  ]);

  const csv     = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `budgetly-${currentMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Export: PDF (print) ---
function exportPDF() {
  window.print();
}

// --- Render: Bill Calendar ---
function renderBillCalendar() {
  const section = document.getElementById('bill-cal-section');
  const recurring = getMonthTransactions().filter(tx => tx.isRecurring && tx.type === 'expense');
  if (!recurring.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  document.getElementById('bill-cal-month').textContent = monthLabel(currentMonth);

  const [y, m] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow    = new Date(y, m - 1, 1).getDay(); // 0=Sun

  // Group bills by day
  const byDay = {};
  for (const tx of recurring) {
    const day = parseInt(tx.date.split('-')[2], 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(tx);
  }

  let html = '';
  // Day-of-week headers
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += `<div class="bcal-dow">${d}</div>`;
  });
  // Empty cells before first day
  for (let i = 0; i < firstDow; i++) html += `<div class="bcal-cell bcal-empty"></div>`;

  const todayDay = new Date().getDate();
  const isCurrentMonth = currentMonth === todayMonth();

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday   = isCurrentMonth && d === todayDay;
    const bills     = byDay[d] || [];
    const billsHtml = bills.map(tx => {
      const icon = CATEGORY_ICONS[tx.category] || '📌';
      return `<div class="bcal-bill" title="${escapeHtml(tx.description)} ${formatCurrency(tx.amount)}">${icon} <span>${formatCurrency(tx.amount)}</span></div>`;
    }).join('');
    html += `<div class="bcal-cell${isToday ? ' bcal-today' : ''}${bills.length ? ' bcal-has-bills' : ''}">
      <span class="bcal-day">${d}</span>
      ${billsHtml}
    </div>`;
  }

  document.getElementById('bill-cal-grid').innerHTML = html;
}

// --- Render: All ---
function renderAll() {
  if (currentMonth === todayMonth() || !getAvailableMonths().includes(currentMonth)) {
    currentMonth = todayMonth();
  }
  renderMonthPicker();
  renderBudgetAlert();
  renderMonthRecap();
  renderWeeklyDigest();
  renderDashboard();
  renderHealthScore();
  renderBudgetCard();
  render503020();
  renderBillAlerts();
  renderSpendingPredictions();
  renderPieChart();
  renderChart();
  renderDailySpendingChart();
  renderRecurringTimeline();
  renderBillCalendar();
  renderTransactions();
}

// --- AI Budget Insights ---

/**
 * Build a stable cache key from the data that would be sent to the API.
 * Category objects are sorted alphabetically before serialising so that
 * insertion order differences don't produce a different key for identical data.
 */
function buildInsightCacheKey(income, expenses, balance, incomeByCategory, expensesByCategory) {
  const sortedEntries = obj =>
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

  return JSON.stringify({
    income:   Number(income).toFixed(2),
    expenses: Number(expenses).toFixed(2),
    balance:  Number(balance).toFixed(2),
    inc: sortedEntries(incomeByCategory),
    exp: sortedEntries(expensesByCategory),
  });
}

async function analyzeBudget() {
  const btn        = document.getElementById('analyze-btn');
  const resultEl   = document.getElementById('ai-insights-result');
  const textEl     = document.getElementById('ai-insights-text');
  const errorEl    = document.getElementById('ai-insights-error');
  const cacheLabel = document.getElementById('ai-insights-cache-label');

  // Show an error message and hide the result box
  function showError(msg) {
    errorEl.textContent    = msg;
    errorEl.style.display  = '';
    resultEl.style.display = 'none';
  }

  // --- Validation ---

  const monthTxs = getMonthTransactions();
  if (monthTxs.length === 0) {
    showError('No transactions found for this month. Add some income or expenses first.');
    return;
  }

  // Build category breakdowns from the current month's transactions
  const incomeByCategory   = {};
  const expensesByCategory = {};
  for (const tx of monthTxs) {
    // Guard against transactions with a missing category — capitalize() crashes on undefined
    const label = CATEGORY_LABELS[tx.category] || (tx.category ? capitalize(tx.category) : '') || 'Other';
    if (tx.type === 'income') {
      incomeByCategory[label] = (incomeByCategory[label] || 0) + tx.amount;
    } else {
      expensesByCategory[label] = (expensesByCategory[label] || 0) + tx.amount;
    }
  }

  const income   = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
  const expenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const balance  = income - expenses;

  // Catch corrupt transaction data before sending it to the API
  if (!isFinite(income) || !isFinite(expenses)) {
    showError('Some transactions have invalid amounts. Please review your data.');
    return;
  }

  // --- Cache check ---

  // If the data fingerprint matches the last run, skip the API entirely
  const cacheKey = buildInsightCacheKey(income, expenses, balance, incomeByCategory, expensesByCategory);
  if (insightCache.key === cacheKey) {
    textEl.textContent     = insightCache.insight;
    cacheLabel.textContent = 'Loaded from cache';
    errorEl.style.display  = 'none';
    resultEl.style.display = '';
    return;
  }

  // --- API call ---

  // Disable the button properly so keyboard users (Space/Enter on a focused
  // button) and any programmatic .click() calls can't fire a second request
  // while one is already in flight. pointer-events: none in CSS alone is not
  // enough for this.
  btn.disabled    = true;
  btn.textContent = 'Analyzing…';
  errorEl.style.display  = 'none';
  resultEl.style.display = 'none';

  // Cancel the request automatically after 15 seconds so the button never
  // gets permanently stuck in the loading state if the server is slow.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch('/analyze-budget', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        income, expenses, balance,
        incomeByCategory, expensesByCategory,
        month: monthLabel(currentMonth),
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // Prefer the server's own error message; fall back to a generic one
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.error ||
        (res.status >= 500 ? 'The server ran into an error. Please try again.'
                           : 'The request was rejected. Please try again.')
      );
    }

    const data = await res.json();

    // Guard against the API returning a blank or missing insight field
    if (!data.insight || !data.insight.trim()) {
      throw new Error('The server returned an empty response. Please try again.');
    }

    // Store in cache so the next identical click skips the API call
    insightCache.key     = cacheKey;
    insightCache.insight = data.insight;

    textEl.textContent     = data.insight;
    cacheLabel.textContent = 'Fresh analysis';
    resultEl.style.display = '';

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      // The 15-second timeout fired before the server responded
      showError('The request timed out. Please try again in a moment.');
    } else if (!navigator.onLine) {
      // The browser itself reports no network connection
      showError('You appear to be offline. Check your connection and try again.');
    } else {
      showError(err.message || 'Something went wrong. Please try again.');
    }

    console.error('AI insight error:', err);
  } finally {
    // Always re-enable the button regardless of success, failure, or timeout
    btn.disabled    = false;
    btn.textContent = 'Analyze Budget';
  }
}

// --- Custom Category Dropdown ---
function setCategoryOptions(type) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const menu = document.getElementById('cat-menu');

  const pills = cats.map(c => {
    const { bg, color } = CATEGORY_STYLES[c] || { bg: '#e4e4e8', color: '#404050' };
    const label = CATEGORY_LABELS[c] || capitalize(c);
    const icon  = CATEGORY_ICONS[c]  || '📌';
    return `<div class="cat-option" role="option" data-value="${c}" style="background-color:${bg};color:${color}">${icon} ${label}</div>`;
  });

  // Add "Custom…" option for both income and expenses
  pills.push(`<div class="cat-option cat-option--custom" role="option" data-value="__custom__" style="background-color:#e8e8f0;color:#404060">+ Custom…</div>`);

  menu.innerHTML = pills.join('');

  menu.querySelectorAll('.cat-option').forEach(opt => {
    opt.addEventListener('click', () => {
      selectCategory(opt.dataset.value);
      closeCatMenu();
    });
  });

  selectCategory(cats[0]);
}

function selectCategory(value) {
  const customWrap = document.getElementById('custom-cat-wrap');
  if (value === '__custom__') {
    document.getElementById('tx-category').value = '';
    const trigger = document.getElementById('cat-trigger');
    trigger.style.backgroundColor = '#e8e8f0';
    const labelEl = document.getElementById('cat-trigger-label');
    labelEl.textContent = '+ Custom category';
    labelEl.style.color = '#404060';
    if (customWrap) customWrap.style.display = '';
    setTimeout(() => document.getElementById('custom-cat-input')?.focus(), 40);
    document.querySelectorAll('.cat-option').forEach(opt =>
      opt.classList.toggle('is-selected', opt.dataset.value === '__custom__')
    );
    return;
  }

  if (customWrap) customWrap.style.display = 'none';
  document.getElementById('tx-category').value = value;
  const { bg, color } = CATEGORY_STYLES[value] || { bg: '#e4e4e8', color: '#404050' };
  const label = CATEGORY_LABELS[value] || capitalize(value);
  const trigger = document.getElementById('cat-trigger');
  trigger.style.backgroundColor = bg;
  const labelEl = document.getElementById('cat-trigger-label');
  labelEl.textContent = label;
  labelEl.style.color = color;
  document.querySelectorAll('.cat-option').forEach(opt =>
    opt.classList.toggle('is-selected', opt.dataset.value === value)
  );
}

function openCatMenu() {
  catMenuOpen = true;
  const menu = document.getElementById('cat-menu');
  menu.classList.add('is-open');
  document.getElementById('cat-trigger').setAttribute('aria-expanded', 'true');
  if (window.innerWidth <= 640) {
    // Teleport menu to <body> so it escapes any ancestor stacking context
    // created by the section's fadeSlideUp animation (transform traps z-index)
    if (!menu._catOriginalParent) {
      menu._catOriginalParent = menu.parentElement;
      document.body.appendChild(menu);
    }
    // Handle bar
    if (!menu.querySelector('.cat-handle')) {
      const handle = document.createElement('div');
      handle.className = 'cat-handle';
      menu.prepend(handle);
    }
    // Backdrop
    if (!document.getElementById('cat-backdrop')) {
      const bd = document.createElement('div');
      bd.id = 'cat-backdrop';
      bd.className = 'cat-backdrop';
      bd.addEventListener('click', closeCatMenu);
      document.body.appendChild(bd);
    }
  }
}

function closeCatMenu() {
  catMenuOpen = false;
  const menu = document.getElementById('cat-menu');
  menu.classList.remove('is-open');
  document.getElementById('cat-trigger').setAttribute('aria-expanded', 'false');
  document.getElementById('cat-backdrop')?.remove();
  // Teleport menu back to its original parent
  if (menu._catOriginalParent) {
    menu._catOriginalParent.appendChild(menu);
    delete menu._catOriginalParent;
  }
}

// --- Paycheck Reminder ---
function renderPaycheckReminder() {
  const savedView = document.getElementById('reminder-saved');
  const editView  = document.getElementById('reminder-edit');
  if (paycheckReminder) {
    savedView.style.display = 'flex';
    editView.style.display  = 'none';
    document.getElementById('reminder-detail').textContent =
      formatCurrency(paycheckReminder.amount) + ' · ' + formatDate(paycheckReminder.date);
  } else {
    savedView.style.display = 'none';
    editView.style.display  = 'block';
    document.getElementById('reminder-cancel-btn').style.display = 'none';
  }
}

function showReminderEdit() {
  document.getElementById('reminder-saved').style.display = 'none';
  document.getElementById('reminder-edit').style.display  = 'block';
  document.getElementById('reminder-cancel-btn').style.display = 'inline-block';
  if (paycheckReminder) {
    document.getElementById('reminder-amount').value = paycheckReminder.amount;
    document.getElementById('reminder-date').value   = paycheckReminder.date;
  } else {
    document.getElementById('reminder-amount').value = '';
    document.getElementById('reminder-date').value   = '';
  }
}

function setSubmitLabel(type) {
  const prefix = editingId !== null ? 'Update' : 'Add';
  document.getElementById('form-submit-btn').textContent =
    prefix + (type === 'income' ? ' Income' : ' Expense');
}

// --- Edit Mode ---
function handleEdit(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  preEditType = document.getElementById('tx-type').value;
  editingId   = id;
  handleTypeToggle(tx.type, false);
  document.getElementById('tx-description').value = tx.description;
  document.getElementById('tx-amount').value       = tx.amount;
  document.getElementById('tx-date').value         = tx.date;
  selectCategory(tx.category);

  document.querySelector('.form-section .card-title').textContent = 'Edit Transaction';
  document.getElementById('edit-cancel-btn').style.display = 'block';
  document.querySelector('.form-section').classList.add('is-editing');
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  editingId   = null;
  preEditType = null;
  document.querySelector('.form-section .card-title').textContent = 'Add Transaction';
  document.getElementById('edit-cancel-btn').style.display = 'none';
  document.querySelector('.form-section').classList.remove('is-editing');
}

function handleEditCancel() {
  const restoreType = preEditType || 'income';
  exitEditMode();
  document.getElementById('transaction-form').reset();
  document.getElementById('tx-date').value = todayISO();
  handleTypeToggle(restoreType, false);
}

// --- Event Handlers ---
function handleTypeToggle(selectedType, animate = true) {
  const prevType = document.getElementById('tx-type').value;
  closeCatMenu();

  // Update toggle buttons immediately (outside form-body)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === selectedType);
  });
  document.getElementById('tx-type').value = selectedType;

  function applyContent() {
    setCategoryOptions(selectedType);
    setSubmitLabel(selectedType);
    const showReminder = selectedType === 'income';
    document.getElementById('paycheck-reminder').style.display = showReminder ? 'block' : 'none';
    if (showReminder) renderPaycheckReminder();
    const locationGroup = document.getElementById('tx-location-group');
    if (locationGroup) locationGroup.style.display = selectedType === 'expense' ? '' : 'none';
  }

  if (!animate || prevType === selectedType) {
    applyContent();
    return;
  }

  // income→expense slides left; expense→income slides right
  const dir = selectedType === 'expense' ? 'left' : 'right';
  const formBody = document.querySelector('.form-body');
  formBody.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
  formBody.classList.add('slide-out-' + dir);

  setTimeout(() => {
    applyContent();
    formBody.classList.remove('slide-out-left', 'slide-out-right');
    formBody.classList.add('slide-in-' + (dir === 'left' ? 'right' : 'left'));
    setTimeout(() => formBody.classList.remove('slide-in-left', 'slide-in-right'), 240);
  }, 185);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  closeCatMenu();

  const type        = document.getElementById('tx-type').value;
  const desc        = document.getElementById('tx-description').value.trim();
  const amount      = parseFloat(document.getElementById('tx-amount').value);
  const date        = document.getElementById('tx-date').value;
  const customCatRaw = document.getElementById('custom-cat-input')?.value.trim();
  const catHidden    = document.getElementById('tx-category').value;
  // If custom category is active, store it verbatim (lowercase, no special chars)
  const cat = (document.getElementById('custom-cat-wrap')?.style.display !== 'none' && customCatRaw)
    ? customCatRaw.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')
    : catHidden;
  const isRecurring = document.getElementById('tx-recurring').checked;
  const location    = (document.getElementById('tx-location')?.value.trim()) || null;

  if (!desc || isNaN(amount) || amount <= 0 || !date || !cat) {
    if (!desc)                        markError('tx-description');
    if (isNaN(amount) || amount <= 0) markError('tx-amount');
    if (!date)                        markError('tx-date');
    if (!cat) {
      const formErrorEl = document.getElementById('form-error');
      formErrorEl.textContent = 'Please select a category.';
      formErrorEl.style.display = '';
    }
    return;
  }
  document.getElementById('form-error').style.display = 'none';

  // --- Authenticated: Firestore ---
  const uid = currentUser?.uid;
  const formErrorEl = document.getElementById('form-error');
  if (!uid) {
    formErrorEl.textContent = 'You must be signed in to save transactions.';
    formErrorEl.style.display = '';
    return;
  }

  formErrorEl.style.display = 'none';
  const submitBtn = document.getElementById('form-submit-btn');
  submitBtn.disabled = true;

  try {
    if (editingId !== null) {
      const updateData = { userId: uid, type, description: desc, amount, category: cat, date,
        month: monthFromDate(date), isRecurring };
      if (location) updateData.location = location;
      await updateDoc(doc(db, 'users', uid, 'transactions', editingId), updateData);
      // Optimistic update for edit
      const idx = transactions.findIndex(t => t.id === editingId);
      if (idx !== -1) {
        transactions[idx] = { ...transactions[idx], type, description: desc, amount, category: cat, date, month: monthFromDate(date), isRecurring };
      }
      exitEditMode();
      renderAll();
    } else {
      const month  = monthFromDate(date);
      const newTxData = { userId: uid, type, description: desc, amount, category: cat, date,
        month, isRecurring, createdAt: serverTimestamp() };
      if (location) newTxData.location = location;
      const docRef = await addDoc(collection(db, 'users', uid, 'transactions'), newTxData);
      // Optimistic update: add to local array if onSnapshot hasn't fired yet
      if (!transactions.find(t => t.id === docRef.id)) {
        transactions.unshift({
          id: docRef.id,
          userId: uid, type, description: desc, amount, category: cat, date,
          month: monthFromDate(date), isRecurring,
          createdAt: Date.now() / 1000,
        });
        renderAll();
      }
    }

    e.target.reset();
    document.getElementById('tx-date').value      = todayISO();
    document.getElementById('tx-recurring').checked = false;
    const customWrap = document.getElementById('custom-cat-wrap');
    if (customWrap) { customWrap.style.display = 'none'; }
    const customInput = document.getElementById('custom-cat-input');
    if (customInput) customInput.value = '';
    const activeBtn  = document.querySelector('.type-btn.active');
    const activeType = activeBtn ? activeBtn.dataset.type : 'income';
    document.getElementById('tx-type').value = activeType;
    setCategoryOptions(activeType);
    setSubmitLabel(activeType);

    // Success flash on the button + toast
    const wasEditing = editingId !== null;
    submitBtn.textContent = wasEditing ? '✓ Updated!' : '✓ Added!';
    submitBtn.classList.add('btn--success');
    setTimeout(() => {
      submitBtn.classList.remove('btn--success');
      setSubmitLabel(activeType);
    }, 1400);
    showToast(
      wasEditing ? `✓ Transaction updated` : `✓ ${type === 'income' ? 'Income' : 'Expense'} added — ${formatCurrency(amount)}`,
      wasEditing ? 'edit' : type
    );
  } catch (err) {
    console.error('Error saving transaction:', err);
    formErrorEl.textContent = 'Failed to save. Please check your connection and try again.';
    formErrorEl.style.display = '';
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleDelete(id) {
  const uid = currentUser?.uid;
  if (!uid) return;
  // Optimistic removal
  transactions = transactions.filter(tx => tx.id !== id);
  renderAll();
  try {
    await deleteDoc(doc(db, 'users', uid, 'transactions', id));
  } catch (err) {
    console.error('Error deleting transaction:', err);
    // onSnapshot will restore the transaction if delete failed
  }
}

function handleFilterChange() {
  state.filters.search   = document.getElementById('search-input').value;
  state.filters.type     = document.getElementById('filter-type').value;
  state.filters.category = document.getElementById('filter-category').value;
  state.filters.dateFrom = document.getElementById('filter-from').value;
  state.filters.dateTo   = document.getElementById('filter-to').value;
  renderTransactions();
}

function handleClearFilters() {
  document.getElementById('search-input').value    = '';
  document.getElementById('filter-type').value     = 'all';
  document.getElementById('filter-category').value = 'all';
  document.getElementById('filter-from').value     = '';
  document.getElementById('filter-to').value       = '';
  state.filters = { search: '', category: 'all', type: 'all', dateFrom: '', dateTo: '' };
  renderTransactions();
}

// --- Auth ---
async function handleAuthSubmit(e) {
  e.preventDefault();

  const tab       = document.querySelector('.auth-tab.active').dataset.tab;
  const isSignup  = tab === 'signup';
  const email     = document.getElementById('auth-email').value.trim();
  const password  = document.getElementById('auth-password').value;
  const confirm   = document.getElementById('auth-confirm').value;
  const errorEl   = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  errorEl.textContent = '';

  // Client-side confirm password check
  if (isSignup && password !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = isSignup ? 'Creating account…' : 'Signing in…';

  const name = isSignup ? document.getElementById('auth-name')?.value.trim() : '';
  if (isSignup && !name) {
    errorEl.textContent = 'Please enter your name.';
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Create Account';
    return;
  }

  try {
    if (isSignup) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // onAuthStateChanged handles the UI transition
  } catch (err) {
    console.error('Auth error:', err.code, err.message);
    errorEl.textContent   = friendlyAuthError(err.code);
    submitBtn.disabled    = false;
    submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
  }
}

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':            'Please enter a valid email address.',
    'auth/user-not-found':           'No account found with that email.',
    'auth/wrong-password':           'Incorrect password. Please try again.',
    'auth/email-already-in-use':     'An account with this email already exists.',
    'auth/weak-password':            'Password must be at least 6 characters.',
    'auth/too-many-requests':        'Too many attempts. Please try again later.',
    'auth/network-request-failed':   'Network error. Please check your connection.',
    'auth/invalid-credential':       'Invalid email or password.',
    'auth/operation-not-allowed':    'Email/password sign-in is not enabled. Enable it in the Firebase console → Authentication → Sign-in method.',
    'auth/configuration-not-found':  'Firebase Authentication is not configured. Check your Firebase project settings.',
    'auth/api-key-not-valid':        'Invalid Firebase API key. Check your config in firebase.js.',
    'auth/project-not-found':        'Firebase project not found. Check your projectId in firebase.js.',
  };
  return map[code] || `Something went wrong (${code}). Please try again.`;
}

function switchAuthTab(tab) {
  const isSignup = tab === 'signup';
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  const nameGroup = document.getElementById('auth-name-group');
  const nameInput = document.getElementById('auth-name');
  if (nameGroup) {
    nameGroup.style.display = isSignup ? 'flex' : 'none';
    if (nameInput) nameInput.required = isSignup;
  }
  document.getElementById('auth-confirm-group').style.display = isSignup ? 'flex' : 'none';
  document.getElementById('auth-submit-btn').textContent      = isSignup ? 'Create Account' : 'Sign In';
  document.getElementById('auth-switch-btn').textContent      = isSignup ? 'Sign in instead' : 'Create one';
  document.querySelector('.auth-switch').firstChild.textContent =
    isSignup ? 'Already have an account? ' : "Don't have an account? ";
  document.getElementById('auth-password').setAttribute(
    'autocomplete', isSignup ? 'new-password' : 'current-password'
  );
  document.getElementById('auth-error').textContent = '';
}

function setWelcomeBar(user) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now    = new Date();
  const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  document.getElementById('welcome-date').textContent = dateStr;

  if (user) {
    const displayName = user.displayName || user.email.split('@')[0];
    document.getElementById('welcome-greeting').textContent = `Welcome, ${displayName}`;
    document.getElementById('welcome-email').textContent    = user.email;
    document.getElementById('welcome-bar').className        = 'welcome-bar welcome-bar--user';
  } else {
    document.getElementById('welcome-greeting').textContent = 'Browsing as guest';
    document.getElementById('welcome-email').textContent    = 'Sign in to save your data';
    document.getElementById('welcome-bar').className        = 'welcome-bar welcome-bar--guest';
  }
}

// --- Utilities ---
function formatCurrency(n) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + abs;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  const d = new Date();
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function markError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('input-error');
  el.addEventListener('input', () => el.classList.remove('input-error'), { once: true });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, variant = 'income') {
  const container = document.getElementById('tx-toast');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `tx-toast-item tx-toast-item--${variant}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => {
    item.classList.add('is-leaving');
    item.addEventListener('animationend', () => item.remove(), { once: true });
  }, 2500);
}

// --- Init ---
function init() {
  // Set today's date as the form default
  document.getElementById('tx-date').value = todayISO();

  // Default type = income (sets up categories + reminder section)
  handleTypeToggle('income', false);

  // Category dropdown toggle
  document.getElementById('cat-trigger').addEventListener('click', e => {
    e.stopPropagation();
    catMenuOpen ? closeCatMenu() : openCatMenu();
  });
  document.getElementById('cat-menu').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', closeCatMenu);

  // Type toggle buttons
  document.getElementById('type-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (btn) handleTypeToggle(btn.dataset.type);
  });

  // Form submission
  document.getElementById('transaction-form').addEventListener('submit', handleFormSubmit);

  // Filter inputs
  document.getElementById('search-input').addEventListener('input',     handleFilterChange);
  document.getElementById('filter-type').addEventListener('change',     handleFilterChange);
  document.getElementById('filter-category').addEventListener('change', handleFilterChange);
  document.getElementById('filter-from').addEventListener('change',     handleFilterChange);
  document.getElementById('filter-to').addEventListener('change',       handleFilterChange);
  document.getElementById('clear-filters').addEventListener('click',    handleClearFilters);

  // Month navigation
  document.getElementById('month-prev').addEventListener('click', () => {
    const months = getAvailableMonths();
    const idx    = months.indexOf(currentMonth);
    if (idx < months.length - 1) {
      currentMonth   = months[idx + 1];
      alertDismissed = false;
      renderAll();
    }
  });

  document.getElementById('month-next').addEventListener('click', () => {
    const months = getAvailableMonths();
    const idx    = months.indexOf(currentMonth);
    if (idx > 0) {
      currentMonth   = months[idx - 1];
      alertDismissed = false;
      renderAll();
    }
  });

  // Budget alert dismiss
  document.getElementById('budget-alert-close').addEventListener('click', () => {
    alertDismissed = true;
    document.getElementById('budget-alert').style.display = 'none';
  });

  // Month recap dismiss
  document.getElementById('month-recap-close')?.addEventListener('click', () => {
    recapDismissed = true;
    document.getElementById('month-recap').style.display = 'none';
  });

  // Edit / Delete via event delegation (IDs are Firestore strings)
  document.getElementById('transaction-list').addEventListener('click', e => {
    const editBtn = e.target.closest('.tx-edit');
    if (editBtn) { handleEdit(editBtn.dataset.id); return; }
    const delBtn = e.target.closest('.tx-delete');
    if (delBtn) handleDelete(delBtn.dataset.id);
  });

  // Edit cancel
  document.getElementById('edit-cancel-btn').addEventListener('click', handleEditCancel);

  // Paycheck reminder
  document.getElementById('reminder-save-btn').addEventListener('click', async () => {
    const uid    = currentUser?.uid;
    if (!uid) return;
    const amount = parseFloat(document.getElementById('reminder-amount').value);
    const date   = document.getElementById('reminder-date').value;
    if (isNaN(amount) || amount <= 0 || !date) {
      if (isNaN(amount) || amount <= 0) markError('reminder-amount');
      if (!date)                        markError('reminder-date');
      return;
    }
    paycheckReminder = { amount, date };
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'paycheck'), paycheckReminder);
    } catch (err) {
      console.error('Error saving paycheck reminder:', err);
    }
    renderPaycheckReminder();
  });
  document.getElementById('reminder-edit-btn').addEventListener('click', showReminderEdit);
  document.getElementById('reminder-cancel-btn').addEventListener('click', renderPaycheckReminder);
  document.getElementById('reminder-remove-btn').addEventListener('click', async () => {
    const uid = currentUser?.uid;
    if (!uid) return;
    paycheckReminder = null;
    try {
      await deleteDoc(doc(db, 'users', uid, 'settings', 'paycheck'));
    } catch (err) {
      console.error('Error removing paycheck reminder:', err);
    }
    renderPaycheckReminder();
  });

  // Profile — save goals
  document.getElementById('profile-save-btn').addEventListener('click', async () => {
    const uid     = currentUser?.uid;
    if (!uid) return;
    const errorEl = document.getElementById('profile-error');
    errorEl.textContent = '';

    const budgetVal  = parseFloat(document.getElementById('profile-budget-input').value)  || null;
    const incomeVal  = parseFloat(document.getElementById('profile-income-input').value)  || null;
    const expenseVal = parseFloat(document.getElementById('profile-expense-input').value) || null;

    if (!budgetVal && !incomeVal && !expenseVal) {
      errorEl.textContent = 'Enter at least one goal to save.';
      return;
    }

    const btn = document.getElementById('profile-save-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
      monthlyBudget = budgetVal;
      incomeTarget  = incomeVal;
      expenseLimit  = expenseVal;
      await setDoc(doc(db, 'users', uid, 'settings', 'profile'), {
        monthlyBudget: budgetVal  ?? null,
        incomeTarget:  incomeVal  ?? null,
        expenseLimit:  expenseVal ?? null,
      });
      document.getElementById('profile-budget-input').value  = '';
      document.getElementById('profile-income-input').value  = '';
      document.getElementById('profile-expense-input').value = '';
      renderProfileSection();
      renderBudgetCard();
      renderDashboard();
    } catch (err) {
      console.error('Error saving goals:', err);
      errorEl.textContent = 'Failed to save. Please try again.';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Save Goals';
    }
  });

  // Profile — edit
  document.getElementById('profile-edit-btn').addEventListener('click', () => {
    document.getElementById('profile-saved').style.display       = 'none';
    document.getElementById('profile-form').style.display        = 'block';
    document.getElementById('profile-cancel-btn').style.display  = 'inline-block';
    if (monthlyBudget) document.getElementById('profile-budget-input').value  = monthlyBudget;
    if (incomeTarget)  document.getElementById('profile-income-input').value  = incomeTarget;
    if (expenseLimit)  document.getElementById('profile-expense-input').value = expenseLimit;
  });

  // Profile — cancel edit
  document.getElementById('profile-cancel-btn').addEventListener('click', () => {
    document.getElementById('profile-budget-input').value  = '';
    document.getElementById('profile-income-input').value  = '';
    document.getElementById('profile-expense-input').value = '';
    renderProfileSection();
  });

  // Input clear buttons (×)
  document.querySelectorAll('.input-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.target).value = '';
      document.getElementById(btn.dataset.target).focus();
    });
  });

  // Change password modal
  const changePwOverlay = document.getElementById('change-password-overlay');

  function openChangePw() {
    changePwOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('new-password-input').focus(), 60);
  }

  function closeChangePw() {
    changePwOverlay.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('new-password-input').value = '';
    document.getElementById('change-password-error').textContent = '';
    document.getElementById('change-password-error').style.cssText = '';
  }

  document.getElementById('change-password-nav-btn')?.addEventListener('click', openChangePw);
  document.getElementById('change-password-cancel-btn').addEventListener('click', closeChangePw);
  changePwOverlay.addEventListener('click', e => { if (e.target === changePwOverlay) closeChangePw(); });

  document.getElementById('change-password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const user    = currentUser;
    if (!user) return;
    const newPass = document.getElementById('new-password-input').value;
    const errorEl = document.getElementById('change-password-error');
    const btn     = document.getElementById('change-password-save-btn');
    errorEl.textContent = '';
    errorEl.style.cssText = '';

    if (!newPass || newPass.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Updating…';
    try {
      await updatePassword(user, newPass);
      errorEl.style.color       = '#2d7a3a';
      errorEl.style.background  = '#edf7f0';
      errorEl.style.borderColor = '#a8d5b5';
      errorEl.textContent = 'Password updated successfully.';
      document.getElementById('new-password-input').value = '';
      setTimeout(closeChangePw, 2000);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        errorEl.textContent = 'Please sign out and sign back in before changing your password.';
      } else {
        errorEl.textContent = 'Failed to update password. Please try again.';
      }
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Update Password';
    }
  });

  // Password toggle in change password modal
  document.querySelectorAll('#change-password-overlay .password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.querySelector('.eye-icon').style.display     = isText ? '' : 'none';
      btn.querySelector('.eye-off-icon').style.display = isText ? 'none' : '';
    });
  });

  // Export buttons
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);

  // AI Budget Insights
  document.getElementById('analyze-btn').addEventListener('click', analyzeBudget);

  // Auth tabs
  document.getElementById('auth-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.auth-tab');
    if (tab) switchAuthTab(tab.dataset.tab);
  });

  // Bottom switch link ("Create one" / "Sign in instead")
  document.getElementById('auth-switch-btn').addEventListener('click', () => {
    const current = document.querySelector('.auth-tab.active').dataset.tab;
    switchAuthTab(current === 'signin' ? 'signup' : 'signin');
  });

  // Auth form submit
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

  // Sign out
  document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

  // Auth state observer — drives loading screen, auth gate, and app visibility.
  // Fires once immediately on page load with the persisted session (if any),
  // then again whenever the user signs in or out.
  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user;

      // Populate welcome bar and nav before revealing the app
      setWelcomeBar(user);
      const displayName = user.displayName || user.email.split('@')[0];
      const nameEl = document.getElementById('account-btn-name');
      if (nameEl) nameEl.textContent = displayName;
      loadAndApplyAvatar(user.uid, 'account-avatar-ring');
      document.getElementById('nav-user').style.display  = 'flex';

      // Show signed-in banner if user just logged in
      const justSignedIn = sessionStorage.getItem('justSignedIn');
      if (justSignedIn) {
        sessionStorage.removeItem('justSignedIn');
        showSigninToast(justSignedIn);
      }

      // Show app (still under the loading screen until first snapshot arrives)
      document.getElementById('app-content').style.display = '';
      document.getElementById('auth-gate').style.display   = 'none';

      // Start the transaction subscription immediately — don't wait for settings.
      // hideLoader() fires on the first onSnapshot, so the user sees their data
      // as soon as Firestore responds. Settings load in parallel and trigger a
      // re-render once they arrive.
      subscribeTransactions(user.uid);
      subscribeInvestments(user.uid);

      // Load settings in parallel with the Firestore subscription.
      Promise.all([
        loadPaycheckReminder(user.uid),
        loadProfileSettings(user.uid),
      ]).then(() => {
        if (document.getElementById('tx-type').value === 'income') {
          renderPaycheckReminder();
        }
        document.getElementById('profile-section').style.display  = '';
        renderProfileSection();
        renderBudgetCard();
      });

    } else {
      // Cancel the Firestore listeners before navigating away
      if (unsubTransactions) { unsubTransactions(); unsubTransactions = null; }
      if (unsubInvestments)  { unsubInvestments();  unsubInvestments  = null; }

      // Redirect to the home page for sign-in
      window.location.replace('./index.html');
    }
  });

  // HTML chart uses CSS % widths — no resize redraw needed
}

document.addEventListener('DOMContentLoaded', init);
initPageTransitions();
