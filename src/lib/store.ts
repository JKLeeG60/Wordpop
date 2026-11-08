import { supabase } from '../supabase'
import type { LogRow, Profile, Progress, TestResult } from './types'
import { now } from './clock'

export interface Store {
  readonly demo: boolean
  getProfile(): Promise<Profile>
  saveProfile(p: Partial<Profile>): Promise<void>
  getProgress(): Promise<Progress[]>
  saveProgress(p: Progress): Promise<void>
  deleteProgress(wordId: string): Promise<void>
  logReview(l: Omit<LogRow, 'id'>): Promise<string>
  removeLog(id: string): Promise<void>
  saveLevelTest(r: TestResult): Promise<void>
  deleteAccount(): Promise<void>
  signOut(): Promise<void>
}

export const DEFAULT_PROFILE: Profile = {
  level: null,
  tested: false,
  autoAudio: true,
  confirmKnow: true,
  dailyGoal: 10,
  locale: 'ko',
}

/* ---------------- Supabase ---------------- */

type ProfileRow = {
  level: number | null
  tested: boolean
  auto_audio: boolean
  confirm_know: boolean
  daily_goal: number
  locale: string
}
const toProfile = (r: ProfileRow): Profile => ({
  level: r.level,
  tested: r.tested,
  autoAudio: r.auto_audio,
  confirmKnow: r.confirm_know ?? true,
  dailyGoal: r.daily_goal,
  locale: r.locale,
})

export function supabaseStore(userId: string): Store {
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message)
  }
  return {
    demo: false,
    async getProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('level,tested,auto_audio,confirm_know,daily_goal,locale')
        .eq('id', userId)
        .maybeSingle()
      fail(error)
      if (data) return toProfile(data as ProfileRow)
      const ins = await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id' })
      fail(ins.error)
      return { ...DEFAULT_PROFILE }
    },
    async saveProfile(p) {
      const row: Record<string, unknown> = { id: userId }
      if ('level' in p) row.level = p.level
      if ('tested' in p) row.tested = p.tested
      if ('autoAudio' in p) row.auto_audio = p.autoAudio
      if ('confirmKnow' in p) row.confirm_know = p.confirmKnow
      if ('dailyGoal' in p) row.daily_goal = p.dailyGoal
      if ('locale' in p) row.locale = p.locale
      const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
      fail(error)
    },
    async getProgress() {
      const { data, error } = await supabase
        .from('word_progress')
        .select('word_id,box,due_at,wrong_count,streak,first_seen_at,updated_at')
        .eq('user_id', userId)
      fail(error)
      return (data ?? []).map((r) => ({
        wordId: r.word_id as string,
        box: r.box as number,
        dueAt: r.due_at ? Date.parse(r.due_at as string) : null,
        wrongCount: r.wrong_count as number,
        streak: r.streak as number,
        firstSeenAt: Date.parse(r.first_seen_at as string),
        updatedAt: Date.parse(r.updated_at as string),
      }))
    },
    async saveProgress(p) {
      const { error } = await supabase.from('word_progress').upsert(
        {
          user_id: userId,
          word_id: p.wordId,
          box: p.box,
          due_at: p.dueAt == null ? null : new Date(p.dueAt).toISOString(),
          wrong_count: p.wrongCount,
          streak: p.streak,
          first_seen_at: new Date(p.firstSeenAt).toISOString(),
          updated_at: new Date(p.updatedAt).toISOString(),
        },
        { onConflict: 'user_id,word_id' },
      )
      fail(error)
    },
    async deleteProgress(wordId) {
      const { error } = await supabase
        .from('word_progress')
        .delete()
        .eq('user_id', userId)
        .eq('word_id', wordId)
      fail(error)
    },
    async logReview(l) {
      const { data, error } = await supabase
        .from('review_log')
        .insert({
          user_id: userId,
          word_id: l.wordId,
          known: l.known,
          is_new: l.isNew,
          response_ms: l.responseMs,
          reviewed_at: new Date(l.reviewedAt).toISOString(),
        })
        .select('id')
        .single()
      fail(error)
      return String((data as { id: number }).id)
    },
    async removeLog(id) {
      const { error } = await supabase.from('review_log').delete().eq('id', id).eq('user_id', userId)
      fail(error)
    },
    async saveLevelTest(r) {
      const { error } = await supabase
        .from('level_tests')
        .insert({ user_id: userId, scores: r.scores, result_level: r.resultLevel })
      fail(error)
    },
    async deleteAccount() {
      const { error } = await supabase.rpc('delete_my_account')
      fail(error)
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }
}

/* ---------------- Demo (localStorage) ---------------- */

