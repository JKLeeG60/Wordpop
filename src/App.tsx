import { useEffect, useMemo, useRef, useState } from 'react'
import { configured, supabase } from './supabase'
import { DEFAULT_PROFILE, demoStore, migrateTrialData, seedTrialProfile, supabaseStore } from './lib/store'
import { initAudio } from './lib/audio'
import { ALL_LEVELS, WORD_MAP, isLevelLoaded, loadLevels } from './lib/words'
import type { Profile, Progress, TestResult } from './lib/types'
import { PICK_FLAG } from './lib/auth'
import Login from './screens/Login'
import CoursePicker from './screens/CoursePicker'
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
const clearDemoFlag = () => {
  try {
    localStorage.removeItem('wp_demo_user')
  } catch {
    /* ignore */
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
    getDemo() ? 'demo' : null,
  )
  const [authReady, setAuthReady] = useState(!configured)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [progress, setProgress] = useState<Map<string, Progress> | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [screen, setScreen] = useState<Screen>('home')
  const [studyOpts, setStudyOpts] = useState({ newCount: 0, reviewBudget: 0 })
  const [, setTick] = useState(0)
  const [, setWv] = useState(0)
  const [coursePicked, setCoursePicked] = useState(false) // 이번 접속에서 시험을 골랐는지
  // 방금 '구글로 계속하기'로 로그인해서 돌아왔는지: 표시는 한 번 읽고 바로 지운다
  const [loginPick, setLoginPick] = useState(() => {
    try {
      const v = localStorage.getItem(PICK_FLAG) === '1'
      localStorage.removeItem(PICK_FLAG)
      return v
    } catch {
      return false
    }
  })
  const trialStart = useRef(false) // '체험하기'로 막 들어왔는지(바로 학습 화면으로 보낼 때 사용)

  useEffect(() => {
    initAudio()
  }, [])

  useEffect(() => {
    if (!configured) return
    // 체험 모드('demo')는 로그인 상태 확인이 덮어쓰지 않는다
    const apply = (id: string | null) => {
      if (id) clearDemoFlag() // 로그인되면 체험 표시를 끈다(체험 기록은 아래에서 계정으로 옮김)
      setUserId((prev) => id ?? (prev === 'demo' ? prev : null))
    }
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user.id ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const store = useMemo(
    () =>
      userId
        ? configured && userId !== 'demo'
          ? supabaseStore(userId)
          : demoStore(() => setUserId(null))
        : null,
    [userId],
  )

  useEffect(() => {
    setProfile(null)
    setProgress(null)
    setLoadErr('')
    setCoursePicked(false)
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
    const load = async () => {
      // 로그인한 계정이면, 체험 중 쌓은 기록을 먼저 옮긴다 (실패하면 다음에 다시 시도)
      if (!store.demo) await migrateTrialData(store).catch(() => undefined)
      return Promise.all([store.getProfile(), store.getProgress()])
    }
    load()
      .then(([p, list]) => {
        if (!alive) return
        setProfile(p)
        setProgress(new Map(list.map((x) => [x.wordId, x])))
        // 체험하기로 처음 들어왔으면 레벨 테스트 없이 바로 새 단어 10개 학습
        if (trialStart.current) {
          trialStart.current = false
          if (p.tested && p.level && list.length === 0) {
            setStudyOpts({ newCount: 10, reviewBudget: 0 })
            setScreen('study')
          }
        }
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
          if (configured) {
            seedTrialProfile()
            trialStart.current = true
          }
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
  // 설정 화면에서 '저장'을 눌렀을 때만 호출된다
  const onSettingsSave = async (patch: Partial<Profile>) => {
    const { level, ...rest } = patch
    if (level != null) await changeLevel(level)
    if (Object.keys(rest).length) patchProfile(rest)
    setScreen('home')
  }

  async function finishTest(level: number, result: TestResult) {
    await store!.saveLevelTest(result)
    await store!.saveProfile({ level, tested: true })
    setProfile((p) => ({ ...(p ?? DEFAULT_PROFILE), level, tested: true }))
    setScreen('home')
  }

  // 새 계정이거나 방금 로그인했다면 시험 선택부터 (체험 모드는 제외)
  const untested = !profile.tested || profile.level == null
  if (!coursePicked && (untested || (loginPick && !store.demo))) {
    return (
      <CoursePicker
        onPick={() => {
          setCoursePicked(true)
          setLoginPick(false)
        }}
      />
    )
  }

  // 처음이면 레벨 테스트부터
  if (untested) {
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
        trial={configured && store.demo}
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
        onSave={onSettingsSave}
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
