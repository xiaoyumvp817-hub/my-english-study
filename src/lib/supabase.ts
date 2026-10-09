import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'
import type { Challenge } from './challenge'

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
  repetition: number
  interval_days: number
  ease_factor: number
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
    added_at: e.addedAt, repetition: e.repetition, interval_days: e.intervalDays,
    ease_factor: e.easeFactor, due_at: e.dueAt, reviews: e.reviews, lapses: e.lapses, last_review_at: e.lastReviewAt,
  }
}
export function entryFromRow(r: WrongEntryRow): WrongEntry {
  return {
    key: r.key, en: r.en, zh: r.zh, word: r.word, wordIndex: r.word_index,
    addedAt: r.added_at, repetition: r.repetition, intervalDays: r.interval_days,
    easeFactor: r.ease_factor, dueAt: r.due_at, reviews: r.reviews, lapses: r.lapses, lastReviewAt: r.last_review_at,
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

// createCloudApi(client) 的 sync 实现留到 Task 5 需要时补齐；本任务只锁定签名与类型。
export function createCloudApi(_client: SupabaseClient): CloudApi {
  throw new Error('Task 5 实现 createCloudApi')
}
