import { describe, it, expect, vi, afterEach } from 'vitest'
import { emptyMotivation, loadMotivation, saveMotivation, goalStreak, makeupTarget, templateCompleted, completedUnitCount, ACHIEVEMENTS, unlockedAchievements, unseenAchievements } from './motivation'
import type { Template } from './templates'
import type { Stats } from './stats'
import { emptyStats, dateKey } from './stats'

afterEach(() => { vi.unstubAllGlobals() })

function tpl(items: string[]): Template {
  return { id: 't', name: 'u', createdAt: 0, items: items.map((en) => ({ id: en, en, zh: '' })), warnings: [] }
}

function stats(over: Partial<Stats>): Stats {
  return { ...emptyStats(), ...over }
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

describe('unlockedAchievements', () => {
  const base = { learned: new Set<string>(), templates: [], entries: [], goal: 5, today: '2026-10-08' }

  it('unlocks first-step at totalLearned >= 1', () => {
    const ids = unlockedAchievements({ ...base, stats: stats({ totalLearned: 1 }) })
    expect(ids).toContain('first-step')
  })

  it('unlocks streak-7 at 7 met days but not streak-30', () => {
    const dailyHistory: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date('2026-10-08T00:00:00')
      d.setDate(d.getDate() - i)
      dailyHistory[dateKey(d)] = 5
    }
    const ids = unlockedAchievements({ ...base, stats: stats({ dailyHistory }) })
    expect(ids).toContain('streak-7')
    expect(ids).not.toContain('streak-30')
  })

  it('does not unlock clear-wrongs with empty entries', () => {
    const ids = unlockedAchievements({ ...base, stats: stats({ totalLearned: 100 }) })
    expect(ids).not.toContain('clear-wrongs')
  })

  it('unlocks level-5 at xp 1600', () => {
    const ids = unlockedAchievements({ ...base, stats: stats({ xp: 1600 }) })
    expect(ids).toContain('level-5')
  })

  it('unlocks collector-3 at 3 completed units', () => {
    const templates = [tpl(['One']), tpl(['Two']), tpl(['Three']), tpl(['Four'])]
    const ids = unlockedAchievements({
      ...base,
      templates,
      learned: new Set(['one', 'two', 'three']),
      stats: stats({ totalLearned: 10 }),
    })
    expect(ids).toContain('collector-3')
    expect(ids).not.toContain('collector-10')
  })
})

describe('unseenAchievements', () => {
  it('returns only ids not yet seen', () => {
    expect(unseenAchievements(['a', 'b'], ['a'])).toEqual(['b'])
  })
  it('returns empty when all seen', () => {
    expect(unseenAchievements(['a'], ['a'])).toEqual([])
  })
})

describe('ACHIEVEMENTS', () => {
  it('has the 10 ids from the spec', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual([
      'clear-wrongs', 'collector-10', 'collector-3', 'first-step', 'five-hundred',
      'hundred-words', 'level-5', 'streak-30', 'streak-7', 'ten-words',
    ])
  })
})
