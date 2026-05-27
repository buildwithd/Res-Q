// ============================================
//  ResQ — Report Page Logic
//  Handles: form submit, issue feed,
//           upvoting, photo upload, filters
// ============================================

/* ===== State ===== */
let allIssues    = [];
let currentFilter = 'All';
let currentSort   = 'newest';
let offset        = 0;
const LIMIT       = CONFIG.items_per_page;
let hasMore       = false;

/* ===== DOM ===== */
const reportForm   = document.getElementById('reportForm');
const submitBtn    = document.getElementById('submitBtn');
const issueList    = document.getElementById('issueList');
const issueCount   = document.getElementById('issueCount');
const searchInput  = document.getElementById('searchInput');
const sortSelect   = document.getElementById('sortSelect');
const loadMoreBtn  = document.getElementById('loadMoreBtn');
const successModal = document.getElementById('successModal');
const successClose = document.getElementById('successClose');
const uploadArea   = document.getElementById('uploadArea');
const photoInput   = document.getElementById('photoInput');
const charCount    = document.getElementById('charCount');
const issueDesc    = document.getElementById('issueDesc');
const categoryEl   = document.getElementById('issueCategory');

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  populateCategories();
  fetchIssues();
  bindEvents();
});

/* ===== Populate category dropdown ===== */
function populateCategories() {
  CONFIG.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    categoryEl.appendChild(opt);
  });
}

/* ===== Bind UI events ===== */
function bindEvents() {

  // Character counter
  issueDesc.addEventListener('input', () => {
    charCount.textContent = `${issueDesc.value.length} / 500`;
  });

  // Photo upload area click
  uploadArea.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5MB', 'warn');
      photoInput.value = '';
      return;
    }
    uploadArea.classList.add('has-file');
    uploadArea.innerHTML = `
      <div class="upload-icon">🖼️</div>
      <div style="font-weight:600;">${file.name}</div>
      <div style="font-size:11px; margin-top:4px; color:var(--text-3);">
        ${(file.size / 1024).toFixed(0)} KB · Click to change
      </div>
    `;
    // re-attach hidden input after innerHTML wipe
    const newInput = document.createElement('input');
    newInput.type    = 'file';
    newInput.id      = 'photoInput';
    newInput.accept  = 'image/*';
    newInput.style.display = 'none';
    newInput.addEventListener('change', arguments.callee); // re-bind
    uploadArea.appendChild(newInput);
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      offset        = 0;
      fetchIssues(false);
    });
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    offset      = 0;
    fetchIssues(false);
  });

  // Search (debounced)
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      offset = 0;
      fetchIssues(false);
    }, 350);
  });

  // Load more
  loadMoreBtn.addEventListener('click', () => fetchIssues(true));

  // Success modal close
  successClose.addEventListener('click', () => {
    successModal.classList.remove('open');
  });

  // Severity radio visual update
  document.querySelectorAll('input[name="severity"]').forEach(radio => {
    radio.addEventListener('change', updateSeverityStyles);
  });
}

/* ===== Severity visual ===== */
function updateSeverityStyles() {
  const selected = document.querySelector('input[name="severity"]:checked');
  document.querySelectorAll('.severity-label').forEach(label => {
    label.style.background   = '';
    label.style.borderColor  = '';
    label.style.color        = 'var(--text-2)';
  });
  if (!selected) return;
  const label = selected.nextElementSibling;
  const colors = {
    Low:    { bg: 'var(--ok)',   border: 'var(--ok)',   color: '#fff' },
    Medium: { bg: 'var(--warn)', border: 'var(--warn)', color: '#000' },
    High:   { bg: 'var(--bad)',  border: 'var(--bad)',  color: '#fff' },
  };
  const c = colors[selected.value];
  if (c) {
    label.style.background  = c.bg;
    label.style.borderColor = c.border;
    label.style.color       = c.color;
  }
}

