import { describe, it, expect } from 'vitest'
import { snapshotWords, challengeWinner, challengeOpponentId, challengeOutcomeFor, type Challenge } from './challenge'

const base: Challenge = {
  id: 'c1', challengerId: 'a', challengeeId: 'b',
  words: [{ en: 'hello', zh: '你好' }],
  challengerScore: 3, challengerDurationMs: 1000,
  challengeeScore: null, challengeeDurationMs: null,
  status: 'pending', createdAt: 1, completedAt: null,
}

describe('snapshotWords', () => {
  it('只取 en/zh', () => {
    expect(snapshotWords([{ id: 'i1', en: 'hello', zh: '你好', image: 'x.jpg' }]))
      .toEqual([{ en: 'hello', zh: '你好' }])
  })
})

describe('challengeWinner', () => {
  it('未应战返回 null', () => {
    expect(challengeWinner(base)).toBeNull()
  })
  it('发起方高分胜', () => {
    expect(challengeWinner({ ...base, challengeeScore: 1, status: 'completed' })).toBe('challenger')
  })
  it('应战方高分胜', () => {
    expect(challengeWinner({ ...base, challengeeScore: 5, status: 'completed' })).toBe('challengee')
  })
  it('平分平局', () => {
    expect(challengeWinner({ ...base, challengeeScore: 3, status: 'completed' })).toBe('draw')
  })
})

describe('challengeOpponentId', () => {
  it('返回非本人一侧', () => {
    expect(challengeOpponentId(base, 'a')).toBe('b')
    expect(challengeOpponentId(base, 'b')).toBe('a')
  })
})

describe('challengeOutcomeFor', () => {
  const completed = { ...base, challengeeScore: 2, status: 'completed' as const }
  it('我发起且我分高 → win', () => {
    expect(challengeOutcomeFor(completed, 'a')).toBe('win')
  })
  it('我发起且对方分高 → loss', () => {
    expect(challengeOutcomeFor(completed, 'b')).toBe('loss')
  })
  it('我应战且我分高 → win', () => {
    const c = { ...base, challengerScore: 1, challengeeScore: 5, status: 'completed' as const }
    expect(challengeOutcomeFor(c, 'b')).toBe('win')
    expect(challengeOutcomeFor(c, 'a')).toBe('loss')
  })
  it('平分 → draw', () => {
    const c = { ...base, challengerScore: 2, challengeeScore: 2, status: 'completed' as const }
    expect(challengeOutcomeFor(c, 'a')).toBe('draw')
  })
  it('未应战 → null', () => {
    expect(challengeOutcomeFor(base, 'a')).toBeNull()
  })
})
