import { initNav } from './nav.js';
// ============================================================
// BudgetCore — networth.js
// Net Worth Tracker + Debt Payoff Planner
// ============================================================

import { auth, db } from './firebase.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';

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

let items     = [];
let editingId = null;
let unsub     = null;

// --- Auth ---
document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (!user) { window.location.replace('./index.html'); return; }

  document.getElementById('app-content').style.display = '';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('user-email').textContent = user.displayName || user.email;
  document.getElementById('welcome-email').textContent = user.displayName || user.email;
  document.getElementById('welcome-date').textContent  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  subscribeItems(user.uid);
});

function subscribeItems(uid) {
  if (unsub) unsub();
  unsub = onSnapshot(
    collection(db, 'users', uid, 'networth'),
    snap => {
      items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    },
    err => console.error('networth sync error:', err)
  );
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

  document.getElementById('nw-empty').style.display = items.length === 0 ? '' : 'none';
}

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

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const payload = { name, type, value, interestRate: interest, monthlyPayment: payment };

  try {
    if (editingId) {
      await updateDoc(doc(db, 'users', uid, 'networth', editingId), payload);
      cancelEdit();
    } else {
      await addDoc(collection(db, 'users', uid, 'networth'), { ...payload, createdAt: serverTimestamp() });
    }
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
    const uid       = auth.currentUser?.uid;
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
      await deleteDoc(doc(db, 'users', uid, 'networth', deleteBtn.dataset.id)).catch(console.error);
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
initNav();
