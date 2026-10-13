import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  recordWrong, reviewEntry, dueEntries, isMastered, statusOf, migrateV2, migrateV1, groupBySentence, loadEntries,
} from './wrongbook'
import type { WrongEntry } from './wrongbook'
import { DAY_MS, MASTERED_STABILITY_DAYS } from './fsrs'

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
    stability: 0,
    difficulty: 0,
    state: 0,
    dueAt: NOW + DAY_MS,
    reviews: 0,
    lapses: 0,
    lastReviewAt: 0,
    ...overrides,
  }
}

describe('recordWrong', () => {
  it('adds a new word with FSRS defaults, due in 1 day', () => {
    const r = recordWrong([], input, NOW)
    expect(r).toHaveLength(1)
    expect(r[0].stability).toBe(0)
    expect(r[0].difficulty).toBe(0)
    expect(r[0].reviews).toBe(0)
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
  it('advances FSRS state and records a review', () => {
    const r = reviewEntry(entry(), 4, NOW)
    expect(r.reviews).toBe(1)
    expect(r.stability).toBeGreaterThan(0)
    expect(r.dueAt).toBeGreaterThan(NOW)
  })

  it('a lapse increments lapses and drops stability', () => {
    const studied = entry({ stability: 10, difficulty: 5, reviews: 3, state: 2 })
    const r = reviewEntry(studied, 2, NOW)
    expect(r.lapses).toBe(1)
    expect(r.stability).toBeLessThan(10)
  })

  it('freezes due date once stability reaches the mastery threshold', () => {
    let e = entry()
    // 连续「记得」直到掌握：稳定度随成功复习单调上升，最终必过阈值（封顶 8 次防死循环）
    for (let i = 0; i < 8 && !isMastered(e); i++) e = reviewEntry(e, 4, e.dueAt)
    expect(isMastered(e)).toBe(true)
    expect(e.dueAt).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('statusOf', () => {
  it('derives new / learning / mastered', () => {
    expect(statusOf(entry())).toBe('new')
    expect(statusOf(entry({ reviews: 1, stability: 1 }))).toBe('learning')
    expect(statusOf(entry({ stability: MASTERED_STABILITY_DAYS }))).toBe('mastered')
  })
})

describe('isDue / dueEntries', () => {
  it('returns only unmastered, due entries', () => {
    const due = entry({ key: 'a|0', dueAt: NOW - 1 })
    const later = entry({ key: 'b|0', dueAt: NOW + DAY_MS })
    const mastered = entry({ key: 'c|0', stability: MASTERED_STABILITY_DAYS, dueAt: Number.MAX_SAFE_INTEGER })
    expect(dueEntries([due, later, mastered], NOW).map((e) => e.key)).toEqual(['a|0'])
  })
})

describe('migrateV2', () => {
  it('maps SM-2 fields to FSRS stability/difficulty/state', () => {
    const old = [{ key: 'throw away|0', en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0, addedAt: NOW, repetition: 3, intervalDays: 10, easeFactor: 2.5, dueAt: NOW + 1000, reviews: 3, lapses: 1, lastReviewAt: NOW }]
    const m = migrateV2(old)
    expect(m).toHaveLength(1)
    expect(m[0].stability).toBe(10)
    expect(m[0].difficulty).toBe(5) // ease 2.5 → 难度 5
    expect(m[0].state).toBe(2)
    expect(m[0].reviews).toBe(3)
    expect(m[0].dueAt).toBe(NOW + 1000)
  })

  it('maps a high ease factor to low difficulty', () => {
    const m = migrateV2([{ key: 'x|0', en: 'x', zh: '', word: 'x', wordIndex: 0, addedAt: 0, intervalDays: 1, easeFactor: 3.0, dueAt: 0, reviews: 0 }])
    expect(m[0].difficulty).toBe(3)
  })
})

describe('migrateV1', () => {
  it('maps stage → reviews and nextReviewAt → dueAt', () => {
    const old = [{ key: 'throw away|0', en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0, addedAt: NOW, stage: 3, nextReviewAt: NOW + 1000 }]
    const m = migrateV1(old)
    expect(m).toHaveLength(1)
    expect(m[0].reviews).toBe(3)
    expect(m[0].dueAt).toBe(NOW + 1000)
    expect(m[0].difficulty).toBe(5)
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
  it('migrates v2 data to v3 shape', () => {
    const v2 = JSON.stringify([{ key: 'a|0', en: 'a', zh: '甲', word: 'a', wordIndex: 0, addedAt: NOW, repetition: 2, intervalDays: 6, easeFactor: 2.5, dueAt: NOW + 10, reviews: 2, lapses: 0, lastReviewAt: NOW }])
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'wrongbook:v3' ? null : v2) } })
    const loaded = loadEntries()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].stability).toBe(6)
    expect(loaded[0].reviews).toBe(2)
    expect(loaded[0].dueAt).toBe(NOW + 10)
  })

  it('returns [] on corrupt storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad' } })
    expect(loadEntries()).toEqual([])
  })
})
