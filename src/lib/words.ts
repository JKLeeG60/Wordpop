import raw from '../data/words.json'
import type { WordRow } from './types'

export const WORDS = raw as WordRow[]
export const WORD_MAP = new Map(WORDS.map((w) => [w.id, w]))

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
