import type { TemplateItem } from '../types'
import SentenceQuiz from './SentenceQuiz'
import type { WrongWord } from './SentenceQuiz'

interface Props {
  item: TemplateItem
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onWrongWords: (wrongs: WrongWord[]) => void
}

export default function GameScreen({ item, index, total, onNext, onBack, onWrongWords }: Props) {
  const isLast = index === total - 1

  return (
    <div className="game">
      <div className="game-top">
        <button className="ghost" onClick={onBack}>← 返回列表</button>
        <span className="progress">{index + 1} / {total}</span>
      </div>

      <SentenceQuiz
        item={item}
        continueLabel={isLast ? '完成，返回列表' : '下一句 →'}
        onComplete={onNext}
        onWrongWords={onWrongWords}
      />
    </div>
  )
}
