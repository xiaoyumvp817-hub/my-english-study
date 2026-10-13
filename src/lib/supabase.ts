import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import { emptyStats } from './stats'
import type { Stats } from './stats'
import { emptyMotivation } from './motivation'
import type { Motivation } from './motivation'
import type { Challenge } from './challenge'
import { generateUniqueFriendCode, assertNotSelf, normalizeFriendCode } from './friendCode'

// ===== 行类型（与 supabase/schema.sql 列一一对应） =====
export interface TemplatesRow {
  id: string
  user_id: string
  name: string
  created_at: number
  items: unknown
  warnings: unknown
  updated_at?: string
}
export interface WrongEntryRow {
  id?: string
  user_id: string
  key: string
  en: string
  zh: string
  word: string
  word_index: number
  added_at: number
  stability: number
  difficulty: number
  state: number
  due_at: number
  reviews: number
  lapses: number
  last_review_at: number
}
export interface StatsRow {
  user_id: string
  xp: number
  streak_days: number
  total_learned: number
  last_study_date: string
  daily_history: unknown
  updated_at?: string
}
export interface LearnedRow {
  user_id: string
  items: unknown
  updated_at?: string
}
export interface MotivationRow {
  user_id: string
  goal_per_day: number
  makeup_cards: number
  awarded_milestones: number
  seen_achievements: unknown
  updated_at?: string
}
export interface ProfileRow {
  user_id: string
  display_name: string
  friend_code: string
  total_learned: number
  created_at?: string
}
export interface FriendshipRow {
  user_a: string
  user_b: string
  created_at?: string
}
export interface ChallengeRow {
  id: string
  challenger_id: string
  challengee_id: string
  words: unknown
  challenger_score: number
  challenger_duration_ms: number
  challengee_score: number | null
  challengee_duration_ms: number | null
  status: string
  created_at: string
  completed_at: string | null
}

// ===== 领域类型 =====
export interface Profile {
  userId: string
  displayName: string
  friendCode: string
  totalLearned: number
}

// ===== 行 ↔ 领域映射（纯函数，测试覆盖） =====
function asArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback
}
function asRecord(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}

export function templateToRow(userId: string, t: Template): TemplatesRow {
  return { id: t.id, user_id: userId, name: t.name, created_at: t.createdAt, items: t.items, warnings: t.warnings }
}
export function templateFromRow(r: TemplatesRow): Template {
  return { id: r.id, name: r.name, createdAt: r.created_at, items: asArray<Template['items'][number]>(r.items, []), warnings: asArray<string>(r.warnings, []) }
}

export function entryToRow(userId: string, e: WrongEntry): WrongEntryRow {
  return {
    user_id: userId, key: e.key, en: e.en, zh: e.zh, word: e.word, word_index: e.wordIndex,
    added_at: e.addedAt, stability: e.stability, difficulty: e.difficulty, state: e.state,
    due_at: e.dueAt, reviews: e.reviews, lapses: e.lapses, last_review_at: e.lastReviewAt,
  }
}
export function entryFromRow(r: WrongEntryRow): WrongEntry {
  return {
    key: r.key, en: r.en, zh: r.zh, word: r.word, wordIndex: r.word_index,
    addedAt: r.added_at, stability: r.stability, difficulty: r.difficulty, state: r.state,
    dueAt: r.due_at, reviews: r.reviews, lapses: r.lapses, lastReviewAt: r.last_review_at,
  }
}

export function statsToRow(userId: string, s: Stats): StatsRow {
  return { user_id: userId, xp: s.xp, streak_days: s.streakDays, total_learned: s.totalLearned, last_study_date: s.lastStudyDate, daily_history: s.dailyHistory }
}
export function statsFromRow(r: StatsRow): Stats {
  return { xp: r.xp, streakDays: r.streak_days, totalLearned: r.total_learned, lastStudyDate: r.last_study_date, dailyHistory: asRecord(r.daily_history) }
}

export function learnedToRow(userId: string, items: string[]): LearnedRow {
  return { user_id: userId, items }
}
export function learnedFromRow(r: LearnedRow): string[] {
  return asArray<string>(r.items, [])
}

