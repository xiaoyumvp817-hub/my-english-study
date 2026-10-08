import { dateKey, levelForXp } from './stats'
import type { Stats } from './stats'
import type { Template } from './templates'
import { normalize } from './tokenize'
import type { WrongEntry } from './wrongbook'
import { isMastered } from './wrongbook'

export interface Motivation {
  goalPerDay: number
  makeupCards: number
  awardedMilestones: number
  seenAchievements: string[]
}

export function emptyMotivation(): Motivation {
  return { goalPerDay: 5, makeupCards: 0, awardedMilestones: 0, seenAchievements: [] }
}

const STORAGE_KEY = 'motivation:v1'

export function loadMotivation(): Motivation {
  if (typeof window === 'undefined') return emptyMotivation()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyMotivation()
    const p = JSON.parse(raw) as Partial<Motivation>
    return {
      goalPerDay: typeof p.goalPerDay === 'number' ? p.goalPerDay : 5,
      makeupCards: typeof p.makeupCards === 'number' ? p.makeupCards : 0,
      awardedMilestones: typeof p.awardedMilestones === 'number' ? p.awardedMilestones : 0,
      seenAchievements: Array.isArray(p.seenAchievements) ? p.seenAchievements : [],
    }
  } catch {
    return emptyMotivation()
  }
}

export function saveMotivation(m: Motivation): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {
    // storage unavailable — non-fatal
  }
}

function yesterdayOf(day: string): string {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

export function goalStreak(dailyHistory: Record<string, number>, goal: number, today: string): number {
  let day = today
  if ((dailyHistory[day] ?? 0) < goal) day = yesterdayOf(day)
  let streak = 0
  while ((dailyHistory[day] ?? 0) >= goal) {
    streak++
    day = yesterdayOf(day)
  }
  return streak
}

export function makeupTarget(dailyHistory: Record<string, number>, goal: number, today: string): string | null {
  if (goalStreak(dailyHistory, goal, today) === 0) return null
  let day = yesterdayOf(today)
  for (let i = 0; i < 365; i++) {
    if ((dailyHistory[day] ?? 0) < goal) return day
    day = yesterdayOf(day)
  }
  return null
}

export function templateCompleted(template: Template, learned: ReadonlySet<string>): boolean {
  return template.items.every((it) => learned.has(normalize(it.en)))
}

export function completedUnitCount(templates: Template[], learned: ReadonlySet<string>): number {
  return templates.filter((t) => templateCompleted(t, learned)).length
}

export interface Metrics {
  streak: number
  completedUnits: number
  totalLearned: number
  level: number
  hasWrongs: boolean
  allWrongsMastered: boolean
}

export interface Achievement {
  id: string
  name: string
  emoji: string
  desc: string
  check: (m: Metrics) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-step', name: '起步', emoji: '🚀', desc: '学完第 1 句', check: (m) => m.totalLearned >= 1 },
  { id: 'ten-words', name: '小有成就', emoji: '🌱', desc: '累计学完 10 句', check: (m) => m.totalLearned >= 10 },
  { id: 'hundred-words', name: '百词达人', emoji: '💯', desc: '累计学完 100 句', check: (m) => m.totalLearned >= 100 },
  { id: 'five-hundred', name: '五百词霸', emoji: '🏆', desc: '累计学完 500 句', check: (m) => m.totalLearned >= 500 },
  { id: 'streak-7', name: '坚持一周', emoji: '🔥', desc: '连续达标 7 天', check: (m) => m.streak >= 7 },
  { id: 'streak-30', name: '坚持一月', emoji: '🌙', desc: '连续达标 30 天', check: (m) => m.streak >= 30 },
  { id: 'collector-3', name: '图鉴收藏家', emoji: '📚', desc: '完成 3 个单元', check: (m) => m.completedUnits >= 3 },
  { id: 'collector-10', name: '单元大师', emoji: '🗺️', desc: '完成 10 个单元', check: (m) => m.completedUnits >= 10 },
  { id: 'clear-wrongs', name: '错题清零', emoji: '🧹', desc: '错题本全部掌握', check: (m) => m.hasWrongs && m.allWrongsMastered },
  { id: 'level-5', name: '等级飞跃', emoji: '⚡', desc: '达到 Lv.5', check: (m) => m.level >= 5 },
]

export interface AchievementInput {
  stats: Stats
  learned: ReadonlySet<string>
  templates: Template[]
  entries: WrongEntry[]
  goal: number
  today: string
}

export function unlockedAchievements(input: AchievementInput): string[] {
  const m: Metrics = {
    streak: goalStreak(input.stats.dailyHistory, input.goal, input.today),
    completedUnits: completedUnitCount(input.templates, input.learned),
    totalLearned: input.stats.totalLearned,
    level: levelForXp(input.stats.xp),
    hasWrongs: input.entries.length > 0,
    allWrongsMastered: input.entries.length > 0 && input.entries.every(isMastered),
  }
  return ACHIEVEMENTS.filter((a) => a.check(m)).map((a) => a.id)
}

export function unseenAchievements(unlocked: string[], seen: string[]): string[] {
  const seenSet = new Set(seen)
  return unlocked.filter((id) => !seenSet.has(id))
}

export function awardMakeupCards(
  m: Motivation,
  dailyHistory: Record<string, number>,
  goal: number,
  today: string,
): Motivation {
  const milestone = Math.floor(goalStreak(dailyHistory, goal, today) / 7)
  if (milestone <= m.awardedMilestones) return m
  const gained = milestone - m.awardedMilestones
  return { ...m, makeupCards: m.makeupCards + gained, awardedMilestones: milestone }
}

export function useMakeupCard(
  m: Motivation,
  dailyHistory: Record<string, number>,
  goal: number,
  today: string,
): { motivation: Motivation; day: string } | null {
  if (m.makeupCards <= 0) return null
  const day = makeupTarget(dailyHistory, goal, today)
  if (!day) return null
  return { motivation: { ...m, makeupCards: m.makeupCards - 1 }, day }
}
