import { describe, it, expect, vi, afterEach } from 'vitest'
import { emptyStats, addXp, levelForXp, xpProgress, recordStudy, dateKey, loadStats, applyReviewAnswer } from './stats'

afterEach(() => { vi.unstubAllGlobals() })

describe('levelForXp', () => {
  it('starts at level 1 and slows down', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(400)).toBe(3)
  })
})

describe('xpProgress', () => {
  it('computes progress within the current level', () => {
    expect(xpProgress(0)).toEqual({ level: 1, current: 0, needed: 100 })
    expect(xpProgress(150)).toEqual({ level: 2, current: 50, needed: 300 })
  })
})

describe('addXp', () => {
  it('accumulates xp immutably', () => {
    expect(addXp(emptyStats(), 15).xp).toBe(15)
    expect(addXp(emptyStats(), 0).xp).toBe(0)
  })
})

describe('recordStudy', () => {
  it('first study sets streak to 1', () => {
    const s = recordStudy(emptyStats(), '2026-09-28')
    expect(s.streakDays).toBe(1)
    expect(s.lastStudyDate).toBe('2026-09-28')
    expect(s.totalLearned).toBe(1)
  })

  it('same-day study does not double-count the streak', () => {
    const once = recordStudy(emptyStats(), '2026-09-28')
    const twice = recordStudy(once, '2026-09-28')
    expect(twice.streakDays).toBe(1)
    expect(twice.totalLearned).toBe(2)
  })

  it('consecutive days increment the streak', () => {
    const day1 = recordStudy(emptyStats(), '2026-09-27')
    const day2 = recordStudy(day1, '2026-09-28')
    expect(day2.streakDays).toBe(2)
  })

  it('a gap resets the streak to 1', () => {
    const day1 = recordStudy(emptyStats(), '2026-09-25')
    const gap = recordStudy(day1, '2026-09-28')
    expect(gap.streakDays).toBe(1)
  })

  it('records daily history counts', () => {
    const s = recordStudy(recordStudy(emptyStats(), '2026-09-28'), '2026-09-28')
    expect(s.dailyHistory['2026-09-28']).toBe(2)
  })
})

describe('dateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('loadStats', () => {
  it('returns empty stats when storage is missing', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(loadStats()).toEqual(emptyStats())
  })

  it('returns empty stats on corrupt JSON', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad json' } })
    expect(loadStats()).toEqual(emptyStats())
  })

  it('merges persisted fields over defaults', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ xp: 50, streakDays: 3 }) } })
    const s = loadStats()
    expect(s.xp).toBe(50)
    expect(s.streakDays).toBe(3)
    expect(s.dailyHistory).toEqual({})
  })

  it('migrates legacy reviewCount into totalLearned', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ reviewCount: 7 }) } })
    expect(loadStats().totalLearned).toBe(7)
  })
})

describe('applyReviewAnswer', () => {
  it('counts a correct review answer into totals', () => {
    const s = applyReviewAnswer(emptyStats(), 10, true, '2026-09-28')
    expect(s.totalLearned).toBe(1)
    expect(s.dailyHistory['2026-09-28']).toBe(1)
    expect(s.xp).toBe(10)
  })

  it('does not count a wrong review answer but still refreshes the streak', () => {
    const s = applyReviewAnswer(emptyStats(), 5, false, '2026-09-28')
    expect(s.totalLearned).toBe(0)
    expect(s.dailyHistory['2026-09-28']).toBe(0)
    expect(s.streakDays).toBe(1)
    expect(s.lastStudyDate).toBe('2026-09-28')
    expect(s.xp).toBe(5)
  })
})
