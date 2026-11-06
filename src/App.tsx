import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'
import Login from './components/Login'
import LevelTest from './components/LevelTest'
import Study from './components/Study'
import { Privacy, Terms } from './components/Legal'
import Account from './components/Account'

type Profile = { level: number | null; total_studied: number }

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!configured) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('level,total_studied')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? { level: null, total_studied: 0 }))
  }, [session])

  if (hash === '#/privacy') return <Privacy />
  if (hash === '#/terms') return <Terms />

  if (!configured) {
    return (
      <main className="page">
        <h1>Word Pop</h1>
        <p className="notice">
          Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았어요.
        </p>
      </main>
    )
  }

  if (!ready) return <main className="page">불러오는 중…</main>
  if (!session) return <Login />
  if (!profile) return <main className="page">불러오는 중…</main>

  if (hash === '#/account') return <Account session={session} />

  if (profile.level == null) {
    return (
      <LevelTest
        userId={session.user.id}
        onDone={(level) => setProfile({ level, total_studied: profile.total_studied })}
      />
    )
  }

  return (
    <Study
      userId={session.user.id}
      level={profile.level}
      initialTotal={profile.total_studied}
      onRetest={() => setProfile({ level: null, total_studied: profile.total_studied })}
    />
  )
}
