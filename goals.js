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
  { id: 'travel',    label: 'Travel',
    icon: '<path d="M14.8 8.5 L16.2 5 C18.6 3.3 19.3 5.6 16.8 6.7 L6.8 5.4 L9.6 10.1 L2.8 8.3 L6.3 13.1 L8 10.9 L9.5 17.2 L11.7 11.4 Z"/>' },
  { id: 'car',       label: 'Car',
    icon: '<path d="M4 9.5L6.5 6a1.5 1.5 0 011.2-.6h4.6a1.5 1.5 0 011.2.6L16 9.5"/><path d="M3 9.5h14"/><path d="M2.3 8.3c-.9 0-1.3.4-1.3 1s.4 1 1.3 1h1.3M17.7 8.3c.9 0 1.3.4 1.3 1s-.4 1-1.3 1h-1.3"/><path d="M3.3 9.5v3.2a2 2 0 002 2h9.4a2 2 0 002-2V9.5"/><path d="M6 12l2.3.9M14 12l-2.3.9"/><path d="M7.5 15.7h5"/><path d="M3.3 14.7h2M14.7 14.7h2"/>' },
  { id: 'house',     label: 'House',
    icon: '<path d="M2.2 9.7L10 3l7.8 6.7"/><rect x="13.7" y="5.3" width="1.8" height="4.3"/><path d="M4.3 8.9v7.4h11.4V8.9"/><rect x="8.2" y="11.3" width="3.6" height="5" rx="0.3"/><circle cx="10.9" cy="14" r="0.4" fill="currentColor" stroke="none"/>' },
  { id: 'education', label: 'Education',
    icon: '<path d="M2.2 9.8L10 4.3l7.8 5.5"/><path d="M2.2 9.8L10 12.2l7.8-2.4"/><path d="M3.6 9.7V13.3C3.6 15 6.5 15.6 10 15.6C13.5 15.6 16.4 15 16.4 13.3V9.7"/><path d="M17.8 9.8v2.4"/><circle cx="17.8" cy="13.1" r="0.9"/><path d="M17.1 14l.6 3.4a.3.3 0 00.6 0l.6-3.4"/>' },
  { id: 'health',    label: 'Health',
    icon: '<path d="M10 17s-6.5-4.2-6.5-9A4 4 0 0110 5.5 4 4 0 0116.5 8c0 4.8-6.5 9-6.5 9z"/><path d="M9 8.4h2v2h2v2h-2v2H9v-2H7v-2h2z"/>' },
  { id: 'wedding',   label: 'Wedding',
    icon: '<path d="M7.3 5.6L10 4.3l2.7 1.3M10 4.3v1.3M7.3 5.6h5.4M7.3 5.6L10 8.3l2.7-2.7M10 5.6v2.7M7.3 5.6L7.9 9M12.7 5.6L12.1 9"/><path d="M10 1.4v2.3M7.3 2.3l1.2 1.5M12.7 2.3l-1.2 1.5"/><circle cx="10" cy="13.3" r="4.6"/><circle cx="10" cy="13.3" r="3.5"/>' },
  { id: 'business',  label: 'Business',
    icon: '<rect x="2.3" y="7.2" width="15.4" height="9.6" rx="2"/><path d="M7.4 7.2V5.8a1.8 1.8 0 011.8-1.8h1.6a1.8 1.8 0 011.8 1.8v1.4"/><path d="M2.3 11.1l6.3 1.9h2.8l6.3-1.9"/><rect x="8.8" y="12" width="2.4" height="2.6" rx="0.5"/>' },
  { id: 'debt',      label: 'Debt',
    icon: '<path d="M7.3 5.2c.5-.6 1.2-.6 1.7-.1.5.5 1.5.5 2 0 .5-.5 1.2-.5 1.7.1"/><rect x="7.6" y="5.1" width="4.8" height="1.3" rx="0.6"/><path d="M7.7 6.3C5 7.7 3.3 10 3.3 12.4c0 3 3 4.9 6.7 4.9 1.1 0 2.1-.2 3-.4"/><path d="M12.3 6.3c1.6 1 2.9 2.6 3.4 4.4"/><path d="M8.4 9.9a1.8 1.8 0 011.6-.9c1 0 1.7.6 1.7 1.3 0 1.7-3.4.9-3.4 2.6 0 .7.7 1.3 1.7 1.3a1.8 1.8 0 001.7-1"/><path d="M10 8v7.3"/><circle cx="14.6" cy="14.2" r="3.1"/><path d="M13.1 14.2h3"/>' },
  { id: 'purchase',  label: 'Big Purchase',
    icon: '<path d="M2 6.3h2.5l1.7 2"/><path d="M6.2 8.3H16.5L14.9 13.2H7.8Z"/><path d="M7 13.6h9"/><circle cx="9" cy="16.3" r="1.3"/><circle cx="13.8" cy="16.3" r="1.3"/><path d="M8.7 7L11 3.5l2.3 3.5"/><path d="M8.7 7h4.6"/><path d="M11 3.5v3.5"/><path d="M8.7 7L11 9.5l2.3-2.5"/>' },
  { id: 'moving',    label: 'Moving',
    icon: '<path d="M10 3l7 3.5v7L10 17l-7-3.5v-7z"/><path d="M3 6.5l7 3.5 7-3.5M10 10.2V17"/><path d="M6.3 5L13 8.6"/><path d="M12.6 10.5v2.8l-1.5-.8v-2.7z"/>' },
];

