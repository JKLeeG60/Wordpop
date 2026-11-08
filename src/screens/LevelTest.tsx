import { useEffect, useMemo, useState } from 'react'
import { WORD_MAP, courseLevels, courseWords, getActiveCourse, levelName, mainPos, meaningOf, shuffle } from '../lib/words'
import { courseOf, type CourseKey } from '../lib/courses'
import { speak } from '../lib/audio'
import type { TestResult, WordRow } from '../lib/types'

const DRAFT = 'wp_test_draft'

type Q = { id: string; options: string[] } // options: 단어 id 4개 (정답 포함)
type Draft = { course: CourseKey; qs: Q[]; answers: (string | null)[] }

function makeQuestions(): Q[] {
  const qs: Q[] = []
  const WORDS = courseWords()
  for (const level of courseLevels()) {
    const pool = WORDS.filter((w) => w.level === level)
    shuffle(pool)
      .slice(0, courseOf(getActiveCourse()).perLevel)
      .forEach((w) => {
        // 같은 품사 + 비슷한 난이도에서 오답 보기를 고르고, 부족하면 같은 레벨 전체에서 채운다
        const same = shuffle(WORDS.filter((x) => x.id !== w.id && mainPos(x) === mainPos(w) && Math.abs(x.level - w.level) <= 1))
        const fallback = shuffle(WORDS.filter((x) => x.id !== w.id && x.level === w.level))
        const wrong: WordRow[] = []
        for (const c of [...same, ...fallback]) {
          if (wrong.length >= 3) break
          const dup = wrong.some((x) => meaningOf(x) === meaningOf(c)) || meaningOf(c) === meaningOf(w)
          if (!dup) wrong.push(c)
        }
        qs.push({ id: w.id, options: shuffle([w.id, ...wrong.map((x) => x.id)]) })
      })
  }
  return qs
}

function loadDraft(): Draft {
  const course = getActiveCourse()
  try {
    const raw = localStorage.getItem(DRAFT)
    if (raw) {
      const d = JSON.parse(raw) as Partial<Draft>
      // 같은 언어로 보던 시험만 이어서 본다 (예전 영어 기록은 course가 없어서 영어로 본다)
      if ((d.course ?? 'en') === course && d.qs?.length === courseLevels().length * courseOf(course).perLevel) {
        return { course, qs: d.qs, answers: d.answers ?? d.qs.map(() => null) }
      }
    }
  } catch {
    /* ignore */
  }
  const qs = makeQuestions()
  return { course, qs, answers: qs.map(() => null) }
}

const wordById = (id: string) => WORD_MAP.get(id)!

export function scoreTest(d: Draft): TestResult {
  const levels = courseLevels()
  const scores: Record<number, number> = Object.fromEntries(levels.map((lv) => [lv, 0]))
  d.qs.forEach((q, i) => {
    if (d.answers[i] === q.id) scores[wordById(q.id).level]++
  })
  // 낮은 구간부터 보다가 정답이 처음으로 기준(영어 6문제 중 5개 등) 미만인 구간에서 시작. 모두 넘으면 가장 어려운 구간.
  const pass = courseOf(getActiveCourse()).pass
  let level = levels[levels.length - 1]
  for (const lv of levels) {
    if (scores[lv] < pass) {
      level = lv
      break
    }
  }
  return { scores, resultLevel: level }
}

