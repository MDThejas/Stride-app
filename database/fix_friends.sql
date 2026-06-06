-- ============================================================
--  fix_friends.sql
--  Run this in Supabase SQL Editor
--  Fixes friend lookup by email
-- ============================================================

-- Make sure all existing users have their email in summary_email
UPDATE profiles p
SET summary_email = LOWER(u.email)
FROM auth.users u
WHERE p.id = u.id
  AND (p.summary_email IS NULL OR p.summary_email = '');

-- Create a secure function to find user by email
-- This is safer than exposing auth.users directly
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

-- Verify it works (shows count of users)
SELECT COUNT(*) as total_users, COUNT(summary_email) as with_email FROM profiles;
