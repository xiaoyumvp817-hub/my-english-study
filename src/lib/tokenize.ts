import type { Token } from '../types'

// Matches either a word (letters/numbers, with internal apostrophes or
// hyphens, e.g. "don't", "well-known", "I'm") or a run of punctuation.
const TOKEN_RE =
  /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\p{L}\p{N}\s]+/gu

const HAS_WORD_CHAR = /[\p{L}\p{N}]/u

/**
 * Splits a sentence into word tokens (fillable blanks) and punctuation
 * tokens (shown inline, not fillable). Whitespace is discarded.
 */
export function tokenize(sentence: string): Token[] {
  const tokens: Token[] = []
  let id = 0
  for (const match of sentence.matchAll(TOKEN_RE)) {
    const text = match[0]
    tokens.push({
      kind: HAS_WORD_CHAR.test(text) ? 'word' : 'punct',
      id: `tok-${id++}`,
      text,
    })
  }
  return tokens
}

/** Returns only the fillable word tokens, in order. */
export function wordTokens(tokens: Token[]): Token[] {
  return tokens.filter((t): t is Extract<Token, { kind: 'word' }> => t.kind === 'word')
}

/** Normalizes a user answer for comparison: trim, collapse spaces, lowercase. */
export function normalize(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Case-insensitive answer check. */
export function isCorrect(answer: string, target: string): boolean {
  return normalize(answer) === normalize(target)
}
