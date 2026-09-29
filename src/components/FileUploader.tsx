import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { parseTemplate } from '../lib/parseTemplate'
import { parseExcel } from '../lib/excel'
import type { ParseResult } from '../types'

interface Props {
  onParsed: (result: ParseResult, fileName: string) => void
}

/** File dropzone only: parses a file and reports the result, leaving routing to the caller. */
export default function FileUploader({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File) {
    if (/\.txt$/i.test(file.name)) {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const result = parseTemplate(text)
        if (result.items.length === 0) {
          setError('文件中没有找到有效内容，请检查格式')
          return
        }
        setError(null)
        onParsed(result, file.name)
      }
      reader.onerror = () => setError('读取文件失败，请重试')
      reader.readAsText(file, 'utf-8')
      return
    }

    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const reader = new FileReader()
      reader.onload = () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          setError('读取文件失败，请重试')
          return
        }
        const result = parseExcel(reader.result)
        if (result.items.length === 0) {
          setError('Excel 中没有找到有效内容，请检查「英文 | 中文释义」两列格式')
          return
        }
        setError(null)
        onParsed(result, file.name)
      }
      reader.onerror = () => setError('读取文件失败，请重试')
      reader.readAsArrayBuffer(file)
      return
    }

    setError('请选择 .txt 或 .xlsx / .xls 文件')
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="upload">
      <div
        className={`dropzone ${dragOver ? 'is-drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.xlsx,.xls,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onChange}
          hidden
        />
        <div className="dropzone-icon">📄</div>
        <p className="dropzone-main">上传新模板（.xlsx / .xls / .txt）</p>
        <p className="dropzone-hint">点击选择文件，或拖拽到这里</p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="format-box">
        <p className="format-title">模板格式</p>
        <p className="format-note">
          <strong>Excel 模板（推荐）</strong>：第一列 <code>英文</code>，第二列{' '}
          <code>中文释义</code>。先点上面的「下载模板」，填写后保存再上传即可。
        </p>
        <p className="format-note">
          <strong>文本 .txt</strong>：每行一句，用 <code>|</code> 分隔英文与中文，例如{' '}
          <code>Hello, world! | 你好，世界！</code>。
        </p>
      </div>
    </div>
  )
}
