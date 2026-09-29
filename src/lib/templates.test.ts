import { describe, it, expect } from 'vitest'
import { makeTemplate, sortTemplates } from './templates'
import type { Template } from './templates'

const NOW = Date.UTC(2026, 0, 1)
const items = [{ id: 'i1', en: 'throw away', zh: '扔掉' }]

function tpl(id: string, name: string, createdAt: number): Template {
  return { id, name, createdAt, items, warnings: [] }
}

describe('makeTemplate', () => {
  it('records name, items, warnings, createdAt, and a unique id', () => {
    const a = makeTemplate('7年级unit1', items, ['w1'], NOW)
    const b = makeTemplate('8年级unit2', items, [], NOW)
    expect(a.name).toBe('7年级unit1')
    expect(a.createdAt).toBe(NOW)
    expect(a.items).toBe(items)
    expect(a.warnings).toEqual(['w1'])
    expect(a.id).not.toBe(b.id)
  })
})

describe('sortTemplates', () => {
  const t1 = tpl('a', '香蕉', 100)
  const t2 = tpl('b', '苹果', 200)
  const t3 = tpl('c', '苹果', 300)

  it('sorts by time, newest first', () => {
    expect(sortTemplates([t1, t2], 'time').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('sorts by name (pinyin) and breaks ties by time desc', () => {
    expect(sortTemplates([t1, t2], 'name').map((t) => t.id)).toEqual(['b', 'a']) // 苹果 < 香蕉
    expect(sortTemplates([t2, t3], 'name').map((t) => t.id)).toEqual(['c', 'b']) // same name → newest first
  })

  it('does not mutate the input array', () => {
    const list = [t1, t2]
    sortTemplates(list, 'time')
    expect(list).toEqual([t1, t2])
  })
})
