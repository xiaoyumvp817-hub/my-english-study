import type { TemplateItem } from '../types'
import type { SentenceStatus } from './learned'

export type BatchFilter = 'review' | 'new' | 'all'
export type BatchOrder = 'order' | 'random'

/**
 * 从 items 里按学习状态筛选，再按「顺序 / 随机」取前 count 个，返回它们的 id。
 * statuses 与 items 一一对应（由 sentenceStatus 生成）。
 */
export function pickBatch(
  items: TemplateItem[],
  statuses: SentenceStatus[],
  filter: BatchFilter,
  count: number,
  order: BatchOrder,
  rng: () => number = Math.random,
): string[] {
  let idx = items
    .map((_, i) => i)
    .filter((i) => filter === 'all' || statuses[i] === filter)

  if (order === 'random') {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
  }

  return idx.slice(0, Math.max(0, count)).map((i) => items[i].id)
}