/* ===== Form Submit ===== */
reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title    = document.getElementById('issueTitle').value.trim();
  const category = categoryEl.value;
  const severity = document.querySelector('input[name="severity"]:checked')?.value;
  const desc     = issueDesc.value.trim();

  // Validate
  if (!title)    return showToast('Please add a title', 'warn');
  if (!category) return showToast('Please select a category', 'warn');
  if (!severity) return showToast('Please select severity', 'warn');
  if (!desc)     return showToast('Please describe the issue', 'warn');

  submitBtn.disabled     = true;
  submitBtn.innerHTML    = '<span class="spinner"></span> Submitting...';

  try {
    let photoUrl = null;

    // Upload photo if provided
    const file = document.getElementById('photoInput')?.files[0];
    if (file) {
      photoUrl = await uploadPhoto(file);
    }

    // Insert issue
    const { error } = await supabase.from('issues').insert({
      student_id:  getStudentId(),
      title,
      category,
      severity,
      description: desc,
      photo_url:   photoUrl,
    });

    if (error) throw error;

    // Reset form
    reportForm.reset();
    resetUploadArea();
    document.querySelectorAll('.severity-label').forEach(l => {
      l.style.background = '';
      l.style.borderColor = '';
      l.style.color = 'var(--text-2)';
    });
    charCount.textContent = '0 / 500';

    // Show success
    successModal.classList.add('open');

    // Refresh feed
    offset = 0;
    fetchIssues(false);

  } catch (err) {
    console.error(err);
    showToast('Failed to submit. Please try again.', 'bad');
  } finally {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = 'Submit Report';
  }
});

/* ===== Upload Photo to Supabase Storage ===== */
async function uploadPhoto(file) {
  const ext      = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path     = `issue-photos/${fileName}`;

  const { error } = await supabase.storage
    .from('resq-uploads')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.warn('Photo upload failed:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('resq-uploads').getPublicUrl(path);
  return data.publicUrl;
}

/* ===== Reset upload area ===== */
function resetUploadArea() {
  uploadArea.classList.remove('has-file');
  uploadArea.innerHTML = `
    <div class="upload-icon">📷</div>
    <div>Click to upload a photo</div>
    <div style="font-size:11px; margin-top:4px; color:var(--text-3);">JPG, PNG up to 5MB</div>
    <input type="file" id="photoInput" accept="image/*" style="display:none;" />
  `;
  document.getElementById('photoInput').addEventListener('change', handlePhotoChange);
  uploadArea.addEventListener('click', () => document.getElementById('photoInput').click());
}

function handlePhotoChange() {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Photo must be under 5MB', 'warn');
    return;
  }
  uploadArea.classList.add('has-file');
  uploadArea.querySelector('div:first-child').textContent = '🖼️';
  uploadArea.querySelector('div:nth-child(2)').textContent = file.name;
}

