// ============================================================
//  dashboard.js v5 — Full controller
// ============================================================
import { sb } from './supabase.js';
import { doLogout } from './auth.js';
import { toggleTheme } from './theme.js';
import {
  fetchActivities, createActivity, updateActivity, deleteActivity,
  fetchCompletionsForDate, fetchCompletionsRange,
  toggleCompletion, getActivitiesForDate, isDayComplete,
  computeStreak, groupCompletionsByDate, countByType
} from './activities.js';
import { fetchGoals, fetchGoalProgress, createGoal, incrementGoal, markGoalDone, deleteGoal, getPeriodKey } from './goals.js';
import { BADGES, MILESTONES, getUnlockedBadges, checkAndUnlock, saveStreak } from './achievements.js';
import { getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, removeFriend } from './friends.js';

const TODAY = new Date().toISOString().split('T')[0];
let barChartInst = null, pieChartInst = null, progChartInst = null;

const S = {
  user: null, activities: [], goals: [],
  goalProgress: {},
  unlockedBadges: [], streak: 0, bestStreak: 0,
  todayCompletions: [], completionsByDate: {},
  editingId: null, currentPeriod: 'week',
};

// ── Boot ───────────────────────────────────────────────────
export async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  S.user = session.user;

  const name = session.user.user_metadata?.name || session.user.email.split('@')[0];
  const email = session.user.email;
  setEl('sidebar-name', name); setEl('sidebar-email', email);
  setEl('sidebar-avatar', name[0].toUpperCase());

  const from = daysAgo(365);
  const [activities, goals, profileData, todayC, rangeC] = await Promise.all([
    fetchActivities(), fetchGoals(), getUnlockedBadges(S.user.id),
    fetchCompletionsForDate(TODAY), fetchCompletionsRange(from, TODAY),
  ]);

  S.activities = activities; S.goals = goals;
  S.goalProgress = await fetchGoalProgress(goals);
  S.unlockedBadges = profileData.unlockedBadges;
  S.bestStreak = profileData.bestStreak;
  S.todayCompletions = todayC;
  S.completionsByDate = groupCompletionsByDate(rangeC);
  S.streak = computeStreak(S.activities, S.completionsByDate);

  updateSidebarStreak();
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));
  showSection('today');
}

// ── Navigation ─────────────────────────────────────────────
export function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
  document.getElementById('sec-' + id)?.classList.remove('hidden');
  ({ today: renderToday, manage: renderManage, stats: renderStats, social: renderSocial, email: renderEmailSettings,
     progress: renderProgress, goals: renderGoals,
     achievements: renderAchievements, profile: renderProfile })[id]?.();
}

function updateSidebarStreak() {
  setEl('ss-num', S.streak);
  const w = document.getElementById('sidebar-streak');
  if (w) w.style.display = S.streak > 0 ? 'flex' : 'none';
}

// ══ TODAY ══════════════════════════════════════════════════
function renderToday() {
  const acts = getActivitiesForDate(S.activities, TODAY);
  const doneIds = new Set(S.todayCompletions.filter(c => c.completed).map(c => c.activity_id));
  const done = acts.filter(a => doneIds.has(a.id)).length;
  const total = acts.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  setEl('today-date', new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
  setEl('today-progress-label', `${done} of ${total} activities done`);
  setEl('today-streak-chip', S.streak > 0 ? `🔥 ${S.streak} day streak` : '🌱 Start your streak');

  // Progress bar
  const fill = document.getElementById('today-bar-fill');
  if (fill) { fill.style.width = pct + '%'; fill.className = 'today-bar-fill' + (allDone ? ' done' : ''); }

  // Ring
  const ring = document.getElementById('ring-fill');
  if (ring) {
    const c = 2 * Math.PI * 36; ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c - (c * pct / 100);
    ring.style.stroke = allDone ? 'var(--green)' : 'var(--p)';
  }
  setEl('ring-pct', pct + '%');

  // Done banner
  const banner = document.getElementById('done-banner');
  if (banner) banner.style.display = allDone ? 'flex' : 'none';

  // List
  const list = document.getElementById('today-list');
  if (!list) return;
  if (!total) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No activities scheduled today.<br><a onclick="showSection('manage')" style="color:var(--p);cursor:pointer">Set up activities →</a></p></div>`;
    return;
  }
  list.innerHTML = acts.map(a => {
    const isDone = doneIds.has(a.id);
    return `
    <div class="today-row ${isDone ? 'done' : ''}" id="tr-${a.id}">
      <button class="tick-btn ${isDone ? 'ticked' : ''}" onclick="window.__tick('${a.id}',${isDone})" title="${isDone ? 'Mark pending' : 'Mark done'}">
        ${isDone ? '✓' : ''}
      </button>
      <div class="today-act-emoji">${a.type.split(' ')[0]}</div>
      <div class="today-act-info">
        <div class="today-act-name">${a.name}</div>
        <div class="today-act-meta">
          <span>${a.type.split(' ').slice(1).join(' ')}</span>
          <span class="meta-sep">·</span>
          <span>${a.duration} min</span>
          <span class="meta-sep">·</span>
          <span>${a.intensity}</span>
          ${a.note ? `<span class="meta-sep">·</span><span>${a.note}</span>` : ''}
        </div>
      </div>
      <span class="act-status ${isDone ? 'status-done' : 'status-pending'}">${isDone ? 'Done ✓' : 'Pending'}</span>
      <button class="note-btn" onclick="window.__openNote('${a.id}',${isDone},'')" title="Add note">📝</button>
    </div>`;
  }).join('');
}

window.__tick = async (actId, isDone) => {
  const btn = document.querySelector(`#tr-${actId} .tick-btn`);
  if (btn) btn.style.opacity = '.5';
  try {
    const nowDone = await toggleCompletion(actId, TODAY, isDone);
    if (nowDone) {
      if (!S.todayCompletions.find(c => c.activity_id === actId))
        S.todayCompletions.push({ activity_id: actId, date: TODAY, completed: true });
    } else {
      S.todayCompletions = S.todayCompletions.filter(c => c.activity_id !== actId);
    }
    S.completionsByDate[TODAY] = S.todayCompletions;
    const newStreak = computeStreak(S.activities, S.completionsByDate);
    S.streak = newStreak;
    if (newStreak > S.bestStreak) S.bestStreak = newStreak;
    await saveStreak(S.user.id, S.streak, S.bestStreak);
    // Check badges on EVERY tick (not just streak changes)
    const allCompletions = Object.values(S.completionsByDate).flat().filter(c => c.completed);
    const newBadges = await checkAndUnlock(S.user.id, allCompletions, S.streak, S.unlockedBadges, S.activities);
    if (newBadges.length > 0) {
      S.unlockedBadges = [...S.unlockedBadges, ...newBadges.map(b => b.id)];
      newBadges.forEach(showAchPopup);
    }
    updateSidebarStreak();
    renderToday();
    showToast(nowDone ? 'Marked done! 💪' : 'Marked as pending', nowDone ? '✅' : '↩️');
  } catch(e) { showToast(e.message, '❌'); }
};

// ══ MANAGE ════════════════════════════════════════════════
function renderManage() {
  S.editingId = null; hideAF(); renderManageList();
}
function renderManageList() {
  const el = document.getElementById('manage-list');
  if (!el) return;
  if (!S.activities.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><p>No activities yet. Create your first one!</p></div>`; return; }
  const REC = { daily:'Every day', weekly:'Weekly', monthly:'Monthly', once:'One time' };
  el.innerHTML = S.activities.map(a => `
    <div class="manage-card" id="mc-${a.id}">
      <div class="manage-left">
        <div class="manage-emoji">${a.type.split(' ')[0]}</div>
        <div>
          <div class="manage-name">${a.name}</div>
          <div class="manage-meta">
            ${a.type.split(' ').slice(1).join(' ')}
            <span class="meta-sep">·</span> ${a.duration} min
            <span class="meta-sep">·</span> ${a.intensity}
            <span class="meta-sep">·</span> <span class="pill pill-p" style="font-size:10px">${REC[a.recurrence]||a.recurrence}</span>
          </div>
        </div>
      </div>
      <div class="manage-actions">
        <button class="action-btn edit" onclick="window.__editAct('${a.id}')">✏️ Edit</button>
        <button class="action-btn del"  onclick="window.__delAct('${a.id}')">🗑️ Delete</button>
      </div>
    </div>`).join('');
}
window.__editAct = (id) => { S.editingId = id; showAF(S.activities.find(a => a.id === id)); };
window.__delAct  = async (id) => {
  if (!confirm('Delete this activity?')) return;
  await deleteActivity(id);
  S.activities = S.activities.filter(a => a.id !== id);
  renderManageList(); showToast('Activity deleted','🗑️');
};
function showAF(pre = {}) {
  const f = document.getElementById('af-form'); if (!f) return;
  f.style.display = 'block'; f.scrollIntoView({ behavior:'smooth', block:'nearest' });
  setVal('af-name', pre.name||''); setVal('af-dur', pre.duration||30);
  setVal('af-int', pre.intensity||'Medium'); setVal('af-rec', pre.recurrence||'daily');
  setVal('af-note', pre.note||'');
  document.querySelectorAll('.af-pill').forEach(p => p.classList.toggle('active', p.dataset.type === (pre.type||'🏃 Running')));
  setEl('af-form-title', S.editingId ? '✏️ Edit Activity' : '+ New Activity');
  const dr = document.getElementById('days-row'); if (dr) dr.style.display = pre.recurrence === 'weekly' ? 'flex' : 'none';
}
function hideAF() { const f = document.getElementById('af-form'); if (f) f.style.display = 'none'; S.editingId = null; }

async function submitAF() {
  const name = document.getElementById('af-name').value.trim();
  const duration = document.getElementById('af-dur').value;
  const intensity = document.getElementById('af-int').value;
  const recurrence = document.getElementById('af-rec').value;
  const note = document.getElementById('af-note').value.trim();
  const type = document.querySelector('.af-pill.active')?.dataset.type || '🏃 Running';
  const days_of_week = recurrence === 'weekly'
    ? Array.from(document.querySelectorAll('.day-cb:checked')).map(c => parseInt(c.value))
    : [0,1,2,3,4,5,6];
  if (!name) { showToast('Enter an activity name','⚠️'); return; }
  const btn = document.getElementById('af-submit'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (S.editingId) {
      const u = await updateActivity(S.editingId, { name, type, recurrence, days_of_week, duration: parseInt(duration), intensity, note });
      S.activities = S.activities.map(a => a.id === S.editingId ? u : a);
      showToast('Activity updated ✓','✅');
    } else {
      const n = await createActivity({ name, type, recurrence, days_of_week, duration, intensity, note });
      S.activities.push(n);
      showToast('Activity created! 🎯','✅');
    }
    hideAF(); renderManageList();
  } catch(e) { showToast(e.message,'❌'); }
  finally { btn.disabled = false; btn.textContent = 'Save Activity'; }
}

// ══ STATS ═════════════════════════════════════════════════
function renderStats() {
  const total = Object.values(S.completionsByDate).flat().filter(c => c.completed).length;
  const totalMins = total * 35;
  setEl('st-total', total);
  setEl('st-time', totalMins >= 60 ? (totalMins/60).toFixed(1)+'h' : totalMins+'m');
  setEl('st-streak', S.bestStreak + ' days');
  // Fav type
  const tc = countByType(S.activities);
  const top = Object.entries(tc).sort((a,b)=>b[1]-a[1])[0];
  setEl('st-fav', top ? top[0].split(' ')[0] : '—');

  renderBarChart('stats-bar', 7);
  renderPieChart2();
  renderWeekTracker();
}

function renderBarChart(canvasId, days) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const labels = [], data = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toISOString().split('T')[0];
    labels.push(['S','M','T','W','T','F','S'][d.getDay()]);
    data.push((S.completionsByDate[ds]||[]).filter(c=>c.completed).length);
  }
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(canvas, {
    type:'bar', data:{ labels, datasets:[{ data, backgroundColor: data.map(v => v > 0 ? 'rgba(108,99,255,.75)' : 'rgba(108,99,255,.12)'), borderRadius:5, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10,borderColor:'rgba(255,255,255,.08)',borderWidth:1} },
      scales:{ x:{ grid:{display:false}, ticks:{color:'#4a5280',font:{size:11}} }, y:{ grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#4a5280',stepSize:1,font:{size:11}}, beginAtZero:true } }
    }
  });
}

function renderPieChart2() {
  const canvas = document.getElementById('stats-pie'); if (!canvas) return;
  const tc = countByType(S.activities);
  const labels = Object.keys(tc).map(t => t.split(' ').slice(1).join(' ')||t);
  const values = Object.values(tc);
  const COLS = ['rgba(108,99,255,.85)','rgba(34,197,94,.85)','rgba(245,158,11,.85)','rgba(239,68,68,.85)','rgba(6,182,212,.85)','rgba(236,72,153,.85)'];
  if (pieChartInst) pieChartInst.destroy();
  if (!values.length) { canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Add activities to see breakdown</p></div>`; return; }
  pieChartInst = new Chart(canvas, {
    type:'doughnut', data:{ labels, datasets:[{ data:values, backgroundColor:COLS.slice(0,values.length), borderWidth:0, hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ display:true, position:'bottom', labels:{color:'#8892b0',font:{size:11},padding:12,boxWidth:11,boxHeight:11} },
        tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10,borderColor:'rgba(255,255,255,.08)',borderWidth:1} }
    }
  });
}

