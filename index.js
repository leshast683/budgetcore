// ============================================================
// BudgetCore — index.js
// Home page: auth state + sliding sign-in / sign-up
// ============================================================

import { supabase } from './supabase.js';
import { initPageTransitions } from './transitions.js';
import { loadAndApplyAvatar } from './avatarUtils.js';
import { initNav } from './nav.js';
import { CATEGORY_LABELS, CATEGORY_COLORS } from './categories.js';
import aiRecExpenseIcon from './ai-rec-expense-icon.png';
import aiRecIncomeIcon from './ai-rec-income-icon.png';
import aiRecGoalIcon from './ai-rec-goal-icon.png';
import stepBudgetIcon from './home-step-budget-icon.png';
import stepTransactionIcon from './home-step-transaction-icon.png';
import stepGoalIcon from './home-step-goal-icon.png';
import stepBudgetIconDone from './home-step-budget-icon-done.png';
import stepTransactionIconDone from './home-step-transaction-icon-done.png';
import stepGoalIconDone from './home-step-goal-icon-done.png';
import mtMascot1 from './mt-mascot-1.png';
import mtMascot2 from './mt-mascot-2.png';
import mtMascot3 from './mt-mascot-3.png';
import mtMascot4 from './mt-mascot-4.png';
import mtMascot5 from './mt-mascot-5.png';

// ── Auth state ────────────────────────────────────────────────────────────────
let currentUser = null;

supabase.auth.onAuthStateChange((event, session) => {
  document.getElementById('auth-loading').style.display = 'none';
  currentUser = session?.user ?? null;

  if (currentUser && sessionStorage.getItem('authPending')) {
    // Handles every sign-in path (email/password sign-in, sign-up, and OAuth):
    // supabase.auth's session gets set — and this listener fires — the moment
    // signUp()/signInWithPassword()/signInWithOAuth() resolves internally, which
    // can happen before the calling form handler's own code continues. Routing
    // the welcome/onboarding flow through here (instead of from each form
    // handler) avoids that race.
    sessionStorage.removeItem('authPending');
    const name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name
      || currentUser.email?.split('@')[0] || 'there';
    showWelcomeToast(name, currentUser, () => {
      showLoggedInState(currentUser);
      showSigninToast(name);
    });
  } else if (currentUser) {
    showLoggedInState(currentUser);
  } else {
    showSignedOutState();
  }
});

// Re-fetch the avatar if the page is restored from bfcache (e.g. via the
// browser back button), so a just-saved avatar change doesn't look stale.
window.addEventListener('pageshow', e => {
  if (e.persisted && currentUser) {
    loadAndApplyAvatar(currentUser.id, 'home-avatar-ring');
  }
});

function showLoggedInState(user) {
  hideAuth();
  document.getElementById('home-nav-user').style.display   = 'flex';
  document.getElementById('home-nav-signin').style.display = 'none';
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
  document.getElementById('home-user-email').textContent = name;
  loadAndApplyAvatar(user.id, 'home-avatar-ring');

  document.getElementById('marketing-home').style.display = 'none';
  document.getElementById('account-home').style.display   = '';
  renderAccountHome(user);
}

function showSigninToast(name) {
  const toast = document.getElementById('signin-toast');
  const msgEl = document.getElementById('signin-toast-msg');
  if (!toast) return;
  msgEl.textContent = `Welcome, ${name}! Great to have you here.`;
  toast.style.display = 'flex';
  const close = document.getElementById('signin-toast-close');
  const dismiss = () => {
    toast.classList.add('signin-toast--out');
    setTimeout(() => { toast.style.display = 'none'; toast.classList.remove('signin-toast--out'); }, 400);
  };
  close.addEventListener('click', dismiss, { once: true });
  setTimeout(dismiss, 3000);
}

function showSignedOutState() {
  document.getElementById('home-nav-user').style.display   = 'none';
  document.getElementById('home-nav-signin').style.display = '';
  document.getElementById('hero-dashboard-btn').style.display = 'none';
  document.getElementById('hero-signin-btn').style.display    = '';

  document.getElementById('marketing-home').style.display = '';
  document.getElementById('account-home').style.display   = 'none';
}

// ── Account Home (signed-in summary) ───────────────────────────────────────────
const fmtCurrency = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWholeCurrency = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const todayMonth = () => new Date().toISOString().slice(0, 7);

function animateCountUp(el, target, formatFn, duration = 700) {
  const start = performance.now();
  const from = 0;
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (target - from) * eased;
    el.textContent = formatFn(value);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = formatFn(target);
  }
  requestAnimationFrame(tick);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Most-recently-fetched data, kept around so the "Analyze Budget" button
// (clicked later, independent of the initial render) always has fresh data.
let homeTransactions = [];
let homeInvestments  = [];
let dailyChartInstance = null;
let selectedSpendingMonth = null;

// Cache for AI Budget Insights — skips the API call when nothing has
// changed since the last analysis (same approach as the Finance Hub).
const insightCache = { key: null, data: null };

// Expense categories treated as discretionary (vs. fixed costs like housing/
// utilities) when estimating a realistic "potential savings" figure.
const DISCRETIONARY_CATEGORIES = [
  'dining', 'fooddelivery', 'subscriptions', 'entertainment',
  'shopping', 'onlineshopping', 'clothing', 'personalcare',
];

let homeSpendChart = null;

async function renderAccountHome(user) {
  const uid = user.id;

  const [txRes, goalsRes, invRes, nwRes, profileRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', uid),
    supabase.from('goals').select('*').eq('user_id', uid),
    supabase.from('investments').select('*').eq('user_id', uid),
    supabase.from('networth').select('*').eq('user_id', uid),
    supabase.from('profiles').select('monthly_budget, income_target, expense_limit').eq('id', uid).single(),
  ]);

  const transactions = txRes.data || [];
  const goals         = goalsRes.data || [];
  const investments   = invRes.data || [];
  const nwItems        = nwRes.data || [];
  const profile        = profileRes.data || {};

  homeTransactions = transactions;
  homeInvestments  = investments;

  renderHomeNetWorth(nwItems);
  renderHomeBalance(transactions);
  renderHomeInvestments(investments);
  renderHomeGoals(goals);
  renderHomeSpendOverview(transactions);
  renderHomeNextSteps({
    hasBudgetTargets: profile.monthly_budget != null || profile.income_target != null || profile.expense_limit != null,
    hasTransactions:  transactions.length > 0,
    hasGoals:         goals.length > 0,
  });
  renderDailySpendingChart(transactions);
}

