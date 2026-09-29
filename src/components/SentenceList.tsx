import type { TemplateItem } from '../types'

interface Props {
  templateName: string
  items: TemplateItem[]
  warnings: string[]
  onSelect: (index: number) => void
  onBack: () => void
}

export default function SentenceList({ templateName, items, warnings, onSelect, onBack }: Props) {
  return (
    <div className="list">
      <header className="list-head">
        <div>
          <h1 className="title">{templateName}</h1>
          <p className="subtitle">共 {items.length} 句</p>
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
        {items.map((item, i) => (
          <li key={item.id}>
            <button className="sentence-card" onClick={() => onSelect(i)}>
              <span className="sentence-en">{item.en}</span>
              <span className="sentence-zh">{item.zh || '（无中文释义）'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
