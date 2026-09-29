import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  recordWrong, reviewEntry, dueEntries, isMastered, statusOf, migrateV1, groupBySentence, loadEntries,
} from './wrongbook'
import type { WrongEntry } from './wrongbook'
import { DEFAULT_EASE, DAY_MS } from './sm2'

afterEach(() => { vi.unstubAllGlobals() })

const NOW = Date.UTC(2026, 0, 1)
const input = { en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0 }

function entry(overrides: Partial<WrongEntry> = {}): WrongEntry {
  return {
    key: 'throw away|0',
    en: 'throw away',
    zh: '扔掉',
    word: 'throw',
    wordIndex: 0,
    addedAt: NOW,
    repetition: 0,
    intervalDays: 1,
    easeFactor: DEFAULT_EASE,
    dueAt: NOW + DAY_MS,
    reviews: 0,
    lapses: 0,
    lastReviewAt: 0,
    ...overrides,
  }
}

describe('recordWrong', () => {
  it('adds a new word with v2 defaults, due in 1 day', () => {
    const r = recordWrong([], input, NOW)
    expect(r).toHaveLength(1)
    expect(r[0].repetition).toBe(0)
    expect(r[0].dueAt).toBe(NOW + DAY_MS)
    expect(statusOf(r[0])).toBe('new')
  })

  it('dedupes on normalized text and preserves first-seen time', () => {
    const first = recordWrong([], input, NOW)
    const second = recordWrong(first, { ...input, en: '  Throw   Away ' }, NOW)
    expect(second).toHaveLength(1)
    expect(second[0].addedAt).toBe(NOW)
  })
})

describe('reviewEntry', () => {
  it('advances SM-2 state and records a review', () => {
    const r = reviewEntry(entry(), 4, NOW)
    expect(r.repetition).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.reviews).toBe(1)
    expect(r.dueAt).toBe(NOW + DAY_MS)
  })

  it('a lapse increments lapses and resets the interval', () => {
    const r = reviewEntry(entry({ repetition: 3, intervalDays: 10, reviews: 3 }), 2, NOW)
    expect(r.lapses).toBe(1)
    expect(r.repetition).toBe(0)
    expect(r.dueAt).toBe(NOW + DAY_MS)
  })

  it('marks mastered once the threshold is reached', () => {
    const r = reviewEntry(entry({ repetition: 3, intervalDays: 10 }), 5, NOW)
    expect(isMastered(r)).toBe(true)
    expect(r.dueAt).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('statusOf', () => {
  it('derives new / learning / mastered', () => {
    expect(statusOf(entry())).toBe('new')
    expect(statusOf(entry({ reviews: 1 }))).toBe('learning')
    expect(statusOf(entry({ repetition: 4, intervalDays: 21 }))).toBe('mastered')
  })
})

describe('isDue / dueEntries', () => {
  it('returns only unmastered, due entries', () => {
    const due = entry({ key: 'a|0', dueAt: NOW - 1 })
    const later = entry({ key: 'b|0', dueAt: NOW + DAY_MS })
    const mastered = entry({ key: 'c|0', repetition: 4, intervalDays: 21, dueAt: Number.MAX_SAFE_INTEGER })
    expect(dueEntries([due, later, mastered], NOW).map((e) => e.key)).toEqual(['a|0'])
  })
})

describe('migrateV1', () => {
  it('maps stage → repetition and nextReviewAt → dueAt', () => {
    const old = [{ key: 'throw away|0', en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0, addedAt: NOW, stage: 3, nextReviewAt: NOW + 1000 }]
    const m = migrateV1(old)
    expect(m).toHaveLength(1)
    expect(m[0].repetition).toBe(3)
    expect(m[0].dueAt).toBe(NOW + 1000)
    expect(m[0].easeFactor).toBe(DEFAULT_EASE)
  })
})

describe('groupBySentence', () => {
  it('groups entries by sentence, preserving order', () => {
    const a0 = entry({ key: 'a|0', en: 'give up' })
    const a1 = entry({ key: 'a|1', en: 'give up', wordIndex: 1 })
    const b0 = entry({ key: 'b|0', en: 'stand by' })
    const g = groupBySentence([a0, b0, a1])
    expect(g.map((x) => x.en)).toEqual(['give up', 'stand by'])
    expect(g[0].entries).toHaveLength(2)
  })
})

describe('loadEntries', () => {
  it('migrates v1 data to v2 shape', () => {
    const v1 = JSON.stringify([{ key: 'a|0', en: 'a', zh: '甲', word: 'a', wordIndex: 0, addedAt: NOW, stage: 2, nextReviewAt: NOW + 10 }])
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'wrongbook:v2' ? null : v1) } })
    const loaded = loadEntries()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].repetition).toBe(2)
    expect(loaded[0].dueAt).toBe(NOW + 10)
  })

  it('returns [] on corrupt storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad' } })
    expect(loadEntries()).toEqual([])
  })
})
