// ============================================================
//  services/weeklyEmail.js
//  Sends weekly summary emails to all opted-in users
// ============================================================
const { Resend } = require('resend');
const cron       = require('node-cron');
const supabase   = require('../config/supabase');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Email HTML template ───────────────────────────────────
function buildHTML(stats) {
  const { name, streak, best_streak, weekDone, prevWeekDone, weekMins, badgeEmojis } = stats;
  const hours = weekMins >= 60 ? `${(weekMins/60).toFixed(1)}h` : `${weekMins}m`;
  const diff  = prevWeekDone > 0 ? Math.round(((weekDone-prevWeekDone)/prevWeekDone)*100) : (weekDone>0?100:0);
  const trend = diff > 0 ? `⬆️ ${diff}% better than last week!` : diff < 0 ? `⬇️ ${Math.abs(diff)}% less than last week` : `➡️ Same as last week`;
  const msg   = weekDone>=5 ? "🌟 Absolutely crushing it! Keep this energy going." : weekDone>=3 ? "💪 Solid week! Push a little more next week." : weekDone>=1 ? "🌱 Every step counts. Show up again this week!" : "🎯 New week, fresh start. Let's go!";
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5500';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0c0e1a;font-family:Arial,sans-serif;color:#eef0f8">
<div style="max-width:540px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <div style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#a78bfa);border-radius:10px;padding:8px 20px;font-size:20px;font-weight:800;color:#fff;margin-bottom:12px">⚡ STRIDE</div>
    <h1 style="font-size:22px;font-weight:700;margin:0">Your Weekly Summary</h1>
    <p style="color:#8892b0;margin:8px 0 0;font-size:14px">Hey ${name}! Here's how your week went 👋</p>
  </div>
  <div style="background:linear-gradient(135deg,#1a1640,#14103a);border:1px solid rgba(108,99,255,0.3);border-radius:14px;padding:24px;text-align:center;margin-bottom:14px">
    <div style="font-size:44px;margin-bottom:6px">🔥</div>
    <div style="font-size:40px;font-weight:800;color:#f59e0b">${streak}</div>
    <div style="font-size:13px;color:#8892b0;margin-top:4px">day streak</div>
    ${streak>0&&streak>=best_streak?'<div style="color:#22c55e;font-size:12px;font-weight:600;margin-top:6px">🏆 Personal best!</div>':''}
  </div>
  <div style="display:flex;gap:12px;margin-bottom:14px">
    <div style="flex:1;background:#13172a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:26px;font-weight:700;color:#6c63ff">${weekDone}</div>
      <div style="font-size:11px;color:#8892b0;margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Activities</div>
    </div>
    <div style="flex:1;background:#13172a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:26px;font-weight:700;color:#06b6d4">${hours}</div>
      <div style="font-size:11px;color:#8892b0;margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Time spent</div>
    </div>
  </div>
  <div style="background:#13172a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;margin-bottom:14px;text-align:center">
    <div style="font-size:14px;font-weight:600;color:#eef0f8">${trend}</div>
    <div style="font-size:12px;color:#8892b0;margin-top:4px">${weekDone} this week · ${prevWeekDone} last week</div>
  </div>
  ${badgeEmojis.length>0?`<div style="background:#13172a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#8892b0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">🏅 Your badges</div><div style="font-size:22px;letter-spacing:4px">${badgeEmojis.slice(0,10).join(' ')}</div></div>`:''}
  <div style="background:linear-gradient(135deg,#0d1530,#12103a);border:1px solid rgba(108,99,255,0.2);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">
    <div style="font-size:14px;color:#eef0f8;line-height:1.6">${msg}</div>
  </div>
  <div style="text-align:center;margin-bottom:28px">
    <a href="${appUrl}/pages/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#a78bfa);color:#fff;padding:13px 30px;border-radius:50px;font-weight:600;font-size:14px;text-decoration:none">Open STRIDE →</a>
  </div>
  <div style="text-align:center;color:#4a5280;font-size:11px;line-height:1.6">
    You're receiving this because you enabled weekly emails in STRIDE.<br>
    <a href="${appUrl}/pages/dashboard.html" style="color:#6c63ff">Manage preferences</a>
  </div>
</div>
</body></html>`;
}

// ── Get user stats ─────────────────────────────────────────
async function getStats(userId, userEmail) {
  const now   = new Date();
  const w1    = new Date(now); w1.setDate(w1.getDate()-7);
  const w2    = new Date(now); w2.setDate(w2.getDate()-14);
  const today = now.toISOString().split('T')[0];
  const w1s   = w1.toISOString().split('T')[0];
  const w2s   = w2.toISOString().split('T')[0];

  const [{ data: thisWeek }, { data: lastWeek }, { data: profile }] = await Promise.all([
    supabase.from('completions').select('activity_id').eq('user_id',userId).eq('completed',true).gte('date',w1s).lte('date',today),
    supabase.from('completions').select('activity_id').eq('user_id',userId).eq('completed',true).gte('date',w2s).lt('date',w1s),
    supabase.from('profiles').select('name,streak,best_streak,unlocked_badges').eq('id',userId).single(),
  ]);

  const actIds = [...new Set((thisWeek||[]).map(c=>c.activity_id))];
  let weekMins = 0;
  if (actIds.length) {
    const { data: acts } = await supabase.from('activities').select('duration').in('id',actIds);
    weekMins = (acts||[]).reduce((s,a)=>s+(a.duration||30),0);
  }

  const EMOJIS = { first_step:'🎯',week_7:'🔥',twenty_five:'⚡',fifty:'💯',streak_3:'🌟',streak_7:'🏆',streak_30:'👑',variety:'🎨',hour_club:'⏰',century:'🚀' };

  return {
    name:         profile?.name || userEmail.split('@')[0],
    streak:       profile?.streak || 0,
    best_streak:  profile?.best_streak || 0,
    weekDone:     (thisWeek||[]).length,
    prevWeekDone: (lastWeek||[]).length,
    weekMins,
    badgeEmojis:  (profile?.unlocked_badges||[]).map(b=>EMOJIS[b]||'🏅'),
  };
}

// ── Send to one user ──────────────────────────────────────
async function sendToUser(userId, authEmail, summaryEmail) {
  try {
    const stats = await getStats(userId, authEmail);
    const { error } = await resend.emails.send({
      from:    'STRIDE <onboarding@resend.dev>',
      to:      summaryEmail || authEmail,
      subject: `🔥 STRIDE weekly summary — ${stats.weekDone} activities this week`,
      html:    buildHTML(stats),
    });
    if (error) console.error(`❌ Failed ${authEmail}:`, error.message);
    else       console.log(`✅ Sent to ${authEmail}`);
  } catch(e) { console.error(`❌ Error ${authEmail}:`, e.message); }
}

// ── Send to all opted-in users ────────────────────────────
async function sendWeeklySummaries() {
  const today = new Date().toLocaleDateString('en-US',{weekday:'long'}).toLowerCase();
  console.log(`📧 Checking emails for ${today}...`);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, summary_email, weekly_email, summary_day')
    .eq('weekly_email', true)
    .eq('summary_day', today);

  if (!profiles?.length) { console.log('No emails today'); return; }
  console.log(`Sending to ${profiles.length} users...`);

  const { data: { users } } = await supabase.auth.admin.listUsers();

  for (const p of profiles) {
    const u = users?.find(u => u.id === p.id);
    if (u) {
      await sendToUser(p.id, u.email, p.summary_email);
      await new Promise(r => setTimeout(r, 400));
    }
  }
  console.log('✅ Done!');
}

// ── Manual test: call from route ──────────────────────────
async function sendTestEmail(userId, authEmail, summaryEmail) {
  await sendToUser(userId, authEmail, summaryEmail);
}

// ── Cron: daily 8AM IST ───────────────────────────────────
function startScheduler() {
  cron.schedule('0 8 * * *', sendWeeklySummaries, { timezone: 'Asia/Kolkata' });
  console.log('📧 Email scheduler started — runs daily 8AM IST');
}

module.exports = { startScheduler, sendWeeklySummaries, sendTestEmail };
