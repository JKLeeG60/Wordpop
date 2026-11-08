import { useEffect, useMemo, useState } from 'react'
import { configured, supabase } from './supabase'
import { DEFAULT_PROFILE, demoStore, supabaseStore } from './lib/store'
import { initAudio } from './lib/audio'
import type { Profile, Progress, TestResult } from './lib/types'
import Login from './screens/Login'
import LevelTest from './screens/LevelTest'
import Home from './screens/Home'
import Study from './screens/Study'
import Settings from './screens/Settings'
import { Privacy, Terms } from './screens/Legal'

type Screen = 'home' | 'study' | 'settings' | 'test'

const getDemo = () => {
  try {
    return localStorage.getItem('wp_demo_user')
  } catch {
    return null
  }
}
const setDemo = () => {
  try {
    localStorage.setItem('wp_demo_user', '1')
  } catch {
    /* ignore */
  }
}

function useHash() {
  const [h, setH] = useState(window.location.hash)
  useEffect(() => {
    const f = () => setH(window.location.hash)
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}

export default function App() {
  const hash = useHash()
  if (hash === '#/privacy') return <Privacy />
  if (hash === '#/terms') return <Terms />
  return <Main />
}

function Main() {
  const [userId, setUserId] = useState<string | null>(() =>
    configured ? null : getDemo(),
  )
  const [authReady, setAuthReady] = useState(!configured)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [progress, setProgress] = useState<Map<string, Progress> | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [screen, setScreen] = useState<Screen>('home')
  const [studyOpts, setStudyOpts] = useState({ newCount: 0, reviewBudget: 0 })
  const [, setTick] = useState(0)

  useEffect(() => {
    initAudio()
  }, [])

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const store = useMemo(
    () =>
      userId
        ? configured
          ? supabaseStore(userId)
          : demoStore(() => setUserId(null))
        : null,
    [userId],
  )

  useEffect(() => {
    setProfile(null)
    setProgress(null)
    setLoadErr('')
    setScreen('home')
    if (!store) {
      try {
        localStorage.removeItem('wp_test_draft')
      } catch {
        /* ignore */
      }
      return
    }
    let alive = true
    Promise.all([store.getProfile(), store.getProgress()])
      .then(([p, list]) => {
        if (!alive) return
        setProfile(p)
        setProgress(new Map(list.map((x) => [x.wordId, x])))
      })
      .catch((e) => alive && setLoadErr(e instanceof Error ? e.message : '불러오지 못했어요'))
    return () => {
      alive = false
    }
  }, [store])

  if (!authReady) return <main className="screen center center-text">불러오는 중…</main>

  if (!store) {
    return (
      <Login
        onDemo={() => {
          setDemo()
          setUserId('demo')
        }}
      />
    )
  }

  if (loadErr) {
    return (
      <main className="screen center center-text">
        <p className="error">{loadErr}</p>
        <p className="mute small">
          Supabase에 supabase/schema.sql을 실행했는지 확인해 주세요.
        </p>
        <button className="btn" onClick={() => window.location.reload()}>
          다시 시도
        </button>
        <button className="btn ghost" onClick={() => store.signOut()}>
          로그아웃
        </button>
      </main>
    )
  }

  if (!profile || !progress) return <main className="screen center center-text">불러오는 중…</main>

  const patchProfile = (patch: Partial<Profile>) => {
    setProfile((p) => ({ ...(p ?? DEFAULT_PROFILE), ...patch }))
    store.saveProfile(patch).catch((e) => setLoadErr(e instanceof Error ? e.message : '저장 실패'))
  }

  async function finishTest(level: number, result: TestResult) {
    await store!.saveLevelTest(result)
    await store!.saveProfile({ level, tested: true })
    setProfile((p) => ({ ...(p ?? DEFAULT_PROFILE), level, tested: true }))
    setScreen('home')
  }

  // 처음이면 레벨 테스트부터
  if (!profile.tested || profile.level == null) {
    return <LevelTest autoAudio={profile.autoAudio} onFinish={finishTest} />
  }

  if (screen === 'test') {
    return (
      <LevelTest autoAudio={profile.autoAudio} onFinish={finishTest} onCancel={() => setScreen('settings')} />
    )
  }

  if (screen === 'study') {
    return (
      <Study
        store={store}
        profile={profile}
        initial={[...progress.values()]}
        newCount={studyOpts.newCount}
        reviewBudget={studyOpts.reviewBudget}
        onLevelUp={(level) => patchProfile({ level })}
        onExit={(list) => {
          setProgress(new Map(list.map((x) => [x.wordId, x])))
          setScreen('home')
        }}
      />
    )
  }

  if (screen === 'settings') {
    return (
      <Settings
        profile={profile}
        store={store}
        onChange={patchProfile}
        onRetest={() => {
          try {
            localStorage.removeItem('wp_test_draft')
          } catch {
            /* ignore */
          }
          setScreen('test')
        }}
        onBack={() => setScreen('home')}
        onClock={() => setTick((n) => n + 1)}
      />
    )
  }

  return (
    <Home
      profile={profile}
      progress={progress}
      demo={store.demo}
      onStart={(o) => {
        setStudyOpts(o)
        setScreen('study')
      }}
      onSettings={() => setScreen('settings')}
      onLevelUp={() => patchProfile({ level: Math.min(4, (profile.level ?? 1) + 1) })}
    />
  )
}
