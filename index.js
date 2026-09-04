// ============================================================
// BudgetCore — index.js
// Home page: auth state + sliding sign-in / sign-up
// ============================================================

import { auth, googleProvider, db } from './firebase.js';
import { initPageTransitions } from './transitions.js';
import { loadAndApplyAvatar } from './avatarUtils.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// ── Auth state ────────────────────────────────────────────────────────────────
const stayOnHome = new URLSearchParams(window.location.search).has('home');

onAuthStateChanged(auth, user => {
  document.getElementById('auth-loading').style.display = 'none';
  if (user && !stayOnHome) {
    window.location.replace('./app.html');
  } else if (user) {
    showLoggedInState(user);
  } else {
    showSignedOutState();
  }
});

function showLoggedInState(user) {
  hideAuth();
  document.getElementById('home-nav-user').style.display  = 'flex';
  document.getElementById('home-nav-signin').style.display = 'none';
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('home-user-email').textContent = name;
  document.getElementById('hero-dashboard-btn').style.display = '';
  document.getElementById('hero-signin-btn').style.display    = 'none';
  loadAndApplyAvatar(user.uid, 'home-avatar-ring');
}

function showSignedOutState() {
  document.getElementById('home-nav-user').style.display   = 'none';
  document.getElementById('home-nav-signin').style.display = '';
  document.getElementById('hero-dashboard-btn').style.display = 'none';
  document.getElementById('hero-signin-btn').style.display    = '';
}

document.getElementById('home-signout-btn').addEventListener('click', () => signOut(auth));

// ── Sliding panel logic ───────────────────────────────────────────────────────
const container      = document.getElementById('container');
const mobileToggleBtn = document.getElementById('auth-mobile-toggle');
const mobileMsgEl    = document.getElementById('auth-mobile-msg');

const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');

signUpButton.addEventListener('click', () => {
  container.classList.add('right-panel-active');
  updateMobileFooter(true);
});

signInButton.addEventListener('click', () => {
  container.classList.remove('right-panel-active');
  updateMobileFooter(false);
});

function toggleMobile() {
  const isSignup = container.classList.contains('right-panel-active');
  if (isSignup) {
    container.classList.remove('right-panel-active');
    updateMobileFooter(false);
  } else {
    container.classList.add('right-panel-active');
    updateMobileFooter(true);
  }
}
window.toggleMobile = toggleMobile;

function updateMobileFooter(isSignup) {
  mobileMsgEl.textContent    = isSignup ? 'Already have an account?' : "Don't have an account?";
  mobileToggleBtn.textContent = isSignup ? 'Sign In' : 'Sign Up';
}

// ── Auth modal ────────────────────────────────────────────────────────────────
const overlay = document.getElementById('auth-overlay');

function showAuth(tab) {
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (tab === 'signup') {
    container.classList.add('right-panel-active');
    updateMobileFooter(true);
    setTimeout(() => document.getElementById('signup-name').focus(), 60);
  } else {
    container.classList.remove('right-panel-active');
    updateMobileFooter(false);
    setTimeout(() => document.getElementById('signin-email').focus(), 60);
  }
  clearErrors();
}

function hideAuth() {
  overlay.style.display = 'none';
  document.body.style.overflow = '';
  clearErrors();
  document.getElementById('signin-form').reset();
  document.getElementById('signup-form').reset();
  document.getElementById('pw-strength').style.display = 'none';
}

function clearErrors() {
  document.getElementById('signin-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

overlay.addEventListener('click', e => { if (e.target === overlay) hideAuth(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideAuth(); });

document.querySelectorAll('[data-show-auth]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showAuth(el.dataset.showAuth);
  });
});

// ── Password strength ─────────────────────────────────────────────────────────
document.getElementById('signup-password').addEventListener('input', function () {
  const val    = this.value;
  const wrap   = document.getElementById('pw-strength');
  const label  = document.getElementById('pw-label');
  const bars   = [
    document.getElementById('pw-b1'),
    document.getElementById('pw-b2'),
    document.getElementById('pw-b3'),
    document.getElementById('pw-b4'),
  ];

  if (!val) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';

  const score = calcStrength(val);
  const labels   = ['Weak', 'Fair', 'Moderate', 'Strong'];
  const colors   = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169'];
  const active   = score; // 1–4

  bars.forEach((b, i) => {
    b.style.background = i < active ? colors[active - 1] : '#e8e0d4';
  });
  label.textContent  = labels[active - 1];
  label.style.color  = colors[active - 1];
});

