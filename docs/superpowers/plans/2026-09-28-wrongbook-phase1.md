# 错题本 Phase 1（MVP 闭环）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把错题本升级为「SM-2 自适应排期 + 四选一/翻卡两种复习题型 + 连胜/XP/等级基础」的 MVP 闭环。

**Architecture:** 纯函数库（`sm2` / `stats` / `quiz`）承载全部可测逻辑，React 组件只做渲染与状态桥接。错词 `WrongEntry` 从固定阶梯迁移到 SM-2 字段（repetition / intervalDays / easeFactor / dueAt），`status` 改为派生函数 `statusOf` 不落库。复习会话 `ReviewSession` 逐题出卡（随机选四选一/翻卡），每答一题回调 `onAnswer` 更新词条 SM-2 状态与全局 XP/连胜。

**Tech Stack:** React 19 + Vite 8 + TypeScript 6（strict、`verbatimModuleSyntax`、`erasableSyntaxOnly`、`noUnusedLocals`）、Vitest 5。

**Spec:** `docs/specs/2026-09-28-wrongbook-design.md`（§4–§8、§12、§15 阶段 1）

## Global Constraints

- TypeScript strict：`import type` 强制（`verbatimModuleSyntax`）、禁止 enum、未用变量报错（`noUnusedLocals`/`noUnusedParameters`）。
- **无 git 仓库**：跳过所有 commit 步骤，每任务以 `npm test` / `npm run build` 验证收尾。
- 纯逻辑库（sm2 / stats / quiz / wrongbook）走 TDD（vitest）；React 组件无测试框架，以 `npm run build`（`tsc -b` 类型检查）+ 手动冒烟验证。
- 存储 key：词条 `wrongbook:v2`（读 v1 迁移）、统计 `stats:v1`。读写都带 `typeof window` 守卫 + try/catch。
- 中文文案与既有文件一致（emoji 前缀、`（无中文释义）` 兜底）。

## Review Focus

1. **空复习队列**：0 到期词点「开始复习」→ 显示友好空状态，不崩溃（Task 7）。
2. **localStorage 损坏/缺失**：`loadEntries`/`loadStats` 对坏 JSON 或非数组返回安全默认值，不抛异常（Task 2、4）。
3. **连胜同天不重复加、跨天断档重置**：同一天复习多次只算一次连胜；隔 >1 天重置为 1（Task 2）。
4. **已掌握词永远不到期**：`dueAt = MAX_SAFE_INTEGER`，`isDue` 恒 false（Task 4）。
5. **四选一干扰项**：正确答案恰好出现一次、无重复（Task 3）。

---

### Task 1: SM-2 调度核心

**Files:**
- Create: `src/lib/sm2.ts`
- Test: `src/lib/sm2.test.ts`

**Interfaces:**
- Produces: `SrsState { repetition; intervalDays; easeFactor }`、`sm2Next(state, q): SrsState`、`isMastered(state): boolean`、常量 `DEFAULT_EASE=2.5` `MIN_EASE=1.3` `MASTERED_REPETITION=4` `MASTERED_INTERVAL_DAYS=21` `DAY_MS`。

- [ ] **Step 1: 写失败测试** `src/lib/sm2.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { sm2Next, isMastered, DEFAULT_EASE, MIN_EASE } from './sm2'

const fresh = { repetition: 0, intervalDays: 1, easeFactor: DEFAULT_EASE }

describe('sm2Next', () => {
  it('resets on a lapse (q < 3) and lowers ease by formula', () => {
    const s = sm2Next({ repetition: 3, intervalDays: 10, easeFactor: 2.3 }, 2)
    expect(s.repetition).toBe(0)
    expect(s.intervalDays).toBe(1)
    // 2.3 + (0.1 - 3*(0.08 + 3*0.02)) = 1.98
    expect(s.easeFactor).toBeCloseTo(1.98, 5)
  })

  it('first success (q>=3) gives interval 1', () => {
    const s = sm2Next(fresh, 4)
    expect(s.repetition).toBe(1)
    expect(s.intervalDays).toBe(1)
    expect(s.easeFactor).toBeCloseTo(2.5, 5) // q4 → 不增不减
  })

  it('second success gives interval 6', () => {
    const s = sm2Next({ repetition: 1, intervalDays: 1, easeFactor: DEFAULT_EASE }, 4)
    expect(s.repetition).toBe(2)
    expect(s.intervalDays).toBe(6)
  })

  it('later successes multiply interval by ease factor', () => {
    const s = sm2Next({ repetition: 2, intervalDays: 6, easeFactor: 2.5 }, 5)
    expect(s.repetition).toBe(3)
    expect(s.intervalDays).toBe(Math.round(6 * 2.6)) // EF 2.5+0.1=2.6
  })

  it('clamps ease factor at the minimum', () => {
    const s = sm2Next({ repetition: 0, intervalDays: 1, easeFactor: 1.31 }, 0)
    expect(s.easeFactor).toBe(MIN_EASE)
  })
})

describe('isMastered', () => {
  it('requires both repetition and interval thresholds', () => {
    expect(isMastered({ repetition: 4, intervalDays: 21, easeFactor: DEFAULT_EASE })).toBe(true)
    expect(isMastered({ repetition: 3, intervalDays: 40, easeFactor: DEFAULT_EASE })).toBe(false)
    expect(isMastered({ repetition: 5, intervalDays: 10, easeFactor: DEFAULT_EASE })).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/sm2.test.ts`
Expected: FAIL（`Cannot find module './sm2'`）

- [ ] **Step 3: 最小实现** `src/lib/sm2.ts`

