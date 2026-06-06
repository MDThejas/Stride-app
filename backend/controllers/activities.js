// ============================================================
//  controllers/activities.js
//  Business logic for activity CRUD.
// ============================================================
const supabase = require('../config/supabase');

// GET /api/activities — fetch all for logged-in user
exports.getAll = async (req, res) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// POST /api/activities — create one or multiple (for scheduled)
exports.create = async (req, res) => {
  const { type, name, date, duration, intensity, extra, notes, schedule } = req.body;

  if (!type || !name || !date || !duration) {
    return res.status(400).json({ error: 'type, name, date, duration are required' });
  }

  const base = {
    user_id: req.user.id,
    type, name, duration: parseInt(duration),
    intensity: intensity || 'Medium',
    extra: extra || '',
    notes: notes || '',
  };

  // Build list of dates based on schedule
  const dates = [];
  const start = new Date(date);

  if (schedule === 'daily') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (schedule === 'weekly') {
    for (let i = 0; i < 4; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 7);
      dates.push(d.toISOString().split('T')[0]);
    }
  } else {
    dates.push(date);
  }

  const rows = dates.map(d => ({ ...base, date: d }));

  const { data, error } = await supabase
    .from('activities')
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

// DELETE /api/activities/:id
exports.remove = async (req, res) => {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);   // Extra safety: only own rows

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};
