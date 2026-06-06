// ============================================================
//  js/friends.js — Friends / Social feature (fixed lookup)
// ============================================================
import { sb } from './supabase.js';

// ── Find user by email using RPC function ─────────────────
async function findUserByEmail(email) {
  // Method 1: Use the RPC function (most reliable)
  const { data: rpcData, error: rpcErr } = await sb
    .rpc('find_user_by_email', { search_email: email.toLowerCase() });

  if (!rpcErr && rpcData && rpcData.length > 0) {
    return rpcData[0]; // { id, name }
  }

  // Method 2: Fallback — search profiles by summary_email
  const { data: profileData, error: profileErr } = await sb
    .from('profiles')
    .select('id, name')
    .eq('summary_email', email.toLowerCase())
    .single();

  if (!profileErr && profileData) return profileData;

  return null;
}

// ── Send friend request by email ─────────────────────────
export async function sendFriendRequest(email) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not logged in');

  if (email.toLowerCase() === user.email.toLowerCase())
    throw new Error("You can't add yourself!");

  // Find the target user
  const target = await findUserByEmail(email.trim());
  if (!target) throw new Error('User not found. They must have a STRIDE account.');

  // Check if already friends or pending
  const { data: existing } = await sb
    .from('friends')
    .select('id, status')
    .or(`and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`)
    .single();

  if (existing) {
    if (existing.status === 'accepted') throw new Error('You are already friends!');
    if (existing.status === 'pending')  throw new Error('Friend request already sent!');
  }

  const { error } = await sb.from('friends').insert({
    user_id:   user.id,
    friend_id: target.id,
    status:    'pending',
  });

  if (error) {
    if (error.code === '23505') throw new Error('Friend request already sent!');
    throw new Error(error.message);
  }

  return target;
}

// ── Accept a friend request ───────────────────────────────
export async function acceptFriendRequest(id) {
  const { error } = await sb
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Decline / remove friend ───────────────────────────────
export async function removeFriend(id) {
  const { error } = await sb.from('friends').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Get all accepted friends ──────────────────────────────
export async function getFriends() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  // Get all accepted friend rows where I am either side
  const { data, error } = await sb
    .from('friends')
    .select('id, status, user_id, friend_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (error) { console.error('getFriends:', error.message); return []; }

  // For each friendship, load the other person's profile
  const results = await Promise.all((data || []).map(async (f) => {
    const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
    const { data: profile } = await sb
      .from('profiles')
      .select('id, name, streak, best_streak, unlocked_badges')
      .eq('id', otherId)
      .single();
    return { id: f.id, profile };
  }));

  return results.filter(r => r.profile);
}

// ── Get pending requests (someone sent ME a request) ──────
export async function getPendingRequests() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('friends')
    .select('id, user_id')
    .eq('friend_id', user.id)
    .eq('status', 'pending');

  if (error) { console.error('getPendingRequests:', error.message); return []; }

  // Load sender profiles
  const results = await Promise.all((data || []).map(async (r) => {
    const { data: profile } = await sb
      .from('profiles')
      .select('id, name')
      .eq('id', r.user_id)
      .single();
    return { id: r.id, user_profile: profile };
  }));

  return results.filter(r => r.user_profile);
}
