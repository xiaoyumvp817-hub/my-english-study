import { describe, it, expect } from 'vitest'
import { sm2Next, isMastered, DEFAULT_EASE, MIN_EASE } from './sm2'

const fresh = { repetition: 0, intervalDays: 1, easeFactor: DEFAULT_EASE }

describe('sm2Next', () => {
  it('resets on a lapse (q < 3) and lowers ease by formula', () => {
    const s = sm2Next({ repetition: 3, intervalDays: 10, easeFactor: 2.3 }, 2)
    expect(s.repetition).toBe(0)
    expect(s.intervalDays).toBe(1)
    // 2.3 + (0.1 - 3*(0.08 + 3*0.02)) = 1.98
    expect(s.easeFactor).toBeCloseTo(1.98, 5)
  })

  it('first success (q>=3) gives interval 1', () => {
    const s = sm2Next(fresh, 4)
    expect(s.repetition).toBe(1)
    expect(s.intervalDays).toBe(1)
    expect(s.easeFactor).toBeCloseTo(2.5, 5) // q4 → 不增不减
  })

  it('second success gives interval 6', () => {
    const s = sm2Next({ repetition: 1, intervalDays: 1, easeFactor: DEFAULT_EASE }, 4)
    expect(s.repetition).toBe(2)
    expect(s.intervalDays).toBe(6)
  })

  it('later successes multiply interval by ease factor', () => {
    const s = sm2Next({ repetition: 2, intervalDays: 6, easeFactor: 2.5 }, 5)
    expect(s.repetition).toBe(3)
    expect(s.intervalDays).toBe(Math.round(6 * 2.6)) // EF 2.5+0.1=2.6
  })

  it('clamps ease factor at the minimum', () => {
    const s = sm2Next({ repetition: 0, intervalDays: 1, easeFactor: 1.31 }, 0)
    expect(s.easeFactor).toBe(MIN_EASE)
  })
})

describe('isMastered', () => {
  it('requires both repetition and interval thresholds', () => {
    expect(isMastered({ repetition: 4, intervalDays: 21, easeFactor: DEFAULT_EASE })).toBe(true)
    expect(isMastered({ repetition: 3, intervalDays: 40, easeFactor: DEFAULT_EASE })).toBe(false)
    expect(isMastered({ repetition: 5, intervalDays: 10, easeFactor: DEFAULT_EASE })).toBe(false)
  })
})
