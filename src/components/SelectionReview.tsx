import { useMemo, useState } from 'react'
import type { TemplateItem } from '../types'
import { makePhraseChoices } from '../lib/quiz'
import { isCorrect } from '../lib/tokenize'
import CoverImage from './CoverImage'

interface Props {
  items: TemplateItem[]
  index: number
  total: number
  onWrong: (item: TemplateItem) => void
  onNext: () => void
  onFinish: () => void
  onExit: () => void
}

/**
 * 点选复习：给出中文，从「正确英文 + 干扰项」里点选，必须点对才能进入下一题。
 * 点错的选项标红并禁用，同时把该短语记入错题本。
 */
export default function SelectionReview({ items, index, total, onWrong, onNext, onFinish, onExit }: Props) {
  const item = items[index]
  const choices = useMemo(
    () => makePhraseChoices(item.en, items.filter((_, j) => j !== index).map((i) => i.en)),
    [items, index, item.en],
  )
  const [wrongPicks, setWrongPicks] = useState<ReadonlySet<string>>(() => new Set())
  const [solved, setSolved] = useState(false)
  const isLast = index === total - 1

  function handlePick(choice: string) {
    if (isCorrect(choice, item.en)) {
      setSolved(true)
    } else {
      setWrongPicks((prev) => new Set(prev).add(choice))
      onWrong(item)
    }
  }

  return (
    <div className="game">
      <div className="game-top">
        <button className="ghost" onClick={onExit}>退出</button>
        <span className="progress">{index + 1} / {total} · 点选</span>
      </div>

      <section className="quiz-card">
        {item.image && <CoverImage src={item.image} className="item-image" />}
        <p className="quiz-prompt">{item.zh || '（无中文释义）'}</p>

        <div className="quiz-options">
          {choices.map((choice) => {
            const isAnswer = isCorrect(choice, item.en)
            const isWrongPick = wrongPicks.has(choice)
            const cls = [
              'quiz-option',
              solved && isAnswer ? 'is-correct' : '',
              isWrongPick ? 'is-wrong' : '',
            ].filter(Boolean).join(' ')
            return (
              <button key={choice} className={cls} disabled={solved || isWrongPick} onClick={() => handlePick(choice)}>
                {choice}
              </button>
            )
          })}
        </div>

        {solved && (
          <div className="quiz-actions">
            <p className="result success" role="status">✓ 答对了</p>
            <button className="primary" onClick={isLast ? onFinish : onNext}>
              {isLast ? '结束复习，开始输入 →' : '下一题 →'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
