// ============================================
//  ResQ — Dashboard Logic
//  Handles: stats, charts, condition score,
//           category bars, timeline, table
// ============================================

/* ===== Chart instances (kept for destroy on refresh) ===== */
let statusChart   = null;
let severityChart = null;
let timelineChart = null;

/* ===== Theme-aware chart colors ===== */
function chartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    text:    isDark ? '#94a3b8' : '#475569',
    grid:    isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    surface: isDark ? '#1e293b' : '#ffffff',
  };
}

/* ===== Global Chart.js defaults ===== */
function applyChartDefaults() {
  const c = chartColors();
  Chart.defaults.color          = c.text;
  Chart.defaults.borderColor    = c.grid;
  Chart.defaults.font.family    = "'DM Sans', sans-serif";
  Chart.defaults.font.size      = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.backgroundColor =
    document.documentElement.getAttribute('data-theme') !== 'light'
      ? '#1e293b' : '#ffffff';
  Chart.defaults.plugins.tooltip.titleColor =
    document.documentElement.getAttribute('data-theme') !== 'light'
      ? '#f1f5f9' : '#0f172a';
  Chart.defaults.plugins.tooltip.bodyColor  = c.text;
  Chart.defaults.plugins.tooltip.borderColor = c.grid;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();

  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadDashboard();
  });

  // Re-render charts on theme toggle
  const observer = new MutationObserver(() => {
    applyChartDefaults();
    loadDashboard();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});

