import { useState } from 'react'
import type { FormEvent } from 'react'
import { GiPerson } from 'react-icons/gi'
import type { CloudApi } from '../lib/supabase'
import { displayNameFromEmail } from '../lib/supabase'

interface Props {
  api: CloudApi
  onAuthed: (userId: string) => void
  onBack: () => void
}

export default function AuthScreen({ api, onAuthed, onBack }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const userId = mode === 'login' ? await api.signIn(email, password) : await api.signUp(email, password)
      await api.ensureProfile(userId, displayNameFromEmail(email))
      onAuthed(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <header className="list-head">
        <div>
          <h1 className="title"><GiPerson /> 登录 / 注册</h1>
          <p className="subtitle">登录后可与好友 PK、上排行榜</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>邮箱</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
        </label>
        {error && <p className="result fail" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? '…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </form>
    </div>
  )
}
