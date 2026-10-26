import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const PHOTO_BUCKET = 'task-photos'

export const PRIORITIES = [
  { value: 'low', label: 'Basse', color: 'var(--sys-green)' },
  { value: 'normal', label: 'Normale', color: 'var(--blue)' },
  { value: 'high', label: 'Haute', color: 'var(--sys-orange)' },
  { value: 'urgent', label: 'Urgente', color: 'var(--sys-red)' },
]

export const ACCENTS = [
  { value: 'navy', label: 'Encre' },
  { value: 'amber', label: 'Ambre' },
  { value: 'teal', label: 'Sarcelle' },
  { value: 'green', label: 'Verdâtre' },
  { value: 'purple', label: 'Mauve' },
  { value: 'red', label: 'Sceau' },
]
