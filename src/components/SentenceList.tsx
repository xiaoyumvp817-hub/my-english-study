import { useState } from 'react'
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
  onStartStudy: (items: TemplateItem[]) => void
  onBack: () => void
}

export default function SentenceList({ templateName, items, warnings, learned, entries, onSelect, onStartStudy, onBack }: Props) {
  const statuses = items.map((item) => sentenceStatus(item.en, learned, entries))
  const learnedCount = statuses.filter((s) => s === 'learned').length
  const reviewCount = statuses.filter((s) => s === 'review').length
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(items.map((item) => item.id)))
  }
  function clearAll() {
    setSelected(new Set())
  }
  function startStudy() {
    onStartStudy(items.filter((item) => selected.has(item.id)))
  }

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

      <div className="list-toolbar">
        <div className="list-toolbar-left">
          <button className="ghost" onClick={selectAll}>全选</button>
          <button className="ghost" onClick={clearAll}>清空</button>
        </div>
        <button className="primary" disabled={selected.size === 0} onClick={startStudy}>
          {selected.size > 0 ? `开始学习（${selected.size}）` : '开始学习'}
        </button>
      </div>

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
          const checked = selected.has(item.id)
          return (
            <li key={item.id}>
              <div className="sentence-row">
                <input
                  type="checkbox"
                  className="sentence-check"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  aria-label={`选择：${item.en}`}
                />
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
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
