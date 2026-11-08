export const DAY = 86400000

// 데모 모드에서 "하루 뒤로" 버튼으로 복습 일정을 시험해 볼 수 있게 하는 시간 오프셋
const KEY = 'wp_demo_offset_days'
export const getOffset = () => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0
  } catch {
    return 0
  }
}
export const addOffsetDays = (n: number) => {
  try {
    localStorage.setItem(KEY, String(getOffset() + n))
  } catch {
    /* ignore */
  }
}
export const resetOffset = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const now = () => Date.now() + getOffset() * DAY

export const pad = (n: number) => String(n).padStart(2, '0')
export const localDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
