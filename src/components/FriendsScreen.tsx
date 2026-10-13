import { useEffect, useState } from 'react'
import type { CloudApi, Profile } from '../lib/supabase'
import { GiThreeFriends } from 'react-icons/gi'
import { isValidFriendCode, normalizeFriendCode } from '../lib/friendCode'
import { friendLeaderboard, sortLeaderboard, rankOf } from '../lib/leaderboard'
import { challengeOpponentId, challengeOutcomeFor } from '../lib/challenge'
import type { Challenge } from '../lib/challenge'

interface Props {
  api: CloudApi
  userId: string
  myProfile: Profile
  onBack: () => void
  onAcceptChallenge: (c: Challenge) => void
  inviteCode?: string | null
}

export default function FriendsScreen({ api, userId, myProfile, onBack, onAcceptChallenge, inviteCode }: Props) {
  const [tab, setTab] = useState<'friends' | 'challenges' | 'leaderboard'>('friends')
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [friends, setFriends] = useState<Profile[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [global, setGlobal] = useState<Profile[]>([])
  const [code, setCode] = useState(inviteCode ?? '')
  const [msg, setMsg] = useState('')
  const [leaderTab, setLeaderTab] = useState<'friends' | 'global'>('friends')

  useEffect(() => {
    api.listFriendIds(userId).then(async (ids) => { setFriendIds(ids); setFriends(await api.listProfiles(ids)) }).catch(() => {})
    api.listChallengesFor(userId).then(setChallenges).catch(() => {})
    api.globalLeaderboard(50).then(setGlobal).catch(() => {})
  }, [api, userId])

  const pendingIncoming = challenges.filter((c) => c.challengeeId === userId && c.status === 'pending')
  const pendingOutgoing = challenges.filter((c) => c.challengerId === userId && c.status === 'pending')
  const completed = challenges.filter((c) => c.status === 'completed')
  const nameOf = (id: string) => friends.find((f) => f.userId === id)?.displayName ?? '好友'

  async function addFriend() {
    setMsg('')
    if (!isValidFriendCode(code)) { setMsg('好友码应为 8 位'); return }
    try {
      const p = await api.getProfileByCode(normalizeFriendCode(code))
      if (!p) { setMsg('找不到这个好友码'); return }
      if (p.userId === userId) { setMsg('这是你自己的好友码'); return }
      await api.addFriendship(userId, p.userId)
      setCode('')
      setMsg(`已添加好友 ${p.displayName} 🎉`)
      setFriendIds((prev) => [...new Set([...prev, p.userId])])
      setFriends((prev) => [...prev, p])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '添加失败')
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(myProfile.friendCode)
    setMsg('好友码已复制')
  }

  return (
    <div className="friends">
      <header className="list-head">
        <div>
          <h1 className="title"><GiThreeFriends /> 好友</h1>
          <p className="subtitle">和好朋友一起学、比一比</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <div className="tab-row">
        <button className={`tab ${tab === 'friends' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('friends')}>好友</button>
        <button className={`tab ${tab === 'challenges' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('challenges')}>挑战 {pendingIncoming.length > 0 && `(${pendingIncoming.length})`}</button>
        <button className={`tab ${tab === 'leaderboard' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('leaderboard')}>排行榜</button>
      </div>

      {tab === 'friends' && (
        <section className="friends-tab">
          <div className="friend-code-card liquid-glass">
            <span className="friend-code-label">我的好友码</span>
            <span className="friend-code-value">{myProfile.friendCode}</span>
            <button className="ghost" onClick={copyCode}>复制</button>
          </div>
          <div className="add-friend">
            <input placeholder="输入好友码" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary" onClick={addFriend}>添加好友</button>
          </div>
          {msg && <p className="format-note">{msg}</p>}
          <ul className="sentence-list">
            {friends.map((f) => (
              <li key={f.userId} className="friend-row">
                <span className="friend-name">{f.displayName}</span>
                <span className="friend-stat">已背 {f.totalLearned} 句</span>
              </li>
            ))}
            {friends.length === 0 && <p className="empty">还没有好友，先输入好友码添加吧。</p>}
          </ul>
        </section>
      )}

      {tab === 'challenges' && (
        <section className="challenges-tab">
          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && completed.length === 0 && (
            <p className="empty">还没有挑战记录，去「好友」页挑战好友吧。</p>
          )}
          {pendingIncoming.map((c) => (
            <button key={c.id} className="entry-card" onClick={() => onAcceptChallenge(c)}>
              <span className="entry-word">⚔️ 应战 {nameOf(c.challengerId)}</span>
              <span className="entry-zh">对手已答对 {c.challengerScore} 个，{c.words.length} 个单词，敢来吗？</span>
            </button>
          ))}
          {pendingOutgoing.map((c) => (
            <div key={c.id} className="entry-card">
              <span className="entry-word">📤 已挑战 {nameOf(c.challengeeId)}</span>
              <span className="entry-zh">等待应战（你答对 {c.challengerScore} 个）</span>
            </div>
          ))}
          {completed.map((c) => {
            const outcome = challengeOutcomeFor(c, userId)
            const label = outcome === 'win' ? '你赢了 🎉' : outcome === 'loss' ? '你输了' : '平局 🤝'
            const myScore = c.challengerId === userId ? c.challengerScore : (c.challengeeScore ?? 0)
            const oppScore = c.challengerId === userId ? (c.challengeeScore ?? 0) : c.challengerScore
            return (
              <div key={c.id} className="entry-card">
                <span className="entry-word">{label}（vs {nameOf(challengeOpponentId(c, userId))}）</span>
                <span className="entry-zh">比分 {myScore} : {oppScore}</span>
              </div>
            )
          })}
        </section>
      )}

      {tab === 'leaderboard' && (
        <section className="leaderboard-tab">
          <div className="tab-row">
            <button className={`tab ${leaderTab === 'friends' ? 'is-active liquid-glass' : ''}`} onClick={() => setLeaderTab('friends')}>好友榜</button>
            <button className={`tab ${leaderTab === 'global' ? 'is-active liquid-glass' : ''}`} onClick={() => setLeaderTab('global')}>全球榜</button>
          </div>
          <ol className="leaderboard-list">
            {(leaderTab === 'friends' ? friendLeaderboard(myProfile, friends) : sortLeaderboard(global.map((p) => ({ userId: p.userId, displayName: p.displayName, totalLearned: p.totalLearned })))).map((e, i) => (
              <li key={e.userId} className={`leaderboard-row ${e.userId === userId ? 'is-me' : ''}`}>
                <span className="rank">{i + 1}</span>
                <span className="name">{e.displayName}{e.userId === userId ? '（我）' : ''}</span>
                <span className="score">{e.totalLearned} 句</span>
              </li>
            ))}
          </ol>
          {leaderTab === 'friends' && friendIds.length > 0 && (
            <p className="format-note">我的名次：第 {rankOf(friendLeaderboard(myProfile, friends), userId)} 名</p>
          )}
        </section>
      )}
    </div>
  )
}
