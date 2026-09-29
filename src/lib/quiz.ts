import { tokenize, wordTokens, normalize } from './tokenize'

export type QuizType = 'choice' | 'flashcard' | 'dictation' | 'fillblank'

export const XP_BY_TYPE: Record<QuizType, number> = {
  flashcard: 8,
  choice: 10,
  dictation: 12,
  fillblank: 15,
}
export const XP_WRONG_FLOOR = 5

export function xpForAnswer(type: QuizType, q: number): number {
  return q < 3 ? XP_WRONG_FLOOR : XP_BY_TYPE[type]
}

const FALLBACK = ['often', 'always', 'again', 'together', 'quickly', 'between', 'without', 'across']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 返回 count 个选项（含唯一正确的 target），干扰项来自句子其它词，不足用 fallback 补齐。 */
export function makeChoices(target: string, sentence: string, count = 4): string[] {
  const seen = new Set<string>([normalize(target)])
  const distractors: string[] = []
  for (const w of wordTokens(tokenize(sentence))) {
    const n = normalize(w.text)
    if (!seen.has(n)) {
      seen.add(n)
      distractors.push(w.text)
    }
  }
  const pool = shuffle(distractors)
  let i = 0
  while (pool.length < count - 1) {
    const f = FALLBACK[i++ % FALLBACK.length]
    const n = normalize(f)
    if (!seen.has(n)) {
      seen.add(n)
      pool.push(f)
    }
  }
  return shuffle([target, ...pool.slice(0, count - 1)])
}

/** Phase 1 仅随机出 choice / flashcard（翻卡 60%）。 */
export function pickType(rng: () => number = Math.random): QuizType {
  return rng() < 0.6 ? 'flashcard' : 'choice'
}

/** 把句子里的目标词（首次出现，忽略大小写）替换为下划线空白。 */
export function blankSentence(sentence: string, word: string): string {
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (idx === -1) return sentence
  return sentence.slice(0, idx) + '______' + sentence.slice(idx + word.length)
}
