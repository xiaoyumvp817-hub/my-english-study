import type { Token } from '../types'
import { speak } from '../lib/speech'

interface Props {
  tokens: Token[]
  answers: string[]
  checked: boolean
  results: boolean[]
  onChange: (wordIndex: number, value: string) => void
}

// Punctuation that attaches to the following word without a space.
const OPENING = new Set(['(', '[', '{', '（', '「', '『', '"', '“', '‘', "'", '—'])

function spaceBefore(tokens: Token[], index: number): boolean {
  if (index === 0) return false
  const prev = tokens[index - 1]
  const cur = tokens[index]
  if (cur.kind === 'punct') return false
  // current is a word
  if (prev.kind === 'word') return true
  // previous is punctuation: add a space unless it's an opening mark
  return !OPENING.has(prev.text)
}

export default function SentenceDisplay({ tokens, answers, checked, results, onChange }: Props) {
  let wordIndex = -1

  return (
    <div className="sentence" role="group" aria-label="填空句子">
      {tokens.map((token, tokenIndex) => {
        if (token.kind === 'punct') {
          return (
            <span key={token.id} className="punct">
              {token.text}
            </span>
          )
        }

        wordIndex += 1
        const i = wordIndex
        const target = token.text
        const value = answers[i] ?? ''
        const correct = checked && results[i]
        const wrong = checked && !results[i]

        const className = [
          'word-input',
          correct ? 'is-correct' : '',
          wrong ? 'is-wrong' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <input
            key={token.id}
            id={`word-${i}`}
            className={className}
            type="text"
            value={value}
            size={Math.max(target.length, 2)}
            style={{ marginLeft: spaceBefore(tokens, tokenIndex) ? '0.4em' : undefined }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={wrong}
            readOnly={correct}
            title={correct ? '点击朗读' : undefined}
            onClick={() => {
              if (correct) speak(target)
            }}
            onChange={(e) => onChange(i, e.target.value)}
          />
        )
      })}
    </div>
  )
}
