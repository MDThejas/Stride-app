// ============================================================
//  js/activities.js
//  Activities = recurring templates
//  Completions = per-day tick-offs
// ============================================================
import { sb } from './supabase.js';

// ─────────────────────────────────────────────────────────
//  ACTIVITIES (templates)
// ─────────────────────────────────────────────────────────

export async function fetchActivities() {
  const { data, error } = await sb
    .from('activities')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchActivities:', error.message); return []; }
  return data || [];
}

export async function createActivity({ name, type, recurrence, days_of_week, duration, intensity, note }) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const { data, error } = await sb
    .from('activities')
    .insert({
      user_id: user.id,
      name, type,
      recurrence: recurrence || 'daily',
      days_of_week: days_of_week || [0,1,2,3,4,5,6],
      duration: parseInt(duration) || 30,
      intensity: intensity || 'Medium',
      note: note || '',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateActivity(id, fields) {
  const { data, error } = await sb
    .from('activities')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Soft delete — set active = false
export async function deleteActivity(id) {
  const { error } = await sb
    .from('activities')
    .update({ active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────────────────
//  COMPLETIONS (per-day tick-offs)
// ─────────────────────────────────────────────────────────

// Get all completions for a specific date
export async function fetchCompletionsForDate(date) {
  const { data, error } = await sb
    .from('completions')
    .select('*')
    .eq('date', date);
  if (error) { console.error('fetchCompletions:', error.message); return []; }
  return data || [];
}

// Get completions for a date range (for stats/streak)
export async function fetchCompletionsRange(from, to) {
  const { data, error } = await sb
    .from('completions')
    .select('*')
    .gte('date', from)
    .lte('date', to);
  if (error) { console.error('fetchCompletionsRange:', error.message); return []; }
  return data || [];
}

// Toggle a completion on/off for an activity on a date
export async function toggleCompletion(activityId, date, currentlyDone) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  if (currentlyDone) {
    // Un-tick: delete the completion row
    const { error } = await sb
      .from('completions')
      .delete()
      .eq('activity_id', activityId)
      .eq('date', date);
    if (error) throw new Error(error.message);
    return false;
  } else {
    // Tick: upsert a completion row
    const { error } = await sb
      .from('completions')
      .upsert({ user_id: user.id, activity_id: activityId, date, completed: true });
    if (error) throw new Error(error.message);
    return true;
  }
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

// Which activities are scheduled for a given date?
export function getActivitiesForDate(allActivities, dateStr) {
  const date     = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Sun
  const dayOfMonth = date.getDate();

  return allActivities.filter(a => {
    if (a.recurrence === 'daily')   return true;
    if (a.recurrence === 'once')    return a.created_at?.split('T')[0] === dateStr;
    if (a.recurrence === 'weekly')  return (a.days_of_week || []).includes(dayOfWeek);
    if (a.recurrence === 'monthly') return dayOfMonth === 1; // first of month; customize as needed
    return false;
  });
}

// Is a given day fully completed?
export function isDayComplete(scheduledActivities, completions) {
  if (!scheduledActivities.length) return false;
  const doneIds = new Set(completions.filter(c => c.completed).map(c => c.activity_id));
  return scheduledActivities.every(a => doneIds.has(a.id));
}

// Compute streak: consecutive days where ALL scheduled tasks were done
export function computeStreak(allActivities, completionsByDate) {
  let streak = 0;
  const now  = new Date();

  for (let i = 0; i < 365; i++) {
    const d  = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];

    const scheduled   = getActivitiesForDate(allActivities, ds);
    const completions = completionsByDate[ds] || [];
    const done        = isDayComplete(scheduled, completions);

    if (done) {
      streak++;
    } else if (i > 0) {
      break; // allow today to be incomplete
    }
  }
  return streak;
}

// Group completions by date
export function groupCompletionsByDate(completions) {
  return completions.reduce((acc, c) => {
    if (!acc[c.date]) acc[c.date] = [];
    acc[c.date].push(c);
    return acc;
  }, {});
}

export function countByType(activities) {
  return activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});
}

// ── Toggle completion WITH note ───────────────────────────
export async function toggleCompletionWithNote(activityId, date, currentlyDone, note = '') {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  if (currentlyDone) {
    const { error } = await sb
      .from('completions')
      .delete()
      .eq('activity_id', activityId)
      .eq('date', date);
    if (error) throw new Error(error.message);
    return false;
  } else {
    const { error } = await sb
      .from('completions')
      .upsert({
        user_id:     user.id,
        activity_id: activityId,
        date,
        completed:   true,
        note:        note || '',
      });
    if (error) throw new Error(error.message);
    return true;
  }
}

// ── Update note on existing completion ────────────────────
export async function updateCompletionNote(activityId, date, note) {
  const { error } = await sb
    .from('completions')
    .update({ note })
    .eq('activity_id', activityId)
    .eq('date', date);
  if (error) throw new Error(error.message);
}