function renderHomeNetWorth(nwItems) {
  const LIABILITY_TYPES = new Set([
    'creditcard_debt', 'student_loan', 'car_loan', 'mortgage_debt', 'personal_loan', 'medical_debt', 'other_liability',
  ]);
  const totalAssets = nwItems.filter(i => !LIABILITY_TYPES.has(i.type)).reduce((s, i) => s + Number(i.value || 0), 0);
  const totalLiab   = nwItems.filter(i =>  LIABILITY_TYPES.has(i.type)).reduce((s, i) => s + Number(i.value || 0), 0);
  const netWorth    = totalAssets - totalLiab;

  document.getElementById('home-nw-value').textContent = fmtCurrency(netWorth);

  // 30-day change, reconstructed from item creation dates (same approach as analytics.html)
  const sorted = [...nwItems].filter(i => i.created_at).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let delta = 0, pct = 0;
  if (sorted.length) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    let running = 0, valueAtCutoff = 0;
    for (const i of sorted) {
      running += LIABILITY_TYPES.has(i.type) ? -Number(i.value || 0) : Number(i.value || 0);
      if (new Date(i.created_at) <= cutoff) valueAtCutoff = running;
    }
    delta = netWorth - valueAtCutoff;
    pct = valueAtCutoff !== 0 ? (delta / Math.abs(valueAtCutoff)) * 100 : (delta !== 0 ? 100 : 0);
  }
  const sign = delta >= 0 ? '+' : '−';
  document.getElementById('home-nw-change-text').textContent = `${sign} ${fmtCurrency(Math.abs(delta))} (${Math.abs(pct).toFixed(0)}%)`;
  document.getElementById('home-nw-change').classList.toggle('is-negative', delta < 0);
}

function renderHomeBalance(transactions) {
  const month = todayMonth();
  const monthTx = transactions.filter(tx => (tx.date || '').slice(0, 7) === month);
  const income   = monthTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const expenses = monthTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
  const balance  = income - expenses;

  const balanceEl = document.getElementById('home-tile-balance-val');
  balanceEl.classList.toggle('positive', balance > 0);
  balanceEl.classList.toggle('negative', balance < 0);
  animateCountUp(balanceEl, balance, fmtCurrency);

  animateCountUp(document.getElementById('home-tile-expenses-val'), expenses, fmtCurrency);
}

function renderHomeInvestments(investments) {
  const totalValue = investments.reduce((s, inv) => s + Number(inv.current_price) * Number(inv.shares), 0);
  const totalCost  = investments.reduce((s, inv) => s + Number(inv.purchase_price) * Number(inv.shares), 0);
  const gainPct    = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  animateCountUp(document.getElementById('home-tile-invest-val'), totalValue, fmtCurrency);
  const subEl = document.getElementById('home-tile-invest-sub');
  if (!investments.length) {
    subEl.textContent = '';
  } else {
    subEl.textContent = (gainPct >= 0 ? '+' : '') + gainPct.toFixed(1) + '%';
    subEl.className = 'home-tile-sub ' + (gainPct >= 0 ? 'positive' : 'negative');
  }
}

function renderHomeGoals(goals) {
  const active = goals.filter(g => Number(g.saved) < Number(g.target));
  const totalTarget = active.reduce((s, g) => s + Number(g.target || 0), 0);
  const activeSaved = active.reduce((s, g) => s + Number(g.saved || 0), 0);
  const pct = totalTarget > 0 ? Math.min(Math.round((activeSaved / totalTarget) * 100), 100) : 0;

  const goalsValEl = document.getElementById('home-tile-goals-val');
  animateCountUp(goalsValEl, active.length, v => `${Math.round(v)} active`);

  const fillEl = document.getElementById('home-tile-goals-fill');
  fillEl.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => { fillEl.style.width = pct + '%'; }));
}

function renderHomeSpendOverview(transactions) {
  const card = document.getElementById('home-spend-card');
  const month = todayMonth();
  const totals = {};
  transactions.forEach(tx => {
    if (tx.type === 'expense' && (tx.date || '').slice(0, 7) === month) {
      totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
    }
  });

  const cats = Object.keys(totals).filter(c => totals[c] > 0);
  if (!cats.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  const canvas = document.getElementById('home-spend-chart');
  const labels = cats.map(c => CATEGORY_LABELS[c] || c);
  const data   = cats.map(c => parseFloat(totals[c].toFixed(2)));
  const colors = cats.map(c => CATEGORY_COLORS[c] || '#a07848');

  if (homeSpendChart) { homeSpendChart.destroy(); homeSpendChart = null; }
  import('chart.js/auto').then(({ default: Chart }) => {
    homeSpendChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fffdf9', borderWidth: 3, borderRadius: 6, hoverOffset: 10 }] },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: 'Inter, -apple-system, sans-serif', size: 11, weight: '600' },
              color: '#4a3020',
              padding: 16,
              usePointStyle: true,
              pointStyle: 'rect',
              pointStyleWidth: 10,
              boxHeight: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(26,14,6,0.92)',
            padding: 10,
            cornerRadius: 10,
            callbacks: { label: ctx => `  ${ctx.label}: ${fmtCurrency(ctx.parsed)}` },
          },
        },
      },
      plugins: [{
        id: 'homeCenterText',
        afterDraw(chart) {
          const { ctx } = chart;
          const meta = chart.getDatasetMeta(0);
          if (!meta.data.length) return;
          const { x, y } = meta.data[0];
          const sum = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 18px Inter, -apple-system, sans-serif';
          ctx.fillStyle = '#1a0e06';
          ctx.fillText(fmtCurrency(sum), x, y - 9);
          ctx.font = '500 10px Inter, -apple-system, sans-serif';
          ctx.fillStyle = '#957560';
          ctx.fillText('this month', x, y + 10);
          ctx.restore();
        },
      }],
    });
  });
}

