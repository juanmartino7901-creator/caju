import { createClient } from '@supabase/supabase-js';

/**
 * Service role client — bypasses RLS. Use only for admin operations
 * (e.g., storage uploads that need elevated permissions).
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/**
 * User-scoped client — respects RLS using the user's JWT.
 * Use for all data queries so rows are filtered by user_id = auth.uid().
 * @param {string} accessToken - The user's Supabase access_token from Authorization header
 */
export function createUserClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      // Critical: this makes _getAccessToken() return the user's JWT
      // instead of the anon key, so PostgREST sets auth.uid() correctly
      // for RLS policies and DEFAULT values.
      accessToken: async () => accessToken,
    }
  );
}
