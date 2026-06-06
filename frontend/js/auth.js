// ============================================================
//  js/auth.js — Login, signup, logout, session restore
//  NOTE: No imports from dashboard.js (avoids circular deps)
// ============================================================
import { sb } from './supabase.js';

// ── Switch between login / signup tabs ───────────────────
export function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('form-login').classList.toggle('hidden',  tab !== 'login');
  document.getElementById('form-signup').classList.toggle('hidden', tab !== 'signup');
  clearError();

  const title = document.getElementById('auth-form-title');
  const sub   = document.getElementById('auth-form-sub');
  if (title) title.textContent = tab === 'login' ? 'Welcome back' : 'Create account';
  if (sub)   sub.textContent   = tab === 'login' ? 'Log in to your STRIDE account' : 'Start tracking today';
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearError() {
  const el = document.getElementById('auth-error');
  if (el) el.style.display = 'none';
}
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
}

// ── Login ─────────────────────────────────────────────────
export async function doLogin() {
  clearError();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showError('Please fill in all fields.');

  setLoading('login-btn', true);
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  setLoading('login-btn', false);

  if (error) return showError(error.message);
  window.location.href = 'dashboard.html';
}

// ── Signup ────────────────────────────────────────────────
export async function doSignup() {
  clearError();
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-pass').value;

  if (!name || !email || !pass) return showError('Please fill in all fields.');
  if (pass.length < 6) return showError('Password must be at least 6 characters.');

  setLoading('signup-btn', true);
  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { name } },
  });
  setLoading('signup-btn', false);

  if (error) return showError(error.message);
  window.location.href = 'dashboard.html';
}



// ── Logout ────────────────────────────────────────────────
export async function doLogout() {
  await sb.auth.signOut();
  window.location.href = '../index.html';
}

// ── Redirect if already logged in ────────────────────────
export async function redirectIfLoggedIn() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) window.location.href = 'dashboard.html';
}