export function motivationToRow(userId: string, m: Motivation): MotivationRow {
  return { user_id: userId, goal_per_day: m.goalPerDay, makeup_cards: m.makeupCards, awarded_milestones: m.awardedMilestones, seen_achievements: m.seenAchievements }
}
export function motivationFromRow(r: MotivationRow): Motivation {
  return { goalPerDay: r.goal_per_day, makeupCards: r.makeup_cards, awardedMilestones: r.awarded_milestones, seenAchievements: asArray<string>(r.seen_achievements, []) }
}

export function profileRowToProfile(r: ProfileRow): Profile {
  return { userId: r.user_id, displayName: r.display_name, friendCode: r.friend_code, totalLearned: r.total_learned }
}

/** 邮箱前缀作为默认昵称（'kid1@x.com' → 'kid1'）。 */
export function displayNameFromEmail(email: string): string {
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, at)
}

// ===== challenge / friendship 行映射 =====
export function challengeToRow(c: Challenge): ChallengeRow {
  return {
    id: c.id, challenger_id: c.challengerId, challengee_id: c.challengeeId,
    words: c.words, challenger_score: c.challengerScore, challenger_duration_ms: c.challengerDurationMs,
    challengee_score: c.challengeeScore, challengee_duration_ms: c.challengeeDurationMs,
    status: c.status, created_at: new Date(c.createdAt).toISOString(), completed_at: c.completedAt ? new Date(c.completedAt).toISOString() : null,
  }
}
export function challengeFromRow(r: ChallengeRow): Challenge {
  return {
    id: r.id, challengerId: r.challenger_id, challengeeId: r.challengee_id,
    words: asArray<Challenge['words'][number]>(r.words, []),
    challengerScore: r.challenger_score, challengerDurationMs: r.challenger_duration_ms,
    challengeeScore: r.challengee_score, challengeeDurationMs: r.challengee_duration_ms,
    status: r.status === 'completed' ? 'completed' : 'pending',
    createdAt: new Date(r.created_at).getTime(), completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
  }
}

export function friendshipOtherId(me: string, r: FriendshipRow): string {
  return r.user_a === me ? r.user_b : r.user_a
}

// ===== CloudApi 接口（Task 5/6/9 实现，签名在此锁定） =====
export interface CloudApi {
  signUp(email: string, password: string): Promise<string>
  signIn(email: string, password: string): Promise<string>
  signOut(): Promise<void>
  getUserId(): Promise<string | null>

  fetchTemplates(userId: string): Promise<Template[]>
  pushTemplates(userId: string, list: Template[]): Promise<void>
  fetchEntries(userId: string): Promise<WrongEntry[]>
  pushEntries(userId: string, list: WrongEntry[]): Promise<void>
  fetchStats(userId: string): Promise<Stats>
  pushStats(userId: string, stats: Stats): Promise<void>
  fetchLearned(userId: string): Promise<string[]>
  pushLearned(userId: string, items: string[]): Promise<void>
  fetchMotivation(userId: string): Promise<Motivation>
  pushMotivation(userId: string, m: Motivation): Promise<void>

  ensureProfile(userId: string, email: string): Promise<Profile>
  getProfileByCode(code: string): Promise<Profile | null>
  addFriendship(userId: string, friendId: string): Promise<void>
  listFriendIds(userId: string): Promise<string[]>
  listProfiles(userIds: string[]): Promise<Profile[]>
  getMyProfile(userId: string): Promise<Profile | null>
  createChallenge(challenge: Challenge): Promise<void>
  listChallengesFor(userId: string): Promise<Challenge[]>
  setChallengeResult(challengeId: string, score: number, durationMs: number): Promise<void>
  globalLeaderboard(limit: number): Promise<Profile[]>
}

// ===== 客户端工厂 =====
export function createSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  return createClient(url, key)
}

