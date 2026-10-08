interface Props {
  todayCount: number
  goal: number
  streak: number
  completedUnits: number
  totalUnits: number
  makeupCards: number
  onOpen: () => void
}

export default function TodayCard({ todayCount, goal, streak, completedUnits, totalUnits, makeupCards, onOpen }: Props) {
  const pct = goal > 0 ? Math.min(100, Math.round((todayCount / goal) * 100)) : 0
  return (
    <button type="button" className="today-card" onClick={onOpen}>
      <div className="today-main">
        <span className="today-goal">今日 {todayCount} / {goal} 句</span>
        <span className="today-streak">🔥 连续 {streak} 天</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="today-meta">
        <span>图鉴 {completedUnits} / {totalUnits}</span>
        {makeupCards > 0 && <span>补签卡 ×{makeupCards}</span>}
      </div>
    </button>
  )
}
