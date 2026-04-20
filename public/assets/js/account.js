// =========================================================
// Account page: sign in / sign up / Google / reset / signed-in view.
// =========================================================
import { initNav } from './nav.js';
import { Auth } from './auth.js';

function $(s, r = document) { return r.querySelector(s); }

function showError(msg) {
  const box = $('#auth-error');
  box.innerHTML = `<i data-lucide="alert-circle"></i> ${msg}`;
  box.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
}
function clearError() { $('#auth-error').style.display = 'none'; }

function renderForUser(user) {
  if (user) {
    $('#auth-form-section').style.display    = 'none';
    $('#auth-account-section').style.display = 'block';
    $('#acc-email').textContent = user.email || '—';
    $('#acc-method').textContent = (user.providerData[0]?.providerId || 'password').replace('.com', '');
    $('#acc-created').textContent = user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toLocaleDateString()
      : '—';
  } else {
    $('#auth-form-section').style.display    = 'block';
    $('#auth-account-section').style.display = 'none';
  }
  if (window.lucide) window.lucide.createIcons();
}

function bindTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const mode = t.dataset.tab;
      $('#submit-btn').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
      $('#submit-btn').dataset.mode = mode;
      $('#forgot-link').style.display = mode === 'signin' ? 'inline' : 'none';
    }),
  );
}

async function submit() {
  clearError();
  const mode  = $('#submit-btn').dataset.mode || 'signin';
  const email = $('#email').value.trim();
  const pw    = $('#password').value;
  if (!email || !pw) return showError('Email and password are required.');
  if (pw.length < 6) return showError('Password must be at least 6 characters.');
  $('#submit-btn').disabled = true;
  try {
    if (mode === 'signin') await Auth.signInEmail(email, pw);
    else                   await Auth.signUpEmail(email, pw);
  } catch (e) {
    showError(prettyAuthError(e));
  } finally {
    $('#submit-btn').disabled = false;
  }
}

async function google() {
  clearError();
  try { await Auth.signInGoogle(); }
  catch (e) { showError(prettyAuthError(e)); }
}

async function forgot() {
  clearError();
  const email = $('#email').value.trim();
  if (!email) return showError('Enter your email above first.');
  try {
    await Auth.resetPassword(email);
    const box = $('#auth-error');
    box.className = 'alert alert--ok';
    box.innerHTML = `<i data-lucide="mail-check"></i> Reset email sent — check your inbox.`;
    box.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  } catch (e) { showError(prettyAuthError(e)); }
}

function prettyAuthError(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email':      'That email address looks invalid.',
    'auth/email-already-in-use':'An account with this email already exists.',
    'auth/weak-password':      'Password is too weak (minimum 6 characters).',
    'auth/popup-closed-by-user':'Sign in was cancelled.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/api-key-not-valid': 'Firebase is not configured yet. Add your API key in firebase-init.js.',
  };
  return map[code] || e?.message || 'Something went wrong.';
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  bindTabs();
  $('#submit-btn').addEventListener('click', submit);
  $('#google-btn').addEventListener('click', google);
  $('#forgot-link').addEventListener('click', (e) => { e.preventDefault(); forgot(); });
  $('#signout-btn').addEventListener('click', () => Auth.signOut());

  Auth.onChange(renderForUser);
});
