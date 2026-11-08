import type { Progress, WordRow } from './types'
import { DAY, localDate, startOfDay } from './clock'
import { rand, shuffle } from './words'

// 박스 번호 → 다음 복습까지 일수 (0은 학습 중)
export const INTERVALS = [0, 1, 3, 7, 14, 30]
export const GRADUATED = 6
export const REVIEW_CAP = 50 // 하루 복습 상한
export const SESSION_MAX = 30

export const isDue = (p: Progress, t: number) =>
  p.box < GRADUATED && p.dueAt != null && p.dueAt <= t

export type Judgement = {
  next: Progress
  requeueGap: number | null // 모르겠어요일 때 몇 장 뒤에 다시 보여줄지
  failed: boolean
  wrongRun: number
}

/** 한 번의 판단을 라이트너 박스 규칙에 따라 반영 (기획안 6장) */
export function applyJudgement(a: {
  wordId: string
  prev?: Progress
  known: boolean
  failedBefore: boolean // 이 세션에서 이미 틀린 카드인지
  wrongRun: number // 이 세션에서 연속으로 틀린 횟수
  now: number
}): Judgement {
  const isFirst = !a.prev
  const base: Progress =
    a.prev ?? {
      wordId: a.wordId,
      box: 0,
      dueAt: a.now,
      wrongCount: 0,
      streak: 0,
      firstSeenAt: a.now,
      updatedAt: a.now,
    }

  if (a.known) {
    let box: number
    let dueAt: number | null
    if (a.failedBefore) {
      // 이 세션에서 한 번 틀렸다가 맞힘 → 박스 1 (1일 뒤)
      box = 1
      dueAt = a.now + INTERVALS[1] * DAY
    } else if (isFirst) {
      // 처음 보자마자 "알아요" → 박스 3 (7일 뒤)
      box = 3
      dueAt = a.now + INTERVALS[3] * DAY
    } else if (base.box === 0) {
      // 학습 중이던 카드를 맞힘 → 박스 1
      box = 1
      dueAt = a.now + INTERVALS[1] * DAY
    } else {
      const nb = base.box + 1
      if (nb >= GRADUATED) {
        box = GRADUATED
        dueAt = null
      } else {
        box = nb
        dueAt = a.now + INTERVALS[nb] * DAY
      }
    }
    return {
      next: { ...base, box, dueAt, streak: base.streak + 1, updatedAt: a.now },
      requeueGap: null,
      failed: a.failedBefore,
      wrongRun: 0,
    }
  }

  const wrongRun = a.wrongRun + 1
  const box = isFirst || base.box === 0 ? 0 : 1
  return {
    next: {
      ...base,
      box,
      dueAt: a.now,
      wrongCount: base.wrongCount + 1,
      streak: 0,
      updatedAt: a.now,
    },
    requeueGap: wrongRun >= 2 ? rand(3, 5) : rand(5, 10),
    failed: true,
    wrongRun,
  }
}

export type Item = { id: string; isNew: boolean; failed: boolean; wrongRun: number }

/** 빈도 순위가 높은(숫자가 작은) 단어에 더 큰 확률을 주는 가중 무작위 추출 */
export function pickWeighted(words: WordRow[], n: number): WordRow[] {
  const pool = words.slice()
  const out: WordRow[] = []
  while (out.length < n && pool.length) {
    const weights = pool.map((w) => 1 / (1 + w.rank / 15))
    let r = Math.random() * weights.reduce((s, x) => s + x, 0)
    let idx = 0
    for (; idx < pool.length; idx++) {
      r -= weights[idx]
      if (r <= 0) break
    }
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0])
  }
  return out
}

export function reviewedToday(progress: Map<string, Progress>, t: number) {
  const s = startOfDay(t)
  let n = 0
  progress.forEach((p) => {
    if (p.updatedAt >= s && p.firstSeenAt < s) n++
  })
  return n
}

export function newToday(progress: Map<string, Progress>, t: number) {
  const s = startOfDay(t)
  let n = 0
  progress.forEach((p) => {
    if (p.firstSeenAt >= s) n++
  })
  return n
}

export function dueList(progress: Map<string, Progress>, t: number) {
  return [...progress.values()]
    .filter((p) => isDue(p, t))
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)) // 오래 밀린 것부터
}

export function freshWords(level: number, words: WordRow[], progress: Map<string, Progress>) {
  return words.filter((w) => w.level === level && !progress.has(w.id))
}

/** 세션 = 복습 카드 + 새 단어를 섞어서 최대 30장 */
export function buildSession(a: {
  level: number
  words: WordRow[]
  progress: Map<string, Progress>
  now: number
  newCount: number
  reviewBudget: number
}): Item[] {
  const due = dueList(a.progress, a.now)
    .slice(0, Math.max(0, a.reviewBudget))
    .map<Item>((p) => ({ id: p.wordId, isNew: false, failed: false, wrongRun: 0 }))
  const fresh = pickWeighted(freshWords(a.level, a.words, a.progress), a.newCount).map<Item>(
    (w) => ({ id: w.id, isNew: true, failed: false, wrongRun: 0 }),
  )
  const dueCut = due.slice(0, Math.max(0, SESSION_MAX - fresh.length))
  const total = [...shuffle(dueCut)]
  // 새 단어를 복습 사이사이에 고르게 끼워 넣기
  const step = fresh.length ? (total.length + fresh.length) / fresh.length : 0
  fresh.forEach((f, i) => total.splice(Math.min(total.length, Math.round(i * step)), 0, f))
  return total.slice(0, SESSION_MAX)
}

/** 최근 7일 누적 학습 카드 수 */
export function cumulativeSeries(progress: Map<string, Progress>, t: number, days = 7) {
  const out: { label: string; value: number }[] = []
  const list = [...progress.values()]
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(t - i * DAY)
    const end = dayStart + DAY
    const d = new Date(dayStart)
    out.push({
      label: `${d.getMonth() + 1}. ${d.getDate()}.`,
      value: list.filter((p) => p.firstSeenAt < end).length,
    })
  }
  return out
}

/** 연속 학습 일수: 하루 새 단어 목표를 채운 날이 이어진 수. 7일에 한 번은 쉬어도 이어짐(프리즈) */
export function streakDays(progress: Map<string, Progress>, goal: number, t: number) {
  const counts = new Map<string, number>()
  progress.forEach((p) => {
    const k = localDate(p.firstSeenAt)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  })
  const met = (daysAgo: number) =>
    (counts.get(localDate(startOfDay(t - daysAgo * DAY))) ?? 0) >= goal
  let streak = 0
  let lastFreeze = -99
  let i = met(0) ? 0 : 1 // 오늘 아직 안 채웠으면 어제부터 센다
  for (; i < 400; i++) {
    if (met(i)) {
      streak++
    } else if (i - lastFreeze >= 7 && streak > 0) {
      lastFreeze = i // 주 1회 면제
    } else {
      break
    }
  }
  return streak
}
