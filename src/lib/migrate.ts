import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'

export function mergeEntries(local: WrongEntry[], cloud: WrongEntry[]): WrongEntry[] {
  const seen = new Map<string, WrongEntry>()
  for (const x of cloud) seen.set(x.key, x)
  for (const x of local) if (!seen.has(x.key)) seen.set(x.key, x)
  return [...seen.values()]
}

export function mergeTemplates(local: Template[], cloud: Template[]): Template[] {
  const seen = new Map<string, Template>()
  for (const t of cloud) seen.set(t.id, t)
  for (const t of local) if (!seen.has(t.id)) seen.set(t.id, t)
  return [...seen.values()]
}

export function mergeStats(local: Stats, cloud: Stats): Stats {
  const dailyHistory = { ...cloud.dailyHistory }
  for (const [day, n] of Object.entries(local.dailyHistory)) {
    dailyHistory[day] = Math.max(dailyHistory[day] ?? 0, n)
  }
  return {
    xp: Math.max(local.xp, cloud.xp),
    streakDays: Math.max(local.streakDays, cloud.streakDays),
    totalLearned: Math.max(local.totalLearned, cloud.totalLearned),
    lastStudyDate: local.lastStudyDate > cloud.lastStudyDate ? local.lastStudyDate : cloud.lastStudyDate,
    dailyHistory,
  }
}

export function mergeLearned(local: string[], cloud: string[]): string[] {
  return [...new Set([...local, ...cloud])]
}

export function mergeMotivation(local: Motivation, cloud: Motivation): Motivation {
  return {
    goalPerDay: cloud.goalPerDay > 0 ? cloud.goalPerDay : local.goalPerDay,
    makeupCards: Math.max(local.makeupCards, cloud.makeupCards),
    awardedMilestones: Math.max(local.awardedMilestones, cloud.awardedMilestones),
    seenAchievements: [...new Set([...local.seenAchievements, ...cloud.seenAchievements])],
  }
}