```ts
export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
export const MASTERED_REPETITION = 4
export const MASTERED_INTERVAL_DAYS = 21
export const DAY_MS = 24 * 60 * 60 * 1000

export interface SrsState {
  repetition: number
  intervalDays: number
  easeFactor: number
}

/** 一次复习后推进 SM-2 状态。q 为记忆质量 0..5。 */
export function sm2Next(state: SrsState, q: number): SrsState {
  const easeFactor = Math.max(
    MIN_EASE,
    state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  )
  if (q < 3) {
    return { repetition: 0, intervalDays: 1, easeFactor }
  }
  let intervalDays: number
  if (state.repetition === 0) intervalDays = 1
  else if (state.repetition === 1) intervalDays = 6
  else intervalDays = Math.round(state.intervalDays * easeFactor)
  return { repetition: state.repetition + 1, intervalDays, easeFactor }
}

export function isMastered(state: SrsState): boolean {
  return state.repetition >= MASTERED_REPETITION && state.intervalDays >= MASTERED_INTERVAL_DAYS
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/lib/sm2.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: 验证**

Run: `npm run build`
Expected: 通过

---

### Task 2: 学习统计（XP / 等级 / 连胜）

**Files:**
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

**Interfaces:**
- Produces: `Stats { xp; streakDays; lastStudyDate; reviewCount; dailyHistory }`、`emptyStats()`、`levelForXp(xp)`、`xpForLevel(level)`、`xpProgress(xp): { level; current; needed }`、`addXp(stats, amount)`、`recordStudy(stats, today, count=1)`、`dateKey(date)`、`loadStats()`、`saveStats(stats)`。

- [ ] **Step 1: 写失败测试** `src/lib/stats.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { emptyStats, addXp, levelForXp, xpProgress, recordStudy, dateKey, loadStats } from './stats'

afterEach(() => { vi.unstubAllGlobals() })

describe('levelForXp', () => {
  it('starts at level 1 and slows down', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(400)).toBe(3)
  })
})

describe('xpProgress', () => {
  it('computes progress within the current level', () => {
    expect(xpProgress(0)).toEqual({ level: 1, current: 0, needed: 100 })
    expect(xpProgress(150)).toEqual({ level: 2, current: 50, needed: 300 })
  })
})

describe('addXp', () => {
  it('accumulates xp immutably', () => {
    expect(addXp(emptyStats(), 15).xp).toBe(15)
    expect(addXp(emptyStats(), 0).xp).toBe(0)
  })
})

describe('recordStudy', () => {
  it('first study sets streak to 1', () => {
    const s = recordStudy(emptyStats(), '2026-09-28')
    expect(s.streakDays).toBe(1)
    expect(s.lastStudyDate).toBe('2026-09-28')
    expect(s.reviewCount).toBe(1)
  })

  it('same-day study does not double-count the streak', () => {
    const once = recordStudy(emptyStats(), '2026-09-28')
    const twice = recordStudy(once, '2026-09-28')
    expect(twice.streakDays).toBe(1)
    expect(twice.reviewCount).toBe(2)
  })

  it('consecutive days increment the streak', () => {
    const day1 = recordStudy(emptyStats(), '2026-09-27')
    const day2 = recordStudy(day1, '2026-09-28')
    expect(day2.streakDays).toBe(2)
  })

  it('a gap resets the streak to 1', () => {
    const day1 = recordStudy(emptyStats(), '2026-09-25')
    const gap = recordStudy(day1, '2026-09-28')
    expect(gap.streakDays).toBe(1)
  })

  it('records daily history counts', () => {
    const s = recordStudy(recordStudy(emptyStats(), '2026-09-28'), '2026-09-28')
    expect(s.dailyHistory['2026-09-28']).toBe(2)
  })
})

describe('dateKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('loadStats', () => {
  it('returns empty stats when storage is missing', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(loadStats()).toEqual(emptyStats())
  })

  it('returns empty stats on corrupt JSON', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad json' } })
    expect(loadStats()).toEqual(emptyStats())
  })

  it('merges persisted fields over defaults', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ xp: 50, streakDays: 3 }) } })
    const s = loadStats()
    expect(s.xp).toBe(50)
    expect(s.streakDays).toBe(3)
    expect(s.dailyHistory).toEqual({})
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: FAIL（`Cannot find module './stats'`）

- [ ] **Step 3: 最小实现** `src/lib/stats.ts`

```ts
export interface Stats {
  xp: number
  streakDays: number
  lastStudyDate: string
  reviewCount: number
  dailyHistory: Record<string, number>
}

export function emptyStats(): Stats {
  return { xp: 0, streakDays: 0, lastStudyDate: '', reviewCount: 0, dailyHistory: {} }
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export function xpForLevel(level: number): number {
  return 100 * (level - 1) * (level - 1)
}

export function xpProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelForXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, current: xp - base, needed: next - base }
}

export function addXp(stats: Stats, amount: number): Stats {
  return { ...stats, xp: stats.xp + amount }
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function isYesterday(prev: string, today: string): boolean {
  if (!prev) return false
  return new Date(`${today}T00:00:00`).getTime() - new Date(`${prev}T00:00:00`).getTime() === 24 * 60 * 60 * 1000
}

export function recordStudy(stats: Stats, today: string, count = 1): Stats {
  const dailyHistory = { ...stats.dailyHistory, [today]: (stats.dailyHistory[today] ?? 0) + count }
  if (stats.lastStudyDate === today) {
    return { ...stats, reviewCount: stats.reviewCount + count, dailyHistory }
  }
  const streakDays = isYesterday(stats.lastStudyDate, today) ? stats.streakDays + 1 : 1
  return { ...stats, streakDays, lastStudyDate: today, reviewCount: stats.reviewCount + count, dailyHistory }
}

const STORAGE_KEY = 'stats:v1'

export function loadStats(): Stats {
  if (typeof window === 'undefined') return emptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const p = JSON.parse(raw) as Partial<Stats>
    return { ...emptyStats(), ...p, dailyHistory: p.dailyHistory ?? {} }
  } catch {
    return emptyStats()
  }
}

export function saveStats(stats: Stats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // storage unavailable — non-fatal
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS（12 tests）

- [ ] **Step 5: 验证**

Run: `npm run build`
Expected: 通过

---

### Task 3: 复习题型辅助（类型 / 干扰项 / XP 映射）

**Files:**
- Create: `src/lib/quiz.ts`
- Test: `src/lib/quiz.test.ts`

**Interfaces:**
- Consumes: `tokenize` / `wordTokens` / `normalize`（`src/lib/tokenize.ts`，已存在）。
- Produces: `QuizType = 'choice'|'flashcard'|'dictation'|'fillblank'`、`XP_BY_TYPE`、`XP_WRONG_FLOOR`、`xpForAnswer(type, q)`、`makeChoices(target, sentence, count=4): string[]`、`pickType(rng?): QuizType`、`blankSentence(sentence, word): string`。

- [ ] **Step 1: 写失败测试** `src/lib/quiz.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { makeChoices, pickType, xpForAnswer, blankSentence } from './quiz'
import { normalize } from './tokenize'

