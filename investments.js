import Chart from 'chart.js/auto';
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';

let investments   = [];
let currentUser   = null;
let editingId     = null;
let invPieChart   = null;

const TYPE_ICONS  = { crypto: '₿', stock: '📊', etf: '📦', other: '💼' };
const TYPE_COLORS = { crypto: '#f7931a', stock: '#2d7a3a', etf: '#1a6ea8', other: '#9a6e3a' };

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

// ---- Render: Overview Cards ----
function renderOverview() {
  const totalValue  = investments.reduce((s, inv) => s + (inv.currentPrice * inv.shares), 0);
  const totalCost   = investments.reduce((s, inv) => s + (inv.purchasePrice * inv.shares), 0);
  const totalGain   = totalValue - totalCost;
  const gainPct     = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  document.getElementById('inv-total-val').textContent  = formatCurrency(totalValue);
  document.getElementById('inv-total-sub').textContent  = `${investments.length} holding${investments.length !== 1 ? 's' : ''}`;
  document.getElementById('inv-gain-val').textContent   = formatCurrency(totalGain);
  document.getElementById('inv-gain-pct').textContent   = formatPct(gainPct);
  document.getElementById('inv-cost-val').textContent   = formatCurrency(totalCost);

  const gainEl   = document.getElementById('inv-gain-val');
  gainEl.className = 'stat-value ' + (totalGain >= 0 ? 'positive' : 'negative');
}

// ---- Render: Pie Chart ----
function renderInvChart() {
  const card   = document.getElementById('inv-chart-card');
  const canvas = document.getElementById('inv-pie-chart');
  const legend = document.getElementById('inv-legend');

  if (!investments.length) {
    card.style.display = 'none';
    if (invPieChart) { invPieChart.destroy(); invPieChart = null; }
    return;
  }
  card.style.display = '';

  const labels = investments.map(i => i.name);
  const data   = investments.map(i => parseFloat((i.currentPrice * i.shares).toFixed(2)));
  const colors = investments.map(i => TYPE_COLORS[i.type] || '#9a6e3a');
  const total  = data.reduce((s, v) => s + v, 0);

  if (invPieChart) {
    invPieChart.data.labels = labels;
    invPieChart.data.datasets[0].data = data;
    invPieChart.data.datasets[0].backgroundColor = colors;
    invPieChart.update();
  } else {
    invPieChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fffdf9', borderWidth: 3, borderRadius: 4, hoverOffset: 8 }] },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
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
          ctx.font = '700 15px Inter, sans-serif'; ctx.fillStyle = '#1a0e06';
          ctx.fillText(formatCurrency(total), x, y - 8);
          ctx.font = '500 10px Inter, sans-serif'; ctx.fillStyle = '#957560';
          ctx.fillText('portfolio', x, y + 9);
          ctx.restore();
        },
      }],
    });
  }

  legend.innerHTML = investments.map((inv, i) => {
    const value   = inv.currentPrice * inv.shares;
    const cost    = inv.purchasePrice * inv.shares;
    const gain    = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const pct     = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    return `
      <div class="inv-legend-item">
        <span class="inv-legend-dot" style="background:${colors[i]}"></span>
        <div class="inv-legend-info">
          <span class="inv-legend-name">${escapeHtml(inv.name)}</span>
          <span class="inv-legend-val">${formatCurrency(value)} <span class="inv-legend-pct">${pct}%</span></span>
        </div>
        <span class="inv-gain-badge ${gain >= 0 ? 'inv-gain-badge--up' : 'inv-gain-badge--down'}">${formatPct(gainPct)}</span>
      </div>`;
  }).join('');
}

// ---- Render: Holdings List ----
function renderList() {
  const list    = document.getElementById('inv-list');
  const empty   = document.getElementById('inv-empty');
  const counter = document.getElementById('inv-count');

  counter.textContent = `${investments.length} holding${investments.length !== 1 ? 's' : ''}`;

  if (!investments.length) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = investments.map(inv => {
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
  const uid     = currentUser?.uid;
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
    const data = { name, type, shares, purchasePrice, currentPrice, purchaseDate, userId: uid };
    if (editingId) {
      await updateDoc(doc(db, 'users', uid, 'investments', editingId), data);
    } else {
      await addDoc(collection(db, 'users', uid, 'investments'), { ...data, createdAt: serverTimestamp() });
    }
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
    try { await deleteDoc(doc(db, 'users', currentUser.uid, 'investments', deleteBtn.dataset.id)); }
    catch {}
  }
});

// ---- Auth & Init ----
function setWelcomeBar(user) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  document.getElementById('welcome-date').textContent  = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  document.getElementById('welcome-email').textContent = user.email;
}

onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  currentUser = user;
  document.getElementById('app-content').style.display = '';
  document.getElementById('nav-user').style.display    = 'flex';
  document.getElementById('user-email').textContent    = user.displayName || user.email.split('@')[0];
  setWelcomeBar(user);

  document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

  onSnapshot(collection(db, 'users', user.uid, 'investments'), snap => {
    investments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
});

window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });
