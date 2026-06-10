// ============================================================
//  dashboard.js — STRIDE Main Controller (clean rewrite)
// ============================================================
import { sb }                          from './supabase.js';
import { doLogout }                    from './auth.js';
import { toggleTheme }                 from './theme.js';
import {
  fetchActivities, createActivity, updateActivity, deleteActivity,
  fetchCompletionsForDate, fetchCompletionsRange,
  toggleCompletion, toggleCompletionWithNote, updateCompletionNote,
  getActivitiesForDate, computeStreak,
  groupCompletionsByDate, countByType
} from './activities.js';
import { fetchGoals, createGoal, incrementGoal, markGoalDone, deleteGoal } from './goals.js';
import { BADGES, MILESTONES, getUnlockedBadges, checkAndUnlock, saveStreak } from './achievements.js';
import { getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, removeFriend } from './friends.js';

const TODAY = new Date().toISOString().split('T')[0];
let barChartInst = null, pieChartInst = null, progChartInst = null;

// ── App state ──────────────────────────────────────────────
const S = {
  user: null, activities: [], goals: [],
  unlockedBadges: [], streak: 0, bestStreak: 0,
  todayCompletions: [], completionsByDate: {},
  editingId: null, currentPeriod: 'week',
};

// ── Helpers ────────────────────────────────────────────────
function setEl(id, val)  { const e = document.getElementById(id); if (e) e.textContent = val; }
function setVal(id, val) { const e = document.getElementById(id); if (e) e.value = val; }
function daysAgo(n)      { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }

// ══ BOOT ══════════════════════════════════════════════════
export async function boot() {
  // Auth guard
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  S.user = session.user;

  const name  = session.user.user_metadata?.name || session.user.email.split('@')[0];
  const email = session.user.email;
  setEl('sidebar-name',   name);
  setEl('sidebar-email',  email);
  setEl('sidebar-avatar', name[0].toUpperCase());

  // Load all data
  const from = daysAgo(365);
  const [activities, goals, profileData, todayC, rangeC] = await Promise.all([
    fetchActivities(),
    fetchGoals(),
    getUnlockedBadges(S.user.id),
    fetchCompletionsForDate(TODAY),
    fetchCompletionsRange(from, TODAY),
  ]);

  S.activities        = activities;
  S.goals             = goals;
  S.unlockedBadges    = profileData.unlockedBadges;
  S.bestStreak        = profileData.bestStreak;
  S.todayCompletions  = todayC;
  S.completionsByDate = groupCompletionsByDate(rangeC);
  S.streak            = computeStreak(S.activities, S.completionsByDate);

  updateSidebarStreak();

  // Wire buttons
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = '../index.html';
  });
  document.querySelectorAll('.theme-toggle').forEach(b => b.addEventListener('click', toggleTheme));

  showSection('today');
}

// ── Section router ─────────────────────────────────────────
export function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
  document.getElementById('sec-' + id)?.classList.remove('hidden');
  const map = {
    today: renderToday, manage: renderManage, stats: renderStats,
    progress: renderProgress, goals: renderGoals,
    achievements: renderAchievements, profile: renderProfile,
    social: renderSocial, email: renderEmailSettings,
  };
  map[id]?.();
}

function updateSidebarStreak() {
  setEl('ss-num', S.streak);
  const w = document.getElementById('sidebar-streak');
  if (w) w.style.display = S.streak > 0 ? 'flex' : 'none';
}

// ══ TODAY ══════════════════════════════════════════════════
function renderToday() {
  const acts   = getActivitiesForDate(S.activities, TODAY);
  const doneIds = new Set(S.todayCompletions.filter(c => c.completed).map(c => c.activity_id));
  const done   = acts.filter(a => doneIds.has(a.id)).length;
  const total  = acts.length;
  const pct    = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  setEl('today-date', new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
  setEl('today-progress-label', `${done} of ${total} activities done`);
  setEl('today-streak-chip', S.streak > 0 ? `🔥 ${S.streak} day streak` : '🌱 Start your streak');

  const fill = document.getElementById('today-bar-fill');
  if (fill) { fill.style.width = pct + '%'; fill.className = 'today-bar-fill' + (allDone ? ' done' : ''); }

  const barPct = document.getElementById('today-bar-pct');
  if (barPct) barPct.textContent = pct + '%';

  const ring = document.getElementById('ring-fill');
  if (ring) {
    const c = 2 * Math.PI * 36;
    ring.style.strokeDasharray  = c;
    ring.style.strokeDashoffset = c - (c * pct / 100);
    ring.style.stroke = allDone ? 'var(--green)' : 'var(--p)';
  }
  setEl('ring-pct', pct + '%');

  const banner = document.getElementById('done-banner');
  if (banner) banner.style.display = allDone ? 'flex' : 'none';

  const list = document.getElementById('today-list');
  if (!list) return;

  if (!total) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>
      <p>No activities today.<br><a onclick="showSection('manage')" style="color:var(--p);cursor:pointer">Add activities →</a></p></div>`;
    return;
  }

  list.innerHTML = acts.map(a => {
    const isDone = doneIds.has(a.id);
    const noteVal = S.todayCompletions.find(c => c.activity_id === a.id)?.note || '';
    return `
      <div class="today-row ${isDone ? 'done' : ''}" id="tr-${a.id}">
        <button class="tick-btn ${isDone ? 'ticked' : ''}" onclick="window.__tick('${a.id}',${isDone})">${isDone ? '✓' : ''}</button>
        <div class="today-act-emoji">${a.type.split(' ')[0]}</div>
        <div class="today-act-info">
          <div class="today-act-name">${a.name}</div>
          <div class="today-act-meta">
            <span>${a.type.split(' ').slice(1).join(' ')}</span>
            <span class="meta-sep">·</span><span>${a.duration} min</span>
            <span class="meta-sep">·</span><span>${a.intensity}</span>
            ${noteVal ? `<span class="meta-sep">·</span><span style="color:var(--p-light)">📝 ${noteVal}</span>` : ''}
          </div>
        </div>
        <span class="act-status ${isDone ? 'status-done' : 'status-pending'}">${isDone ? 'Done ✓' : 'Pending'}</span>
        <button class="note-btn" onclick="window.__openNote('${a.id}',${isDone},'${noteVal.replace(/'/g,"\\'")}')">📝</button>
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
        S.todayCompletions.push({ activity_id: actId, date: TODAY, completed: true, note: '' });
    } else {
      S.todayCompletions = S.todayCompletions.filter(c => c.activity_id !== actId);
    }
    S.completionsByDate[TODAY] = S.todayCompletions;
    // Recompute streak
    S.streak = computeStreak(S.activities, S.completionsByDate);
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;
    await saveStreak(S.user.id, S.streak, S.bestStreak);
    // Check badges on every tick
    const allC = Object.values(S.completionsByDate).flat().filter(c => c.completed);
    const newBadges = await checkAndUnlock(S.user.id, allC, S.streak, S.unlockedBadges, S.activities);
    if (newBadges.length > 0) {
      S.unlockedBadges = [...S.unlockedBadges, ...newBadges.map(b => b.id)];
      newBadges.forEach(showAchPopup);
    }
    updateSidebarStreak();
    renderToday();
    showToast(nowDone ? 'Marked done! 💪' : 'Marked as pending', nowDone ? '✅' : '↩️');
  } catch(e) { showToast(e.message, '❌'); console.error(e); }
};

// ══ MANAGE ════════════════════════════════════════════════
function renderManage() {
  S.editingId = null;
  hideAF();
  renderManageList();
}

function renderManageList() {
  const el = document.getElementById('manage-list');
  if (!el) return;
  if (!S.activities.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><p>No activities yet. Create your first one!</p></div>`;
    return;
  }
  const REC = { daily:'Every day', weekly:'Weekly', monthly:'Monthly', once:'One time' };
  el.innerHTML = S.activities.map(a => `
    <div class="manage-card" id="mc-${a.id}">
      <div class="manage-left">
        <div class="manage-emoji">${a.type.split(' ')[0]}</div>
        <div>
          <div class="manage-name">${a.name}</div>
          <div class="manage-meta">
            ${a.type.split(' ').slice(1).join(' ')} · ${a.duration} min · ${a.intensity}
            · <span class="pill pill-p" style="font-size:10px">${REC[a.recurrence]||a.recurrence}</span>
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
  renderManageList();
  showToast('Activity deleted', '🗑️');
};

function showAF(pre = {}) {
  const f = document.getElementById('af-form');
  if (!f) return;
  f.style.display = 'block';
  f.scrollIntoView({ behavior:'smooth', block:'nearest' });
  setVal('af-name', pre.name||'');
  setVal('af-dur',  pre.duration||30);
  setVal('af-int',  pre.intensity||'Medium');
  setVal('af-rec',  pre.recurrence||'daily');
  setVal('af-note', pre.note||'');
  document.querySelectorAll('.af-pill').forEach(p => p.classList.toggle('active', p.dataset.type === (pre.type||'🏃 Running')));
  setEl('af-form-title', S.editingId ? '✏️ Edit Activity' : '+ New Activity');
  const dr = document.getElementById('days-row');
  if (dr) dr.style.display = pre.recurrence === 'weekly' ? 'flex' : 'none';
}

function hideAF() {
  const f = document.getElementById('af-form');
  if (f) f.style.display = 'none';
  S.editingId = null;
}

async function submitAF() {
  const name       = document.getElementById('af-name')?.value.trim();
  const duration   = document.getElementById('af-dur')?.value;
  const intensity  = document.getElementById('af-int')?.value;
  const recurrence = document.getElementById('af-rec')?.value;
  const note       = document.getElementById('af-note')?.value.trim();
  const type       = document.querySelector('.af-pill.active')?.dataset.type || '🏃 Running';
  const days_of_week = recurrence === 'weekly'
    ? Array.from(document.querySelectorAll('.day-cb:checked')).map(c => parseInt(c.value))
    : [0,1,2,3,4,5,6];

  if (!name) { showToast('Enter an activity name', '⚠️'); return; }

  const btn = document.getElementById('af-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (S.editingId) {
      const u = await updateActivity(S.editingId, { name, type, recurrence, days_of_week, duration: parseInt(duration), intensity, note });
      S.activities = S.activities.map(a => a.id === S.editingId ? u : a);
      showToast('Activity updated ✓', '✅');
    } else {
      const n = await createActivity({ name, type, recurrence, days_of_week, duration, intensity, note });
      S.activities.push(n);
      showToast('Activity created! 🎯', '✅');
    }
    hideAF();
    renderManageList();
  } catch(e) { showToast(e.message, '❌'); console.error(e); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Save Activity'; } }
}

// ══ STATS ══════════════════════════════════════════════════
function renderStats() {
  const total     = Object.values(S.completionsByDate).flat().filter(c => c.completed).length;
  const totalMins = total * 35;
  setEl('st-total',  total);
  setEl('st-time',   totalMins >= 60 ? (totalMins/60).toFixed(1)+'h' : totalMins+'m');
  setEl('st-streak', S.bestStreak + ' days');
  const tc  = countByType(S.activities);
  const top = Object.entries(tc).sort((a,b) => b[1]-a[1])[0];
  setEl('st-fav', top ? top[0].split(' ')[0] : '—');
  renderBarChart('stats-bar', 7);
  renderPieChart2();
  renderWeekTracker();
}

function renderBarChart(canvasId, days) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const labels = [], data = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toISOString().split('T')[0];
    labels.push(['S','M','T','W','T','F','S'][d.getDay()]);
    data.push((S.completionsByDate[ds]||[]).filter(c=>c.completed).length);
  }
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: data.map(v => v>0?'rgba(108,99,255,.75)':'rgba(108,99,255,.12)'), borderRadius:5, borderSkipped:false }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10} },
      scales:{ x:{grid:{display:false},ticks:{color:'#4a5280',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,.04)',drawBorder:false},ticks:{color:'#4a5280',stepSize:1},beginAtZero:true} }
    }
  });
}

function renderPieChart2() {
  const canvas = document.getElementById('stats-pie');
  if (!canvas) return;
  const tc     = countByType(S.activities);
  const labels = Object.keys(tc).map(t => t.split(' ').slice(1).join(' ')||t);
  const values = Object.values(tc);
  const COLS   = ['rgba(108,99,255,.85)','rgba(34,197,94,.85)','rgba(245,158,11,.85)','rgba(239,68,68,.85)','rgba(6,182,212,.85)','rgba(236,72,153,.85)'];
  if (pieChartInst) pieChartInst.destroy();
  if (!values.length) { canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Add activities to see breakdown</p></div>`; return; }
  pieChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data:values, backgroundColor:COLS.slice(0,values.length), borderWidth:0, hoverOffset:6 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ display:true, position:'bottom', labels:{color:'#8892b0',font:{size:11},padding:12,boxWidth:11,boxHeight:11} },
        tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10} }
    }
  });
}

function renderWeekTracker() {
  const container = document.getElementById('week-tracker');
  if (!container) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Find this week's Monday
  const today2   = new Date();
  const dayOfWk  = today2.getDay();
  const diffToMon = dayOfWk === 0 ? -6 : 1 - dayOfWk;
  const monday   = new Date(today2);
  monday.setDate(today2.getDate() + diffToMon);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  container.innerHTML = days.map((day, idx) => {
    const date    = dates[idx];
    const isToday = date === TODAY;
    const dayActs = getActivitiesForDate(S.activities, date);
    const completions = S.completionsByDate[date] || [];
    const doneIds = new Set(completions.filter(c => c.completed).map(c => c.activity_id));

    const cells = dayActs.slice(0, 5).map(a => {
      const done = doneIds.has(a.id);
      return `<div class="week-act-cell ${done ? 'completed' : 'pending'}" title="${a.name} — ${done ? 'Done ✓' : 'Pending'}">
        <div class="week-act-name">${a.name}</div>
        <div class="week-act-meta">${a.duration}min</div>
        ${done ? '<div class="week-act-check">✓ Done</div>' : ''}
      </div>`;
    }).join('');

    return `
      <div class="week-day-col">
        <div class="week-day-label" style="${isToday ? 'color:var(--p-light)' : ''}">${day}${isToday ? ' •' : ''}</div>
        ${cells || `<div class="week-act-cell no-activity"><div class="week-act-name" style="text-align:center;color:var(--t3)">—</div></div>`}
        ${dayActs.length > 5 ? `<div style="font-size:10px;color:var(--t3);text-align:center">+${dayActs.length-5}</div>` : ''}
      </div>`;
  }).join('');
}

export function setPeriod(days, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBarChart('stats-bar', days);
}

// ══ PROGRESS ══════════════════════════════════════════════
function renderProgress() { renderProgressPeriod(S.currentPeriod || 'week'); }

window.__setProgPeriod = (period, btn) => {
  document.querySelectorAll('.prog-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.currentPeriod = period;
  renderProgressPeriod(period);
};

function renderProgressPeriod(period) {
  const ranges = {
    week:  { days:7,   label:'vs previous week',      prevDays:14  },
    month: { days:30,  label:'vs previous month',     prevDays:60  },
    half:  { days:182, label:'vs previous 6 months',  prevDays:364 },
    year:  { days:365, label:'vs previous year',      prevDays:730 },
  };
  const r = ranges[period] || ranges.week;
  const curFrom  = daysAgo(r.days);
  const prevFrom = daysAgo(r.prevDays);
  const prevTo   = daysAgo(r.days);

  const curDone = Object.entries(S.completionsByDate)
    .filter(([d]) => d >= curFrom && d <= TODAY)
    .reduce((s,[,cs]) => s + cs.filter(c=>c.completed).length, 0);
  const prevDone = Object.entries(S.completionsByDate)
    .filter(([d]) => d >= prevFrom && d < prevTo)
    .reduce((s,[,cs]) => s + cs.filter(c=>c.completed).length, 0);

  const curMins   = curDone  * 35;
  const prevMins  = prevDone * 35;
  const pctChange = prevDone > 0 ? Math.round(((curDone-prevDone)/prevDone)*100) : (curDone>0?100:0);
  const minsChange= prevMins > 0 ? Math.round(((curMins-prevMins)/prevMins)*100) : (curMins>0?100:0);
  const curDays   = Object.entries(S.completionsByDate).filter(([d]) => d>=curFrom && d<=TODAY  && S.completionsByDate[d]?.some(c=>c.completed)).length;
  const prevDaysC = Object.entries(S.completionsByDate).filter(([d]) => d>=prevFrom && d<prevTo && S.completionsByDate[d]?.some(c=>c.completed)).length;
  const daysChange= prevDaysC>0?Math.round(((curDays-prevDaysC)/prevDaysC)*100):(curDays>0?100:0);

  const trend = (p) => p>0?`<span class="trend-up">↑ ${p}% better</span>`:p<0?`<span class="trend-down">↓ ${Math.abs(p)}% less</span>`:`<span class="trend-flat">→ No change</span>`;

  setEl('prog-label', r.label);
  const kpiEl = document.getElementById('prog-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="kpi-card"><div class="kpi-icon">⚡</div><div class="kpi-val" style="color:var(--p-light)">${curDone}</div><div class="kpi-label">Activities completed</div><div class="kpi-trend">${trend(pctChange)}</div></div>
    <div class="kpi-card"><div class="kpi-icon">⏱️</div><div class="kpi-val" style="color:var(--cyan)">${curMins>=60?(curMins/60).toFixed(1)+'h':curMins+'m'}</div><div class="kpi-label">Time invested</div><div class="kpi-trend">${trend(minsChange)}</div></div>
    <div class="kpi-card"><div class="kpi-icon">📅</div><div class="kpi-val" style="color:var(--green)">${curDays}</div><div class="kpi-label">Active days</div><div class="kpi-trend">${trend(daysChange)}</div></div>`;

  renderProgressChart(r.days);
}

function renderProgressChart(days) {
  const canvas = document.getElementById('prog-chart');
  if (!canvas) return;
  const chunks    = Math.min(days<=7?days:days<=30?30:days<=182?26:12, days);
  const chunkSize = Math.ceil(days/chunks);
  const labels=[], curData=[], prevData=[];
  for (let i=chunks-1; i>=0; i--) {
    const toDate   = daysAgo(i*chunkSize);
    const fromDate = daysAgo((i+1)*chunkSize);
    const pFrom    = daysAgo((i+1+chunks)*chunkSize);
    const pTo      = daysAgo((i+chunks)*chunkSize);
    const cur  = Object.entries(S.completionsByDate).filter(([d])=>d>=fromDate&&d<=toDate).reduce((s,[,cs])=>s+cs.filter(c=>c.completed).length,0);
    const prev = Object.entries(S.completionsByDate).filter(([d])=>d>=pFrom&&d<=pTo).reduce((s,[,cs])=>s+cs.filter(c=>c.completed).length,0);
    labels.push(fromDate.slice(5)); curData.push(cur); prevData.push(prev);
  }
  if (progChartInst) progChartInst.destroy();
  progChartInst = new Chart(canvas, {
    type:'line',
    data:{ labels, datasets:[
      { label:'This period',     data:curData,  borderColor:'rgba(108,99,255,.9)', backgroundColor:'rgba(108,99,255,.08)', tension:.4, fill:true,  pointRadius:3 },
      { label:'Previous period', data:prevData, borderColor:'rgba(139,132,255,.35)', backgroundColor:'transparent',        tension:.4, borderDash:[4,4], pointRadius:2 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:true,position:'top',labels:{color:'#8892b0',font:{size:11},padding:16,boxWidth:24}}, tooltip:{backgroundColor:'#1d2240',titleColor:'#eef0f8',bodyColor:'#8892b0',cornerRadius:8,padding:10} },
      scales:{ x:{grid:{display:false},ticks:{color:'#4a5280',font:{size:10}}}, y:{grid:{color:'rgba(255,255,255,.04)',drawBorder:false},ticks:{color:'#4a5280',stepSize:1},beginAtZero:true} }
    }
  });
}

// ══ GOALS ══════════════════════════════════════════════════
function renderGoals() {
  renderGoalList('goals-active', S.goals.filter(g=>!g.done), false);
  renderGoalList('goals-done',   S.goals.filter(g=>g.done),  true);
  const addBtn = document.getElementById('add-goal-btn');
  if (addBtn) addBtn.onclick = () => {
    const fc = document.getElementById('goal-form-card');
    if (fc) fc.style.display = fc.style.display==='none'?'block':'none';
  };
  const saveBtn = document.getElementById('save-goal-btn');
  if (saveBtn) saveBtn.onclick = submitGoal;
  const cancelBtn = document.getElementById('cancel-goal-btn');
  if (cancelBtn) cancelBtn.onclick = () => {
    const fc = document.getElementById('goal-form-card');
    if (fc) fc.style.display = 'none';
  };
}

function renderGoalList(id, goals, isDone) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!goals.length) {
    el.innerHTML = isDone
      ? `<div class="empty-state"><div class="empty-icon">🏆</div><p>Completed goals appear here</p></div>`
      : `<div class="empty-state"><div class="empty-icon">🎯</div><p>No active goals. Add one!</p></div>`;
    return;
  }
  el.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round(((g.current||0)/(g.target||1))*100));
    const col = pct>=100?'green':pct>=60?'amber':'';
    return `
      <div class="goal-row">
        <div class="goal-top"><div class="goal-name">${isDone?'✅ ':''}${g.name}</div><div class="goal-pct">${pct}%</div></div>
        <div class="progress-track"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
        <div class="goal-bottom"><span>${g.current||0} / ${g.target||1} ${g.unit||'times'}</span><span style="text-transform:capitalize">${g.period}</span></div>
        ${!isDone?`
        <div class="goal-actions">
          <button class="g-btn inc"  onclick="window.__gInc('${g.id}',${g.current||0})">+1</button>
          <button class="g-btn done" onclick="window.__gDone('${g.id}',${g.target||1})">Mark done ✓</button>
          <button class="g-btn del"  onclick="window.__gDel('${g.id}')">Delete</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

window.__gInc  = async(id,cur)=>{const u=await incrementGoal(id,cur);S.goals=S.goals.map(g=>g.id===id?u:g);renderGoals();};
window.__gDone = async(id,tar)=>{const u=await markGoalDone(id,tar);S.goals=S.goals.map(g=>g.id===id?u:g);renderGoals();showToast('Goal completed! 🎉','🏆');};
window.__gDel  = async(id)=>{await deleteGoal(id);S.goals=S.goals.filter(g=>g.id!==id);renderGoals();};

async function submitGoal() {
  const name   = document.getElementById('goal-name')?.value.trim();
  const target = document.getElementById('goal-target')?.value;
  const unit   = document.getElementById('goal-unit')?.value.trim();
  const period = document.getElementById('goal-period')?.value;
  if (!name) { showToast('Enter a goal name','⚠️'); return; }
  const btn = document.getElementById('save-goal-btn');
  if (btn) { btn.disabled=true; btn.textContent='Saving…'; }
  try {
    const g = await createGoal({ name, target, unit, period });
    S.goals.unshift(g);
    const fc = document.getElementById('goal-form-card');
    if (fc) fc.style.display='none';
    document.getElementById('goal-name').value='';
    document.getElementById('goal-target').value='';
    document.getElementById('goal-unit').value='';
    renderGoals();
    showToast('Goal set! 💪','🎯');
  } catch(e) { showToast(e.message,'❌'); }
  finally { if (btn) { btn.disabled=false; btn.textContent='Save goal'; } }
}

// ══ ACHIEVEMENTS ══════════════════════════════════════════
function renderAchievements() {
  const allC = Object.values(S.completionsByDate).flat().filter(c=>c.completed);
  const grid = document.getElementById('badges-grid');
  if (grid) grid.innerHTML = BADGES.map(b => {
    const u = S.unlockedBadges.includes(b.id);
    return `<div class="badge-card ${u?'unlocked':'locked'}" title="${b.desc}">
      <span class="badge-emoji">${b.emoji}</span>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
    </div>`;
  }).join('');
  const ml = document.getElementById('milestones-list');
  if (ml) ml.innerHTML = MILESTONES.map(m => {
    const e = m.done(allC, S.streak);
    return `<div class="milestone-row ${e?'':'locked'}">
      <div class="ms-icon">${m.emoji}</div>
      <div class="ms-info"><div class="ms-name">${m.label}</div><div class="ms-desc">${m.desc}</div></div>
      <div class="ms-status ${e?'earned':'locked'}">${e?'Earned ✓':'Locked'}</div>
    </div>`;
  }).join('');
}

// ══ PROFILE ════════════════════════════════════════════════
function renderProfile() {
  const name  = S.user.user_metadata?.name || S.user.email.split('@')[0];
  const allC  = Object.values(S.completionsByDate).flat().filter(c=>c.completed);
  setEl('profile-avatar-text', name[0].toUpperCase());
  setEl('profile-name',    name);
  setEl('profile-email',   S.user.email);
  setEl('pf-total',        allC.length);
  setEl('pf-streak',       S.bestStreak);
  setEl('pf-badges',       S.unlockedBadges.length);
  setEl('pf-activities',   S.activities.length);

  // Load saved avatar
  const saved = localStorage.getItem('stride_avatar_' + S.user.id);
  const avatarImg  = document.getElementById('profile-avatar-img');
  const avatarText = document.getElementById('profile-avatar-text');
  if (saved && avatarImg) {
    avatarImg.src = saved; avatarImg.style.display = 'block';
    if (avatarText) avatarText.style.display = 'none';
    const sav = document.getElementById('sidebar-avatar');
    if (sav) { sav.style.backgroundImage=`url(${saved})`; sav.style.backgroundSize='cover'; sav.style.backgroundPosition='center'; sav.textContent=''; }
  }

  document.getElementById('avatar-upload-btn')?.addEventListener('click', () => document.getElementById('avatar-file-input')?.click());
  document.getElementById('avatar-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img2 = new Image();
      img2.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.beginPath(); ctx.arc(100,100,100,0,Math.PI*2); ctx.closePath(); ctx.clip();
        const side = Math.min(img2.width,img2.height);
        ctx.drawImage(img2,(img2.width-side)/2,(img2.height-side)/2,side,side,0,0,200,200);
        const data = canvas.toDataURL('image/jpeg',.85);
        try { localStorage.setItem('stride_avatar_'+S.user.id, data); } catch(e) {}
        if (avatarImg) { avatarImg.src=data; avatarImg.style.display='block'; }
        if (avatarText) avatarText.style.display='none';
        const sav2 = document.getElementById('sidebar-avatar');
        if (sav2) { sav2.style.backgroundImage=`url(${data})`; sav2.style.backgroundSize='cover'; sav2.style.backgroundPosition='center'; sav2.textContent=''; }
        showToast('Profile picture updated!','📸');
      };
      img2.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('show-pw-btn')?.addEventListener('click', () => {
    const pf = document.getElementById('pw-form');
    if (pf) pf.style.display = pf.style.display==='none'?'block':'none';
  });
  document.getElementById('save-pw-btn')?.addEventListener('click', changePassword);
  document.getElementById('cancel-pw-btn')?.addEventListener('click', () => {
    const pf = document.getElementById('pw-form');
    if (pf) pf.style.display = 'none';
  });
}

