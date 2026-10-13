import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs'
import type { Grade } from 'ts-fsrs'

export const DAY_MS = 24 * 60 * 60 * 1000
/** 新收词（从未复习）的默认难度，落在 1..10 中点。 */
export const DEFAULT_DIFFICULTY = 5
/** 稳定度 ≥ 该天数即视为「已掌握」（下一次复习约 3 周后），从每日待复习中移除。 */
export const MASTERED_STABILITY_DAYS = 21

// 错题本是「每日复习一次」模型，不走 1m/10m 学习步进；关闭抖动让调度可复现（便于测试）。
const f = fsrs({ enable_short_term: false, enable_fuzz: false })

/** 应用评分 q∈{2..5}（忘记/模糊/记得/轻松）→ FSRS 档位。 */
export function toGrade(q: number): Grade {
  if (q <= 2) return Rating.Again
  if (q === 3) return Rating.Hard
  if (q === 4) return Rating.Good
  return Rating.Easy
}

/** 错题本持久化的 FSRS 记忆状态。state 存 ts-fsrs State 数值（0 New / 2 Review）。 */
export interface FsrsState {
  stability: number
  difficulty: number
  state: number
  reviews: number
  lapses: number
  dueAt: number
  lastReviewAt: number
}

/** 新收词时的初始记忆状态（尚未复习，dueAt 到期）。 */
export function newFsrsState(dueAt: number): FsrsState {
  return {
    stability: 0,
    difficulty: 0,
    state: State.New,
    reviews: 0,
    lapses: 0,
    dueAt,
    lastReviewAt: 0,
  }
}

/** 一次复习后推进记忆状态。q 为应用评分 2..5，now 为本次复习时间。 */
export function fsrsNext(state: FsrsState, q: number, now: number): FsrsState {
  const card = {
    ...createEmptyCard(),
    stability: state.stability,
    difficulty: state.difficulty,
    state: state.state as State,
    reps: state.reviews,
    lapses: state.lapses,
    due: new Date(state.dueAt),
    last_review: state.lastReviewAt > 0 ? new Date(state.lastReviewAt) : undefined,
  }
  const next = f.next(card, new Date(now), toGrade(q)).card
  return {
    stability: next.stability,
    difficulty: next.difficulty,
    state: next.state,
    reviews: next.reps,
    lapses: next.lapses,
    dueAt: next.due.getTime(),
    lastReviewAt: now,
  }
}