describe('makeChoices', () => {
  it('always includes the target exactly once and never duplicates', () => {
    const choices = makeChoices('throw', 'throw away your bad habits')
    expect(choices).toHaveLength(4)
    expect(choices.filter((c) => normalize(c) === 'throw')).toHaveLength(1)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })

  it('pads with fallback words when the sentence is too short', () => {
    const choices = makeChoices('go', 'go')
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map(normalize)).size).toBe(4)
  })
})

describe('pickType', () => {
  it('picks flashcard for low rng and choice for high rng', () => {
    expect(pickType(() => 0)).toBe('flashcard')
    expect(pickType(() => 0.99)).toBe('choice')
  })
})

describe('xpForAnswer', () => {
  it('gives floor XP on a lapse, full XP otherwise', () => {
    expect(xpForAnswer('choice', 1)).toBe(5)
    expect(xpForAnswer('choice', 4)).toBe(10)
    expect(xpForAnswer('flashcard', 5)).toBe(8)
  })
})

describe('blankSentence', () => {
  it('replaces the word with a blank, preserving surrounding text', () => {
    expect(blankSentence('Throw away!', 'throw')).toBe('______ away!')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/quiz.test.ts`
Expected: FAIL（`Cannot find module './quiz'`）

- [ ] **Step 3: 最小实现** `src/lib/quiz.ts`

```ts
import { tokenize, wordTokens, normalize } from './tokenize'

export type QuizType = 'choice' | 'flashcard' | 'dictation' | 'fillblank'

export const XP_BY_TYPE: Record<QuizType, number> = {
  flashcard: 8,
  choice: 10,
  dictation: 12,
  fillblank: 15,
}
export const XP_WRONG_FLOOR = 5

export function xpForAnswer(type: QuizType, q: number): number {
  return q < 3 ? XP_WRONG_FLOOR : XP_BY_TYPE[type]
}

const FALLBACK = ['often', 'always', 'again', 'together', 'quickly', 'between', 'without', 'across']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 返回 count 个选项（含唯一正确的 target），干扰项来自句子其它词，不足用 fallback 补齐。 */
export function makeChoices(target: string, sentence: string, count = 4): string[] {
  const seen = new Set<string>([normalize(target)])
  const distractors: string[] = []
  for (const w of wordTokens(tokenize(sentence))) {
    const n = normalize(w.text)
    if (!seen.has(n)) {
      seen.add(n)
      distractors.push(w.text)
    }
  }
  const pool = shuffle(distractors)
  let i = 0
  while (pool.length < count - 1) {
    const f = FALLBACK[i++ % FALLBACK.length]
    const n = normalize(f)
    if (!seen.has(n)) {
      seen.add(n)
      pool.push(f)
    }
  }
  return shuffle([target, ...pool.slice(0, count - 1)])
}

/** Phase 1 仅随机出 choice / flashcard（翻卡 60%）。 */
export function pickType(rng: () => number = Math.random): QuizType {
  return rng() < 0.6 ? 'flashcard' : 'choice'
}

/** 把句子里的目标词（首次出现，忽略大小写）替换为下划线空白。 */
export function blankSentence(sentence: string, word: string): string {
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (idx === -1) return sentence
  return sentence.slice(0, idx) + '______' + sentence.slice(idx + word.length)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/lib/quiz.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: 验证**

Run: `npm run build`
Expected: 通过

---

### Task 4: 错词模型 v2 + 迁移

**Files:**
- Modify: `src/lib/wrongbook.ts`（整体重写）
- Test: `src/lib/wrongbook.test.ts`（整体重写）

**Interfaces:**
- Consumes: `normalize`（tokenize）、`sm2Next` / `isMastered as sm2Mastered` / `DEFAULT_EASE` / `DAY_MS`（sm2）。
- Produces: `WrongEntry`（v2 字段，无 `status`）、`Quality = number`、`isMastered(e)`、`statusOf(e): 'new'|'learning'|'mastered'`、`isDue(e, now)`、`dueEntries(entries, now)`、`recordWrong(entries, input, now)`、`reviewEntry(entry, q, now)`、`groupBySentence(entries)`、`migrateV1(old: unknown[])`、`loadEntries()`、`saveEntries(entries)`。

- [ ] **Step 1: 写失败测试** `src/lib/wrongbook.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  recordWrong, reviewEntry, isDue, dueEntries, isMastered, statusOf, migrateV1, groupBySentence, loadEntries,
} from './wrongbook'
import type { WrongEntry } from './wrongbook'
import { DEFAULT_EASE, DAY_MS } from './sm2'

afterEach(() => { vi.unstubAllGlobals() })

const NOW = Date.UTC(2026, 0, 1)
const input = { en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0 }

function entry(overrides: Partial<WrongEntry> = {}): WrongEntry {
  return {
    key: 'throw away|0', en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0,
    addedAt: NOW, repetition: 0, intervalDays: 1, easeFactor: DEFAULT_EASE,
    dueAt: NOW + DAY_MS, reviews: 0, lapses: 0, lastReviewAt: 0,
    ...overrides,
  }
}

describe('recordWrong', () => {
  it('adds a new word with v2 defaults, due in 1 day', () => {
    const r = recordWrong([], input, NOW)
    expect(r).toHaveLength(1)
    expect(r[0].repetition).toBe(0)
    expect(r[0].dueAt).toBe(NOW + DAY_MS)
    expect(statusOf(r[0])).toBe('new')
  })

  it('dedupes on normalized text and preserves first-seen time', () => {
    const first = recordWrong([], input, NOW)
    const second = recordWrong(first, { ...input, en: '  Throw   Away ' }, NOW)
    expect(second).toHaveLength(1)
    expect(second[0].addedAt).toBe(NOW)
  })
})

describe('reviewEntry', () => {
  it('advances SM-2 state and records a review', () => {
    const r = reviewEntry(entry(), 4, NOW)
    expect(r.repetition).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.reviews).toBe(1)
    expect(r.dueAt).toBe(NOW + DAY_MS)
  })

  it('a lapse increments lapses and resets the interval', () => {
    const r = reviewEntry(entry({ repetition: 3, intervalDays: 10, reviews: 3 }), 2, NOW)
    expect(r.lapses).toBe(1)
    expect(r.repetition).toBe(0)
    expect(r.dueAt).toBe(NOW + DAY_MS)
  })

  it('marks mastered once the threshold is reached', () => {
    const r = reviewEntry(entry({ repetition: 3, intervalDays: 10 }), 5, NOW)
    expect(isMastered(r)).toBe(true)
    expect(r.dueAt).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('statusOf', () => {
  it('derives new / learning / mastered', () => {
    expect(statusOf(entry())).toBe('new')
    expect(statusOf(entry({ reviews: 1 }))).toBe('learning')
    expect(statusOf(entry({ repetition: 4, intervalDays: 21 }))).toBe('mastered')
  })
})

describe('isDue / dueEntries', () => {
  it('returns only unmastered, due entries', () => {
    const due = entry({ key: 'a|0', dueAt: NOW - 1 })
    const later = entry({ key: 'b|0', dueAt: NOW + DAY_MS })
    const mastered = entry({ key: 'c|0', repetition: 4, intervalDays: 21, dueAt: Number.MAX_SAFE_INTEGER })
    expect(dueEntries([due, later, mastered], NOW).map((e) => e.key)).toEqual(['a|0'])
  })
})

describe('migrateV1', () => {
  it('maps stage → repetition and nextReviewAt → dueAt', () => {
    const old = [{ key: 'throw away|0', en: 'throw away', zh: '扔掉', word: 'throw', wordIndex: 0, addedAt: NOW, stage: 3, nextReviewAt: NOW + 1000 }]
    const m = migrateV1(old)
    expect(m).toHaveLength(1)
    expect(m[0].repetition).toBe(3)
    expect(m[0].dueAt).toBe(NOW + 1000)
    expect(m[0].easeFactor).toBe(DEFAULT_EASE)
  })
})

describe('groupBySentence', () => {
  it('groups entries by sentence, preserving order', () => {
    const a0 = entry({ key: 'a|0', en: 'give up' })
    const a1 = entry({ key: 'a|1', en: 'give up', wordIndex: 1 })
    const b0 = entry({ key: 'b|0', en: 'stand by' })
    const g = groupBySentence([a0, b0, a1])
    expect(g.map((x) => x.en)).toEqual(['give up', 'stand by'])
    expect(g[0].entries).toHaveLength(2)
  })
})

describe('loadEntries', () => {
  it('migrates v1 data to v2 shape', () => {
    const v1 = JSON.stringify([{ key: 'a|0', en: 'a', zh: '甲', word: 'a', wordIndex: 0, addedAt: NOW, stage: 2, nextReviewAt: NOW + 10 }])
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'wrongbook:v2' ? null : v1) } })
    const loaded = loadEntries()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].repetition).toBe(2)
    expect(loaded[0].dueAt).toBe(NOW + 10)
  })

  it('returns [] on corrupt storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{bad' } })
    expect(loadEntries()).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/wrongbook.test.ts`
Expected: FAIL（旧 `WrongEntry` 无 `repetition` 等字段，编译/运行报错）

- [ ] **Step 3: 重写实现** `src/lib/wrongbook.ts`

```ts
import { normalize } from './tokenize'
import { sm2Next, isMastered as sm2Mastered, DEFAULT_EASE, DAY_MS } from './sm2'

export interface WrongEntry {
  key: string
  en: string
  zh: string
  word: string
  wordIndex: number
  addedAt: number
  repetition: number
  intervalDays: number
  easeFactor: number
  dueAt: number
  reviews: number
  lapses: number
  lastReviewAt: number
}

export type Quality = number

export function isMastered(e: WrongEntry): boolean {
  return sm2Mastered({ repetition: e.repetition, intervalDays: e.intervalDays, easeFactor: e.easeFactor })
}

export function statusOf(e: WrongEntry): 'new' | 'learning' | 'mastered' {
  if (isMastered(e)) return 'mastered'
  return e.reviews === 0 ? 'new' : 'learning'
}

export function isDue(e: WrongEntry, now: number): boolean {
  return !isMastered(e) && e.dueAt <= now
}

export function dueEntries(entries: WrongEntry[], now: number): WrongEntry[] {
  return entries.filter((e) => isDue(e, now))
}

function keyFor(en: string, wordIndex: number): string {
  return `${normalize(en)}|${wordIndex}`
}

export function recordWrong(
  entries: WrongEntry[],
  input: { en: string; zh: string; word: string; wordIndex: number },
  now: number,
): WrongEntry[] {
  const key = keyFor(input.en, input.wordIndex)
  const fresh: WrongEntry = {
    key, en: input.en, zh: input.zh, word: input.word, wordIndex: input.wordIndex,
    addedAt: now, repetition: 0, intervalDays: 1, easeFactor: DEFAULT_EASE,
    dueAt: now + DAY_MS, reviews: 0, lapses: 0, lastReviewAt: 0,
  }
  const index = entries.findIndex((e) => e.key === key)
  if (index === -1) return [...entries, fresh]
  const next = [...entries]
  next[index] = { ...fresh, addedAt: next[index].addedAt }
  return next
}

export function reviewEntry(entry: WrongEntry, q: Quality, now: number): WrongEntry {
  const srs = sm2Next(
    { repetition: entry.repetition, intervalDays: entry.intervalDays, easeFactor: entry.easeFactor },
    q,
  )
  const mastered = sm2Mastered(srs)
  return {
    ...entry,
    repetition: srs.repetition,
    intervalDays: srs.intervalDays,
    easeFactor: srs.easeFactor,
    dueAt: mastered ? Number.MAX_SAFE_INTEGER : now + srs.intervalDays * DAY_MS,
    reviews: entry.reviews + 1,
    lapses: entry.lapses + (q < 3 ? 1 : 0),
    lastReviewAt: now,
  }
}

export interface SentenceGroup { en: string; zh: string; entries: WrongEntry[] }

export function groupBySentence(entries: WrongEntry[]): SentenceGroup[] {
  const map = new Map<string, SentenceGroup>()
  for (const e of entries) {
    const g = map.get(e.en)
    if (g) g.entries.push(e)
    else map.set(e.en, { en: e.en, zh: e.zh, entries: [e] })
  }
  return [...map.values()]
}

const V2_KEY = 'wrongbook:v2'
const V1_KEY = 'wrongbook:v1'

export function migrateV1(old: unknown[]): WrongEntry[] {
  return old.map((raw) => {
    const o = raw as Record<string, unknown>
    const stage = typeof o.stage === 'number' ? o.stage : 0
    const nextReviewAt = typeof o.nextReviewAt === 'number' ? o.nextReviewAt : 0
    return {
      key: String(o.key ?? ''), en: String(o.en ?? ''), zh: String(o.zh ?? ''),
      word: String(o.word ?? ''), wordIndex: Number(o.wordIndex ?? 0),
      addedAt: Number(o.addedAt ?? 0), repetition: stage, intervalDays: 1,
      easeFactor: DEFAULT_EASE, dueAt: nextReviewAt, reviews: stage, lapses: 0, lastReviewAt: 0,
    }
  })
}

export function loadEntries(): WrongEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const v2 = window.localStorage.getItem(V2_KEY)
    if (v2) {
      const p: unknown = JSON.parse(v2)
      return Array.isArray(p) ? (p as WrongEntry[]) : []
    }
    const v1 = window.localStorage.getItem(V1_KEY)
    if (v1) {
      const p: unknown = JSON.parse(v1)
      return Array.isArray(p) ? migrateV1(p) : []
    }
    return []
  } catch {
    return []
  }
}

export function saveEntries(entries: WrongEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(V2_KEY, JSON.stringify(entries))
  } catch {
    // storage unavailable — non-fatal
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/lib/wrongbook.test.ts`
Expected: PASS（11 tests）

- [ ] **Step 5: 验证**

Run: `npm run build`
Expected: 通过

---

### Task 5: 四选一题型组件

**Files:**
- Create: `src/components/quiz/Choice.tsx`

**Interfaces:**
- Consumes: `WrongEntry`（wrongbook）、`makeChoices` / `blankSentence`（quiz）、`isCorrect`（tokenize）。
- Produces: `default export Choice({ entry, onResult })`，`onResult: (q: number) => void`，答对 q=4、答错 q=1。

- [ ] **Step 1: 创建组件**

```tsx
import { useMemo, useState } from 'react'
import type { WrongEntry } from '../../lib/wrongbook'
import { makeChoices, blankSentence } from '../../lib/quiz'
import { isCorrect } from '../../lib/tokenize'

interface Props {
  entry: WrongEntry
  onResult: (q: number) => void
}

export default function Choice({ entry, onResult }: Props) {
  const choices = useMemo(() => makeChoices(entry.word, entry.en), [entry])
  const [selected, setSelected] = useState<string | null>(null)
  const answered = selected !== null
  const sel = selected ?? ''
  const correct = answered && isCorrect(selected, entry.word)

  return (
    <section className="quiz-card">
      <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
      <p className="quiz-sentence">{blankSentence(entry.en, entry.word)}</p>

      <div className="quiz-options">
        {choices.map((c) => {
          const isSel = isCorrect(c, sel)
          const isAnswer = answered && isCorrect(c, entry.word)
          const cls = ['quiz-option', isAnswer ? 'is-correct' : '', isSel && !isAnswer ? 'is-wrong' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <button key={c} className={cls} disabled={answered} onClick={() => setSelected(c)}>
              {c}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="quiz-actions">
          <p className="result success" role="status">
            {correct ? '✓ 答对了' : `✗ 答案是 ${entry.word}`}
          </p>
          <button className="primary" onClick={() => onResult(correct ? 4 : 1)}>继续</button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run build`
Expected: 通过（组件尚未被引用，若 `noUnusedLocals` 不涉及，仅验证编译）

- [ ] **Step 3: 手动冒烟**（Task 9 接线后一起验）：四选一显示句子中文 + 空位英文句 + 4 个选项；点错标红、正确标绿，点「继续」回调。

---

### Task 6: 翻卡回忆题型组件

**Files:**
- Create: `src/components/quiz/Flashcard.tsx`

**Interfaces:**
- Consumes: `WrongEntry`、`blankSentence`（quiz）、`speak`（speech）。
- Produces: `default export Flashcard({ entry, onResult })`，自评四档：忘记 q=2 / 模糊 q=3 / 记得 q=4 / 轻松 q=5。

- [ ] **Step 1: 创建组件**

```tsx
import { useState } from 'react'
import type { WrongEntry } from '../../lib/wrongbook'
import { blankSentence } from '../../lib/quiz'
import { speak } from '../../lib/speech'

interface Props {
  entry: WrongEntry
  onResult: (q: number) => void
}

export default function Flashcard({ entry, onResult }: Props) {
  const [flipped, setFlipped] = useState(false)

  if (!flipped) {
    return (
      <section className="quiz-card">
        <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
        <p className="quiz-sentence">{blankSentence(entry.en, entry.word)}</p>
        <div className="flashcard-face" role="button" tabIndex={0} onClick={() => setFlipped(true)}>
          <p>先回想这个单词，再点我翻面</p>
          <span className="flashcard-hint">👆 翻面看答案</span>
        </div>
      </section>
    )
  }

  return (
    <section className="quiz-card">
      <p className="quiz-prompt">{entry.zh || '（无中文释义）'}</p>
      <button type="button" className="speak" onClick={() => speak(entry.word)}>🔊 听单词</button>
      <span className="quiz-word">{entry.word}</span>
      <p className="quiz-sentence">{entry.en}</p>
      <div className="rate-actions">
        <button className="ghost" onClick={() => onResult(2)}>忘记</button>
        <button className="ghost" onClick={() => onResult(3)}>模糊</button>
        <button className="ghost" onClick={() => onResult(4)}>记得</button>
        <button className="ghost" onClick={() => onResult(5)}>轻松</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run build`
Expected: 通过

- [ ] **Step 3: 手动冒烟**：正面显示中文 + 空位句，点翻面显示单词 + 四档自评按钮。

---

### Task 7: 今日复习会话

**Files:**
- Create: `src/components/ReviewSession.tsx`

**Interfaces:**
- Consumes: `WrongEntry`、`QuizType` / `pickType`（quiz）、`Choice` / `Flashcard`。
- Produces: `default export ReviewSession({ entries, onAnswer, onBack })`，`onAnswer: (key: string, type: QuizType, q: number) => number`（返回本次 XP）。空队列与完成态均需渲染。

- [ ] **Step 1: 创建组件**

```tsx
import { useState } from 'react'
import type { WrongEntry } from '../lib/wrongbook'
import type { QuizType } from '../lib/quiz'
import { pickType } from '../lib/quiz'
import Choice from './quiz/Choice'
import Flashcard from './quiz/Flashcard'

interface Props {
  entries: WrongEntry[]
  onAnswer: (key: string, type: QuizType, q: number) => number
  onBack: () => void
}

export default function ReviewSession({ entries, onAnswer, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [types] = useState<QuizType[]>(() => entries.map(() => pickType()))
  const [totalXp, setTotalXp] = useState(0)
  const [lastGain, setLastGain] = useState<number | null>(null)

  if (entries.length === 0) {
    return (
      <div className="review">
        <div className="game-top">
          <button className="ghost" onClick={onBack}>← 返回错题本</button>
        </div>
        <section className="game-card">
          <p className="result success" role="status">今日没有到期复习的内容。</p>
          <div className="game-actions">
            <button className="primary" onClick={onBack}>返回错题本</button>
          </div>
        </section>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="review">
        <section className="game-card">
          <p className="result success" role="status">🎉 本次复习完成！共 {entries.length} 题，+{totalXp} XP</p>
          <div className="game-actions">
            <button className="primary" onClick={onBack}>返回错题本</button>
          </div>
        </section>
      </div>
    )
  }

  const entry = entries[index]
  const type = types[index]

  function handleResult(q: number) {
    const xp = onAnswer(entry.key, type, q)
    setTotalXp((x) => x + xp)
    setLastGain(xp)
    if (index === entries.length - 1) setFinished(true)
    else setIndex(index + 1)
  }

  return (
    <div className="review">
      <div className="game-top">
        <button className="ghost" onClick={onBack}>← 返回错题本</button>
        <span className="progress">复习 {index + 1} / {entries.length}</span>
      </div>

      {lastGain !== null && <p className="xp-toast" role="status">+{lastGain} XP</p>}

      {type === 'choice'
        ? <Choice entry={entry} onResult={handleResult} />
        : <Flashcard entry={entry} onResult={handleResult} />}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run build`
Expected: 通过

- [ ] **Step 3: 手动冒烟**：空队列显示友好空状态；逐题出卡、答完显示 `+N XP`，末题显示完成汇总（共 N 题 +XP）。

---

### Task 8: 顶部连胜 / 等级条

**Files:**
- Create: `src/components/StreakBar.tsx`

**Interfaces:**
- Consumes: `Stats` / `xpProgress`（stats）。
- Produces: `default export StreakBar({ stats })`。

- [ ] **Step 1: 创建组件**

```tsx
import type { Stats } from '../lib/stats'
import { xpProgress } from '../lib/stats'

interface Props {
  stats: Stats
}

export default function StreakBar({ stats }: Props) {
  const { level, current, needed } = xpProgress(stats.xp)
  const pct = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0

  return (
    <div className="streak-bar">
      <span className="streak">🔥 {stats.streakDays} 天</span>
      <span className="level">Lv.{level}</span>
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="xp-text">{current}/{needed} XP</span>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run build`
Expected: 通过

- [ ] **Step 3: 手动冒烟**：显示 🔥 天数、等级、XP 进度条（Task 9 接线后验）。

---

### Task 9: 错题本页三标签重构

**Files:**
- Modify: `src/components/WrongbookScreen.tsx`（整体重写）

**Interfaces:**
- Consumes: `WrongEntry` / `dueEntries` / `isMastered`（wrongbook）、`Stats`、`StreakBar`。
- Produces: `default export WrongbookScreen({ entries, stats, onBack, onStartReview, onPractice, onClear })`。

- [ ] **Step 1: 重写组件**

```tsx
import { useState } from 'react'
import type { WrongEntry } from '../lib/wrongbook'
import { dueEntries, isMastered } from '../lib/wrongbook'
import type { Stats } from '../lib/stats'
import StreakBar from './StreakBar'

interface Props {
  entries: WrongEntry[]
  stats: Stats
  onBack: () => void
  onStartReview: () => void
  onPractice: (entry: WrongEntry) => void
  onClear: () => void
}

export default function WrongbookScreen({ entries, stats, onBack, onStartReview, onPractice, onClear }: Props) {
  const [tab, setTab] = useState<'review' | 'words'>('review')
  const now = Date.now()
  const due = dueEntries(entries, now)
  const masteredCount = entries.filter(isMastered).length
  const activeCount = entries.length - masteredCount
  const sorted = [...entries].sort((a, b) => a.dueAt - b.dueAt)

  function badge(e: WrongEntry): { text: string; cls: string } {
    if (isMastered(e)) return { text: '已掌握', cls: 'mastered' }
    if (e.dueAt <= now) return { text: '今日待复习', cls: 'due' }
    return { text: '学习中', cls: 'soon' }
  }

  return (
    <div className="wrongbook">
      <header className="list-head">
        <div>
          <h1 className="title">📒 错题本</h1>
          <StreakBar stats={stats} />
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <div className="tab-row">
        <button className={`tab ${tab === 'review' ? 'is-active' : ''}`} onClick={() => setTab('review')}>今日复习</button>
        <button className={`tab ${tab === 'words' ? 'is-active' : ''}`} onClick={() => setTab('words')}>我的错词</button>
      </div>

      {tab === 'review' ? (
        <div className="review-tab">
          <div className="stat-row">
            <div className="stat"><span className="stat-num">{due.length}</span><span className="stat-label">待复习</span></div>
            <div className="stat"><span className="stat-num">{activeCount}</span><span className="stat-label">学习中</span></div>
            <div className="stat"><span className="stat-num">{masteredCount}</span><span className="stat-label">已掌握</span></div>
          </div>
          <div className="review-actions">
            {due.length > 0 ? (
              <button className="primary" onClick={onStartReview}>开始今日复习（{due.length}）</button>
            ) : (
              <p className="format-note">今日复习已完成 🎉 明天再来，或去「我的错词」随时练习。</p>
            )}
          </div>
        </div>
      ) : (
        <div className="words-tab">
          {entries.length === 0 ? (
            <div className="empty"><p>错题本是空的。练习时填错的单词会自动收进来。</p></div>
          ) : (
            <>
              <ul className="sentence-list">
                {sorted.map((e) => {
                  const b = badge(e)
                  return (
                    <li key={e.key}>
                      <button className="entry-card" onClick={() => onPractice(e)}>
                        <div className="entry-top">
                          <span className="entry-word">{e.word}</span>
                          <span className={`badge ${b.cls}`}>{b.text}</span>
                        </div>
                        <span className="entry-en">{e.en}</span>
                        <span className="entry-zh">{e.zh}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="clear-row">
                <button
                  className="ghost"
                  onClick={() => { if (window.confirm('确定清空错题本？此操作不可恢复。')) onClear() }}
                >
                  清空错题本
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run build`
Expected: 通过

- [ ] **Step 3: 手动冒烟**：两标签可切换；「今日复习」显示三计数 + 开始按钮；「我的错词」显示词条列表 + 清空。

---

### Task 10: App 接线 + 统计持久化 + 删除旧 ReviewScreen

**Files:**
- Modify: `src/App.tsx`（重写状态与路由）
- Delete: `src/components/ReviewScreen.tsx`

**Interfaces:**
- Consumes: `loadStats/saveStats/addXp/recordStudy/dateKey`（stats）、`xpForAnswer` + `QuizType`（quiz）、`reviewEntry/dueEntries/loadEntries/saveEntries/recordWrong`（wrongbook）、`ReviewSession`、新 `WrongbookScreen`。
- Produces: 应用路由 `view ∈ {library,name,list,play,wrongbook,review}`，`handleAnswer(key, type, q): number`。

- [ ] **Step 1: 重写 `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { ParseResult } from './types'
import TemplateLibrary from './components/TemplateLibrary'
import NamePrompt from './components/NamePrompt'
import SentenceList from './components/SentenceList'
import GameScreen from './components/GameScreen'
import WrongbookScreen from './components/WrongbookScreen'
import ReviewSession from './components/ReviewSession'
import type { WrongWord } from './components/SentenceQuiz'
import { loadTemplates, saveTemplates, makeTemplate } from './lib/templates'
import type { Template, TemplateSort } from './lib/templates'
import { loadEntries, saveEntries, recordWrong, reviewEntry, dueEntries } from './lib/wrongbook'
import type { WrongEntry } from './lib/wrongbook'
import { loadStats, saveStats, addXp, recordStudy, dateKey } from './lib/stats'
import type { Stats } from './lib/stats'
import type { QuizType } from './lib/quiz'
import { xpForAnswer } from './lib/quiz'
import './App.css'

type View = 'library' | 'name' | 'list' | 'play' | 'wrongbook' | 'review'

function App() {
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates())
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ result: ParseResult; fileName: string } | null>(null)
  const [sort, setSort] = useState<TemplateSort>('time')
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [view, setView] = useState<View>('library')
  const [entries, setEntries] = useState<WrongEntry[]>(() => loadEntries())
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [reviewEntries, setReviewEntries] = useState<WrongEntry[]>([])

  useEffect(() => { saveTemplates(templates) }, [templates])
  useEffect(() => { saveEntries(entries) }, [entries])
  useEffect(() => { saveStats(stats) }, [stats])

  function handleParsed(result: ParseResult, fileName: string) {
    setPendingUpload({ result, fileName })
    setView('name')
  }
  function handleNameConfirm(name: string) {
    if (!pendingUpload) return
    const template = makeTemplate(name, pendingUpload.result.items, pendingUpload.result.warnings, Date.now())
    setTemplates((prev) => [...prev, template])
    setCurrentTemplate(template)
    setPendingUpload(null)
    setCurrentIndex(null)
    setView('list')
  }
  function handleNameCancel() { setPendingUpload(null); setView('library') }
  function handleOpenTemplate(template: Template) { setCurrentTemplate(template); setCurrentIndex(null); setView('list') }
  function handleRename(id: string, name: string) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)))
    setCurrentTemplate((prev) => (prev && prev.id === id ? { ...prev, name } : prev))
  }
  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setCurrentTemplate((prev) => (prev && prev.id === id ? null : prev))
  }
  function handleSelect(index: number) { setCurrentIndex(index); setView('play') }
  function goList() { setCurrentIndex(null); setView('list') }
  function goLibrary() { setCurrentIndex(null); setView('library') }
  function handleNext() {
    if (currentIndex === null || !currentTemplate) return
    if (currentIndex < currentTemplate.items.length - 1) setCurrentIndex(currentIndex + 1)
    else goList()
  }
  function handleWrongWords(wrongs: WrongWord[]) {
    if (currentIndex === null || !currentTemplate) return
    const item = currentTemplate.items[currentIndex]
    if (!item) return
    const now = Date.now()
    setEntries((prev) => wrongs.reduce((acc, w) => recordWrong(acc, { en: item.en, zh: item.zh, word: w.word, wordIndex: w.wordIndex }, now), prev))
  }
  function handleStartReview() {
    setReviewEntries(dueEntries(entries, Date.now()))
    setView('review')
  }
  function handlePractice(entry: WrongEntry) {
    setReviewEntries([entry])
    setView('review')
  }
  function handleAnswer(key: string, type: QuizType, q: number): number {
    const now = Date.now()
    const target = entries.find((e) => e.key === key)
    if (!target) return 0
    const xp = xpForAnswer(type, q)
    setEntries((prev) => prev.map((e) => (e.key === key ? reviewEntry(e, q, now) : e)))
    setStats((prev) => recordStudy(addXp(prev, xp), dateKey(new Date(now))))
    return xp
  }
  function handleClear() { setEntries([]) }

  let screen
  if (view === 'play' && currentIndex !== null && currentTemplate) {
    screen = (
      <GameScreen key={currentIndex} item={currentTemplate.items[currentIndex]} index={currentIndex}
        total={currentTemplate.items.length} onNext={handleNext} onBack={goList} onWrongWords={handleWrongWords} />
    )
  } else if (view === 'name' && pendingUpload) {
    screen = <NamePrompt fileName={pendingUpload.fileName} count={pendingUpload.result.items.length} onConfirm={handleNameConfirm} onCancel={handleNameCancel} />
  } else if (view === 'list' && currentTemplate) {
    screen = <SentenceList templateName={currentTemplate.name} items={currentTemplate.items} warnings={currentTemplate.warnings} onSelect={handleSelect} onBack={goLibrary} />
  } else if (view === 'wrongbook') {
    screen = <WrongbookScreen entries={entries} stats={stats} onBack={goLibrary} onStartReview={handleStartReview} onPractice={handlePractice} onClear={handleClear} />
  } else if (view === 'review') {
    screen = <ReviewSession entries={reviewEntries} onAnswer={handleAnswer} onBack={() => setView('wrongbook')} />
  } else {
    screen = (
      <TemplateLibrary templates={templates} sort={sort} onSortChange={setSort} onParsed={handleParsed}
        onOpenTemplate={handleOpenTemplate} onRename={handleRename} onDelete={handleDelete} onOpenWrongbook={() => setView('wrongbook')} />
    )
  }

  return <div className="app">{screen}</div>
}

export default App
```

- [ ] **Step 2: 删除 `src/components/ReviewScreen.tsx`**

```bash
rm src/components/ReviewScreen.tsx
```

- [ ] **Step 3: 类型检查**

Run: `npm run build`
Expected: 通过（若报 `ReviewItem` 未用等，一并清理引用）

- [ ] **Step 4: 手动冒烟**：主游戏填错 → 进错题本 → 出现词条；点「开始今日复习」→ 混合出卡 → 答完 `+XP` 且连胜/等级更新；「我的错词」点词条单练；刷新页面 XP/连胜/词条仍在。

---

### Task 11: 样式 + 全量验证

**Files:**
- Modify: `src/App.css`（追加）

- [ ] **Step 1: 追加样式**

```css
/* ---------- Wrongbook v2: tabs, streak, quiz ---------- */

.tab-row {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 0;
  font-size: 0.95rem;
}

.tab.is-active {
  color: var(--ink);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, transparent);
}

.streak-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 0.9rem;
}

.streak { font-weight: 700; }
.level { color: var(--muted); }

.xp-bar {
  flex: 1;
  height: 8px;
  background: var(--line);
  border-radius: 999px;
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.3s;
}

.xp-text { color: var(--muted); font-variant-numeric: tabular-nums; }

.review-tab, .words-tab { animation: none; }

.quiz-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 32px 28px 28px;
  box-shadow: 0 10px 32px oklch(0 0 0 / 0.05);
  text-align: center;
}

.quiz-prompt {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 10px;
}

.quiz-sentence {
  font-family: var(--font-serif);
  color: var(--muted);
  margin: 0 0 22px;
  font-size: 1.05rem;
}

.quiz-word {
  display: block;
  font-family: var(--font-serif);
  font-size: 1.8rem;
  font-weight: 700;
  margin: 8px 0;
}

.quiz-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 18px;
}

.quiz-option {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--ink);
  transition: border-color 0.2s, background 0.2s;
}

.quiz-option:hover:not(:disabled) { border-color: var(--accent); }

.quiz-option.is-correct {
  border-color: var(--correct);
  color: var(--correct);
  background: var(--correct-bg);
}

.quiz-option.is-wrong {
  border-color: var(--wrong);
  color: var(--wrong);
  background: var(--wrong-bg);
}

.quiz-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }

.flashcard-face {
  background: var(--bg);
  border: 2px dashed var(--line);
  border-radius: 14px;
  padding: 28px 16px;
  cursor: pointer;
  color: var(--muted);
}

.flashcard-face:hover { border-color: var(--accent); }
.flashcard-hint { font-size: 0.85rem; }

.rate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
}

.xp-toast {
  text-align: center;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 12px;
  animation: xp-pop 0.4s ease;
}

@keyframes xp-pop {
  from { transform: translateY(6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 480px) {
  .quiz-options { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: 全部测试文件通过（新增 sm2.test.ts / stats.test.ts / quiz.test.ts，重写 wrongbook.test.ts，既有测试不受影响）

- [ ] **Step 3: 全量构建**

Run: `npm run build`
Expected: 通过

- [ ] **Step 4: 端到端手动冒烟**

Run: `npm run dev`，浏览器验证：主游戏填错入本 → 错题本「今日复习」混合出卡 → 答完 XP/连胜/等级更新 → 刷新持久化 → 「我的错词」点词条单练 → 清空。

---
