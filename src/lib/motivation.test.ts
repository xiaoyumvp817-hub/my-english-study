import { describe, it, expect, vi, afterEach } from 'vitest'
import { emptyMotivation, loadMotivation, saveMotivation } from './motivation'

afterEach(() => { vi.unstubAllGlobals() })

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
