// 학습할 수 있는 언어(시험) 목록. ready=true인 것만 실제로 쓸 수 있다.
export type CourseKey = 'en' | 'ja' | 'zh' | 'es'

export type Course = {
  key: CourseKey
  glyph: string // 상자에 큼직하게 보이는 글자
  name: string
  exam: string
  ready: boolean
}

export const COURSES: Course[] = [
  { key: 'en', glyph: 'A', name: '영어', exam: 'TOEIC · TOEFL', ready: true },
  { key: 'ja', glyph: 'あ', name: '일본어', exam: 'JLPT', ready: false },
  { key: 'zh', glyph: '字', name: '중국어', exam: 'HSK', ready: false },
  { key: 'es', glyph: 'Ñ', name: '스페인어', exam: 'DELE', ready: false },
]
