import { normalize } from './tokenize'
import { fsrsNext, newFsrsState, MASTERED_STABILITY_DAYS, DAY_MS, DEFAULT_DIFFICULTY } from './fsrs'
import type { FsrsState } from './fsrs'

export interface WrongEntry extends FsrsState {
  key: string
  en: string
  zh: string
  word: string
  wordIndex: number
  addedAt: number
}

export type Quality = number

export function isMastered(e: WrongEntry): boolean {
  return e.stability >= MASTERED_STABILITY_DAYS
}

export function statusOf(e: WrongEntry): 'new' | 'learning' | 'mastered' {
  if (isMastered(e)) return 'mastered'
  return e.reviews === 0 ? 'new' : 'learning'
}

export function isDue(e: WrongEntry, now: number): boolean {
  return !isMastered(e) && e.dueAt <= now
}

export function dueEntries(entries: WrongEntry[], now: number): WrongEntry[] {
  return entries.filter((e) => isDue(e, now))
}

function keyFor(en: string, wordIndex: number): string {
  return `${normalize(en)}|${wordIndex}`
}

export function recordWrong(
  entries: WrongEntry[],
  input: { en: string; zh: string; word: string; wordIndex: number },
  now: number,
): WrongEntry[] {
  const key = keyFor(input.en, input.wordIndex)
  const fresh: WrongEntry = {
    key,
    en: input.en,
    zh: input.zh,
    word: input.word,
    wordIndex: input.wordIndex,
    addedAt: now,
    ...newFsrsState(now + DAY_MS),
  }
  const index = entries.findIndex((e) => e.key === key)
  if (index === -1) return [...entries, fresh]
  const next = [...entries]
  next[index] = { ...fresh, addedAt: next[index].addedAt }
  return next
}

export function reviewEntry(entry: WrongEntry, q: Quality, now: number): WrongEntry {
  const next = fsrsNext(entry, q, now)
  const mastered = next.stability >= MASTERED_STABILITY_DAYS
  return {
    ...entry,
    stability: next.stability,
    difficulty: next.difficulty,
    state: next.state,
    reviews: next.reviews,
    lapses: next.lapses,
    dueAt: mastered ? Number.MAX_SAFE_INTEGER : next.dueAt,
    lastReviewAt: next.lastReviewAt,
  }
}

export interface SentenceGroup {
  en: string
  zh: string
  entries: WrongEntry[]
}

export function groupBySentence(entries: WrongEntry[]): SentenceGroup[] {
  const map = new Map<string, SentenceGroup>()
  for (const e of entries) {
    const g = map.get(e.en)
    if (g) g.entries.push(e)
    else map.set(e.en, { en: e.en, zh: e.zh, entries: [e] })
  }
  return [...map.values()]
}

/** 旧 SM-2 的 easeFactor（约 1.3..3.5，默认 2.5）映射到 FSRS 难度 1..10（默认 5）。 */
function difficultyFromEase(easeFactor: number): number {
  const d = 5 - (easeFactor - 2.5) * 4
  return Math.min(10, Math.max(1, Math.round(d)))
}

/** v2（SM-2 字段）→ 当前（FSRS 字段）迁移。stability 用旧间隔天估，后续复习自行校准。 */
export function migrateV2(old: unknown[]): WrongEntry[] {
  return old.map((raw) => {
    const o = raw as Record<string, unknown>
    const reviews = Number(o.reviews ?? 0)
    const easeFactor = typeof o.easeFactor === 'number' ? o.easeFactor : 2.5
    const intervalDays = typeof o.intervalDays === 'number' ? o.intervalDays : 1
    return {
      key: String(o.key ?? ''),
      en: String(o.en ?? ''),
      zh: String(o.zh ?? ''),
      word: String(o.word ?? ''),
      wordIndex: Number(o.wordIndex ?? 0),
      addedAt: Number(o.addedAt ?? 0),
      stability: Math.max(1, intervalDays),
      difficulty: difficultyFromEase(easeFactor),
      state: reviews === 0 ? 0 : 2,
      dueAt: Number(o.dueAt ?? 0),
      reviews,
      lapses: Number(o.lapses ?? 0),
      lastReviewAt: Number(o.lastReviewAt ?? 0),
    }
  })
}

/** v1（stage/nextReviewAt）→ 当前迁移。stage 即旧复习次数。 */
export function migrateV1(old: unknown[]): WrongEntry[] {
  return old.map((raw) => {
    const o = raw as Record<string, unknown>
    const stage = typeof o.stage === 'number' ? o.stage : 0
    const nextReviewAt = typeof o.nextReviewAt === 'number' ? o.nextReviewAt : 0
    return {
      key: String(o.key ?? ''),
      en: String(o.en ?? ''),
      zh: String(o.zh ?? ''),
      word: String(o.word ?? ''),
      wordIndex: Number(o.wordIndex ?? 0),
      addedAt: Number(o.addedAt ?? 0),
      stability: stage >= 4 ? MASTERED_STABILITY_DAYS : 1,
      difficulty: DEFAULT_DIFFICULTY,
      state: stage === 0 ? 0 : 2,
      dueAt: nextReviewAt,
      reviews: stage,
      lapses: 0,
      lastReviewAt: 0,
    }
  })
}

const V3_KEY = 'wrongbook:v3'
const V2_KEY = 'wrongbook:v2'
const V1_KEY = 'wrongbook:v1'

export function loadEntries(): WrongEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const v3 = window.localStorage.getItem(V3_KEY)
    if (v3) {
      const p: unknown = JSON.parse(v3)
      return Array.isArray(p) ? (p as WrongEntry[]) : []
    }
    const v2 = window.localStorage.getItem(V2_KEY)
    if (v2) {
      const p: unknown = JSON.parse(v2)
      return Array.isArray(p) ? migrateV2(p) : []
    }
    const v1 = window.localStorage.getItem(V1_KEY)
    if (v1) {
      const p: unknown = JSON.parse(v1)
      return Array.isArray(p) ? migrateV1(p) : []
    }
    return []
  } catch {
    return []
  }
}

export function saveEntries(entries: WrongEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(V3_KEY, JSON.stringify(entries))
  } catch {
    // storage unavailable — non-fatal
  }
}
