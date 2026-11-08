import type { WordRow } from './types'

import { courseOf, type CourseKey } from './courses'
import { readActiveCourse, writeActiveCourse } from './courseState'

// 단어는 언어·레벨별 파일로 나눠 두고, 필요할 때 불러온다.
// 불러온 단어는 아래 세 곳에 쌓인다: 전체(WORDS), id 찾기(WORD_MAP), 언어별(POOL).
export const WORDS: WordRow[] = []
export const WORD_MAP = new Map<string, WordRow>()
const POOL: Record<CourseKey, WordRow[]> = { en: [], ja: [], zh: [], es: [] }

// 지금 학습 중인 언어. 화면들은 이 언어의 레벨·단어를 기준으로 동작한다.
let active: CourseKey = readActiveCourse()
export const getActiveCourse = () => active
export function setActiveCourse(c: CourseKey) {
  active = c
  writeActiveCourse(c)
}

/** 레벨 번호 목록 (1부터 쉬운 순서) */
export const courseLevels = (c: CourseKey = active) => courseOf(c).levels.map((_, i) => i + 1)
export const maxLevel = (c: CourseKey = active) => courseOf(c).levels.length
export const levelName = (lv: number, c: CourseKey = active) => courseOf(c).levels[lv - 1] ?? ''
/** 지금 언어의 단어 전체(불러온 것만) */
export const courseWords = (c: CourseKey = active) => POOL[c]

type Loader = () => Promise<{ default: unknown }>
const loaders: Record<CourseKey, Record<number, Loader>> = {
  en: {
    1: () => import('../data/words/level1.json'),
    2: () => import('../data/words/level2.json'),
    3: () => import('../data/words/level3.json'),
    4: () => import('../data/words/level4.json'),
  },
  zh: {
    1: () => import('../data/words/zh/level1.json'),
    2: () => import('../data/words/zh/level2.json'),
    3: () => import('../data/words/zh/level3.json'),
    4: () => import('../data/words/zh/level4.json'),
    5: () => import('../data/words/zh/level5.json'),
    6: () => import('../data/words/zh/level6.json'),
  },
  ja: {
    1: () => import('../data/words/ja/level1.json'),
    2: () => import('../data/words/ja/level2.json'),
    3: () => import('../data/words/ja/level3.json'),
    4: () => import('../data/words/ja/level4.json'),
    5: () => import('../data/words/ja/level5.json'),
  },
  es: {
    1: () => import('../data/words/es/level1.json'),
    2: () => import('../data/words/es/level2.json'),
    3: () => import('../data/words/es/level3.json'),
    4: () => import('../data/words/es/level4.json'),
    5: () => import('../data/words/es/level5.json'),
  },
}
const loading = new Map<string, Promise<void>>()
const loaded = new Set<string>()
const key = (c: CourseKey, level: number) => `${c}${level}`

export const isLevelLoaded = (level: number, c: CourseKey = active) => loaded.has(key(c, level))

export function loadLevel(level: number, c: CourseKey = active): Promise<void> {
  const k = key(c, level)
  let p = loading.get(k)
  if (!p) {
    p = loaders[c][level]().then((m) => {
      for (const w of m.default as WordRow[]) {
        if (WORD_MAP.has(w.id)) continue
        WORD_MAP.set(w.id, w)
        WORDS.push(w)
        POOL[c].push(w)
      }
      loaded.add(k)
    })
    // 실패하면 다음에 다시 시도할 수 있게 캐시에서 뺀다
    p.catch(() => loading.delete(k))
    loading.set(k, p)
  }
  return p
}

export const loadLevels = (levels: number[], c: CourseKey = active) =>
  Promise.all(levels.map((l) => loadLevel(l, c))).then(() => undefined)

export const wordsOfLevel = (level: number, c: CourseKey = active) => POOL[c].filter((w) => w.level === level)

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
