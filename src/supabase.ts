import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 환경변수가 없으면 데모 모드(브라우저 localStorage 저장)로 동작합니다.
export const configured = Boolean(url && key)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  key ?? 'missing-key',
)
