// ============================================================
// BudgetCore — networth.js
// Net Worth Tracker + Debt Payoff Planner
// ============================================================

import { supabase } from './supabase.js';
import Chart from 'chart.js/auto';

const ASSET_TYPES = {
  cash:         { label: 'Cash / Checking',     icon: '💵', isLiability: false },
  savings:      { label: 'Savings Account',      icon: '🏦', isLiability: false },
  investment:   { label: 'Investment',           icon: '📈', isLiability: false },
  realestate:   { label: 'Real Estate',          icon: '🏠', isLiability: false },
  vehicle:      { label: 'Vehicle',              icon: '🚗', isLiability: false },
  crypto:       { label: 'Crypto',               icon: '₿',  isLiability: false },
  other_asset:  { label: 'Other Asset',          icon: '📦', isLiability: false },
  creditcard_debt: { label: 'Credit Card Debt',  icon: '💳', isLiability: true },
  student_loan:    { label: 'Student Loan',      icon: '🎓', isLiability: true },
  car_loan:        { label: 'Car Loan',          icon: '🚗', isLiability: true },
  mortgage_debt:   { label: 'Mortgage',          icon: '🏡', isLiability: true },
  personal_loan:   { label: 'Personal Loan',     icon: '🤝', isLiability: true },
  medical_debt:    { label: 'Medical Debt',      icon: '💊', isLiability: true },
  other_liability: { label: 'Other Liability',   icon: '📋', isLiability: true },
};

const fmt = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let items       = [];
let editingId   = null;
let channel     = null;
let currentUser = null;
let trendChart  = null;
let activePeriod = '1M';
const PERIOD_DAYS = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'All': null };

// --- Auth ---
supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if (!user) return;

  currentUser = user;
  document.getElementById('app-content').style.display = '';
  subscribeItems(user.id);
});

