import { useCallback, useEffect, useRef, useState } from 'react'
import { LEVEL_LABELS, supabase, type Word } from '../supabase'
import { speak } from '../speech'

type Prog = { box: number; known_count: number; unknown_count: number; next_review: string }

const INTERVAL_DAYS = [1, 2, 4, 7, 14, 30]
const NEW_PER_BATCH = 10
const SWIPE = 70

export default function Study({
  userId,
  level,
  initialTotal,
  onRetest,
}: {
  userId: string
  level: number
  initialTotal: number
  onRetest: () => void
}) {
  const [queue, setQueue] = useState<Word[]>([])
  const [loaded, setLoaded] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [total, setTotal] = useState(initialTotal)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [fly, setFly] = useState<'up' | 'side' | null>(null)

  const words = useRef<Word[]>([])
  const prog = useRef<Map<number, Prog>>(new Map())
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  const buildQueue = useCallback(() => {
    const now = Date.now()
    const inQueue = new Set<number>()
    const due = words.current
      .filter((w) => {
        const p = prog.current.get(w.id)
        return p && new Date(p.next_review).getTime() <= now
      })
      .sort(
        (a, b) =>
          new Date(prog.current.get(a.id)!.next_review).getTime() -
          new Date(prog.current.get(b.id)!.next_review).getTime(),
      )
    due.forEach((w) => inQueue.add(w.id))
    const fresh = words.current
      .filter((w) => !prog.current.has(w.id))
      .slice(0, NEW_PER_BATCH)
    setQueue([...due, ...fresh])
    setFlipped(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      const [w, p] = await Promise.all([
        supabase.from('words').select('id,word,meaning_ko,pos,example,level').eq('level', level),
        supabase
          .from('progress')
          .select('word_id,box,known_count,unknown_count,next_review')
          .eq('user_id', userId),
      ])
      if (w.error) return setError(w.error.message)
      if (p.error) return setError(p.error.message)
      words.current = ((w.data ?? []) as Word[]).sort(() => Math.random() - 0.5)
      for (const r of p.data ?? []) prog.current.set(r.word_id, r)
      buildQueue()
      setLoaded(true)
    })()
  }, [level, userId, buildQueue])

  async function answer(known: boolean) {
    const w = queue[0]
    if (!w) return
    const prev = prog.current.get(w.id) ?? {
      box: 0,
      known_count: 0,
      unknown_count: 0,
      next_review: new Date().toISOString(),
    }
    let next: Prog
    if (known) {
      const box = Math.min(prev.box + 1, INTERVAL_DAYS.length)
      next = {
        box,
        known_count: prev.known_count + 1,
        unknown_count: prev.unknown_count,
        next_review: new Date(Date.now() + INTERVAL_DAYS[box - 1] * 86400000).toISOString(),
      }
    } else {
      next = {
        box: 0,
        known_count: prev.known_count,
        unknown_count: prev.unknown_count + 1,
        next_review: new Date(Date.now() + 10 * 60000).toISOString(),
      }
    }
    prog.current.set(w.id, next)

    const nt = total + 1
    setTotal(nt)
    setQueue((q) => {
      const rest = q.slice(1)
      if (known) return rest
      // 모르는 단어: 5~10장 뒤에 다시 등장
      const gap = 5 + Math.floor(Math.random() * 6)
      const at = Math.min(gap, rest.length)
      return [...rest.slice(0, at), w, ...rest.slice(at)]
    })
    setFlipped(false)

    const [a, b] = await Promise.all([
      supabase.from('progress').upsert({ user_id: userId, word_id: w.id, ...next }),
      supabase.from('profiles').update({ total_studied: nt }).eq('user_id', userId),
    ])
    if (a.error || b.error) setError((a.error ?? b.error)!.message)
  }

  function swipeThen(known: boolean, kind: 'up' | 'side') {
    setFly(kind)
    setTimeout(() => {
      setFly(null)
      setDrag({ x: 0, y: 0 })
      answer(known)
    }, 180)
  }

  function onDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY }
    moved.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved.current = true
    setDrag({ x: dx, y: dy })
  }
  function onUp() {
    if (!start.current) return
    const { x, y } = drag
    start.current = null
    if (!moved.current) {
      setDrag({ x: 0, y: 0 })
      return setFlipped((f) => !f)
    }
    if (y < -SWIPE && Math.abs(y) > Math.abs(x)) return swipeThen(true, 'up')
    if (Math.abs(x) > SWIPE) return swipeThen(false, 'side')
    setDrag({ x: 0, y: 0 })
  }

  const w = queue[0]
  const style: React.CSSProperties = fly
    ? {
        transform:
          fly === 'up'
            ? 'translateY(-120%)'
            : `translateX(${drag.x > 0 ? 120 : -120}%)`,
        opacity: 0,
        transition: 'all .18s',
      }
    : {
        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 25}deg)`,
        transition: start.current ? 'none' : 'transform .2s',
      }

  if (error) return <main className="page"><p className="error">{error}</p></main>
  if (!loaded) return <main className="page">불러오는 중…</main>

  return (
    <main className="page center">
      <header className="top">
        <span>레벨 {LEVEL_LABELS[level]}</span>
        <span className="count">누적 {total}장</span>
      </header>

      {w ? (
        <>
          <div
            className="card"
            style={style}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {!flipped ? (
              <>
                <div className="word">{w.word}</div>
                <button
                  className="speak"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    speak(w.word)
                  }}
                  aria-label="발음 듣기"
                >
                  🔊
                </button>
                <p className="hint">탭하면 뜻이 보여요</p>
              </>
            ) : (
              <>
                <div className="meaning">{w.meaning_ko}</div>
                {w.pos && <div className="pos">{w.pos}</div>}
                {w.example && <div className="example">{w.example}</div>}
              </>
            )}
          </div>
          <p className="hint">↑ 위로 밀면 아는 단어 · ← → 옆으로 밀면 모르는 단어</p>
          <div className="row">
            <button className="btn" onClick={() => swipeThen(false, 'side')}>모르겠어요</button>
            <button className="btn primary" onClick={() => swipeThen(true, 'up')}>알아요</button>
          </div>
        </>
      ) : (
        <div className="done">
          <p>지금 볼 카드를 모두 끝냈어요 🎉</p>
          <button className="btn primary" onClick={() => buildQueue()}>새 단어 더 보기</button>
        </div>
      )}

      <footer className="foot">
        <button className="link" onClick={onRetest}>레벨 다시 테스트</button>
        <a href="#/account">계정</a>
      </footer>
    </main>
  )
}
