// ============================================================
//  controllers/goals.js
//  Business logic for goals CRUD.
// ============================================================
const supabase = require('../config/supabase');

// GET /api/goals
exports.getAll = async (req, res) => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// POST /api/goals
exports.create = async (req, res) => {
  const { name, target, unit, period } = req.body;
  if (!name || !target || !unit) {
    return res.status(400).json({ error: 'name, target, unit are required' });
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: req.user.id,
      name,
      target: parseInt(target),
      unit,
      period: period || 'weekly',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

// PUT /api/goals/:id — update current progress or mark done
exports.update = async (req, res) => {
  const { current, done } = req.body;

  const updates = {};
  if (current !== undefined) updates.current = parseInt(current);
  if (done    !== undefined) updates.done    = done;

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// DELETE /api/goals/:id
exports.remove = async (req, res) => {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};
