import Chart from 'chart.js/auto';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { loadAndApplyAvatar } from './avatarUtils.js';

// Fix Leaflet default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
let map = null;
let trendChartInstance = null;
const geocodeCache = {};

function formatCurrency(n) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + abs;
}

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

  const months = Object.keys(monthMap).sort();
  if (months.length < 2) {
    canvas.closest('.app-card').style.display = 'none';
    return;
  }
  canvas.closest('.app-card').style.display = '';

  const labels = months.map(monthLabel);
  const data   = months.map(m => parseFloat(monthMap[m].toFixed(2)));

  if (trendChartInstance) {
    trendChartInstance.data.labels = labels;
    trendChartInstance.data.datasets[0].data = data;
    trendChartInstance.update();
    return;
  }

  trendChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Monthly Expenses',
        data,
        backgroundColor: 'rgba(200,148,58,0.75)',
        borderColor: '#c8943a',
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
        x: { ticks: { font: { size: 11 }, color: '#9a7a5a' }, grid: { display: false } },
        y: { ticks: { font: { size: 11 }, color: '#9a7a5a', callback: v => '$'+v }, beginAtZero: true,
             grid: { color: 'rgba(200,148,58,0.08)' } },
      },
    },
  });
}

// ---- Expense Map ----
function initMap() {
  if (map) return;
  map = L.map('expense-map').setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);
}

async function geocode(locationStr) {
  const key = locationStr.toLowerCase().trim();
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'Budgetly/1.0' } });
    const data = await res.json();
    if (data[0]) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[key] = result;
      return result;
    }
  } catch {}
  geocodeCache[key] = null;
  return null;
}

async function renderMap() {
  initMap();
  // Clear existing markers
  map.eachLayer(layer => { if (layer instanceof L.CircleMarker || layer instanceof L.Marker) map.removeLayer(layer); });

  const withLocation = transactions.filter(tx => tx.type === 'expense' && tx.location);
  document.getElementById('map-pin-count').textContent = `${withLocation.length} location${withLocation.length !== 1 ? 's' : ''}`;

  if (!withLocation.length) return;

  // Process sequentially to respect Nominatim rate limit (1 req/sec)
  const bounds = [];
  for (const tx of withLocation) {
    const coords = await geocode(tx.location);
    if (!coords) continue;
    bounds.push([coords.lat, coords.lng]);
    const radius = Math.max(8, Math.min(30, Math.log10(tx.amount + 1) * 10));
    const icon  = CATEGORY_ICONS[tx.category] || '📌';
    const label = CATEGORY_LABELS[tx.category] || tx.category;
    L.circleMarker([coords.lat, coords.lng], {
      radius,
      fillColor:   '#c8943a',
      color:       '#9a6e3a',
      weight:      2,
      fillOpacity: 0.7,
    }).addTo(map).bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:160px">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${icon} ${escapeHtml(tx.description)}</div>
        <div style="color:#c8943a;font-weight:600;font-size:1rem">${tx.type==='income'?'+':'−'}${formatCurrency(tx.amount)}</div>
        <div style="color:#777;font-size:0.8rem;margin-top:4px">${label} · ${tx.date}</div>
        <div style="color:#555;font-size:0.8rem;margin-top:2px">📍 ${escapeHtml(tx.location)}</div>
      </div>`);
    await new Promise(r => setTimeout(r, 1100)); // respect Nominatim 1 req/sec limit
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setWelcomeBar(user) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  document.getElementById('welcome-date').textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  document.getElementById('welcome-email').textContent = user.email;
}

// ---- Auth & Init ----
onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  document.getElementById('app-content').style.display = '';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('user-email').textContent = user.displayName || user.email.split('@')[0];
  setWelcomeBar(user);

  document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

  onSnapshot(collection(db, 'users', user.uid, 'transactions'), snap => {
    transactions = snap.docs.map(d => {
      const data = d.data();
      return {
        id:          d.id,
        type:        data.type,
        description: data.description,
        amount:      Number(data.amount),
        category:    data.category,
        date:        data.date,
        location:    data.location || null,
      };
    });
    renderTopCategories();
    renderTrendChart();
    renderMap();
  });
});

window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });
