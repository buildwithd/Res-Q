// ============================================
//  ResQ — Admin Panel Logic
//  Handles: login, issue table, status update,
//           bulk actions, drawer, CSV export
// ============================================

/* ===== Admin password — change before deploying ===== */
const ADMIN_PASSWORD = 'resq2025';

/* ===== State ===== */
let allIssues    = [];
let filtered     = [];
let selectedIds  = new Set();
let deleteTarget = null;

/* ===== DOM ===== */
const loginGate    = document.getElementById('loginGate');
const adminPanel   = document.getElementById('adminPanel');
const adminPass    = document.getElementById('adminPass');
const loginBtn     = document.getElementById('loginBtn');
const logoutBtn    = document.getElementById('logoutBtn');
const manageBody   = document.getElementById('manageBody');
const aSearch      = document.getElementById('aSearch');
const aStatusFilter   = document.getElementById('aStatusFilter');
const aSeverityFilter = document.getElementById('aSeverityFilter');
const aCategoryFilter = document.getElementById('aCategoryFilter');
const selectAll    = document.getElementById('selectAll');
const bulkBar      = document.getElementById('bulkBar');
const bulkCount    = document.getElementById('bulkCount');
const drawerOverlay = document.getElementById('drawerOverlay');
const issueDrawer  = document.getElementById('issueDrawer');
const drawerContent = document.getElementById('drawerContent');
const deleteModal  = document.getElementById('deleteModal');

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  populateCategoryFilter();

  // Check if already logged in this session
  if (sessionStorage.getItem('resq-admin') === 'true') {
    showAdminPanel();
  }

  bindEvents();
});

/* ===== Populate category filter ===== */
function populateCategoryFilter() {
  CONFIG.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    aCategoryFilter.appendChild(opt);
  });
}

/* ===== Bind events ===== */
function bindEvents() {

  // Login
  loginBtn.addEventListener('click', handleLogin);
  adminPass.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('resq-admin');
    loginGate.style.display  = 'flex';
    adminPanel.classList.remove('visible');
    logoutBtn.style.display  = 'none';
    adminPass.value          = '';
  });

  // Filters
  let searchTimer;
  aSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
  aStatusFilter.addEventListener('change',   applyFilters);
  aSeverityFilter.addEventListener('change', applyFilters);
  aCategoryFilter.addEventListener('change', applyFilters);

  // Refresh
  document.getElementById('aRefreshBtn').addEventListener('click', fetchIssues);

  // Select all
  selectAll.addEventListener('change', () => {
    const boxes = document.querySelectorAll('.row-checkbox');
    boxes.forEach(cb => {
      cb.checked = selectAll.checked;
      const id   = cb.dataset.id;
      selectAll.checked ? selectedIds.add(id) : selectedIds.delete(id);
    });
    updateBulkBar();
  });

  // Bulk actions
  document.getElementById('bulkProgress').addEventListener('click', () =>
    bulkUpdateStatus('In Progress'));
  document.getElementById('bulkResolve').addEventListener('click', () =>
    bulkUpdateStatus('Resolved'));
  document.getElementById('bulkDelete').addEventListener('click', () =>
    bulkDeleteIssues());

  // Export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

  // Drawer close
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // Delete modal
  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    deleteModal.classList.remove('open');
    deleteTarget = null;
  });
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
}

/* ===== Login ===== */
function handleLogin() {
  if (adminPass.value === ADMIN_PASSWORD) {
    sessionStorage.setItem('resq-admin', 'true');
    showAdminPanel();
  } else {
    showToast('Incorrect password', 'bad');
    adminPass.value = '';
    adminPass.focus();
  }
}

function showAdminPanel() {
  loginGate.style.display = 'none';
  adminPanel.classList.add('visible');
  logoutBtn.style.display = 'inline-flex';
  fetchIssues();
}

/* ===== Fetch all issues ===== */
async function fetchIssues() {
  manageBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; padding:32px;">
        <div class="spinner" style="margin:0 auto;"></div>
      </td>
    </tr>`;

  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allIssues = data || [];
    updateAdminStats(allIssues);
    applyFilters();

  } catch (err) {
    console.error(err);
    manageBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:24px; color:var(--bad);">
          Failed to load issues. Check your Supabase config.
        </td>
      </tr>`;
  }
}

/* ===== Update stat strip ===== */
function updateAdminStats(issues) {
  document.getElementById('aStatTotal').textContent    = issues.length;
  document.getElementById('aStatPending').textContent  = issues.filter(i => i.status === 'Pending').length;
  document.getElementById('aStatProgress').textContent = issues.filter(i => i.status === 'In Progress').length;
  document.getElementById('aStatResolved').textContent = issues.filter(i => i.status === 'Resolved').length;
}

/* ===== Apply filters ===== */
function applyFilters() {
  const search   = aSearch.value.trim().toLowerCase();
  const status   = aStatusFilter.value;
  const severity = aSeverityFilter.value;
  const category = aCategoryFilter.value;

  filtered = allIssues.filter(issue => {
    if (status   !== 'All' && issue.status   !== status)   return false;
    if (severity !== 'All' && issue.severity !== severity) return false;
    if (category !== 'All' && issue.category !== category) return false;
    if (search && !issue.title.toLowerCase().includes(search) &&
        !issue.description.toLowerCase().includes(search))  return false;
    return true;
  });

  selectedIds.clear();
  selectAll.checked = false;
  updateBulkBar();
  renderTable(filtered);
}

/* ===== Render table ===== */
function renderTable(issues) {
  if (!issues.length) {
    manageBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px; color:var(--text-3);">
          No issues match your filters.
        </td>
      </tr>`;
    return;
  }

  manageBody.innerHTML = issues.map(issue => `
    <tr id="row-${issue.id}">
      <td>
        <input
          type="checkbox"
          class="table-checkbox row-checkbox"
          data-id="${issue.id}"
          ${selectedIds.has(issue.id) ? 'checked' : ''}
        />
      </td>
      <td class="td-title" title="${escapeHtml(issue.title)}">${escapeHtml(issue.title)}</td>
      <td>
        <span class="badge" style="background:var(--surface-2); color:var(--text-2);">
          ${issue.category}
        </span>
      </td>
      <td>${severityBadge(issue.severity)}</td>
      <td style="font-weight:600; color:var(--text);">▲ ${issue.upvotes || 0}</td>
      <td>
        <select
          class="status-select"
          data-id="${issue.id}"
          onchange="updateStatus('${issue.id}', this.value)"
        >
          ${CONFIG.statuses.map(s => `
            <option value="${s}" ${issue.status === s ? 'selected' : ''}>${s}</option>
          `).join('')}
        </select>
      </td>
      <td style="white-space:nowrap;">${timeAgo(issue.created_at)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="openDrawer('${issue.id}')">View</button>
          <button class="btn btn-danger btn-sm" onclick="promptDelete('${issue.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Bind row checkboxes
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.checked ? selectedIds.add(cb.dataset.id) : selectedIds.delete(cb.dataset.id);
      selectAll.checked = selectedIds.size === filtered.length;
      updateBulkBar();
    });
  });
}

/* ===== Update single issue status ===== */
async function updateStatus(id, newStatus) {
  try {
    const { error } = await supabase
      .from('issues')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Update local state
    const issue = allIssues.find(i => i.id === id);
    if (issue) issue.status = newStatus;
    updateAdminStats(allIssues);
    showToast(`Status updated to "${newStatus}"`, 'ok');

  } catch (err) {
    console.error(err);
    showToast('Failed to update status', 'bad');
  }
}

/* ===== Bulk status update ===== */
async function bulkUpdateStatus(newStatus) {
  if (!selectedIds.size) return;
  const ids = [...selectedIds];

  try {
    const { error } = await supabase
      .from('issues')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) throw error;

    ids.forEach(id => {
      const issue = allIssues.find(i => i.id === id);
      if (issue) issue.status = newStatus;
    });

    selectedIds.clear();
    selectAll.checked = false;
    updateAdminStats(allIssues);
    applyFilters();
    showToast(`${ids.length} issue${ids.length > 1 ? 's' : ''} marked "${newStatus}"`, 'ok');

  } catch (err) {
    console.error(err);
    showToast('Bulk update failed', 'bad');
  }
}

/* ===== Bulk delete ===== */
async function bulkDeleteIssues() {
  if (!selectedIds.size) return;
  const ids = [...selectedIds];

  if (!confirm(`Delete ${ids.length} selected issue${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;

  try {
    const { error } = await supabase
      .from('issues')
      .delete()
      .in('id', ids);

    if (error) throw error;

    allIssues = allIssues.filter(i => !ids.includes(i.id));
    selectedIds.clear();
    selectAll.checked = false;
    updateAdminStats(allIssues);
    applyFilters();
    showToast(`${ids.length} issue${ids.length > 1 ? 's' : ''} deleted`, 'ok');

  } catch (err) {
    console.error(err);
    showToast('Bulk delete failed', 'bad');
  }
}

/* ===== Bulk bar ===== */
function updateBulkBar() {
  if (selectedIds.size > 0) {
    bulkBar.classList.add('visible');
    bulkCount.textContent = `${selectedIds.size} selected`;
  } else {
    bulkBar.classList.remove('visible');
  }
}

/* ===== Issue detail drawer ===== */
function openDrawer(id) {
  const issue = allIssues.find(i => i.id === id);
  if (!issue) return;

  drawerContent.innerHTML = `
    <div class="drawer-section">
      <div class="drawer-label">Title</div>
      <div class="drawer-value" style="font-weight:600; font-size:16px;">${escapeHtml(issue.title)}</div>
    </div>

    <div class="drawer-section">
      <div class="drawer-label">Description</div>
      <div class="drawer-value">${escapeHtml(issue.description)}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div>
        <div class="drawer-label">Category</div>
        <div class="drawer-value">${issue.category}</div>
      </div>
      <div>
        <div class="drawer-label">Severity</div>
        <div class="drawer-value">${severityBadge(issue.severity)}</div>
      </div>
      <div>
        <div class="drawer-label">Status</div>
        <div class="drawer-value">${statusBadge(issue.status)}</div>
      </div>
      <div>
        <div class="drawer-label">Upvotes</div>
        <div class="drawer-value" style="font-weight:700;">▲ ${issue.upvotes || 0}</div>
      </div>
      <div>
        <div class="drawer-label">Reported</div>
        <div class="drawer-value">${timeAgo(issue.created_at)}</div>
      </div>
      <div>
        <div class="drawer-label">Student ID</div>
        <div class="drawer-value" style="font-size:12px; color:var(--text-3);">${issue.student_id}</div>
      </div>
    </div>

    ${issue.photo_url ? `
      <div class="drawer-section">
        <div class="drawer-label">Photo</div>
        <img src="${issue.photo_url}" alt="Issue photo" class="drawer-photo" />
      </div>
    ` : ''}

    <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
      <select
        class="form-select"
        onchange="updateStatus('${issue.id}', this.value); this.closest('.drawer').querySelector('.drawer-value span') && fetchIssues();"
      >
        ${CONFIG.statuses.map(s => `
          <option value="${s}" ${issue.status === s ? 'selected' : ''}>${s}</option>
        `).join('')}
      </select>
      <button class="btn btn-danger btn-full" onclick="closeDrawer(); promptDelete('${issue.id}');">
        🗑️ Delete Issue
      </button>
    </div>
  `;

  drawerOverlay.classList.add('open');
  issueDrawer.classList.add('open');
}

function closeDrawer() {
  drawerOverlay.classList.remove('open');
  issueDrawer.classList.remove('open');
}

/* ===== Delete single issue ===== */
function promptDelete(id) {
  deleteTarget = id;
  deleteModal.classList.add('open');
}

async function confirmDelete() {
  if (!deleteTarget) return;

  try {
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', deleteTarget);

    if (error) throw error;

    allIssues   = allIssues.filter(i => i.id !== deleteTarget);
    deleteTarget = null;
    deleteModal.classList.remove('open');
    updateAdminStats(allIssues);
    applyFilters();
    showToast('Issue deleted', 'ok');

  } catch (err) {
    console.error(err);
    showToast('Delete failed', 'bad');
  }
}

/* ===== Export CSV ===== */
function exportCSV() {
  if (!filtered.length) {
    showToast('No issues to export', 'warn');
    return;
  }

  const headers = ['Title', 'Category', 'Severity', 'Status', 'Upvotes', 'Description', 'Reported'];
  const rows    = filtered.map(issue => [
    `"${issue.title.replace(/"/g, '""')}"`,
    issue.category,
    issue.severity,
    issue.status,
    issue.upvotes || 0,
    `"${issue.description.replace(/"/g, '""')}"`,
    new Date(issue.created_at).toLocaleString('en-IN'),
  ]);

  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `resq-issues-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();

  showToast(`Exported ${filtered.length} issues`, 'ok');
}

/* ===== XSS protection ===== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}