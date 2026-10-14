import { DEFAULT_RULES } from '@bwf/engine'
import { handler, json } from '../lib/http.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

// GET /api/health: quick check that the API is up and wired correctly.
export const GET = handler(() =>
  json({
    ok: true,
    time: new Date().toISOString(),
    supabase: isSupabaseConfigured(),
    // Proves the shared engine is bundled with the functions.
    rules: DEFAULT_RULES,
  }),
)
