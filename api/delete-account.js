// api/delete-account.js
// Vercel serverless function — deletes the calling user's own Supabase Auth account.
// The client SDK has no self-delete method, so this uses the service-role key,
// but only after verifying the caller's own access token identifies them.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAsUser = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: userError } = await supabaseAsUser.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Invalid session' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  return res.status(200).json({ success: true });
}
