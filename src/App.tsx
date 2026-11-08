import { useEffect, useMemo, useRef, useState } from 'react'
import { configured, supabase } from './supabase'
import { DEFAULT_PROFILE, demoStore, migrateTrialData, seedTrialProfile, supabaseStore } from './lib/store'
import { initAudio, setSpeechLang } from './lib/audio'
import { WORD_MAP, courseLevels, getActiveCourse, isLevelLoaded, loadLevels, maxLevel, setActiveCourse } from './lib/words'
import { courseOf, courseOfId, type CourseKey } from './lib/courses'
import { readCourseLevels, writeCourseLevel, type CourseLevels } from './lib/courseState'
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
  const [course, setCourse] = useState<CourseKey>(getActiveCourse) // 지금 학습 중인 언어
  const [levels, setLevels] = useState<CourseLevels>({}) // 영어 이외 언어의 레벨(이 기기에 저장)
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
    setSpeechLang(courseOf(course).speech)
  }, [course])

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
    setLevels(userId ? readCourseLevels(userId) : {})
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

  // 지금 언어에 맞춘 프로필: 영어는 계정 값 그대로, 다른 언어는 레벨·테스트 여부를 이 기기 값으로 덮어쓴다
  const eff: Profile | null = useMemo(() => {
    if (!profile) return null
    if (course === 'en') return profile
    const lv = levels[course]
    return { ...profile, level: lv ?? null, tested: lv != null }
  }, [profile, course, levels])
  // 학습 기록은 지금 언어 단어만 골라서 화면에 넘긴다
  const cp = useMemo(
    () => (progress ? new Map([...progress].filter(([id]) => courseOfId(id) === course)) : null),
    [progress, course],
  )

  // 필요한 레벨의 단어 파일만 불러온다 (레벨 테스트 중엔 전체, 평소엔 현재 레벨)
  const lvAll = courseLevels(course)
  const need = !eff ? [] : !eff.tested || eff.level == null || screen === 'test' ? lvAll : [eff.level]
  const hasUnknown = !!cp && [...cp.keys()].some((id) => !WORD_MAP.has(id))
  const toLoad = [...new Set([...need, ...(hasUnknown ? lvAll : [])])].filter((l) => !isLevelLoaded(l, course))
  const allLoaded = lvAll.every((l) => isLevelLoaded(l, course))
  const wordsReady = !!eff && !!progress && need.every((l) => isLevelLoaded(l, course)) && (!hasUnknown || allLoaded)
  useEffect(() => {
    if (!toLoad.length) return
    let alive = true
    loadLevels(toLoad, course)
      .then(() => alive && setWv((v) => v + 1))
      .catch(() => alive && setLoadErr('단어를 불러오지 못했어요. 네트워크를 확인해 주세요.'))
    return () => {
      alive = false
    }
  }, [toLoad.join(','), course]) // eslint-disable-line react-hooks/exhaustive-deps
  // 지금은 없는 단어(예전 테스트 기록 등)는 목록에서 뺀다
  useEffect(() => {
    if (progress && hasUnknown && allLoaded) {
      setProgress(new Map([...progress].filter(([id]) => courseOfId(id) !== course || WORD_MAP.has(id))))
    }
  }, [progress, hasUnknown, allLoaded, course])

  // 학습할 언어를 바꾼다 (시험 선택 화면·홈의 언어 탭에서 호출)
  const switchCourse = (c: CourseKey) => {
    setActiveCourse(c)
    setCourse(c)
    setCoursePicked(true)
    setScreen('home')
  }

  if (!authReady) return <main className="screen center center-text">불러오는 중…</main>

  if (!store) {
    return (
      <Login
        onDemo={() => {
          switchCourse('en') // 체험은 영어로 시작
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

  if (!profile || !eff || !progress || !cp || !wordsReady) return <main className="screen center center-text">불러오는 중…</main>

  const patchProfile = (patch: Partial<Profile>) => {
    let p = patch
    if (course !== 'en' && ('level' in p || 'tested' in p)) {
      // 영어 이외 언어의 레벨은 계정이 아니라 이 기기에 저장한다
      const { level, tested: _t, ...rest } = p // eslint-disable-line @typescript-eslint/no-unused-vars
      if (level != null && userId) setLevels(writeCourseLevel(userId, course, level))
      p = rest
    }
    if (!Object.keys(p).length) return
    setProfile((prev) => ({ ...(prev ?? DEFAULT_PROFILE), ...p }))
    store!.saveProfile(p).catch((e) => setLoadErr(e instanceof Error ? e.message : '저장 실패'))
  }

  // 레벨을 바꿀 때는 새 레벨 단어를 먼저 불러온 뒤 적용한다
  async function changeLevel(level: number) {
    await loadLevels([level], course)
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
    if (course === 'en') {
      await store!.saveLevelTest(result)
      await store!.saveProfile({ level, tested: true })
      setProfile((p) => ({ ...(p ?? DEFAULT_PROFILE), level, tested: true }))
    } else if (userId) {
      setLevels(writeCourseLevel(userId, course, level))
    }
    setScreen('home')
  }

  // 새 계정이거나 방금 로그인했다면 시험 선택부터 (체험 모드는 제외)
  const untested = !eff.tested || eff.level == null
  if (!coursePicked && (untested || (loginPick && !store.demo))) {
    return (
      <CoursePicker
        onPick={(c) => {
          switchCourse(c)
          setLoginPick(false)
        }}
      />
    )
  }

  // 처음이면 레벨 테스트부터
  if (untested) {
    return <LevelTest autoAudio={eff.autoAudio} onFinish={finishTest} />
  }

  if (screen === 'test') {
    return (
      <LevelTest autoAudio={eff.autoAudio} onFinish={finishTest} onCancel={() => setScreen('settings')} />
    )
  }

  if (screen === 'study') {
    return (
      <Study
        store={store}
        trial={configured && store.demo}
        profile={eff}
        initial={[...cp.values()]}
        newCount={studyOpts.newCount}
        reviewBudget={studyOpts.reviewBudget}
        onLevelUp={changeLevel}
        onExit={(list) => {
          // 다른 언어 기록은 그대로 두고, 지금 언어 기록만 새 값으로 바꾼다
          const others = [...progress].filter(([id]) => courseOfId(id) !== course)
          setProgress(new Map([...others, ...list.map((x) => [x.wordId, x] as const)]))
          setScreen('home')
        }}
      />
    )
  }

  if (screen === 'settings') {
    return (
      <Settings
        profile={eff}
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
      course={course}
      onCourse={switchCourse}
      profile={eff}
      progress={cp}
      demo={store.demo}
      onStart={(o) => {
        setStudyOpts(o)
        setScreen('study')
      }}
      onSettings={() => setScreen('settings')}
      onLevelUp={() => changeLevel(Math.min(maxLevel(course), (eff.level ?? 1) + 1))}
    />
  )
}
