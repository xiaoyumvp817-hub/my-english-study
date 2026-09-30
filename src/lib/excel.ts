import * as XLSX from 'xlsx'
import type { TemplateItem, ParseResult } from '../types'

const HEADER: [string, string] = ['英文', '中文释义']

/** Builds the template workbook: a header row plus a few example rows. */
export function buildTemplateWorkbook(): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    [HEADER[0], HEADER[1]],
    ['Hello, world!', '你好，世界！'],
    ['I love learning English.', '我喜欢学英语。'],
    ['Practice makes perfect.', '熟能生巧。'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 34 }, { wch: 22 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '模板')
  return wb
}

/** Downloads the template as an .xlsx file in the browser. */
export function downloadExcelTemplate(): void {
  XLSX.writeFile(buildTemplateWorkbook(), 'english-study-template.xlsx')
}

function isHeaderRow(firstCell: string): boolean {
  return /^(英文|english|en)$/i.test(firstCell.trim())
}

const HAS_CJK = /[一-鿿]/

/**
 * Parses an .xlsx / .xls buffer into items.
 * Column A = English, column B = Chinese translation.
 */
export function parseExcel(buffer: ArrayBuffer | Uint8Array): ParseResult {
  const items: TemplateItem[] = []
  const warnings: string[] = []

  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { items, warnings }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
  let seq = 0

  rows.forEach((row, idx) => {
    const cells = row.map((c) => (c == null ? '' : String(c).trim()))
    const en = cells[0] ?? ''
    const zh = cells[1] ?? ''
    const image = cells[2] || undefined

    if (!en && !zh) return
    if (isHeaderRow(en)) return

    if (en && zh) {
      items.push({ id: `xlsx-${seq++}`, en, zh, image })
    } else if (en && !zh) {
      if (HAS_CJK.test(en)) {
        warnings.push(`第 ${idx + 1} 行缺少英文，已跳过`)
      } else {
        items.push({ id: `xlsx-${seq++}`, en, zh: '', image })
        warnings.push(`第 ${idx + 1} 行缺少中文释义`)
      }
    } else {
      warnings.push(`第 ${idx + 1} 行缺少英文，已跳过`)
    }
  })

  return { items, warnings }
}