function subscribeItems(uid) {
  if (channel) { supabase.removeChannel(channel); channel = null; }
  channel = supabase
    .channel(`networth-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'networth', filter: `user_id=eq.${uid}` },
      () => fetchItems(uid))
    .subscribe();
  fetchItems(uid);
}

async function fetchItems(uid) {
  const { data, error } = await supabase.from('networth').select('*').eq('user_id', uid);
  if (error) { console.error('networth sync error:', error); return; }
  items = (data || []).map(row => ({
    id:             row.id,
    name:           row.name,
    type:           row.type,
    value:          Number(row.value),
    interestRate:   Number(row.interest_rate || 0),
    monthlyPayment: Number(row.monthly_payment || 0),
    createdAt:      row.created_at,
  }));
  renderAll();
}

// --- Net worth history (reconstructed from item creation dates) ---
function buildHistory() {
  if (!items.length) return [];
  const sorted = [...items]
    .filter(i => i.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!sorted.length) return [];

  const points = [{ date: new Date(sorted[0].createdAt), value: 0 }];
  let running = 0;
  sorted.forEach(i => {
    running += ASSET_TYPES[i.type]?.isLiability ? -i.value : i.value;
    points.push({ date: new Date(i.createdAt), value: running });
  });
  const today = new Date();
  if (points[points.length - 1].date < today) points.push({ date: today, value: running });
  return points;
}

function filterHistory(points, periodDays) {
  if (periodDays === null || !points.length) return points;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  let valueAtCutoff = points[0].value;
  const within = [];
  for (const p of points) {
    if (p.date <= cutoff) valueAtCutoff = p.value;
    else within.push(p);
  }
  return [{ date: cutoff, value: valueAtCutoff }, ...within];
}

function dateLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Render ---
function renderAll() {
  const assets      = items.filter(i => !ASSET_TYPES[i.type]?.isLiability);
  const liabilities = items.filter(i =>  ASSET_TYPES[i.type]?.isLiability);

  const totalAssets = assets.reduce((s, i) => s + (i.value || 0), 0);
  const totalLiab   = liabilities.reduce((s, i) => s + (i.value || 0), 0);
  const netWorth    = totalAssets - totalLiab;

  document.getElementById('nw-assets-val').textContent  = fmt(totalAssets);
  document.getElementById('nw-assets-sub').textContent  = `${assets.length} asset${assets.length !== 1 ? 's' : ''}`;
  document.getElementById('nw-liab-val').textContent    = fmt(totalLiab);
  document.getElementById('nw-liab-sub').textContent    = `${liabilities.length} liabilit${liabilities.length !== 1 ? 'ies' : 'y'}`;
  document.getElementById('nw-total-val').textContent   = fmt(Math.abs(netWorth));

  const nwCard = document.getElementById('nw-card');
  nwCard.classList.toggle('is-positive', netWorth >= 0);
  nwCard.classList.toggle('is-negative', netWorth < 0);
  document.getElementById('nw-total-val').classList.toggle('positive', netWorth >= 0);
  document.getElementById('nw-total-val').classList.toggle('negative', netWorth < 0);

  renderList('nw-assets-section', 'nw-assets-list', 'nw-assets-count', assets, false);
  renderList('nw-liab-section', 'nw-liab-list', 'nw-liab-count', liabilities, true);
  renderDebtPlanner(liabilities);
  renderHero(netWorth);
  renderTrendChart();

  document.getElementById('nw-empty').style.display = items.length === 0 ? '' : 'none';
}

// --- Render: Hero card (big value + change badge) ---
function renderHero(netWorth) {
  document.getElementById('nw-hero-value').textContent = fmt(netWorth);

  const history = buildHistory();
  const changeEl = document.getElementById('nw-hero-change');
  const changeTextEl = document.getElementById('nw-hero-change-text');

  let delta = 0, pct = 0;
  if (history.length) {
    const monthAgo = filterHistory(history, 30);
    const startVal = monthAgo[0]?.value ?? 0;
    delta = netWorth - startVal;
    pct = startVal !== 0 ? (delta / Math.abs(startVal)) * 100 : (delta !== 0 ? 100 : 0);
  }
  const sign = delta >= 0 ? '+' : '−';
  changeTextEl.textContent = `${sign} ${fmt(Math.abs(delta))} (${Math.abs(pct).toFixed(0)}%)`;
  changeEl.classList.toggle('is-negative', delta < 0);
}

// --- Render: Net Worth Over Time chart ---
function renderTrendChart() {
  const empty = document.getElementById('nw-trend-empty');
  const canvas = document.getElementById('nw-trend-chart');
  const ctx = canvas.getContext('2d');

  const fullHistory = buildHistory();
  const hasData = fullHistory.length > 0;
  empty.style.display = hasData ? 'none' : '';

  const periodDays = PERIOD_DAYS[activePeriod];
  const points = hasData ? filterHistory(fullHistory, periodDays) : [];

  const labels = hasData ? points.map(p => dateLabel(p.date)) : ['', '', '', '', ''];
  const data   = hasData ? points.map(p => p.value) : [0, 0, 0, 0, 0];

  const yOpts = hasData
    ? { beginAtZero: false, ticks: { font: { size: 11 }, color: '#9a7a5a', callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(200,148,58,0.08)' } }
    : { min: -1000, max: 1000, ticks: { stepSize: 500, font: { size: 11 }, color: '#9a7a5a', callback: v => (v > 0 ? '$' + v.toLocaleString() : (v < 0 ? '-$' + Math.abs(v).toLocaleString() : '$0')) }, grid: { color: 'rgba(200,148,58,0.08)' } };

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = data;
    trendChart.data.datasets[0].borderColor = hasData ? '#9a6e3a' : 'rgba(0,0,0,0)';
    trendChart.data.datasets[0].backgroundColor = hasData ? 'rgba(154,110,58,0.12)' : 'rgba(0,0,0,0)';
    trendChart.options.scales.y = yOpts;
    trendChart.update();
    return;
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: hasData ? '#9a6e3a' : 'rgba(0,0,0,0)',
        backgroundColor: hasData ? 'rgba(154,110,58,0.12)' : 'rgba(0,0,0,0)',
        fill: true,
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: hasData ? 2 : 0,
        pointBackgroundColor: '#9a6e3a',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,14,6,0.9)', padding: 10, cornerRadius: 10,
          callbacks: { label: c => `  ${fmt(c.parsed.y)}` },
        },
      },
      scales: {
        x: { ticks: { font: { size: 11 }, color: '#9a7a5a' }, grid: { display: false } },
        y: yOpts,
      },
    },
  });
}

document.getElementById('nw-period-row').addEventListener('click', e => {
  const btn = e.target.closest('.nw-period-btn');
  if (!btn) return;
  activePeriod = btn.dataset.period;
  document.querySelectorAll('.nw-period-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderTrendChart();
});

function renderList(sectionId, listId, countId, list, isLiab) {
  const section = document.getElementById(sectionId);
  const listEl  = document.getElementById(listId);
  const countEl = document.getElementById(countId);

  if (!list.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  countEl.textContent = `${list.length} item${list.length !== 1 ? 's' : ''}`;

  listEl.innerHTML = list
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .map(item => {
      const meta = ASSET_TYPES[item.type] || { label: item.type, icon: '📌' };
      const interestStr = item.interestRate > 0 ? `<span class="nw-item-rate">${item.interestRate}% APR</span>` : '';
      const paymentStr  = item.monthlyPayment > 0 ? `<span class="nw-item-rate">${fmt(item.monthlyPayment)}/mo</span>` : '';
      return `
        <div class="nw-item">
          <span class="nw-item-icon">${meta.icon}</span>
          <div class="nw-item-info">
            <span class="nw-item-name">${escHtml(item.name)}</span>
            <span class="nw-item-type">${meta.label} ${interestStr} ${paymentStr}</span>
          </div>
          <span class="nw-item-value ${isLiab ? 'negative' : 'positive'}">${fmt(item.value || 0)}</span>
          <div class="tx-actions">
            <button class="tx-edit"   data-id="${item.id}" title="Edit">✎</button>
            <button class="tx-delete" data-id="${item.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    }).join('');
}

function renderDebtPlanner(liabilities) {
  const section = document.getElementById('debt-planner-section');
  const debts   = liabilities.filter(i => i.value > 0 && i.monthlyPayment > 0);
  if (!debts.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Avalanche: sort by highest interest rate first
  const sorted = [...debts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));

  document.getElementById('debt-planner-list').innerHTML = sorted.map(debt => {
    const apr     = (debt.interestRate || 0) / 100 / 12;
    const balance = debt.value;
    const payment = debt.monthlyPayment;

    let months = 0;
    let totalInterest = 0;
    if (apr > 0 && payment > balance * apr) {
      // Standard amortization formula
      months = Math.ceil(Math.log(payment / (payment - balance * apr)) / Math.log(1 + apr));
      totalInterest = payment * months - balance;
    } else if (apr === 0 && payment > 0) {
      months = Math.ceil(balance / payment);
    } else {
      months = null;
    }

    const icon = ASSET_TYPES[debt.type]?.icon || '📋';
    const payoffStr = months
      ? `${months >= 12 ? Math.floor(months / 12) + 'y ' : ''}${months % 12}mo`
      : 'Payment too low';
    const intStr = totalInterest > 0 ? `${fmt(totalInterest)} total interest` : '';

    return `
      <div class="debt-plan-item">
        <div class="debt-plan-icon">${icon}</div>
        <div class="debt-plan-info">
          <span class="debt-plan-name">${escHtml(debt.name)}</span>
          <span class="debt-plan-meta">${fmt(balance)} at ${debt.interestRate || 0}% APR · ${fmt(payment)}/mo</span>
        </div>
        <div class="debt-plan-result">
          <span class="debt-plan-time">${payoffStr}</span>
          ${intStr ? `<span class="debt-plan-interest">${intStr}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Form ---
document.getElementById('nw-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('nw-error');
  errEl.textContent = '';

  const name    = document.getElementById('nw-name').value.trim();
  const type    = document.getElementById('nw-type').value;
  const value   = parseFloat(document.getElementById('nw-value').value);
  const interest = parseFloat(document.getElementById('nw-interest').value) || 0;
  const payment  = parseFloat(document.getElementById('nw-payment').value)  || 0;

  if (!name)          { errEl.textContent = 'Name is required.'; return; }
  if (isNaN(value) || value < 0) { errEl.textContent = 'Enter a valid value.'; return; }

  const uid = currentUser?.id;
  if (!uid) return;

  const payload = { name, type, value, interest_rate: interest, monthly_payment: payment };

  try {
    const { error } = editingId
      ? await supabase.from('networth').update(payload).eq('id', editingId)
      : await supabase.from('networth').insert({ ...payload, user_id: uid });
    if (error) throw error;
    if (editingId) cancelEdit();
    resetForm();
  } catch (err) {
    errEl.textContent = 'Failed to save. Please try again.';
    console.error(err);
  }
});

function resetForm() {
  document.getElementById('nw-name').value    = '';
  document.getElementById('nw-value').value   = '';
  document.getElementById('nw-interest').value = '';
  document.getElementById('nw-payment').value  = '';
  document.getElementById('nw-error').textContent = '';
}

function cancelEdit() {
  editingId = null;
  document.getElementById('nw-form-title').textContent = 'Add Item';
  document.getElementById('nw-submit-btn').textContent = 'Add Item';
  document.getElementById('nw-cancel-btn').style.display = 'none';
  resetForm();
}

document.getElementById('nw-cancel-btn').addEventListener('click', cancelEdit);

// Delegate edit/delete clicks
['nw-assets-list', 'nw-liab-list'].forEach(listId => {
  document.getElementById(listId).addEventListener('click', async e => {
    const editBtn   = e.target.closest('.tx-edit');
    const deleteBtn = e.target.closest('.tx-delete');
    const uid       = currentUser?.id;
    if (!uid) return;

    if (editBtn) {
      const id   = editBtn.dataset.id;
      const item = items.find(i => i.id === id);
      if (!item) return;
      editingId = id;
      document.getElementById('nw-name').value     = item.name;
      document.getElementById('nw-type').value     = item.type;
      document.getElementById('nw-value').value    = item.value;
      document.getElementById('nw-interest').value = item.interestRate || '';
      document.getElementById('nw-payment').value  = item.monthlyPayment || '';
      document.getElementById('nw-form-title').textContent = 'Edit Item';
      document.getElementById('nw-submit-btn').textContent = 'Save Changes';
      document.getElementById('nw-cancel-btn').style.display = 'inline-block';
      document.getElementById('nw-name').focus();
      document.getElementById('nw-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (deleteBtn) {
      if (!confirm('Delete this item?')) return;
      await supabase.from('networth').delete().eq('id', deleteBtn.dataset.id);
    }
  });
});

// Clear buttons
document.querySelectorAll('.input-clear-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (target) { target.value = ''; target.focus(); }
  });
});
