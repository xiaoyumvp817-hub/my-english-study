import { describe, it, expect } from 'vitest'
import { firstUnresolved, nextHint } from './hints'
import type { HintState } from './hints'

const words = ['collect', 'sunshine', 'up']

describe('firstUnresolved', () => {
  it('returns the first empty word', () => {
    expect(firstUnresolved(words, ['', '', ''])).toBe(0)
    expect(firstUnresolved(words, ['collect', '', ''])).toBe(1)
  })

  it('skips correct words case-insensitively', () => {
    expect(firstUnresolved(words, ['Collect', 'SUNSHINE', ''])).toBe(2)
  })

  it('returns -1 when every word is correct', () => {
    expect(firstUnresolved(words, ['collect', 'sunshine', 'up'])).toBe(-1)
  })

  it('treats a partial (first-letter) answer as still unresolved', () => {
    expect(firstUnresolved(words, ['c', '', ''])).toBe(0)
  })
})

describe('nextHint', () => {
  const noHint: HintState | null = null

  it('starts at level 1 on the first unresolved word', () => {
    expect(nextHint(words, ['', '', ''], noHint)).toEqual({ wordIndex: 0, level: 1 })
    expect(nextHint(words, ['collect', '', ''], noHint)).toEqual({ wordIndex: 1, level: 1 })
  })

  it('escalates the in-progress word through levels 1 → 2 → 3', () => {
    expect(nextHint(words, ['c', '', ''], { wordIndex: 0, level: 1 })).toEqual({ wordIndex: 0, level: 2 })
    expect(nextHint(words, ['c', '', ''], { wordIndex: 0, level: 2 })).toEqual({ wordIndex: 0, level: 3 })
  })

  it('moves to the next word once the current one is completed', () => {
    expect(nextHint(words, ['collect', '', ''], { wordIndex: 0, level: 1 })).toEqual({ wordIndex: 1, level: 1 })
  })

  it('returns null when nothing is left to hint', () => {
    expect(nextHint(words, ['collect', 'sunshine', 'up'], noHint)).toBeNull()
  })
})
