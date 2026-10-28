import { describe, it, expect } from 'vitest'
import { pickBatch } from './batchSelect'
import type { TemplateItem } from '../types'
import type { SentenceStatus } from './learned'

function item(id: string): TemplateItem {
  return { id, en: id, zh: '' }
}

describe('pickBatch', () => {
  const items = [item('a'), item('b'), item('c'), item('d')]
  const statuses: SentenceStatus[] = ['review', 'new', 'review', 'learned']

  it('selects by status in original order', () => {
    expect(pickBatch(items, statuses, 'review', 10, 'order')).toEqual(['a', 'c'])
  })

  it('respects count, taking the first N matching', () => {
    expect(pickBatch(items, statuses, 'all', 2, 'order')).toEqual(['a', 'b'])
  })

  it('returns empty for a status with no matches', () => {
    expect(pickBatch(items, statuses, 'new', 10, 'order')).toEqual(['b'])
  })

  it('clamps count at zero', () => {
    expect(pickBatch(items, statuses, 'all', 0, 'order')).toEqual([])
  })

  it('returns all when count exceeds matches', () => {
    expect(pickBatch(items, statuses, 'new', 99, 'order')).toEqual(['b'])
  })

  it('shuffles for random order using a deterministic rng', () => {
    // rng 恒为 0：Fisher–Yates 每轮都交换到 i 位置，结果确定可断言
    const rng = () => 0
    expect(pickBatch(items, statuses, 'all', 4, 'random', rng)).toEqual(['b', 'c', 'd', 'a'])
  })
})
