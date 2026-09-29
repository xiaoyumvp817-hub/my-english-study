import { useState } from 'react'
import type { FormEvent } from 'react'

interface Props {
  fileName: string
  count: number
  onConfirm: (name: string) => void
  onCancel: () => void
}

function defaultName(fileName: string): string {
  return fileName.replace(/\.[^.]*$/, '').trim()
}

/** Naming step shown right after a file parses successfully, before it is saved. */
export default function NamePrompt({ fileName, count, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(() => defaultName(fileName))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onConfirm(name.trim())
  }

  return (
    <div className="name-prompt">
      <header className="upload-head">
        <h1 className="title">给这批单词起个名字</h1>
        <p className="subtitle">共 {count} 句 · 之后可在模板库中改名</p>
      </header>

      <form className="name-form" onSubmit={handleSubmit}>
        <input
          className="name-input"
          type="text"
          value={name}
          autoFocus
          placeholder="例如：7年级unit1"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="name-actions">
          <button type="button" className="ghost" onClick={onCancel}>取消</button>
          <button type="submit" className="primary" disabled={!name.trim()}>保存并练习</button>
        </div>
      </form>
    </div>
  )
}
