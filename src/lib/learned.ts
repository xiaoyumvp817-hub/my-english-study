import { normalize } from './tokenize'
import { isMastered } from './wrongbook'
import type { WrongEntry } from './wrongbook'

const LEARNED_KEY = 'learned:v1'

/** 已学完的句子（存 normalize 后的 key）。 */
export function loadLearned(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LEARNED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export function saveLearned(learned: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEARNED_KEY, JSON.stringify(learned))
  } catch {
    // storage unavailable — non-fatal
  }
}

/** 记录一句已学完的句子，去重；返回是否真正新增（用于决定是否计数）。 */
export function commitLearned(learned: string[], en: string): { learned: string[]; added: boolean } {
  const key = normalize(en)
  if (learned.includes(key)) return { learned, added: false }
  return { learned: [...learned, key], added: true }
}

/** 记录一句已学完的句子，去重。 */
export function addLearned(learned: string[], en: string): string[] {
  return commitLearned(learned, en).learned
}

export type SentenceStatus = 'learned' | 'review' | 'new'

/**
 * 一句子的学习状态：
 * - 'review'：该句还有未掌握的错词
 * - 'learned'：已学完（或相关错词全部掌握）
 * - 'new'：从未学过，也无错词
 */
export function sentenceStatus(
  en: string,
  learned: ReadonlySet<string>,
  entries: WrongEntry[],
): SentenceStatus {
  const key = normalize(en)
  const related = entries.filter((e) => normalize(e.en) === key)
  if (related.some((e) => !isMastered(e))) return 'review'
  if (learned.has(key) || related.length > 0) return 'learned'
  return 'new'
}
