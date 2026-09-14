import { initNav } from './nav.js';
// ============================================================
// BudgetCore — goals.js
// Savings Goals page
// ============================================================

import { supabase } from './supabase.js';
import { initPageTransitions } from './transitions.js';

// --- State ---
let goals       = [];
let currentUser = null;
let channel     = null;
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

// --- Categories ---
const GOAL_CATEGORIES = [
  { id: 'travel',    label: 'Travel',
    icon: '<path d="M17 3L3 9.5l5.5 2 2 5.5L17 3z"/><path d="M8.5 11.5L17 3"/>' },
  { id: 'car',       label: 'Car',
    icon: '<path d="M3 12.5l1.2-4A2 2 0 016.1 7h7.8a2 2 0 011.9 1.5l1.2 4"/><rect x="2.3" y="12.5" width="15.4" height="4" rx="1.5"/><circle cx="6" cy="16.5" r="1.3"/><circle cx="14" cy="16.5" r="1.3"/>' },
  { id: 'house',     label: 'House',
    icon: '<path d="M3 10l7-6 7 6"/><path d="M5 9v7a1 1 0 001 1h8a1 1 0 001-1V9"/>' },
  { id: 'education', label: 'Education',
    icon: '<path d="M10 3l8 4-8 4-8-4z"/><path d="M6 9v4c0 1.1 1.8 2 4 2s4-.9 4-2V9"/><path d="M18 7v5"/>' },
  { id: 'health',    label: 'Health',
    icon: '<path d="M10 17s-6.5-4.2-6.5-9A4 4 0 0110 5.5 4 4 0 0116.5 8c0 4.8-6.5 9-6.5 9z"/>' },
  { id: 'wedding',   label: 'Wedding',
    icon: '<circle cx="10" cy="13" r="4.3"/><path d="M10 8.7L7.2 3.5h5.6z"/>' },
  { id: 'other',     label: 'More',
    icon: '<circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none"/>' },
];
const GOAL_CATEGORY_MAP = Object.fromEntries(GOAL_CATEGORIES.map(c => [c.id, c]));

function categoryIconSvg(catId, strokeWidth = '1.7') {
  const cat = GOAL_CATEGORY_MAP[catId] || GOAL_CATEGORY_MAP.other;
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg>`;
}

let selectedCategory  = GOAL_CATEGORIES[0].id;
let pendingPhotoUrl   = null;

function renderCategoryPicker() {
  const picker = document.getElementById('goal-cat-picker');
  picker.innerHTML = GOAL_CATEGORIES.map(cat => `
    <button type="button" class="goal-cat-btn${cat.id === selectedCategory ? ' active' : ''}" data-cat="${cat.id}">
      <span class="goal-cat-icon">${categoryIconSvg(cat.id, '2')}</span>
      <span class="goal-cat-label">${cat.label}</span>
    </button>
  `).join('');

  picker.querySelectorAll('.goal-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
  });
}

function selectCategory(catId) {
  selectedCategory = catId;
  document.querySelectorAll('#goal-cat-picker .goal-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === catId);
  });
  document.getElementById('goal-name-icon').innerHTML = categoryIconSvg(catId);
}

// --- Photo upload ---
async function handlePhotoFile(file) {
  const errorEl = document.getElementById('goal-photo-error');
  errorEl.textContent = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { errorEl.textContent = 'Please choose an image file.'; return; }
  if (file.size > 5 * 1024 * 1024) { errorEl.textContent = 'Image must be under 5MB.'; return; }
  if (!currentUser) return;

  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${currentUser.id}/${Date.now()}.${ext}`;

  try {
    const { error: uploadError } = await supabase.storage.from('goal-photos').upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('goal-photos').getPublicUrl(path);
    pendingPhotoUrl = data.publicUrl;
    setPhotoPreview(pendingPhotoUrl);
  } catch (err) {
    console.error('Photo upload failed:', err);
    errorEl.textContent = 'Upload failed. Please try again.';
  }
}

