// ============================================================
//  js/achievements.js — Badge definitions, check & unlock
// ============================================================
import { sb } from './supabase.js';

// ── Badge definitions ─────────────────────────────────────
// NOTE: check(completions, streak, activities)
// completions = array of completion rows (actual ticked-off items)
// streak      = current streak number
// activities  = activity templates (for variety/duration checks)
export const BADGES = [
  {
    id: 'first_step', emoji: '🎯', name: 'First Step',
    desc: 'Complete your first activity',
    check: (c) => c.length >= 1
  },
  {
    id: 'week_7', emoji: '🔥', name: 'On Fire',
    desc: 'Complete 7 activities total',
    check: (c) => c.length >= 7
  },
  {
    id: 'twenty_five', emoji: '⚡', name: 'Power Up',
    desc: 'Complete 25 activities',
    check: (c) => c.length >= 25
  },
  {
    id: 'fifty', emoji: '💯', name: 'Half Century',
    desc: 'Complete 50 activities',
    check: (c) => c.length >= 50
  },
  {
    id: 'streak_3', emoji: '🌟', name: 'Habit Forming',
    desc: 'Achieve a 3-day streak',
    check: (c, s) => s >= 3
  },
  {
    id: 'streak_7', emoji: '🏆', name: 'Week Warrior',
    desc: 'Achieve a 7-day streak',
    check: (c, s) => s >= 7
  },
  {
    id: 'streak_30', emoji: '👑', name: 'Unstoppable',
    desc: 'Achieve a 30-day streak',
    check: (c, s) => s >= 30
  },
  {
    id: 'variety', emoji: '🎨', name: 'Variety Seeker',
    desc: 'Complete 4 different activity types',
    check: (c, s, a) => new Set((a || []).map(x => x.type)).size >= 4
  },
  {
    id: 'hour_club', emoji: '⏰', name: 'Hour Club',
    desc: 'Complete a 60+ minute session',
    check: (c, s, a) => (a || []).some(x => x.duration >= 60)
  },
  {
    id: 'century', emoji: '🚀', name: 'Centurion',
    desc: 'Complete 100 activities',
    check: (c) => c.length >= 100
  },
];

// ── Ensure profile row exists ─────────────────────────────
async function ensureProfile(userId) {
  const { data } = await sb.from('profiles').select('id').eq('id', userId).single();
  if (!data) {
    const { data: { user } } = await sb.auth.getUser();
    const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    await sb.from('profiles').insert({
      id: userId, name,
      unlocked_badges: [], streak: 0, best_streak: 0,
    });
  }
}

// ── Fetch unlocked badges from profile ────────────────────
export async function getUnlockedBadges(userId) {
  await ensureProfile(userId);
  const { data, error } = await sb
    .from('profiles')
    .select('unlocked_badges, streak, best_streak')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('getUnlockedBadges error:', error.message);
    return { unlockedBadges: [], streak: 0, bestStreak: 0 };
  }
  return {
    unlockedBadges: data?.unlocked_badges || [],
    streak:         data?.streak          || 0,
    bestStreak:     data?.best_streak     || 0,
  };
}

// ── Check and unlock newly earned badges ──────────────────
// completions = all completion rows for this user
// streak      = current streak
// activities  = activity templates (for variety + duration)
export async function checkAndUnlock(userId, completions, streak, alreadyUnlocked, activities = []) {
  const newlyUnlocked = [];

  for (const badge of BADGES) {
    if (alreadyUnlocked.includes(badge.id)) continue;
    // Pass completions, streak, and activities to each check
    if (badge.check(completions, streak, activities)) {
      newlyUnlocked.push(badge);
    }
  }

  if (newlyUnlocked.length === 0) return [];

  const updatedList = [...alreadyUnlocked, ...newlyUnlocked.map(b => b.id)];

  const { error } = await sb.from('profiles').upsert({
    id:              userId,
    unlocked_badges: updatedList,
    streak,
    best_streak:     streak,
    updated_at:      new Date().toISOString(),
  });

  if (error) console.error('checkAndUnlock error:', error.message);
  return newlyUnlocked;
}

// ── Save streak ───────────────────────────────────────────
export async function saveStreak(userId, streak, bestStreak) {
  const { error } = await sb.from('profiles').upsert({
    id:          userId,
    streak,
    best_streak: bestStreak,
    updated_at:  new Date().toISOString(),
  });
  if (error) console.error('saveStreak error:', error.message);
}

// ── Milestones ────────────────────────────────────────────
export const MILESTONES = [
  { emoji: '🥉', label: 'Bronze',    desc: 'Complete 5 activities',   done: (c)    => c.length >= 5   },
  { emoji: '🥈', label: 'Silver',    desc: 'Complete 20 activities',  done: (c)    => c.length >= 20  },
  { emoji: '🥇', label: 'Gold',      desc: 'Complete 50 activities',  done: (c)    => c.length >= 50  },
  { emoji: '💎', label: 'Diamond',   desc: 'Complete 100 activities', done: (c)    => c.length >= 100 },
  { emoji: '🌙', label: 'Night Owl', desc: '14-day streak',           done: (c, s) => s >= 14         },
  { emoji: '🌈', label: 'Legend',    desc: '30-day streak',           done: (c, s) => s >= 30         },
];