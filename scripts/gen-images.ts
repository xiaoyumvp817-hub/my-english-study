import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { buildImagePrompt, imageFileName } from '../src/lib/imagePrompt.ts'

// Batch-generates a cover image per phrase for the U5 list, using
// Pollinations (gen.pollinations.ai). Run with:
//   POLLINATIONS_KEY=sk_... node scripts/gen-images.ts
// Requires Node 24+ (native TypeScript type stripping).

const KEY = process.env.POLLINATIONS_KEY
if (!KEY) {
  console.error('请在环境变量中设置 POLLINATIONS_KEY=sk_...')
  process.exit(1)
}

const MODEL = 'black-forest-labs/flux.1-schnell'
const WIDTH = 512
const HEIGHT = 512
const CONCURRENCY = 6
const MAX_ATTEMPTS = 5

const root = fileURLToPath(new URL('..', import.meta.url))
const imagesDir = `${root}/public/images`
const dataDir = `${root}/data`
mkdirSync(imagesDir, { recursive: true })
mkdirSync(dataDir, { recursive: true })

// ---- read tsv ---------------------------------------------------------------
const raw = readFileSync(`${root}/_u5_data.tsv`, 'utf8')
const rows = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l !== '')
  .map((l) => {
    const [en, zh] = l.split('\t')
    return { en: en.trim(), zh: (zh || '').trim() }
  })

console.log(`将生成 ${rows.length} 张图片 → ${imagesDir}`)

// ---- generation -------------------------------------------------------------
async function generateOne(index: number): Promise<{ en: string; zh: string; image: string }> {
  const { en, zh } = rows[index]
  const file = imageFileName(index)
  const outPath = `${imagesDir}/${file}`
  const image = `images/${file}`

  if (existsSync(outPath) && statSync(outPath).size > 0) {
    return { en, zh, image } // already done — skip (resumable)
  }

  const prompt = buildImagePrompt(en, zh)
  const url =
    `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}` +
    `?model=${MODEL}&width=${WIDTH}&height=${HEIGHT}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KEY}` },
        signal: AbortSignal.timeout(120000),
      })
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        writeFileSync(outPath, buf)
        return { en, zh, image }
      }
      if (res.status === 401 || res.status === 402) {
        // auth / balance issue — no point retrying the whole batch
        throw new Error(`HTTP ${res.status} (aborting)` )
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e) {
      if (attempt === MAX_ATTEMPTS || (e as Error).message.includes('aborting')) {
        throw e as Error
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
  throw new Error('unreachable')
}

const results = new Array<{ en: string; zh: string; image: string }>(rows.length)
let next = 0
let done = 0
const failures: Array<{ index: number; en: string; err: string }> = []

async function worker() {
  while (true) {
    const i = next
    next += 1
    if (i >= rows.length) return
    try {
      results[i] = await generateOne(i)
    } catch (e) {
      failures.push({ index: i, en: rows[i].en, err: (e as Error).message })
    }
    done += 1
    if (done % 10 === 0 || done === rows.length) {
      console.log(`进度 ${done}/${rows.length}`)
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

// ---- write outputs ----------------------------------------------------------
if (failures.length > 0) {
  console.error(`\n${failures.length} 张失败：`)
  for (const f of failures) console.error(`  ${f.index + 1} ${f.en}: ${f.err}`)
}

const succeeded = results.filter((r): r is NonNullable<typeof r> => Boolean(r))
console.log(`\n成功 ${succeeded.length}/${rows.length}`)

// Emit every row so the dataset stays complete even when an image failed.
const all = rows.map((r, i) => ({ en: r.en, zh: r.zh, image: results[i]?.image ?? '' }))

// tsv (3 columns) for reference / re-import
const tsvOut = all.map((r) => `${r.en}\t${r.zh}\t${r.image}`).join('\n') + '\n'
writeFileSync(`${root}/data/u5-with-images.tsv`, tsvOut)

// xlsx (英文 / 中文释义 / 图片) for app import
const aoa: Array<Array<string>> = [['英文', '中文释义', '图片']]
for (const r of all) aoa.push([r.en, r.zh, r.image])
const ws = XLSX.utils.aoa_to_sheet(aoa)
ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 20 }]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '模板')
const xlsxPath = `${root}/english-study-data-with-images.xlsx`
writeFileSync(xlsxPath, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }))

console.log(`已写出：data/u5-with-images.tsv、english-study-data-with-images.xlsx`)
