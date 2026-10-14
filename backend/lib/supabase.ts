import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

let admin: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
}

/**
 * Server-only client with the secret key: it bypasses RLS, so it is the only
 * thing allowed to move chips. Never expose it or its key to the frontend.
 */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) throw new HttpError(503, 'El backend no tiene configuradas SUPABASE_URL / SUPABASE_SECRET_KEY')
  admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return admin
}
