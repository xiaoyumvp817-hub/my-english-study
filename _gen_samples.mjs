import { mkdir, writeFile } from 'node:fs/promises'

// Phase 0 验证：默认模型（匿名免费档可用）+ 重试 + 间隔，生成 3 张样例。
const STYLE = "soft children's storybook illustration, warm pastel colors, clean, minimal, no text, no watermark"

const samples = [
  { name: 'cup-of-warm-tea', prompt: `a steaming cup of warm tea on a wooden table, ${STYLE}` },
  { name: 'breathe-out', prompt: `a person gently exhaling a visible soft stream of air, ${STYLE}` },
  { name: 'collect-sunshine', prompt: `a child catching golden sunshine into a glass jar, ${STYLE}` },
]

const outDir = '_samples'
await mkdir(outDir, { recursive: true })

async function gen(s) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(s.prompt)}?width=512&height=512&nologo=true`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) })
      if (res.ok) {
        const ct = res.headers.get('content-type') || ''
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
        const buf = Buffer.from(await res.arrayBuffer())
        await writeFile(`${outDir}/${s.name}.${ext}`, buf)
        console.log(`OK   ${s.name}.${ext}  ${buf.length} bytes`)
        return
      }
      console.log(`  ${s.name} try ${attempt}: HTTP ${res.status}`)
    } catch (e) {
      console.log(`  ${s.name} try ${attempt}: ${e.message}`)
    }
    if (attempt < 4) await new Promise((r) => setTimeout(r, 16000))
  }
  console.log(`FAIL ${s.name} after 4 attempts`)
}

for (const s of samples) {
  await gen(s)
  await new Promise((r) => setTimeout(r, 16000))
}
