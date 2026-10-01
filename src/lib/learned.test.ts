import { describe, it, expect, vi, afterEach } from 'vitest'
import { sentenceStatus, loadLearned, saveLearned, addLearned, commitLearned } from './learned'
import type { WrongEntry } from './wrongbook'

afterEach(() => { vi.unstubAllGlobals() })

function entry(over: Partial<WrongEntry> = {}): WrongEntry {
  return {
    key: 'a|0',
    en: 'collect sunshine',
    zh: '收集阳光',
    word: 'collect',
    wordIndex: 0,
    addedAt: 0,
    repetition: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    dueAt: 0,
    reviews: 0,
    lapses: 0,
    lastReviewAt: 0,
    ...over,
  }
}

describe('addLearned', () => {
  it('adds a normalized key and dedupes', () => {
    expect(addLearned([], '  Give Up ')).toEqual(['give up'])
    expect(addLearned(['give up'], 'Give Up')).toEqual(['give up'])
  })
})

describe('commitLearned', () => {
  it('reports added=true for a new sentence', () => {
    const r = commitLearned([], '  Give Up ')
    expect(r.added).toBe(true)
    expect(r.learned).toEqual(['give up'])
  })

  it('reports added=false for a duplicate', () => {
    const r = commitLearned(['give up'], 'Give Up')
    expect(r.added).toBe(false)
    expect(r.learned).toEqual(['give up'])
  })
})

describe('sentenceStatus', () => {
  it('returns review when a related word is unmastered', () => {
    expect(sentenceStatus('collect sunshine', new Set(), [entry()])).toBe('review')
  })

  it('returns learned when completed and no wrong words', () => {
    expect(sentenceStatus('collect sunshine', new Set(['collect sunshine']), [])).toBe('learned')
  })

  it('returns new when not completed and no wrong words', () => {
    expect(sentenceStatus('collect sunshine', new Set(), [])).toBe('new')
  })

  it('returns learned when related words are all mastered', () => {
    const mastered = entry({ repetition: 4, intervalDays: 21 })
    expect(sentenceStatus('collect sunshine', new Set(), [mastered])).toBe('learned')
  })

  it('returns review when a mastered word is joined by a new unmastered one', () => {
    const mastered = entry({ repetition: 4, intervalDays: 21 })
    const fresh = entry({ key: 'a|1', word: 'sunshine', wordIndex: 1 })
    expect(sentenceStatus('collect sunshine', new Set(['collect sunshine']), [mastered, fresh])).toBe('review')
  })
})

describe('loadLearned / saveLearned', () => {
  it('returns empty when storage is missing', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(loadLearned()).toEqual([])
  })

  it('returns empty on corrupt JSON', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad' } })
    expect(loadLearned()).toEqual([])
  })

  it('persists and reloads a list', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
      },
    })
    saveLearned(['give up', 'stand by'])
    expect(loadLearned()).toEqual(['give up', 'stand by'])
  })
})
