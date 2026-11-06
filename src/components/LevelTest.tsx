import { useEffect, useState } from 'react'
import { LEVEL_LABELS, supabase, type Word } from '../supabase'

const PER_LEVEL = 3

function pick<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export default function LevelTest({
  userId,
  onDone,
}: {
  userId: string
  onDone: (level: number) => void
}) {
  const [words, setWords] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [known, setKnown] = useState<Record<number, number>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('words')
      .select('id,word,meaning_ko,pos,example,level')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        const all = (data ?? []) as Word[]
        const test = [1, 2, 3, 4].flatMap((lv) => pick(all.filter((w) => w.level === lv), PER_LEVEL))
        setWords(test)
      })
  }, [])

  async function answer(knows: boolean) {
    const w = words[idx]
    const next = { ...known, [w.level]: (known[w.level] ?? 0) + (knows ? 1 : 0) }
    setKnown(next)
    if (idx + 1 < words.length) return setIdx(idx + 1)

    // 3개 중 2개 이상 아는 가장 높은 레벨, 없으면 1
    let level = 1
    for (const lv of [1, 2, 3, 4]) if ((next[lv] ?? 0) >= 2) level = lv
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, level }, { onConflict: 'user_id' })
    if (error) return setError(error.message)
    onDone(level)
  }

  if (error) return <main className="page"><p className="error">{error}</p></main>
  if (words.length === 0) return <main className="page">문제를 준비 중…</main>

  const w = words[idx]
  return (
    <main className="page center">
      <p className="sub">
        레벨 테스트 {idx + 1} / {words.length}
      </p>
      <div className="card static">
        <div className="word">{w.word}</div>
      </div>
      <div className="row">
        <button className="btn" onClick={() => answer(false)}>모르겠어요</button>
        <button className="btn primary" onClick={() => answer(true)}>알아요</button>
      </div>
      <p className="legal">결과는 {Object.values(LEVEL_LABELS).join(' / ')} 중 하나로 정해져요.</p>
    </main>
  )
}
