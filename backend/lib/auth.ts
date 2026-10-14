import type { User } from '@supabase/supabase-js'
import { HttpError } from './http.js'
import { supabaseAdmin } from './supabase.js'

/** The signed-in user, from the `Authorization: Bearer <access token>` the frontend sends. */
export async function requireUser(request: Request): Promise<User> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw new HttpError(401, 'Falta la sesión')

  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sesión no válida o caducada')
  return data.user
}