/* ===== Fetch Issues ===== */
async function fetchIssues(append = false) {
  if (!append) {
    offset = 0;
    issueList.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  }

  try {
    let query = supabase
      .from('issues')
      .select('*', { count: 'exact' });

    // Status filter
    if (currentFilter !== 'All') query = query.eq('status', currentFilter);

    // Search
    const search = searchInput.value.trim();
    if (search) query = query.ilike('title', `%${search}%`);

    // Sort
    if (currentSort === 'newest')   query = query.order('created_at', { ascending: false });
    if (currentSort === 'upvotes')  query = query.order('upvotes',    { ascending: false });
    if (currentSort === 'severity') {
      // order by custom severity weight
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + LIMIT - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    hasMore = (offset + LIMIT) < count;

    // Severity sort client-side (Supabase can't sort by custom order)
    let issues = data || [];
    if (currentSort === 'severity') {
      const weight = { High: 3, Medium: 2, Low: 1 };
      issues = issues.sort((a, b) => (weight[b.severity] || 0) - (weight[a.severity] || 0));
    }

    if (!append) {
      allIssues = issues;
      if (!append) offset = 0;
    } else {
      allIssues = [...allIssues, ...issues];
    }

    offset += issues.length;

    renderIssues(allIssues, count, append);

  } catch (err) {
    console.error(err);
    issueList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Failed to load issues</div>
        <div class="empty-sub">Check your Supabase config in config.js</div>
      </div>`;
  }
}

/* ===== Render Issues ===== */
function renderIssues(issues, totalCount, append = false) {
  issueCount.textContent = `${totalCount} issue${totalCount !== 1 ? 's' : ''} found`;
  loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';

  if (!issues.length) {
    issueList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No issues found</div>
        <div class="empty-sub">Be the first to report a problem.</div>
      </div>`;
    return;
  }

  const votedIssues = JSON.parse(localStorage.getItem('resq-voted') || '[]');
  const html = issues.map((issue, i) => renderIssueCard(issue, votedIssues, i)).join('');

  if (append) {
    issueList.insertAdjacentHTML('beforeend', html);
  } else {
    issueList.innerHTML = html;
  }

  // Bind upvote buttons
  document.querySelectorAll('.upvote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleUpvote(btn.dataset.id));
  });
}

/* ===== Render single issue card ===== */
function renderIssueCard(issue, votedIssues, index) {
  const voted   = votedIssues.includes(issue.id);
  const delay   = index * 50;
  const hasPhoto = issue.photo_url
    ? `<img src="${issue.photo_url}" alt="Issue photo"
        style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; margin-top:4px;" />`
    : '';

  return `
    <div class="issue-card" style="animation-delay:${delay}ms;">
      <div class="issue-card-header">
        <div>
          <div class="issue-card-title">${escapeHtml(issue.title)}</div>
          <div class="issue-card-meta" style="margin-top:6px;">
            ${statusBadge(issue.status)}
            ${severityBadge(issue.severity)}
            <span class="badge" style="background:var(--surface-2); color:var(--text-2);">
              ${issue.category}
            </span>
          </div>
        </div>
      </div>

      <div class="issue-card-desc">${escapeHtml(issue.description)}</div>

      ${hasPhoto}

      <div class="issue-card-footer">
        <span class="issue-time">${timeAgo(issue.created_at)}</span>
        <button
          class="upvote-btn ${voted ? 'voted' : ''}"
          data-id="${issue.id}"
          ${voted ? 'disabled' : ''}
        >
          ▲ ${issue.upvotes || 0}
        </button>
      </div>
    </div>`;
}

/* ===== Upvote ===== */
async function handleUpvote(issueId) {
  const studentId   = getStudentId();
  const votedIssues = JSON.parse(localStorage.getItem('resq-voted') || '[]');

  if (votedIssues.includes(issueId)) return;

  try {
    // Insert upvote log (unique constraint prevents duplicates)
    const { error: logError } = await supabase
      .from('upvote_log')
      .insert({ issue_id: issueId, student_id: studentId });

    if (logError) {
      showToast('Already upvoted', 'warn');
      return;
    }

    // Increment upvote count
    const { data: current } = await supabase
      .from('issues')
      .select('upvotes')
      .eq('id', issueId)
      .single();

    await supabase
      .from('issues')
      .update({ upvotes: (current?.upvotes || 0) + 1 })
      .eq('id', issueId);

    // Update local storage
    votedIssues.push(issueId);
    localStorage.setItem('resq-voted', JSON.stringify(votedIssues));

    // Update UI
    const btn = document.querySelector(`.upvote-btn[data-id="${issueId}"]`);
    if (btn) {
      const count = parseInt(btn.textContent.replace('▲', '').trim()) + 1;
      btn.textContent = `▲ ${count}`;
      btn.classList.add('voted');
      btn.disabled = true;
    }

    showToast('Upvoted!', 'ok');

  } catch (err) {
    console.error(err);
    showToast('Failed to upvote', 'bad');
  }
}

/* ===== XSS protection ===== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}