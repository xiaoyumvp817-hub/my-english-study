import { useMemo, useState } from 'react'
import type { WrongEntry } from '../lib/wrongbook'
import { groupBySentence, isMastered, isDue } from '../lib/wrongbook'

interface Props {
  entries: WrongEntry[]
  onBack: () => void
  onStartReview: (entries: WrongEntry[]) => void
}

interface ReviewGroup {
  en: string
  zh: string
  active: WrongEntry[]
}

function minDue(g: ReviewGroup): number {
  return Math.min(...g.active.map((e) => e.dueAt))
}

function badge(e: WrongEntry, now: number): { text: string; cls: string } {
  return isDue(e, now) ? { text: '今日待复习', cls: 'due' } : { text: '学习中', cls: 'soon' }
}

/** 全局「需复习」页：按句子分组展示所有还有未掌握错词的句子，可一键全选后集中复习。 */
export default function ReviewList({ entries, onBack, onStartReview }: Props) {
  const now = Date.now()
  const groups = useMemo<ReviewGroup[]>(
    () =>
      groupBySentence(entries)
        .map((g) => ({ en: g.en, zh: g.zh, active: g.entries.filter((e) => !isMastered(e)) }))
        .filter((g) => g.active.length > 0)
        .sort((a, b) => minDue(a) - minDue(b)),
    [entries],
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const totalWords = groups.reduce((n, g) => n + g.active.length, 0)
  const selectedWords = groups
    .filter((g) => selected.has(g.en))
    .reduce((n, g) => n + g.active.length, 0)

  function toggle(en: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(en)) next.delete(en)
      else next.add(en)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(groups.map((g) => g.en)))
  }
  function clearAll() {
    setSelected(new Set())
  }
  function startReview() {
    const flat = groups
      .filter((g) => selected.has(g.en))
      .flatMap((g) => g.active)
      .sort((a, b) => a.dueAt - b.dueAt)
    onStartReview(flat)
  }

  return (
    <div className="review-list">
      <header className="list-head">
        <div>
          <h1 className="title">需复习</h1>
          <p className="subtitle">跨模板汇总所有还没掌握的句子，选中后集中复习错词。</p>
        </div>
        <div className="list-head-actions">
          <button className="ghost" onClick={onBack}>← 返回</button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat"><span className="stat-num">{groups.length}</span><span className="stat-label">需复习句子</span></div>
        <div className="stat"><span className="stat-num">{totalWords}</span><span className="stat-label">未掌握错词</span></div>
      </div>

      {groups.length === 0 ? (
        <div className="empty"><p>没有需要复习的句子 🎉</p></div>
      ) : (
        <>
          <div className="list-toolbar">
            <div className="list-toolbar-left">
              <button className="ghost" onClick={selectAll}>全选</button>
              <button className="ghost" onClick={clearAll}>清空</button>
            </div>
            <button className="primary" disabled={selected.size === 0} onClick={startReview}>
              {selected.size > 0 ? `开始复习（${selectedWords} 词）` : '开始复习'}
            </button>
          </div>

          <ul className="sentence-list">
            {groups.map((g) => {
              const checked = selected.has(g.en)
              return (
                <li key={g.en}>
                  <div className="sentence-row">
                    <input
                      type="checkbox"
                      className="sentence-check"
                      checked={checked}
                      onChange={() => toggle(g.en)}
                      aria-label={`选择：${g.en}`}
                    />
                    <div className="sentence-card review-card">
                      <span className="sentence-body">
                        <span className="sentence-en">{g.en}</span>
                        <span className="sentence-zh">{g.zh || '（无中文释义）'}</span>
                      </span>
                      <div className="review-words">
                        {g.active.map((e) => {
                          const b = badge(e, now)
                          return (
                            <span key={e.key} className="review-word">
                              <span className="entry-word">{e.word}</span>
                              <span className={`badge ${b.cls}`}>{b.text}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
