import type { TemplateItem } from '../types'

export interface ChallengeWord { en: string; zh: string }
export type ChallengeStatus = 'pending' | 'completed'
export type ChallengeWinner = 'challenger' | 'challengee' | 'draw'

export interface Challenge {
  id: string
  challengerId: string
  challengeeId: string
  words: ChallengeWord[]
  challengerScore: number
  challengerDurationMs: number
  challengeeScore: number | null
  challengeeDurationMs: number | null
  status: ChallengeStatus
  createdAt: number
  completedAt: number | null
}

/** 词条快照：只留 en/zh，跨账号隐私隔离、题目一致。 */
export function snapshotWords(items: TemplateItem[]): ChallengeWord[] {
  return items.map((it) => ({ en: it.en, zh: it.zh }))
}

/** 判胜（派生，不落库）。未应战返回 null。 */
export function challengeWinner(c: Challenge): ChallengeWinner | null {
  if (c.challengeeScore === null) return null
  if (c.challengerScore > c.challengeeScore) return 'challenger'
  if (c.challengeeScore > c.challengerScore) return 'challengee'
  return 'draw'
}
