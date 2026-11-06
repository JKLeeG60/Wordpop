import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export default function Account({ session }: { session: Session }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!window.confirm('계정과 모든 학습 기록이 삭제되며 되돌릴 수 없어요. 삭제할까요?')) return
    setBusy(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    await supabase.auth.signOut()
    window.location.hash = ''
  }

  return (
    <main className="page center">
      <h1>계정</h1>
      <p className="sub">{session.user.email}</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      <button className="btn danger" disabled={busy} onClick={remove}>계정 삭제</button>
      {error && <p className="error">{error}</p>}
      <a href="#/" className="link">← 돌아가기</a>
    </main>
  )
}
