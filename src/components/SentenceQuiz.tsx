import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { TemplateItem } from '../types'
import { tokenize, wordTokens, isCorrect } from '../lib/tokenize'
import { speak } from '../lib/speech'
import SentenceDisplay from './SentenceDisplay'

export interface WrongWord {
  word: string
  wordIndex: number
}

interface Props {
  item: TemplateItem
  continueLabel: string
  onComplete: () => void
  onWrongWords?: (wrongs: WrongWord[]) => void
}

/**
 * The fill-in-the-blank quiz for a single sentence: translation, audio,
 * word blanks, and the check / continue flow. Shared by normal practice
 * and review.
 */
export default function SentenceQuiz({ item, continueLabel, onComplete, onWrongWords }: Props) {
  const tokens = useMemo(() => tokenize(item.en), [item])
  const words = useMemo(() => wordTokens(tokens), [tokens])

  const [answers, setAnswers] = useState<string[]>(() => words.map(() => ''))
  const [results, setResults] = useState<boolean[]>(() => words.map(() => false))
  const [checked, setChecked] = useState(false)

  function handleChange(wordIndex: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev]
      next[wordIndex] = value
      return next
    })
  }

  function handleCheck(e: FormEvent) {
    e.preventDefault()
    const r = words.map((w, i) => isCorrect(answers[i], w.text))
    setResults(r)
    setChecked(true)

    const wrongs: WrongWord[] = []
    r.forEach((ok, i) => {
      if (!ok) wrongs.push({ word: words[i].text, wordIndex: i })
    })
    if (wrongs.length > 0) onWrongWords?.(wrongs)

    const firstWrong = r.findIndex((ok) => !ok)
    if (firstWrong >= 0) {
      document.getElementById(`word-${firstWrong}`)?.focus()
    }
  }

  const allCorrect = checked && results.every(Boolean)

  return (
    <section className="game-card">
      <p className="translation">{item.zh || '（无中文释义）'}</p>

      <button type="button" className="speak" onClick={() => speak(item.en)} title="朗读整句">
        🔊 朗读整句
      </button>

      <form onSubmit={handleCheck} noValidate>
        <SentenceDisplay
          tokens={tokens}
          answers={answers}
          checked={checked}
          results={results}
          onChange={handleChange}
        />

        {allCorrect ? (
          <p className="result success" role="status">🎉 全对！</p>
        ) : checked ? (
          <p className="result fail" role="status">还有填错的单词（标红），修改后再检查一次。</p>
        ) : null}

        <div className="game-actions">
          {allCorrect ? (
            <button type="button" className="primary" onClick={onComplete}>
              {continueLabel}
            </button>
          ) : (
            <button type="submit" className="primary">检查</button>
          )}
        </div>
      </form>
    </section>
  )
}
