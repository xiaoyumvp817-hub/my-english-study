import { useRef, useState } from 'react'
import type { CloudApi, Profile } from '../lib/supabase'
import type { Challenge } from '../lib/challenge'
import { snapshotWords } from '../lib/challenge'
import type { TemplateItem } from '../types'
import GameScreen from './GameScreen'

interface Props {
  api: CloudApi
  userId: string
  friend: Profile
  items: TemplateItem[]
  onDone: () => void
}

export default function ChallengeCreateScreen({ api, userId, friend, items, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const startRef = useRef(Date.now())
  const scoreRef = useRef(0)
  const finishedRef = useRef(false)

  async function finish(finalScore: number) {
    if (finishedRef.current) return
    finishedRef.current = true
    const challenge: Challenge = {
      id: crypto.randomUUID(),
      challengerId: userId,
      challengeeId: friend.userId,
      words: snapshotWords(items),
      challengerScore: finalScore,
      challengerDurationMs: Date.now() - startRef.current,
      challengeeScore: null,
      challengeeDurationMs: null,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null,
    }
    try {
      await api.createChallenge(challenge)
      setDone(true)
    } catch {
      finishedRef.current = false
      setError('挑战发起失败，请重试')
    }
  }

  // 一句全对 +1（分数 = 答对句数，与应战侧一致）。
  function handleCompleted() {
    scoreRef.current += 1
  }
  function handleNext() {
    if (index === items.length - 1) finish(scoreRef.current)
    else setIndex(index + 1)
  }

  if (done) {
    return (
      <div className="challenge">
        <div className="quiz-card">
          <h2 className="title">挑战已发出 🎉</h2>
          <p className="result">等 {friend.displayName} 来应战</p>
          <p className="format-note">你答对 {scoreRef.current} / {items.length} 句</p>
          <button className="primary" onClick={onDone}>完成</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="challenge-error" role="alert">
          <p className="result fail">{error}</p>
          <button className="ghost" onClick={() => finish(scoreRef.current)}>重试</button>
        </div>
      )}
      <GameScreen
        key={index}
        item={items[index]}
        index={index}
        total={items.length}
        startTime={startRef.current}
        onNext={handleNext}
        onEnd={() => finish(scoreRef.current)}
        onWrongWords={() => {}}
        onCompleted={handleCompleted}
      />
    </>
  )
}
