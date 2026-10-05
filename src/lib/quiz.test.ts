import { describe, it, expect } from 'vitest'
import { makeChoices, makePhraseChoices, pickType, xpForAnswer, blankSentence } from './quiz'
import { normalize } from './tokenize'

describe('makeChoices', () => {
  it('always includes the target exactly once and never duplicates', () => {
    const choices = makeChoices('throw', 'throw away your bad habits')
    expect(choices).toHaveLength(4)
    expect(choices.filter((c) => normalize(c) === 'throw')).toHaveLength(1)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })

  it('pads with fallback words when the sentence is too short', () => {
    const choices = makeChoices('go', 'go')
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })
})

describe('makePhraseChoices', () => {
  it('includes the target once and draws distractors from the pool', () => {
    const choices = makePhraseChoices('collect', ['send a letter', 'a cup of tea', 'throw away'])
    expect(choices).toHaveLength(4)
    expect(choices.filter((c) => normalize(c) === 'collect')).toHaveLength(1)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })

  it('pads with fallback words when the pool is too small', () => {
    const choices = makePhraseChoices('go', ['run'])
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })

  it('dedupes pool items that normalize to the target', () => {
    const choices = makePhraseChoices('collect', ['Collect', 'collect', 'run', 'jump'])
    expect(choices).toHaveLength(4)
    expect(choices.filter((c) => normalize(c) === 'collect')).toHaveLength(1)
  })
})

describe('pickType', () => {
  it('picks flashcard for low rng and choice for high rng', () => {
    expect(pickType(() => 0)).toBe('flashcard')
    expect(pickType(() => 0.99)).toBe('choice')
  })
})

describe('xpForAnswer', () => {
  it('gives floor XP on a lapse, full XP otherwise', () => {
    expect(xpForAnswer('choice', 1)).toBe(5)
    expect(xpForAnswer('choice', 4)).toBe(10)
    expect(xpForAnswer('flashcard', 5)).toBe(8)
  })
})

describe('blankSentence', () => {
  it('replaces the word with a blank, preserving surrounding text', () => {
    expect(blankSentence('Throw away!', 'throw')).toBe('______ away!')
  })
})
