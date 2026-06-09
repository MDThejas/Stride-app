// ============================================================
//  js/goals.js — Goals that reset daily/weekly/monthly
// ============================================================
import { sb } from './supabase.js';

// ── Fetch goals — reset current if period has passed ─────
export async function fetchGoals() {
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchGoals:', error.message); return []; }

  const goals = data || [];
  const today = new Date();
  const needsUpdate = [];

  for (const g of goals) {
    if (g.done) continue; // skip completed goals
    const lastReset = g.last_reset ? new Date(g.last_reset) : new Date(g.created_at);

    let shouldReset = false;

    if (g.period === 'daily') {
      // Reset if last_reset was before today
      shouldReset = lastReset.toDateString() !== today.toDateString();
    } else if (g.period === 'weekly') {
      // Reset if we're in a new week (Mon-Sun)
      const getMonday = (d) => {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };
      const thisMonday = getMonday(new Date(today));
      const lastMonday = getMonday(new Date(lastReset));
      shouldReset = thisMonday.toDateString() !== lastMonday.toDateString();
    } else if (g.period === 'monthly') {
      // Reset if we're in a new month
      shouldReset = lastReset.getMonth() !== today.getMonth() ||
                    lastReset.getFullYear() !== today.getFullYear();
    }

    if (shouldReset && g.current > 0) {
      needsUpdate.push(g.id);
      g.current = 0;
      g.last_reset = today.toISOString();
    }
  }

  // Batch reset in DB
  if (needsUpdate.length > 0) {
    await sb.from('goals')
      .update({ current: 0, last_reset: today.toISOString() })
      .in('id', needsUpdate);
  }

  return goals;
}

// ── Create a new goal ─────────────────────────────────────
export async function createGoal({ name, target, unit, period }) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const { data, error } = await sb
    .from('goals')
    .insert({
      user_id:    user.id,
      name:       name.trim(),
      period:     period || 'daily',
      current:    0,
      done:       false,
      last_reset: new Date().toISOString(),
      target:     target ? parseInt(target) : 1,
      unit:       unit?.trim() || 'times',
    })
    .select()
    .single();

  if (error) {
    console.error('createGoal error:', error.message, error.details);
    throw new Error(error.message);
  }
  return data;
}

// ── Increment goal progress ───────────────────────────────
export async function incrementGoal(id, currentValue) {
  const { data, error } = await sb
    .from('goals')
    .update({ current: currentValue + 1 })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Mark goal as fully done ───────────────────────────────
export async function markGoalDone(id, target) {
  const { data, error } = await sb
    .from('goals')
    .update({ done: true, current: target || 1 })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Delete a goal ─────────────────────────────────────────
export async function deleteGoal(id) {
  const { error } = await sb.from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}