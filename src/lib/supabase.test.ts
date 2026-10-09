import { describe, it, expect } from 'vitest'
import {
  templateToRow, templateFromRow,
  entryToRow, entryFromRow,
  statsToRow, statsFromRow,
  motivationToRow, motivationFromRow,
  profileRowToProfile,
} from './supabase'
import { emptyStats } from './stats'
import { emptyMotivation } from './motivation'
import type { WrongEntry } from './wrongbook'

const USER = '11111111-2222-3333-4444-555555555555'

describe('template 映射', () => {
  it('往返不变', () => {
    const t = { id: 'tpl-1', name: 'U5', createdAt: 123, items: [{ id: 'i1', en: 'hello', zh: '你好' }], warnings: ['w1'] }
    expect(templateFromRow(templateToRow(USER, t))).toEqual(t)
  })
})

describe('entry 映射', () => {
  const e: WrongEntry = { key: 'hello|0', en: 'hello', zh: '你好', word: 'hello', wordIndex: 0, addedAt: 1, repetition: 0, intervalDays: 1, easeFactor: 2.5, dueAt: 3, reviews: 0, lapses: 0, lastReviewAt: 0 }
  it('往返不变', () => {
    expect(entryFromRow(entryToRow(USER, e))).toEqual(e)
  })
})

describe('stats 映射', () => {
  it('往返不变', () => {
    const s = { ...emptyStats(), xp: 10, totalLearned: 3, dailyHistory: { '2026-10-09': 2 } }
    expect(statsFromRow(statsToRow(USER, s))).toEqual(s)
  })
})

describe('motivation 映射', () => {
  it('往返不变', () => {
    const m = { ...emptyMotivation(), goalPerDay: 10, seenAchievements: ['a', 'b'] }
    expect(motivationFromRow(motivationToRow(USER, m))).toEqual(m)
  })
})

describe('profileRowToProfile', () => {
  it('只保留公开字段', () => {
    const row = { user_id: USER, display_name: '小明', friend_code: 'K7P3QM9A', total_learned: 42, created_at: '2026-10-09', email: 'leak@x.com' }
    expect(profileRowToProfile(row)).toEqual({ userId: USER, displayName: '小明', friendCode: 'K7P3QM9A', totalLearned: 42 })
  })
})
