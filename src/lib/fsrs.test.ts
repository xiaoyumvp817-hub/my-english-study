import { describe, it, expect } from 'vitest'
import { Rating, State } from 'ts-fsrs'
import { toGrade, fsrsNext, newFsrsState, MASTERED_STABILITY_DAYS, DAY_MS } from './fsrs'

const NOW = Date.UTC(2026, 0, 1)

describe('toGrade', () => {
  it('maps 忘记/模糊/记得/轻松 to FSRS grades', () => {
    expect(toGrade(2)).toBe(Rating.Again)
    expect(toGrade(3)).toBe(Rating.Hard)
    expect(toGrade(4)).toBe(Rating.Good)
    expect(toGrade(5)).toBe(Rating.Easy)
  })
})

describe('newFsrsState', () => {
  it('starts uninitialized and due at the given time', () => {
    const s = newFsrsState(NOW + DAY_MS)
    expect(s.stability).toBe(0)
    expect(s.difficulty).toBe(0)
    expect(s.state).toBe(State.New)
    expect(s.reviews).toBe(0)
    expect(s.lapses).toBe(0)
    expect(s.dueAt).toBe(NOW + DAY_MS)
  })
})

describe('fsrsNext', () => {
  it('a Good first review produces real stability and a future due date', () => {
    const n = fsrsNext(newFsrsState(NOW), 4, NOW)
    expect(n.stability).toBeGreaterThan(1)
    expect(n.reviews).toBe(1)
    expect(n.state).toBe(State.Review)
    expect(n.dueAt).toBeGreaterThan(NOW)
    expect(n.lastReviewAt).toBe(NOW)
  })

  it('a lapse (忘记) raises difficulty, drops stability, and counts a lapse', () => {
    let s = newFsrsState(NOW)
    s = fsrsNext(s, 4, NOW)
    s = fsrsNext(s, 4, s.dueAt)
    const before = s
    const n = fsrsNext(s, 2, s.dueAt)
    expect(n.lapses).toBeGreaterThan(before.lapses)
    expect(n.difficulty).toBeGreaterThan(before.difficulty)
    expect(n.stability).toBeLessThan(before.stability)
  })

  it('repeated Good reviews reach the mastery stability threshold', () => {
    let s = newFsrsState(NOW)
    for (let i = 0; i < 4; i++) s = fsrsNext(s, 4, s.dueAt)
    expect(s.stability).toBeGreaterThanOrEqual(MASTERED_STABILITY_DAYS)
  })
})
