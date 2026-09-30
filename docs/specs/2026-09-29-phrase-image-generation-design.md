# 短语配图自动生成 — 设计方案

> 目标：根据每条短语 / 句子的内容，自动生成一张配图，帮助建立「画面 ↔ 词义」的联想，提升记忆效果。

## 1. 可行性结论

**能做到。** 用「文生图（Text-to-Image，T2I）」模型，把英文短语（辅以中文释义）作为提示词（prompt），生成一张插画。整个链路成熟，难点不在「能不能」，而在两个选择：

1. **用哪个生成引擎**（本地 GPU vs 云端 API）——决定成本、质量、是否联网。
2. **何时生成**（离线批量预生成 vs 运行时按需生成）——决定架构。

针对本项目（Vite + React + TS、纯静态、GitHub Pages、无后端、数据为固定词表），推荐：**离线批量预生成 + 打包进静态资源**。

---

## 2. 两种总体架构

### 方案 A：离线批量预生成（推荐）

```
xlsx/tsv 词表 ──▶ 生成脚本(scripts/gen-images.mjs) ──▶ 图片文件 public/images/*.webp
                          │
                          └──▶ 更新数据集（每条加 image 字段）
```

- 一次性生成全部图片，存成静态文件随站点一起打包部署。
- 运行时零成本、零延迟、离线可用、无 API key 暴露。
- 缺点：新词表要重新跑一遍脚本；图片体积计入仓库。

### 方案 B：运行时按需生成

- 用户打开某句时，前端调图片 API 现生成。
- 缺点：需要 API key（前端暴露不安全，得加后端代理）、每次调用有成本、有延迟、要缓存。
- **不推荐**用于当前纯静态架构；可作为远期「任意上传列表也配图」的可选项。

---

## 3. 图片生成引擎选型（关键决策）

| 引擎 | 成本 | 质量 | 联网/依赖 | 风格统一 | 上手难度 |
|------|------|------|-----------|----------|----------|
| **本地 Stable Diffusion**（ComfyUI / WebUI-Forge） | 0 元 | 高、可控 | 需 NVIDIA GPU（SDXL≥8GB 显存） | 极好（同一 checkpoint+LoRA+固定风格前缀） | 中（要装环境、下模型） |
| **Pollinations.ai** | 0 元、无需 key | 中 | 需联网 | 一般 | 极低（URL 即图片） |
| **Hugging Face Inference API** | 免费额度 | 中高（FLUX/SDXL） | 需联网+token | 好 | 低 |
| **Google Gemini / Imagen** | 有免费额度 | 高 | 需联网+key，国内访问受限 | 好 | 低 |
| **OpenAI gpt-image-1 / DALL·E 3** | ~$5–10 / 128 张（约，以官方为准） | 高 | 需联网+key | 好 | 极低 |
| **Replicate（FLUX.1）** | ~$1–5 / 128 张（约） | 高 | 需联网+key | 好 | 低 |

### 三条推荐路线

- **有 NVIDIA 显卡 → 本地 SD（ComfyUI / WebUI-Forge）**：免费、无限、风格最统一、隐私好，最适合「128 条 + 以后更多」的长期方案。
- **无显卡、想最快跑通 → Pollinations.ai**：零成本零配置，先验证效果和文案，再决定是否升级。
- **要最好质量、省事、能接受少量花费 → Replicate / OpenAI**：一次性几十元，风格和质量都稳。

---

## 4. 数据模型改动

`src/types.ts` 的 `TemplateItem` 增加可选字段：

```ts
export interface TemplateItem {
  id: string
  en: string
  zh: string
  image?: string   // 图片相对路径，如 "images/u5-001.webp"
}
```

- 解析器 `parseTemplate` 支持可选第三列「图片」（xlsx），导入时读进 `image`。
- 生成的 xlsx 输出三列：`英文 | 中文释义 | 图片`。
- **图片文件放 `public/images/`，随 Vite 打包；`image` 字段只存相对路径字符串**（很小，可安全进 localStorage）。
- ⚠️ **不要把图片 base64 塞进 localStorage**：localStorage 上限约 5MB，128 张图远超。

---

## 5. 生成流水线（脚本）

新增 `scripts/gen-images.mjs`（Node，复用现有 `_u5_data.tsv` 或 xlsx），核心逻辑：

```js
// 1. 读词表 → [{en, zh}, ...]
// 2. 对每条构造 prompt（见第 6 节）
// 3. 调生成引擎 → 下载到 public/images/u5-{i}.webp
// 4. 失败自动重试（限流/网络抖动）
// 5. 输出 data/u5-with-images.json + 带「图片」列的 xlsx
```

### 后端适配器（三选一）

