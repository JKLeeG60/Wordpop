import { useEffect, useMemo, useState } from 'react'
import { LEVEL_NAMES, WORDS, mainPos, meaningOf, shuffle } from '../lib/words'
import { speak } from '../lib/audio'
import type { TestResult, WordRow } from '../lib/types'

const PER_LEVEL = 6
const DRAFT = 'wp_test_draft'

type Q = { id: string; options: string[] } // options: 단어 id 4개 (정답 포함)
type Draft = { qs: Q[]; answers: (string | null)[] }

function makeQuestions(): Q[] {
  const qs: Q[] = []
  for (const level of [1, 2, 3, 4]) {
    const pool = WORDS.filter((w) => w.level === level)
    shuffle(pool)
      .slice(0, PER_LEVEL)
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
  try {
    const raw = localStorage.getItem(DRAFT)
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (d.qs?.length === 4 * PER_LEVEL) return d
    }
  } catch {
    /* ignore */
  }
  const qs = makeQuestions()
  return { qs, answers: qs.map(() => null) }
}

const wordById = (id: string) => WORDS.find((w) => w.id === id)!

export function scoreTest(d: Draft): TestResult {
  const scores: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  d.qs.forEach((q, i) => {
    if (d.answers[i] === q.id) scores[wordById(q.id).level]++
  })
  // 낮은 구간부터 보다가 정답이 처음으로 5개 미만인 구간에서 시작. 모두 5개 이상이면 700~990.
  let level = 4
  for (const lv of [1, 2, 3, 4]) {
    if (scores[lv] < 5) {
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
    setDraft({ qs, answers: qs.map(() => null) })
  }

  if (done && result) {
    const level = choice ?? result.resultLevel
    return (
      <main className="screen">
        <h1>테스트 결과</h1>
        <p className="mute">구간별로 6문제 중 맞힌 개수예요.</p>
        <div className="panel">
          {[1, 2, 3, 4].map((lv) => (
            <div className="score-row" key={lv}>
              <span>{LEVEL_NAMES[lv]}</span>
              <div className="bar">
                <i style={{ width: `${(result.scores[lv] / PER_LEVEL) * 100}%` }} />
              </div>
              <b>{result.scores[lv]}/6</b>
            </div>
          ))}
        </div>
        <div className="panel mt">
          <p className="mute small">추천 시작 레벨</p>
          <div className="level-title">{LEVEL_NAMES[result.resultLevel]}</div>
          {result.resultLevel === 4 && result.scores[4] >= 5 && (
            <p className="mute small">모든 구간을 잘 풀었어요. 가장 어려운 구간에서 시작해요.</p>
          )}
          <p className="mute small">직접 바꿔도 좋아요. 본인 판단이 더 정확할 때가 많아요.</p>
          <div className="row mt">
            <button className="btn grow" disabled={level <= 1} onClick={() => setChoice(level - 1)}>
              ← 한 단계 쉽게
            </button>
            <button className="btn grow" disabled={level >= 4} onClick={() => setChoice(level + 1)}>
              한 단계 어렵게 →
            </button>
          </div>
          <p className="center-text mt">
            선택한 레벨 <b>{LEVEL_NAMES[level]}</b>
          </p>
        </div>
        <p className="mute small mt">
          * 점수대 구분은 실제 토익 점수가 아니라 단어 난이도를 추정한 값이에요.
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
