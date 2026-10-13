import { useEffect, useState } from 'react'
import type { CloudApi, Profile } from '../lib/supabase'
import { GiCrossedSwords } from 'react-icons/gi'

interface Props {
  api: CloudApi
  userId: string
  unitName: string
  onBack: () => void
  onPick: (friend: Profile) => void
}

export default function ChallengeFriendScreen({ api, userId, unitName, onBack, onPick }: Props) {
  const [friends, setFriends] = useState<Profile[]>([])

  useEffect(() => {
    api.listFriendIds(userId).then((ids) => api.listProfiles(ids)).then(setFriends).catch(() => {})
  }, [api, userId])

  return (
    <div className="challenge-friend">
      <header className="list-head">
        <div>
          <h1 className="title"><GiCrossedSwords /> 挑战好友</h1>
          <p className="subtitle">和好友比一比「{unitName}」</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <ul className="sentence-list">
        {friends.map((f) => (
          <li key={f.userId}>
            <button className="entry-card" onClick={() => onPick(f)}>
              <span className="entry-word">{f.displayName}</span>
              <span className="entry-zh">已背 {f.totalLearned} 句 · 点击发起挑战 ⚔️</span>
            </button>
          </li>
        ))}
        {friends.length === 0 && <p className="empty">还没有好友，先去「好友」页添加吧。</p>}
      </ul>
    </div>
  )
}
