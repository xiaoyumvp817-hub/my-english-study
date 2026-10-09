import { describe, it, expect } from 'vitest'
import { snapshotWords, challengeWinner, type Challenge } from './challenge'

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
