// ============================================================
//  js/stats.js — Chart rendering and stats calculations
// ============================================================

// ── Shared Chart.js defaults ──────────────────────────────
const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1a1a2e',
      titleColor:      '#eeeaf8',
      bodyColor:       '#8b89ad',
      borderColor:     'rgba(255,255,255,0.08)',
      borderWidth:     1,
      cornerRadius:    10,
      padding:         12,
    },
  },
};
const SCALE_STYLE = {
  grid:  { color: 'rgba(255,255,255,0.04)', drawBorder: false },
  ticks: { color: '#4e4c6a', font: { size: 11, family: "'DM Sans', sans-serif" } },
};

let barChart = null, pieChart = null, dashBarChart = null;

// ── Dashboard bar chart ───────────────────────────────────
export function renderDashBar(canvasId, activities, days = 7) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = [], data = [];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d  = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    labels.push(days <= 7 ? DAY_NAMES[d.getDay()] : (i % 5 === 0 ? ds.slice(5) : ''));
    data.push((activities || []).filter(a => a.date === ds).length);
  }

  const maxVal = Math.max(...data, 1);
  if (dashBarChart) dashBarChart.destroy();
  dashBarChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v =>
          v === 0 ? 'rgba(124,106,247,0.1)' :
          v >= maxVal * 0.7 ? 'rgba(124,106,247,0.9)' : 'rgba(124,106,247,0.55)'
        ),
        borderRadius: 6, borderSkipped: false,
      }],
    },
    options: {
      ...CHART_BASE,
      scales: {
        x: { ...SCALE_STYLE, grid: { display: false } },
        y: { ...SCALE_STYLE, beginAtZero: true, ticks: { ...SCALE_STYLE.ticks, stepSize: 1 } },
      },
    },
  });
}

// ── Stats page 30-day bar chart ───────────────────────────
export function renderStatsBar(canvasId, activities) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = [], data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d  = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    labels.push(i % 5 === 0 ? ds.slice(5) : '');
    data.push((activities || []).filter(a => a.date === ds).length);
  }

  if (barChart) barChart.destroy();
  barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v =>
          v > 2 ? 'rgba(124,106,247,0.9)' : v > 0 ? 'rgba(124,106,247,0.5)' : 'rgba(124,106,247,0.1)'
        ),
        borderRadius: 4, borderSkipped: false,
      }],
    },
    options: {
      ...CHART_BASE,
      scales: {
        x: { ...SCALE_STYLE, grid: { display: false } },
        y: { ...SCALE_STYLE, beginAtZero: true, ticks: { ...SCALE_STYLE.ticks, stepSize: 1 } },
      },
    },
  });
}

// ── Activity type doughnut ────────────────────────────────
export function renderPieChart(canvasId, activities) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Count by type directly here — no external import needed
  const typeCounts = (activities || []).reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(typeCounts).map(t => t.split(' ').slice(1).join(' ') || t);
  const values = Object.values(typeCounts);
  const COLORS  = [
    'rgba(124,106,247,0.85)', 'rgba(32,217,160,0.85)',
    'rgba(245,166,35,0.85)',  'rgba(255,107,107,0.85)',
    'rgba(78,168,222,0.85)',  'rgba(165,148,249,0.85)',
  ];

  if (pieChart) pieChart.destroy();

  if (!values.length) {
    canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Add activities to see breakdown</p></div>`;
    return;
  }

  pieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: COLORS.slice(0, values.length), borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      ...CHART_BASE,
      cutout: '65%',
      plugins: {
        ...CHART_BASE.plugins,
        legend: {
          display: true, position: 'bottom',
          labels: { color: '#8b89ad', font: { size: 11 }, padding: 14, boxWidth: 12, boxHeight: 12 },
        },
      },
    },
  });
}

// ── Heatmap ───────────────────────────────────────────────
export function renderHeatmap(containerId, activities) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const actDays = (activities || []).reduce((acc, a) => {
    acc[a.date] = (acc[a.date] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const startDay = new Date(now); startDay.setDate(startDay.getDate() - 34);
  container.innerHTML = '';

  for (let i = 0; i < 35; i++) {
    const d   = new Date(startDay); d.setDate(startDay.getDate() + i);
    const ds  = d.toISOString().split('T')[0];
    const cnt = actDays[ds] || 0;
    const cell = document.createElement('div');
    cell.className = `heat-cell heat-${Math.min(cnt, 4)}`;
    cell.title = `${ds}${cnt ? ': ' + cnt + ' completed' : ': none'}`;
    container.appendChild(cell);
  }
}

// ── Helpers ───────────────────────────────────────────────
export function formatDuration(totalMins) {
  if (totalMins >= 60) return (totalMins / 60).toFixed(1) + 'h';
  return totalMins + 'm';
}

export function getFavType(activities) {
  const counts = (activities || []).reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0].split(' ')[0] : '—';
}
