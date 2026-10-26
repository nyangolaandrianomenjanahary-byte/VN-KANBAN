import { createClient } from '@supabase/supabase-js'

const backendUrl = import.meta.env.VITE_BACKEND_URL
const backendKey =
  import.meta.env.VITE_BACKEND_KEY || import.meta.env.VITE_BACKEND_PUBLIC_KEY

export const isConfigured = Boolean(backendUrl && backendKey)

export function createBackendClient(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const backend = isConfigured ? createBackendClient(backendUrl, backendKey) : null

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
