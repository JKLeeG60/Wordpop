// 학습할 수 있는 언어(시험) 목록. ready=true인 것만 실제로 쓸 수 있다.
export type CourseKey = 'en' | 'ja' | 'zh' | 'es'

export type Course = {
  key: CourseKey
  glyph: string // 상자에 큼직하게 보이는 글자
  name: string
  exam: string
  ready: boolean
  levels: string[] // 레벨 이름(쉬운 것부터). 1번째가 레벨 1
  speech: string // 발음 재생에 쓰는 언어 코드
  perLevel: number // 레벨 테스트에서 레벨마다 내는 문제 수
  pass: number // 그 레벨을 '아는 것'으로 보는 정답 수
  note: string // 레벨 테스트 결과 아래 안내 문구
}

export const COURSES: Course[] = [
  {
    key: 'en',
    glyph: 'A',
    name: '영어',
    exam: 'TOEIC · TOEFL',
    ready: true,
    levels: ['100~300', '300~500', '500~700', '700~990'],
    speech: 'en-US',
    perLevel: 6,
    pass: 5,
    note: '* 점수대 구분은 실제 토익 점수가 아니라 단어 난이도를 추정한 값이에요.',
  },
  {
    key: 'ja',
    glyph: 'あ',
    name: '일본어',
    exam: 'JLPT',
    ready: true,
    levels: ['N5', 'N4', 'N3', 'N2', 'N1'],
    speech: 'ja-JP',
    perLevel: 4,
    pass: 3,
    note: '* 실제 JLPT 합격 여부가 아니라 단어 난이도로 추정한 값이에요.',
  },
  {
    key: 'zh',
    glyph: '字',
    name: '중국어',
    exam: 'HSK',
    ready: true,
    levels: ['HSK 1급', 'HSK 2급', 'HSK 3급', 'HSK 4급', 'HSK 5급', 'HSK 6급'],
    speech: 'zh-CN',
    perLevel: 4,
    pass: 3,
    note: '* 실제 HSK 급수가 아니라 단어 난이도로 추정한 값이에요.',
  },
  {
    key: 'es',
    glyph: 'Ñ',
    name: '스페인어',
    exam: 'DELE',
    ready: true,
    levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
    speech: 'es-ES',
    perLevel: 4,
    pass: 3,
    note: '* 실제 DELE 등급이 아니라 단어 난이도로 추정한 값이에요.',
  },
]

export const courseOf = (k: CourseKey) => COURSES.find((c) => c.key === k) ?? COURSES[0]

// 단어 ID로 어느 언어 단어인지 알아낸다 (영어는 접두어가 없다)
export function courseOfId(id: string): CourseKey {
  const p = id.slice(0, 3)
  return p === 'zh:' || p === 'ja:' || p === 'es:' ? (id.slice(0, 2) as CourseKey) : 'en'
}
