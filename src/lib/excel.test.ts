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
  it('parses three-column rows (英文|音标|中文释义) and skips the header', () => {
    const buffer = toBuffer([
      ['英文', '音标', '中文释义'],
      ['Hello', '/həˈloʊ/', '你好'],
      ['World', '/wɜːrld/', '世界'],
    ])
    const { items, warnings } = parseExcel(buffer)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ en: 'Hello', phonetic: '/həˈloʊ/', zh: '你好' })
    expect(items[1]).toMatchObject({ en: 'World', phonetic: '/wɜːrld/', zh: '世界' })
    expect(warnings).toHaveLength(0)
  })

  it('leaves phonetic undefined when the second column is empty', () => {
    const buffer = toBuffer([
      ['英文', '音标', '中文释义'],
      ['a quarter of', '', '四分之一'],
    ])
    const { items } = parseExcel(buffer)
    expect(items).toHaveLength(1)
    expect(items[0].phonetic).toBeUndefined()
    expect(items[0].zh).toBe('四分之一')
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

  it('reads the optional fourth "图片" column into image', () => {
    const buffer = toBuffer([
      ['英文', '音标', '中文释义', '图片'],
      ['Hello', '/həˈloʊ/', '你好', 'images/u5-001.jpg'],
      ['World', '/wɜːrld/', '世界'],
    ])
    const { items } = parseExcel(buffer)
    expect(items[0].image).toBe('images/u5-001.jpg')
    expect(items[1].image).toBeUndefined()
  })
})

describe('buildTemplateWorkbook', () => {
  it('has a header row with English, phonetic and Chinese', () => {
    const wb = buildTemplateWorkbook()
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    expect(rows[0]).toEqual(['英文', '音标', '中文释义'])
  })
})