function renderHomeNextSteps({ hasBudgetTargets, hasTransactions, hasGoals }) {
  const steps = [
    { done: hasBudgetTargets, label: 'Set Up Budget Targets', href: 'app.html', incompleteIcon: stepBudgetIcon, doneIcon: stepBudgetIconDone },
    { done: hasTransactions,  label: 'Add Your First Transaction', href: 'app.html', incompleteIcon: stepTransactionIcon, doneIcon: stepTransactionIconDone },
    { done: hasGoals,         label: 'Create Your First Goal', href: 'goals.html?mode=savings', incompleteIcon: stepGoalIcon, doneIcon: stepGoalIconDone },
  ];
  const doneCount = steps.filter(s => s.done).length;
  document.getElementById('home-next-steps-count').textContent = `${doneCount} of ${steps.length} complete`;

  document.getElementById('home-next-steps').innerHTML = steps.map((s, i) => `
    ${i > 0 ? `<div class="home-step-connector${steps[i - 1].done ? ' is-done' : ''}"></div>` : ''}
    <a href="${s.href}" class="home-step${s.done ? ' is-done' : ''}">
      <span class="home-step-icon-wrap home-step-icon-wrap--img">
        <img src="${s.done ? s.doneIcon : s.incompleteIcon}" alt="" />
        ${s.done ? '<span class="home-step-check">✓</span>' : ''}
      </span>
      <span class="home-step-label">${s.label}</span>
    </a>
  `).join('');
}

// Draws a rounded callout bubble with a pointer tail above a chart point
function drawDailyChartCallout(ctx, x, y, text) {
  ctx.save();
  ctx.font = '700 13px Inter, sans-serif';
  const paddingX = 11, bubbleH = 28, tailH = 6, gap = 12;
  const textWidth = ctx.measureText(text).width;
  const bubbleW = textWidth + paddingX * 2;
  const bubbleBottom = y - gap;
  const bubbleTop = bubbleBottom - bubbleH;
  const bubbleX = x - bubbleW / 2;
  const r = bubbleH / 2;

  const bubbleGrad = ctx.createLinearGradient(bubbleX, bubbleTop, bubbleX + bubbleW, bubbleTop + bubbleH);
  bubbleGrad.addColorStop(0, '#9a6a3a');
  bubbleGrad.addColorStop(1, '#6e4420');

  ctx.shadowColor = 'rgba(90,56,20,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = bubbleGrad;

  ctx.beginPath();
  ctx.moveTo(bubbleX + r, bubbleTop);
  ctx.arcTo(bubbleX + bubbleW, bubbleTop, bubbleX + bubbleW, bubbleTop + bubbleH, r);
  ctx.arcTo(bubbleX + bubbleW, bubbleTop + bubbleH, bubbleX, bubbleTop + bubbleH, r);
  ctx.arcTo(bubbleX, bubbleTop + bubbleH, bubbleX, bubbleTop, r);
  ctx.arcTo(bubbleX, bubbleTop, bubbleX + bubbleW, bubbleTop, r);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - tailH, bubbleBottom - 1);
  ctx.lineTo(x + tailH, bubbleBottom - 1);
  ctx.lineTo(x, bubbleBottom + tailH);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, bubbleTop + bubbleH / 2);
  ctx.restore();
}

function lerpColor(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

const weeklyBarLabelsPlugin = {
  id: 'weeklyBarLabels',
  afterDatasetsDraw(chart) {
    const data = chart.data.datasets[0]?.data;
    if (!data || !data.length) return;
    const meta = chart.getDatasetMeta(0);
    let maxIdx = 0;
    data.forEach((v, i) => { if (v > data[maxIdx]) maxIdx = i; });
    data.forEach((v, i) => {
      const bar = meta.data[i];
      if (!bar) return;
      const label = fmtWholeCurrency(v);
      if (i === maxIdx && v > 0) {
        drawDailyChartCallout(chart.ctx, bar.x, bar.y, label);
      } else {
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '700 13px Inter, sans-serif';
        ctx.fillStyle = '#6e4420';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, bar.x, bar.y - 10);
        ctx.restore();
      }
    });
  },
};

function getAvailableSpendingMonths(transactions) {
  const set = new Set(transactions.filter(tx => tx.type === 'expense').map(tx => (tx.date || '').slice(0, 7)));
  set.add(todayMonth());
  return [...set].sort().reverse();
}

function formatSpendingMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
  return y === new Date().getFullYear() ? name : `${name} ${y}`;
}

function getWeekBuckets(year, monthIndex0) {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const buckets = [];
  for (let start = 1; start <= daysInMonth; start += 7) {
    buckets.push({ start, end: Math.min(start + 6, daysInMonth) });
  }
  return buckets;
}

