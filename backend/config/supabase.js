// ============================================================
//  config/supabase.js
//  Admin Supabase client for backend use ONLY.
//  Uses the service role key — never send this to the frontend.
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Service key bypasses RLS
);

module.exports = supabase;
