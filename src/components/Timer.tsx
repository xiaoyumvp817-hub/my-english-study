import { useEffect, useState } from 'react'

interface Props {
  startTime: number
}

/** 把毫秒格式化为 m:ss。 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 从 startTime 起每秒钟刷新的计时器。 */
export default function Timer({ startTime }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startTime])
  return <span className="timer">⏱ {formatDuration(now - startTime)}</span>
}