const K = {
  profile: 'wp_demo_profile',
  progress: 'wp_demo_progress',
  log: 'wp_demo_log',
  tests: 'wp_demo_tests',
}
const read = <T,>(k: string, d: T): T => {
  try {
    const r = localStorage.getItem(k)
    return r ? (JSON.parse(r) as T) : d
  } catch {
    return d
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function demoStore(onSignOut: () => void): Store {
  return {
    demo: true,
    async getProfile() {
      return { ...DEFAULT_PROFILE, ...read<Partial<Profile>>(K.profile, {}) }
    },
    async saveProfile(p) {
      write(K.profile, { ...read<Partial<Profile>>(K.profile, {}), ...p })
    },
    async getProgress() {
      return read<Progress[]>(K.progress, [])
    },
    async saveProgress(p) {
      const all = read<Progress[]>(K.progress, []).filter((x) => x.wordId !== p.wordId)
      write(K.progress, [...all, p])
    },
    async deleteProgress(wordId) {
      write(
        K.progress,
        read<Progress[]>(K.progress, []).filter((x) => x.wordId !== wordId),
      )
    },
    async logReview(l) {
      const id = `${now()}-${Math.random().toString(36).slice(2, 7)}`
      write(K.log, [...read<LogRow[]>(K.log, []), { ...l, id }].slice(-2000))
      return id
    },
    async removeLog(id) {
      write(
        K.log,
        read<LogRow[]>(K.log, []).filter((x) => x.id !== id),
      )
    },
    async saveLevelTest(r) {
      write(K.tests, [...read<unknown[]>(K.tests, []), { ...r, at: now() }])
    },
    async deleteAccount() {
      Object.values(K).forEach((k) => localStorage.removeItem(k))
      localStorage.removeItem('wp_demo_offset_days')
      localStorage.removeItem('wp_demo_user')
      localStorage.removeItem('wp_test_draft')
    },
    async signOut() {
      localStorage.removeItem('wp_demo_user')
      onSignOut()
    },
  }
}

/* ---------------- 체험 모드 → 계정 ---------------- */

const TRIAL_LEVEL = 3 // 체험 시작 난이도(500~700점)

// 체험 시작: 레벨 테스트 없이 바로 학습하도록 기본 레벨을 정해 둔다
export function seedTrialProfile() {
  const cur = read<Partial<Profile>>(K.profile, {})
  if (cur.tested && cur.level) return
  write(K.profile, { ...cur, level: TRIAL_LEVEL, tested: true })
}

function clearTrialData() {
  try {
    Object.values(K).forEach((k) => localStorage.removeItem(k))
    ;['wp_demo_offset_days', 'wp_demo_user', 'wp_test_draft'].forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

// 로그인한 계정으로 체험 중 기록을 옮긴다. 실패하면 브라우저 데이터를 남겨 다음에 다시 시도한다.
export async function migrateTrialData(store: Store): Promise<void> {
  const progress = read<Progress[]>(K.progress, [])
  if (progress.length === 0) {
    // 실제로 학습한 기록이 없으면 옮길 것이 없다(시작용 설정만 정리)
    clearTrialData()
    return
  }
  const local = read<Partial<Profile>>(K.profile, {})
  const remote = await store.getProfile()
  // 새 계정일 때만 체험 설정(레벨 등)을 가져오고, 기존 계정 설정은 건드리지 않는다
  if (!remote.tested && local.tested && local.level) {
    await store.saveProfile({
      level: local.level,
      tested: true,
      dailyGoal: local.dailyGoal ?? remote.dailyGoal,
      autoAudio: local.autoAudio ?? remote.autoAudio,
      confirmKnow: local.confirmKnow ?? remote.confirmKnow,
    })
  }
  // 같은 단어가 계정에 이미 있으면 더 최근에 수정된 쪽만 남긴다
  const remoteMap = new Map((await store.getProgress()).map((p) => [p.wordId, p]))
  await Promise.all(
    progress
      .filter((p) => {
        const r = remoteMap.get(p.wordId)
        return !r || r.updatedAt < p.updatedAt
      })
      .map((p) => store.saveProgress(p)),
  )
  for (const t of read<TestResult[]>(K.tests, [])) await store.saveLevelTest(t)
  // 복습 기록(통계용)은 옮기다 실패해도 학습 기록은 이미 안전하므로 무시한다
  try {
    for (const l of read<LogRow[]>(K.log, [])) {
      await store.logReview({ wordId: l.wordId, known: l.known, isNew: l.isNew, responseMs: l.responseMs, reviewedAt: l.reviewedAt })
    }
  } catch {
    /* ignore */
  }
  clearTrialData()
}
