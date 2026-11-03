export interface Stats {
  xp: number
  streakDays: number
  lastStudyDate: string
  /** 累计学习句数（学会一句 +1，去重；复习不计入）。 */
  totalLearned: number
  dailyHistory: Record<string, number>
  /** 累计复习答对数（错题本复习答对一题 +1）。 */
  totalReviews: number
  /** 每日复习答对数。 */
  dailyReviews: Record<string, number>
}

export function emptyStats(): Stats {
  return { xp: 0, streakDays: 0, lastStudyDate: '', totalLearned: 0, dailyHistory: {}, totalReviews: 0, dailyReviews: {} }
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

/** 刷新「今天学过」：更新 lastStudyDate 与连续学习天数（不改变学习/复习计数）。 */
function markActive(stats: Stats, today: string): Stats {
  if (stats.lastStudyDate === today) return stats
  const streakDays = isYesterday(stats.lastStudyDate, today) ? stats.streakDays + 1 : 1
  return { ...stats, streakDays, lastStudyDate: today }
}

export function recordStudy(stats: Stats, today: string, count = 1): Stats {
  const dailyHistory = { ...stats.dailyHistory, [today]: (stats.dailyHistory[today] ?? 0) + count }
  return { ...markActive(stats, today), totalLearned: stats.totalLearned + count, dailyHistory }
}

/** 复习答题：加 XP、刷新连续学习；答对计入复习数（不计入学习句数）。 */
export function applyReviewAnswer(stats: Stats, xp: number, correct: boolean, today: string): Stats {
  const dailyReviews = correct
    ? { ...stats.dailyReviews, [today]: (stats.dailyReviews[today] ?? 0) + 1 }
    : stats.dailyReviews
  return markActive(
    { ...addXp(stats, xp), totalReviews: stats.totalReviews + (correct ? 1 : 0), dailyReviews },
    today,
  )
}

/** 补签卡回填：把某一天直接记为达标（dailyHistory[day] = count）。 */
export function backfillDay(stats: Stats, day: string, count: number): Stats {
  return { ...stats, dailyHistory: { ...stats.dailyHistory, [day]: count } }
}

const STORAGE_KEY = 'stats:v1'

export function loadStats(): Stats {
  if (typeof window === 'undefined') return emptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const p = JSON.parse(raw) as Partial<Stats>
    const legacy = p as Partial<Stats> & { reviewCount?: number }
    return {
      ...emptyStats(),
      ...p,
      totalLearned: p.totalLearned ?? legacy.reviewCount ?? 0,
      dailyHistory: p.dailyHistory ?? {},
      totalReviews: p.totalReviews ?? 0,
      dailyReviews: p.dailyReviews ?? {},
    }
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
