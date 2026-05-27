// ============================================
//  ResQ — Supabase Configuration
//  Replace the values below with your own
//  from: supabase.com → Project Settings → API
// ============================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
//  App Config
// ============================================

const CONFIG = {
  app_name:       'ResQ',
  version:        '1.0.0',
  items_per_page: 10,

  categories: [
    'Maintenance',
    'Electrical',
    'Plumbing',
    'Cleanliness',
    'Safety',
    'Internet / Wi-Fi',
    'Furniture',
    'Other',
  ],

  severities: ['Low', 'Medium', 'High'],

  statuses: ['Pending', 'In Progress', 'Resolved'],
};

// ============================================
//  Theme Toggle
// ============================================

function initTheme() {
  const saved = localStorage.getItem('resq-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('resq-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ============================================
//  Toast Notifications
// ============================================

function showToast(message, type = 'ok', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { ok: '✅', warn: '⚠️', bad: '❌' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '💬'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
//  Utility Helpers
// ============================================

// Format timestamp → "2 hours ago" style
function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Capitalize first letter
function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// Get student ID from localStorage (set on first report)
function getStudentId() {
  let id = localStorage.getItem('resq-student-id');
  if (!id) {
    id = 'STU-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('resq-student-id', id);
  }
  return id;
}

// Badge HTML for status
function statusBadge(status) {
  const map = {
    'Pending':     'badge-pending',
    'In Progress': 'badge-progress',
    'Resolved':    'badge-resolved',
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// Badge HTML for severity
function severityBadge(severity) {
  const map = {
    'Low':    'badge-low',
    'Medium': 'badge-medium',
    'High':   'badge-high',
  };
  return `<span class="badge ${map[severity] || ''}">${severity}</span>`;
}

// Run on every page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});