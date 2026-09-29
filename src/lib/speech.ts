/** Speaks the given English text using the browser's speech synthesis. */
export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'

  const voices = window.speechSynthesis.getVoices()
  const english = voices.find((v) => /^en[-_]/i.test(v.lang))
  if (english) utterance.voice = english

  window.speechSynthesis.speak(utterance)
}
