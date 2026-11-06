import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  key ?? 'missing-key',
)

export type Word = {
  id: number
  word: string
  meaning_ko: string
  pos: string | null
  example: string | null
  level: number
}

export const LEVEL_LABELS: Record<number, string> = {
  1: '100~300',
  2: '300~500',
  3: '500~700',
  4: '700~990',
}
