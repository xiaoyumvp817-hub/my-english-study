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

  it('excludes learned words, keeps review + new in list order', () => {
    expect(pickBatch(items, statuses, 10, 'order')).toEqual(['a', 'b', 'c'])
  })

  it('takes the first N non-learned in list order', () => {
    expect(pickBatch(items, statuses, 2, 'order')).toEqual(['a', 'b'])
  })

  it('returns empty when everything is learned', () => {
    expect(pickBatch([item('a'), item('b')], ['learned', 'learned'], 10, 'order')).toEqual([])
  })

  it('clamps count at zero', () => {
    expect(pickBatch(items, statuses, 0, 'order')).toEqual([])
  })

  it('returns all non-learned when count exceeds them', () => {
    expect(pickBatch(items, statuses, 99, 'order')).toEqual(['a', 'b', 'c'])
  })

  it('shuffles non-learned words for random order using a deterministic rng', () => {
    // rng 恒为 0：Fisher–Yates 每轮都交换到 i 位置，结果确定可断言
    const rng = () => 0
    expect(pickBatch(items, statuses, 3, 'random', rng)).toEqual(['b', 'c', 'a'])
  })

  it('random order never includes learned words', () => {
    const rng = () => 0.999
    const picked = pickBatch(items, statuses, 99, 'random', rng)
    expect(picked.sort()).toEqual(['a', 'b', 'c'])
  })
})