async function renderDailySpendingChart(transactions) {
  const section = document.getElementById('daily-chart-section');
  const canvas  = document.getElementById('daily-spending-chart');
  const select  = document.getElementById('dsc-month-select');
  if (!section || !canvas || !select) return;

  const availableMonths = getAvailableSpendingMonths(transactions);
  if (!selectedSpendingMonth || !availableMonths.includes(selectedSpendingMonth)) {
    selectedSpendingMonth = todayMonth();
  }
  select.innerHTML = availableMonths.map(m =>
    `<option value="${m}" ${m === selectedSpendingMonth ? 'selected' : ''}>${formatSpendingMonthLabel(m)}</option>`
  ).join('');

  if (!select.dataset.wired) {
    select.dataset.wired = '1';
    select.addEventListener('change', () => {
      selectedSpendingMonth = select.value;
      renderDailySpendingChart(homeTransactions);
    });
  }

  const month = selectedSpendingMonth;
  const monthTx = transactions.filter(tx => tx.type === 'expense' && (tx.date || '').slice(0, 7) === month);
  if (!monthTx.length) {
    section.style.display = 'none';
    if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
    return;
  }
  section.style.display = '';

  const [y, m] = month.split('-').map(Number);
  const buckets = getWeekBuckets(y, m - 1);
  const byDay = {};
  monthTx.forEach(tx => { byDay[tx.date] = (byDay[tx.date] || 0) + Number(tx.amount); });

  const monthAbbr = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
  const labels = [], spendData = [];
  buckets.forEach(b => {
    let sum = 0;
    for (let d = b.start; d <= b.end; d++) {
      sum += byDay[`${month}-${String(d).padStart(2, '0')}`] || 0;
    }
    spendData.push(parseFloat(sum.toFixed(2)));
    labels.push(b.start === b.end ? `${monthAbbr} ${b.start}` : `${monthAbbr} ${b.start} – ${b.end}`);
  });

  const { default: Chart } = await import('chart.js/auto');
  const ctx = canvas.getContext('2d');

  const maxSpend = Math.max(...spendData, 0);
  const yAxisMax = maxSpend > 0 ? Math.ceil((maxSpend * 1.12) / 500) * 500 : 500;

  const datasets = [{
    label: 'Weekly Spending',
    data: spendData,
    borderRadius: 16,
    borderSkipped: false,
    barPercentage: 0.62,
    categoryPercentage: 0.85,
    backgroundColor(ctx) {
      const chart = ctx.chart;
      const yScale = chart.scales && chart.scales.y;
      if (!yScale) return '#e8c896';
      const value = spendData[ctx.dataIndex];
      const t = maxSpend > 0 ? value / maxSpend : 0;
      const top = lerpColor('#faecd8', '#9c6f62', t);
      const bottom = lerpColor('#f2d8ab', '#6e4a40', t);
      const topPx = yScale.getPixelForValue(value);
      const basePx = yScale.getPixelForValue(0);
      const grad = chart.ctx.createLinearGradient(0, topPx, 0, basePx);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      return grad;
    },
  }];

  if (dailyChartInstance) {
    dailyChartInstance.data.labels = labels;
    dailyChartInstance.data.datasets = datasets;
    dailyChartInstance.options.scales.y.max = yAxisMax;
    dailyChartInstance.update('active');
    return;
  }

  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 60, right: 10 } },
      animation: { duration: 650, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 11, weight: '600', family: 'Inter, sans-serif' }, color: '#6e4420' },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#9a7a5a', callback: v => '$' + v.toLocaleString('en-US'), stepSize: yAxisMax / 5 },
          grid: { color: 'rgba(110,68,32,0.12)', drawTicks: false },
          border: { display: false },
          beginAtZero: true,
          max: yAxisMax,
          afterFit: scale => { scale.width = Math.max(scale.width, 56); },
        },
      },
    },
    plugins: [weeklyBarLabelsPlugin],
  });
}

// --- AI Budget Insights ---

function buildInsightCacheKey(income, expenses, balance, incomeByCategory, expensesByCategory) {
  const sortedEntries = obj => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({
    income:   Number(income).toFixed(2),
    expenses: Number(expenses).toFixed(2),
    balance:  Number(balance).toFixed(2),
    inc: sortedEntries(incomeByCategory),
    exp: sortedEntries(expensesByCategory),
  });
}

const AI_REC_ICONS = {
  calendar: aiRecExpenseIcon,
  coins:    aiRecIncomeIcon,
  target:   aiRecGoalIcon,
};

// Rough, deterministic "how much could you realistically trim" estimate —
// never AI-generated, so the dollar figure is always traceable to real data.
function estimatePotentialSavings(expensesByCategoryRaw) {
  const discretionaryLabels = new Set(DISCRETIONARY_CATEGORIES.map(c => CATEGORY_LABELS[c]).filter(Boolean));
  const discretionarySpend = Object.entries(expensesByCategoryRaw)
    .filter(([label]) => discretionaryLabels.has(label))
    .reduce((s, [, amt]) => s + amt, 0);
  if (discretionarySpend <= 0) return 0;
  return Math.max(5, Math.round(discretionarySpend * 0.15));
}

function buildRecommendations({ expenseTip, incomeTip, balance, potentialSavings }) {
  const isDeficit = balance < 0;
  const gap = isDeficit ? Math.abs(balance) : 0;
  const wholeDollars = n => `$${Math.round(n).toLocaleString('en-US')}`;

  return [
    {
      icon: AI_REC_ICONS.calendar,
      iconClass: 'ai-rec-icon--budget',
      title: expenseTip.title,
      description: expenseTip.description,
      badge: potentialSavings > 0 ? { label: 'Save up to', value: `${wholeDollars(potentialSavings)}/mo` } : null,
    },
    {
      icon: AI_REC_ICONS.coins,
      iconClass: 'ai-rec-icon--income',
      title: incomeTip.title,
      description: incomeTip.description,
      badge: gap > 0 ? { label: 'Close the gap', value: `${wholeDollars(gap)}/mo` } : null,
    },
    {
      icon: AI_REC_ICONS.target,
      iconClass: 'ai-rec-icon--goal',
      title: 'Set a short-term goal',
      description: isDeficit
        ? 'Build a plan to reach a positive balance next month.'
        : "Build a plan to put this month's surplus toward something specific.",
      cta: { label: 'Create Goal', href: 'goals.html' },
    },
  ];
}

