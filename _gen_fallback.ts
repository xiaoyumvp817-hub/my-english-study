import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildImagePrompt, imageFileName } from './src/lib/imagePrompt.ts'

// 兜底生成：用 Pollinations 匿名免费端点（无 key、无需 pollen）给缺的 4 张补图，
// 输出到 _samples/fallback/ 供人工看效果（不覆盖 public/images 正图）。
// 匿名端点限流较严（约 1 req / 15s），顺序 + 重试 + 间隔。

const root = fileURLToPath(new URL('.', import.meta.url))
const outDir = `${root}/_samples/fallback`
mkdirSync(outDir, { recursive: true })

const raw = readFileSync(`${root}/_u5_data.tsv`, 'utf8')
const rows = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l)
  .map((l) => {
    const [en, zh] = l.split('\t')
    return { en: en.trim(), zh: (zh || '').trim() }
  })

const INDEXES = [124, 125, 126, 127] // compare A with B / to B / be similar to sth / search for sth

async function gen(index: number) {
  const { en, zh } = rows[index]
  const file = imageFileName(index)
  const prompt = buildImagePrompt(en, zh)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) })
      if (res.ok) {
        const ct = res.headers.get('content-type') || ''
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
        const buf = Buffer.from(await res.arrayBuffer())
        writeFileSync(`${outDir}/${file.replace(/\.jpg$/, '')}.${ext}`, buf)
        console.log(`OK   ${file} -> ${ext} ${buf.length}B`)
        return
      }
      console.log(`  ${file} try ${attempt}: HTTP ${res.status}`)
    } catch (e) {
      console.log(`  ${file} try ${attempt}: ${(e as Error).message}`)
    }
    if (attempt < 4) await new Promise((r) => setTimeout(r, 16000))
  }
  console.log(`FAIL ${file}`)
}

for (const i of INDEXES) {
  await gen(i)
  await new Promise((r) => setTimeout(r, 16000))
}
console.log('done')
