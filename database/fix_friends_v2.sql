-- ============================================================
--  fix_friends_v2.sql — Run in Supabase SQL Editor
--  Fixes friend requests not showing on receiver's side
-- ============================================================

-- Step 1: Drop the conflicting policies
DROP POLICY IF EXISTS "profiles_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_friends_read" ON profiles;
DROP POLICY IF EXISTS "friends_own"           ON friends;

-- Step 2: Recreate profiles policy — allow reading ANY profile
-- (needed so friend lookup and pending requests work)
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT USING (true);  -- anyone logged in can read profiles

CREATE POLICY "profiles_write_own" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 3: Recreate friends policies properly
-- SELECT: you can see rows where you are either side
CREATE POLICY "friends_select" ON friends
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- INSERT: you can only create rows where you are the sender
CREATE POLICY "friends_insert" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: either side can update (to accept/decline)
CREATE POLICY "friends_update" ON friends
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- DELETE: either side can remove
CREATE POLICY "friends_delete" ON friends
  FOR DELETE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Step 4: Make sure all existing users have summary_email filled
UPDATE profiles p
SET summary_email = LOWER(u.email)
FROM auth.users u
WHERE p.id = u.id
  AND (p.summary_email IS NULL OR p.summary_email = '');

-- Step 5: Recreate the email lookup function
CREATE OR REPLACE FUNCTION find_user_by_email(search_email TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE LOWER(u.email) = LOWER(search_email)
  LIMIT 1;
END;
$$;

-- Step 6: Clear any duplicate/stuck pending requests so you can test fresh
-- (optional — comment out if you want to keep existing requests)
DELETE FROM friends WHERE status = 'pending';

-- Verify
SELECT 
  f.id,
  f.status,
  sender.name as sender_name,
  receiver.name as receiver_name
FROM friends f
JOIN profiles sender   ON sender.id   = f.user_id
JOIN profiles receiver ON receiver.id = f.friend_id;

SELECT 'Fix applied successfully!' AS status;
