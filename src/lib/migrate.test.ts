import { describe, it, expect } from 'vitest'
import { mergeEntries, mergeTemplates, mergeStats, mergeLearned, mergeMotivation } from './migrate'
import { emptyStats } from './stats'
import { emptyMotivation } from './motivation'
import type { WrongEntry } from './wrongbook'

const e = (key: string): WrongEntry => ({ key, en: key, zh: '', word: key, wordIndex: 0, addedAt: 1, repetition: 0, intervalDays: 1, easeFactor: 2.5, dueAt: 1, reviews: 0, lapses: 0, lastReviewAt: 0 })

describe('mergeEntries', () => {
  it('按 key 去重，云端优先', () => {
    const merged = mergeEntries([e('a|0'), e('b|0')], [e('b|0'), e('c|0')])
    expect(merged.map((x) => x.key)).toEqual(['b|0', 'c|0', 'a|0'])
  })
})

describe('mergeTemplates', () => {
  it('按 id 追加', () => {
    const a = { id: 't1', name: 'A', createdAt: 1, items: [], warnings: [] }
    const b = { id: 't2', name: 'B', createdAt: 2, items: [], warnings: [] }
    expect(mergeTemplates([a], [b]).map((t) => t.id)).toEqual(['t2', 't1'])
  })
})

describe('mergeStats', () => {
  it('逐项取较大值，daily_history 按天取大', () => {
    const local = { ...emptyStats(), xp: 10, totalLearned: 5, dailyHistory: { '2026-10-09': 2 } }
    const cloud = { ...emptyStats(), xp: 8, totalLearned: 9, dailyHistory: { '2026-10-09': 3, '2026-10-08': 1 } }
    const m = mergeStats(local, cloud)
    expect(m.xp).toBe(10)
    expect(m.totalLearned).toBe(9)
    expect(m.dailyHistory).toEqual({ '2026-10-09': 3, '2026-10-08': 1 })
  })
})

describe('mergeLearned', () => {
  it('并集去重', () => {
    expect(mergeLearned(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeMotivation', () => {
  it('补签卡/里程碑取大，seenAchievements 并集', () => {
    const local = { ...emptyMotivation(), goalPerDay: 10, makeupCards: 3, seenAchievements: ['a'] }
    const cloud = { ...emptyMotivation(), goalPerDay: 5, makeupCards: 1, seenAchievements: ['b'] }
    const m = mergeMotivation(local, cloud)
    expect(m.goalPerDay).toBe(5)
    expect(m.makeupCards).toBe(3)
    expect(m.seenAchievements).toEqual(['a', 'b'])
  })
})
