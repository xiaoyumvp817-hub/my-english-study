import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { TemplateItem } from '../types'
import { tokenize, wordTokens, isCorrect } from '../lib/tokenize'
import { speak } from '../lib/speech'
import { nextHint } from '../lib/hints'
import type { HintLevel, HintState } from '../lib/hints'
import SentenceDisplay from './SentenceDisplay'
import CoverImage from './CoverImage'
import Confetti from './Confetti'

export interface WrongWord {
  word: string
  wordIndex: number
}

interface Props {
  item: TemplateItem
  continueLabel: string
  onComplete: () => void
  onWrongWords?: (wrongs: WrongWord[]) => void
  onCompleted?: () => void
}

const HINT_LABELS: Record<HintLevel, string> = {
  1: '💡 提示：首字母',
  2: '🔊 提示：朗读单词',
  3: '👁️ 揭示答案',
}

/**
 * The fill-in-the-blank quiz for a single sentence: translation, audio,
 * word blanks, and the check / continue flow. Shared by normal practice
 * and review.
 */
export default function SentenceQuiz({ item, continueLabel, onComplete, onWrongWords, onCompleted }: Props) {
  const tokens = useMemo(() => tokenize(item.en), [item])
  const words = useMemo(() => wordTokens(tokens), [tokens])

  const [answers, setAnswers] = useState<string[]>(() => words.map(() => ''))
  const [results, setResults] = useState<boolean[]>(() => words.map(() => false))
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState<boolean[]>(() => words.map(() => false))
  const [hint, setHint] = useState<HintState | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  const wordTexts = useMemo(() => words.map((w) => w.text), [words])
  const nextAction = nextHint(wordTexts, answers, hint)
  const hintLabel = nextAction ? HINT_LABELS[nextAction.level] : '💡 提示'

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
    else onCompleted?.()

    const firstWrong = r.findIndex((ok) => !ok)
    if (firstWrong >= 0) {
      document.getElementById(`word-${firstWrong}`)?.focus()
    }
  }

  function handleHint() {
    if (!nextAction) return
    const { wordIndex, level } = nextAction

    if (level === 1) {
      const letter = words[wordIndex].text[0]
      setAnswers((prev) => {
        const next = [...prev]
        next[wordIndex] = letter
        return next
      })
    } else if (level === 2) {
      speak(words[wordIndex].text)
    } else {
      // Level 3: reveal the full word. This counts as wrong, so it enters
      // the wrongbook for SM-2 review via onWrongWords.
      const word = words[wordIndex].text
      setAnswers((prev) => {
        const next = [...prev]
        next[wordIndex] = word
        return next
      })
      setRevealed((prev) => {
        const next = [...prev]
        next[wordIndex] = true
        return next
      })
      onWrongWords?.([{ word, wordIndex }])
    }

    setHint({ wordIndex, level })
  }

  const allCorrect = checked && results.every(Boolean)

  useEffect(() => {
    if (allCorrect) setCelebrate(true)
  }, [allCorrect])

  return (
    <>
      <section className="game-card">
        {item.image && <CoverImage src={item.image} className="item-image" />}
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
            revealed={revealed}
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
              <>
                <button type="button" className="ghost" onClick={handleHint} disabled={!nextAction}>
                  {hintLabel}
                </button>
                <button type="submit" className="primary">检查</button>
              </>
            )}
          </div>
        </form>
      </section>
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </>
  )
}
