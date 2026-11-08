import { LEVEL_NAMES, WORDS, wordsOfLevel } from '../lib/words'
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
import type { Profile, Progress } from '../lib/types'

export default function Home({
  profile,
  progress,
  demo,
  onStart,
  onSettings,
  onLevelUp,
}: {
  profile: Profile
  progress: Map<string, Progress>
  demo: boolean
  onStart: (o: { newCount: number; reviewBudget: number }) => void
  onSettings: () => void
  onLevelUp: () => void
}) {
  const t = now()
  const level = profile.level ?? 1
  const all = [...progress.values()]
  const learned = all.length
  const graduated = all.filter((p) => p.box >= 6).length
  const due = dueList(progress, t).length
  const levelWords = wordsOfLevel(level)
  const mastered = levelWords.filter((w) => (progress.get(w.id)?.box ?? 0) >= 3).length
  const pct = levelWords.length ? Math.round((mastered / levelWords.length) * 100) : 0
  const fresh = freshWords(level, WORDS, progress).length
  const doneNew = newToday(progress, t)
  const goal = profile.dailyGoal
  const goalPct = Math.min(100, Math.round((doneNew / goal) * 100))
  const streak = streakDays(progress, goal, t)
  const series = cumulativeSeries(progress, t)

  const budget = Math.max(0, REVIEW_CAP - reviewedToday(progress, t))
  const reviewN = Math.min(due, budget, SESSION_MAX)
  const newN = Math.min(Math.max(0, goal - doneNew), fresh, Math.max(0, SESSION_MAX - reviewN))
  const nothing = reviewN === 0 && newN === 0

  // 누적 그래프
  const W = 300
  const H = 90
  const max = Math.max(1, ...series.map((s) => s.value))
  const min = Math.min(...series.map((s) => s.value))
  const span = Math.max(1, max - min)
  const pts = series.map((s, i) => {
    const x = 20 + (i * (W - 40)) / (series.length - 1)
    const y = 10 + (H - 24) - ((s.value - min) / span) * (H - 34)
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
    <main className="screen">
      <div className="row between">
        <div>
          <div className="brand sm">Word Pop</div>
          <span className="chip">레벨 {LEVEL_NAMES[level]}</span>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="설정">
          ⚙️
        </button>
      </div>

      {demo && <div className="banner">데모 모드 · 기록은 이 브라우저에만 저장돼요</div>}

      <div className="panel mt">
        <div className="row between">
          <div className="stat-big">
            <b>{learned}</b>
            <span>누적 학습 카드</span>
          </div>
          <div className="streak">🔥 {streak}일 연속</div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="최근 7일 누적 학습 카드">
          <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="3.5" fill="var(--accent)" />
              <text x={p[0]} y={H - 2} textAnchor="middle" className="axis">
                {series[i].label}
              </text>
            </g>
          ))}
        </svg>
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
          <span>레벨 {LEVEL_NAMES[level]} 진도</span>
          <b>{pct}%</b>
        </div>
        <div className="bar mt">
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="mute small">
          {mastered} / {levelWords.length}개 익힘 (복습 3단계 이상)
        </p>
        {pct >= 80 && level < 4 && (
          <button className="btn block mt" onClick={onLevelUp}>
            🎉 다음 레벨({LEVEL_NAMES[level + 1]})로 올라갈까요?
          </button>
        )}
      </div>

      <div className="spacer" />
      <button className="btn primary block" onClick={start} disabled={nothing && fresh === 0}>
        {nothing
          ? fresh > 0
            ? '오늘 목표 완료 🎉 새 단어 10개 더'
            : '이 레벨 단어를 모두 만났어요'
          : `학습 시작 · 복습 ${reviewN} · 새 단어 ${newN}`}
      </button>
    </main>
  )
}
