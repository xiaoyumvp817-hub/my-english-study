import type { Profile } from './supabase'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  totalLearned: number
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.totalLearned - a.totalLearned)
}

export function rankOf(entries: LeaderboardEntry[], userId: string): number {
  const idx = entries.findIndex((e) => e.userId === userId)
  return idx === -1 ? -1 : idx + 1
}

/** 好友榜：好友 + 我，按 totalLearned 降序。 */
export function friendLeaderboard(me: Profile, friends: Profile[]): LeaderboardEntry[] {
  const all = [me, ...friends].map((p) => ({ userId: p.userId, displayName: p.displayName, totalLearned: p.totalLearned }))
  return sortLeaderboard(all)
}
