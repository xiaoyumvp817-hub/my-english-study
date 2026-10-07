import { useEffect, useState } from 'react'
import { formatDuration } from './Timer'
import Confetti from './Confetti'

interface Props {
  today: number
  total: number
  duration?: number
  onClose: () => void
}

/** 数字滚动：从 0 缓动到目标值；prefers-reduced-motion 下直接显示终值。 */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

function Stat({ value, label }: { value: number; label: string }) {
  const n = useCountUp(value)
  return (
    <div className="stat">
      <span className="stat-num">{n}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

/** 结束学习时的总结弹框：今日学习数 + 平台累计数 + 本次用时，激发学习热情。 */
export default function StudySummary({ today, total, duration, onClose }: Props) {
  return (
    <div className="summary-overlay" role="dialog" aria-modal="true" aria-label="学习总结">
      <Confetti big />
      <div className="summary-modal">
        <h2 className="summary-title">🎉 学习完成！</h2>

        <div className="summary-stats">
          <Stat value={today} label="今日学习" />
          <Stat value={total} label="累计学习" />
          {duration !== undefined && (
            <div className="stat">
              <span className="stat-num">{formatDuration(duration)}</span>
              <span className="stat-label">本次用时</span>
            </div>
          )}
        </div>

        <p className="summary-motto">坚持就是胜利，明天继续加油！</p>

        <button type="button" className="primary" onClick={onClose}>返回列表</button>
      </div>
    </div>
  )
}
