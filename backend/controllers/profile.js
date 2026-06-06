// ============================================================
//  controllers/profile.js
//  Get and update user profile (badges, streak etc.)
// ============================================================
const supabase = require('../config/supabase');

// GET /api/profile
exports.getProfile = async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// PUT /api/profile — update badges, streak, best_streak
exports.updateProfile = async (req, res) => {
  const { unlocked_badges, streak, best_streak } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (unlocked_badges !== undefined) updates.unlocked_badges = unlocked_badges;
  if (streak          !== undefined) updates.streak          = streak;
  if (best_streak     !== undefined) updates.best_streak     = best_streak;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
