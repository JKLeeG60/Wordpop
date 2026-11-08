import type { CourseKey } from './courses'

// 지금 학습 중인 언어와, 영어 이외 언어의 레벨은 이 기기에만 저장한다.
// (영어 레벨은 기존처럼 계정에 저장)
const K_ACTIVE = 'wp_course'
const K_LEVELS = 'wp_course_levels' // 사용자별로 따로 저장: wp_course_levels:<사용자 id>

const KEYS: CourseKey[] = ['en', 'ja', 'zh', 'es']

export function readActiveCourse(): CourseKey {
  try {
    const v = localStorage.getItem(K_ACTIVE) as CourseKey | null
    return v && KEYS.includes(v) ? v : 'en'
  } catch {
    return 'en'
  }
}
export function writeActiveCourse(c: CourseKey) {
  try {
    localStorage.setItem(K_ACTIVE, c)
  } catch {
    /* ignore */
  }
}

export type CourseLevels = Partial<Record<CourseKey, number>>
export function readCourseLevels(uid: string): CourseLevels {
  try {
    const raw = localStorage.getItem(`${K_LEVELS}:${uid}`)
    return raw ? (JSON.parse(raw) as CourseLevels) : {}
  } catch {
    return {}
  }
}
export function writeCourseLevel(uid: string, c: CourseKey, level: number): CourseLevels {
  const next = { ...readCourseLevels(uid), [c]: level }
  try {
    localStorage.setItem(`${K_LEVELS}:${uid}`, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
