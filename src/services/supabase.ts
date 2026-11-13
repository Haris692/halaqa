import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

const env = import.meta.env as ImportMetaEnv
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Client Supabase, ou `null` si le projet n'est pas configuré : l'application
 * reste alors un lecteur solo, sans comptes (comme en phase 1).
 */
export const supabase: SupabaseClient<Database> | null =
  url && key
    ? createClient<Database>(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'halaqa.auth' },
      })
    : null

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type AppRole = Database['public']['Enums']['app_role']
export type VerseStatus = Database['public']['Enums']['verse_status']
export type Profile = Tables<'profiles'>
