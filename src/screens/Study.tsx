import { useEffect, useRef, useState } from 'react'
import { LEVEL_NAMES, WORDS, WORD_MAP, exampleKoOf, meaningOf } from '../lib/words'
import { now } from '../lib/clock'
import {
  REVIEW_CAP,
  applyJudgement,
  buildSession,
  dueList,
  freshWords,
  reviewedToday,
  type Item,
} from '../lib/srs'
import { speak } from '../lib/audio'
import { signInWithGoogle } from '../lib/auth'
import type { Store } from '../lib/store'
import type { Profile, Progress } from '../lib/types'

type Hist = { queue: Item[]; wordId: string; prev?: Progress; logP: Promise<string>; known: boolean }

const PROMPT_KEY = 'wp_trial_prompt'
const promptSeen = () => {
  try {
    return localStorage.getItem(PROMPT_KEY) === '1'
  } catch {
    return false
  }
}

export default function Study({
  store,
  trial,
  profile,
  initial,
  newCount,
  reviewBudget,
  onLevelUp,
  onExit,
}: {
  store: Store
  trial: boolean // 로그인 없이 체험 중인지
  profile: Profile
  initial: Progress[]
  newCount: number
  reviewBudget: number
  onLevelUp: (level: number) => Promise<void>
  onExit: (p: Progress[]) => void
}) {
  const map = useRef(new Map(initial.map((p) => [p.wordId, p])))
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const shownAt = useRef(Date.now())
  const level = profile.level ?? 1

  const build = (nc: number, rb: number, lv = level) =>
    buildSession({ level: lv, words: WORDS, progress: map.current, now: now(), newCount: nc, reviewBudget: rb })

  const [queue, setQueue] = useState<Item[]>(() => build(newCount, reviewBudget))
  const [flipped, setFlipped] = useState(false)
  const [hist, setHist] = useState<Hist[]>([])
  const [known, setKnown] = useState(0)
  const [unknown, setUnknown] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [err, setErr] = useState('')
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const promptDone = useRef(promptSeen())

  // 체험 중 서로 다른 카드 10장을 한 번씩 넘기면 로그인 안내를 한 번만 띄운다
  useEffect(() => {
    if (!trial || promptDone.current) return
    if (new Set(hist.map((h) => h.wordId)).size >= 10) {
      promptDone.current = true
      try {
        localStorage.setItem(PROMPT_KEY, '1')
      } catch {
        /* ignore */
      }
      setShowLogin(true)
    }
  }, [hist.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const loginSheet = showLogin && (
    <div className="modal soft" onClick={() => setShowLogin(false)}>
      <div className="sheet soft center-text" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="로그인 안내">
        <div className="big-emoji">🎉</div>
        <h2 className="m0">10개 완료!</h2>
        <p className="mute">
          로그인하면 지금까지의 학습 기록이 저장되고,
          <br />
          복습 일정도 다른 기기에서 이어갈 수 있어요.
        </p>
        <button
          className="btn primary block"
          onClick={async () => {
            setLoginErr('')
            const msg = await signInWithGoogle()
            if (msg) setLoginErr(msg)
          }}
        >
          Google로 계속하기
        </button>
        {loginErr && <p className="error">{loginErr}</p>}
        <button className="btn ghost block" onClick={() => setShowLogin(false)}>
          나중에 할게요
        </button>
      </div>
    </div>
  )

  const persist = (fn: () => Promise<unknown>) => {
    chain.current = chain.current
      .then(fn)
      .catch(() => setErr('저장에 실패했어요. 네트워크를 확인해 주세요.'))
  }

  const head = queue[0]
  const word = head ? WORD_MAP.get(head.id) : undefined

  // 카드가 바뀔 때마다 응답 시간 측정 + 발음 자동 재생
  useEffect(() => {
    shownAt.current = Date.now()
    if (word && profile.autoAudio) speak(word.word)
  }, [head?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function judge(isKnown: boolean) {
    const it = queue[0]
    if (!it) return
    const t = now()
    const prev = map.current.get(it.id)
    const j = applyJudgement({
      wordId: it.id,
      prev,
      known: isKnown,
      failedBefore: it.failed,
      wrongRun: it.wrongRun,
      now: t,
    })
    map.current.set(it.id, j.next)
    const rest = queue.slice(1)
    if (j.requeueGap != null) {
      rest.splice(Math.min(j.requeueGap, rest.length), 0, { ...it, failed: true, wrongRun: j.wrongRun })
    }
    const logP = store.logReview({
      wordId: it.id,
      known: isKnown,
      isNew: !prev,
      responseMs: Date.now() - shownAt.current,
      reviewedAt: Date.now(),
    })
    logP.catch(() => setErr('저장에 실패했어요. 네트워크를 확인해 주세요.'))
    persist(() => store.saveProgress(j.next))
    setHist((h) => [...h, { queue, wordId: it.id, prev, logP, known: isKnown }])
    setQueue(rest)
    setFlipped(false)
    setConfirm(false)
    if (isKnown) setKnown((n) => n + 1)
    else setUnknown((n) => n + 1)
  }

  function undo() {
    const h = hist[hist.length - 1]
    if (!h) return
    const prev = h.prev
    if (prev) {
      map.current.set(h.wordId, prev)
      persist(() => store.saveProgress(prev))
    } else {
      map.current.delete(h.wordId)
      persist(() => store.deleteProgress(h.wordId))
    }
    h.logP.then((id) => store.removeLog(id)).catch(() => undefined)
    setHist((x) => x.slice(0, -1))
    setQueue(h.queue)
    setFlipped(false)
    setConfirm(false)
    if (h.known) setKnown((n) => n - 1)
    else setUnknown((n) => n - 1)
  }

  // 위로 밀기/알아요: 뒤집기 전이면 정말 아는지 한 번 더 확인
  const askKnow = () => (flipped || !profile.confirmKnow ? judge(true) : setConfirm(true))

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined)
  keys.current = (e) => {
    if (!head) return
    if (confirm) {
      if (e.key === 'Enter' || e.key === 'ArrowUp') judge(true)
      else if (e.key === 'Escape') setConfirm(false)
      return
    }
    if (e.key === ' ') {
      e.preventDefault()
      setFlipped((f) => !f)
    } else if (e.key === 'ArrowUp') askKnow()
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') judge(false)
    else if (e.key.toLowerCase() === 'z') undo()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const exit = () => onExit([...map.current.values()])

  function startMore(nc: number, rb: number, lv = level) {
    const q = build(nc, rb, lv)
    setQueue(q)
    setHist([])
    setKnown(0)
    setUnknown(0)
    setFlipped(false)
  }

  /* ---------- 끝 화면 ---------- */
  if (!head || !word) {
    const t = now()
    const fresh = freshWords(level, WORDS, map.current).length
    const dueLeft = dueList(map.current, t).length
    const budgetLeft = Math.max(0, REVIEW_CAP - reviewedToday(map.current, t))
    const nextLevel = level < 4 ? level + 1 : null
    return (
      <main className="screen center">
        <div className="spacer" />
        <div className="center-text pop-in">
          <div className="big-emoji">🎉</div>
          <h1>학습 완료!</h1>
          <p className="mute">
            알아요 {known} · 몰라요 {unknown}
          </p>
        </div>
        <div className="spacer" />
        {err && <p className="error">{err}</p>}
        {dueLeft > 0 && budgetLeft > 0 && (
          <button className="btn block" onClick={() => startMore(0, budgetLeft)}>
            복습 이어서 하기 ({Math.min(dueLeft, budgetLeft)}장)
          </button>
        )}
        {fresh > 0 ? (
          <button className="btn primary block" onClick={() => startMore(10, 0)}>
            새 단어 {Math.min(10, fresh)}개 더 보기
          </button>
        ) : nextLevel ? (
          <button
            className="btn primary block"
            onClick={async () => {
              try {
                await onLevelUp(nextLevel)
                startMore(10, 0, nextLevel)
              } catch {
                setErr('다음 레벨 단어를 불러오지 못했어요.')
              }
            }}
          >
            이 레벨 단어를 모두 봤어요 → {LEVEL_NAMES[nextLevel]} 레벨로
          </button>
        ) : (
          <p className="center-text mute">모든 단어를 만났어요. 복습으로 완벽하게 만들어요!</p>
        )}
        {hist.length > 0 && (
          <button className="btn ghost block" onClick={undo}>
            ↶ 마지막 카드 되돌리기
          </button>
        )}
        <button className="btn ghost block" onClick={exit}>
          홈으로
        </button>
        {loginSheet}
      </main>
    )
  }

  /* ---------- 카드 화면 ---------- */
  const done = hist.length
  const pct = (done / (done + queue.length)) * 100
  const dx = drag?.x ?? 0
  const dy = drag?.y ?? 0
  const hint =
    dy < -50 && Math.abs(dy) > Math.abs(dx) ? 'know' : Math.abs(dx) > 50 ? 'unknown' : null
  const tag = head.failed ? '다시 도전' : head.isNew && !map.current.get(head.id) ? '새 단어' : '복습'

  return (
    <main className="screen study">
      <div className="row between">
        <button className="link" onClick={exit}>
          ← 나가기
        </button>
        <span className="mute small">남은 카드 {queue.length}장</span>
      </div>
      <div className="bar mt">
        <i style={{ width: `${pct}%` }} />
      </div>
      {err && <p className="error">{err}</p>}

      <div className="card-wrap">
        <div
          className={`card ${hint ?? ''} ${drag ? 'dragging' : ''}`}
          style={{ transform: drag ? `translate(${dx}px, ${dy}px) rotate(${dx / 25}deg)` : undefined }}
          onPointerDown={(e) => {
            startPt.current = { x: e.clientX, y: e.clientY }
            setDrag({ x: 0, y: 0 })
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const s = startPt.current
            if (s) setDrag({ x: e.clientX - s.x, y: e.clientY - s.y })
          }}
          onPointerUp={(e) => {
            const s = startPt.current
            startPt.current = null
            setDrag(null)
            if (!s) return
            const mx = e.clientX - s.x
            const my = e.clientY - s.y
            if (Math.hypot(mx, my) < 10) setFlipped((f) => !f)
            else if (my < -80 && Math.abs(my) > Math.abs(mx)) askKnow()
            else if (Math.abs(mx) > 80) judge(false)
          }}
          onPointerCancel={() => {
            startPt.current = null
            setDrag(null)
          }}
        >
          <span className="chip tag">{tag}</span>
          {hint && <span className={`stamp ${hint}`}>{hint === 'know' ? '알아요' : '몰라요'}</span>}
          {!flipped ? (
            <div className="face">
              <div className="word-line">
                <span className="pos">{word.pos}</span>
                <span className="word">{word.word}</span>
              </div>
              {word.ipa && <div className="ipa">{word.ipa}</div>}
              <button
                className="speak"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  speak(word.word)
                }}
                aria-label="발음 듣기"
              >
                🔊
              </button>
              <p className="mute small hint-txt">탭해서 뜻 보기</p>
            </div>
          ) : (
            <div className="face">
              <div className="word sm">{word.word}</div>
              <div className="meaning">{meaningOf(word, profile.locale)}</div>
              <div className="example">
                <p>{word.ex}</p>
                <p className="mute">{exampleKoOf(word, profile.locale)}</p>
                <button
                  className="speak sm"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    speak(word.ex, 0.85)
                  }}
                  aria-label="예문 듣기"
                >
                  🔊
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="actions">
        <button className="btn unknown" onClick={() => judge(false)}>
          ← 몰라요
        </button>
        <button
          className="btn undo"
          onClick={undo}
          disabled={!hist.length}
          aria-label="이전 카드로 되돌리기"
          style={{ visibility: hist.length ? 'visible' : 'hidden' }}
        >
          ↶ 이전
        </button>
        <button className="btn know" onClick={askKnow}>
          알아요 ↑
        </button>
      </div>
      <p className="mute small center-text keys">위로 밀기 = 알아요 · 좌우로 밀기 = 몰라요 · Space 뒤집기 · Z 되돌리기</p>

      {confirm && (
        <div className="modal" onClick={() => setConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>정말 알고 계신가요?</h3>
            <p className="mute">뜻을 확인하지 않고 &lsquo;알아요&rsquo;로 넘기려는 중이에요.</p>
            <div className="row">
              <button
                className="btn grow"
                onClick={() => {
                  setConfirm(false)
                  setFlipped(true)
                }}
              >
                뜻 확인하기
              </button>
              <button className="btn primary grow" onClick={() => judge(true)}>
                네, 알아요
              </button>
            </div>
          </div>
        </div>
      )}
      {loginSheet}
    </main>
  )
}
