import Chart from 'chart.js/auto';
import { supabase } from './supabase.js';

let investments      = [];
let currentUser       = null;
let editingId         = null;
let invPieChart       = null;
let growthChart       = null;
let channel           = null;
let invListExpanded   = false;

const LIST_PREVIEW_COUNT = 4;

const TYPE_ICONS  = { stock: '📊', etf: '📦', crypto: '₿', bond: '📜', cash: '💵' };
const TYPE_COLORS = { stock: '#3f6b52', etf: '#a9c2ac', crypto: '#a9723f', bond: '#d3b585', cash: '#f1e9dc' };
const TYPE_LABELS = { stock: 'Stocks', etf: 'ETFs', crypto: 'Crypto', bond: 'Bonds', cash: 'Cash' };
const TYPE_ORDER  = ['stock', 'etf', 'crypto', 'bond', 'cash'];

function formatCurrency(n) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + abs;
}

function formatPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Render: Portfolio Overview ----
function renderOverview() {
  const totalValue  = investments.reduce((s, inv) => s + (inv.currentPrice * inv.shares), 0);
  const totalCost   = investments.reduce((s, inv) => s + (inv.purchasePrice * inv.shares), 0);
  const totalGain   = totalValue - totalCost;
  const gainPct     = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  document.getElementById('inv-total-val').textContent = formatCurrency(totalValue);

  const subEl = document.getElementById('inv-portfolio-sub');
  if (!investments.length) {
    subEl.textContent = 'Start investing and watch your money grow.';
    subEl.className = 'inv-portfolio-sub';
  } else {
    const holdingsWord = `${investments.length} holding${investments.length !== 1 ? 's' : ''}`;
    subEl.innerHTML = `${holdingsWord} · <span class="${totalGain >= 0 ? 'positive' : 'negative'}">${formatPct(gainPct)} all time</span>`;
    subEl.className = 'inv-portfolio-sub inv-portfolio-sub--data';
  }
}

// ---- Render: Allocation Donut + Legend ----
function renderInvChart() {
  const canvas = document.getElementById('inv-pie-chart');
  const legend = document.getElementById('inv-legend');

  const totalsByType = {};
  TYPE_ORDER.forEach(t => { totalsByType[t] = 0; });
  investments.forEach(inv => {
    const t = TYPE_ORDER.includes(inv.type) ? inv.type : 'stock';
    totalsByType[t] += inv.currentPrice * inv.shares;
  });
  const total   = Object.values(totalsByType).reduce((s, v) => s + v, 0);
  const isEmpty = total <= 0;

  const allocSubEl = document.getElementById('inv-allocation-sub');
  allocSubEl.textContent = isEmpty
    ? 'Start building your portfolio to see your allocation here.'
    : `Here's how your ${investments.length} holding${investments.length !== 1 ? 's' : ''} break down by asset class.`;

  const chartLabels = isEmpty ? [''] : TYPE_ORDER.map(t => TYPE_LABELS[t]);
  const chartColors = isEmpty ? ['#e7e0d3'] : TYPE_ORDER.map(t => TYPE_COLORS[t]);
  const chartData   = isEmpty ? [1] : TYPE_ORDER.map(t => parseFloat(totalsByType[t].toFixed(2)));

  if (invPieChart) {
    invPieChart.data.labels = chartLabels;
    invPieChart.data.datasets[0].data = chartData;
    invPieChart.data.datasets[0].backgroundColor = chartColors;
    invPieChart.data.datasets[0].hoverOffset = isEmpty ? 0 : 8;
    invPieChart.options.plugins.tooltip.enabled = !isEmpty;
    invPieChart.isEmpty = isEmpty;
    invPieChart.portfolioTotal = total;
    invPieChart.update();
  } else {
    invPieChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors, borderColor: '#fffdf9', borderWidth: 3, borderRadius: 4, hoverOffset: isEmpty ? 0 : 8 }] },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !isEmpty,
            backgroundColor: 'rgba(26,14,6,0.9)', padding: 10, cornerRadius: 10,
            callbacks: { label: ctx => `  ${ctx.label}: ${formatCurrency(ctx.parsed)}` },
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
          ctx.save();
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (chart.isEmpty) {
            ctx.font = '700 14px Inter, sans-serif'; ctx.fillStyle = '#4a3a28';
            ctx.fillText('No investments', x, y - 22);
            ctx.fillText('yet', x, y - 6);
            ctx.font = '500 10.5px Inter, sans-serif'; ctx.fillStyle = '#957560';
            ctx.fillText('Add your first', x, y + 14);
            ctx.fillText('investment to get', x, y + 28);
            ctx.fillText('started.', x, y + 42);
          } else {
            ctx.font = '700 15px Inter, sans-serif'; ctx.fillStyle = '#1a0e06';
            ctx.fillText(formatCurrency(chart.portfolioTotal), x, y - 8);
            ctx.font = '500 10px Inter, sans-serif'; ctx.fillStyle = '#957560';
            ctx.fillText('portfolio', x, y + 9);
          }
          ctx.restore();
        },
      }],
    });
    invPieChart.isEmpty = isEmpty;
    invPieChart.portfolioTotal = total;
  }

  legend.innerHTML = TYPE_ORDER.map(t => {
    const value = totalsByType[t];
    const pct   = total > 0 ? Math.round((value / total) * 100) : 0;
    return `
      <div class="inv-legend-item">
        <span class="inv-legend-dot" style="background:${TYPE_COLORS[t]}"></span>
        <span class="inv-legend-name">${TYPE_LABELS[t]}</span>
        <span class="inv-legend-pct-val">${pct}%</span>
      </div>`;
  }).join('');
}

