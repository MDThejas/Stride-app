-- ============================================================
--  fix_goals_reset.sql
--  Run in Supabase SQL Editor
--  Adds last_reset column to goals table
-- ============================================================

ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_reset TIMESTAMPTZ DEFAULT NOW();

-- Set last_reset for existing goals to their created_at
UPDATE goals SET last_reset = created_at WHERE last_reset IS NULL;

SELECT 'Goals reset column added!' AS status;