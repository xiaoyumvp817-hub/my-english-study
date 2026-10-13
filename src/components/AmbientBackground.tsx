import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

const SHAPES = ['⭐', '✨', '🌟', '💛', '🎈']

interface Shape {
  id: number
  left: number
  size: number
  dur: number
  delay: number
  emoji: string
}

function makeShapes(n: number, seed: number): Shape[] {
  return Array.from({ length: n }, (_, i) => ({
    id: seed * 100 + i,
    left: Math.round(Math.random() * 96),
    size: Math.round(16 + Math.random() * 24),
    dur: Math.round(16 + Math.random() * 18),
    delay: -Math.round(Math.random() * 24),
    emoji: SHAPES[(seed + i) % SHAPES.length],
  }))
}

function shapeStyle(s: Shape): CSSProperties {
  return {
    left: `${s.left}%`,
    fontSize: s.size,
    animationDuration: `${s.dur}s`,
    animationDelay: `${s.delay}s`,
  }
}

/** 全局氛围背景：噪点 + 极光渐变 + 双层鼠标视差漂浮形状（3D 景深）。固定定位、不挡点击。 */
export default function AmbientBackground() {
  const farShapes = useMemo(() => makeShapes(6, 0), [])
  const nearShapes = useMemo(() => makeShapes(5, 1), [])

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 40, damping: 18 })
  const sy = useSpring(my, { stiffness: 40, damping: 18 })

  // 远景层慢、近景层快 → 视差景深
  const farX = useTransform(sx, (v) => v * -18)
  const farY = useTransform(sy, (v) => v * -10)
  const nearX = useTransform(sx, (v) => v * 30)
  const nearY = useTransform(sy, (v) => v * 18)
  const glowX = useTransform(sx, (v) => v * 70)
  const glowY = useTransform(sy, (v) => v * 46)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2)
      my.set((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [mx, my])

  return (
    <div className="ambient" aria-hidden="true">
      <div className="grain-overlay" />
      <div className="ambient-aurora" />
      <motion.div className="ambient-glow" style={{ x: glowX, y: glowY }} />
      <motion.div className="ambient-layer ambient-far" style={{ x: farX, y: farY }}>
        {farShapes.map((s) => (
          <span key={s.id} className="float-shape" style={shapeStyle(s)}>
            {s.emoji}
          </span>
        ))}
      </motion.div>
      <motion.div className="ambient-layer ambient-near" style={{ x: nearX, y: nearY }}>
        {nearShapes.map((s) => (
          <span key={s.id} className="float-shape" style={shapeStyle(s)}>
            {s.emoji}
          </span>
        ))}
      </motion.div>
    </div>
  )
}
