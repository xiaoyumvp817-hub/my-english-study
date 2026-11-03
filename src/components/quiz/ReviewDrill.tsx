import { useMemo, useState } from 'react'
import type { WrongEntry } from '../../lib/wrongbook'
import { makeChoices, blankSentence } from '../../lib/quiz'
import { isCorrect } from '../../lib/tokenize'
import { speak } from '../../lib/speech'

interface Props {
  entry: WrongEntry
  onResult: (q: number) => void
}

type Step = 'see' | 'choice' | 'spell'

const STEP_LABEL: Record<Step, string> = {
  see: '第 1 步 · 看单词',
  choice: '第 2 步 · 选一选',
  spell: '第 3 步 · 拼一拼',
}

/**
 * 三步复习：先看完整单词 → 再选出正确项 → 最后完整拼写。
 * 三步全部过关才记为一次成功复习（FSRS 质量：全对 Good，有错 Again）。
 */
export default function ReviewDrill({ entry, onResult }: Props) {
  const word = entry.word
  const letters = useMemo(() => word.split(''), [word])
  const choices = useMemo(() => makeChoices(word, entry.en), [entry, word])

  const [step, setStep] = useState<Step>('see')

  const [selected, setSelected] = useState<string | null>(null)
  const [choiceMissed, setChoiceMissed] = useState(false)
  const choiceSolved = selected !== null && isCorrect(selected, word)

  const [typed, setTyped] = useState('')
  const [spellChecked, setSpellChecked] = useState(false)
  const [spellWrong, setSpellWrong] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [spellMissed, setSpellMissed] = useState(false)
  const spellSolved = spellChecked && !spellWrong

  function finish() {
    onResult(!choiceMissed && !spellMissed ? 4 : 2)
  }

  function pick(c: string) {
    if (choiceSolved) return
    setSelected(c)
    if (!isCorrect(c, word)) setChoiceMissed(true)
  }

  function submitSpell(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (spellSolved) return
    if (isCorrect(typed, word)) {
      setSpellChecked(true)
      setSpellWrong(false)
    } else {
      setSpellMissed(true)
      setSpellWrong(true)
      setSpellChecked(true)
    }
  }

  function reveal() {
    setRevealed(true)
    setSpellMissed(true)
  }

  return (
    <section className="quiz-card">
      <p className="drill-step">{STEP_LABEL[step]}</p>

      {step === 'see' && (
        <>
          <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
          <span className="quiz-word">{word}</span>
          {entry.phonetic && <span className="flashcard-phonetic">{entry.phonetic}</span>}
          <p className="quiz-sentence">{entry.en}</p>
          <button type="button" className="speak" onClick={() => speak(word)}>🔊 听单词</button>
          <div className="quiz-actions">
            <button type="button" className="primary" onClick={() => setStep('choice')}>下一步 →</button>
          </div>
        </>
      )}

      {step === 'choice' && (
        <>
          <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
          <p className="quiz-sentence">{blankSentence(entry.en, word)}</p>
          <div className="quiz-options">
            {choices.map((c) => {
              const isAnswer = isCorrect(c, word)
              const isSel = selected !== null && isCorrect(c, selected)
              const cls = [
                'quiz-option',
                choiceSolved && isAnswer ? 'is-correct' : '',
                isSel && !isAnswer ? 'is-wrong' : '',
              ].filter(Boolean).join(' ')
              return (
                <button key={c} className={cls} disabled={choiceSolved} onClick={() => pick(c)}>
                  {c}
                </button>
              )
            })}
          </div>
          {choiceSolved && (
            <div className="quiz-actions">
              <p className="result success" role="status">✓ 选对了</p>
              <button type="button" className="primary" onClick={() => setStep('spell')}>下一步 →</button>
            </div>
          )}
        </>
      )}

      {step === 'spell' && (
        <>
          <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
          <span className="spell-blanks" aria-hidden="true">{letters.map(() => '_').join(' ')}</span>
          {revealed && <span className="quiz-word">{word}</span>}
          <form onSubmit={submitSpell} noValidate>
            <input
              className={`word-input${spellWrong ? ' is-wrong' : ''}${spellSolved ? ' is-correct' : ''}`}
              type="text"
              value={typed}
              size={Math.max(word.length, 2)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              onChange={(e) => {
                setTyped(e.target.value)
                if (spellWrong) { setSpellWrong(false); setSpellChecked(false) }
              }}
              readOnly={spellSolved}
            />
            <div className="quiz-actions">
              {spellSolved ? (
                <>
                  <p className="result success" role="status">✓ 拼对了！</p>
                  <button type="button" className="primary" onClick={finish}>完成 ✓</button>
                </>
              ) : (
                <>
                  {spellWrong && <p className="result fail" role="status">✗ 拼错了，再试一次</p>}
                  <div className="game-actions">
                    <button type="button" className="ghost" onClick={reveal}>💡 揭示答案</button>
                    <button type="submit" className="primary">检查</button>
                  </div>
                </>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  )
}
