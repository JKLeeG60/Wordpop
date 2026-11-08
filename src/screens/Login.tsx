import { useState } from 'react'
import { configured } from '../supabase'
import { signInWithGoogle } from '../lib/auth'

export default function Login({ onDemo }: { onDemo: () => void }) {
  const [error, setError] = useState('')

  async function google() {
    setError('')
    const msg = await signInWithGoogle()
    if (msg) setError(msg)
  }

  return (
    <main className="screen center">
      <div className="spacer" />
      <div className="pop-in center-text">
        <span className="chip">영어 · 중국어 · 일본어 · 스페인어 단어 카드</span>
        <h1 className="brand">Word Pop</h1>
        <p className="mute">
          레벨 테스트로 내 수준을 확인하고,
          <br />
          카드를 넘기며 빠르게 단어를 암기해요.
        </p>
      </div>
      <div className="spacer" />
      {configured ? (
        <>
          <button className="btn block" onClick={onDemo}>
            체험하기
          </button>
          <button className="btn primary block" onClick={google}>
            Google로 계속하기
          </button>
        </>
      ) : (
        <>
          <button className="btn primary block" onClick={onDemo}>
            데모로 시작하기
          </button>
          <p className="mute small center-text">
            서버가 연결되지 않은 데모 모드예요. 학습 기록은 이 브라우저에만 저장됩니다.
          </p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <p className="mute small center-text">
        계속하면 <a href="#/terms">이용약관</a>과 <a href="#/privacy">개인정보처리방침</a>에
        <br />
        동의하는 것으로 간주합니다.
      </p>
    </main>
  )
}