async function changePassword() {
  const oldPw  = document.getElementById('pw-old')?.value;
  const newPw  = document.getElementById('pw-new')?.value;
  const confPw = document.getElementById('pw-conf')?.value;
  if (!oldPw)                     { showToast('Enter your current password','⚠️'); return; }
  if (!newPw || newPw.length < 6) { showToast('New password must be 6+ characters','⚠️'); return; }
  if (newPw !== confPw)           { showToast('Passwords do not match','⚠️'); return; }
  if (oldPw === newPw)            { showToast('New password must be different','⚠️'); return; }
  const btn = document.getElementById('save-pw-btn');
  if (btn) { btn.disabled=true; btn.textContent='Verifying…'; }
  const { error: signInErr } = await sb.auth.signInWithPassword({ email: S.user.email, password: oldPw });
  if (signInErr) {
    if (btn) { btn.disabled=false; btn.textContent='Update password'; }
    showToast('Current password is incorrect','❌'); return;
  }
  const { error } = await sb.auth.updateUser({ password: newPw });
  if (btn) { btn.disabled=false; btn.textContent='Update password'; }
  if (error) { showToast(error.message,'❌'); return; }
  const pf = document.getElementById('pw-form');
  if (pf) pf.style.display='none';
  ['pw-old','pw-new','pw-conf'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  showToast('Password updated! 🔒','✅');
}

// ══ SOCIAL ════════════════════════════════════════════════
export async function renderSocial() {
  const [friends, pending] = await Promise.all([getFriends(), getPendingRequests()]);
  const pendingEl = document.getElementById('pending-requests');
  if (pendingEl) pendingEl.innerHTML = pending.length
    ? pending.map(r=>`<div class="friend-row">
        <div class="friend-avatar">${r.user_profile?.name?.[0]?.toUpperCase()||'?'}</div>
        <div class="friend-info"><div class="friend-name">${r.user_profile?.name||'Unknown'}</div><div class="friend-sub">Sent you a friend request</div></div>
        <div class="friend-actions">
          <button class="btn btn-primary btn-sm" onclick="window.__acceptFriend('${r.id}')">Accept</button>
          <button class="btn btn-ghost btn-sm"   onclick="window.__removeFriend('${r.id}')">Decline</button>
        </div></div>`).join('')
    : `<div class="empty-state" style="padding:20px"><div class="empty-icon">📬</div><p>No pending requests</p></div>`;

  const friendsEl = document.getElementById('friends-list');
  if (friendsEl) friendsEl.innerHTML = friends.length
    ? friends.map(f=>`<div class="friend-row">
        <div class="friend-avatar">${f.profile?.name?.[0]?.toUpperCase()||'?'}</div>
        <div class="friend-info"><div class="friend-name">${f.profile?.name||'Unknown'}</div><div class="friend-sub">🔥 ${f.profile?.streak||0} streak · 🏅 ${f.profile?.unlocked_badges?.length||0} badges</div></div>
        <button class="btn btn-danger btn-sm" onclick="window.__removeFriend('${f.id}')">Remove</button>
      </div>`).join('')
    : `<div class="empty-state" style="padding:20px"><div class="empty-icon">👥</div><p>No friends yet. Add one!</p></div>`;

  const addBtn = document.getElementById('add-friend-btn');
  if (addBtn) {
    addBtn.onclick = async () => {
      const email = document.getElementById('friend-email')?.value.trim();
      if (!email) { showToast('Enter an email address','⚠️'); return; }
      addBtn.disabled=true; addBtn.textContent='Sending…';
      try {
        const t = await sendFriendRequest(email);
        document.getElementById('friend-email').value='';
        showToast(`Request sent to ${t.name}! 🎉`,'✅');
        renderSocial();
      } catch(e) { showToast(e.message,'❌'); }
      finally { addBtn.disabled=false; addBtn.textContent='Send request'; }
    };
  }
}

window.__acceptFriend = async(id)=>{ await acceptFriendRequest(id); renderSocial(); showToast('Friend accepted! 🎉','✅'); };
window.__removeFriend = async(id)=>{ await removeFriend(id); renderSocial(); };

// ══ EMAIL SETTINGS ════════════════════════════════════════
export async function renderEmailSettings() {
  const { data: profile } = await sb.from('profiles').select('weekly_email,summary_day,summary_email').eq('id',S.user.id).single();
  if (!profile) return;
  const toggle = document.getElementById('email-toggle');
  const day    = document.getElementById('email-day');
  const addr   = document.getElementById('email-addr');
  if (toggle) toggle.checked = profile.weekly_email ?? true;
  if (day)    day.value      = profile.summary_day || 'sunday';
  if (addr)   addr.value     = profile.summary_email || S.user.email;
  const saveBtn = document.getElementById('save-email-prefs');
  if (saveBtn) saveBtn.onclick = async () => {
    await sb.from('profiles').update({
      weekly_email:  toggle?.checked ?? true,
      summary_day:   day?.value || 'sunday',
      summary_email: addr?.value.trim() || S.user.email,
    }).eq('id', S.user.id);
    showToast('Email preferences saved! 📧','✅');
  };
}

// ══ NOTE MODAL ════════════════════════════════════════════
let noteActId = null, noteDone = false;

export function openNoteModal(actId, isDone, existingNote='') {
  noteActId = actId; noteDone = isDone;
  const modal = document.getElementById('note-modal');
  const input = document.getElementById('note-input');
  if (!modal || !input) return;
  input.value = existingNote;
  modal.style.display = 'flex';
  input.focus();
}
window.__openNote = (actId, isDone, existingNote) => openNoteModal(actId, isDone, existingNote);

async function saveNote() {
  const note  = document.getElementById('note-input')?.value.trim() || '';
  const modal = document.getElementById('note-modal');
  if (modal) modal.style.display='none';
  try {
    if (!noteDone) {
      await toggleCompletionWithNote(noteActId, TODAY, false, note);
      if (!S.todayCompletions.find(c=>c.activity_id===noteActId))
        S.todayCompletions.push({ activity_id:noteActId, date:TODAY, completed:true, note });
      S.completionsByDate[TODAY] = S.todayCompletions;
      S.streak = computeStreak(S.activities, S.completionsByDate);
      if (S.streak > S.bestStreak) S.bestStreak = S.streak;
      await saveStreak(S.user.id, S.streak, S.bestStreak);
      const allC2 = Object.values(S.completionsByDate).flat().filter(c=>c.completed);
      const nb = await checkAndUnlock(S.user.id,allC2,S.streak,S.unlockedBadges,S.activities);
      if (nb.length>0){ S.unlockedBadges=[...S.unlockedBadges,...nb.map(b=>b.id)]; nb.forEach(showAchPopup); }
      updateSidebarStreak();
      renderToday();
      showToast(note?'Done + note saved! 💪':'Marked done! 💪','✅');
    } else {
      await updateCompletionNote(noteActId, TODAY, note);
      const c = S.todayCompletions.find(c=>c.activity_id===noteActId);
      if (c) c.note = note;
      renderToday();
      showToast('Note updated!','📝');
    }
  } catch(e) { showToast(e.message,'❌'); }
}

export function initNoteModal() {
  document.getElementById('note-save-btn')?.addEventListener('click', saveNote);
  document.getElementById('note-cancel-btn')?.addEventListener('click', ()=>{ document.getElementById('note-modal').style.display='none'; });
  document.getElementById('note-modal')?.addEventListener('click',(e)=>{ if(e.target.id==='note-modal') document.getElementById('note-modal').style.display='none'; });
}

// ══ MANAGE FORM INIT ══════════════════════════════════════
export function initForms() {
  document.querySelectorAll('.af-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.af-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });
  document.getElementById('af-rec')?.addEventListener('change', e => {
    const dr = document.getElementById('days-row');
    if (dr) dr.style.display = e.target.value==='weekly'?'flex':'none';
  });
  document.getElementById('af-submit')?.addEventListener('click', submitAF);
  document.getElementById('af-cancel')?.addEventListener('click', hideAF);
  document.getElementById('show-add-btn')?.addEventListener('click', ()=>{ S.editingId=null; showAF(); });
}

// ══ TOAST & ACHIEVEMENT POPUP ═════════════════════════════
let toastTimer;
export function showToast(msg, icon='✓') {
  clearTimeout(toastTimer);
  setEl('toast-msg', msg); setEl('toast-icon', icon);
  const t = document.getElementById('toast');
  t.classList.add('show');
  toastTimer = setTimeout(()=>t.classList.remove('show'), 3000);
}

function showAchPopup(b) {
  setEl('ach-emoji',b.emoji); setEl('ach-title',b.name); setEl('ach-desc',b.desc);
  const p = document.getElementById('ach-popup');
  p.classList.add('show');
  setTimeout(()=>p.classList.remove('show'), 4500);
}