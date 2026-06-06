// ============================================================
//  js/goals.js — Goals CRUD — fixed with optional fields
// ============================================================
import { sb } from './supabase.js';

export async function fetchGoals() {
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchGoals:', error.message); return []; }
  return data || [];
}

export async function createGoal({ name, target, unit, period }) {
  // Get user explicitly so user_id is always set
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  // target and unit are optional
  const row = {
    user_id: user.id,
    name:    name.trim(),
    period:  period || 'weekly',
    current: 0,
    done:    false,
    // Only include target/unit if provided
    ...(target ? { target: parseInt(target) } : { target: 1 }),
    ...(unit   ? { unit: unit.trim() }         : { unit: 'times' }),
  };

  const { data, error } = await sb
    .from('goals')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('createGoal error:', error.message, error.details);
    throw new Error(error.message);
  }
  return data;
}

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

export async function deleteGoal(id) {
  const { error } = await sb.from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
