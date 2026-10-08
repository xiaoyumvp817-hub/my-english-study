import { dateKey } from './stats'
import type { Template } from './templates'
import { normalize } from './tokenize'

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
