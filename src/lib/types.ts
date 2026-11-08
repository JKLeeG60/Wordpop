export type WordRow = {
  id: string
  word: string
  pos: string
  level: number // 1부터 (언어마다 레벨 수가 다르다)
  rank: number // 레벨 내 빈도 순위(작을수록 자주 나옴)
  ipa?: string // 읽는 법: 영어·스페인어는 발음기호, 중국어는 병음, 일본어는 히라가나
  ex: string
  tr: Record<string, { meaning: string; ex: string }>
}

export type Profile = {
  level: number | null
  tested: boolean
  autoAudio: boolean
  confirmKnow: boolean // 뒤집기 전 '알아요' 확인 팝업
  dailyGoal: number
  locale: string
}

export type Progress = {
  wordId: string
  box: number // 0 학습 중, 1~5 복습 단계, 6 졸업
  dueAt: number | null
  wrongCount: number
  streak: number
  firstSeenAt: number
  updatedAt: number
}

export type LogRow = {
  id: string
  wordId: string
  known: boolean
  isNew: boolean
  responseMs: number | null
  reviewedAt: number
}

export type TestResult = {
  scores: Record<number, number>
  resultLevel: number
}
