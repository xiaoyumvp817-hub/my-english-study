import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const HEADER = ['英文', '中文释义']
const raw = readFileSync(new URL('./_u5_data.tsv', import.meta.url), 'utf8')
const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')

const rows = [HEADER]
for (const line of lines) {
  const [en, zh] = line.split('\t')
  rows.push([en, zh])
}

const ws = XLSX.utils.aoa_to_sheet(rows)
ws['!cols'] = [{ wch: 34 }, { wch: 22 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '模板')

const outPath = new URL('./english-study-template.xlsx', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
writeFileSync(outPath, buf)

console.log('WROTE', outPath, 'rows:', rows.length - 1)
