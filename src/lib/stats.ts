export interface Stats {
  xp: number
  streakDays: number
  lastStudyDate: string
  reviewCount: number
  dailyHistory: Record<string, number>
}

export function emptyStats(): Stats {
  return { xp: 0, streakDays: 0, lastStudyDate: '', reviewCount: 0, dailyHistory: {} }
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export function xpForLevel(level: number): number {
  return 100 * (level - 1) * (level - 1)
}

export function xpProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelForXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, current: xp - base, needed: next - base }
}

export function addXp(stats: Stats, amount: number): Stats {
  return { ...stats, xp: stats.xp + amount }
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function isYesterday(prev: string, today: string): boolean {
  if (!prev) return false
  return new Date(`${today}T00:00:00`).getTime() - new Date(`${prev}T00:00:00`).getTime() === 24 * 60 * 60 * 1000
}

export function recordStudy(stats: Stats, today: string, count = 1): Stats {
  const dailyHistory = { ...stats.dailyHistory, [today]: (stats.dailyHistory[today] ?? 0) + count }
  if (stats.lastStudyDate === today) {
    return { ...stats, reviewCount: stats.reviewCount + count, dailyHistory }
  }
  const streakDays = isYesterday(stats.lastStudyDate, today) ? stats.streakDays + 1 : 1
  return { ...stats, streakDays, lastStudyDate: today, reviewCount: stats.reviewCount + count, dailyHistory }
}

const STORAGE_KEY = 'stats:v1'

export function loadStats(): Stats {
  if (typeof window === 'undefined') return emptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const p = JSON.parse(raw) as Partial<Stats>
    return { ...emptyStats(), ...p, dailyHistory: p.dailyHistory ?? {} }
  } catch {
    return emptyStats()
  }
}

export function saveStats(stats: Stats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // storage unavailable — non-fatal
  }
}
