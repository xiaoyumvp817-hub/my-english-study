import { describe, it, expect } from 'vitest'
import { tokenize, wordTokens, normalize, isCorrect } from './tokenize'

describe('tokenize', () => {
  it('splits words from punctuation', () => {
    const tokens = tokenize('Hello, world!')
    expect(tokens.map((t) => [t.kind, t.text])).toEqual([
      ['word', 'Hello'],
      ['punct', ','],
      ['word', 'world'],
      ['punct', '!'],
    ])
  })

  it('keeps contractions and hyphens as a single word', () => {
    expect(wordTokens(tokenize("Don't give up")).map((t) => t.text)).toEqual([
      "Don't",
      'give',
      'up',
    ])
    expect(wordTokens(tokenize('well-known')).map((t) => t.text)).toEqual(['well-known'])
  })

  it('separates surrounding quotes', () => {
    expect(tokenize('"Hello"').map((t) => [t.kind, t.text])).toEqual([
      ['punct', '"'],
      ['word', 'Hello'],
      ['punct', '"'],
    ])
  })

  it('handles parentheses around numbers', () => {
    expect(tokenize('(2025)').map((t) => [t.kind, t.text])).toEqual([
      ['punct', '('],
      ['word', '2025'],
      ['punct', ')'],
    ])
  })

  it('returns no tokens for empty input', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('normalize / isCorrect', () => {
  it('is case-insensitive and trims whitespace', () => {
    expect(isCorrect('  hello ', 'Hello')).toBe(true)
    expect(isCorrect('hello', 'world')).toBe(false)
  })

  it('collapses internal whitespace', () => {
    expect(isCorrect('a  b', 'a b')).toBe(true)
  })

  it('normalizes to lowercase', () => {
    expect(normalize('  A B  ')).toBe('a b')
  })
})
