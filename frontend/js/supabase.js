// ============================================================
//  js/supabase.js — Supabase client (frontend)
//  Uses the anon/public key. Safe to expose.
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cyvucppjhvguqswikvoy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dnVjcHBqaHZndXFzd2lrdm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTIwNzAsImV4cCI6MjA5NTcyODA3MH0.E9SVVltUx3hayrkSRK_liMwgJ8ObtTB7_g2LyF1byAc';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
