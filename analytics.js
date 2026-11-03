import { initNav } from './nav.js';
import Chart from 'chart.js/auto';
import { supabase } from './supabase.js';
import { loadAndApplyAvatar } from './avatarUtils.js';

let channel = null;

const CATEGORY_LABELS = {
  paycheck:'Paycheck',salary:'Salary',freelance:'Freelance',bonuses:'Bonuses',
  stocks:'Stocks',gift:'Gift',benefits:'Gov. Benefits',retirement:'Retirement',
  housing:'Housing / Rent',mortgage:'Mortgage',utilities:'Utilities',
  groceries:'Groceries',dining:'Dining Out',fooddelivery:'Food Delivery',
  transport:'Transportation',gas:'Gas / Fuel',gascharging:'Gas / Charging',
  carpayment:'Car Payment',carinsurance:'Car Insurance',healthins:'Health Insurance',
  medical:'Medical',phone:'Phone Bill',internet:'Internet',subscriptions:'Subscriptions',
  childcare:'Childcare',education:'Education',creditcards:'Credit Cards',
  personalcare:'Personal Care',clothing:'Clothing',shopping:'Shopping',
  onlineshopping:'Online Shopping',entertainment:'Entertainment',
  bills:'Bills',health:'Health',other:'Other',
};

const CATEGORY_ICONS = {
  paycheck:'💵',salary:'💼',freelance:'💻',bonuses:'🎁',stocks:'📈',gift:'🎀',
  benefits:'🏛️',retirement:'🏖️',housing:'🏠',mortgage:'🏦',utilities:'⚡',
  groceries:'🛒',dining:'🍽️',fooddelivery:'🛵',transport:'🚌',gas:'⛽',
  gascharging:'⛽',carpayment:'🚗',carinsurance:'🛡️',healthins:'❤️',medical:'💊',
  phone:'📱',internet:'🌐',subscriptions:'📺',childcare:'👶',education:'🎓',
  creditcards:'💳',personalcare:'💆',clothing:'👕',shopping:'🛍️',
  onlineshopping:'📦',entertainment:'🎬',bills:'📋',health:'🏥',other:'📌',
};

const CATEGORY_COLORS = {
  housing:'#c49060',mortgage:'#a87448',utilities:'#9a9860',groceries:'#c4a46b',
  dining:'#d4b888',fooddelivery:'#e0a878',transport:'#a07848',gas:'#c48448',
  gascharging:'#c48448',carpayment:'#8090b0',carinsurance:'#7080a8',
  healthins:'#70a880',medical:'#8faa7c',phone:'#9888c8',internet:'#7898c8',
  subscriptions:'#a878c0',childcare:'#c878a0',education:'#a0a068',
  creditcards:'#c07068',personalcare:'#c888a0',clothing:'#68a898',
  shopping:'#9878c0',onlineshopping:'#8068b0',entertainment:'#b07498',
  bills:'#7c5c34',health:'#8faa7c',other:'#9aa0ac',
};

let transactions = [];
let trendChartInstance = null;
let trendPeriodMonths = 'all';

function formatCurrency(n) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + abs;
}

function formatCurrencyShort(n) {
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  return (n < 0 ? '-$' : '$') + abs;
}

// Draws a rounded callout bubble with a pointer tail above a chart point
function drawTrendCallout(ctx, x, y, text) {
  ctx.save();
  ctx.font = '700 14px Inter, sans-serif';
  const paddingX = 13, bubbleH = 32, tailH = 6, gap = 14;
  const textWidth = ctx.measureText(text).width;
  const bubbleW = textWidth + paddingX * 2;
  const bubbleBottom = y - gap;
  const bubbleTop = bubbleBottom - bubbleH;
  const bubbleX = x - bubbleW / 2;
  const r = bubbleH / 2;

  ctx.shadowColor = 'rgba(122,82,40,0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fdf4e4';

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
  ctx.fillStyle = '#3a2410';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, bubbleTop + bubbleH / 2);
  ctx.restore();
}

const trendCalloutPlugin = {
  id: 'trendCallouts',
  afterDatasetsDraw(chart) {
    const data = chart.data.datasets[0]?.data;
    if (!data || !data.length) return;
    const meta = chart.getDatasetMeta(0);
    let maxIdx = 0;
    data.forEach((v, i) => { if (v > data[maxIdx]) maxIdx = i; });
    const lastIdx = data.length - 1;
    const idxs = maxIdx === lastIdx ? [maxIdx] : [maxIdx, lastIdx];
    idxs.forEach(i => {
      const point = meta.data[i];
      if (!point) return;
      drawTrendCallout(chart.ctx, point.x, point.y, formatCurrencyShort(data[i]));
    });
  },
};

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ---- Top 5 Categories ----
function renderTopCategories() {
  const barsEl = document.getElementById('top-cat-bars');
  const emptyEl = document.getElementById('top-cat-empty');
  const periodEl = document.getElementById('top-cat-period');

  const totals = {};
  transactions.filter(tx => tx.type === 'expense').forEach(tx => {
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (!sorted.length) {
    barsEl.innerHTML = '';
    emptyEl.style.display = '';
    periodEl.textContent = '';
    return;
  }

  emptyEl.style.display = 'none';
  periodEl.textContent = 'all time';
  const maxVal = sorted[0][1];

  barsEl.innerHTML = sorted.map(([cat, amount], i) => {
    const pct   = Math.round((amount / sorted.reduce((s,[,v])=>s+v,0)) * 100);
    const barW  = ((amount / maxVal) * 100).toFixed(1);
    const color = CATEGORY_COLORS[cat] || '#a07848';
    const label = CATEGORY_LABELS[cat] || cat;
    const icon  = CATEGORY_ICONS[cat]  || '📌';
    return `
      <div class="top-cat-row" style="--i:${i}">
        <div class="top-cat-label">
          <span class="top-cat-icon">${icon}</span>
          <span class="top-cat-name">${label}</span>
          <span class="top-cat-pct">${pct}%</span>
        </div>
        <div class="top-cat-track">
          <div class="top-cat-fill" data-w="${barW}%" style="background:${color}"></div>
        </div>
        <span class="top-cat-amount">${formatCurrency(amount)}</span>
      </div>`;
  }).join('');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    barsEl.querySelectorAll('.top-cat-fill').forEach(el => { el.style.width = el.dataset.w; });
  }));
}

