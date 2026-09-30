import { describe, it, expect } from 'vitest'
import { buildImagePrompt, imageFileName, canonicalKey, STYLE } from './imagePrompt'

describe('buildImagePrompt', () => {
  it('uses the curated scene for an abstract phrase', () => {
    const p = buildImagePrompt('collect sunshine', '收集阳光')
    expect(p).toContain('catching golden sunshine into a glass jar')
    expect(p.endsWith(STYLE)).toBe(true)
  })

  it('falls back to the English phrase when not curated', () => {
    const p = buildImagePrompt('brand new phrase', '全新短语')
    expect(p).toContain('brand new phrase')
    expect(p.endsWith(STYLE)).toBe(true)
  })

  it('matches a curated scene regardless of ellipsis / whitespace style', () => {
    const a = buildImagePrompt('use …as', '使用…作为…')
    const b = buildImagePrompt('use ... as', '使用…作为…')
    expect(a).toBe(b)
  })
})

describe('imageFileName', () => {
  it('zero-pads and is 1-based', () => {
    expect(imageFileName(0)).toBe('u5-001.jpg')
    expect(imageFileName(9)).toBe('u5-010.jpg')
    expect(imageFileName(127)).toBe('u5-128.jpg')
  })
})

describe('canonicalKey', () => {
  it('strips case, punctuation and whitespace', () => {
    expect(canonicalKey('Use … As')).toBe(canonicalKey('useas'))
  })
})
