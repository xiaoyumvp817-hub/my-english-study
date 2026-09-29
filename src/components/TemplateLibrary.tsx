import { useState } from 'react'
import type { Template, TemplateSort } from '../lib/templates'
import { sortTemplates } from '../lib/templates'
import { downloadExcelTemplate } from '../lib/excel'
import type { ParseResult } from '../types'
import FileUploader from './FileUploader'

interface Props {
  templates: Template[]
  sort: TemplateSort
  onSortChange: (sort: TemplateSort) => void
  onParsed: (result: ParseResult, fileName: string) => void
  onOpenTemplate: (template: Template) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onOpenWrongbook: () => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TemplateLibrary({
  templates,
  sort,
  onSortChange,
  onParsed,
  onOpenTemplate,
  onRename,
  onDelete,
  onOpenWrongbook,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const sorted = sortTemplates(templates, sort)

  function startRename(t: Template) {
    setEditingId(t.id)
    setDraft(t.name)
  }

  function confirmRename() {
    if (editingId === null) return
    const name = draft.trim()
    if (name) onRename(editingId, name)
    setEditingId(null)
  }

  return (
    <div className="library">
      <header className="list-head">
        <div>
          <h1 className="title">单词模板库</h1>
          <p className="subtitle">上传的每批单词按名字和时间分类管理</p>
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={onOpenWrongbook}>📒 错题本</button>
          <button className="ghost" onClick={downloadExcelTemplate}>📥 下载模板</button>
        </div>
      </header>

      <FileUploader onParsed={onParsed} />

      <div className="library-section">
        <div className="sort-toggle">
          <strong>已保存的模板</strong>
          <div className="head-actions">
            <button
              className={`ghost ${sort === 'time' ? 'is-active' : ''}`}
              onClick={() => onSortChange('time')}
            >
              时间
            </button>
            <button
              className={`ghost ${sort === 'name' ? 'is-active' : ''}`}
              onClick={() => onSortChange('name')}
            >
              名字
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="empty">
            <p>还没有模板。上传第一批单词开始吧。</p>
          </div>
        ) : (
          <ul className="sentence-list">
            {sorted.map((t) => (
              <li key={t.id}>
                <div
                  className="template-card"
                  onClick={() => editingId !== t.id && onOpenTemplate(t)}
                >
                  <div className="template-top">
                    {editingId === t.id ? (
                      <span className="rename-box" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="rename-input"
                          type="text"
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename()
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <button className="ghost" onClick={confirmRename}>✓</button>
                        <button className="ghost" onClick={() => setEditingId(null)}>✕</button>
                      </span>
                    ) : (
                      <span className="template-name">{t.name}</span>
                    )}
                    <span className="template-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="ghost" title="改名" onClick={() => startRename(t)}>✏️</button>
                      <button
                        className="ghost"
                        title="删除"
                        onClick={() => {
                          if (window.confirm(`确定删除模板「${t.name}」？`)) onDelete(t.id)
                        }}
                      >
                        🗑️
                      </button>
                    </span>
                  </div>
                  <span className="template-meta">
                    {formatDate(t.createdAt)} · 共 {t.items.length} 句
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
