import { useState } from 'react'
import type { WrongEntry } from '../lib/wrongbook'
import { GiPencilRuler } from 'react-icons/gi'
import { dueEntries, isMastered } from '../lib/wrongbook'
import type { Stats } from '../lib/stats'
import { dateKey } from '../lib/stats'
import StreakBar from './StreakBar'

interface Props {
  entries: WrongEntry[]
  stats: Stats
  streak: number
  onBack: () => void
  onStartReview: () => void
  onPractice: (entry: WrongEntry) => void
  onClear: () => void
  onClearMastered: () => void
}

export default function WrongbookScreen({ entries, stats, streak, onBack, onStartReview, onPractice, onClear, onClearMastered }: Props) {
  const [tab, setTab] = useState<'review' | 'words'>('review')
  const now = Date.now()
  const today = dateKey(new Date())
  const due = dueEntries(entries, now)
  const masteredCount = entries.filter(isMastered).length
  const activeCount = entries.length - masteredCount
  const reviewedToday = stats.dailyReviews[today] ?? 0
  // 最新进入错题本的排最前；已掌握单独分组沉底。
  const active = entries.filter((e) => !isMastered(e)).sort((a, b) => b.addedAt - a.addedAt)
  const mastered = entries.filter(isMastered).sort((a, b) => b.addedAt - a.addedAt)

  function badge(e: WrongEntry): { text: string; cls: string } {
    if (isMastered(e)) return { text: '已掌握', cls: 'mastered' }
    if (e.dueAt <= now) return { text: '今日待复习', cls: 'due' }
    return { text: '学习中', cls: 'soon' }
  }

  function entryCard(e: WrongEntry) {
    const b = badge(e)
    return (
      <li key={e.key}>
        <button className="entry-card" onClick={() => onPractice(e)}>
          <div className="entry-top">
            <span className="entry-word">{e.word}</span>
            <span className={`badge liquid-glass ${b.cls}`}>{b.text}</span>
          </div>
          <span className="entry-en">{e.en}</span>
          <span className="entry-zh">{e.zh}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="wrongbook">
      <header className="list-head">
        <div>
          <h1 className="title"><GiPencilRuler /> 错题本</h1>
          <StreakBar stats={stats} streak={streak} />
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <div className="tab-row">
        <button className={`tab ${tab === 'review' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('review')}>今日复习</button>
        <button className={`tab ${tab === 'words' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('words')}>我的错词</button>
      </div>

      {tab === 'review' ? (
        <div className="review-tab">
          <div className="stat-row">
            <div className="stat"><span className="stat-num">{due.length}</span><span className="stat-label">待复习</span></div>
            <div className="stat"><span className="stat-num">{activeCount}</span><span className="stat-label">学习中</span></div>
            <div className="stat"><span className="stat-num">{masteredCount}</span><span className="stat-label">已掌握</span></div>
          </div>
          <p className="format-note">今日已复习 {reviewedToday} 词 · 累计复习 {stats.totalReviews} 词</p>
          <div className="review-actions">
            {due.length > 0 ? (
              <button className="primary" onClick={onStartReview}>开始今日复习（{due.length}）</button>
            ) : (
              <p className="format-note">今日复习已完成 🎉 明天再来，或去「我的错词」随时练习。</p>
            )}
          </div>
        </div>
      ) : (
        <div className="words-tab">
          {entries.length === 0 ? (
            <div className="empty"><p>错题本是空的。练习时填错的单词会自动收进来。</p></div>
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <h2 className="group-title">学习中的错词（{active.length}）</h2>
                  <ul className="sentence-list">{active.map(entryCard)}</ul>
                </>
              )}
              {mastered.length > 0 && (
                <>
                  <h2 className="group-title">已掌握（{mastered.length}）</h2>
                  <ul className="sentence-list mastered-list">{mastered.map(entryCard)}</ul>
                  <div className="clear-row">
                    <button className="ghost" onClick={() => { if (window.confirm('清空所有已掌握的错词？')) onClearMastered() }}>清空已掌握</button>
                  </div>
                </>
              )}
              <div className="clear-row">
                <button className="ghost" onClick={() => { if (window.confirm('确定清空错题本？此操作不可恢复。')) onClear() }}>清空错题本</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