function renderWeekTracker() {
  const container = document.getElementById('week-tracker'); if (!container) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Build Mon–Sun of the CURRENT week
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // Find this week's Monday
  const monday = new Date(today);
  const diffToMon = (currentDay === 0) ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + diffToMon);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  container.innerHTML = days.map((day, idx) => {
    const date = dates[idx];
    const dayActs = getActivitiesForDate(S.activities, date);
    const completions = S.completionsByDate[date] || [];
    const doneIds = new Set(completions.filter(c => c.completed).map(c => c.activity_id));
    const isToday = date === TODAY;

    const cells = dayActs.slice(0, 5).map(a => {
      const done = doneIds.has(a.id);
      return `
        <div class="week-act-cell ${done ? 'completed' : 'pending'}" title="${a.name} — ${a.duration}min — ${done ? 'Done ✓' : 'Pending'}">
          <div class="week-act-name">${a.name}</div>
          <div class="week-act-meta">${a.duration}min${done ? '' : ''}</div>
          ${done ? '<div class="week-act-check">✓ Done</div>' : ''}
        </div>`;
    }).join('');

    const emptyCells = dayActs.length === 0
      ? `<div class="week-act-cell no-activity"><div class="week-act-name" style="text-align:center;color:var(--t3)">—</div></div>` : '';

    return `
      <div class="week-day-col">
        <div class="week-day-label" style="${isToday ? 'color:var(--p-light)' : ''}">${day}${isToday ? ' •' : ''}</div>
        ${cells}${emptyCells}
        ${dayActs.length > 4 ? `<div style="font-size:10px;color:var(--t3)">+${dayActs.length-4} more</div>` : ''}
      </div>`;
  }).join('');
}

