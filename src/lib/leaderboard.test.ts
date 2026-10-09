import { describe, it, expect } from 'vitest'
import { sortLeaderboard, rankOf, friendLeaderboard } from './leaderboard'
import type { Profile } from './supabase'

const p = (id: string, total: number): Profile => ({ userId: id, displayName: id, friendCode: 'AAAAAAAA', totalLearned: total })

describe('sortLeaderboard', () => {
  it('按 totalLearned 降序，不改变入参', () => {
    const input = [p('a', 3), p('b', 9), p('c', 5)]
    expect(sortLeaderboard(input).map((x) => x.userId)).toEqual(['b', 'c', 'a'])
    expect(input.map((x) => x.userId)).toEqual(['a', 'b', 'c'])
  })
})

describe('rankOf', () => {
  it('返回 1 起名次，找不到返回 -1', () => {
    const sorted = sortLeaderboard([p('a', 3), p('b', 9)])
    expect(rankOf(sorted, 'b')).toBe(1)
    expect(rankOf(sorted, 'x')).toBe(-1)
  })
})

describe('friendLeaderboard', () => {
  it('好友 + 我合并降序', () => {
    const me = p('me', 5)
    const friends = [p('f1', 2), p('f2', 8)]
    expect(friendLeaderboard(me, friends).map((x) => x.userId)).toEqual(['f2', 'me', 'f1'])
  })
})