```js
// A) 本地 SD WebUI-Forge 的 REST API（免费、离线、风格统一）
async function genLocalSD(prompt) {
  const res = await fetch('http://127.0.0.1:7860/sdapi/v1/txt2img', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt, negative_prompt: 'text, watermark, signature, blurry, low quality',
      width: 768, height: 768, steps: 25, seed: -1,
    }),
  })
  const { images } = await res.json()   // base64
  return Buffer.from(images[0], 'base64')
}

// B) Pollinations.ai（免费、无 key，最快验证）
async function genPollinations(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&model=flux&nologo=true`
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

// C) Hugging Face Inference API（免费额度）
async function genHF(prompt) {
  const res = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt }),
  })
  return Buffer.from(await res.arrayBuffer())
}
```

可选：用 `sharp` 统一转 WebP 压缩（768→512 或更低），控制单张 50–150KB。

---

## 6. Prompt 设计（风格统一的关键）

统一模板：

```
{风格前缀}, {具体画面}, flat illustration, clean, minimal, no text, no watermark
```

- **风格前缀固定**（决定整套图观感一致）：
  `soft children's storybook illustration, warm pastel colors, high quality`
- **主体用英文句子 + 中文释义辅助消歧**。T2I 模型对英文理解最好，但对抽象/短语类会乱猜，要按中文释义补成具体场景：

| 短语 | 直接喂英文 | 修正后的 prompt 主体 |
|------|-----------|---------------------|
| collect sunshine | （抽象，可能画太阳） | a child catching sunshine into a glass jar |
| make a decision | （抽象） | a person standing at two signposts choosing a path |
| breathe out | （动作） | a person slowly exhaling, visible air stream |

- **`no text` 必须加**：避免图片里出现乱码英文。
- 负向 prompt（本地 SD 用）：`text, watermark, signature, blurry, low quality`。
- 建议先手动精调 3–5 条「难词」的 prompt 作为样板，其余用模板自动生成。

---

## 7. 前端集成

- `SentenceQuiz` 在句子上方/旁边显示配图：`<img src={item.image} alt="" loading="lazy" />`。
- `SentenceList` / 卡片列表显示缩略图。
- 无图降级：`item.image` 缺失时隐藏图片，不影响现有功能（完全向后兼容）。
- 体积控制：`loading="lazy"` + `object-fit: cover`，缩略图用同文件由 CSS 缩放。

---

## 8. 部署与体积

- 128 张 512×512 WebP ≈ 7–20MB，放进 `public/images/` 随 `npm run build` 复制到 `dist/images/`，GitHub Pages 直接静态托管。
- `vite.config.ts` 已是 `base: './'`，相对路径 `images/xxx.webp` 可正确解析。
- GitHub 仓库建议 1GB 内，几十 MB 图片无压力；若以后图片很多，再考虑放图床（Cloudinary / 对象存储）单独托管。

---

## 9. 成本估算（128 张）

| 路线 | 一次性成本 |
|------|-----------|
| 本地 SD | 0 元（仅电费 + 首次下模型约几 GB） |
| Pollinations | 0 元 |
| HF 免费额度 | 0 元（需 token） |
| Replicate / OpenAI | 约几美元到十几美元（以官方实时价为准） |

---

## 10. 分阶段实施

- **Phase 0 — 技术验证**：选一个引擎，生成 3–5 张样例（覆盖抽象词、动词、具体名词），确认风格与质量。
- **Phase 1 — 跑通流水线**：`gen-images.mjs` 批量生成 128 张 + `image` 字段贯通（类型 / 解析 / 展示）。
- **Phase 2 — 风格精调**：统一风格前缀 / 手动修难词 prompt / 补「无图降级」样式。
- **Phase 3（可选）— 任意上传列表配图**：需要后端代理或让用户本地跑脚本，属于远期增强。

---

## 11. 风险与注意事项

1. **抽象短语质量风险**（最大）：像「collect sunshine」这类诗意/抽象表达，直译喂模型会出怪图，必须靠中文释义转成具体画面，部分需人工。
2. **风格一致性**：用固定前缀 + 同一引擎/checkpoint 才能成套；换引擎会导致画风跳变。
3. **版权 / 内容**：自用学习素材无碍；若要公开分发，注意所选用模型/服务的授权条款。
4. **国内网络**：Pollinations、Hugging Face、OpenAI 等云端服务可能需要代理；本地 SD 无此问题。

---

## 12. 已定稿决策

- **生成引擎**：Pollinations.ai（免费云，无需显卡/API key）。
- **范围**：只配现有 U5 的 128 条；「任意上传列表配图」作为远期 Phase 3，本期不做。
