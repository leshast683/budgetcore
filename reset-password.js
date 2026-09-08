// ============================================================
// BudgetCore — reset-password.js
// Landing page for Supabase's password-recovery email link.
// ============================================================

import { supabase } from './supabase.js';

const form      = document.getElementById('reset-form');
const errorEl   = document.getElementById('reset-error');
const submitBtn = document.getElementById('reset-submit');

// Supabase parses the recovery token out of the URL on load and fires this
// event once a temporary "recovery" session is established.
let recoveryReady = false;
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') recoveryReady = true;
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('reset-password').value;
  const confirm  = document.getElementById('reset-confirm').value;

  errorEl.textContent = '';

  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters.'; return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.'; return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating…';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    errorEl.textContent = recoveryReady
      ? (error.message || 'Something went wrong. Please try again.')
      : 'This reset link is invalid or has expired. Request a new one from the sign-in page.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
    return;
  }

  submitBtn.textContent = 'Password Updated ✓';
  errorEl.style.color = '#2d7a3a';
  errorEl.style.background = '#edf7f0';
  errorEl.style.borderColor = '#a8d5b5';
  errorEl.textContent = 'Redirecting you to sign in…';
  setTimeout(() => { window.location.replace('./index.html'); }, 1500);
});
