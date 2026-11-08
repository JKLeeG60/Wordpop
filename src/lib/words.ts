import type { WordRow } from './types'

// 단어는 레벨별 파일로 나눠 두고, 필요할 때 불러온다. 불러온 단어는 아래 두 곳에 쌓인다.
export const WORDS: WordRow[] = []
export const WORD_MAP = new Map<string, WordRow>()

export const ALL_LEVELS = [1, 2, 3, 4]

const loaders: Record<number, () => Promise<{ default: unknown }>> = {
  1: () => import('../data/words/level1.json'),
  2: () => import('../data/words/level2.json'),
  3: () => import('../data/words/level3.json'),
  4: () => import('../data/words/level4.json'),
}
const loading = new Map<number, Promise<void>>()
const loaded = new Set<number>()

export const isLevelLoaded = (level: number) => loaded.has(level)

export function loadLevel(level: number): Promise<void> {
  let p = loading.get(level)
  if (!p) {
    p = loaders[level]().then((m) => {
      for (const w of m.default as WordRow[]) {
        if (WORD_MAP.has(w.id)) continue
        WORD_MAP.set(w.id, w)
        WORDS.push(w)
      }
      loaded.add(level)
    })
    // 실패하면 다음에 다시 시도할 수 있게 캐시에서 뺀다
    p.catch(() => loading.delete(level))
    loading.set(level, p)
  }
  return p
}

export const loadLevels = (levels: number[]) => Promise.all(levels.map(loadLevel)).then(() => undefined)

export const LEVEL_NAMES: Record<number, string> = {
  1: '100~300',
  2: '300~500',
  3: '500~700',
  4: '700~990',
}

export const wordsOfLevel = (level: number) => WORDS.filter((w) => w.level === level)

export function meaningOf(w: WordRow, locale = 'ko') {
  return (w.tr[locale] ?? w.tr.ko).meaning
}
export function exampleKoOf(w: WordRow, locale = 'ko') {
  return (w.tr[locale] ?? w.tr.ko).ex
}
export const mainPos = (w: WordRow) => w.pos.split('/')[0]

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}
export const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
