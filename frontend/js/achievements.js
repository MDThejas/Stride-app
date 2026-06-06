// ============================================================
//  js/achievements.js — Badge definitions, check & unlock
// ============================================================
import { sb } from './supabase.js';

// ── Badge definitions ─────────────────────────────────────
export const BADGES = [
  { id: 'first_step',   emoji: '🎯', name: 'First Step',      desc: 'Log your first activity',        check: (a)    => a.length >= 1   },
  { id: 'week_7',       emoji: '🔥', name: 'On Fire',         desc: 'Log 7 activities total',          check: (a)    => a.length >= 7   },
  { id: 'twenty_five',  emoji: '⚡', name: 'Power Up',        desc: 'Log 25 activities',               check: (a)    => a.length >= 25  },
  { id: 'fifty',        emoji: '💯', name: 'Half Century',    desc: 'Log 50 activities',               check: (a)    => a.length >= 50  },
  { id: 'streak_3',     emoji: '🌟', name: 'Habit Forming',   desc: 'Achieve a 3-day streak',          check: (a, s) => s >= 3          },
  { id: 'streak_7',     emoji: '🏆', name: 'Week Warrior',    desc: 'Achieve a 7-day streak',          check: (a, s) => s >= 7          },
  { id: 'streak_30',    emoji: '👑', name: 'Unstoppable',     desc: 'Achieve a 30-day streak',         check: (a, s) => s >= 30         },
  { id: 'variety',      emoji: '🎨', name: 'Variety Seeker',  desc: 'Log 4 different activity types',  check: (a)    => new Set(a.map(x => x.type)).size >= 4 },
  { id: 'hour_club',    emoji: '⏰', name: 'Hour Club',       desc: 'Log a 60+ minute session',        check: (a)    => a.some(x => x.duration >= 60) },
  { id: 'century',      emoji: '🚀', name: 'Centurion',       desc: 'Log 100 activities',              check: (a)    => a.length >= 100 },
];

// ── Ensure profile row exists (create if missing) ─────────
async function ensureProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!data) {
    // Profile row missing — create it now
    const { data: { user } } = await sb.auth.getUser();
    const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    await sb.from('profiles').insert({
      id:              userId,
      name,
      unlocked_badges: [],
      streak:          0,
      best_streak:     0,
    });
    console.log('Profile row created for user:', userId);
  }
}

// ── Fetch current unlocked badges from profile ────────────
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

// ── Check for newly earned badges, unlock & return them ───
export async function checkAndUnlock(userId, activities, streak, alreadyUnlocked) {
  const newlyUnlocked = [];

  for (const badge of BADGES) {
    if (alreadyUnlocked.includes(badge.id)) continue;
    if (badge.check(activities, streak)) {
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

// ── Save streak to profile ────────────────────────────────
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
  { emoji: '🥉', label: 'Bronze',    desc: 'Log 5 activities',   done: (a)    => a.length >= 5   },
  { emoji: '🥈', label: 'Silver',    desc: 'Log 20 activities',  done: (a)    => a.length >= 20  },
  { emoji: '🥇', label: 'Gold',      desc: 'Log 50 activities',  done: (a)    => a.length >= 50  },
  { emoji: '💎', label: 'Diamond',   desc: 'Log 100 activities', done: (a)    => a.length >= 100 },
  { emoji: '🌙', label: 'Night Owl', desc: '14-day streak',      done: (a, s) => s >= 14         },
  { emoji: '🌈', label: 'Legend',    desc: '30-day streak',      done: (a, s) => s >= 30         },
];
