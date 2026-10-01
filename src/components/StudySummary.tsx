interface Props {
  today: number
  total: number
  onClose: () => void
}

/** 结束学习时的总结弹框：今日学习数 + 平台累计数，激发学习热情。 */
export default function StudySummary({ today, total, onClose }: Props) {
  return (
    <div className="summary-overlay" role="dialog" aria-modal="true" aria-label="学习总结">
      <div className="summary-modal">
        <h2 className="summary-title">🎉 学习完成！</h2>

        <div className="summary-stats">
          <div className="stat">
            <span className="stat-num">{today}</span>
            <span className="stat-label">今日学习</span>
          </div>
          <div className="stat">
            <span className="stat-num">{total}</span>
            <span className="stat-label">累计学习</span>
          </div>
        </div>

        <p className="summary-motto">坚持就是胜利，明天继续加油！</p>

        <button type="button" className="primary" onClick={onClose}>返回列表</button>
      </div>
    </div>
  )
}