function renderInsightResult({ keyInsight, expenseTip, incomeTip, balance, expenses, potentialSavings, cacheLabelText }) {
  const isDeficit = balance < 0;

  document.getElementById('ai-month-chip').textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const statusBadge = document.getElementById('ai-status-badge');
  statusBadge.innerHTML = isDeficit ? '&#8595; Off Track' : '&#8593; On Track';
  statusBadge.classList.toggle('ai-status-badge--off', isDeficit);
  statusBadge.classList.toggle('ai-status-badge--on', !isDeficit);

  const balanceEl = document.getElementById('ai-stat-balance');
  balanceEl.textContent = fmtCurrency(balance);
  balanceEl.classList.toggle('is-negative', isDeficit);
  document.getElementById('ai-stat-expenses').textContent = fmtCurrency(expenses);

  document.getElementById('ai-key-insight-text').textContent = keyInsight;

  const recs = buildRecommendations({ expenseTip, incomeTip, balance, potentialSavings });
  document.getElementById('ai-rec-list').innerHTML = recs.map(rec => `
    <div class="ai-rec-item">
      <span class="ai-rec-icon ${rec.iconClass}" aria-hidden="true"><img src="${rec.icon}" alt="" /></span>
      <div class="ai-rec-body">
        <h4 class="ai-rec-title">${escapeHtml(rec.title)}</h4>
        <p class="ai-rec-desc">${escapeHtml(rec.description)}</p>
      </div>
      ${rec.badge
        ? `<span class="ai-rec-badge"><span class="ai-rec-badge-label">${escapeHtml(rec.badge.label)}</span><span class="ai-rec-badge-value">${escapeHtml(rec.badge.value)}</span></span>`
        : rec.cta
          ? `<a href="${rec.cta.href}" class="ai-rec-cta">${escapeHtml(rec.cta.label)} &#8594;</a>`
          : ''}
    </div>
  `).join('');

  document.getElementById('ai-insights-cache-label').textContent = cacheLabelText;
}

async function analyzeBudget() {
  const btn      = document.getElementById('analyze-btn');
  const resultEl = document.getElementById('ai-insights-result');
  const errorEl  = document.getElementById('ai-insights-error');

  function showError(msg) {
    errorEl.textContent    = msg;
    errorEl.style.display  = '';
    resultEl.style.display = 'none';
  }

  const month = todayMonth();
  const monthTxs = homeTransactions.filter(tx => (tx.date || '').slice(0, 7) === month);
  if (monthTxs.length === 0) {
    showError('No transactions found for this month. Add some income or expenses first.');
    return;
  }

  const incomeByCategory   = {};
  const expensesByCategory = {};
  for (const tx of monthTxs) {
    const label = CATEGORY_LABELS[tx.category] || (tx.category ? capitalize(tx.category) : '') || 'Other';
    if (tx.type === 'income') {
      incomeByCategory[label] = (incomeByCategory[label] || 0) + Number(tx.amount);
    } else {
      expensesByCategory[label] = (expensesByCategory[label] || 0) + Number(tx.amount);
    }
  }

  const income   = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
  const expenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const balance  = income - expenses;

  if (!isFinite(income) || !isFinite(expenses)) {
    showError('Some transactions have invalid amounts. Please review your data.');
    return;
  }

  const cacheKey = buildInsightCacheKey(income, expenses, balance, incomeByCategory, expensesByCategory);
  const potentialSavings = estimatePotentialSavings(expensesByCategory);
  if (insightCache.key === cacheKey) {
    renderInsightResult({ ...insightCache.data, balance, expenses, potentialSavings, cacheLabelText: 'Loaded from cache' });
    errorEl.style.display  = 'none';
    resultEl.style.display = '';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Analyzing…';
  errorEl.style.display  = 'none';
  resultEl.style.display = 'none';

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
        month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.error ||
        (res.status >= 500 ? 'The server ran into an error. Please try again.'
                           : 'The request was rejected. Please try again.')
      );
    }

    const data = await res.json();

    if (!data.keyInsight || !data.expenseTip?.title || !data.incomeTip?.title) {
      throw new Error('The server returned an incomplete response. Please try again.');
    }

    insightCache.key  = cacheKey;
    insightCache.data = { keyInsight: data.keyInsight, expenseTip: data.expenseTip, incomeTip: data.incomeTip };

    renderInsightResult({ ...insightCache.data, balance, expenses, potentialSavings, cacheLabelText: 'Fresh analysis' });
    resultEl.style.display = '';

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      showError('The request timed out. Please try again in a moment.');
    } else if (!navigator.onLine) {
      showError('You appear to be offline. Check your connection and try again.');
    } else {
      showError(err.message || 'Something went wrong. Please try again.');
    }

    console.error('AI insight error:', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Analyze Budget';
  }
}

document.getElementById('analyze-btn').addEventListener('click', analyzeBudget);

// ── Money Tips carousel (home page) ────────────────────────────────────────────
const MONEY_TIPS = [
  { category: 'Smart habits', title: 'Make saving automatic', text: 'Set up a recurring transfer on payday so you save before spending.', callout: 'Try starting with 5% of income' },
  { category: 'Budgeting', title: 'Try the 50/30/20 rule', text: 'Split income into 50% needs, 30% wants, and 20% savings and debt payoff.', callout: 'A simple framework that scales with any income' },
  { category: 'Emergency fund', title: 'Build a safety net first', text: 'Aim for 1 month of expenses saved before tackling other goals.', callout: 'Even $500 can prevent a debt spiral' },
  { category: 'Debt', title: 'Pay the highest interest first', text: 'Tackle high-interest debt before extra savings — it\'s a guaranteed return.', callout: 'Credit cards often cost 20%+ APR' },
  { category: 'Subscriptions', title: 'Audit recurring charges', text: 'Review every subscription monthly — cancel what you don\'t actively use.', callout: 'Average household wastes $200+/yr here' },
  { category: 'Awareness', title: 'Track every purchase', text: 'Logging expenses, even small ones, reveals patterns you\'d otherwise miss.', callout: 'Awareness alone cuts spending ~10-15%' },
  { category: 'Credit', title: 'Keep utilization low', text: 'Stay under 30% of your credit limit to protect your credit score.', callout: 'Under 10% is even better for your score' },
  { category: 'Saving', title: 'Pay yourself first', text: 'Treat savings like a non-negotiable bill, not an afterthought.', callout: 'Pair it with payday for consistency' },
  { category: 'Groceries', title: 'Plan meals before shopping', text: 'A list based on a weekly plan cuts impulse buys at the store.', callout: 'Never shop on an empty stomach' },
  { category: 'Big purchases', title: 'Use the 24-hour rule', text: 'Wait a full day before any non-essential purchase over $50.', callout: 'Most urges fade within hours' },
  { category: 'Income', title: 'Diversify your income', text: 'A side project or freelance work builds a buffer for lean months.', callout: 'Even $100/mo adds real resilience' },
  { category: 'Goals', title: 'Make goals specific and dated', text: '"Save $3,000 by December" beats "save more money" every time.', callout: 'Specific goals are 2-3x more likely to be hit' },
  { category: 'Housing', title: 'Keep housing under 30%', text: 'Rent or mortgage above this threshold squeezes every other goal.', callout: 'Include utilities in that calculation' },
  { category: 'Investing', title: 'Start early, even small', text: 'Compounding rewards time in the market more than perfect timing.', callout: '$50/mo at 25 beats $200/mo at 40' },
  { category: 'Taxes', title: 'Know your deductions', text: 'Common deductions and credits are often missed — a little research pays off.', callout: 'Revisit your withholding annually' },
  { category: 'Insurance', title: 'Shop your policies yearly', text: 'Auto and home insurance rates creep up — compare quotes every renewal.', callout: 'Switching can save 10-20%' },
  { category: 'Banking', title: 'Avoid overdraft fees', text: 'Link a savings buffer or alerts so you\'re never surprised by a fee.', callout: 'One overdraft can cost $30+' },
  { category: 'Negotiating', title: 'Negotiate your bills', text: 'Internet, phone, and insurance providers often have retention discounts.', callout: 'A 5-minute call can save $200+/yr' },
  { category: 'Windfalls', title: 'Give windfalls a job', text: 'Decide in advance how a bonus or refund will be split — save, debt, spend.', callout: 'Try the 50/30/20 split on windfalls too' },
  { category: 'Lifestyle', title: 'Don\'t upgrade every raise', text: 'Bank at least half of any raise before adjusting your spending.', callout: 'This is how high earners still go broke' },
  { category: 'Cash flow', title: 'Know your break-even number', text: 'Understand the minimum you need monthly to stay afloat.', callout: 'This number guides every big decision' },
  { category: 'Debt', title: 'Avoid minimum-payment traps', text: 'Minimums mostly cover interest — pay more whenever you can.', callout: 'An extra $20/mo can cut years off a loan' },
  { category: 'Shopping', title: 'Unsubscribe from sale emails', text: 'Fewer sale emails means fewer impulse temptations in your inbox.', callout: 'Out of sight really is out of mind' },
  { category: 'Net worth', title: 'Track net worth, not just spending', text: 'Assets minus debts is the real scoreboard for financial progress.', callout: 'Check it monthly, not daily' },
  { category: 'Retirement', title: 'Capture your employer match', text: 'An unmatched 401(k) contribution is free money left on the table.', callout: 'It\'s an instant 50-100% return' },
  { category: 'Credit cards', title: 'Pick one card to optimize', text: 'A single rewards or cashback card is easier to manage than five.', callout: 'Simplicity beats stacking rewards' },
  { category: 'Budget reviews', title: 'Review your budget monthly', text: 'A budget is a living plan — adjust it as life changes.', callout: '15 minutes a month keeps it honest' },
  { category: 'Price awareness', title: 'Price-check before big buys', text: 'A quick search can reveal the same item cheaper elsewhere.', callout: 'Browser extensions can do this for you' },
  { category: 'Family', title: 'Talk money with your household', text: 'Shared finances work best with shared visibility and goals.', callout: 'Monthly money check-ins reduce conflict' },
  { category: 'Mindset', title: 'Progress over perfection', text: 'One off-track month doesn\'t undo months of good habits.', callout: 'Consistency beats intensity every time' },
];
const MONEY_TIPS_SHOWN = 5;

let currentMoneyTips = [];
let currentMoneyTipIdx = 0;

function pickRandomMoneyTips() {
  const pool = [...MONEY_TIPS.keys()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, MONEY_TIPS_SHOWN).map(i => MONEY_TIPS[i]);
}

const MONEY_TIP_MASCOTS = [mtMascot1, mtMascot2, mtMascot3, mtMascot4, mtMascot5];
const MONEY_TIPS_AUTOPLAY_MS = 12000;
let moneyTipsAutoplayTimer = null;

function renderMoneyTip() {
  const tip = currentMoneyTips[currentMoneyTipIdx];
  document.getElementById('mt-category').textContent = tip.category;
  document.getElementById('mt-headline').textContent = tip.title;
  document.getElementById('mt-text').textContent = tip.text;
  document.getElementById('mt-callout-text').textContent = tip.callout;
  document.getElementById('mt-art-img').src = MONEY_TIP_MASCOTS[currentMoneyTipIdx % MONEY_TIP_MASCOTS.length];

  // Re-trigger the slide-in animation on every tip change (not just once on load).
  // Animates .mt-card-top as a single unit so the text and art slide together.
  const cardTop = document.querySelector('.mt-card-top');
  if (cardTop) {
    cardTop.classList.remove('mt-slide-in');
    void cardTop.offsetWidth; // force reflow so the animation restarts
    cardTop.classList.add('mt-slide-in');
  }
}

function advanceMoneyTip() {
  if (currentMoneyTipIdx >= currentMoneyTips.length - 1) {
    // Reached the end of this batch — shuffle in a fresh set of 5 from the pool of 30.
    currentMoneyTips = pickRandomMoneyTips();
    currentMoneyTipIdx = 0;
  } else {
    currentMoneyTipIdx += 1;
  }
  renderMoneyTip();
}

function restartMoneyTipsAutoplay() {
  if (moneyTipsAutoplayTimer) clearInterval(moneyTipsAutoplayTimer);
  moneyTipsAutoplayTimer = setInterval(advanceMoneyTip, MONEY_TIPS_AUTOPLAY_MS);
}

function initMoneyTips() {
  currentMoneyTips = pickRandomMoneyTips();
  currentMoneyTipIdx = 0;
  renderMoneyTip();
  restartMoneyTipsAutoplay();

  // Clicking the card skips ahead to the next tip.
  document.getElementById('mt-card').addEventListener('click', () => {
    advanceMoneyTip();
    restartMoneyTipsAutoplay();
  });
}

initMoneyTips();

initNav();

// ── Sliding panel logic ───────────────────────────────────────────────────────
const container      = document.getElementById('container');
const mobileToggleBtn = document.getElementById('auth-mobile-toggle');
const mobileMsgEl    = document.getElementById('auth-mobile-msg');

const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');

signUpButton.addEventListener('click', () => {
  container.classList.add('right-panel-active');
  updateMobileFooter(true);
});

signInButton.addEventListener('click', () => {
  container.classList.remove('right-panel-active');
  updateMobileFooter(false);
});

function toggleMobile() {
  const isSignup = container.classList.contains('right-panel-active');
  if (isSignup) {
    container.classList.remove('right-panel-active');
    updateMobileFooter(false);
  } else {
    container.classList.add('right-panel-active');
    updateMobileFooter(true);
  }
}
window.toggleMobile = toggleMobile;

function updateMobileFooter(isSignup) {
  mobileMsgEl.textContent    = isSignup ? 'Already have an account?' : "Don't have an account?";
  mobileToggleBtn.textContent = isSignup ? 'Sign In' : 'Sign Up';
}

// ── Auth modal ────────────────────────────────────────────────────────────────
const overlay = document.getElementById('auth-overlay');

function showAuth(tab) {
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (tab === 'signup') {
    container.classList.add('right-panel-active');
    updateMobileFooter(true);
    setTimeout(() => document.getElementById('signup-name').focus(), 60);
  } else {
    container.classList.remove('right-panel-active');
    updateMobileFooter(false);
    setTimeout(() => document.getElementById('signin-email').focus(), 60);
  }
  clearErrors();
}

function hideAuth() {
  overlay.style.display = 'none';
  document.body.style.overflow = '';
  clearErrors();
  document.getElementById('signin-form').reset();
  document.getElementById('signup-form').reset();
  document.getElementById('pw-strength').style.display = 'none';
}

function clearErrors() {
  document.getElementById('signin-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

overlay.addEventListener('click', e => { if (e.target === overlay) hideAuth(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideAuth(); });

document.querySelectorAll('[data-show-auth]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showAuth(el.dataset.showAuth);
  });
});

// ── Password strength ─────────────────────────────────────────────────────────
document.getElementById('signup-password').addEventListener('input', function () {
  const val    = this.value;
  const wrap   = document.getElementById('pw-strength');
  const label  = document.getElementById('pw-label');
  const bars   = [
    document.getElementById('pw-b1'),
    document.getElementById('pw-b2'),
    document.getElementById('pw-b3'),
    document.getElementById('pw-b4'),
  ];

  if (!val) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';

  const score = calcStrength(val);
  const labels   = ['Weak', 'Fair', 'Moderate', 'Strong'];
  const colors   = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169'];
  const active   = score; // 1–4

  bars.forEach((b, i) => {
    b.style.background = i < active ? colors[active - 1] : '#e8e0d4';
  });
  label.textContent  = labels[active - 1];
  label.style.color  = colors[active - 1];
});

function calcStrength(pw) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return Math.max(1, s);
}

// ── Welcome toast ─────────────────────────────────────────────────────────────
function showWelcomeToast(name, user, then) {
  sessionStorage.setItem('justSignedIn', name);
  // Show onboarding for brand-new users (no localStorage flag)
  if (user && !localStorage.getItem('budgetly_onboarded_' + user.id)) {
    hideAuth();
    showOnboarding(user, then);
    return;
  }
  overlay.style.transition = 'opacity 0.22s ease';
  overlay.style.opacity = '0';
  document.body.style.transition = 'opacity 0.22s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { hideAuth(); then(); }, 240);
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────────
const OB_GOAL_LABELS = {
  save: '💰 Save more',
  debt: '💳 Pay off debt',
  invest: '📈 Start investing',
  track: '📊 Track spending',
  emergency: '🏦 Emergency fund',
  retire: '🏖️ Plan retirement',
};

let _onboardingCallback = null;
let _onboardingUser = null;
let _obStep = 1;
let _obBudget = null;
let _obGoal = '';

function showOnboarding(user, callback) {
  _onboardingCallback = callback;
  _onboardingUser = user;
  _obStep = 1;
  _obBudget = null;
  _obGoal = '';
  document.getElementById('ob-budget').value = '';
  document.querySelectorAll('.ob-goal-btn').forEach(b => b.classList.remove('ob-goal-btn--selected'));
  showObPane(1);
  document.getElementById('onboarding-overlay').style.display = 'flex';
}

function showObPane(n) {
  [1, 2, 3, 4].forEach(i => {
    document.getElementById(`ob-pane-${i}`).style.display = i === n ? '' : 'none';
    document.getElementById(`ob-dot-${i}`).classList.toggle('ob-step--active', i === n);
    document.getElementById(`ob-dot-${i}`).classList.toggle('ob-step--done', i < n);
  });
  _obStep = n;
}

function renderObRecap() {
  const budgetRow = _obBudget
    ? `<div class="ob-recap-row"><span class="ob-recap-label">Monthly budget</span><span class="ob-recap-value">$${_obBudget.toLocaleString()}</span></div>`
    : `<div class="ob-recap-row"><span class="ob-recap-label">Monthly budget</span><span class="ob-recap-value">Not set yet</span></div>`;
  const goalRow = _obGoal
    ? `<div class="ob-recap-row"><span class="ob-recap-label">#1 goal</span><span class="ob-recap-value">${OB_GOAL_LABELS[_obGoal] || _obGoal}</span></div>`
    : `<div class="ob-recap-row"><span class="ob-recap-label">#1 goal</span><span class="ob-recap-value">Not set yet</span></div>`;
  document.getElementById('ob-recap').innerHTML = budgetRow + goalRow;
}

