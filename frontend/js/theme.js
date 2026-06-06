// ============================================================
//  theme.js — Dark / Light mode toggle with persistence
// ============================================================

const STORAGE_KEY = 'stride_theme';

// Apply saved theme immediately (call before DOM paint)
export function applyTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateToggleIcon(saved);
}

// Toggle between dark and light
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY, next);
  updateToggleIcon(next);
}

function updateToggleIcon(theme) {
  const btns = document.querySelectorAll('.theme-toggle');
  btns.forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title       = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

// Auto-init on import
applyTheme();