function setPhotoPreview(url) {
  const preview = document.getElementById('goal-photo-preview');
  const removeBtn = document.getElementById('goal-photo-remove-btn');
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="" />`;
    removeBtn.style.display = 'flex';
  } else {
    preview.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><circle cx="7" cy="8" r="1.6"/><path d="M4 14l4-4 3 3 3-3.5 3 4.5"/></svg>';
    removeBtn.style.display = 'none';
  }
}

function clearPhoto() {
  pendingPhotoUrl = null;
  document.getElementById('goal-photo-input').value = '';
  document.getElementById('goal-photo-error').textContent = '';
  setPhotoPreview(null);
}

// --- Category picker + photo upload: initial wiring ---
renderCategoryPicker();
document.getElementById('goal-name-icon').innerHTML = categoryIconSvg(selectedCategory);

const goalPhotoUpload = document.getElementById('goal-photo-upload');
const goalPhotoInput  = document.getElementById('goal-photo-input');

goalPhotoUpload.addEventListener('click', () => goalPhotoInput.click());
goalPhotoUpload.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goalPhotoInput.click(); }
});
goalPhotoInput.addEventListener('change', () => handlePhotoFile(goalPhotoInput.files[0]));

document.getElementById('goal-photo-remove-btn').addEventListener('click', e => {
  e.stopPropagation();
  clearPhoto();
});

// --- Data ---
async function fetchGoals(uid) {
  const { data, error } = await supabase.from('goals').select('*').eq('user_id', uid);
  if (error) { console.error('Goals fetch error:', error); return; }
  goals = (data || []).map(row => ({
    id:        row.id,
    name:      row.name,
    target:    Number(row.target),
    saved:     Number(row.saved || 0),
    deadline:  row.deadline || null,
    note:      row.note || '',
    category:  row.category || 'other',
    photoUrl:  row.photo_url || null,
    createdAt: new Date(row.created_at).getTime(),
  }));
  renderGoals();
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

    const ringPhotoStyle = goal.photoUrl ? ` style="background-image:url('${escapeHtml(goal.photoUrl)}')"` : '';

    return `
      <div class="goal-card ${done ? 'goal-card--done' : ''}" data-id="${goal.id}">
        <div class="goal-card-main">
          <!-- Circular ring -->
          <div class="goal-ring-wrap${goal.photoUrl ? ' goal-ring-wrap--photo' : ''}"${ringPhotoStyle}>
            <svg class="goal-ring" viewBox="0 0 84 84" width="84" height="84">
              <circle cx="42" cy="42" r="${R}" fill="none" stroke="#e8e0d4" stroke-width="7"/>
              <circle cx="42" cy="42" r="${R}" fill="none" stroke="${color}" stroke-width="7"
                stroke-dasharray="${dash} ${circ.toFixed(2)}"
                stroke-dashoffset="${(circ / 4).toFixed(2)}"
                stroke-linecap="round"
                style="transition:stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)"/>
            </svg>
            <span class="goal-ring-pct" style="color:${color}">${pct.toFixed(0)}%</span>
            <span class="goal-cat-badge" style="background:${color}" title="${(GOAL_CATEGORY_MAP[goal.category] || GOAL_CATEGORY_MAP.other).label}">${categoryIconSvg(goal.category, '2')}</span>
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
  const { error } = await supabase.from('goals').update({ saved: newSaved }).eq('id', goal.id);
  if (error) { errorEl.textContent = 'Failed to save. Please try again.'; return; }
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
  selectCategory(goal.category || 'other');
  pendingPhotoUrl = goal.photoUrl || null;
  setPhotoPreview(pendingPhotoUrl);
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
  selectCategory(GOAL_CATEGORIES[0].id);
  clearPhoto();
}

document.getElementById('goal-cancel-btn').addEventListener('click', cancelEdit);

// --- Delete ---
async function deleteGoal(id) {
  if (!currentUser) return;
  await supabase.from('goals').delete().eq('id', id);
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
      const { error } = await supabase.from('goals')
        .update({ name, target, saved, deadline, note, category: selectedCategory, photo_url: pendingPhotoUrl })
        .eq('id', editingId);
      if (error) throw error;
      cancelEdit();
    } else {
      const { error } = await supabase.from('goals')
        .insert({ user_id: currentUser.id, name, target, saved, deadline, note, category: selectedCategory, photo_url: pendingPhotoUrl });
      if (error) throw error;
      e.target.reset();
      selectCategory(GOAL_CATEGORIES[0].id);
      clearPhoto();
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
// --- Auth state ---
supabase.auth.onAuthStateChange((event, session) => {
  document.getElementById('auth-loading').style.display = 'none';
  const user = session?.user;

  if (!user) {
    window.location.replace('./index.html');
    return;
  }

  currentUser = user;
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
  document.getElementById('user-email').textContent  = displayName;
  document.getElementById('nav-user').style.display  = 'flex';
  document.getElementById('app-content').style.display = '';

  // Subscribe to goals (clean up any prior subscription first)
  if (channel) { supabase.removeChannel(channel); channel = null; }
  channel = supabase
    .channel(`goals-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` },
      () => fetchGoals(user.id))
    .subscribe();
  fetchGoals(user.id);
});

document.getElementById('signout-btn').addEventListener('click', () => supabase.auth.signOut());
initPageTransitions();
initNav();

// --- Savings / Investment mode toggle ---
document.querySelectorAll('.goals-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    document.querySelectorAll('.goals-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const mode = btn.dataset.mode;
    document.getElementById('mode-savings-panel').style.display    = mode === 'savings'    ? '' : 'none';
    document.getElementById('mode-investment-panel').style.display = mode === 'investment' ? '' : 'none';

    // The portfolio chart may have been created while its panel was hidden
    // (0×0 canvas) — nudge Chart.js to recompute its size now that it's visible.
    if (mode === 'investment') {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  });
});
