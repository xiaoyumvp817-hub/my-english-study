import { useMemo, useState } from 'react'
import type { WrongEntry } from '../../lib/wrongbook'
import { makeChoices, blankSentence } from '../../lib/quiz'
import { isCorrect } from '../../lib/tokenize'

interface Props {
  entry: WrongEntry
  onResult: (q: number) => void
}

export default function Choice({ entry, onResult }: Props) {
  const choices = useMemo(() => makeChoices(entry.word, entry.en), [entry])
  const [selected, setSelected] = useState<string | null>(null)
  const answered = selected !== null
  const sel = selected ?? ''
  const correct = answered && isCorrect(selected, entry.word)

  return (
    <section className="quiz-card">
      <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
      <p className="quiz-sentence">{blankSentence(entry.en, entry.word)}</p>

      <div className="quiz-options">
        {choices.map((c) => {
          const isSel = isCorrect(c, sel)
          const isAnswer = answered && isCorrect(c, entry.word)
          const cls = ['quiz-option', isAnswer ? 'is-correct' : '', isSel && !isAnswer ? 'is-wrong' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <button key={c} className={cls} disabled={answered} onClick={() => setSelected(c)}>
              {c}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="quiz-actions">
          <p className="result success" role="status">
            {correct ? '✓ 答对了' : `✗ 答案是 ${entry.word}`}
          </p>
          <button className="primary" onClick={() => onResult(correct ? 4 : 1)}>继续</button>
        </div>
      )}
    </section>
  )
}
