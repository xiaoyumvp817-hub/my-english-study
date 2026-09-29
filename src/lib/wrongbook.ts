import { normalize } from './tokenize'
import { sm2Next, isMastered as sm2Mastered, DEFAULT_EASE, DAY_MS } from './sm2'

export interface WrongEntry {
  key: string
  en: string
  zh: string
  word: string
  wordIndex: number
  addedAt: number
  repetition: number
  intervalDays: number
  easeFactor: number
  dueAt: number
  reviews: number
  lapses: number
  lastReviewAt: number
}

export type Quality = number

export function isMastered(e: WrongEntry): boolean {
  return sm2Mastered({ repetition: e.repetition, intervalDays: e.intervalDays, easeFactor: e.easeFactor })
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
    repetition: 0,
    intervalDays: 1,
    easeFactor: DEFAULT_EASE,
    dueAt: now + DAY_MS,
    reviews: 0,
    lapses: 0,
    lastReviewAt: 0,
  }
  const index = entries.findIndex((e) => e.key === key)
  if (index === -1) return [...entries, fresh]
  const next = [...entries]
  next[index] = { ...fresh, addedAt: next[index].addedAt }
  return next
}

export function reviewEntry(entry: WrongEntry, q: Quality, now: number): WrongEntry {
  const srs = sm2Next(
    { repetition: entry.repetition, intervalDays: entry.intervalDays, easeFactor: entry.easeFactor },
    q,
  )
  const mastered = sm2Mastered(srs)
  return {
    ...entry,
    repetition: srs.repetition,
    intervalDays: srs.intervalDays,
    easeFactor: srs.easeFactor,
    dueAt: mastered ? Number.MAX_SAFE_INTEGER : now + srs.intervalDays * DAY_MS,
    reviews: entry.reviews + 1,
    lapses: entry.lapses + (q < 3 ? 1 : 0),
    lastReviewAt: now,
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

const V2_KEY = 'wrongbook:v2'
const V1_KEY = 'wrongbook:v1'

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
      repetition: stage,
      intervalDays: 1,
      easeFactor: DEFAULT_EASE,
      dueAt: nextReviewAt,
      reviews: stage,
      lapses: 0,
      lastReviewAt: 0,
    }
  })
}

export function loadEntries(): WrongEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const v2 = window.localStorage.getItem(V2_KEY)
    if (v2) {
      const p: unknown = JSON.parse(v2)
      return Array.isArray(p) ? (p as WrongEntry[]) : []
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
    window.localStorage.setItem(V2_KEY, JSON.stringify(entries))
  } catch {
    // storage unavailable — non-fatal
  }
}
