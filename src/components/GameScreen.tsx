import type { TemplateItem } from '../types'
import SentenceQuiz from './SentenceQuiz'
import type { WrongWord } from './SentenceQuiz'
import Timer from './Timer'

interface Props {
  item: TemplateItem
  index: number
  total: number
  startTime?: number
  onNext: () => void
  onEnd: () => void
  onWrongWords: (wrongs: WrongWord[]) => void
  onCompleted: () => void
}

export default function GameScreen({ item, index, total, startTime, onNext, onEnd, onWrongWords, onCompleted }: Props) {
  const isLast = index === total - 1

  return (
    <div className="game">
      <div className="game-top">
        <button className="ghost" onClick={onEnd}>结束学习</button>
        <div className="game-top-right">
          {startTime !== undefined && <Timer startTime={startTime} />}
          <span className="progress">{index + 1} / {total}</span>
        </div>
      </div>

      <SentenceQuiz
        item={item}
        continueLabel={isLast ? '完成学习' : '下一句 →'}
        onComplete={onNext}
        onWrongWords={onWrongWords}
        onCompleted={onCompleted}
      />
    </div>
  )
}
