import { useEffect, useMemo, useState } from 'react'
import { configured, supabase } from './supabase'
import { DEFAULT_PROFILE, demoStore, supabaseStore } from './lib/store'
import { initAudio } from './lib/audio'
import { ALL_LEVELS, WORD_MAP, isLevelLoaded, loadLevels } from './lib/words'
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
  const [, setWv] = useState(0)

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

  // 필요한 레벨의 단어 파일만 불러온다 (레벨 테스트 중엔 전체, 평소엔 현재 레벨)
  const need = !profile ? [] : !profile.tested || profile.level == null || screen === 'test' ? ALL_LEVELS : [profile.level]
  const hasUnknown = !!progress && [...progress.keys()].some((id) => !WORD_MAP.has(id))
  const toLoad = [...new Set([...need, ...(hasUnknown ? ALL_LEVELS : [])])].filter((l) => !isLevelLoaded(l))
  const allLoaded = ALL_LEVELS.every(isLevelLoaded)
  const wordsReady = !!profile && !!progress && need.every(isLevelLoaded) && (!hasUnknown || allLoaded)
  useEffect(() => {
    if (!toLoad.length) return
    let alive = true
    loadLevels(toLoad)
      .then(() => alive && setWv((v) => v + 1))
      .catch(() => alive && setLoadErr('단어를 불러오지 못했어요. 네트워크를 확인해 주세요.'))
    return () => {
      alive = false
    }
  }, [toLoad.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  // 지금은 없는 단어(예전 테스트 기록 등)는 목록에서 뺀다
  useEffect(() => {
    if (progress && hasUnknown && allLoaded) {
      setProgress(new Map([...progress].filter(([id]) => WORD_MAP.has(id))))
    }
  }, [progress, hasUnknown, allLoaded])

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

  if (!profile || !progress || !wordsReady) return <main className="screen center center-text">불러오는 중…</main>

  const patchProfile = (patch: Partial<Profile>) => {
    setProfile((p) => ({ ...(p ?? DEFAULT_PROFILE), ...patch }))
    store.saveProfile(patch).catch((e) => setLoadErr(e instanceof Error ? e.message : '저장 실패'))
  }

  // 레벨을 바꿀 때는 새 레벨 단어를 먼저 불러온 뒤 적용한다
  async function changeLevel(level: number) {
    await loadLevels([level])
    patchProfile({ level })
  }
  const onSettingsChange = (patch: Partial<Profile>) => {
    const { level, ...rest } = patch
    if (level != null) changeLevel(level).catch(() => setLoadErr('단어를 불러오지 못했어요.'))
    if (Object.keys(rest).length) patchProfile(rest)
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
        onLevelUp={changeLevel}
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
        onChange={onSettingsChange}
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
      onLevelUp={() => changeLevel(Math.min(4, (profile.level ?? 1) + 1))}
    />
  )
}
