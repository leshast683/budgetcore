// ============================================================
// BudgetCore — supabase.js
// Supabase client initialisation — exported singleton used across the app
// ============================================================
//
// HOW TO CONFIGURE:
//   1. Go to https://supabase.com/dashboard → your project → Project Settings → API
//   2. Copy the "Project URL" and "anon public" key
//   3. Put them in .env.local (git-ignored):
//        VITE_SUPABASE_URL=https://xxxx.supabase.co
//        VITE_SUPABASE_ANON_KEY=eyJ...
//      and add the same two under Vercel → Settings → Environment Variables
//   4. Run supabase/migrations/0001_init.sql in the Supabase SQL Editor
//   5. Authentication → Providers → enable Email, Google, Apple (see README)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
