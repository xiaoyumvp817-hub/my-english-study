import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParseResult, TemplateItem } from './types'
import TemplateLibrary from './components/TemplateLibrary'
import NamePrompt from './components/NamePrompt'
import SentenceList from './components/SentenceList'
import SelectionReview from './components/SelectionReview'
import GameScreen from './components/GameScreen'
import WrongbookScreen from './components/WrongbookScreen'
import ReviewSession from './components/ReviewSession'
import StudySummary from './components/StudySummary'
import Confetti from './components/Confetti'
import AmbientBackground from './components/AmbientBackground'
import TodayCard from './components/TodayCard'
import AchievementsScreen from './components/AchievementsScreen'
import type { WrongWord } from './components/SentenceQuiz'
import { loadTemplates, saveTemplates, makeTemplate } from './lib/templates'
import type { Template, TemplateSort } from './lib/templates'
import { loadEntries, saveEntries, recordWrong, reviewEntry, dueEntries } from './lib/wrongbook'
import type { WrongEntry } from './lib/wrongbook'
import { loadStats, saveStats, recordStudy, applyReviewAnswer, dateKey, levelForXp, backfillDay } from './lib/stats'
import type { Stats } from './lib/stats'
import { loadMotivation, saveMotivation, awardMakeupCards, useMakeupCard, goalStreak, completedUnitCount, unlockedAchievements, unseenAchievements, ACHIEVEMENTS } from './lib/motivation'
import type { Motivation } from './lib/motivation'
import { loadLearned, saveLearned, commitLearned } from './lib/learned'
import type { QuizType } from './lib/quiz'
import { xpForAnswer } from './lib/quiz'
import { createSupabaseClient, createCloudApi } from './lib/supabase'
import type { CloudApi, Profile } from './lib/supabase'
import type { Challenge } from './lib/challenge'
import { localState, pullAll, importLocalToCloud } from './lib/dataStore'
import type { SyncState } from './lib/dataStore'
import AuthScreen from './components/AuthScreen'
import FriendsScreen from './components/FriendsScreen'
import ChallengeScreen from './components/ChallengeScreen'
import ChallengeFriendScreen from './components/ChallengeFriendScreen'
import ChallengeCreateScreen from './components/ChallengeCreateScreen'
import { GiPerson, GiThreeFriends } from 'react-icons/gi'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import './App.css'

type View = 'library' | 'name' | 'list' | 'play' | 'wrongbook' | 'review' | 'study' | 'achievements' | 'auth' | 'friends' | 'challenge' | 'challengeFriend' | 'challengeCreate'

const supabaseClient = createSupabaseClient()
const api: CloudApi | null = supabaseClient ? createCloudApi(supabaseClient) : null

type StudyPhase = 'select' | 'type'
interface StudySession {
  items: TemplateItem[]
  index: number
  phase: StudyPhase
}

