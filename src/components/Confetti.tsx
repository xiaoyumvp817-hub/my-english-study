import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'

interface Props {
  count?: number
  big?: boolean
  onDone?: () => void
}

type PieceStyle = CSSProperties & Record<'--dx' | '--dy' | '--rot' | '--delay', string>

const EMOJI = ['🎉', '⭐', '✨', '🎈', '🌈', '🪅', '🎊', '💫']

interface Piece {
  id: number
  emoji: string
  dx: number
  dy: number
  rot: number
  delay: number
  size: number
}

/** 零依赖撒花：从屏幕中心爆发出 emoji 粒子，动画结束后回调 onDone。 */
export default function Confetti({ count = 40, big = false, onDone }: Props) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const dist = 90 + Math.random() * 240 * (big ? 1.6 : 1)
        return {
          id: i,
          emoji: EMOJI[Math.floor(Math.random() * EMOJI.length)],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.7 + Math.abs(dist) * 0.4,
          rot: Math.round((Math.random() - 0.5) * 720),
          delay: Math.random() * 0.18,
          size: Math.round(18 + Math.random() * 20 * (big ? 1.5 : 1)),
        }
      }),
    [count, big],
  )

  useEffect(() => {
    if (!onDone) return
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => {
        const style: PieceStyle = {
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          '--rot': `${p.rot}deg`,
          '--delay': `${p.delay}s`,
          fontSize: p.size,
        }
        return (
          <span key={p.id} className="confetti-piece" style={style}>
            {p.emoji}
          </span>
        )
      })}
    </div>
  )
}
