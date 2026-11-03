import type { TemplateItem } from '../types'
import type { SentenceStatus } from './learned'

export type BatchOrder = 'order' | 'random'

/**
 * 从 items 里挑「未学会」的词（需复习 + 未学习，排除已学会），再按「顺序 / 随机」取前 count 个，返回它们的 id。
 * statuses 与 items 一一对应（由 sentenceStatus 生成）。
 */
export function pickBatch(
  items: TemplateItem[],
  statuses: SentenceStatus[],
  count: number,
  order: BatchOrder,
  rng: () => number = Math.random,
): string[] {
  let idx = items
    .map((_, i) => i)
    .filter((i) => statuses[i] !== 'learned')

  if (order === 'random') {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
  }

  return idx.slice(0, Math.max(0, count)).map((i) => items[i].id)
}
