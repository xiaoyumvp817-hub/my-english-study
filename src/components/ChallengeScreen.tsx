import { useRef, useState } from 'react'
import type { Challenge } from '../lib/challenge'
import { challengeWinner } from '../lib/challenge'
import type { CloudApi } from '../lib/supabase'
import type { TemplateItem } from '../types'
import GameScreen from './GameScreen'

interface Props {
  api: CloudApi
  challenge: Challenge
  onDone: () => void
}

export default function ChallengeScreen({ api, challenge, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const startRef = useRef(Date.now())
  const scoreRef = useRef(0)
  const finishedRef = useRef(false)
  const items: TemplateItem[] = challenge.words.map((w, i) => ({ id: `pk-${i}`, en: w.en, zh: w.zh }))

  async function finish(finalScore: number) {
    if (finishedRef.current) return
    finishedRef.current = true
    setScore(finalScore)
    try {
      await api.setChallengeResult(challenge.id, finalScore, Date.now() - startRef.current)
      setDone(true)
    } catch {
      finishedRef.current = false
      setError('结果提交失败，请重试')
    }
  }

  // 一句全对 +1（分数 = 答对句数，对齐 spec §2）。
  function handleCompleted() {
    scoreRef.current += 1
  }

  function handleNext() {
    if (index === items.length - 1) finish(scoreRef.current)
    else setIndex(index + 1)
  }

  if (done) {
    const winner = challengeWinner({ ...challenge, challengeeScore: score, status: 'completed' })
    const label = winner === 'challenger' ? '对方胜' : winner === 'challengee' ? '你赢了 🎉' : '平局 🤝'
    return (
      <div className="challenge">
        <div className="quiz-card">
          <h2 className="title">对战结果</h2>
          <p className="result">{label}</p>
          <p className="format-note">对方 {challenge.challengerScore} 分 · 你 {score} 分</p>
          <button className="primary" onClick={onDone}>返回</button>
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
