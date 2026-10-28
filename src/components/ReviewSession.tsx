import { useState } from 'react'
import type { WrongEntry } from '../lib/wrongbook'
import type { QuizType } from '../lib/quiz'
import { pickType } from '../lib/quiz'
import Choice from './quiz/Choice'
import Flashcard from './quiz/Flashcard'

interface Props {
  entries: WrongEntry[]
  onAnswer: (key: string, type: QuizType, q: number) => number
  onBack: () => void
  backLabel?: string
}

export default function ReviewSession({ entries, onAnswer, onBack, backLabel = '返回错题本' }: Props) {
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [types] = useState<QuizType[]>(() => entries.map(() => pickType()))
  const [totalXp, setTotalXp] = useState(0)
  const [lastGain, setLastGain] = useState<number | null>(null)

  if (entries.length === 0) {
    return (
      <div className="review">
        <div className="game-top">
          <button className="ghost" onClick={onBack}>← {backLabel}</button>
        </div>
        <section className="game-card">
          <p className="result success" role="status">今日没有到期复习的内容。</p>
          <div className="game-actions">
            <button className="primary" onClick={onBack}>{backLabel}</button>
          </div>
        </section>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="review">
        <section className="game-card">
          <p className="result success" role="status">🎉 本次复习完成！共 {entries.length} 题，+{totalXp} XP</p>
          <div className="game-actions">
            <button className="primary" onClick={onBack}>{backLabel}</button>
          </div>
        </section>
      </div>
    )
  }

  const entry = entries[index]
  const type = types[index]

  function handleResult(q: number) {
    const xp = onAnswer(entry.key, type, q)
    setTotalXp((x) => x + xp)
    setLastGain(xp)
    if (index === entries.length - 1) setFinished(true)
    else setIndex(index + 1)
  }

  return (
    <div className="review">
      <div className="game-top">
        <button className="ghost" onClick={onBack}>← {backLabel}</button>
        <span className="progress">复习 {index + 1} / {entries.length}</span>
      </div>

      {lastGain !== null && <p className="xp-toast" role="status">+{lastGain} XP</p>}

      {type === 'choice'
        ? <Choice entry={entry} onResult={handleResult} />
        : <Flashcard entry={entry} onResult={handleResult} />}
    </div>
  )
}
