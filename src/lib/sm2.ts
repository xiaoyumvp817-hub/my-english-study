export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
export const MASTERED_REPETITION = 4
export const MASTERED_INTERVAL_DAYS = 21
export const DAY_MS = 24 * 60 * 60 * 1000

export interface SrsState {
  repetition: number
  intervalDays: number
  easeFactor: number
}

/** 一次复习后推进 SM-2 状态。q 为记忆质量 0..5。 */
export function sm2Next(state: SrsState, q: number): SrsState {
  const easeFactor = Math.max(
    MIN_EASE,
    state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  )
  if (q < 3) {
    return { repetition: 0, intervalDays: 1, easeFactor }
  }
  let intervalDays: number
  if (state.repetition === 0) intervalDays = 1
  else if (state.repetition === 1) intervalDays = 6
  else intervalDays = Math.round(state.intervalDays * easeFactor)
  return { repetition: state.repetition + 1, intervalDays, easeFactor }
}

export function isMastered(state: SrsState): boolean {
  return state.repetition >= MASTERED_REPETITION && state.intervalDays >= MASTERED_INTERVAL_DAYS
}