/* ===== Main loader ===== */
async function loadDashboard() {
  try {
    applyChartDefaults();
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderStats(issues);
    renderConditionScore(issues);
    renderStatusDonut(issues);
    renderSeverityDonut(issues);
    renderCategoryBars(issues);
    renderTimeline(issues);
    renderRecentTable(issues.slice(0, 8));

    document.getElementById('lastUpdated').textContent =
      'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

/* ===== Stat Cards ===== */
function renderStats(issues) {
  const total    = issues.length;
  const pending  = issues.filter(i => i.status === 'Pending').length;
  const progress = issues.filter(i => i.status === 'In Progress').length;
  const resolved = issues.filter(i => i.status === 'Resolved').length;

  animateCount('statTotal',    total);
  animateCount('statPending',  pending);
  animateCount('statProgress', progress);
  animateCount('statResolved', resolved);
}

function animateCount(id, target) {
  const el    = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  const steps = 30;
  let step    = 0;
  const timer = setInterval(() => {
    step++;
    el.textContent = Math.round(start + (diff * step / steps));
    if (step >= steps) { el.textContent = target; clearInterval(timer); }
  }, 20);
}

/* ===== Hostel Condition Score ===== */
function renderConditionScore(issues) {
  const total    = issues.length;
  const open     = issues.filter(i => i.status !== 'Resolved').length;
  const highOpen = issues.filter(i => i.status !== 'Resolved' && i.severity === 'High').length;

  // Score formula:
  // Start at 100, penalise for open issues weighted by severity
  let penalty = 0;
  if (total > 0) {
    penalty = Math.min(100, Math.round(
      (open / total) * 50 +          // open ratio: up to 50 points
      (highOpen / Math.max(total,1)) * 50  // high severity: up to 50 more
    ));
  }

  const score  = Math.max(0, 100 - penalty);
  const circle = document.getElementById('scoreCircle');
  const valEl  = document.getElementById('scoreValue');
  const descEl = document.getElementById('scoreDesc');

  animateCount('scoreValue', score);

  // Color based on score
  if (score >= 75) {
    circle.style.borderColor  = 'var(--ok)';
    circle.style.background   = 'var(--ok-light)';
    valEl.style.color         = 'var(--ok)';
    descEl.textContent        = 'Good condition. Most issues are resolved.';
  } else if (score >= 50) {
    circle.style.borderColor  = 'var(--warn)';
    circle.style.background   = 'var(--warn-light)';
    valEl.style.color         = 'var(--warn)';
    descEl.textContent        = 'Fair condition. Several open issues need attention.';
  } else {
    circle.style.borderColor  = 'var(--bad)';
    circle.style.background   = 'var(--bad-light)';
    valEl.style.color         = 'var(--bad)';
    descEl.textContent        = 'Poor condition. Multiple high-severity issues unresolved.';
  }
}

/* ===== Donut chart helper ===== */
function buildDonut(canvasId, legendId, labels, values, colors) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Destroy existing
  if (canvasId === 'statusDonut'   && statusChart)   { statusChart.destroy();   statusChart   = null; }
  if (canvasId === 'severityDonut' && severityChart) { severityChart.destroy(); severityChart = null; }

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderWidth:     2,
        borderColor:     document.documentElement.getAttribute('data-theme') !== 'light'
          ? '#1e293b' : '#ffffff',
        hoverOffset:     6,
      }],
    },
    options: {
      cutout:     '68%',
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
    },
  });

  if (canvasId === 'statusDonut')   statusChart   = chart;
  if (canvasId === 'severityDonut') severityChart = chart;

  // Build legend
  const legendEl = document.getElementById(legendId);
  if (!legendEl) return;
  legendEl.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${colors[i]};"></div>
        ${label}
      </div>
      <span class="legend-val">${values[i]}</span>
    </div>
  `).join('');
}

/* ===== Status Donut ===== */
function renderStatusDonut(issues) {
  const pending  = issues.filter(i => i.status === 'Pending').length;
  const progress = issues.filter(i => i.status === 'In Progress').length;
  const resolved = issues.filter(i => i.status === 'Resolved').length;

  buildDonut(
    'statusDonut', 'statusLegend',
    ['Pending', 'In Progress', 'Resolved'],
    [pending, progress, resolved],
    ['#fbbf24', '#60a5fa', '#34d399'],
  );
}

/* ===== Severity Donut ===== */
function renderSeverityDonut(issues) {
  const low    = issues.filter(i => i.severity === 'Low').length;
  const medium = issues.filter(i => i.severity === 'Medium').length;
  const high   = issues.filter(i => i.severity === 'High').length;

  buildDonut(
    'severityDonut', 'severityLegend',
    ['Low', 'Medium', 'High'],
    [low, medium, high],
    ['#34d399', '#fbbf24', '#f87171'],
  );
}

/* ===== Category Bars ===== */
function renderCategoryBars(issues) {
  const container = document.getElementById('categoryBars');
  if (!container) return;

  const counts = {};
  CONFIG.categories.forEach(cat => counts[cat] = 0);
  issues.forEach(issue => {
    if (counts[issue.category] !== undefined) counts[issue.category]++;
  });

  const max = Math.max(...Object.values(counts), 1);

  const barColors = [
    '#f97316', '#60a5fa', '#34d399', '#fbbf24',
    '#f87171', '#a78bfa', '#fb7185', '#2dd4bf',
  ];

  container.innerHTML = CONFIG.categories.map((cat, i) => {
    const count = counts[cat];
    const pct   = Math.round((count / max) * 100);
    return `
      <div class="trend-bar-row">
        <div class="trend-bar-label">${cat}</div>
        <div class="trend-bar-track">
          <div class="trend-bar-fill"
            style="width:0%; background:${barColors[i % barColors.length]};"
            data-width="${pct}">
          </div>
        </div>
        <div class="trend-bar-count">${count}</div>
      </div>`;
  }).join('');

  // Animate bars after render
  requestAnimationFrame(() => {
    container.querySelectorAll('.trend-bar-fill').forEach(bar => {
      setTimeout(() => {
        bar.style.width = bar.dataset.width + '%';
      }, 100);
    });
  });
}

/* ===== Timeline (last 14 days) ===== */
function renderTimeline(issues) {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  if (timelineChart) { timelineChart.destroy(); timelineChart = null; }

  // Build last 14 days labels
  const days   = 14;
  const labels = [];
  const counts = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const dateStr = d.toISOString().slice(0, 10);

    labels.push(label);
    counts.push(
      issues.filter(issue => issue.created_at.slice(0, 10) === dateStr).length
    );
  }

  const c = chartColors();

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:           'Issues Reported',
        data:            counts,
        borderColor:     '#f97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
        borderWidth:     2,
        pointRadius:     4,
        pointBackgroundColor: '#f97316',
        pointBorderColor:     '#f97316',
        fill:            true,
        tension:         0.4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid:  { color: c.grid },
          ticks: { color: c.text, maxTicksLimit: 7 },
        },
        y: {
          grid:       { color: c.grid },
          ticks:      { color: c.text, stepSize: 1, precision: 0 },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0].label,
            label: item  => ` ${item.raw} issue${item.raw !== 1 ? 's' : ''} reported`,
          },
        },
      },
    },
  });
}

/* ===== Recent Issues Table ===== */
function renderRecentTable(issues) {
  const tbody = document.getElementById('recentBody');
  if (!tbody) return;

  if (!issues.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-3);">No issues yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = issues.map(issue => `
    <tr>
      <td class="td-title" title="${escapeHtml(issue.title)}">${escapeHtml(issue.title)}</td>
      <td>
        <span class="badge" style="background:var(--surface-2); color:var(--text-2);">
          ${issue.category}
        </span>
      </td>
      <td>${severityBadge(issue.severity)}</td>
      <td>${statusBadge(issue.status)}</td>
      <td style="font-weight:600; color:var(--text);">▲ ${issue.upvotes || 0}</td>
      <td>${timeAgo(issue.created_at)}</td>
    </tr>
  `).join('');
}

/* ===== XSS protection ===== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}