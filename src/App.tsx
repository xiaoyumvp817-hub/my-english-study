import { useEffect, useRef, useState } from 'react'
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
import type { WrongWord } from './components/SentenceQuiz'
import { loadTemplates, saveTemplates, makeTemplate } from './lib/templates'
import type { Template, TemplateSort } from './lib/templates'
import { loadEntries, saveEntries, recordWrong, reviewEntry, dueEntries } from './lib/wrongbook'
import type { WrongEntry } from './lib/wrongbook'
import { loadStats, saveStats, recordStudy, applyReviewAnswer, dateKey, levelForXp } from './lib/stats'
import type { Stats } from './lib/stats'
import { loadLearned, saveLearned, commitLearned } from './lib/learned'
import type { QuizType } from './lib/quiz'
import { xpForAnswer } from './lib/quiz'
import './App.css'

type View = 'library' | 'name' | 'list' | 'play' | 'wrongbook' | 'review' | 'study'

type StudyPhase = 'select' | 'type'
interface StudySession {
  items: TemplateItem[]
  index: number
  phase: StudyPhase
}

function App() {
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

  useEffect(() => { saveTemplates(templates) }, [templates])
  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { saveStats(stats) }, [stats])
  useEffect(() => { saveLearned(learned) }, [learned])

  useEffect(() => {
    const level = levelForXp(stats.xp)
    if (level > prevLevelRef.current) {
      prevLevelRef.current = level
      setLevelUp(true)
    }
  }, [stats.xp])

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
  if (view === 'play' && currentIndex !== null && currentTemplate) {
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
    screen = <SentenceList templateName={currentTemplate.name} items={currentTemplate.items} warnings={currentTemplate.warnings} learned={new Set(learned)} entries={entries} onSelect={handleSelect} onStartStudy={handleStartStudy} onBack={goLibrary} />
  } else if (view === 'wrongbook') {
    screen = <WrongbookScreen entries={entries} stats={stats} onBack={goLibrary} onStartReview={handleStartReview} onPractice={handlePractice} onClear={handleClear} />
  } else if (view === 'review') {
    screen = <ReviewSession entries={reviewEntries} onAnswer={handleAnswer} onBack={() => setView('wrongbook')} />
  } else {
    screen = (
      <TemplateLibrary templates={templates} sort={sort} onSortChange={setSort} onParsed={handleParsed}
        onOpenTemplate={handleOpenTemplate} onRename={handleRename} onDelete={handleDelete} onOpenWrongbook={() => setView('wrongbook')} />
    )
  }

  return (
    <>
      <AmbientBackground />
      <div className="app">
        <div className="screen" key={view}>
          {screen}
        </div>
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
    </>
  )
}

export default App