document.getElementById('ob-next-1').addEventListener('click', () => showObPane(2));

document.getElementById('ob-next-2').addEventListener('click', async () => {
  const budget = parseFloat(document.getElementById('ob-budget').value);
  if (!isNaN(budget) && budget > 0 && _onboardingUser) {
    _obBudget = budget;
    try {
      await supabase.from('profiles').update({ monthly_budget: budget }).eq('id', _onboardingUser.id);
    } catch { /* non-fatal */ }
  }
  showObPane(3);
});

document.getElementById('ob-skip-2').addEventListener('click', () => showObPane(3));

document.getElementById('ob-goals-grid').addEventListener('click', e => {
  const btn = e.target.closest('.ob-goal-btn');
  if (!btn) return;
  document.querySelectorAll('.ob-goal-btn').forEach(b => b.classList.toggle('ob-goal-btn--selected', b === btn));
});

document.getElementById('ob-next-3').addEventListener('click', async () => {
  const goal = document.querySelector('.ob-goal-btn--selected')?.dataset.goal || '';
  _obGoal = goal;
  if (_onboardingUser) {
    try {
      await supabase.from('profiles')
        .update({ onboarding_goal: goal, onboarded_at: new Date().toISOString() })
        .eq('id', _onboardingUser.id);
    } catch { /* non-fatal */ }
    localStorage.setItem('budgetly_onboarded_' + _onboardingUser.id, '1');
  }
  renderObRecap();
  showObPane(4);
});

