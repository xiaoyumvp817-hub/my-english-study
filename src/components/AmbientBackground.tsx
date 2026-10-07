import { useMemo } from 'react'
import type { CSSProperties } from 'react'

const SHAPES = ['⭐', '✨', '🌟', '💛', '🎈']

interface Shape {
  id: number
  left: number
  size: number
  dur: number
  delay: number
  emoji: string
}

/** 全局氛围背景：噪点纹理 + 缓慢上浮的漂浮形状。固定定位、不挡点击。 */
export default function AmbientBackground() {
  const shapes = useMemo<Shape[]>(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: Math.round(Math.random() * 96),
        size: Math.round(16 + Math.random() * 24),
        dur: Math.round(16 + Math.random() * 18),
        delay: -Math.round(Math.random() * 24),
        emoji: SHAPES[i % SHAPES.length],
      })),
    [],
  )

  return (
    <div className="ambient" aria-hidden="true">
      <div className="grain-overlay" />
      {shapes.map((s) => {
        const style: CSSProperties = {
          left: `${s.left}%`,
          fontSize: s.size,
          animationDuration: `${s.dur}s`,
          animationDelay: `${s.delay}s`,
        }
        return (
          <span key={s.id} className="float-shape" style={style}>
            {s.emoji}
          </span>
        )
      })}
    </div>
  )
}