export default function LevelTest({
  autoAudio,
  onFinish,
  onCancel,
}: {
  autoAudio: boolean
  onFinish: (level: number, result: TestResult) => Promise<void>
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [choice, setChoice] = useState<number | null>(null) // 결과 화면에서 고른 시작 레벨
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const idx = draft.answers.findIndex((a) => a === null)
  const done = idx === -1
  const total = draft.qs.length
  const cfg = courseOf(draft.course)
  const levels = courseLevels(draft.course)
  const topLevel = levels[levels.length - 1]

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }, [draft])

  const result: TestResult | null = useMemo(() => (done ? scoreTest(draft) : null), [done, draft])

  const q = !done ? draft.qs[idx] : null
  const w = q ? wordById(q.id) : null

  useEffect(() => {
    if (w && autoAudio) speak(w.word)
  }, [w?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function answer(a: string) {
    setDraft((d) => {
      const answers = d.answers.slice()
      answers[idx] = a
      return { ...d, answers }
    })
  }

  const options = useMemo(() => (q ? q.options.map(wordById) : []), [q])

  async function start() {
    if (!result) return
    setSaving(true)
    setError('')
    try {
      await onFinish(choice ?? result.resultLevel, result)
      localStorage.removeItem(DRAFT)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요')
      setSaving(false)
    }
  }

  function retake() {
    const qs = makeQuestions()
    setChoice(null)
    setDraft({ course: draft.course, qs, answers: qs.map(() => null) })
  }

  if (done && result) {
    const level = choice ?? result.resultLevel
    return (
      <main className="screen">
        <h1>테스트 결과</h1>
        <p className="mute">구간별로 {cfg.perLevel}문제 중 맞힌 개수예요.</p>
        <div className="panel">
          {levels.map((lv) => (
            <div className="score-row" key={lv}>
              <span>{levelName(lv, draft.course)}</span>
              <div className="bar">
                <i style={{ width: `${(result.scores[lv] / cfg.perLevel) * 100}%` }} />
              </div>
              <b>
                {result.scores[lv]}/{cfg.perLevel}
              </b>
            </div>
          ))}
        </div>
        <div className="panel mt">
          <p className="mute small">추천 시작 레벨</p>
          <div className="level-title">{levelName(result.resultLevel, draft.course)}</div>
          {result.resultLevel === topLevel && result.scores[topLevel] >= cfg.pass && (
            <p className="mute small">모든 구간을 잘 풀었어요. 가장 어려운 구간에서 시작해요.</p>
          )}
          <p className="mute small">직접 바꿔도 좋아요. 본인 판단이 더 정확할 때가 많아요.</p>
          <div className="row mt">
            <button className="btn grow" disabled={level <= 1} onClick={() => setChoice(level - 1)}>
              ← 한 단계 쉽게
            </button>
            <button className="btn grow" disabled={level >= topLevel} onClick={() => setChoice(level + 1)}>
              한 단계 어렵게 →
            </button>
          </div>
          <p className="center-text mt">
            선택한 레벨 <b>{levelName(level, draft.course)}</b>
          </p>
        </div>
        <p className="mute small mt">
          {cfg.note}
        </p>
        {error && <p className="error">{error}</p>}
        <div className="spacer" />
        <button className="btn primary block" disabled={saving} onClick={start}>
          {saving ? '저장 중…' : '이 레벨로 시작하기'}
        </button>
        <button className="btn ghost block" onClick={retake}>
          테스트 다시 보기
        </button>
      </main>
    )
  }

  if (!q || !w) return <main className="screen">불러오는 중…</main>

  return (
    <main className="screen">
      <div className="row between">
        <span className="mute small">
          레벨 테스트 {idx + 1} / {total}
        </span>
        {onCancel && (
          <button className="link" onClick={onCancel}>
            나중에
          </button>
        )}
      </div>
      <div className="bar mt">
        <i style={{ width: `${(idx / total) * 100}%` }} />
      </div>
      <div className="spacer" />
      <div className="test-word">
        <div className="word">{w.word}</div>
        <div className="mute">{w.pos}</div>
        <button className="speak" onClick={() => speak(w.word)} aria-label="발음 듣기">
          🔊
        </button>
      </div>
      <div className="spacer" />
      <div className="options">
        {options.map((o) => (
          <button key={o.id} className="btn option" onClick={() => answer(o.id)}>
            {meaningOf(o)}
          </button>
        ))}
        <button className="btn ghost" onClick={() => answer('__dont_know__')}>
          모르겠어요
        </button>
      </div>
    </main>
  )
}