export function createCloudApi(client: SupabaseClient): CloudApi {
  const uid = async (): Promise<string> => {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new Error('未登录')
    return data.session.user.id
  }

  async function select<T>(table: string, userId: string): Promise<T[]> {
    const { data, error } = await client.from(table).select('*').eq('user_id', userId)
    if (error) throw error
    return (data ?? []) as T[]
  }
  async function upsertRows(table: string, rows: unknown[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await client.from(table).upsert(rows)
    if (error) throw error
  }

  return {
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) throw error
      return data.user?.id ?? (await uid())
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data.user.id
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw error },
    async getUserId() {
      const { data } = await client.auth.getSession()
      return data.session?.user.id ?? null
    },

    async fetchTemplates(userId) { return (await select<TemplatesRow>('templates', userId)).map(templateFromRow) },
    async pushTemplates(userId, list) { await upsertRows('templates', list.map((t) => templateToRow(userId, t))) },
    async fetchEntries(userId) { return (await select<WrongEntryRow>('wrong_entries', userId)).map(entryFromRow) },
    async pushEntries(userId, list) { await upsertRows('wrong_entries', list.map((e) => entryToRow(userId, e))) },
    async fetchStats(userId) {
      const rows = await select<StatsRow>('stats', userId)
      return rows.length ? statsFromRow(rows[0]) : emptyStats()
    },
    async pushStats(userId, stats) { await upsertRows('stats', [statsToRow(userId, stats)]) },
    async fetchLearned(userId) {
      const rows = await select<LearnedRow>('learned', userId)
      return rows.length ? learnedFromRow(rows[0]) : []
    },
    async pushLearned(userId, items) { await upsertRows('learned', [learnedToRow(userId, items)]) },
    async fetchMotivation(userId) {
      const rows = await select<MotivationRow>('motivation', userId)
      return rows.length ? motivationFromRow(rows[0]) : emptyMotivation()
    },
    async pushMotivation(userId, m) { await upsertRows('motivation', [motivationToRow(userId, m)]) },

    // —— 社交层：ensureProfile 因登录流程依赖，提前到 Task 6 实现；其余 Task 9 补齐 ——
    async ensureProfile(userId, email) {
      const displayName = displayNameFromEmail(email)
      const { data: existing } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle()
      if (existing) return profileRowToProfile(existing as ProfileRow)
      const code = await generateUniqueFriendCode(async (c) => {
        const { data } = await client.from('profiles').select('friend_code').eq('friend_code', c).maybeSingle()
        return data !== null
      })
      const { error } = await client.from('profiles').insert({ user_id: userId, display_name: displayName, friend_code: code, total_learned: 0 })
      if (error) throw error
      return { userId, displayName, friendCode: code, totalLearned: 0 }
    },
    async getProfileByCode(code) {
      const { data, error } = await client.from('profiles').select('*').eq('friend_code', normalizeFriendCode(code)).maybeSingle()
      if (error) throw error
      return data ? profileRowToProfile(data as ProfileRow) : null
    },
    async addFriendship(userId, friendId) {
      assertNotSelf(userId, friendId)
      const [a, b] = userId < friendId ? [userId, friendId] : [friendId, userId]
      const { error } = await client.from('friendships').insert({ user_a: a, user_b: b })
      if (error) throw error
    },
    async listFriendIds(userId) {
      const { data, error } = await client.from('friendships').select('*').or(`user_a.eq.${userId},user_b.eq.${userId}`)
      if (error) throw error
      return ((data ?? []) as FriendshipRow[]).map((r) => friendshipOtherId(userId, r))
    },
    async listProfiles(userIds) {
      if (userIds.length === 0) return []
      const { data, error } = await client.from('profiles').select('*').in('user_id', userIds)
      if (error) throw error
      return ((data ?? []) as ProfileRow[]).map(profileRowToProfile)
    },
    async getMyProfile(userId) {
      const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data ? profileRowToProfile(data as ProfileRow) : null
    },
    async createChallenge(challenge) {
      const { error } = await client.from('challenges').insert(challengeToRow(challenge))
      if (error) throw error
    },
    async listChallengesFor(userId) {
      const { data, error } = await client.from('challenges').select('*').or(`challenger_id.eq.${userId},challengee_id.eq.${userId}`).order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as ChallengeRow[]).map(challengeFromRow)
    },
    async setChallengeResult(challengeId, score, durationMs) {
      const { error } = await client.from('challenges').update({ challengee_score: score, challengee_duration_ms: durationMs, status: 'completed', completed_at: new Date().toISOString() }).eq('id', challengeId)
      if (error) throw error
    },
    async globalLeaderboard(limit) {
      const { data, error } = await client.from('profiles').select('user_id, display_name, friend_code, total_learned').order('total_learned', { ascending: false }).limit(limit)
      if (error) throw error
      return ((data ?? []) as ProfileRow[]).map(profileRowToProfile)
    },
  }
}
