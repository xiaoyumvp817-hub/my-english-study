import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseExcel, buildTemplateWorkbook } from './excel'

function toBuffer(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

describe('parseExcel', () => {
  it('parses two-column rows and skips the header', () => {
    const buffer = toBuffer([
      ['英文', '中文释义'],
      ['Hello', '你好'],
      ['World', '世界'],
    ])
    const { items, warnings } = parseExcel(buffer)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ en: 'Hello', zh: '你好' })
    expect(items[1]).toMatchObject({ en: 'World', zh: '世界' })
    expect(warnings).toHaveLength(0)
  })

  it('warns on a row missing Chinese', () => {
    const buffer = toBuffer([['Only English']])
    const { items, warnings } = parseExcel(buffer)
    expect(items).toHaveLength(1)
    expect(items[0].zh).toBe('')
    expect(warnings).toHaveLength(1)
  })

  it('skips rows missing English', () => {
    const buffer = toBuffer([['你好']])
    const { items, warnings } = parseExcel(buffer)
    expect(items).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

describe('buildTemplateWorkbook', () => {
  it('has a header row with English first', () => {
    const wb = buildTemplateWorkbook()
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    expect(rows[0]).toEqual(['英文', '中文释义'])
  })
})
