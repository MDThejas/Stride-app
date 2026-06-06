// ============================================================
//  controllers/stats.js
//  Calculates summary stats for the logged-in user.
// ============================================================
const supabase = require('../config/supabase');

exports.getSummary = async (req, res) => {
  const userId = req.user.id;

  // Fetch all activities for this user
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // ── Totals ───────────────────────────────────────────
  const totalActivities = activities.length;
  const totalMinutes    = activities.reduce((s, a) => s + a.duration, 0);

  // ── This week ────────────────────────────────────────
  const now     = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekActivities = activities.filter(a => new Date(a.date) >= weekAgo);
  const weekMinutes    = weekActivities.reduce((s, a) => s + a.duration, 0);

  // ── Streak ───────────────────────────────────────────
  const days = new Set(activities.map(a => a.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (days.has(ds)) streak++;
    else if (i > 1) break;
  }

  // ── Activity type breakdown ───────────────────────────
  const typeCounts = {};
  activities.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });
  const favType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // ── Last 30 days per-day count ────────────────────────
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d  = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    last30.push({ date: ds, count: activities.filter(a => a.date === ds).length });
  }

  res.json({
    totalActivities,
    totalMinutes,
    weekActivities: weekActivities.length,
    weekMinutes,
    streak,
    favType,
    typeCounts,
    last30,
  });
};
