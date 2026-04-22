// Shared auth helpers for all Supabase Edge Functions

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/**
 * Extracts the JWT bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractJWT(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null
  return parts[1]
}

/**
 * Creates a Supabase client authenticated as the calling user (JWT).
 * Use for read operations that respect RLS policies.
 */
export function createUserClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Creates a Supabase client using the service role key.
 * Bypasses RLS — use only for write operations that must span multiple users.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Convenience: returns both a user-scoped client (reads) and a service client (writes).
 * Throws if no JWT is present.
 */
export function createSupabaseClients(req: Request): {
  userClient: SupabaseClient
  serviceClient: SupabaseClient
  jwt: string
} {
  const jwt = extractJWT(req)
  if (!jwt) throw new Error('Missing or invalid Authorization header')
  return {
    jwt,
    userClient: createUserClient(jwt),
    serviceClient: createServiceClient(),
  }
}