const GOAL_EXTRA_CATEGORIES = [
  { id: 'retirement',    label: 'Early Retirement',
    icon: '<path d="M10 17V10"/><path d="M10 10C7 9 5 6 6 3c2 1 4 3 4 7z"/><path d="M10 10c3-1 5-4 4-7-2 1-4 3-4 7z"/><path d="M10 10c-2-1.5-4.5-1.3-6 .5 2 1.5 4.5 1.3 6-.5z"/><path d="M10 10c2-1.5 4.5-1.3 6 .5-2 1.5-4.5 1.3-6-.5z"/>' },
  { id: 'giftsholidays', label: 'Gifts & Holidays',
    icon: '<rect x="3" y="8" width="14" height="9" rx="1.2"/><path d="M3 11h14"/><path d="M10 8v9"/><path d="M10 8c-1.5-3-4-3.5-5-2.5-1 1 .5 2.7 5 2.5z"/><path d="M10 8c1.5-3 4-3.5 5-2.5 1 1-.5 2.7-5 2.5z"/>' },
  { id: 'pet',           label: 'Pet',
    icon: '<circle cx="6.3" cy="6.3" r="1.4" fill="currentColor" stroke="none"/><circle cx="10" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="13.7" cy="6.3" r="1.4" fill="currentColor" stroke="none"/><path d="M10 9c-2.8 0-4.8 1.9-4.8 4 0 1.5 1.3 2.1 2.6 1.6.9-.4 1.4-.5 2.2-.5s1.3.1 2.2.5c1.3.5 2.6-.1 2.6-1.6 0-2.1-2-4-4.8-4z" fill="currentColor" stroke="none"/>' },
  { id: 'emergency',     label: 'Emergency',
    icon: '<path d="M10 3.5l8 13.5H2z"/><path d="M10 8.3v3.4"/><circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none"/>' },
  { id: 'renovation',    label: 'Home Renovation',
    icon: '<path d="M13.5 3.5a3.5 3.5 0 00-4.6 4.1L3 13.5 5 15.5l5.9-5.9a3.5 3.5 0 004.1-4.6l-2.4 2.4-1.7-1.7z"/>' },
  { id: 'newbaby',       label: 'New Baby / Family',
    icon: '<path d="M8 3h4v3H8z"/><path d="M8.5 6h3l1 2v6.5a1.5 1.5 0 01-1.5 1.5h-2a1.5 1.5 0 01-1.5-1.5V8z"/><path d="M8.3 10h3.4"/>' },
  { id: 'specialevent',  label: 'Special Event',
    icon: '<rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8h14M6.5 2.5V5M13.5 2.5V5"/><path d="M10 10l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L7.1 12.1l2-.3z" fill="currentColor" stroke="none"/>' },
  { id: 'dreampurchase', label: 'Dream Purchase',
    icon: '<path d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z" fill="currentColor" stroke="none"/>' },
];

const MORE_ICON_PATH   = '<circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none"/>';
const CUSTOM_ICON_PATH = '<path d="M13.5 3.5l3 3L6 17H3v-3z"/>';

const GOAL_CATEGORY_MAP = Object.fromEntries(
  [...GOAL_MAIN_CATEGORIES, ...GOAL_EXTRA_CATEGORIES].map(c => [c.id, c])
);
GOAL_CATEGORY_MAP.other = { id: 'other', label: 'Other', icon: MORE_ICON_PATH };

