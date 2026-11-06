import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [error, setError] = useState('')

  async function google() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <main className="page center">
      <h1>Word Pop</h1>
      <p className="sub">토익 단어를 카드로 가볍게 익혀요</p>
      <button className="btn primary" onClick={google}>
        Google로 계속하기
      </button>
      {error && <p className="error">{error}</p>}
      <p className="legal">
        계속하면 <a href="#/terms">이용약관</a>과 <a href="#/privacy">개인정보처리방침</a>에 동의하는
        것으로 봅니다.
      </p>
    </main>
  )
}