function calcStrength(pw) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return Math.max(1, s);
}

// ── Welcome toast ─────────────────────────────────────────────────────────────
function showWelcomeToast(name, then) {
  sessionStorage.setItem('justSignedIn', name);
  const user = auth.currentUser;
  // Show onboarding for brand-new users (no localStorage flag)
  if (user && !localStorage.getItem('budgetly_onboarded_' + user.uid)) {
    hideAuth();
    showOnboarding(user, then);
    return;
  }
  overlay.style.transition = 'opacity 0.22s ease';
  overlay.style.opacity = '0';
  document.body.style.transition = 'opacity 0.22s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { hideAuth(); then(); }, 240);
}

// ── Onboarding Wizard ─────────────────────────────────────────────────────────
let _onboardingCallback = null;
let _obStep = 1;

function showOnboarding(user, callback) {
  _onboardingCallback = callback;
  _obStep = 1;
  showObPane(1);
  document.getElementById('onboarding-overlay').style.display = 'flex';
}

function showObPane(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`ob-pane-${i}`).style.display = i === n ? '' : 'none';
    document.getElementById(`ob-dot-${i}`).classList.toggle('ob-step--active', i === n);
    document.getElementById(`ob-dot-${i}`).classList.toggle('ob-step--done', i < n);
  });
  _obStep = n;
}

document.getElementById('ob-next-1').addEventListener('click', () => showObPane(2));

document.getElementById('ob-next-2').addEventListener('click', async () => {
  const budget = parseFloat(document.getElementById('ob-budget').value);
  if (!isNaN(budget) && budget > 0) {
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await setDoc(doc(db, 'users', uid, 'settings', 'profile'), { monthlyBudget: budget }, { merge: true });
      } catch { /* non-fatal */ }
    }
  }
  showObPane(3);
});

document.getElementById('ob-skip-2').addEventListener('click', () => showObPane(3));

document.getElementById('ob-goals-grid').addEventListener('click', e => {
  const btn = e.target.closest('.ob-goal-btn');
  if (!btn) return;
  document.querySelectorAll('.ob-goal-btn').forEach(b => b.classList.toggle('ob-goal-btn--selected', b === btn));
});

document.getElementById('ob-finish').addEventListener('click', async () => {
  const uid  = auth.currentUser?.uid;
  const goal = document.querySelector('.ob-goal-btn--selected')?.dataset.goal || '';
  if (uid) {
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'onboarding'), { goal, completedAt: new Date().toISOString() }, { merge: true });
    } catch { /* non-fatal */ }
    localStorage.setItem('budgetly_onboarded_' + uid, '1');
  }
  document.getElementById('onboarding-overlay').style.display = 'none';
  if (_onboardingCallback) _onboardingCallback();
});

// ── Sign In form ──────────────────────────────────────────────────────────────
document.getElementById('signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errorEl  = document.getElementById('signin-error');
  const btn      = e.target.querySelector('[type=submit]');

  errorEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Signing in…';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const name = cred.user.displayName || cred.user.email.split('@')[0];
    showWelcomeToast(name, () => window.location.replace('./app.html'));
  } catch (err) {
    errorEl.textContent = friendlyError(err.code);
    btn.disabled = false; btn.textContent = 'Sign In';
  }
});

// ── Sign Up form ──────────────────────────────────────────────────────────────
document.getElementById('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  const errorEl  = document.getElementById('signup-error');
  const btn      = e.target.querySelector('[type=submit]');

  errorEl.textContent = '';

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.'; return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating account…';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    const displayName = name || email.split('@')[0];
    showWelcomeToast(displayName, () => window.location.replace('./app.html'));
  } catch (err) {
    errorEl.textContent = friendlyError(err.code);
    btn.disabled = false; btn.textContent = 'Create Account';
  }
});