function categoryIconSvg(catId, strokeWidth = '1.7') {
  const cat  = GOAL_CATEGORY_MAP[catId];
  const path = cat ? cat.icon : (catId === 'other' ? MORE_ICON_PATH : CUSTOM_ICON_PATH);
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function isMainCategory(catId) {
  return GOAL_MAIN_CATEGORIES.some(c => c.id === catId);
}

let selectedCategory  = GOAL_MAIN_CATEGORIES[0].id;
let pendingPhotoUrl   = null;

function renderCategoryPicker() {
  const picker   = document.getElementById('goal-cat-picker');
  const dropdown = document.getElementById('goal-cat-more-dropdown');

  const mainButtons = GOAL_MAIN_CATEGORIES.map(cat => `
    <button type="button" class="goal-cat-btn${cat.id === selectedCategory ? ' active' : ''}" data-cat="${cat.id}">
      <span class="goal-cat-icon">${categoryIconSvg(cat.id, '2')}</span>
      <span class="goal-cat-label">${cat.label}</span>
    </button>
  `).join('');

  const moreActive = !isMainCategory(selectedCategory);
  const morePreset = GOAL_EXTRA_CATEGORIES.find(c => c.id === selectedCategory);
  const moreLabel  = moreActive ? (morePreset ? morePreset.label : escapeHtml(selectedCategory)) : 'More';
  const moreIcon   = moreActive
    ? categoryIconSvg(selectedCategory, '2')
    : `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${MORE_ICON_PATH}</svg>`;

  // Dropdown lives outside the card (see goals.html) so its position:fixed
  // coordinates aren't trapped by .app-card's backdrop-filter containing block.
  picker.innerHTML = `
    ${mainButtons}
    <button type="button" class="goal-cat-btn${moreActive ? ' active' : ''}" id="goal-cat-more-btn">
      <span class="goal-cat-icon">${moreIcon}</span>
      <span class="goal-cat-label">${moreLabel}</span>
    </button>
  `;

  dropdown.innerHTML = `
    ${GOAL_EXTRA_CATEGORIES.map(cat => `
      <button type="button" class="goal-cat-more-item${cat.id === selectedCategory ? ' active' : ''}" data-cat="${cat.id}">
        <span class="goal-cat-more-item-icon">${categoryIconSvg(cat.id, '1.7')}</span>
        ${cat.label}
      </button>
    `).join('')}
    <button type="button" class="goal-cat-more-item" id="goal-cat-custom-btn">
      <span class="goal-cat-more-item-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${CUSTOM_ICON_PATH}</svg></span>
      Custom…
    </button>
    <div class="goal-cat-custom-input-wrap" id="goal-cat-custom-input-wrap">
      <input type="text" id="goal-cat-custom-input" placeholder="Name your category…" maxlength="30" />
    </div>
  `;

  picker.querySelectorAll('.goal-cat-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => { selectCategory(btn.dataset.cat); closeMoreDropdown(); });
  });
  dropdown.querySelectorAll('.goal-cat-more-item[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => { selectCategory(btn.dataset.cat); closeMoreDropdown(); });
  });
  document.getElementById('goal-cat-more-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleMoreDropdown();
  });
  document.getElementById('goal-cat-custom-btn').addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.add('show-custom-input');
    const input = document.getElementById('goal-cat-custom-input');
    input.value = moreActive && !morePreset ? selectedCategory : '';
    input.focus();
  });
  const customInput = document.getElementById('goal-cat-custom-input');
  customInput.addEventListener('click', e => e.stopPropagation());
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = customInput.value.trim();
      if (val) { selectCategory(val); closeMoreDropdown(); }
    } else if (e.key === 'Escape') {
      closeMoreDropdown();
    }
  });
}

function toggleMoreDropdown() {
  const dropdown = document.getElementById('goal-cat-more-dropdown');
  const wasOpen  = dropdown.classList.contains('open');
  closeMoreDropdown();
  if (!wasOpen) {
    const btn  = document.getElementById('goal-cat-more-btn');
    const rect = btn.getBoundingClientRect();
    dropdown.style.top  = `${rect.bottom + 6}px`;
    dropdown.style.left = `${Math.max(8, Math.min(rect.right - 230, window.innerWidth - 238))}px`;
    dropdown.classList.add('open');
  }
}

function closeMoreDropdown() {
  const dropdown = document.getElementById('goal-cat-more-dropdown');
  dropdown?.classList.remove('open', 'show-custom-input');
}

document.addEventListener('click', e => {
  const dropdown = document.getElementById('goal-cat-more-dropdown');
  if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
    closeMoreDropdown();
  }
});

function selectCategory(catId) {
  selectedCategory = catId;
  document.getElementById('goal-name-icon').innerHTML = categoryIconSvg(catId);
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
