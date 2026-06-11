// ============================================================
//  js/goals.js — Goals with daily/weekly/monthly auto-reset
//  "Mark done" resets the goal for the next period
//  Goals never permanently complete unless user clicks Delete
// ============================================================
import { sb } from './supabase.js';

// ── Period reset logic ────────────────────────────────────
function shouldReset(goal) {
  if (!goal.last_reset && !goal.created_at) return false;
  const lastReset = new Date(goal.last_reset || goal.created_at);
  const today     = new Date();

  if (goal.period === 'daily') {
    return lastReset.toDateString() !== today.toDateString();
  }
  if (goal.period === 'weekly') {
    const getMonday = (d) => {
      const nd  = new Date(d);
      const day = nd.getDay();
      nd.setDate(nd.getDate() - (day === 0 ? 6 : day - 1));
      nd.setHours(0,0,0,0);
      return nd;
    };
    return getMonday(today).getTime() !== getMonday(lastReset).getTime();
  }
  if (goal.period === 'monthly') {
    return lastReset.getMonth()    !== today.getMonth() ||
           lastReset.getFullYear() !== today.getFullYear();
  }
  return false;
}

// ── Fetch goals — auto reset if period passed ─────────────
export async function fetchGoals() {
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchGoals:', error.message); return []; }

  const goals      = data || [];
  const toReset    = goals.filter(g => shouldReset(g));

  if (toReset.length > 0) {
    const ids = toReset.map(g => g.id);
    await sb.from('goals')
      .update({ current: 0, done: false, last_reset: new Date().toISOString() })
      .in('id', ids);
    // Update in memory too
    toReset.forEach(g => { g.current = 0; g.done = false; g.last_reset = new Date().toISOString(); });
  }

  return goals;
}

// ── Create goal ───────────────────────────────────────────
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

  if (error) throw new Error(error.message);
  return data;
}

// ── Increment progress ────────────────────────────────────
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

// ── Mark done for TODAY — will reset tomorrow automatically
export async function markGoalDone(id, target) {
  const { data, error } = await sb
    .from('goals')
    .update({
      done:       true,
      current:    target || 1,
      last_reset: new Date().toISOString(), // stays done until next period
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Delete goal permanently ───────────────────────────────
export async function deleteGoal(id) {
  const { error } = await sb.from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}