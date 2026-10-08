import { describe, it, expect, vi, afterEach } from 'vitest'
import { emptyMotivation, loadMotivation, saveMotivation, goalStreak, makeupTarget, templateCompleted, completedUnitCount } from './motivation'
import type { Template } from './templates'

afterEach(() => { vi.unstubAllGlobals() })

function tpl(items: string[]): Template {
  return { id: 't', name: 'u', createdAt: 0, items: items.map((en) => ({ id: en, en, zh: '' })), warnings: [] }
}

describe('motivation persistence', () => {
  it('emptyMotivation returns defaults', () => {
    expect(emptyMotivation()).toEqual({
      goalPerDay: 5,
      makeupCards: 0,
      awardedMilestones: 0,
      seenAchievements: [],
    })
  })

  it('loadMotivation returns defaults when nothing stored', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(loadMotivation()).toEqual(emptyMotivation())
  })

  it('loadMotivation fills missing fields with defaults', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ makeupCards: 2 }) } })
    const m = loadMotivation()
    expect(m.makeupCards).toBe(2)
    expect(m.goalPerDay).toBe(5)
    expect(m.awardedMilestones).toBe(0)
    expect(m.seenAchievements).toEqual([])
  })

  it('saveMotivation writes JSON under motivation:v1', () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { setItem } })
    saveMotivation(emptyMotivation())
    expect(setItem).toHaveBeenCalledWith('motivation:v1', JSON.stringify(emptyMotivation()))
  })
})

describe('goalStreak', () => {
  const goal = 5

  it('returns 0 for empty history', () => {
    expect(goalStreak({}, goal, '2026-10-08')).toBe(0)
  })

  it('counts consecutive met days ending today', () => {
    const h = { '2026-10-06': 5, '2026-10-07': 5, '2026-10-08': 5 }
    expect(goalStreak(h, goal, '2026-10-08')).toBe(3)
  })

  it('anchors from yesterday when today is below goal', () => {
    const h = { '2026-10-07': 5, '2026-10-08': 3 }
    expect(goalStreak(h, goal, '2026-10-08')).toBe(1)
  })

  it('stops at the first unmet day', () => {
    const h = { '2026-10-06': 4, '2026-10-07': 5, '2026-10-08': 5 }
    expect(goalStreak(h, goal, '2026-10-08')).toBe(2)
  })

  it('crosses month boundaries correctly', () => {
    const h = { '2026-09-30': 5, '2026-10-01': 5, '2026-10-02': 5 }
    expect(goalStreak(h, goal, '2026-10-02')).toBe(3)
  })
})

describe('makeupTarget', () => {
  const goal = 5

  it('returns null when streak is zero (nothing to protect)', () => {
    expect(makeupTarget({}, goal, '2026-10-08')).toBeNull()
    expect(makeupTarget({ '2026-10-05': 5 }, goal, '2026-10-08')).toBeNull()
  })

  it('returns yesterday when yesterday is unmet', () => {
    const h = { '2026-10-07': 2, '2026-10-08': 5 }
    expect(makeupTarget(h, goal, '2026-10-08')).toBe('2026-10-07')
  })

  it('returns the most recent unmet day before today', () => {
    const h = { '2026-10-05': 5, '2026-10-06': 1, '2026-10-07': 5, '2026-10-08': 5 }
    expect(makeupTarget(h, goal, '2026-10-08')).toBe('2026-10-06')
  })
})

describe('templateCompleted', () => {
  it('is true when every item is learned', () => {
    const t = tpl(['Hello world', 'Good morning'])
    expect(templateCompleted(t, new Set(['hello world', 'good morning']))).toBe(true)
  })

  it('is false when any item is missing', () => {
    const t = tpl(['Hello world', 'Good morning'])
    expect(templateCompleted(t, new Set(['hello world']))).toBe(false)
  })

  it('normalizes case and whitespace', () => {
    const t = tpl(['  Hello   World '])
    expect(templateCompleted(t, new Set(['hello world']))).toBe(true)
  })
})

describe('completedUnitCount', () => {
  it('counts completed templates', () => {
    const learned = new Set(['one'])
    expect(completedUnitCount([tpl(['One']), tpl(['Two'])], learned)).toBe(1)
  })

  it('returns 0 for an empty template list', () => {
    expect(completedUnitCount([], new Set(['one']))).toBe(0)
  })
})
