import type { Stats } from '../lib/stats'
import { xpProgress } from '../lib/stats'

interface Props {
  stats: Stats
  streak: number
}

export default function StreakBar({ stats, streak }: Props) {
  const { level, current, needed } = xpProgress(stats.xp)
  const pct = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0

  return (
    <div className="streak-bar">
      <span className="streak">🔥 {streak} 天</span>
      <span className="level liquid-glass">Lv.{level}</span>
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="xp-text">{current}/{needed} XP</span>
    </div>
  )
}
