import type { TemplateItem } from '../types'
import type { WrongEntry } from '../lib/wrongbook'
import { sentenceStatus } from '../lib/learned'
import CoverImage from './CoverImage'

interface Props {
  templateName: string
  items: TemplateItem[]
  warnings: string[]
  learned: ReadonlySet<string>
  entries: WrongEntry[]
  onSelect: (index: number) => void
  onBack: () => void
}

export default function SentenceList({ templateName, items, warnings, learned, entries, onSelect, onBack }: Props) {
  const statuses = items.map((item) => sentenceStatus(item.en, learned, entries))
  const learnedCount = statuses.filter((s) => s === 'learned').length
  const reviewCount = statuses.filter((s) => s === 'review').length

  return (
    <div className="list">
      <header className="list-head">
        <div>
          <h1 className="title">{templateName}</h1>
          <p className="subtitle">共 {items.length} 句 · 已学 {learnedCount} · 需复习 {reviewCount}</p>
          <div className="status-legend">
            <span><i className="status-dot learned" /> 已学完</span>
            <span><i className="status-dot review" /> 需复习</span>
          </div>
        </div>
        <button className="ghost" onClick={onBack}>← 返回模板库</button>
      </header>

      {warnings.length > 0 && (
        <div className="warnings" role="alert">
          {warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      <ul className="sentence-list">
        {items.map((item, i) => {
          const status = statuses[i]
          return (
            <li key={item.id}>
              <button className="sentence-card" onClick={() => onSelect(i)}>
                {item.image && <CoverImage src={item.image} className="sentence-thumb" />}
                <span className="sentence-body">
                  <span className="sentence-en">{item.en}</span>
                  <span className="sentence-zh">{item.zh || '（无中文释义）'}</span>
                </span>
                {status !== 'new' && (
                  <span
                    className={`status-dot ${status}`}
                    role="img"
                    aria-label={status === 'learned' ? '已学完' : '需复习'}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
