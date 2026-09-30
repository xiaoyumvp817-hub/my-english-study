import { mkdir, writeFile } from 'node:fs/promises'

// Phase 0 验证（带 key）：用 gen.pollinations.ai + flux.1-schnell 生成样例。
const KEY = process.env.POLLINATIONS_KEY
if (!KEY) throw new Error('POLLINATIONS_KEY 未设置')

const MODEL = 'black-forest-labs/flux.1-schnell'
const STYLE = "soft children's storybook illustration, warm pastel colors, clean, minimal, no text, no watermark"

const samples = [
  { name: 'cup-of-warm-tea', prompt: `a steaming cup of warm tea on a wooden table, ${STYLE}` },
  { name: 'breathe-out', prompt: `a person gently exhaling a visible soft stream of air, ${STYLE}` },
  { name: 'collect-sunshine', prompt: `a child catching golden sunshine into a glass jar, ${STYLE}` },
]

const outDir = '_samples'
await mkdir(outDir, { recursive: true })

for (const s of samples) {
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(s.prompt)}?model=${MODEL}&width=512&height=512`
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(120000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') || ''
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(`${outDir}/${s.name}-key.${ext}`, buf)
    console.log(`OK   ${s.name}-key.${ext}  ${buf.length} bytes`)
  } catch (e) {
    console.log(`FAIL ${s.name}: ${e.message}`)
  }
}
