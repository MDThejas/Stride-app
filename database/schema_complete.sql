-- ============================================================
--  STRIDE — Complete Fresh Schema
--  DROP everything and recreate cleanly.
--  Run this in Supabase SQL Editor.
-- ============================================================

-- ── Step 1: Drop all existing tables ─────────────────────
DROP TABLE IF EXISTS friends     CASCADE;
DROP TABLE IF EXISTS completions CASCADE;
DROP TABLE IF EXISTS goals       CASCADE;
DROP TABLE IF EXISTS activities  CASCADE;
DROP TABLE IF EXISTS profiles    CASCADE;

-- Drop old triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── Step 2: PROFILES ──────────────────────────────────────
CREATE TABLE profiles (
  id               UUID    REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name             TEXT    NOT NULL DEFAULT '',
  streak           INTEGER DEFAULT 0,
  best_streak      INTEGER DEFAULT 0,
  unlocked_badges  TEXT[]  DEFAULT '{}',
  weekly_email     BOOLEAN DEFAULT TRUE,
  summary_day      TEXT    DEFAULT 'sunday',
  summary_email    TEXT    DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 3: ACTIVITIES (recurring templates) ──────────────
-- recurrence: 'daily' | 'weekly' | 'monthly' | 'once'
-- days_of_week: for weekly — [0,1,2,3,4,5,6] (0=Sun)
CREATE TABLE activities (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL DEFAULT '🏃 Running',
  recurrence    TEXT    NOT NULL DEFAULT 'daily'
                CHECK (recurrence IN ('daily','weekly','monthly','once')),
  days_of_week  INT[]   DEFAULT '{0,1,2,3,4,5,6}',
  duration      INTEGER DEFAULT 30,
  intensity     TEXT    DEFAULT 'Medium'
                CHECK (intensity IN ('Low','Medium','High')),
  note          TEXT    DEFAULT '',
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 4: COMPLETIONS (one row = one tick-off per day) ──
CREATE TABLE completions (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID    REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  date        DATE    NOT NULL,
  completed   BOOLEAN DEFAULT TRUE,
  note        TEXT    DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, date)
);

-- ── Step 5: GOALS ─────────────────────────────────────────
CREATE TABLE goals (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT    NOT NULL,
  target      INTEGER NOT NULL DEFAULT 1,
  current     INTEGER DEFAULT 0,
  unit        TEXT    DEFAULT 'times',
  period      TEXT    DEFAULT 'weekly'
              CHECK (period IN ('daily','weekly','monthly')),
  done        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 6: FRIENDS ───────────────────────────────────────
CREATE TABLE friends (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id   UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status      TEXT    DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- ── Step 7: ROW LEVEL SECURITY ────────────────────────────
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends     ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- activities: own rows only
CREATE POLICY "activities_own" ON activities
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- completions: own rows only
CREATE POLICY "completions_own" ON completions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- goals: own rows only
CREATE POLICY "goals_own" ON goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- friends: both users can see the row
CREATE POLICY "friends_own" ON friends
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id);

-- profiles readable by friends (for social feature)
CREATE POLICY "profiles_friends_read" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM friends
      WHERE status = 'accepted'
        AND (
          (user_id = auth.uid() AND friend_id = profiles.id)
          OR (friend_id = auth.uid() AND user_id = profiles.id)
        )
    )
  );

-- ── Step 8: AUTO-CREATE PROFILE ON SIGNUP ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, summary_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    LOWER(NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Step 9: BACKFILL existing users ───────────────────────
INSERT INTO profiles (id, name, summary_email)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', split_part(email,'@',1)),
  LOWER(email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── Step 10: INDEXES ──────────────────────────────────────
CREATE INDEX activities_user_id_idx  ON activities(user_id);
CREATE INDEX activities_active_idx   ON activities(user_id, active);
CREATE INDEX completions_user_id_idx ON completions(user_id);
CREATE INDEX completions_date_idx    ON completions(date);
CREATE INDEX completions_user_date   ON completions(user_id, date);
CREATE INDEX goals_user_id_idx       ON goals(user_id);
CREATE INDEX friends_user_id_idx     ON friends(user_id);
CREATE INDEX friends_friend_id_idx   ON friends(friend_id);

-- ── Done! ─────────────────────────────────────────────────
SELECT 'Schema created successfully! Tables: profiles, activities, completions, goals, friends' AS status;
