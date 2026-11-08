import { useEffect, useRef, useState } from 'react'
import { courseWords, levelName, maxLevel, wordsOfLevel } from '../lib/words'
import { now } from '../lib/clock'
import {
  REVIEW_CAP,
  SESSION_MAX,
  cumulativeSeries,
  dueList,
  freshWords,
  newToday,
  reviewedToday,
  streakDays,
} from '../lib/srs'
import { COURSES, courseOf, type CourseKey } from '../lib/courses'
import type { Profile, Progress } from '../lib/types'

export default function Home({
  course,
  onCourse,
  profile,
  progress,
  demo,
  onStart,
  onSettings,
  onLevelUp,
}: {
  course: CourseKey
  onCourse: (c: CourseKey) => void
  profile: Profile
  progress: Map<string, Progress>
  demo: boolean
  onStart: (o: { newCount: number; reviewBudget: number }) => void
  onSettings: () => void
  onLevelUp: () => void
}) {
  const cur = courseOf(course)
  const t = now()
  const level = profile.level ?? 1
  const all = [...progress.values()]
  const learned = all.length
  const graduated = all.filter((p) => p.box >= 6).length
  const due = dueList(progress, t).length
  const levelWords = wordsOfLevel(level)
  const mastered = levelWords.filter((w) => (progress.get(w.id)?.box ?? 0) >= 3).length
  const pct = levelWords.length ? Math.round((mastered / levelWords.length) * 100) : 0
  const fresh = freshWords(level, courseWords(), progress).length
  const doneNew = newToday(progress, t)
  const goal = profile.dailyGoal
  const goalPct = Math.min(100, Math.round((doneNew / goal) * 100))
  const streak = streakDays(progress, goal, t)
  const series = cumulativeSeries(progress, t)

  const budget = Math.max(0, REVIEW_CAP - reviewedToday(progress, t))
  const reviewN = Math.min(due, budget, SESSION_MAX)
  const newN = Math.min(Math.max(0, goal - doneNew), fresh, Math.max(0, SESSION_MAX - reviewN))
  const nothing = reviewN === 0 && newN === 0

  // 누적 그래프: 영역 크기를 재서 그 크기에 맞게 그린다 (화면 높이에 따라 늘어남)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 300, h: 120 })
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [course]) // 탭을 바꿔 그래프가 다시 나타나면 크기를 다시 잰다
  const { w: W, h: H } = size
  const TOP = 26
  const BOTTOM = 22
  const max = Math.max(1, ...series.map((s) => s.value))
  const min = Math.min(...series.map((s) => s.value))
  const span = Math.max(1, max - min)
  const pts = series.map((s, i) => {
    const x = 24 + (i * (W - 48)) / (series.length - 1)
    const y = TOP + (1 - (s.value - min) / span) * Math.max(10, H - TOP - BOTTOM)
    return [x, y] as const
  })
  const line = pts.map((p) => p.join(',')).join(' ')

  const start = () => {
    if (nothing) {
      if (fresh > 0) onStart({ newCount: 10, reviewBudget: 0 })
      return
    }
    onStart({ newCount: newN, reviewBudget: budget })
  }

  return (
    <main className="screen home">
      <div className="row between">
        <div className="brand sm">Word Pop</div>
        <button className="icon-btn" onClick={onSettings} aria-label="설정">
          ⚙️
        </button>
      </div>

      <div className="tabs4 mt" role="group" aria-label="학습할 시험">
        {COURSES.map((c) => (
          <button
            key={c.key}
            className={`tab ${c.key === course ? 'on' : ''}`}
            aria-pressed={c.key === course}
            onClick={() => onCourse(c.key)}
          >
            <span className="tab-name">{c.name}</span>
            <span className="tab-exam">{c.exam.replace(' · ', '·')}</span>
          </button>
        ))}
      </div>

      {demo && <div className="banner">체험 모드 · 기록은 이 브라우저에만 저장돼요</div>}

      {!cur.ready ? (
        <div className="panel soon-panel mt">
          <span className="course-glyph soon big">{cur.glyph}</span>
          <h2 className="m0">
            {cur.name} · {cur.exam}
          </h2>
          <span className="soon-pill">준비 중</span>
          <p className="mute m0">
            아직 열리지 않았어요.
            <br />
            열리면 이 자리에 학습 통계가 나타나요.
          </p>
        </div>
      ) : (
        <>
      <div className="mt">
        <span className="chip">레벨 {levelName(level)}</span>
      </div>

      <div className="panel chart-panel mt">
        <div className="row between">
          <div className="stat-big">
            <b>{learned}</b>
            <span>누적 학습 카드</span>
          </div>
          <div className="streak">🔥 {streak}일 연속</div>
        </div>
        <div className="chart-box" ref={boxRef}>
          <svg width={W} height={H} role="img" aria-label="최근 7일 누적 학습 카드">
            <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r="3.5" fill="var(--accent)" />
                <text x={p[0]} y={p[1] - 9} textAnchor="middle" className="val">
                  {series[i].value}
                </text>
                <text x={p[0]} y={H - 4} textAnchor="middle" className="axis">
                  {series[i].label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="grid2 mt">
        <div className="panel">
          <div className="stat-big">
            <b>{due}</b>
            <span>오늘 복습할 카드</span>
          </div>
        </div>
        <div className="panel">
          <div className="stat-big">
            <b>{graduated}</b>
            <span>졸업한 단어</span>
          </div>
        </div>
      </div>

      <div className="panel mt">
        <div className="row between">
          <span>오늘의 새 단어 목표</span>
          <b>
            {doneNew} / {goal}
          </b>
        </div>
        <div className="bar mt">
          <i style={{ width: `${goalPct}%` }} />
        </div>
      </div>

      <div className="panel mt">
        <div className="row between">
          <span>레벨 {levelName(level)} 진도</span>
          <b>{pct}%</b>
        </div>
        <div className="bar mt">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="mute small">
          {mastered} / {levelWords.length}개 익힘 (복습 3단계 이상)
        </p>
        {pct >= 80 && level < maxLevel() && (
          <button className="btn block mt" onClick={onLevelUp}>
            🎉 다음 레벨({levelName(level + 1)})로 올라갈까요?
          </button>
        )}
      </div>

      <button className="btn primary block mt" onClick={start} disabled={nothing && fresh === 0}>
        {nothing
          ? fresh > 0
            ? '오늘 목표 완료 🎉 새 단어 10개 더'
            : '이 레벨 단어를 모두 만났어요'
          : `학습 시작 · 복습 ${reviewN} · 새 단어 ${newN}`}
      </button>
        </>
      )}
    </main>
  )
}