document.getElementById('ob-finish').addEventListener('click', () => {
  document.getElementById('onboarding-overlay').style.display = 'none';
  if (_onboardingCallback) _onboardingCallback();
});

// ── Sign In form ──────────────────────────────────────────────────────────────
document.getElementById('signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errorEl  = document.getElementById('signin-error');
  const btn      = e.target.querySelector('[type=submit]');

  errorEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Signing in…';

  sessionStorage.setItem('authPending', '1');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    sessionStorage.removeItem('authPending');
    errorEl.textContent = friendlyError(error);
    btn.disabled = false; btn.textContent = 'Sign In';
    return;
  }
  // onAuthStateChange picks up the session and shows the welcome toast.
});

// ── Sign Up form ──────────────────────────────────────────────────────────────
document.getElementById('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  const errorEl  = document.getElementById('signup-error');
  const btn      = e.target.querySelector('[type=submit]');

  errorEl.textContent = '';

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.'; return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating account…';

  sessionStorage.setItem('authPending', '1');
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: name ? { full_name: name } : {} },
  });
  if (error) {
    sessionStorage.removeItem('authPending');
    errorEl.textContent = friendlyError(error);
    btn.disabled = false; btn.textContent = 'Create Account';
    return;
  }
  // onAuthStateChange picks up the session and shows the welcome/onboarding flow.
});

