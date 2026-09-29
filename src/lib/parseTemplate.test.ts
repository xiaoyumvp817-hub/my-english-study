import { describe, it, expect } from 'vitest'
import { parseTemplate } from './parseTemplate'

describe('parseTemplate', () => {
  it('parses pipe-separated lines', () => {
    const { items, warnings } = parseTemplate('Hello | 你好\nWorld | 世界\n')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ en: 'Hello', zh: '你好' })
    expect(items[1]).toMatchObject({ en: 'World', zh: '世界' })
    expect(warnings).toHaveLength(0)
  })

  it('skips empty lines and strips a UTF-8 BOM', () => {
    const { items } = parseTemplate('﻿Hi | 嗨\n\n')
    expect(items).toHaveLength(1)
    expect(items[0].en).toBe('Hi')
  })

  it('warns on lines without a separator', () => {
    const { items, warnings } = parseTemplate('No translation here\n')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ en: 'No translation here', zh: '' })
    expect(warnings).toHaveLength(1)
  })

  it('supports tab as a separator', () => {
    const { items } = parseTemplate('Hello\t你好')
    expect(items[0]).toMatchObject({ en: 'Hello', zh: '你好' })
  })
})
