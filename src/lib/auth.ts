import { supabase } from '../supabase'

// Google 로그인 화면으로 이동한다. 실패하면 오류 메시지를, 성공하면 null을 돌려준다.
export async function signInWithGoogle(): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  return error ? error.message : null
}
