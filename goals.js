// ============================================================
// Budgetly — goals.js
// Savings Goals page
// ============================================================

import { auth, db } from './firebase.js';
import { initPageTransitions } from './transitions.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';

// --- State ---
let goals       = [];
let currentUser = null;
let unsub       = null;
let editingId   = null;
let contribGoalId = null;

// --- Helpers ---
function formatCurrency(v) {
  return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T12:00:00') - new Date();
  return Math.ceil(diff / 86400000);
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const GOAL_COLORS = [
  '#a07848', '#5c8a5c', '#5c6e8a', '#8a5c5c',
  '#7a6e2c', '#4c7a8a', '#8a4c7a', '#6e7a4c',
];

function goalColor(index) {
  return GOAL_COLORS[index % GOAL_COLORS.length];
}

// --- Render ---
function renderGoals() {
  const list    = document.getElementById('goals-list');
  const empty   = document.getElementById('goals-empty');
  const counter = document.getElementById('goals-count');

  counter.textContent = goals.length + ' goal' + (goals.length !== 1 ? 's' : '');

  if (!goals.length) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...goals].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  list.innerHTML = sorted.map((goal, i) => {
    const pct       = Math.min((goal.saved / goal.target) * 100, 100);
    const done      = goal.saved >= goal.target;
    const color     = goalColor(i);
    const days      = daysUntil(goal.deadline);
    const deadline  = formatDeadline(goal.deadline);
    const remaining = Math.max(goal.target - goal.saved, 0);

    // Circular progress ring
    const R   = 36;
    const circ = 2 * Math.PI * R;
    const dash = ((pct / 100) * circ).toFixed(2);

    // Estimated completion meta
    let metaHtml = '';
    if (done) {
      metaHtml = `<span class="goal-meta goal-meta--done">🎉 Goal reached!</span>`;
    } else if (deadline) {
      const daysLeft = days ?? 0;
      if (daysLeft <= 0) {
        metaHtml = `<span class="goal-meta goal-meta--overdue">Deadline passed — keep going!</span>`;
      } else {
        const monthsLeft = daysLeft / 30.44;
        const perMonth   = monthsLeft > 0 ? remaining / monthsLeft : remaining;
        metaHtml = `<span class="goal-meta">By ${deadline} · <b>${formatCurrency(perMonth)}/mo</b> needed</span>`;
      }
    }

    return `
      <div class="goal-card ${done ? 'goal-card--done' : ''}" data-id="${goal.id}">
        <div class="goal-card-main">
          <!-- Circular ring -->
          <div class="goal-ring-wrap">
            <svg class="goal-ring" viewBox="0 0 84 84" width="84" height="84">
              <circle cx="42" cy="42" r="${R}" fill="none" stroke="#e8e0d4" stroke-width="7"/>
              <circle cx="42" cy="42" r="${R}" fill="none" stroke="${color}" stroke-width="7"
                stroke-dasharray="${dash} ${circ.toFixed(2)}"
                stroke-dashoffset="${(circ / 4).toFixed(2)}"
                stroke-linecap="round"
                style="transition:stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)"/>
            </svg>
            <span class="goal-ring-pct" style="color:${color}">${pct.toFixed(0)}%</span>
          </div>

          <!-- Content -->
          <div class="goal-card-body">
            <div class="goal-card-top">
              <div>
                <span class="goal-card-name">${escapeHtml(goal.name)}</span>
                ${goal.note ? `<span class="goal-card-note">${escapeHtml(goal.note)}</span>` : ''}
              </div>
              <div class="goal-card-actions">
                <button class="goal-contrib-btn" data-id="${goal.id}" title="Add contribution">+ Add</button>
                <button class="goal-edit-btn"    data-id="${goal.id}" title="Edit">✎</button>
                <button class="goal-delete-btn"  data-id="${goal.id}" title="Delete">✕</button>
              </div>
            </div>

            <div class="goal-amounts">
              <span class="goal-saved-lbl">Saved</span>
              <span class="goal-saved-val" style="color:${color}">${formatCurrency(goal.saved)}</span>
              <span class="goal-of"> / </span>
              <span class="goal-target-val">${formatCurrency(goal.target)}</span>
            </div>

            <div class="goal-track">
              <div class="goal-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
            </div>

            ${metaHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach button handlers
  list.querySelectorAll('.goal-contrib-btn').forEach(btn =>
    btn.addEventListener('click', () => openContrib(btn.dataset.id))
  );
  list.querySelectorAll('.goal-edit-btn').forEach(btn =>
    btn.addEventListener('click', () => startEdit(btn.dataset.id))
  );
  list.querySelectorAll('.goal-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteGoal(btn.dataset.id))
  );
}

// --- Contribution modal ---
function openContrib(id) {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  contribGoalId = id;
  const remaining = Math.max(goal.target - goal.saved, 0);
  document.getElementById('contrib-title').textContent = `Add to "${goal.name}"`;
  document.getElementById('contrib-sub').textContent   =
    `${formatCurrency(goal.saved)} saved · ${formatCurrency(remaining)} remaining`;
  document.getElementById('contrib-amount').value = '';
  document.getElementById('contrib-error').textContent = '';
  document.getElementById('contrib-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('contrib-amount').focus(), 60);
}

function closeContrib() {
  document.getElementById('contrib-overlay').style.display = 'none';
  document.body.style.overflow = '';
  contribGoalId = null;
}

document.getElementById('contrib-cancel-btn').addEventListener('click', closeContrib);
document.getElementById('contrib-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('contrib-overlay')) closeContrib();
});

document.getElementById('contrib-save-btn').addEventListener('click', async () => {
  const amount  = parseFloat(document.getElementById('contrib-amount').value);
  const errorEl = document.getElementById('contrib-error');
  errorEl.textContent = '';
  if (isNaN(amount) || amount <= 0) {
    errorEl.textContent = 'Enter a valid amount.';
    return;
  }
  const goal = goals.find(g => g.id === contribGoalId);
  if (!goal || !currentUser) return;
  const newSaved = Math.min(goal.saved + amount, goal.target * 10); // sanity cap
  await updateDoc(doc(db, 'users', currentUser.uid, 'goals', goal.id), { saved: newSaved });
  closeContrib();
});

// --- Edit ---
function startEdit(id) {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  editingId = id;
  document.getElementById('goal-name').value     = goal.name;
  document.getElementById('goal-target').value   = goal.target;
  document.getElementById('goal-saved').value    = goal.saved;
  document.getElementById('goal-deadline').value = goal.deadline || '';
  document.getElementById('goal-note').value     = goal.note || '';
  document.getElementById('goal-submit-btn').textContent = 'Update Goal';
  document.getElementById('goal-cancel-btn').style.display = 'inline-block';
  document.querySelector('.app-card .card-title').textContent = 'Edit Goal';
  document.querySelector('.app-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  document.getElementById('goal-form').reset();
  document.getElementById('goal-submit-btn').textContent  = 'Add Goal';
  document.getElementById('goal-cancel-btn').style.display = 'none';
  document.querySelector('.app-card .card-title').textContent = 'New Goal';
  document.getElementById('goal-error').textContent = '';
}

document.getElementById('goal-cancel-btn').addEventListener('click', cancelEdit);

// --- Delete ---
async function deleteGoal(id) {
  if (!currentUser) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', id));
}

// --- Form submit ---
document.getElementById('goal-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value);
  const saved    = parseFloat(document.getElementById('goal-saved').value) || 0;
  const deadline = document.getElementById('goal-deadline').value || null;
  const note     = document.getElementById('goal-note').value.trim();
  const errorEl  = document.getElementById('goal-error');
  errorEl.textContent = '';

  if (!name) { errorEl.textContent = 'Please enter a goal name.'; return; }
  if (isNaN(target) || target <= 0) { errorEl.textContent = 'Please enter a valid target amount.'; return; }

  const btn = document.getElementById('goal-submit-btn');
  btn.disabled = true;

  try {
    if (editingId) {
      await updateDoc(doc(db, 'users', currentUser.uid, 'goals', editingId), {
        name, target, saved, deadline, note,
      });
      cancelEdit();
    } else {
      await addDoc(collection(db, 'users', currentUser.uid, 'goals'), {
        name, target, saved, deadline, note,
        createdAt: serverTimestamp(),
      });
      e.target.reset();
    }
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'Failed to save. Please try again.';
  } finally {
    btn.disabled = false;
  }
});

// --- Clear buttons ---
document.querySelectorAll('.input-clear-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (input) { input.value = ''; input.focus(); }
  });
});

// --- Welcome bar ---
function setWelcomeBar(user) {
  const displayName = user.displayName || user.email.split('@')[0];
  document.getElementById('welcome-email').textContent = user.email;
  document.getElementById('welcome-date').textContent  =
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = document.querySelector('#welcome-bar .welcome-greeting');
  if (greeting) greeting.textContent = `Savings Goals`;
}

// --- Auth state ---
onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';

  if (!user) {
    window.location.replace('./index.html');
    return;
  }

  currentUser = user;
  setWelcomeBar(user);
  const displayName = user.displayName || user.email.split('@')[0];
  document.getElementById('user-email').textContent  = displayName;
  document.getElementById('nav-user').style.display  = 'flex';
  document.getElementById('app-content').style.display = '';

  // Subscribe to goals (clean up any prior subscription first)
  if (unsub) { unsub(); unsub = null; }
  unsub = onSnapshot(
    collection(db, 'users', user.uid, 'goals'),
    snap => {
      goals = snap.docs.map(d => ({
        id:        d.id,
        name:      d.data().name,
        target:    Number(d.data().target),
        saved:     Number(d.data().saved || 0),
        deadline:  d.data().deadline || null,
        note:      d.data().note || '',
        createdAt: d.data().createdAt?.seconds ?? 0,
      }));
      renderGoals();
    },
    err => console.error('Goals snapshot error:', err)
  );
});

document.getElementById('signout-btn').addEventListener('click', () => signOut(auth));
initPageTransitions();
