import { useState } from 'react'
import type { WrongEntry } from '../../lib/wrongbook'
import { blankSentence } from '../../lib/quiz'
import { speak } from '../../lib/speech'

interface Props {
  entry: WrongEntry
  onResult: (q: number) => void
}

export default function Flashcard({ entry, onResult }: Props) {
  const [flipped, setFlipped] = useState(false)

  if (!flipped) {
    return (
      <section className="quiz-card">
        <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
        <p className="quiz-sentence">{blankSentence(entry.en, entry.word)}</p>
        <div className="flashcard-face" role="button" tabIndex={0} onClick={() => setFlipped(true)}>
          <p>先回想这个单词，再点我翻面</p>
          <span className="flashcard-hint">👆 翻面看答案</span>
        </div>
      </section>
    )
  }

  return (
    <section className="quiz-card">
      <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
      <button type="button" className="speak" onClick={() => speak(entry.word)}>🔊 听单词</button>
      <span className="quiz-word">{entry.word}</span>
      <p className="quiz-sentence">{entry.en}</p>
      <div className="rate-actions">
        <button className="ghost" onClick={() => onResult(2)}>忘记</button>
        <button className="ghost" onClick={() => onResult(3)}>模糊</button>
        <button className="ghost" onClick={() => onResult(4)}>记得</button>
        <button className="ghost" onClick={() => onResult(5)}>轻松</button>
      </div>
    </section>
  )
}
