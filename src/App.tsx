import { useEffect, useState } from 'react'
import type { ParseResult } from './types'
import TemplateLibrary from './components/TemplateLibrary'
import NamePrompt from './components/NamePrompt'
import SentenceList from './components/SentenceList'
import GameScreen from './components/GameScreen'
import WrongbookScreen from './components/WrongbookScreen'
import ReviewSession from './components/ReviewSession'
import type { WrongWord } from './components/SentenceQuiz'
import { loadTemplates, saveTemplates, makeTemplate } from './lib/templates'
import type { Template, TemplateSort } from './lib/templates'
import { loadEntries, saveEntries, recordWrong, reviewEntry, dueEntries } from './lib/wrongbook'
import type { WrongEntry } from './lib/wrongbook'
import { loadStats, saveStats, addXp, recordStudy, dateKey } from './lib/stats'
import type { Stats } from './lib/stats'
import type { QuizType } from './lib/quiz'
import { xpForAnswer } from './lib/quiz'
import './App.css'

type View = 'library' | 'name' | 'list' | 'play' | 'wrongbook' | 'review'

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

  useEffect(() => { saveTemplates(templates) }, [templates])
  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { saveStats(stats) }, [stats])

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
  function handleSelect(index: number) { setCurrentIndex(index); setView('play') }
  function goList() { setCurrentIndex(null); setView('list') }
  function goLibrary() { setCurrentIndex(null); setView('library') }
  function handleNext() {
    if (currentIndex === null || !currentTemplate) return
    if (currentIndex < currentTemplate.items.length - 1) setCurrentIndex(currentIndex + 1)
    else goList()
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
    setStats((prev) => recordStudy(addXp(prev, xp), dateKey(new Date(now))))
    return xp
  }
  function handleClear() { setEntries([]) }

  let screen
  if (view === 'play' && currentIndex !== null && currentTemplate) {
    screen = (
      <GameScreen key={currentIndex} item={currentTemplate.items[currentIndex]} index={currentIndex}
        total={currentTemplate.items.length} onNext={handleNext} onBack={goList} onWrongWords={handleWrongWords} />
    )
  } else if (view === 'name' && pendingUpload) {
    screen = <NamePrompt fileName={pendingUpload.fileName} count={pendingUpload.result.items.length} onConfirm={handleNameConfirm} onCancel={handleNameCancel} />
  } else if (view === 'list' && currentTemplate) {
    screen = <SentenceList templateName={currentTemplate.name} items={currentTemplate.items} warnings={currentTemplate.warnings} onSelect={handleSelect} onBack={goLibrary} />
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

  return <div className="app">{screen}</div>
}

export default App