export function setPeriod(days, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBarChart('stats-bar', days);
}

// ══ PROGRESS ══════════════════════════════════════════════
function renderProgress() {
  renderProgressPeriod(S.currentPeriod || 'week');
}

window.__setProgPeriod = (period, btn) => {
  document.querySelectorAll('.prog-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.currentPeriod = period;
  renderProgressPeriod(period);
};

function renderProgressPeriod(period) {
  const ranges = {
    week:    { days: 7,   label: 'vs previous week',   prevDays: 14 },
    month:   { days: 30,  label: 'vs previous month',  prevDays: 60 },
    half:    { days: 182, label: 'vs previous 6 months', prevDays: 364 },
    year:    { days: 365, label: 'vs previous year',   prevDays: 730 },
  };
  const r = ranges[period] || ranges.week;
  const now = new Date();

  // Current period completions
  const curFrom = daysAgo(r.days);
  const prevFrom = daysAgo(r.prevDays);
  const prevTo = daysAgo(r.days);

  const curDone = Object.entries(S.completionsByDate)
    .filter(([d]) => d >= curFrom && d <= TODAY)
    .reduce((s, [,cs]) => s + cs.filter(c=>c.completed).length, 0);

  const prevDone = Object.entries(S.completionsByDate)
    .filter(([d]) => d >= prevFrom && d < prevTo)
    .reduce((s, [,cs]) => s + cs.filter(c=>c.completed).length, 0);

  const curMins = curDone * 35;
  const prevMins = prevDone * 35;

  const pctChange = prevDone > 0 ? Math.round(((curDone - prevDone) / prevDone) * 100) : (curDone > 0 ? 100 : 0);
  const minsChange = prevMins > 0 ? Math.round(((curMins - prevMins) / prevMins) * 100) : (curMins > 0 ? 100 : 0);

  // Consistency: unique days with at least one completion
  const curDays = Object.entries(S.completionsByDate).filter(([d]) => d >= curFrom && d <= TODAY && S.completionsByDate[d]?.some(c=>c.completed)).length;
  const prevDays = Object.entries(S.completionsByDate).filter(([d]) => d >= prevFrom && d < prevTo && S.completionsByDate[d]?.some(c=>c.completed)).length;
  const daysChange = prevDays > 0 ? Math.round(((curDays - prevDays) / prevDays) * 100) : (curDays > 0 ? 100 : 0);

  function trendHtml(pct) {
    if (pct > 0)  return `<span class="trend-up">↑ ${pct}% improvement</span>`;
    if (pct < 0)  return `<span class="trend-down">↓ ${Math.abs(pct)}% decline</span>`;
    return `<span class="trend-flat">— No change</span>`;
  }

  setEl('prog-label', r.label);

  const kpiEl = document.getElementById('prog-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">⚡</div>
      <div class="kpi-val" style="color:var(--p-light)">${curDone}</div>
      <div class="kpi-label">Activities completed</div>
      <div class="kpi-trend">${trendHtml(pctChange)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">⏱️</div>
      <div class="kpi-val" style="color:var(--cyan)">${curMins >= 60 ? (curMins/60).toFixed(1)+'h' : curMins+'m'}</div>
      <div class="kpi-label">Time invested</div>
      <div class="kpi-trend">${trendHtml(minsChange)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">📅</div>
      <div class="kpi-val" style="color:var(--green)">${curDays}</div>
      <div class="kpi-label">Active days</div>
      <div class="kpi-trend">${trendHtml(daysChange)}</div>
    </div>`;

  // Trend chart
  renderProgressChart(period, r.days);
}

function renderProgressChart(period, days) {
  const canvas = document.getElementById('prog-chart'); if (!canvas) return;
  const labels = [], curData = [], prevData = [];
  const chunks = Math.min(days <= 7 ? days : days <= 30 ? 30 : days <= 182 ? 26 : 12, days);
  const chunkSize = Math.ceil(days / chunks);

  for (let i = chunks - 1; i >= 0; i--) {
    const toDate = daysAgo(i * chunkSize);
    const fromDate = daysAgo((i + 1) * chunkSize);
    const prevFromDate = daysAgo((i + 1 + chunks) * chunkSize);
    const prevToDate = daysAgo((i + chunks) * chunkSize);

    const cur = Object.entries(S.completionsByDate)
      .filter(([d]) => d >= fromDate && d <= toDate)
      .reduce((s, [,cs]) => s + cs.filter(c=>c.completed).length, 0);
    const prev = Object.entries(S.completionsByDate)
      .filter(([d]) => d >= prevFromDate && d <= prevToDate)
      .reduce((s, [,cs]) => s + cs.filter(c=>c.completed).length, 0);

    labels.push(fromDate.slice(5));
    curData.push(cur); prevData.push(prev);
  }

  if (progChartInst) progChartInst.destroy();
  progChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'This period', data: curData, borderColor: 'rgba(108,99,255,.9)', backgroundColor: 'rgba(108,99,255,.08)', tension: .4, fill: true, pointBackgroundColor: 'rgba(108,99,255,.9)', pointRadius: 3 },
        { label: 'Previous period', data: prevData, borderColor: 'rgba(139,132,255,.35)', backgroundColor: 'transparent', tension: .4, borderDash:[4,4], pointRadius: 2, pointBackgroundColor:'rgba(139,132,255,.35)' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:true, position:'top', labels:{color:'#8892b0',font:{size:11},padding:16,boxWidth:24,boxHeight:2,usePointStyle:true} },
        tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10,borderColor:'rgba(255,255,255,.08)',borderWidth:1} },
      scales: {
        x:{ grid:{display:false}, ticks:{color:'#4a5280',font:{size:10}} },
        y:{ grid:{color:'rgba(255,255,255,.04)',drawBorder:false}, ticks:{color:'#4a5280',stepSize:1,font:{size:10}}, beginAtZero:true },
      }
    }
  });
}

// ══ GOALS ═════════════════════════════════════════════════
function renderGoals() {
  renderGoalList('goals-active', S.goals.filter(g=>!g.done), false);
  renderGoalList('goals-done',   S.goals.filter(g=>g.done),  true);

  const addBtn = document.getElementById('add-goal-btn');
  if (addBtn) addBtn.onclick = () => {
    const fc = document.getElementById('goal-form-card');
    fc.style.display = fc.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('save-goal-btn').onclick = submitGoal;
  document.getElementById('cancel-goal-btn').onclick = () => {
    document.getElementById('goal-form-card').style.display = 'none';
  };
}

function renderGoalList(id, goals, isDone) {
  const el = document.getElementById(id); if (!el) return;
  if (!goals.length) {
    el.innerHTML = isDone
      ? `<div class="empty-state"><div class="empty-icon">🏆</div><p>Completed goals appear here</p></div>`
      : `<div class="empty-state"><div class="empty-icon">🎯</div><p>No active goals. Add one!</p></div>`;
    return;
  }
  el.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round(((g.current||0) / (g.target||1)) * 100));
    const col = pct >= 100 ? 'green' : pct >= 60 ? 'amber' : '';
    return `
      <div class="goal-row">
        <div class="goal-top"><div class="goal-name">${isDone ? '✅ ' : ''}${g.name}</div><div class="goal-pct">${pct}%</div></div>
        <div class="progress-track"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
        <div class="goal-bottom"><span>${g.current||0} / ${g.target||1} ${g.unit||'times'}</span><span style="text-transform:capitalize">${g.period}</span></div>
        ${!isDone ? `
        <div class="goal-actions">
          <button class="g-btn inc" onclick="window.__gInc('${g.id}',${g.current||0})">+1</button>
          <button class="g-btn done" onclick="window.__gDone('${g.id}',${g.target||1})">Mark done ✓</button>
          <button class="g-btn del"  onclick="window.__gDel('${g.id}')">Delete</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

window.__gInc  = async(id,cur)=>{const u=await incrementGoal(id,cur);S.goals=S.goals.map(g=>g.id===id?u:g);renderGoals()};
window.__gDone = async(id,tar)=>{const u=await markGoalDone(id,tar);S.goals=S.goals.map(g=>g.id===id?u:g);renderGoals();showToast('Goal completed! 🎉','🏆')};
window.__gDel  = async(id)=>{await deleteGoal(id);S.goals=S.goals.filter(g=>g.id!==id);renderGoals()};

async function submitGoal() {
  const name   = document.getElementById('goal-name').value.trim();
  const target = document.getElementById('goal-target').value;
  const unit   = document.getElementById('goal-unit').value.trim();
  const period = document.getElementById('goal-period').value;
  if (!name) { showToast('Enter a goal name','⚠️'); return; }
  const btn = document.getElementById('save-goal-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const g = await createGoal({ name, target, unit, period });
    S.goals.unshift(g);
    document.getElementById('goal-form-card').style.display = 'none';
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-unit').value = '';
    renderGoals(); showToast('Goal set! 💪','🎯');
  } catch(e) { showToast(e.message,'❌'); }
  finally { btn.disabled = false; btn.textContent = 'Save goal'; }
}

// ══ ACHIEVEMENTS ══════════════════════════════════════════
function renderAchievements() {
  const grid = document.getElementById('badges-grid');
  if (grid) grid.innerHTML = BADGES.map(b => {
    const u = S.unlockedBadges.includes(b.id);
    return `<div class="badge-card ${u?'unlocked':'locked'}" title="${b.desc}"><span class="badge-emoji">${b.emoji}</span><div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div></div>`;
  }).join('');
  const ml = document.getElementById('milestones-list');
  const allC = Object.values(S.completionsByDate).flat().filter(c => c.completed);
  if (ml) ml.innerHTML = MILESTONES.map(m => {
    const e = m.done(allC, S.streak);
    return `<div class="milestone-row ${e?'':'locked'}"><div class="ms-icon">${m.emoji}</div><div class="ms-info"><div class="ms-name">${m.label}</div><div class="ms-desc">${m.desc}</div></div><div class="ms-status ${e?'earned':'locked'}">${e?'Earned ✓':'Locked'}</div></div>`;
  }).join('');
}

// ══ PROFILE ═══════════════════════════════════════════════
function renderProfile() {
  const name  = S.user.user_metadata?.name || S.user.email.split('@')[0];
  setEl('profile-avatar-text', name[0].toUpperCase());
  setEl('profile-name', name); setEl('profile-email', S.user.email);
  setEl('pf-total', Object.values(S.completionsByDate).flat().filter(c=>c.completed).length);
  setEl('pf-streak', S.bestStreak); setEl('pf-badges', S.unlockedBadges.length);
  setEl('pf-activities', S.activities.length);

  // Load saved avatar
  const saved = localStorage.getItem('stride_avatar_' + S.user.id);
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarText = document.getElementById('profile-avatar-text');
  if (saved && avatarImg) {
    avatarImg.src = saved;
    avatarImg.style.display = 'block';
    if (avatarText) avatarText.style.display = 'none';
    // Also update sidebar
    const sav = document.getElementById('sidebar-avatar');
    if (sav) {
      sav.style.backgroundImage = `url(${saved})`;
      sav.style.backgroundSize = 'cover';
      sav.style.backgroundPosition = 'center';
      sav.textContent = '';
    }
  }

  // Wire avatar upload with canvas crop
  document.getElementById('avatar-upload-btn')?.addEventListener('click', () => {
    document.getElementById('avatar-file-input')?.click();
  });

  document.getElementById('avatar-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Crop to square using canvas
        const canvas = document.createElement('canvas');
        const SIZE = 200;
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        // Draw circular clip
        ctx.beginPath();
        ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // Cover crop — center the image
        const side = Math.min(img.width, img.height);
        const sx = (img.width  - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        const data = canvas.toDataURL('image/jpeg', 0.85);

        // Save and display
        try { localStorage.setItem('stride_avatar_' + S.user.id, data); } catch(e) { console.warn('Avatar storage full'); }
        const ai = document.getElementById('profile-avatar-img');
        const at = document.getElementById('profile-avatar-text');
        if (ai) { ai.src = data; ai.style.display = 'block'; }
        if (at) at.style.display = 'none';

        // Sidebar
        const sb2 = document.getElementById('sidebar-avatar');
        if (sb2) {
          sb2.style.backgroundImage = `url(${data})`;
          sb2.style.backgroundSize = 'cover';
          sb2.style.backgroundPosition = 'center';
          sb2.textContent = '';
        }
        showToast('Profile picture updated! 📸', '✅');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  });

  // Wire password change
  document.getElementById('show-pw-btn')?.addEventListener('click', () => {
    const pf = document.getElementById('pw-form');
    pf.style.display = pf.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('save-pw-btn')?.addEventListener('click', changePassword);
  document.getElementById('cancel-pw-btn')?.addEventListener('click', () => {
    document.getElementById('pw-form').style.display = 'none';
  });
}

async function changePassword() {
  const oldPw  = document.getElementById('pw-old').value;
  const newPw  = document.getElementById('pw-new').value;
  const confPw = document.getElementById('pw-conf').value;

  if (!oldPw)                     { showToast('Enter your current password','⚠️'); return; }
  if (!newPw || newPw.length < 6) { showToast('New password must be 6+ characters','⚠️'); return; }
  if (newPw !== confPw)           { showToast('New passwords do not match','⚠️'); return; }
  if (oldPw === newPw)            { showToast('New password must be different from current','⚠️'); return; }

  const btn = document.getElementById('save-pw-btn');
  btn.disabled = true; btn.textContent = 'Verifying…';

  // Step 1: Verify old password by trying to sign in
  const { error: signInErr } = await sb.auth.signInWithPassword({
    email:    S.user.email,
    password: oldPw,
  });

  if (signInErr) {
    btn.disabled = false; btn.textContent = 'Update password';
    showToast('Current password is incorrect ❌', '❌');
    return;
  }

  // Step 2: Old password verified — update to new password
  btn.textContent = 'Updating…';
  const { error } = await sb.auth.updateUser({ password: newPw });
  btn.disabled = false; btn.textContent = 'Update password';

  if (error) { showToast(error.message, '❌'); return; }

  // Clear form
  document.getElementById('pw-form').style.display = 'none';
  document.getElementById('pw-old').value  = '';
  document.getElementById('pw-new').value  = '';
  document.getElementById('pw-conf').value = '';
  showToast('Password updated successfully! 🔒', '✅');
}

// ══ TOAST & POPUP ══════════════════════════════════════════
let toastTimer;
export function showToast(msg, icon = '✓') {
  clearTimeout(toastTimer);
  setEl('toast-msg', msg); setEl('toast-icon', icon);
  const t = document.getElementById('toast');
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
function showAchPopup(b) {
  setEl('ach-emoji',b.emoji);setEl('ach-title',b.name);setEl('ach-desc',b.desc);
  const p=document.getElementById('ach-popup');p.classList.add('show');
  setTimeout(()=>p.classList.remove('show'),4500);
}

// ══ MANAGE FORM INIT ═══════════════════════════════════════
export function initForms() {
  document.querySelectorAll('.af-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.af-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });
  document.getElementById('af-rec')?.addEventListener('change', e => {
    const dr = document.getElementById('days-row');
    if (dr) dr.style.display = e.target.value === 'weekly' ? 'flex' : 'none';
  });
  document.getElementById('af-submit')?.addEventListener('click', submitAF);
  document.getElementById('af-cancel')?.addEventListener('click', hideAF);
  document.getElementById('show-add-btn')?.addEventListener('click', () => { S.editingId = null; showAF(); });
}

// ══ HELPERS ════════════════════════════════════════════════
function setEl(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; }
function setVal(id, val) { const e=document.getElementById(id); if(e) e.value=val; }
function daysAgo(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }

// ══ SOCIAL / FRIENDS ══════════════════════════════════════

export async function renderSocial() {
  const [friends, pending] = await Promise.all([getFriends(), getPendingRequests()]);

  // Pending requests
  const pendingEl = document.getElementById('pending-requests');
  if (pendingEl) {
    pendingEl.innerHTML = pending.length ? pending.map(r => `
      <div class="friend-row">
        <div class="friend-avatar">${r.user_profile?.name?.[0]?.toUpperCase() || '?'}</div>
        <div class="friend-info">
          <div class="friend-name">${r.user_profile?.name || 'Unknown'}</div>
          <div class="friend-sub">Sent you a friend request</div>
        </div>
        <div class="friend-actions">
          <button class="btn btn-primary btn-sm" onclick="window.__acceptFriend('${r.id}')">Accept</button>
          <button class="btn btn-ghost btn-sm"   onclick="window.__removeFriend('${r.id}')">Decline</button>
        </div>
      </div>`).join('')
      : `<div class="empty-state" style="padding:20px"><div class="empty-icon">📬</div><p>No pending requests</p></div>`;
  }

  // Friends list
  const friendsEl = document.getElementById('friends-list');
  if (friendsEl) {
    friendsEl.innerHTML = friends.length ? friends.map(f => `
      <div class="friend-row">
        <div class="friend-avatar">${f.profile?.name?.[0]?.toUpperCase() || '?'}</div>
        <div class="friend-info">
          <div class="friend-name">${f.profile?.name || 'Unknown'}</div>
          <div class="friend-sub">🔥 ${f.profile?.streak || 0} day streak · 🏅 ${f.profile?.unlocked_badges?.length || 0} badges</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.__removeFriend('${f.id}')">Remove</button>
      </div>`).join('')
      : `<div class="empty-state" style="padding:20px"><div class="empty-icon">👥</div><p>No friends yet. Add one!</p></div>`;
  }

  // Wire add friend form
  document.getElementById('add-friend-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('friend-email').value.trim();
    if (!email) { showToast('Enter an email address', '⚠️'); return; }
    const btn = document.getElementById('add-friend-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const t = await sendFriendRequest(email);
      document.getElementById('friend-email').value = '';
      showToast(`Friend request sent to ${t.name}! 🎉`, '✅');
    } catch(e) { showToast(e.message, '❌'); }
    finally { btn.disabled = false; btn.textContent = 'Send request'; }
  });
}

window.__acceptFriend = async (id) => {
  await acceptFriendRequest(id); renderSocial(); showToast('Friend accepted! 🎉', '✅');
};
window.__removeFriend = async (id) => {
  await removeFriend(id); renderSocial();
};

// ══ NOTE MODAL ═════════════════════════════════════════════
let noteActivityId = null;
let noteDone = false;

export function openNoteModal(actId, isDone, existingNote = '') {
  noteActivityId = actId;
  noteDone       = isDone;
  const modal    = document.getElementById('note-modal');
  const input    = document.getElementById('note-input');
  if (!modal || !input) return;
  input.value    = existingNote;
  modal.style.display = 'flex';
  input.focus();
}

window.__openNote = (actId, isDone, existingNote) => openNoteModal(actId, isDone, existingNote);

async function saveNote() {
  const note  = document.getElementById('note-input')?.value.trim() || '';
  const modal = document.getElementById('note-modal');
  if (modal) modal.style.display = 'none';

  if (!noteDone) {
    // Tick off with note
    try {
      const { toggleCompletionWithNote } = await import('./activities.js');
      await toggleCompletionWithNote(noteActivityId, TODAY, false, note);
      if (!S.todayCompletions.find(c => c.activity_id === noteActivityId))
        S.todayCompletions.push({ activity_id: noteActivityId, date: TODAY, completed: true, note });
      S.completionsByDate[TODAY] = S.todayCompletions;
      const newStreak = computeStreak(S.activities, S.completionsByDate);
      if (newStreak !== S.streak) {
        S.streak = newStreak;
        if (newStreak > S.bestStreak) S.bestStreak = newStreak;
        await saveStreak(S.user.id, S.streak, S.bestStreak);
        // Pass all completions (flat array) and activity templates for variety/duration checks
      const allCompletions = Object.values(S.completionsByDate).flat().filter(c => c.completed);
      const newBadges = await checkAndUnlock(S.user.id, allCompletions, S.streak, S.unlockedBadges, S.activities);
        S.unlockedBadges = [...S.unlockedBadges, ...newBadges.map(b => b.id)];
        newBadges.forEach(showAchPopup);
      }
      updateSidebarStreak();
      renderToday();
      showToast(note ? 'Done + note saved! 💪' : 'Marked done! 💪', '✅');
    } catch(e) { showToast(e.message, '❌'); }
  } else {
    // Just update the note
    try {
      const { updateCompletionNote } = await import('./activities.js');
      await updateCompletionNote(noteActivityId, TODAY, note);
      const c = S.todayCompletions.find(c => c.activity_id === noteActivityId);
      if (c) c.note = note;
      renderToday();
      showToast('Note updated!', '📝');
    } catch(e) { showToast(e.message, '❌'); }
  }
}

export function initNoteModal() {
  document.getElementById('note-save-btn')?.addEventListener('click', saveNote);
  document.getElementById('note-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('note-modal').style.display = 'none';
  });
  document.getElementById('note-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') document.getElementById('note-modal').style.display = 'none';
  });
}

// ══ EMAIL SUMMARY SETTINGS ═════════════════════════════════
export async function renderEmailSettings() {
  // Load current prefs
  const { data: profile } = await sb.from('profiles').select('weekly_email,summary_day,summary_email').eq('id', S.user.id).single();

  const el = document.getElementById('email-settings-form');
  if (!el || !profile) return;

  document.getElementById('email-toggle').checked = profile.weekly_email ?? true;
  document.getElementById('email-day').value       = profile.summary_day || 'sunday';
  document.getElementById('email-addr').value      = profile.summary_email || S.user.email;

  document.getElementById('save-email-prefs')?.addEventListener('click', async () => {
    const weekly_email   = document.getElementById('email-toggle').checked;
    const summary_day    = document.getElementById('email-day').value;
    const summary_email  = document.getElementById('email-addr').value.trim();
    await sb.from('profiles').update({ weekly_email, summary_day, summary_email }).eq('id', S.user.id);
    showToast('Email preferences saved! 📧', '✅');
  });
}