// ── Social auth (shared) ──────────────────────────────────────────────────────
async function socialAuth(provider, errorElId) {
  const errorEl = document.getElementById(errorElId);
  errorEl.textContent = '';
  try {
    const cred = await signInWithPopup(auth, provider);
    const name = cred.user.displayName || cred.user.email?.split('@')[0] || 'there';
    showWelcomeToast(name, () => window.location.replace('./app.html'));
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') return;
    errorEl.textContent = friendlyError(err.code);
  }
}

document.getElementById('signin-google').addEventListener('click', () => socialAuth(googleProvider, 'signin-error'));
document.getElementById('signup-google').addEventListener('click', () => socialAuth(googleProvider, 'signup-error'));

// ── Forgot password ───────────────────────────────────────────────────────────
document.getElementById('forgot-btn').addEventListener('click', async () => {
  const email   = document.getElementById('signin-email').value.trim();
  const errorEl = document.getElementById('signin-error');
  if (!email) { errorEl.textContent = 'Enter your email above first.'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    errorEl.style.color      = '#2d7a3a';
    errorEl.style.background = '#edf7f0';
    errorEl.style.borderColor = '#a8d5b5';
    errorEl.textContent      = `Reset link sent to ${email}.`;
  } catch (err) {
    errorEl.style.color = '';
    errorEl.style.background = '';
    errorEl.style.borderColor = '';
    errorEl.textContent = friendlyError(err.code);
  }
});

// ── Password toggles ─────────────────────────────────────────────────────────
document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.querySelector('.eye-icon').style.display     = isText ? '' : 'none';
    btn.querySelector('.eye-off-icon').style.display = isText ? 'none' : '';
  });
});

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(code) {
  return ({
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/user-not-found':          'No account found with that email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/invalid-credential':      'Invalid email or password.',
    'auth/operation-not-allowed':   'This sign-in method is not enabled.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
  })[code] || `Something went wrong (${code}).`;
}

// ── Scroll & animations ───────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-animate]').forEach(el => revealObserver.observe(el));

const heroMockup = document.getElementById('hero-mockup');
if (heroMockup) {
  const BASE_X = 6, BASE_Y = -14, MAX_DELTA = 8;
  document.addEventListener('mousemove', e => {
    const dx = (e.clientX - window.innerWidth  / 2) / (window.innerWidth  / 2);
    const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    heroMockup.style.transform = `rotateX(${BASE_X + dy * MAX_DELTA}deg) rotateY(${BASE_Y - dx * MAX_DELTA}deg)`;
    heroMockup.style.animation = 'none';
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    heroMockup.style.transform = '';
    heroMockup.style.animation = '';
  });
}

function runCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const start  = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / 1400, 1);
    el.textContent = prefix + Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else { el.textContent = prefix + target + suffix; el.classList.add('pop'); }
  })(start);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => runCounter(el), i * 120));
      statsObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
const statsSection = document.querySelector('.about-stats');
if (statsSection) statsObserver.observe(statsSection);

// ── 3D continuous float + mouse-tracking tilt on feature cards ────────────────
document.querySelectorAll('[data-tilt]').forEach(card => {
  let raf = null;

  card.addEventListener('mouseenter', () => {
    card.classList.add('is-hovered');
    card.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease';
  });

  card.addEventListener('mousemove', e => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
      card.style.transform = `perspective(900px) rotateX(${-dy * 12}deg) rotateY(${dx * 12}deg) scale3d(1.04,1.04,1.04)`;
      card.style.boxShadow = `${-dx * 18}px ${dy * 18}px 52px rgba(0,0,0,0.18), 0 8px 28px rgba(0,0,0,0.10)`;
    });
  });

  card.addEventListener('mouseleave', () => {
    if (raf) cancelAnimationFrame(raf);
    card.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s ease';
    card.style.transform  = '';
    card.style.boxShadow  = '';
    setTimeout(() => {
      card.style.transition = '';
      card.classList.remove('is-hovered');
    }, 550);
  });
});

initPageTransitions();