// ---- Monthly Trend Chart ----
function renderTrendChart() {
  const canvas = document.getElementById('trend-chart');

  const monthMap = {};
  transactions.filter(tx => tx.type === 'expense').forEach(tx => {
    const m = tx.date.substring(0, 7);
    monthMap[m] = (monthMap[m] || 0) + tx.amount;
  });

  let months = Object.keys(monthMap).sort();
  if (months.length < 2) {
    canvas.closest('.app-card').style.display = 'none';
    return;
  }
  canvas.closest('.app-card').style.display = '';

  if (trendPeriodMonths !== 'all') {
    months = months.slice(-trendPeriodMonths);
  }

  const labels = months.map(monthLabel);
  const data   = months.map(m => parseFloat(monthMap[m].toFixed(2)));

  const trendGradient = (context) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return 'rgba(224,154,58,0.3)';
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(224,154,58,0.55)');
    gradient.addColorStop(1, 'rgba(224,154,58,0.02)');
    return gradient;
  };

  const highlightIdxs = () => {
    let maxIdx = 0;
    data.forEach((v, i) => { if (v > data[maxIdx]) maxIdx = i; });
    const lastIdx = data.length - 1;
    return new Set(maxIdx === lastIdx ? [maxIdx] : [maxIdx, lastIdx]);
  };

  if (trendChartInstance) {
    const idxs = highlightIdxs();
    trendChartInstance.data.labels = labels;
    trendChartInstance.data.datasets[0].data = data;
    trendChartInstance.data.datasets[0].pointRadius = data.map((_, i) => idxs.has(i) ? 6 : 0);
    trendChartInstance.data.datasets[0].pointHoverRadius = data.map((_, i) => idxs.has(i) ? 6 : 4);
    trendChartInstance.update();
    return;
  }

  const idxs = highlightIdxs();

  trendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Monthly Expenses',
        data,
        fill: true,
        tension: 0.4,
        borderColor: '#c8943a',
        borderWidth: 3,
        backgroundColor: trendGradient,
        pointRadius: data.map((_, i) => idxs.has(i) ? 6 : 0),
        pointHoverRadius: data.map((_, i) => idxs.has(i) ? 6 : 4),
        pointBackgroundColor: '#e0a030',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 46, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,14,6,0.9)',
          padding: 10,
          cornerRadius: 10,
          callbacks: { label: ctx => `  ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { ticks: { font: { size: 12, weight: '600' }, color: '#5c4328' }, grid: { display: false } },
        y: { ticks: { font: { size: 11 }, color: '#9a7a5a', callback: v => '$'+v }, beginAtZero: true,
             grid: { color: 'rgba(200,148,58,0.1)' } },
      },
    },
    plugins: [trendCalloutPlugin],
  });
}

function setTrendPeriod(value, label) {
  trendPeriodMonths = value === 'all' ? 'all' : parseInt(value, 10);
  document.getElementById('trend-period-label').textContent = label;
  document.querySelectorAll('.trend-period-item').forEach(el => {
    el.classList.toggle('active', el.dataset.months === value);
  });
  renderTrendChart();
}

document.getElementById('trend-period-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('trend-period-menu').classList.toggle('open');
});
document.getElementById('trend-period-dropdown').addEventListener('click', e => {
  const item = e.target.closest('.trend-period-item');
  if (!item) return;
  document.getElementById('trend-period-menu').classList.remove('open');
  setTrendPeriod(item.dataset.months, item.textContent);
});
document.addEventListener('click', () => {
  document.getElementById('trend-period-menu')?.classList.remove('open');
});

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function fetchTransactions(uid) {
  const { data, error } = await supabase.from('transactions').select('*').eq('user_id', uid);
  if (error) { console.error('transactions fetch error:', error); return; }
  transactions = (data || []).map(row => ({
    id:          row.id,
    type:        row.type,
    description: row.description,
    amount:      Number(row.amount),
    category:    row.category,
    date:        row.date,
    location:    row.location || null,
  }));
  renderTopCategories();
  renderTrendChart();
}

// ---- Auth & Init ----
supabase.auth.onAuthStateChange((event, session) => {
  document.getElementById('auth-loading').style.display = 'none';
  const user = session?.user;
  if (!user) { window.location.replace('./index.html'); return; }

  document.getElementById('app-content').style.display = '';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('user-email').textContent = user.user_metadata?.full_name || user.email.split('@')[0];

  document.getElementById('signout-btn').addEventListener('click', () => supabase.auth.signOut());

  if (channel) { supabase.removeChannel(channel); channel = null; }
  channel = supabase
    .channel(`analytics-transactions-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
      () => fetchTransactions(user.id))
    .subscribe();
  fetchTransactions(user.id);
});

window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });
initNav();
