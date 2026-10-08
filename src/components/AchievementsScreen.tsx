import { useMemo, useState } from 'react'
import type { Stats } from '../lib/stats'
import { dateKey } from '../lib/stats'
import type { Template } from '../lib/templates'
import type { WrongEntry } from '../lib/wrongbook'
import type { Motivation } from '../lib/motivation'
import {
  completedUnitCount,
  unlockedAchievements,
  ACHIEVEMENTS,
  templateCompleted,
} from '../lib/motivation'
import { normalize } from '../lib/tokenize'

interface Props {
  stats: Stats
  motivation: Motivation
  templates: Template[]
  learned: ReadonlySet<string>
  entries: WrongEntry[]
  onBack: () => void
  onSetGoal: (goal: number) => void
  onUseMakeup: () => void
}

const GOAL_OPTIONS = [3, 5, 10]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function AchievementsScreen({
  stats, motivation, templates, learned, entries, onBack, onSetGoal, onUseMakeup,
}: Props) {
  const today = dateKey(new Date())
  const completedUnits = completedUnitCount(templates, learned)
  const unlocked = useMemo(
    () => new Set(unlockedAchievements({ stats, learned, templates, entries, goal: motivation.goalPerDay, today })),
    [stats, learned, templates, entries, motivation.goalPerDay, today],
  )
  const [month, setMonth] = useState(() => new Date())

  const days = useMemo(() => {
    const y = month.getFullYear()
    const m = month.getMonth()
    const n = new Date(y, m + 1, 0).getDate()
    const out: { d: number; key: string; status: 'met' | 'partial' | 'empty' }[] = []
    for (let d = 1; d <= n; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`
      const c = stats.dailyHistory[key] ?? 0
      const status = c >= motivation.goalPerDay ? 'met' : c > 0 ? 'partial' : 'empty'
      out.push({ d, key, status })
    }
    return out
  }, [month, stats.dailyHistory, motivation.goalPerDay])

  function shiftMonth(delta: number) {
    setMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))
  }

  return (
    <div className="achievements">
      <header className="list-head">
        <div>
          <h1 className="title">🏆 成就</h1>
          <p className="subtitle">收集图鉴 · 点亮徽章 · 坚持打卡</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <section className="ach-section">
        <h2>打卡日历</h2>
        <div className="calendar-nav">
          <button className="ghost" onClick={() => shiftMonth(-1)}>‹</button>
          <span>{month.getFullYear()} 年 {month.getMonth() + 1} 月</span>
          <button className="ghost" onClick={() => shiftMonth(1)}>›</button>
        </div>
        <div className="calendar-grid">
          {days.map((d) => (
            <span key={d.key} className={`cal-day cal-${d.status}`} title={d.key}>{d.d}</span>
          ))}
        </div>
        <div className="calendar-legend">
          <span className="cal-day cal-met">✓</span> 达标
          <span className="cal-day cal-partial">◐</span> 学过
          <span className="cal-day cal-empty">·</span> 未学
        </div>
      </section>

      <section className="ach-section">
        <h2>单元图鉴（{completedUnits} / {templates.length}）</h2>
        {templates.length === 0 ? (
          <p className="empty">还没有单元，先去上传吧。</p>
        ) : (
          <div className="unit-grid">
            {templates.map((t) => {
              const done = templateCompleted(t, learned)
              return (
                <div key={t.id} className={`unit-badge ${done ? 'is-done' : ''}`}>
                  <span className="unit-emoji">{done ? '🏅' : '🔒'}</span>
                  <span className="unit-name">{t.name}</span>
                  <span className="unit-progress">
                    {t.items.filter((it) => learned.has(normalize(it.en))).length} / {t.items.length}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="ach-section">
        <h2>成就徽章</h2>
        <div className="medal-wall">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id)
            return (
              <div key={a.id} className={`medal ${isUnlocked ? 'is-unlocked' : 'is-locked'}`} title={a.desc}>
                <span className="medal-emoji">{isUnlocked ? a.emoji : '🔒'}</span>
                <span className="medal-name">{a.name}</span>
                <span className="medal-desc">{a.desc}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="ach-section">
        <h2>设置</h2>
        <div className="goal-setting">
          <span>每日目标</span>
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g}
              className={`ghost ${motivation.goalPerDay === g ? 'is-active' : ''}`}
              onClick={() => onSetGoal(g)}
            >
              {g} 句
            </button>
          ))}
        </div>
        {motivation.makeupCards > 0 && (
          <button className="primary" onClick={onUseMakeup}>
            使用补签卡（×{motivation.makeupCards}）
          </button>
        )}
      </section>
    </div>
  )
}
