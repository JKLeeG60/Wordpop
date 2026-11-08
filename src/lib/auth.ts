import { supabase } from '../supabase'

// 구글 로그인은 다른 사이트에 갔다 돌아오는 방식이라, '이번 로그인은 시험 선택부터'라는 표시를 남겨 둔다
export const PICK_FLAG = 'wp_pick_course'

// Google 로그인 화면으로 이동한다. 실패하면 오류 메시지를, 성공하면 null을 돌려준다.
export async function signInWithGoogle(): Promise<string | null> {
  try {
    localStorage.setItem(PICK_FLAG, '1')
  } catch {
    /* ignore */
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) {
    try {
      localStorage.removeItem(PICK_FLAG)
    } catch {
      /* ignore */
    }
    return error.message
  }
  return null
}