function App() {
  const reduceMotion = useReducedMotion()
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates())
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ result: ParseResult; fileName: string } | null>(null)
  const [sort, setSort] = useState<TemplateSort>('time')
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [view, setView] = useState<View>('library')
  const [entries, setEntries] = useState<WrongEntry[]>(() => loadEntries())
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [reviewEntries, setReviewEntries] = useState<WrongEntry[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [learned, setLearned] = useState<string[]>(() => loadLearned())
  const [session, setSession] = useState<StudySession | null>(null)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [lastDuration, setLastDuration] = useState<number | null>(null)
  const [levelUp, setLevelUp] = useState(false)
  const prevLevelRef = useRef(levelForXp(stats.xp))
  const [motivation, setMotivation] = useState<Motivation>(() => loadMotivation())
  const [newAch, setNewAch] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [needsImport, setNeedsImport] = useState(false)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [challengeFriend, setChallengeFriend] = useState<Profile | null>(null)
  const [challengeItems, setChallengeItems] = useState<TemplateItem[] | null>(null)
  const localSnapshotRef = useRef<SyncState | null>(null)

  useEffect(() => { saveTemplates(templates) }, [templates])
  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { saveStats(stats) }, [stats])
  useEffect(() => { saveLearned(learned) }, [learned])
  useEffect(() => { saveMotivation(motivation) }, [motivation])

  useEffect(() => {
    const level = levelForXp(stats.xp)
    if (level > prevLevelRef.current) {
      prevLevelRef.current = level
      setLevelUp(true)
    }
  }, [stats.xp])

  const today = dateKey(new Date())
  const learnedSet = useMemo(() => new Set(learned), [learned])
  const streak = goalStreak(stats.dailyHistory, motivation.goalPerDay, today)
  const completedUnits = completedUnitCount(templates, learnedSet)
  const unlocked = useMemo(
    () => unlockedAchievements({ stats, learned: learnedSet, templates, entries, goal: motivation.goalPerDay, today }),
    [stats, learnedSet, templates, entries, motivation.goalPerDay, today],
  )

  useEffect(() => {
    setMotivation((m) => awardMakeupCards(m, stats.dailyHistory, motivation.goalPerDay, today))
  }, [stats, motivation.goalPerDay, today])

  useEffect(() => {
    const fresh = unseenAchievements(unlocked, motivation.seenAchievements)
    if (fresh.length > 0) setNewAch((prev) => [...new Set([...prev, ...fresh])])
  }, [unlocked, motivation.seenAchievements])

  function handleParsed(result: ParseResult, fileName: string) {
    setPendingUpload({ result, fileName })
    setView('name')
  }
  function handleNameConfirm(name: string) {
    if (!pendingUpload) return
    const template = makeTemplate(name, pendingUpload.result.items, pendingUpload.result.warnings, Date.now())
    setTemplates((prev) => [...prev, template])
    setCurrentTemplate(template)
    setPendingUpload(null)
    setCurrentIndex(null)
    setView('list')
  }
  function handleNameCancel() { setPendingUpload(null); setView('library') }
  function handleOpenTemplate(template: Template) { setCurrentTemplate(template); setCurrentIndex(null); setView('list') }
  function handleRename(id: string, name: string) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)))
    setCurrentTemplate((prev) => (prev && prev.id === id ? { ...prev, name } : prev))
  }
  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setCurrentTemplate((prev) => (prev && prev.id === id ? null : prev))
  }
  function handleSelect(index: number) { setCurrentIndex(index); setView('play'); setLastDuration(null) }
  function goList() { setCurrentIndex(null); setView('list') }
  function goLibrary() { setCurrentIndex(null); setView('library') }
  function handleSentenceCompleted() {
    if (currentIndex === null || !currentTemplate) return
    const item = currentTemplate.items[currentIndex]
    if (!item) return
    const now = Date.now()
    const { learned: next, added } = commitLearned(learned, item.en)
    if (!added) return
    setLearned(next)
    setStats((prev) => recordStudy(prev, dateKey(new Date(now)), 1))
  }
  function handleSentenceComplete() {
    if (currentIndex === null || !currentTemplate) return
    if (currentIndex < currentTemplate.items.length - 1) setCurrentIndex(currentIndex + 1)
    else {
      goList()
      setShowSummary(true)
    }
  }
  function handleEndSession() {
    goList()
    setShowSummary(true)
  }
  function handleWrongWords(wrongs: WrongWord[]) {
    if (currentIndex === null || !currentTemplate) return
    const item = currentTemplate.items[currentIndex]
    if (!item) return
    const now = Date.now()
    setEntries((prev) => wrongs.reduce((acc, w) => recordWrong(acc, { en: item.en, zh: item.zh, word: w.word, wordIndex: w.wordIndex }, now), prev))
  }
  function handleStartReview() {
    setReviewEntries(dueEntries(entries, Date.now()))
    setView('review')
  }
  function handlePractice(entry: WrongEntry) {
    setReviewEntries([entry])
    setView('review')
  }
  function handleAnswer(key: string, type: QuizType, q: number): number {
    const now = Date.now()
    const target = entries.find((e) => e.key === key)
    if (!target) return 0
    const xp = xpForAnswer(type, q)
    setEntries((prev) => prev.map((e) => (e.key === key ? reviewEntry(e, q, now) : e)))
    setStats((prev) => applyReviewAnswer(prev, xp, q >= 3, dateKey(new Date(now))))
    return xp
  }
  function handleClear() { setEntries([]) }

  function handleSetGoal(goal: number) {
    setMotivation((m) => ({ ...m, goalPerDay: goal }))
  }
  function handleUseMakeup() {
    const res = useMakeupCard(motivation, stats.dailyHistory, motivation.goalPerDay, today)
    if (!res) return
    setMotivation(res.motivation)
    setStats((prev) => backfillDay(prev, res.day, motivation.goalPerDay))
  }
  function handleMarkSeen(ids: string[]) {
    setMotivation((m) => ({ ...m, seenAchievements: [...m.seenAchievements, ...ids] }))
    setNewAch([])
  }

  async function hydrate(id: string) {
    if (!api) return
    setSyncing(true)
    try {
      const hasLocal = templates.length > 0 || entries.length > 0 || stats.totalLearned > 0 || learned.length > 0
      const s = await pullAll(api, id)
      setTemplates(s.templates)
      setEntries(s.entries)
      setStats(s.stats)
      setLearned(s.learned)
      setMotivation(s.motivation)
      const cloudEmpty = s.templates.length === 0 && s.entries.length === 0 && s.stats.totalLearned === 0 && s.learned.length === 0
      setNeedsImport(hasLocal && cloudEmpty)
      const p = await api.getMyProfile(id)
      if (p) setMyProfile(p)
    } finally {
      setSyncing(false)
    }
  }

  async function handleAuthed(id: string) {
    // 先快照本地数据，再 hydrate（hydrate 会把空云端写回 state/localStorage）
    localSnapshotRef.current = localState()
    setUserId(id)
    setView(inviteCode ? 'friends' : 'library')
    await hydrate(id)
  }

  async function handleSignOut() {
    if (!api) return
    await api.signOut()
    setUserId(null)
    setMyProfile(null)
    setActiveChallenge(null)
    setInviteCode(null)
    setChallengeFriend(null)
    setChallengeItems(null)
    setNeedsImport(false)
    const local = localState()
    setTemplates(local.templates)
    setEntries(local.entries)
    setStats(local.stats)
    setLearned(local.learned)
    setMotivation(local.motivation)
    setView('library')
  }

  async function handleImportLocal() {
    if (!api || !userId) return
    setSyncing(true)
    try {
      await importLocalToCloud(api, userId, localSnapshotRef.current ?? localState())
      await hydrate(userId)
    } finally {
      setSyncing(false)
    }
  }

  async function handleOpenFriends() {
    if (!api || !userId) { setView('auth'); return }
    setView('friends')
    if (!myProfile) {
      try {
        let p = await api.getMyProfile(userId)
        if (!p) p = await api.ensureProfile(userId, '')
        if (p) setMyProfile(p)
      } catch {
        // 网络失败：下方「加载档案」态提供返回按钮退出
      }
    }
  }
  function handleAcceptChallenge(c: Challenge) {
    setActiveChallenge(c)
    setView('challenge')
  }
  function handleChallengeDone() {
    setActiveChallenge(null)
    setView('friends')
  }
  function handleChallengeFriends() {
    if (!api || !currentTemplate) return
    if (!userId) { setView('auth'); return }
    setChallengeItems(currentTemplate.items)
    setView('challengeFriend')
  }
  function handleChallengePick(friend: Profile) {
    setChallengeFriend(friend)
    setView('challengeCreate')
  }
  function handleChallengeCreated() {
    setChallengeFriend(null)
    setChallengeItems(null)
    setView('friends')
  }

  useEffect(() => {
    if (!api) return
    api.getUserId().then((id) => {
      if (id) {
        localSnapshotRef.current = localState()
        setUserId(id)
        hydrate(id)
      }
    })
    // 仅会话恢复时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onHash() {
      const m = window.location.hash.match(/^#\/f\/([A-Za-z0-9]+)/)
      if (!m) return
      setInviteCode(m[1])
      setView('friends')
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function handleStartStudy(items: TemplateItem[]) {
    setSession({ items, index: 0, phase: 'select' })
    setSessionStart(Date.now())
    setLastDuration(null)
    setView('study')
  }
  function handleSelectWrong(item: TemplateItem) {
    const now = Date.now()
    setEntries((prev) => recordWrong(prev, { en: item.en, zh: item.zh, word: item.en, wordIndex: 0 }, now))
  }
  function handleSelectNext() {
    setSession((s) => (s ? { ...s, index: s.index + 1 } : s))
  }
  function handleSelectFinish() {
    setSession((s) => (s ? { ...s, phase: 'type', index: 0 } : s))
  }
  function handleExitStudy() {
    setSession(null)
    setSessionStart(null)
    goList()
  }
  function handleSessionNext() {
    if (!session) return
    if (session.index < session.items.length - 1) {
      setSession({ ...session, index: session.index + 1 })
    } else {
      setLastDuration(sessionStart === null ? null : Date.now() - sessionStart)
      setSession(null)
      setSessionStart(null)
      goList()
      setShowSummary(true)
    }
  }
  function handleSessionWrongWords(wrongs: WrongWord[]) {
    if (!session) return
    const item = session.items[session.index]
    if (!item) return
    const now = Date.now()
    setEntries((prev) => wrongs.reduce((acc, w) => recordWrong(acc, { en: item.en, zh: item.zh, word: w.word, wordIndex: w.wordIndex }, now), prev))
  }
  function handleSessionCompleted() {
    if (!session) return
    const item = session.items[session.index]
    if (!item) return
    const now = Date.now()
    const { learned: next, added } = commitLearned(learned, item.en)
    if (!added) return
    setLearned(next)
    setStats((prev) => recordStudy(prev, dateKey(new Date(now)), 1))
  }

  let screen
  if (syncing) {
    screen = <div className="sync-loading"><p>☁️ 正在同步…</p></div>
  } else if (view === 'play' && currentIndex !== null && currentTemplate) {
    screen = (
      <GameScreen key={currentIndex} item={currentTemplate.items[currentIndex]} index={currentIndex}
        total={currentTemplate.items.length} onNext={handleSentenceComplete} onEnd={handleEndSession} onWrongWords={handleWrongWords} onCompleted={handleSentenceCompleted} />
    )
  } else if (view === 'study' && session) {
    if (session.phase === 'select') {
      screen = (
        <SelectionReview
          key={session.index}
          items={session.items}
          index={session.index}
          total={session.items.length}
          startTime={sessionStart ?? undefined}
          onWrong={handleSelectWrong}
          onNext={handleSelectNext}
          onFinish={handleSelectFinish}
          onExit={handleExitStudy}
        />
      )
    } else {
      screen = (
        <GameScreen key={session.index} item={session.items[session.index]} index={session.index}
          total={session.items.length} startTime={sessionStart ?? undefined} onNext={handleSessionNext} onEnd={handleExitStudy} onWrongWords={handleSessionWrongWords} onCompleted={handleSessionCompleted} />
      )
    }
  } else if (view === 'name' && pendingUpload) {
    screen = <NamePrompt fileName={pendingUpload.fileName} count={pendingUpload.result.items.length} onConfirm={handleNameConfirm} onCancel={handleNameCancel} />
  } else if (view === 'list' && currentTemplate) {
    screen = <SentenceList templateName={currentTemplate.name} items={currentTemplate.items} warnings={currentTemplate.warnings} learned={new Set(learned)} entries={entries} onSelect={handleSelect} onStartStudy={handleStartStudy} onBack={goLibrary} onChallenge={api ? handleChallengeFriends : undefined} />
  } else if (view === 'wrongbook') {
    screen = <WrongbookScreen entries={entries} stats={stats} streak={streak} onBack={goLibrary} onStartReview={handleStartReview} onPractice={handlePractice} onClear={handleClear} />
  } else if (view === 'review') {
    screen = <ReviewSession entries={reviewEntries} onAnswer={handleAnswer} onBack={() => setView('wrongbook')} />
  } else if (view === 'achievements') {
    screen = (
      <AchievementsScreen
        stats={stats}
        motivation={motivation}
        templates={templates}
        learned={learnedSet}
        entries={entries}
        onBack={goLibrary}
        onSetGoal={handleSetGoal}
        onUseMakeup={handleUseMakeup}
      />
    )
  } else if (view === 'auth') {
    screen = api ? (
      <AuthScreen api={api} onAuthed={handleAuthed} onBack={goLibrary} />
    ) : (
      <div className="auth">
        <p className="subtitle">未配置 Supabase，无法登录</p>
        <button className="ghost" onClick={goLibrary}>← 返回</button>
      </div>
    )
  } else if (view === 'friends') {
    if (!api || !userId) {
      screen = (
        <div className="auth">
          <p className="subtitle">请先登录才能使用好友功能</p>
          <button className="primary" onClick={() => setView('auth')}><GiPerson /> 登录 / 注册</button>
          <button className="ghost" onClick={goLibrary}>← 返回</button>
        </div>
      )
    } else if (!myProfile) {
      screen = (
        <div className="sync-loading">
          <p>☁️ 加载档案…</p>
          <button className="ghost" onClick={goLibrary}>← 返回</button>
        </div>
      )
    } else {
      screen = <FriendsScreen api={api} userId={userId} myProfile={myProfile} onBack={goLibrary} onAcceptChallenge={handleAcceptChallenge} inviteCode={inviteCode} />
    }
  } else if (view === 'challenge' && activeChallenge && api) {
    screen = <ChallengeScreen api={api} challenge={activeChallenge} onDone={handleChallengeDone} />
  } else if (view === 'challengeFriend' && api && userId && challengeItems) {
    screen = <ChallengeFriendScreen api={api} userId={userId} unitName={currentTemplate?.name ?? ''} onBack={() => setView('list')} onPick={handleChallengePick} />
  } else if (view === 'challengeCreate' && api && userId && challengeFriend && challengeItems) {
    screen = <ChallengeCreateScreen api={api} userId={userId} friend={challengeFriend} items={challengeItems} onDone={handleChallengeCreated} />
  } else {
    screen = (
      <>
        <div className="account-bar">
          {api ? (
            userId ? (
              <>
                <span className="account-user"><GiPerson /> {myProfile?.displayName ?? '用户'}</span>
                <span className="account-status" role="status">已登录</span>
                <button className="ghost" onClick={handleOpenFriends}><GiThreeFriends /> 好友</button>
                <button className="ghost" onClick={handleSignOut}>登出</button>
              </>
            ) : (
              <>
                <button className="ghost" onClick={handleOpenFriends}><GiThreeFriends /> 好友</button>
                <button className="ghost" onClick={() => setView('auth')}><GiPerson /> 登录 / 注册</button>
              </>
            )
          ) : (
            <span className="account-hint" title="在 .env.local 配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY 后启用登录">未配置云端</span>
          )}
        </div>
        {needsImport && userId && (
          <div className="import-banner">
            <span>检测到本地学习数据，是否导入到云端账号？</span>
            <button className="primary" onClick={handleImportLocal}>导入本地数据</button>
          </div>
        )}
        <TodayCard
          todayCount={stats.dailyHistory[today] ?? 0}
          goal={motivation.goalPerDay}
          streak={streak}
          completedUnits={completedUnits}
          totalUnits={templates.length}
          makeupCards={motivation.makeupCards}
          onOpen={() => setView('achievements')}
        />
        <TemplateLibrary templates={templates} sort={sort} onSortChange={setSort} onParsed={handleParsed}
          onOpenTemplate={handleOpenTemplate} onRename={handleRename} onDelete={handleDelete} onOpenWrongbook={() => setView('wrongbook')} />
      </>
    )
  }

  return (
    <>
      <AmbientBackground />
      <div className="app">
        <AnimatePresence mode="wait">
          <motion.div
            className="screen"
            key={view}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {screen}
          </motion.div>
        </AnimatePresence>
        {showSummary && (
          <StudySummary
            today={stats.dailyHistory[dateKey(new Date())] ?? 0}
            total={stats.totalLearned}
            duration={lastDuration ?? undefined}
            onClose={() => setShowSummary(false)}
          />
        )}
      </div>
      {levelUp && <Confetti big count={80} onDone={() => setLevelUp(false)} />}
      {newAch.length > 0 && (
        <div className="ach-toast" role="status">
          <Confetti />
          <div className="ach-toast-card">
            <h3>🎉 新成就解锁！</h3>
            <ul>
              {newAch.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id)
                return a ? <li key={id}>{a.emoji} {a.name}</li> : null
              })}
            </ul>
            <button className="primary" onClick={() => handleMarkSeen(newAch)}>知道了</button>
          </div>
        </div>
      )}
    </>
  )
}

export default App
