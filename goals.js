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
const GOAL_MAIN_CATEGORIES = [
  { id: 'travel',    label: 'Travel',    img: 'goal-icons/cat-travel.png' },
  { id: 'car',       label: 'Car',       img: 'goal-icons/cat-car.png' },
  { id: 'house',     label: 'House',     img: 'goal-icons/cat-house.png' },
  { id: 'education', label: 'Education', img: 'goal-icons/cat-education.png' },
  { id: 'health',    label: 'Health',    img: 'goal-icons/cat-health.png' },
  { id: 'wedding',   label: 'Wedding',   img: 'goal-icons/cat-wedding.png' },
  { id: 'business',  label: 'Business',  img: 'goal-icons/cat-business.png' },
  { id: 'debt',      label: 'Debt',      img: 'goal-icons/cat-debt.png' },
  { id: 'purchase',  label: 'Big Purchase', img: 'goal-icons/cat-purchase.png' },
  { id: 'moving',    label: 'Moving',    img: 'goal-icons/cat-moving.png' },
];

const GOAL_EXTRA_CATEGORIES = [
  { id: 'retirement',    label: 'Early Retirement', img: 'goal-icons/cat-retirement.png' },
  { id: 'giftsholidays', label: 'Gifts & Holidays', img: 'goal-icons/cat-giftsholidays.png' },
  { id: 'pet',           label: 'Pet', img: 'goal-icons/cat-pet.png' },
  { id: 'emergency',     label: 'Emergency', img: 'goal-icons/cat-emergency.png' },
  { id: 'renovation',    label: 'Home Renovation', img: 'goal-icons/cat-renovation.png' },
  { id: 'newbaby',       label: 'New Baby / Family', img: 'goal-icons/cat-newbaby.png' },
  { id: 'specialevent',  label: 'Special Event', img: 'goal-icons/cat-specialevent.png' },
  { id: 'dreampurchase', label: 'Dream Purchase', img: 'goal-icons/cat-dreampurchase.png' },
];

const MORE_ICON_PATH   = '<circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none"/>';
const CUSTOM_ICON_IMG = 'goal-icons/cat-custom.png';

const GOAL_CATEGORY_MAP = Object.fromEntries(
  [...GOAL_MAIN_CATEGORIES, ...GOAL_EXTRA_CATEGORIES].map(c => [c.id, c])
);
GOAL_CATEGORY_MAP.other = { id: 'other', label: 'Other', icon: MORE_ICON_PATH };

function categoryIconSvg(catId, strokeWidth = '1.7') {
  const cat = GOAL_CATEGORY_MAP[catId];
  if (cat && cat.img) return `<img src="${cat.img}" alt="" class="goal-cat-img" />`;
  if (cat) return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg>`;
  if (catId === 'other') return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${MORE_ICON_PATH}</svg>`;
  return `<img src="${CUSTOM_ICON_IMG}" alt="" class="goal-cat-img" />`;
}

const GOAL_ALL_CATEGORIES = [...GOAL_MAIN_CATEGORIES, ...GOAL_EXTRA_CATEGORIES];

function isPresetCategory(catId) {
  return GOAL_ALL_CATEGORIES.some(c => c.id === catId);
}

let selectedCategory  = GOAL_MAIN_CATEGORIES[0].id;
let pendingPhotoUrl   = null;

function renderCategoryPicker() {
  const picker = document.getElementById('goal-cat-picker');

  const catButtons = GOAL_ALL_CATEGORIES.map(cat => `
    <button type="button" class="goal-cat-btn${cat.id === selectedCategory ? ' active' : ''}" data-cat="${cat.id}">
      <span class="goal-cat-icon">${categoryIconSvg(cat.id, '2')}</span>
      <span class="goal-cat-label">${cat.label}</span>
    </button>
  `).join('');

  const isCustom    = !isPresetCategory(selectedCategory);
  const customLabel = isCustom ? escapeHtml(selectedCategory) : 'Custom';

  picker.innerHTML = `
    ${catButtons}
    <button type="button" class="goal-cat-btn${isCustom ? ' active' : ''}" id="goal-cat-custom-btn">
      <span class="goal-cat-icon"><img src="${CUSTOM_ICON_IMG}" alt="" /></span>
      <span class="goal-cat-label">${customLabel}</span>
    </button>
  `;

  picker.querySelectorAll('.goal-cat-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
  });
  document.getElementById('goal-cat-custom-btn').addEventListener('click', toggleCustomInput);
}

function toggleCustomInput() {
  const row = document.getElementById('goal-cat-custom-row');
  const isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'flex';
  const input = document.getElementById('goal-cat-custom-input');
  input.value = !isPresetCategory(selectedCategory) ? selectedCategory : '';
  input.focus();
}

function selectCategory(catId) {
  selectedCategory = catId;
  document.getElementById('goal-name-icon').innerHTML = categoryIconSvg(catId);
  document.getElementById('goal-cat-custom-row').style.display = 'none';
  renderCategoryPicker();
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

const goalCatCustomInput = document.getElementById('goal-cat-custom-input');
goalCatCustomInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = goalCatCustomInput.value.trim();
    if (val) selectCategory(val);
  } else if (e.key === 'Escape') {
    document.getElementById('goal-cat-custom-row').style.display = 'none';
  }
});
document.getElementById('goal-cat-custom-cancel').addEventListener('click', () => {
  document.getElementById('goal-cat-custom-row').style.display = 'none';
});

// --- Smart Tip carousel ---
const TIP_SLIDE_COUNT = 3;
let tipSlideIndex = 0;

function goToTipSlide(i) {
  tipSlideIndex = (i + TIP_SLIDE_COUNT) % TIP_SLIDE_COUNT;
  document.getElementById('tip-carousel-track').style.transform = `translateX(-${tipSlideIndex * (100 / TIP_SLIDE_COUNT)}%)`;
  document.querySelectorAll('#tip-dots .tip-dot').forEach((dot, i2) => {
    dot.classList.toggle('active', i2 === tipSlideIndex);
  });
}

let tipAutoTimer = null;
function startTipAutoAdvance() {
  clearInterval(tipAutoTimer);
  tipAutoTimer = setInterval(() => {
    goToTipSlide(tipSlideIndex + 1);
  }, 10000);
}

document.getElementById('tip-carousel-track').addEventListener('click', () => {
  goToTipSlide(tipSlideIndex + 1);
  startTipAutoAdvance();
});
document.querySelectorAll('#tip-dots .tip-dot').forEach(dot => {
  dot.addEventListener('click', e => {
    e.stopPropagation();
    goToTipSlide(Number(dot.dataset.slide));
    startTipAutoAdvance();
  });
});

startTipAutoAdvance();

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
  selectCategory(GOAL_MAIN_CATEGORIES[0].id);
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
      selectCategory(GOAL_MAIN_CATEGORIES[0].id);
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
