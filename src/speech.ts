// 미국식 발음 읽어주기 (브라우저 내장 음성 합성)
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.9
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'en-US')
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