// ---- Render: Holdings List ----
function renderList() {
  const list        = document.getElementById('inv-list');
  const empty       = document.getElementById('inv-empty');
  const viewAllLink = document.getElementById('inv-view-all');

  if (!investments.length) {
    list.innerHTML = '';
    empty.style.display = '';
    viewAllLink.style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  const showAll     = invListExpanded || investments.length <= LIST_PREVIEW_COUNT;
  const itemsToShow = showAll ? investments : investments.slice(0, LIST_PREVIEW_COUNT);

  viewAllLink.style.display = investments.length > LIST_PREVIEW_COUNT ? '' : 'none';
  viewAllLink.innerHTML     = showAll ? 'Show less &lsaquo;' : 'View all &rsaquo;';

  list.innerHTML = itemsToShow.map(inv => {
    const value   = inv.currentPrice * inv.shares;
    const cost    = inv.purchasePrice * inv.shares;
    const gain    = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const typeIcon  = TYPE_ICONS[inv.type] || '💼';
    const typeColor = TYPE_COLORS[inv.type] || '#9a6e3a';
    return `
      <div class="inv-item">
        <div class="inv-item-icon" style="color:${typeColor}">${typeIcon}</div>
        <div class="inv-item-info">
          <span class="inv-item-name">${escapeHtml(inv.name)}</span>
          <span class="inv-item-meta">${inv.shares} units · cost ${formatCurrency(cost)}</span>
        </div>
        <div class="inv-item-right">
          <span class="inv-item-value">${formatCurrency(value)}</span>
          <span class="inv-item-gain ${gain >= 0 ? 'positive' : 'negative'}">${formatPct(gainPct)}</span>
        </div>
        <div class="tx-actions">
          <button class="tx-edit"   data-id="${inv.id}" title="Edit"   aria-label="Edit">✎</button>
          <button class="tx-delete" data-id="${inv.id}" title="Delete" aria-label="Delete">✕</button>
        </div>
      </div>`;
  }).join('');
}

function renderAll() {
  renderOverview();
  renderInvChart();
  renderList();
}

// ---- Form ----
function setFormMode(editing) {
  document.getElementById('inv-form-title').textContent = editing ? 'Edit Investment' : 'Add Investment';
  document.getElementById('inv-submit-btn').textContent = editing ? 'Save Changes' : 'Add Investment';
  document.getElementById('inv-cancel-btn').style.display = editing ? '' : 'none';
}

function clearForm() {
  document.getElementById('inv-form').reset();
  document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('inv-error').textContent = '';
  editingId = null;
  setFormMode(false);
}

function populateForm(inv) {
  document.getElementById('inv-name').value      = inv.name;
  document.getElementById('inv-type').value      = inv.type;
  document.getElementById('inv-shares').value    = inv.shares;
  document.getElementById('inv-buy-price').value = inv.purchasePrice;
  document.getElementById('inv-cur-price').value = inv.currentPrice;
  document.getElementById('inv-date').value      = inv.purchaseDate || '';
  editingId = inv.id;
  setFormMode(true);
  document.getElementById('inv-name').focus();
}

document.getElementById('inv-form').addEventListener('submit', async e => {
  e.preventDefault();
  const uid     = currentUser?.id;
  const errorEl = document.getElementById('inv-error');
  const btn     = document.getElementById('inv-submit-btn');
  errorEl.textContent = '';

  const name          = document.getElementById('inv-name').value.trim();
  const type          = document.getElementById('inv-type').value;
  const shares        = parseFloat(document.getElementById('inv-shares').value);
  const purchasePrice = parseFloat(document.getElementById('inv-buy-price').value);
  const currentPrice  = parseFloat(document.getElementById('inv-cur-price').value);
  const purchaseDate  = document.getElementById('inv-date').value;

  if (!name || isNaN(shares) || shares <= 0 || isNaN(purchasePrice) || purchasePrice <= 0 || isNaN(currentPrice) || currentPrice <= 0 || !purchaseDate) {
    errorEl.textContent = 'Please fill in all fields correctly.'; return;
  }

  btn.disabled = true;
  try {
    const data = {
      name, type, shares,
      purchase_price: purchasePrice,
      current_price:  currentPrice,
      purchase_date:  purchaseDate,
    };
    const { error } = editingId
      ? await supabase.from('investments').update(data).eq('id', editingId)
      : await supabase.from('investments').insert({ ...data, user_id: uid });
    if (error) throw error;
    clearForm();
  } catch (err) {
    errorEl.textContent = 'Failed to save. Please try again.';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('inv-cancel-btn').addEventListener('click', clearForm);

document.getElementById('inv-list').addEventListener('click', async e => {
  const editBtn   = e.target.closest('.tx-edit');
  const deleteBtn = e.target.closest('.tx-delete');
  if (editBtn) {
    const inv = investments.find(i => i.id === editBtn.dataset.id);
    if (inv) populateForm(inv);
  }
  if (deleteBtn) {
    if (!confirm('Delete this investment?')) return;
    try { await supabase.from('investments').delete().eq('id', deleteBtn.dataset.id); }
    catch {}
  }
});

document.getElementById('inv-view-all').addEventListener('click', e => {
  e.preventDefault();
  invListExpanded = !invListExpanded;
  renderList();
});

// ---- "Add Investment" CTAs: scroll to form & focus ----
function scrollToInvForm() {
  document.getElementById('inv-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('inv-name').focus(), 400);
}
document.getElementById('inv-add-cta-1').addEventListener('click', scrollToInvForm);
document.getElementById('inv-add-cta-2').addEventListener('click', scrollToInvForm);

// ---- "Learn to Invest" carousel ----
const LEARN_SLIDE_COUNT = 3;
let learnSlideIndex = 0;
let learnAutoTimer = null;

function goToLearnSlide(i) {
  learnSlideIndex = (i + LEARN_SLIDE_COUNT) % LEARN_SLIDE_COUNT;
  document.getElementById('learn-carousel-track').style.transform = `translateX(-${learnSlideIndex * (100 / LEARN_SLIDE_COUNT)}%)`;
  document.querySelectorAll('#learn-dots .learn-dot').forEach((dot, i2) => {
    dot.classList.toggle('active', i2 === learnSlideIndex);
  });
}

function startLearnAutoAdvance() {
  clearInterval(learnAutoTimer);
  learnAutoTimer = setInterval(() => goToLearnSlide(learnSlideIndex + 1), 10000);
}

function initLearnCarousel() {
  document.getElementById('learn-carousel-track').addEventListener('click', () => {
    goToLearnSlide(learnSlideIndex + 1);
    startLearnAutoAdvance();
  });
  document.querySelectorAll('#learn-dots .learn-dot').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      goToLearnSlide(Number(dot.dataset.slide));
      startLearnAutoAdvance();
    });
  });
  document.getElementById('learn-see-all').addEventListener('click', e => {
    e.preventDefault();
    goToLearnSlide(0);
    startLearnAutoAdvance();
  });
  startLearnAutoAdvance();
}

// ---- "See How Money Can Grow" calculator ----
function computeGrowthSeries(monthly, years, annualRatePct = 7) {
  const months      = years * 12;
  const monthlyRate = annualRatePct / 100 / 12;
  const contributionsSeries = [];
  const valueSeries = [];
  let balance = 0;
  for (let m = 0; m <= months; m++) {
    if (m > 0) balance = balance * (1 + monthlyRate) + monthly;
    contributionsSeries.push(monthly * m);
    valueSeries.push(balance);
  }
  return { contributionsSeries, valueSeries };
}

function drawEndPill(ctx, cx, cy, text, bg, fg, borderColor, maxX) {
  ctx.save();
  ctx.font = '700 11px Inter, sans-serif';
  const paddingX = 8, h = 22;
  const w = ctx.measureText(text).width + paddingX * 2;
  const x = Math.min(cx - w / 2, maxX - w - 2);
  const y = cy - h / 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  ctx.fillStyle = bg;
  ctx.fill();
  if (borderColor) { ctx.lineWidth = 1.5; ctx.strokeStyle = borderColor; ctx.stroke(); }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function renderGrowthCalc() {
  const monthly = parseFloat(document.getElementById('growth-monthly').value);
  const years   = parseInt(document.getElementById('growth-years').value, 10);
  const { contributionsSeries, valueSeries } = computeGrowthSeries(monthly, years);

  const totalContrib = contributionsSeries[contributionsSeries.length - 1];
  const totalValue   = valueSeries[valueSeries.length - 1];

  document.getElementById('growth-contrib-val').textContent  = formatCurrency(totalContrib);
  document.getElementById('growth-estimate-val').textContent = formatCurrency(totalValue);

  const labels = valueSeries.map((_, i) => i);
  const ctx    = document.getElementById('growth-chart').getContext('2d');

  if (growthChart) {
    growthChart.data.labels = labels;
    growthChart.data.datasets[0].data = valueSeries;
    growthChart.data.datasets[1].data = contributionsSeries;
    growthChart.options.plugins.endLabels.valueLabel   = formatCurrency(totalValue);
    growthChart.options.plugins.endLabels.contribLabel = formatCurrency(totalContrib);
    growthChart.update();
    return;
  }

  growthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Estimated value', data: valueSeries,
          borderColor: '#2d7a3a', backgroundColor: 'rgba(45,122,58,0.12)',
          fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5,
        },
        {
          label: 'Contributions', data: contributionsSeries,
          borderColor: '#c9a86a', backgroundColor: 'transparent',
          fill: false, tension: 0, pointRadius: 0, borderWidth: 2, borderDash: [5, 4],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 28, right: 8, bottom: 8, left: 2 } },
      interaction: { intersect: false, mode: 'index' },
      scales: { x: { display: false }, y: { display: false } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,14,6,0.9)', padding: 10, cornerRadius: 10,
          callbacks: {
            title: () => '',
            label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}`,
          },
        },
        endLabels: { valueLabel: formatCurrency(totalValue), contribLabel: formatCurrency(totalContrib) },
      },
    },
    plugins: [{
      id: 'endLabels',
      afterDatasetsDraw(chart, args, opts) {
        const { ctx } = chart;
        const valueMeta   = chart.getDatasetMeta(0);
        const contribMeta = chart.getDatasetMeta(1);
        const lastValuePt   = valueMeta.data[valueMeta.data.length - 1];
        const lastContribPt = contribMeta.data[contribMeta.data.length - 1];
        if (!lastValuePt || !lastContribPt) return;
        const maxX = chart.chartArea.right + 40;
        drawEndPill(ctx, lastValuePt.x, lastValuePt.y - 20, opts.valueLabel, '#2d7a3a', '#fff', null, maxX);
        drawEndPill(ctx, lastContribPt.x, lastContribPt.y + 20, opts.contribLabel, '#fff', '#7a5228', '#d8b979', maxX);
      },
    }],
  });
}

function initGrowthCalc() {
  document.getElementById('growth-monthly').addEventListener('change', renderGrowthCalc);
  document.getElementById('growth-years').addEventListener('change', renderGrowthCalc);
  renderGrowthCalc();
}

// ---- Data ----
async function fetchInvestments(uid) {
  const { data, error } = await supabase.from('investments').select('*').eq('user_id', uid);
  if (error) { console.error('Investments fetch error:', error); return; }
  investments = (data || []).map(row => ({
    id:            row.id,
    name:          row.name,
    type:          row.type,
    shares:        Number(row.shares),
    purchasePrice: Number(row.purchase_price),
    currentPrice:  Number(row.current_price),
    purchaseDate:  row.purchase_date,
  }));
  renderAll();
}

// ---- Auth & Init ----
let staticSectionsInited = false;

supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if (!user) return;

  currentUser = user;
  document.getElementById('app-content').style.display = '';
  document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];

  if (!staticSectionsInited) {
    staticSectionsInited = true;
    initLearnCarousel();
    initGrowthCalc();
  }

  if (channel) { supabase.removeChannel(channel); channel = null; }
  channel = supabase
    .channel(`investments-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'investments', filter: `user_id=eq.${user.id}` },
      () => fetchInvestments(user.id))
    .subscribe();
  fetchInvestments(user.id);
});
