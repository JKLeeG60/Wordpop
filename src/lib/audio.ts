// 발음 재생 (영어는 미국식) (브라우저 내장 음성 합성).
// 나중에 사전 녹음 mp3나 클라우드 TTS로 바꿀 수 있게 재생 로직은 이 파일에만 둔다.

const PREFERRED = [
  'Samantha',
  'Ava',
  'Allison',
  'Nicky',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Alex',
]

let cached: SpeechSynthesisVoice | null = null
let lang = 'en-US' // 지금 읽어 줄 언어 (학습 언어를 바꾸면 setSpeechLang으로 바꾼다)

export const audioSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice(): SpeechSynthesisVoice | null {
  if (!audioSupported()) return null
  const list = window.speechSynthesis.getVoices()
  if (!list.length) return null
  if (lang !== 'en-US') {
    // 영어 외 언어: 같은 지역 음성을 먼저, 없으면 같은 언어의 아무 음성
    const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
    return list.find((v) => norm(v) === lang.toLowerCase()) ?? list.find((v) => norm(v).startsWith(lang.slice(0, 2))) ?? null
  }
  const us = list.filter((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us')
  for (const name of PREFERRED) {
    const v = us.find((x) => x.name.includes(name))
    if (v) return v
  }
  return us[0] ?? list.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null
}

export function initAudio() {
  if (!audioSupported()) return
  const load = () => {
    cached = pickVoice()
  }
  load()
  window.speechSynthesis.addEventListener?.('voiceschanged', load)
}

export function setSpeechLang(next: string) {
  lang = next
  cached = pickVoice()
}

let timer: number | undefined

export function speak(text: string, rate = 0.9) {
  if (!audioSupported()) return false
  window.clearTimeout(timer)
  const synth = window.speechSynthesis
  synth.cancel()
  // cancel 직후 바로 speak 하면 일부 브라우저(iOS)에서 무시되고, 음성 엔진 준비 중엔 앞소리가 잘려 0.5초 기다린다.
  timer = window.setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    const v = cached ?? pickVoice()
    if (v) u.voice = v
    synth.speak(u)
  }, 500)
  return true
}

export function stopSpeaking() {
  if (!audioSupported()) return
  window.clearTimeout(timer)
  window.speechSynthesis.cancel()
}