// ── Social auth (shared) ──────────────────────────────────────────────────────
async function socialAuth(provider, errorElId) {
  const errorEl = document.getElementById(errorElId);
  errorEl.textContent = '';
  sessionStorage.setItem('authPending', '1');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + '/index.html' },
  });
  if (error) {
    sessionStorage.removeItem('authPending');
    errorEl.textContent = friendlyError(error);
  }
  // On success the browser navigates away to the provider; onAuthStateChange
  // picks up the session (and shows the welcome toast) after the redirect back.
}

document.getElementById('signin-google').addEventListener('click', () => socialAuth('google', 'signin-error'));
document.getElementById('signup-google').addEventListener('click', () => socialAuth('google', 'signup-error'));
document.getElementById('signin-apple').addEventListener('click', () => socialAuth('apple', 'signin-error'));
document.getElementById('signup-apple').addEventListener('click', () => socialAuth('apple', 'signup-error'));

// ── Forgot password ───────────────────────────────────────────────────────────
document.getElementById('forgot-btn').addEventListener('click', async () => {
  const email   = document.getElementById('signin-email').value.trim();
  const errorEl = document.getElementById('signin-error');
  if (!email) { errorEl.textContent = 'Enter your email above first.'; return; }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html',
  });
  if (error) {
    errorEl.style.color = '';
    errorEl.style.background = '';
    errorEl.style.borderColor = '';
    errorEl.textContent = friendlyError(error);
  } else {
    errorEl.style.color      = '#2d7a3a';
    errorEl.style.background = '#edf7f0';
    errorEl.style.borderColor = '#a8d5b5';
    errorEl.textContent      = `Reset link sent to ${email}.`;
  }
});

// ── Password toggles ─────────────────────────────────────────────────────────
document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.querySelector('.eye-icon').style.display     = isText ? '' : 'none';
    btn.querySelector('.eye-off-icon').style.display = isText ? 'none' : '';
  });
});

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(err) {
  const code = err?.code;
  const byCode = {
    'invalid_credentials':          'Invalid email or password.',
    'user_already_exists':          'An account with this email already exists.',
    'email_exists':                 'An account with this email already exists.',
    'weak_password':                'Password must be at least 6 characters.',
    'validation_failed':            'Please enter a valid email address.',
    'email_address_invalid':        'Please enter a valid email address.',
    'over_email_send_rate_limit':   'Too many attempts. Please try again later.',
    'over_request_rate_limit':      'Too many attempts. Please try again later.',
    'signup_disabled':              'Sign-ups are currently disabled.',
    'email_not_confirmed':          'Please confirm your email before signing in.',
  };
  if (code && byCode[code]) return byCode[code];
  if (/network/i.test(err?.message || '')) return 'Network error. Check your connection.';
  return err?.message || 'Something went wrong.';
}

// ── Scroll & animations ───────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-animate]').forEach(el => revealObserver.observe(el));

const heroMockup = document.getElementById('hero-mockup');
if (heroMockup) {
  const BASE_X = 6, BASE_Y = -14, MAX_DELTA = 8;
  document.addEventListener('mousemove', e => {
    const dx = (e.clientX - window.innerWidth  / 2) / (window.innerWidth  / 2);
    const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    heroMockup.style.transform = `rotateX(${BASE_X + dy * MAX_DELTA}deg) rotateY(${BASE_Y - dx * MAX_DELTA}deg)`;
    heroMockup.style.animation = 'none';
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    heroMockup.style.transform = '';
    heroMockup.style.animation = '';
  });
}

function runCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const start  = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / 1400, 1);
    el.textContent = prefix + Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = prefix + target + suffix; el.classList.add('pop'); }
  })(start);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => runCounter(el), i * 120));
      statsObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
const statsSection = document.querySelector('.about-stats');
if (statsSection) statsObserver.observe(statsSection);

// ── 3D continuous float + mouse-tracking tilt on feature cards ────────────────
document.querySelectorAll('[data-tilt]').forEach(card => {
  let raf = null;

  card.addEventListener('mouseenter', () => {
    card.classList.add('is-hovered');
    card.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease';
  });

  card.addEventListener('mousemove', e => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
      card.style.transform = `perspective(900px) rotateX(${-dy * 12}deg) rotateY(${dx * 12}deg) scale3d(1.04,1.04,1.04)`;
      card.style.boxShadow = `${-dx * 18}px ${dy * 18}px 52px rgba(0,0,0,0.18), 0 8px 28px rgba(0,0,0,0.10)`;
    });
  });

  card.addEventListener('mouseleave', () => {
    if (raf) cancelAnimationFrame(raf);
    card.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s ease';
    card.style.transform  = '';
    card.style.boxShadow  = '';
    setTimeout(() => {
      card.style.transition = '';
      card.classList.remove('is-hovered');
    }, 550);
  });
});

initPageTransitions();
