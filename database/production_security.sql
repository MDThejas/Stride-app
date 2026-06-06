-- ============================================================
--  production_security.sql
--  Run before going live
-- ============================================================

-- Fix function search paths (removes security warnings)
ALTER FUNCTION public.find_user_by_email(text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Restrict find_user_by_email to authenticated users only
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;

-- Restrict handle_new_user (internal trigger only)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Rate limit: prevent profile scraping
-- Only allow reading profiles of friends, not everyone
DROP POLICY IF EXISTS "profiles_read_all"   ON profiles;
DROP POLICY IF EXISTS "profiles_write_own"  ON profiles;

-- Own profile: full access
CREATE POLICY "profiles_own_all" ON profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Other profiles: only readable if friends OR for friend search (via RPC only)
CREATE POLICY "profiles_read_friends" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM friends f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = profiles.id)
          OR
          (f.friend_id = auth.uid() AND f.user_id = profiles.id)
        )
    )
    -- Allow reading pending request senders too
    OR EXISTS (
      SELECT 1 FROM friends f
      WHERE f.friend_id = auth.uid()
        AND f.user_id = profiles.id
        AND f.status = 'pending'
    )
  );

SELECT 'Production security applied!' AS status;
