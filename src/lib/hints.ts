import { isCorrect } from './tokenize'

/** Hint tiers: 1 = first letter, 2 = audio/TTS, 3 = reveal full word. */
export type HintLevel = 1 | 2 | 3

export interface HintState {
  wordIndex: number
  level: HintLevel
}

export interface HintAction {
  wordIndex: number
  level: HintLevel
}

/**
 * Index of the first word whose answer does not yet match the target
 * (empty or partial answers count as unresolved), or -1 if all match.
 */
export function firstUnresolved(words: string[], answers: string[]): number {
  for (let i = 0; i < words.length; i++) {
    if (!isCorrect(answers[i] ?? '', words[i])) return i
  }
  return -1
}

/**
 * The next hint action for a click, or null if there is nothing left to
 * hint. If the previous hint is still in progress (its word unresolved and
 * not yet revealed), keep escalating it; otherwise start fresh on the first
 * unresolved word.
 */
export function nextHint(
  words: string[],
  answers: string[],
  hint: HintState | null,
): HintAction | null {
  if (hint && hint.level < 3 && !isCorrect(answers[hint.wordIndex] ?? '', words[hint.wordIndex])) {
    return { wordIndex: hint.wordIndex, level: (hint.level + 1) as HintLevel }
  }
  const target = firstUnresolved(words, answers)
  if (target === -1) return null
  return { wordIndex: target, level: 1 }
}
