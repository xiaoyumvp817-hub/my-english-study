# 账号 + 好友 + PK 背单词 + 排行榜 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让孩子能用邮箱密码注册/登录独立账号，账号之间互加好友、异步 PK 背单词、按累计背单词数在好友榜/全球榜排名；未登录仍保留现有「游客模式」本地数据。

**Architecture:** 引入 Supabase 作为托管后端（Auth + PostgreSQL + 行级安全 RLS）。前端新增一个类型化数据访问层 `supabase.ts`（映射行 ↔ 领域对象 + 高层 CRUD 接口 `CloudApi`），一个统一读写编排层 `dataStore.ts`（登录走云端 + 同步镜像 localStorage，游客走 localStorage），纯逻辑（好友码、对战判胜、排行榜排序、本地→云端合并）拆成独立可测模块。UI 复用现有点选/默写流程（`GameScreen`/`SentenceQuiz`/`SelectionReview`）做 PK 答题。

**Tech Stack:** React 19 + TypeScript + Vite 8 + Vitest 5（现状）；唯一新增运行时依赖 `@supabase/supabase-js`（v2）。

**Spec:**
- [docs/specs/2026-10-09-friends-pvp-leaderboard-design.md](../../specs/2026-10-09-friends-pvp-leaderboard-design.md)（本计划主体）
- [docs/specs/2026-09-30-login-sync-design.md](../../specs/2026-09-30-login-sync-design.md)（账号/同步前置，Phase 1 实现）

本计划实现**两份 spec**：Phase 1（Task 1–6）实现 login-sync 的账号 + 跨设备同步；Phase 2（Task 7–13）在其上实现 friends spec 的社交层。

---

## Global Constraints

- **唯一新增依赖**：`@supabase/supabase-js`（v2）。不得再引入其它运行时依赖（无 testing-library、无状态库、无路由库——hash 路由手写）。
- **TS 严格约束**：`verbatimModuleSyntax` 开启 → 类型导入一律 `import type`；`noUnusedLocals`/`noUnusedParameters` 开启 → 不留死代码；`erasableSyntaxOnly` 开启 → 不用 `enum`/`namespace`。
- **环境变量**：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 放 `.env.local`（已被 `*.local` gitignore）。anon key 公开无害（RLS 兜底）；`service_role` 永不进前端。代码里对缺 env 要优雅降级（返回「未配置」而非抛错崩溃）。
- **隐私红线**：全球榜/好友榜只展示 `display_name` + `total_learned`，**任何 UI/映射不得把邮箱放进 profiles 表或排行榜渲染**。
- **RLS 语义**：自有数据 `auth.uid() = user_id`；`profiles` 公开只读；`challenges` 仅双方；`friendships` 见 Task 1 的修正模型。
- **测试约定**：本仓库所有测试都在 `src/lib/*.test.ts`、跑在 **node 环境**（vite.config.ts 无 `environment`，默认 node）。纯逻辑放 `src/lib` 并写测试；组件是薄接线，用 `tsc -b && vite build` + 手动 `npm run dev` 验证（与 motivation 功能一致，无组件测试基建）。
- **文案**：UI 文案中文，复用现有 OKLCH token 与 `primary`/`ghost`/卡片类（见 `src/App.css`）。
- **纯逻辑不动**：`stats.ts`/`wrongbook.ts`/`templates.ts`/`learned.ts`/`motivation.ts`/`tokenize.ts`/`quiz.ts` 的现有函数**不改**，只新增；SM-2、streak、归一化、成就判定全部复用。

---

## Review Focus

这五类输入/失效模式，spec 里没点名、任务内测不到，最可能坑到真实用户——由对应任务的测试钉住：

1. **排行榜泄露邮箱**：`profiles` 表只有 `display_name`/`friend_code`/`total_learned` 三列，但映射与 UI 必须确保渲染不经过邮箱字段。→ Task 3 测试 `profileRowToProfile` 丢弃多余列、只保留三字段 + user_id。
2. **好友码冲突**：8 位码唯一索引撞上时 `ensureProfile` 必须重新生成重试，不能崩。→ Task 2 测试 `generateUniqueFriendCode`（`isTaken` 前几次返回 true 时重试、全占用时抛错）。
3. **加自己为好友**：输入自己的好友码必须被拒绝。→ Task 2 测试 `assertNotSelf(userId, userId)` 抛错。
4. **未应战的挑战判胜**：`challengeWinner` 在 `challengee_score === null` 时必须返回 `null`，不能被当成平局展示成「0:0 平局」。→ Task 7 测试。
5. **本地→云端导入静默丢数据**：合并按 `key` 去重（云端优先）、模板追加、`daily_history` 按天取最大值，不能直接覆盖。→ Task 4 测试。
6. **刷新后登录态丢失**：页面刷新要 `getSession()` 恢复会话，用户不重新登录。→ 无单元测试（supabase-js 集成层），由 Task 13 手动联调清单「刷新页面登录态保持」覆盖。

---

## Task 1: 数据库 schema（`supabase/schema.sql`）

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: 8 张表 + RLS，后续所有 `CloudApi` 实现的表结构依据。列名必须与 Task 3/9 的行类型严格一致（`user_id`、`total_learned`、`friend_code`、`challenger_id` 等）。

> **TDD 例外**：这是 SQL 配置/DDL，无 vitest 测试（配置类，符合 TDD 例外）。验证方式 = 逐条 review + 你在 Supabase SQL Editor 手动跑通。本任务把 SQL 落库版本化，供你直接粘贴执行。

**设计修正（相对 spec §4.2）**：spec 的 `friendships` 用「双向两行 `(A,B)` + `(B,A)`」，但它的 RLS 策略 `with check (auth.uid() = user_id)` 会让 A 无法插入 `(B,A)` 这一行（user_id=B，A≠B），互相加好友直接失败。本计划改为**规范单行模型**：一行 `(user_a, user_b)`，`check (user_a < user_b)` 保证无序，RLS `auth.uid() in (user_a, user_b)` 覆盖双方读写。加好友 = 一次 insert，列好友 = 取「非本人那一侧」。

- [ ] **Step 1: 创建 `supabase/schema.sql`**

```sql
-- 账号 + 好友 + PK + 排行榜 —— 建表与 RLS
-- 在 Supabase SQL Editor 一次性执行。
create extension if not exists pgcrypto;

-- ===== Phase 1: 账号与同步（login-sync spec） =====

create table public.templates (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at bigint not null,
  items jsonb not null,
  warnings jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.wrong_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  en text not null,
  zh text not null,
  word text not null,
  word_index int not null,
  added_at bigint not null,
  repetition int not null,
  interval_days int not null,
  ease_factor double precision not null,
  due_at bigint not null,
  reviews int not null,
  lapses int not null,
  last_review_at bigint not null,
  unique (user_id, key)
);

create table public.stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0,
  streak_days int not null default 0,
  total_learned int not null default 0,
  last_study_date text not null default '',
  daily_history jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.learned (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table public.motivation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_per_day int not null default 5,
  makeup_cards int not null default 0,
  awarded_milestones int not null default 0,
  seen_achievements jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ===== Phase 2: 社交层（friends spec） =====

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  friend_code text not null unique,
  total_learned int not null default 0,
  created_at timestamptz not null default now()
);

-- 规范单行模型（修正 spec §4.2 的双向两行 + RLS 插入缺陷）
create table public.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  challengee_id uuid not null references auth.users(id) on delete cascade,
  words jsonb not null,
  challenger_score int not null,
  challenger_duration_ms int not null,
  challengee_score int null,
  challengee_duration_ms int null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

-- ===== RLS =====

alter table public.templates enable row level security;
alter table public.wrong_entries enable row level security;
alter table public.stats enable row level security;
alter table public.learned enable row level security;
alter table public.motivation enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.challenges enable row level security;

-- 自有数据：本人独占
create policy "own templates" on public.templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own wrong_entries" on public.wrong_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stats" on public.stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own learned" on public.learned for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own motivation" on public.motivation for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles：本人可读写，他人只读（仅 display_name/friend_code/total_learned 公开，无邮箱列）
create policy "own profile" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public profile read" on public.profiles for select using (true);

-- friendships：任一侧可读写
create policy "friendships either side" on public.friendships
  for all using (auth.uid() in (user_a, user_b)) with check (auth.uid() in (user_a, user_b));

-- challenges：仅对战双方
create policy "participant challenges" on public.challenges
  for all using (auth.uid() in (challenger_id, challengee_id))
  with check (auth.uid() in (challenger_id, challengee_id));

-- ===== 排行榜冗余列自动同步 =====
-- profiles.total_learned 由 stats.total_learned 触发器维护（服务端权威，避免客户端漏推）。
-- security definer 绕过 RLS；客户端 pushStats 后排行榜自动正确。
create or replace function public.sync_profile_total_learned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set total_learned = new.total_learned where user_id = new.user_id;
  return new;
end;
$$;

create trigger stats_total_learned_sync
after insert or update of total_learned on public.stats
for each row execute function public.sync_profile_total_learned();
```

- [ ] **Step 2: 自审** — 逐表核对列名与 Task 3/9 行类型一致；确认 `profiles` 无邮箱列；确认 `friendships` 有 `check (user_a < user_b)` 与「任一侧」策略。

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: 账号/好友/PK 数据库 schema 与 RLS"
```

---

## Task 2: 好友码纯函数（`src/lib/friendCode.ts`）

**Files:**
- Create: `src/lib/friendCode.ts`
- Test: `src/lib/friendCode.test.ts`

**Interfaces:**
- Produces: `generateFriendCode(rng?)`, `normalizeFriendCode(input)`, `isValidFriendCode(code)`, `generateUniqueFriendCode(isTaken, rng?, maxRetries?)`, `assertNotSelf(userId, friendId)`。被 Task 6（AuthScreen 展示我的码）、Task 9（`ensureProfile` 用 `generateUniqueFriendCode` 生成码、`getProfileByCode` 用 `normalizeFriendCode` 校验码、`addFriendship` 用 `assertNotSelf` 拒绝自己）、Task 10（输入框校验）消费。

- [ ] **Step 1: 写失败测试** — `src/lib/friendCode.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { generateFriendCode, normalizeFriendCode, isValidFriendCode, generateUniqueFriendCode, assertNotSelf } from './friendCode'

describe('generateFriendCode', () => {
  it('生成 8 位码', () => {
    expect(generateFriendCode()).toHaveLength(8)
  })
  it('只含字母数字（无易混淆 I/O/0/1）', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateFriendCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    }
  })
  it('用注入 rng 时结果确定', () => {
    const rng = () => 0 // 永远取字母表第 0 位 'A'
    expect(generateFriendCode(rng)).toBe('AAAAAAAA')
  })
})

describe('normalizeFriendCode', () => {
  it('转大写并去掉非字母数字', () => {
    expect(normalizeFriendCode(' k7p3-qm9a ')).toBe('K7P3QM9A')
  })
})

describe('isValidFriendCode', () => {
  it('8 位为真，其余为假', () => {
    expect(isValidFriendCode('K7P3QM9A')).toBe(true)
    expect(isValidFriendCode('ABC')).toBe(false)
    expect(isValidFriendCode('')).toBe(false)
  })
})

describe('generateUniqueFriendCode', () => {
  it('未占用时直接返回', async () => {
    await expect(generateUniqueFriendCode(async () => false, () => 0)).resolves.toBe('AAAAAAAA')
  })
  it('首次被占用则重试一次', async () => {
    const calls: string[] = []
    const isTaken = async (c: string) => { calls.push(c); return calls.length === 1 }
    await generateUniqueFriendCode(isTaken, () => 0, 5)
    expect(calls.length).toBe(2)
  })
  it('全部占用则抛错', async () => {
    await expect(generateUniqueFriendCode(async () => true, () => 0, 3)).rejects.toThrow('好友码生成失败')
  })
})

describe('assertNotSelf', () => {
  it('加自己抛错，加别人不抛', () => {
    expect(() => assertNotSelf('a', 'a')).toThrow('不能添加自己为好友')
    expect(() => assertNotSelf('a', 'b')).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/friendCode.test.ts` → Expected: FAIL（`generateFriendCode is not defined`）。

- [ ] **Step 3: 实现** — `src/lib/friendCode.ts`

```ts
// 去掉易混淆的 I / O / 0 / 1，纯大写字母 + 数字，32 个字符。
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LENGTH = 8

export function generateFriendCode(rng: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  }
  return out
}

export function normalizeFriendCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidFriendCode(code: string): boolean {
  return normalizeFriendCode(code).length === LENGTH
}

/** 生成一个未被占用的好友码；`isTaken` 为真则重试，最多 `maxRetries` 次，仍占用则抛错。 */
export async function generateUniqueFriendCode(
  isTaken: (code: string) => Promise<boolean>,
  rng: () => number = Math.random,
  maxRetries = 5,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateFriendCode(rng)
    if (!(await isTaken(code))) return code
  }
  throw new Error('好友码生成失败')
}

/** 禁止添加自己为好友。 */
export function assertNotSelf(userId: string, friendId: string): void {
  if (userId === friendId) throw new Error('不能添加自己为好友')
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/friendCode.test.ts` → Expected: PASS（4 项）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/friendCode.ts src/lib/friendCode.test.ts
git commit -m "feat: 好友码生成/规范化/校验纯函数"
```

---

## Task 3: Supabase 客户端 + 行 ↔ 领域映射（`src/lib/supabase.ts` 核心）

**Files:**
- Create: `src/lib/supabase.ts`
- Test: `src/lib/supabase.test.ts`
- Modify: `package.json`（安装依赖）

**Interfaces:**
- Consumes: 现有领域类型 `Template`（`./templates`）、`WrongEntry`（`./wrongbook`）、`Stats`（`./stats`）、`Motivation`（`./motivation`）、`normalizeFriendCode`（`./friendCode`）、`Challenge`/`snapshotWords`（Task 7，本任务先用 `import type` 占位，Task 7 落地后由它提供）。
- Produces:
  - 行类型：`TemplatesRow`、`WrongEntryRow`、`StatsRow`、`LearnedRow`、`MotivationRow`、`ProfileRow`、`FriendshipRow`、`ChallengeRow`。
  - 领域类型：`Profile`。
  - 纯映射：`templateToRow`/`templateFromRow`、`entryToRow`/`entryFromRow`、`statsToRow`/`statsFromRow`、`motivationToRow`/`motivationFromRow`、`learnedToRow`/`learnedFromRow`、`profileRowToProfile`。
  - `CloudApi` 接口（Task 5/6/9 依赖）。
  - `createSupabaseClient()`、`createCloudApi(client)`。

> 本任务只做**映射 + 类型 + 接口定义 + 客户端工厂**。`CloudApi` 的 sync 方法实现（`fetchTemplates`/`pushTemplates` 等）在 Task 5 需要它们之前不实现，先写映射与类型，接口方法签名在此锁定。**任务内 TDD 的是纯映射函数**；`createCloudApi` 里对 supabase-js 的流式调用是薄适配层，靠 build + 有真实 Supabase 后手动联调验证（见 Review Focus 说明）。

- [ ] **Step 1: 装依赖**

Run: `npm install @supabase/supabase-js` → Expected: 安装成功，`package.json` 增加依赖。

- [ ] **Step 2: 写失败测试** — `src/lib/supabase.test.ts`（先只测映射）

```ts
import { describe, it, expect } from 'vitest'
import {
  templateToRow, templateFromRow,
  entryToRow, entryFromRow,
  statsToRow, statsFromRow,
  motivationToRow, motivationFromRow,
  profileRowToProfile,
} from './supabase'
import { emptyStats } from './stats'
import { emptyMotivation } from './motivation'
import type { WrongEntry } from './wrongbook'

const USER = '11111111-2222-3333-4444-555555555555'

describe('template 映射', () => {
  it('往返不变', () => {
    const t = { id: 'tpl-1', name: 'U5', createdAt: 123, items: [{ id: 'i1', en: 'hello', zh: '你好' }], warnings: ['w1'] }
    expect(templateFromRow(templateToRow(USER, t))).toEqual(t)
  })
})

describe('entry 映射', () => {
  const e: WrongEntry = { key: 'hello|0', en: 'hello', zh: '你好', word: 'hello', wordIndex: 0, addedAt: 1, repetition: 0, intervalDays: 1, easeFactor: 2.5, dueAt: 3, reviews: 0, lapses: 0, lastReviewAt: 0 }
  it('往返不变', () => {
    expect(entryFromRow(entryToRow(USER, e))).toEqual(e)
  })
})

describe('stats 映射', () => {
  it('往返不变', () => {
    const s = { ...emptyStats(), xp: 10, totalLearned: 3, dailyHistory: { '2026-10-09': 2 } }
    expect(statsFromRow(statsToRow(USER, s))).toEqual(s)
  })
})

describe('motivation 映射', () => {
  it('往返不变', () => {
    const m = { ...emptyMotivation(), goalPerDay: 10, seenAchievements: ['a', 'b'] }
    expect(motivationFromRow(motivationToRow(USER, m))).toEqual(m)
  })
})

describe('profileRowToProfile', () => {
  it('只保留公开字段', () => {
    const row = { user_id: USER, display_name: '小明', friend_code: 'K7P3QM9A', total_learned: 42, created_at: '2026-10-09', email: 'leak@x.com' }
    expect(profileRowToProfile(row)).toEqual({ userId: USER, displayName: '小明', friendCode: 'K7P3QM9A', totalLearned: 42 })
  })
})
```

- [ ] **Step 3: 跑测试确认失败** — Run: `npx vitest run src/lib/supabase.test.ts` → Expected: FAIL（`templateToRow is not defined`）。

- [ ] **Step 4: 实现** — `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'
import { normalizeFriendCode, generateUniqueFriendCode, assertNotSelf } from './friendCode'
import type { Challenge } from './challenge'

const USER = 'user_id'

// ===== 行类型（与 supabase/schema.sql 列一一对应） =====
export interface TemplatesRow {
  id: string
  user_id: string
  name: string
  created_at: number
  items: unknown
  warnings: unknown
  updated_at?: string
}
export interface WrongEntryRow {
  id?: string
  user_id: string
  key: string
  en: string
  zh: string
  word: string
  word_index: number
  added_at: number
  repetition: number
  interval_days: number
  ease_factor: number
  due_at: number
  reviews: number
  lapses: number
  last_review_at: number
}
export interface StatsRow {
  user_id: string
  xp: number
  streak_days: number
  total_learned: number
  last_study_date: string
  daily_history: unknown
  updated_at?: string
}
export interface LearnedRow {
  user_id: string
  items: unknown
  updated_at?: string
}
export interface MotivationRow {
  user_id: string
  goal_per_day: number
  makeup_cards: number
  awarded_milestones: number
  seen_achievements: unknown
  updated_at?: string
}
export interface ProfileRow {
  user_id: string
  display_name: string
  friend_code: string
  total_learned: number
  created_at?: string
}
export interface FriendshipRow {
  user_a: string
  user_b: string
  created_at?: string
}
export interface ChallengeRow {
  id: string
  challenger_id: string
  challengee_id: string
  words: unknown
  challenger_score: number
  challenger_duration_ms: number
  challengee_score: number | null
  challengee_duration_ms: number | null
  status: string
  created_at: string
  completed_at: string | null
}

// ===== 领域类型 =====
export interface Profile {
  userId: string
  displayName: string
  friendCode: string
  totalLearned: number
}

// ===== 行 ↔ 领域映射（纯函数，测试覆盖） =====
function asArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback
}
function asRecord(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}

export function templateToRow(userId: string, t: Template): TemplatesRow {
  return { id: t.id, user_id: userId, name: t.name, created_at: t.createdAt, items: t.items, warnings: t.warnings }
}
export function templateFromRow(r: TemplatesRow): Template {
  return { id: r.id, name: r.name, createdAt: r.created_at, items: asArray<Template['items'][number]>(r.items, []), warnings: asArray<string>(r.warnings, []) }
}

export function entryToRow(userId: string, e: WrongEntry): WrongEntryRow {
  return {
    user_id: userId, key: e.key, en: e.en, zh: e.zh, word: e.word, word_index: e.wordIndex,
    added_at: e.addedAt, repetition: e.repetition, interval_days: e.intervalDays,
    ease_factor: e.easeFactor, due_at: e.dueAt, reviews: e.reviews, lapses: e.lapses, last_review_at: e.lastReviewAt,
  }
}
export function entryFromRow(r: WrongEntryRow): WrongEntry {
  return {
    key: r.key, en: r.en, zh: r.zh, word: r.word, wordIndex: r.word_index,
    addedAt: r.added_at, repetition: r.repetition, intervalDays: r.interval_days,
    easeFactor: r.ease_factor, dueAt: r.due_at, reviews: r.reviews, lapses: r.lapses, lastReviewAt: r.last_review_at,
  }
}

export function statsToRow(userId: string, s: Stats): StatsRow {
  return { user_id: userId, xp: s.xp, streak_days: s.streakDays, total_learned: s.totalLearned, last_study_date: s.lastStudyDate, daily_history: s.dailyHistory }
}
export function statsFromRow(r: StatsRow): Stats {
  return { xp: r.xp, streakDays: r.streak_days, totalLearned: r.total_learned, lastStudyDate: r.last_study_date, dailyHistory: asRecord(r.daily_history) }
}

export function learnedToRow(userId: string, items: string[]): LearnedRow {
  return { user_id: userId, items }
}
export function learnedFromRow(r: LearnedRow): string[] {
  return asArray<string>(r.items, [])
}

export function motivationToRow(userId: string, m: Motivation): MotivationRow {
  return { user_id: userId, goal_per_day: m.goalPerDay, makeup_cards: m.makeupCards, awarded_milestones: m.awardedMilestones, seen_achievements: m.seenAchievements }
}
export function motivationFromRow(r: MotivationRow): Motivation {
  return { goalPerDay: r.goal_per_day, makeupCards: r.makeup_cards, awardedMilestones: r.awarded_milestones, seenAchievements: asArray<string>(r.seen_achievements, []) }
}

export function profileRowToProfile(r: ProfileRow): Profile {
  return { userId: r.user_id, displayName: r.display_name, friendCode: r.friend_code, totalLearned: r.total_learned }
}

/** 邮箱前缀作为默认昵称（'kid1@x.com' → 'kid1'）。 */
export function displayNameFromEmail(email: string): string {
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, at)
}

// ===== CloudApi 接口（Task 5/6/9 实现，签名在此锁定） =====
export interface CloudApi {
  signUp(email: string, password: string): Promise<string>
  signIn(email: string, password: string): Promise<string>
  signOut(): Promise<void>
  getUserId(): Promise<string | null>

  fetchTemplates(userId: string): Promise<Template[]>
  pushTemplates(userId: string, list: Template[]): Promise<void>
  fetchEntries(userId: string): Promise<WrongEntry[]>
  pushEntries(userId: string, list: WrongEntry[]): Promise<void>
  fetchStats(userId: string): Promise<Stats>
  pushStats(userId: string, stats: Stats): Promise<void>
  fetchLearned(userId: string): Promise<string[]>
  pushLearned(userId: string, items: string[]): Promise<void>
  fetchMotivation(userId: string): Promise<Motivation>
  pushMotivation(userId: string, m: Motivation): Promise<void>

  ensureProfile(userId: string, email: string): Promise<Profile>
  getProfileByCode(code: string): Promise<Profile | null>
  addFriendship(userId: string, friendId: string): Promise<void>
  listFriendIds(userId: string): Promise<string[]>
  listProfiles(userIds: string[]): Promise<Profile[]>
  getMyProfile(userId: string): Promise<Profile | null>
  createChallenge(challenge: Challenge): Promise<void>
  listChallengesFor(userId: string): Promise<Challenge[]>
  setChallengeResult(challengeId: string, score: number, durationMs: number): Promise<void>
  globalLeaderboard(limit: number): Promise<Profile[]>
}

// ===== 客户端工厂 =====
export function createSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  return createClient(url, key)
}

// createCloudApi(client) 的 sync 实现留到 Task 5 需要时补齐；本任务只锁定签名与类型。
export function createCloudApi(_client: SupabaseClient): CloudApi {
  throw new Error('Task 5 实现 createCloudApi')
}
```

> 说明：`Challenge` 类型来自 Task 7（`./challenge`）。为避免 Task 3 阻塞于 Task 7，本任务的映射测试不涉及 challenge 行；`ChallengeRow` 与 `Challenge` 的互转映射放到 Task 9 一并做。Task 3 里 `import type { Challenge } from './challenge'` 是类型占位——**执行顺序上把 Task 7 提到 Task 3 之前也可以**（见文末「任务依赖说明」），若如此，本任务即可直接 import 真实类型。

- [ ] **Step 5: 跑测试确认通过** — Run: `npx vitest run src/lib/supabase.test.ts` → Expected: PASS（映射 5 组）。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat: supabase 客户端工厂 + 行↔领域映射 + CloudApi 接口"
```

---

## Task 4: 本地 → 云端合并（`src/lib/migrate.ts`）

**Files:**
- Create: `src/lib/migrate.ts`
- Test: `src/lib/migrate.test.ts`

**Interfaces:**
- Consumes: `WrongEntry`/`Stats`/`Template`/`Motivation` 领域类型。
- Produces: `mergeEntries(local, cloud)`、`mergeTemplates(local, cloud)`、`mergeStats(local, cloud)`、`mergeLearned(local, cloud)`、`mergeMotivation(local, cloud)`。被 Task 5 的 `importLocalToCloud` 消费。

> 语义（login-sync §6）：云端优先、本地不丢。错题按 `key` 去重（云端优先）；模板按 `id` 追加；`stats.dailyHistory` 按天取**较大值**，`xp/totalLearned/streakDays` 取**较大值**；`learned` 并集；`motivation` 逐字段取「更保守」——`goalPerDay` 用云端的（非 0）、`makeupCards`/`awardedMilestones` 取大、`seenAchievements` 并集。

- [ ] **Step 1: 写失败测试** — `src/lib/migrate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mergeEntries, mergeTemplates, mergeStats, mergeLearned, mergeMotivation } from './migrate'
import { emptyStats } from './stats'
import { emptyMotivation } from './motivation'
import type { WrongEntry } from './wrongbook'

const e = (key: string): WrongEntry => ({ key, en: key, zh: '', word: key, wordIndex: 0, addedAt: 1, repetition: 0, intervalDays: 1, easeFactor: 2.5, dueAt: 1, reviews: 0, lapses: 0, lastReviewAt: 0 })

describe('mergeEntries', () => {
  it('按 key 去重，云端优先', () => {
    const merged = mergeEntries([e('a|0'), e('b|0')], [e('b|0'), e('c|0')])
    expect(merged.map((x) => x.key)).toEqual(['b|0', 'c|0', 'a|0'])
  })
})

describe('mergeTemplates', () => {
  it('按 id 追加', () => {
    const a = { id: 't1', name: 'A', createdAt: 1, items: [], warnings: [] }
    const b = { id: 't2', name: 'B', createdAt: 2, items: [], warnings: [] }
    expect(mergeTemplates([a], [b]).map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('mergeStats', () => {
  it('逐项取较大值，daily_history 按天取大', () => {
    const local = { ...emptyStats(), xp: 10, totalLearned: 5, dailyHistory: { '2026-10-09': 2 } }
    const cloud = { ...emptyStats(), xp: 8, totalLearned: 9, dailyHistory: { '2026-10-09': 3, '2026-10-08': 1 } }
    const m = mergeStats(local, cloud)
    expect(m.xp).toBe(10)
    expect(m.totalLearned).toBe(9)
    expect(m.dailyHistory).toEqual({ '2026-10-09': 3, '2026-10-08': 1 })
  })
})

describe('mergeLearned', () => {
  it('并集去重', () => {
    expect(mergeLearned(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeMotivation', () => {
  it('补签卡/里程碑取大，seenAchievements 并集', () => {
    const local = { ...emptyMotivation(), goalPerDay: 10, makeupCards: 3, seenAchievements: ['a'] }
    const cloud = { ...emptyMotivation(), goalPerDay: 5, makeupCards: 1, seenAchievements: ['b'] }
    const m = mergeMotivation(local, cloud)
    expect(m.goalPerDay).toBe(5)
    expect(m.makeupCards).toBe(3)
    expect(m.seenAchievements).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/migrate.test.ts` → Expected: FAIL（`mergeEntries is not defined`）。

- [ ] **Step 3: 实现** — `src/lib/migrate.ts`

```ts
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'

export function mergeEntries(local: WrongEntry[], cloud: WrongEntry[]): WrongEntry[] {
  const seen = new Map<string, WrongEntry>()
  for (const x of cloud) seen.set(x.key, x)
  for (const x of local) if (!seen.has(x.key)) seen.set(x.key, x)
  return [...seen.values()]
}

export function mergeTemplates(local: Template[], cloud: Template[]): Template[] {
  const seen = new Map<string, Template>()
  for (const t of cloud) seen.set(t.id, t)
  for (const t of local) if (!seen.has(t.id)) seen.set(t.id, t)
  return [...seen.values()]
}

export function mergeStats(local: Stats, cloud: Stats): Stats {
  const dailyHistory = { ...cloud.dailyHistory }
  for (const [day, n] of Object.entries(local.dailyHistory)) {
    dailyHistory[day] = Math.max(dailyHistory[day] ?? 0, n)
  }
  return {
    xp: Math.max(local.xp, cloud.xp),
    streakDays: Math.max(local.streakDays, cloud.streakDays),
    totalLearned: Math.max(local.totalLearned, cloud.totalLearned),
    lastStudyDate: local.lastStudyDate > cloud.lastStudyDate ? local.lastStudyDate : cloud.lastStudyDate,
    dailyHistory,
  }
}

export function mergeLearned(local: string[], cloud: string[]): string[] {
  return [...new Set([...local, ...cloud])]
}

export function mergeMotivation(local: Motivation, cloud: Motivation): Motivation {
  return {
    goalPerDay: cloud.goalPerDay > 0 ? cloud.goalPerDay : local.goalPerDay,
    makeupCards: Math.max(local.makeupCards, cloud.makeupCards),
    awardedMilestones: Math.max(local.awardedMilestones, cloud.awardedMilestones),
    seenAchievements: [...new Set([...local.seenAchievements, ...cloud.seenAchievements])],
  }
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/migrate.test.ts` → Expected: PASS（5 组）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrate.ts src/lib/migrate.test.ts
git commit -m "feat: 本地→云端数据合并（云端优先、不丢本地）"
```

---

## Task 5: 统一数据层编排（`src/lib/dataStore.ts`）

**Files:**
- Create: `src/lib/dataStore.ts`
- Test: `src/lib/dataStore.test.ts`

**Interfaces:**
- Consumes: `CloudApi`（Task 3 接口）、`merge*`（Task 4）、`loadTemplates/loadStats/loadEntries/loadLearned/loadMotivation`（现有 lib 函数，作本地实现）。
- Produces: `SyncState`、`pullAll(api, userId)`、`importLocalToCloud(api, userId)`、`localState()`。被 Task 6 的 App 接线消费。

> 本任务的 TDD 针对 `pullAll` 与 `importLocalToCloud`，用一个**手写 fake `CloudApi`**（内存对象 + 记录调用）替代真实 supabase，不碰网络。

- [ ] **Step 1: 写失败测试** — `src/lib/dataStore.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { pullAll, importLocalToCloud } from './dataStore'
import type { CloudApi } from './supabase'
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'
import { emptyStats } from './stats'
import { emptyMotivation } from './motivation'

const USER = 'u1'

function fakeApi(overrides: Partial<CloudApi> = {}): CloudApi & { calls: string[] } {
  const calls: string[] = []
  return {
    signUp: async () => USER, signIn: async () => USER, signOut: async () => {}, getUserId: async () => USER,
    fetchTemplates: async () => [], pushTemplates: async () => {}, fetchEntries: async () => [], pushEntries: async () => {},
    fetchStats: async () => emptyStats(), pushStats: async () => {}, fetchLearned: async () => [], pushLearned: async () => {},
    fetchMotivation: async () => emptyMotivation(), pushMotivation: async () => {},
    ensureProfile: async () => ({ userId: USER, displayName: 'x', friendCode: 'AAAAAAAA', totalLearned: 0 }),
    getProfileByCode: async () => null, addFriendship: async () => {}, listFriendIds: async () => [], listProfiles: async () => [], getMyProfile: async () => null,
    createChallenge: async () => {}, listChallengesFor: async () => [], setChallengeResult: async () => {}, globalLeaderboard: async () => [],
    ...overrides,
  }
}

describe('pullAll', () => {
  it('并行拉 5 块数据并组装', async () => {
    const api = fakeApi({ fetchTemplates: async () => [{ id: 't1', name: 'A', createdAt: 1, items: [], warnings: [] }] })
    const s = await pullAll(api, USER)
    expect(s.templates).toHaveLength(1)
    expect(s.stats.xp).toBe(0)
    expect(s.motivation.goalPerDay).toBe(5)
  })
})

describe('importLocalToCloud', () => {
  it('把本地合并进云端后推回', async () => {
    const localTpl: Template = { id: 't1', name: 'A', createdAt: 1, items: [], warnings: [] }
    const pushes: string[] = []
    const api = fakeApi({
      fetchTemplates: async () => [],
      pushTemplates: async () => { pushes.push('templates') },
      pushStats: async () => { pushes.push('stats') },
    })
    const local = { templates: [localTpl], entries: [], stats: { ...emptyStats(), totalLearned: 5 }, learned: ['a'], motivation: emptyMotivation() }
    await importLocalToCloud(api, USER, local)
    expect(pushes).toContain('templates')
    expect(pushes).toContain('stats')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/dataStore.test.ts` → Expected: FAIL（`pullAll is not defined`）。

- [ ] **Step 3: 实现** — `src/lib/dataStore.ts`

```ts
import type { CloudApi } from './supabase'
import { mergeEntries, mergeTemplates, mergeStats, mergeLearned, mergeMotivation } from './migrate'
import type { Template } from './templates'
import type { WrongEntry } from './wrongbook'
import type { Stats } from './stats'
import type { Motivation } from './motivation'
import { loadTemplates } from './templates'
import { loadEntries } from './wrongbook'
import { loadStats } from './stats'
import { loadLearned } from './learned'
import { loadMotivation } from './motivation'

export interface SyncState {
  templates: Template[]
  entries: WrongEntry[]
  stats: Stats
  learned: string[]
  motivation: Motivation
}

/** 从 localStorage 读全量（游客模式）。 */
export function localState(): SyncState {
  return {
    templates: loadTemplates(),
    entries: loadEntries(),
    stats: loadStats(),
    learned: loadLearned(),
    motivation: loadMotivation(),
  }
}

/** 从云端并行拉全量（登录后 hydration）。 */
export async function pullAll(api: CloudApi, userId: string): Promise<SyncState> {
  const [templates, entries, stats, learned, motivation] = await Promise.all([
    api.fetchTemplates(userId),
    api.fetchEntries(userId),
    api.fetchStats(userId),
    api.fetchLearned(userId),
    api.fetchMotivation(userId),
  ])
  return { templates, entries, stats, learned, motivation }
}

/** 首次登录导入：本地并入云端，再推回（云端优先、不丢本地）。 */
export async function importLocalToCloud(api: CloudApi, userId: string, local: SyncState): Promise<void> {
  const [ct, ce, cs, cl, cm] = await Promise.all([
    api.fetchTemplates(userId),
    api.fetchEntries(userId),
    api.fetchStats(userId),
    api.fetchLearned(userId),
    api.fetchMotivation(userId),
  ])
  await Promise.all([
    api.pushTemplates(userId, mergeTemplates(local.templates, ct)),
    api.pushEntries(userId, mergeEntries(local.entries, ce)),
    api.pushStats(userId, mergeStats(local.stats, cs)),
    api.pushLearned(userId, mergeLearned(local.learned, cl)),
    api.pushMotivation(userId, mergeMotivation(local.motivation, cm)),
  ])
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/dataStore.test.ts` → Expected: PASS（2 项）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/dataStore.ts src/lib/dataStore.test.ts
git commit -m "feat: 统一数据层（云端拉取 / 本地导入云端）"
```

---

## Task 6: 认证 + 登录界面（`src/components/AuthScreen.tsx` + App 接线）

**Files:**
- Create: `src/components/AuthScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: 无新 lib 测试（本任务是接线 + 组件；`CloudApi` 的 auth 方法签名已在 Task 3 锁定）。

**Interfaces:**
- Consumes: `CloudApi`（signUp/signIn/signOut/getUserId）、`localState`/`pullAll`/`importLocalToCloud`（Task 5）。
- Produces: `AuthScreen`（Props：`{ onAuthed: (userId: string) => void; onBack: () => void }`，内部拿 `CloudApi` 单例）。App 新增 `'auth'` view、`auth` 状态（`userId | null`）、`syncing` 加载态、会话恢复、登出按钮、首次登录「导入本地数据」按钮。

> supabase-js 的 auth 流式调用是薄适配，本任务只在 build 后手动联调验证。**关键接线逻辑**：`createCloudApi` 在 Task 5 之后应当能返回真实实现——把 Task 3 里 `createCloudApi` 的 `throw` 替换为真实实现（auth + sync 方法），这是本任务的一部分（否则 App 跑不起来）。

- [ ] **Step 1: 实现 `createCloudApi` 真实逻辑**（补 Task 3 的 `throw`）

在 `src/lib/supabase.ts` 内替换 `createCloudApi`，实现 auth + 5 块 sync（social 方法在 Task 9 补齐，先 `throw new Error('not implemented')` 占位）：

```ts
export function createCloudApi(client: SupabaseClient): CloudApi {
  const uid = async (): Promise<string> => {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new Error('未登录')
    return data.session.user.id
  }

  async function select<T>(table: string, userId: string): Promise<T[]> {
    const { data, error } = await client.from(table).select('*').eq(USER, userId)
    if (error) throw error
    return (data ?? []) as T[]
  }
  async function upsertRows(table: string, rows: unknown[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await client.from(table).upsert(rows)
    if (error) throw error
  }

  return {
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) throw error
      const id = data.user?.id ?? (await uid())
      return id
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data.user.id
    },
    async signOut() { const { error } = await client.auth.signOut(); if (error) throw error },
    async getUserId() {
      const { data } = await client.auth.getSession()
      return data.session?.user.id ?? null
    },

    async fetchTemplates(userId) { return (await select<TemplatesRow>('templates', userId)).map(templateFromRow) },
    async pushTemplates(userId, list) { await upsertRows('templates', list.map((t) => templateToRow(userId, t))) },
    async fetchEntries(userId) { return (await select<WrongEntryRow>('wrong_entries', userId)).map(entryFromRow) },
    async pushEntries(userId, list) { await upsertRows('wrong_entries', list.map((e) => entryToRow(userId, e))) },
    async fetchStats(userId) {
      const rows = await select<StatsRow>('stats', userId)
      return rows.length ? statsFromRow(rows[0]) : emptyStats()
    },
    async pushStats(userId, stats) { await upsertRows('stats', [statsToRow(userId, stats)]) },
    async fetchLearned(userId) {
      const rows = await select<LearnedRow>('learned', userId)
      return rows.length ? learnedFromRow(rows[0]) : []
    },
    async pushLearned(userId, items) { await upsertRows('learned', [learnedToRow(userId, items)]) },
    async fetchMotivation(userId) {
      const rows = await select<MotivationRow>('motivation', userId)
      return rows.length ? motivationFromRow(rows[0]) : emptyMotivation()
    },
    async pushMotivation(userId, m) { await upsertRows('motivation', [motivationToRow(userId, m)]) },

    // social —— Task 9 实现
    async ensureProfile() { throw new Error('Task 9 实现 ensureProfile') },
    async getProfileByCode() { throw new Error('Task 9 实现 getProfileByCode') },
    async addFriendship() { throw new Error('Task 9 实现 addFriendship') },
    async listFriendIds() { throw new Error('Task 9 实现 listFriendIds') },
    async listProfiles() { throw new Error('Task 9 实现 listProfiles') },
    async getMyProfile() { throw new Error('Task 9 实现 getMyProfile') },
    async createChallenge() { throw new Error('Task 9 实现 createChallenge') },
    async listChallengesFor() { throw new Error('Task 9 实现 listChallengesFor') },
    async setChallengeResult() { throw new Error('Task 9 实现 setChallengeResult') },
    async globalLeaderboard() { throw new Error('Task 9 实现 globalLeaderboard') },
  }
}
```

> 注意：`emptyStats`/`emptyMotivation` 需在此文件顶部 import。`signUp` 在「邮箱验证关闭」下返回即登录态，但为稳妥仍 fallback 到 `getSession`。

- [ ] **Step 2: 创建 `AuthScreen.tsx`**

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CloudApi } from '../lib/supabase'
import { displayNameFromEmail } from '../lib/supabase'

interface Props {
  api: CloudApi
  onAuthed: (userId: string) => void
  onBack: () => void
}

export default function AuthScreen({ api, onAuthed, onBack }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const userId = mode === 'login' ? await api.signIn(email, password) : await api.signUp(email, password)
      await api.ensureProfile(userId, displayNameFromEmail(email))
      onAuthed(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <header className="list-head">
        <div>
          <h1 className="title">👤 登录 / 注册</h1>
          <p className="subtitle">登录后可与好友 PK、上排行榜</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>邮箱</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
        </label>
        {error && <p className="result fail" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? '…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: 接线 `App.tsx`**

  - import `createSupabaseClient, createCloudApi, type CloudApi`、`localState/pullAll/importLocalToCloud`、`AuthScreen`。
  - 顶部模块级：`const api = createCloudApi(createSupabaseClient() ?? /* 占位 */)`。缺 env 时：用一个「未配置」`CloudApi`（每个方法 `throw new Error('未配置 Supabase')`），App 里登录按钮置灰/提示。
  - 新增 state：`const [userId, setUserId] = useState<string | null>(null)`、`const [syncing, setSyncing] = useState(false)`、`const [needsImport, setNeedsImport] = useState(false)`。
  - `View` 增加 `'auth'`。
  - 会话恢复 effect：
    ```ts
    useEffect(() => {
      if (!configured) return
      api.getUserId().then((id) => { if (id) { setUserId(id); hydrate(id) } })
    }, [])
    ```
  - `hydrate(id)`：`setSyncing(true)` → `pullAll(api, id)` → 灌入 5 个 state → 若云端全空且有本地数据则 `setNeedsImport(true)` → `setSyncing(false)`。
  - 登出：`api.signOut()` → `setUserId(null)` → 重新 `localState()` 灌入。
  - 导入按钮 handler：`importLocalToCloud(api, userId, localState())` → `hydrate(userId)`。
  - 顶部（library view）加登录/登出入口；`syncing` 时渲染简单加载态；`needsImport` 时提示「把本地数据导入云端」按钮。

- [ ] **Step 4: 加 `.auth-form` 等样式**（`src/App.css` 末尾追加，复用 `--surface/--ink/--line/--accent` token 与 `.primary`/`.ghost`）

- [ ] **Step 5: 验证构建** — Run: `tsc -b && vite build` → Expected: 通过（无类型错误）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/components/AuthScreen.tsx src/App.tsx src/App.css
git commit -m "feat: 认证流程 + 登录界面 + 会话恢复 + 本地导入云端"
```

---

## Task 7: 异步 PK 领域逻辑（`src/lib/challenge.ts`）

**Files:**
- Create: `src/lib/challenge.ts`
- Test: `src/lib/challenge.test.ts`

**Interfaces:**
- Consumes: `TemplateItem`（`../types`）。
- Produces: `ChallengeWord`、`ChallengeStatus`、`Challenge`、`ChallengeWinner`、`snapshotWords(items)`、`challengeWinner(c)`。被 Task 9（`ChallengeRow` ↔ `Challenge` 映射）与 Task 11（结果页判胜）消费。

- [ ] **Step 1: 写失败测试** — `src/lib/challenge.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { snapshotWords, challengeWinner, type Challenge } from './challenge'

const base: Challenge = {
  id: 'c1', challengerId: 'a', challengeeId: 'b',
  words: [{ en: 'hello', zh: '你好' }],
  challengerScore: 3, challengerDurationMs: 1000,
  challengeeScore: null, challengeeDurationMs: null,
  status: 'pending', createdAt: 1, completedAt: null,
}

describe('snapshotWords', () => {
  it('只取 en/zh', () => {
    expect(snapshotWords([{ id: 'i1', en: 'hello', zh: '你好', image: 'x.jpg' }]))
      .toEqual([{ en: 'hello', zh: '你好' }])
  })
})

describe('challengeWinner', () => {
  it('未应战返回 null', () => {
    expect(challengeWinner(base)).toBeNull()
  })
  it('发起方高分胜', () => {
    expect(challengeWinner({ ...base, challengeeScore: 1, status: 'completed' })).toBe('challenger')
  })
  it('应战方高分胜', () => {
    expect(challengeWinner({ ...base, challengeeScore: 5, status: 'completed' })).toBe('challengee')
  })
  it('平分平局', () => {
    expect(challengeWinner({ ...base, challengeeScore: 3, status: 'completed' })).toBe('draw')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/challenge.test.ts` → Expected: FAIL（`snapshotWords is not defined`）。

- [ ] **Step 3: 实现** — `src/lib/challenge.ts`

```ts
import type { TemplateItem } from '../types'

export interface ChallengeWord { en: string; zh: string }
export type ChallengeStatus = 'pending' | 'completed'
export type ChallengeWinner = 'challenger' | 'challengee' | 'draw'

export interface Challenge {
  id: string
  challengerId: string
  challengeeId: string
  words: ChallengeWord[]
  challengerScore: number
  challengerDurationMs: number
  challengeeScore: number | null
  challengeeDurationMs: number | null
  status: ChallengeStatus
  createdAt: number
  completedAt: number | null
}

/** 词条快照：只留 en/zh，跨账号隐私隔离、题目一致。 */
export function snapshotWords(items: TemplateItem[]): ChallengeWord[] {
  return items.map((it) => ({ en: it.en, zh: it.zh }))
}

/** 判胜（派生，不落库）。未应战返回 null。 */
export function challengeWinner(c: Challenge): ChallengeWinner | null {
  if (c.challengeeScore === null) return null
  if (c.challengerScore > c.challengeeScore) return 'challenger'
  if (c.challengeeScore > c.challengerScore) return 'challengee'
  return 'draw'
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/challenge.test.ts` → Expected: PASS（5 项）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/challenge.ts src/lib/challenge.test.ts
git commit -m "feat: 异步 PK 领域逻辑（词条快照 / 判胜）"
```

---

## Task 8: 排行榜领域逻辑（`src/lib/leaderboard.ts`）

**Files:**
- Create: `src/lib/leaderboard.ts`
- Test: `src/lib/leaderboard.test.ts`

**Interfaces:**
- Consumes: `Profile`（Task 3）。
- Produces: `LeaderboardEntry`、`sortLeaderboard(entries)`、`rankOf(entries, userId)`、`friendLeaderboard(myProfile, friends, me)`. 被 Task 9/10 消费。

- [ ] **Step 1: 写失败测试** — `src/lib/leaderboard.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { sortLeaderboard, rankOf } from './leaderboard'
import type { Profile } from './supabase'

const p = (id: string, total: number): Profile => ({ userId: id, displayName: id, friendCode: 'AAAAAAAA', totalLearned: total })

describe('sortLeaderboard', () => {
  it('按 totalLearned 降序，不改变入参', () => {
    const input = [p('a', 3), p('b', 9), p('c', 5)]
    expect(sortLeaderboard(input).map((x) => x.userId)).toEqual(['b', 'c', 'a'])
    expect(input.map((x) => x.userId)).toEqual(['a', 'b', 'c'])
  })
})

describe('rankOf', () => {
  it('返回 1 起名次，找不到返回 -1', () => {
    const sorted = sortLeaderboard([p('a', 3), p('b', 9)])
    expect(rankOf(sorted, 'b')).toBe(1)
    expect(rankOf(sorted, 'x')).toBe(-1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/leaderboard.test.ts` → Expected: FAIL（`sortLeaderboard is not defined`）。

- [ ] **Step 3: 实现** — `src/lib/leaderboard.ts`

```ts
import type { Profile } from './supabase'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  totalLearned: number
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.totalLearned - a.totalLearned)
}

export function rankOf(entries: LeaderboardEntry[], userId: string): number {
  const idx = entries.findIndex((e) => e.userId === userId)
  return idx === -1 ? -1 : idx + 1
}

/** 好友榜：好友 + 我，按 totalLearned 降序。 */
export function friendLeaderboard(me: Profile, friends: Profile[]): LeaderboardEntry[] {
  const all = [me, ...friends].map((p) => ({ userId: p.userId, displayName: p.displayName, totalLearned: p.totalLearned }))
  return sortLeaderboard(all)
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/leaderboard.test.ts` → Expected: PASS（2 组）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts src/lib/leaderboard.test.ts
git commit -m "feat: 排行榜排序与名次纯函数"
```

---

## Task 9: 社交层 CloudApi（profiles / friendships / challenges 映射 + CRUD）

**Files:**
- Modify: `src/lib/supabase.ts`（补 social 方法与 challenge 行映射）
- Test: `src/lib/supabase.test.ts`（追加 social 映射测试）

**Interfaces:**
- Consumes: `Challenge`/`snapshotWords`（Task 7）、`Profile`/`profileRowToProfile`/`generateFriendCode`/`normalizeFriendCode`、`sortLeaderboard`（Task 8，若在此做排行榜查询）。
- Produces: 补全 `CloudApi` 的 9 个 social 方法；`challengeRowToChallenge`/`challengeToRow` 映射。

> `ensureProfile` 需处理好友码唯一冲突重试（Review Focus #2）：生成码 → insert，若唯一冲突则重新生成重试（最多 5 次）。`addFriendship` 拒绝自己加自己（Review Focus #3）。`listFriendIds` 从规范单行 `(user_a, user_b)` 取「非本人一侧」。

- [ ] **Step 1: 写失败测试** — 追加到 `src/lib/supabase.test.ts`

```ts
import { challengeFromRow, challengeToRow, friendshipOtherId } from './supabase'

describe('challenge 映射', () => {
  it('往返不变（含 null 分数）', () => {
    const c = { id: 'c1', challengerId: 'a', challengeeId: 'b', words: [{ en: 'hi', zh: '嗨' }], challengerScore: 2, challengerDurationMs: 900, challengeeScore: null, challengeeDurationMs: null, status: 'pending', createdAt: 1, completedAt: null } as const
    expect(challengeFromRow(challengeToRow(c))).toEqual(c)
  })
})

describe('friendshipOtherId', () => {
  it('返回非本人一侧', () => {
    expect(friendshipOtherId('a', { user_a: 'a', user_b: 'b' })).toBe('b')
    expect(friendshipOtherId('b', { user_a: 'a', user_b: 'b' })).toBe('a')
  })
})
```

> 命名统一为 `challengeFromRow`（领域侧）/ `challengeToRow`（行侧），与 `templateFromRow`/`entryFromRow` 等一致。

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/lib/supabase.test.ts` → Expected: FAIL（`challengeFromRow is not defined`）。

- [ ] **Step 3: 实现 social 方法 + challenge 映射**（`src/lib/supabase.ts`）

```ts
// —— challenge 行映射 ——
export function challengeToRow(c: Challenge): ChallengeRow {
  return {
    id: c.id, challenger_id: c.challengerId, challengee_id: c.challengeeId,
    words: c.words, challenger_score: c.challengerScore, challenger_duration_ms: c.challengerDurationMs,
    challengee_score: c.challengeeScore, challengee_duration_ms: c.challengeeDurationMs,
    status: c.status, created_at: new Date(c.createdAt).toISOString(), completed_at: c.completedAt ? new Date(c.completedAt).toISOString() : null,
  }
}
export function challengeFromRow(r: ChallengeRow): Challenge {
  return {
    id: r.id, challengerId: r.challenger_id, challengeeId: r.challengee_id,
    words: asArray<Challenge['words'][number]>(r.words, []),
    challengerScore: r.challenger_score, challengerDurationMs: r.challenger_duration_ms,
    challengeeScore: r.challengee_score, challengeeDurationMs: r.challengee_duration_ms,
    status: r.status === 'completed' ? 'completed' : 'pending',
    createdAt: new Date(r.created_at).getTime(), completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
  }
}

export function friendshipOtherId(me: string, r: FriendshipRow): string {
  return r.user_a === me ? r.user_b : r.user_a
}

// —— 在 createCloudApi 内替换 social 占位 ——
async ensureProfile(userId, email) {
  const displayName = displayNameFromEmail(email)
  // 幂等：已有档案直接返回（老用户登录/换设备不重插）
  const { data: existing } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (existing) return profileRowToProfile(existing as ProfileRow)
  // 重试逻辑在纯函数 generateUniqueFriendCode（Task 2 已测）；此处只提供 isTaken 查询
  const code = await generateUniqueFriendCode(async (c) => {
    const { data } = await client.from('profiles').select('friend_code').eq('friend_code', c).maybeSingle()
    return data !== null
  })
  const { error } = await client.from('profiles').insert({ user_id: userId, display_name: displayName, friend_code: code, total_learned: 0 })
  if (error) throw error
  return { userId, displayName, friendCode: code, totalLearned: 0 }
}
async getProfileByCode(code) {
  const { data, error } = await client.from('profiles').select('*').eq('friend_code', normalizeFriendCode(code)).maybeSingle()
  if (error) throw error
  return data ? profileRowToProfile(data as ProfileRow) : null
}
async addFriendship(userId, friendId) {
  assertNotSelf(userId, friendId)
  const [a, b] = userId < friendId ? [userId, friendId] : [friendId, userId]
  const { error } = await client.from('friendships').insert({ user_a: a, user_b: b })
  if (error) throw error
}
async listFriendIds(userId) {
  const { data, error } = await client.from('friendships').select('*').or(`user_a.eq.${userId},user_b.eq.${userId}`)
  if (error) throw error
  return ((data ?? []) as FriendshipRow[]).map((r) => friendshipOtherId(userId, r))
}
async listProfiles(userIds) {
  if (userIds.length === 0) return []
  const { data, error } = await client.from('profiles').select('*').in('user_id', userIds)
  if (error) throw error
  return ((data ?? []) as ProfileRow[]).map(profileRowToProfile)
}
async getMyProfile(userId) {
  const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ? profileRowToProfile(data as ProfileRow) : null
}
async createChallenge(challenge) {
  const { error } = await client.from('challenges').insert(challengeToRow(challenge))
  if (error) throw error
}
async listChallengesFor(userId) {
  const { data, error } = await client.from('challenges').select('*').or(`challenger_id.eq.${userId},challengee_id.eq.${userId}`).order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as ChallengeRow[]).map(challengeFromRow)
}
async setChallengeResult(challengeId, score, durationMs) {
  const { error } = await client.from('challenges').update({ challengee_score: score, challengee_duration_ms: durationMs, status: 'completed', completed_at: new Date().toISOString() }).eq('id', challengeId)
  if (error) throw error
}
async globalLeaderboard(limit) {
  const { data, error } = await client.from('profiles').select('user_id, display_name, friend_code, total_learned').order('total_learned', { ascending: false }).limit(limit)
  if (error) throw error
  return ((data ?? []) as ProfileRow[]).map(profileRowToProfile)
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/lib/supabase.test.ts` → Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat: 社交层 CloudApi（档案/好友/挑战/排行榜）+ 挑战行映射"
```

---

## Task 10: 好友界面（`src/components/FriendsScreen.tsx`）

**Files:**
- Create: `src/components/FriendsScreen.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `CloudApi`、`Profile`、`LeaderboardEntry`/`sortLeaderboard`/`rankOf`/`friendLeaderboard`（Task 8）、`Challenge`、`normalizeFriendCode`/`isValidFriendCode`（Task 2）。
- Produces: `FriendsScreen`。Props：`{ api: CloudApi; userId: string; myProfile: Profile; onBack: () => void; onAcceptChallenge: (c: Challenge) => void }`。内部 tab：好友列表 / 挑战待办 / 排行榜（好友榜 + 全球榜）。

> 组件是薄接线（无组件测试）。逻辑都下沉到 lib；组件只负责 fetch + render。分四个区块：①「我的好友码」卡片（展示 `myProfile.friendCode` + 复制）；②「添加好友」输入码 → `api.getProfileByCode` → `api.addFriendship`；③「好友列表」`api.listFriendIds` + `api.listProfiles`；④「挑战待办」`api.listChallengesFor`（`challengee_id === me && pending`）→ `onAcceptChallenge`；⑤「排行榜」两个 tab：好友榜 `friendLeaderboard(myProfile, friends)`、全球榜 `api.globalLeaderboard(50)`。

- [ ] **Step 1: 实现 `FriendsScreen.tsx`**（约 150 行；关键结构如下，样式类名与 App.css 同步新增）

```tsx
import { useEffect, useState } from 'react'
import type { CloudApi, Profile } from '../lib/supabase'
import { isValidFriendCode, normalizeFriendCode } from '../lib/friendCode'
import { friendLeaderboard, sortLeaderboard, rankOf } from '../lib/leaderboard'
import type { Challenge } from '../lib/challenge'

interface Props {
  api: CloudApi
  userId: string
  myProfile: Profile
  onBack: () => void
  onAcceptChallenge: (c: Challenge) => void
}

export default function FriendsScreen({ api, userId, myProfile, onBack, onAcceptChallenge }: Props) {
  const [tab, setTab] = useState<'friends' | 'challenges' | 'leaderboard'>('friends')
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [friends, setFriends] = useState<Profile[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [global, setGlobal] = useState<Profile[]>([])
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [leaderTab, setLeaderTab] = useState<'friends' | 'global'>('friends')

  useEffect(() => {
    api.listFriendIds(userId).then(async (ids) => { setFriendIds(ids); setFriends(await api.listProfiles(ids)) }).catch(() => {})
    api.listChallengesFor(userId).then(setChallenges).catch(() => {})
    api.globalLeaderboard(50).then(setGlobal).catch(() => {})
  }, [api, userId])

  const pending = challenges.filter((c) => c.challengeeId === userId && c.status === 'pending')

  async function addFriend() {
    setMsg('')
    if (!isValidFriendCode(code)) { setMsg('好友码应为 8 位'); return }
    try {
      const p = await api.getProfileByCode(normalizeFriendCode(code))
      if (!p) { setMsg('找不到这个好友码'); return }
      if (p.userId === userId) { setMsg('这是你自己的好友码'); return }
      await api.addFriendship(userId, p.userId)
      setCode('')
      setMsg(`已添加好友 ${p.displayName} 🎉`)
      setFriendIds((prev) => [...new Set([...prev, p.userId])])
      setFriends((prev) => [...prev, p])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '添加失败')
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(myProfile.friendCode)
    setMsg('好友码已复制')
  }

  return (
    <div className="friends">
      <header className="list-head">
        <div>
          <h1 className="title">👫 好友</h1>
          <p className="subtitle">和好朋友一起学、比一比</p>
        </div>
        <button className="ghost" onClick={onBack}>← 返回</button>
      </header>

      <div className="tab-row">
        <button className={`tab ${tab === 'friends' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('friends')}>好友</button>
        <button className={`tab ${tab === 'challenges' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('challenges')}>挑战 {pending.length > 0 && `(${pending.length})`}</button>
        <button className={`tab ${tab === 'leaderboard' ? 'is-active liquid-glass' : ''}`} onClick={() => setTab('leaderboard')}>排行榜</button>
      </div>

      {tab === 'friends' && (
        <section className="friends-tab">
          <div className="friend-code-card liquid-glass">
            <span className="friend-code-label">我的好友码</span>
            <span className="friend-code-value">{myProfile.friendCode}</span>
            <button className="ghost" onClick={copyCode}>复制</button>
          </div>
          <div className="add-friend">
            <input placeholder="输入好友码" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary" onClick={addFriend}>添加好友</button>
          </div>
          {msg && <p className="format-note">{msg}</p>}
          <ul className="sentence-list">
            {friends.map((f) => (
              <li key={f.userId} className="friend-row">
                <span className="friend-name">{f.displayName}</span>
                <span className="friend-stat">已背 {f.totalLearned} 句</span>
              </li>
            ))}
            {friends.length === 0 && <p className="empty">还没有好友，先输入好友码添加吧。</p>}
          </ul>
        </section>
      )}

      {tab === 'challenges' && (
        <section className="challenges-tab">
          {pending.length === 0 && <p className="empty">没有待应战的挑战。</p>}
          {pending.map((c) => (
            <button key={c.id} className="entry-card" onClick={() => onAcceptChallenge(c)}>
              <span className="entry-word">应战：{c.words.length} 个单词</span>
              <span className="entry-zh">对手已答对 {c.challengerScore} 个，敢来吗？</span>
            </button>
          ))}
        </section>
      )}

      {tab === 'leaderboard' && (
        <section className="leaderboard-tab">
          <div className="tab-row">
            <button className={`tab ${leaderTab === 'friends' ? 'is-active liquid-glass' : ''}`} onClick={() => setLeaderTab('friends')}>好友榜</button>
            <button className={`tab ${leaderTab === 'global' ? 'is-active liquid-glass' : ''}`} onClick={() => setLeaderTab('global')}>全球榜</button>
          </div>
          <ol className="leaderboard-list">
            {(leaderTab === 'friends' ? friendLeaderboard(myProfile, friends) : sortLeaderboard(global.map((p) => ({ userId: p.userId, displayName: p.displayName, totalLearned: p.totalLearned })))).map((e, i) => (
              <li key={e.userId} className={`leaderboard-row ${e.userId === userId ? 'is-me' : ''}`}>
                <span className="rank">{i + 1}</span>
                <span className="name">{e.displayName}{e.userId === userId ? '（我）' : ''}</span>
                <span className="score">{e.totalLearned} 句</span>
              </li>
            ))}
          </ol>
          {leaderTab === 'friends' && friendIds.length > 0 && (
            <p className="format-note">我的名次：第 {rankOf(friendLeaderboard(myProfile, friends), userId)} 名</p>
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 加样式**（`src/App.css` 末尾追加 `.friends`、`.friend-code-card`、`.add-friend`、`.friend-row`、`.leaderboard-list`、`.leaderboard-row.is-me`、`.rank` 等，复用 token）

- [ ] **Step 3: 验证构建** — Run: `tsc -b && vite build` → Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/components/FriendsScreen.tsx src/App.css
git commit -m "feat: 好友界面（好友码/添加/列表/挑战待办/排行榜）"
```

---

## Task 11: 挑战界面（`src/components/ChallengeScreen.tsx`）

**Files:**
- Create: `src/components/ChallengeScreen.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `Challenge`/`challengeWinner`（Task 7）、`CloudApi.setChallengeResult`、现有 `GameScreen`（`TemplateItem` 驱动的默写答题）。
- Produces: `ChallengeScreen`。Props：`{ api: CloudApi; userId: string; challenge: Challenge; onDone: () => void }`。把 `challenge.words` 转成 `TemplateItem[]` 喂给现有 `GameScreen`，答对计分，结束写回 `setChallengeResult`，展示比分与胜负。

> **复用而非重造**：PK 应战直接复用 `GameScreen`（其内部 `SentenceQuiz` 已处理填空对错、`onWrongWords` 计数、`onCompleted` 计分）。`ChallengeScreen` 维护一个 `score`（答对词数）+ `startTime`，包一层自己的计分，答题结束（`onEnd` 或完成最后一句）时 `setChallengeResult(id, score, duration)`，再切到结果视图展示 `challengeWinner`。

- [ ] **Step 1: 实现 `ChallengeScreen.tsx`**

```tsx
import { useRef, useState } from 'react'
import type { Challenge } from '../lib/challenge'
import { challengeWinner } from '../lib/challenge'
import type { CloudApi } from '../lib/supabase'
import type { TemplateItem } from '../types'
import GameScreen from './GameScreen'

interface Props {
  api: CloudApi
  userId: string
  challenge: Challenge
  onDone: () => void
}

export default function ChallengeScreen({ api, userId, challenge, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const startRef = useRef(Date.now())
  const items: TemplateItem[] = challenge.words.map((w, i) => ({ id: `pk-${i}`, en: w.en, zh: w.zh }))

  function countWrong(wrongs: { word: string; wordIndex: number }[]) {
    // 一句里答对 = 无错词；有错词不计入 score（对应 challenger_score 的「答对词数」语义）
    if (wrongs.length === 0) setScore((s) => s + 1)
  }

  async function finish() {
    await api.setChallengeResult(challenge.id, score, Date.now() - startRef.current)
    setDone(true)
  }

  if (done) {
    const winner = challengeWinner({ ...challenge, challengeeScore: score, status: 'completed' })
    const label = winner === 'challenger' ? '对方胜' : winner === 'challengee' ? '你赢了 🎉' : '平局 🤝'
    return (
      <div className="challenge">
        <div className="quiz-card">
          <h2 className="title">对战结果</h2>
          <p className="result">{label}</p>
          <p className="format-note">对方 {challenge.challengerScore} 分 · 你 {score} 分</p>
          <button className="primary" onClick={onDone}>返回</button>
        </div>
      </div>
    )
  }

  return (
    <GameScreen
      key={index}
      item={items[index]}
      index={index}
      total={items.length}
      startTime={startRef.current}
      onNext={() => setIndex((i) => i + 1)}
      onEnd={finish}
      onWrongWords={countWrong}
      onCompleted={() => { if (index === items.length - 1) finish() }}
    />
  )
}
```

> 计分语义对齐 spec §2「分数 = 答对词数」：一句全对 +1。`onCompleted` 在最后一句完成后触发 `finish`（`onNext` 只在非最后一句时前进）。

- [ ] **Step 2: 加 `.challenge` 结果页样式**

- [ ] **Step 3: 验证构建** — Run: `tsc -b && vite build` → Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/components/ChallengeScreen.tsx src/App.css
git commit -m "feat: 挑战应战界面（复用默写流程 + 比分结果）"
```

---

## Task 12: App 导航接线 + 邀请链接 hash 路由 + 样式收尾

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `AuthScreen`（Task 6）、`FriendsScreen`（Task 10）、`ChallengeScreen`（Task 11）、`CloudApi`、`Profile`。
- Produces: 完整可用的登录/好友/挑战/排行榜体验；`#/f/<code>` 邀请链接处理。

- [ ] **Step 1: 接线视图与导航**（`src/App.tsx`）

  - `View` 增加 `'friends'`、`'challenge'`；state 增加 `myProfile: Profile | null`、`activeChallenge: Challenge | null`。
  - library view 顶部加「👫 好友」「👤 登录/已登录」入口；登录后 `ensureProfile` 保证档案存在，再 `api.getMyProfile(userId)` 取 `myProfile`（会话恢复 `hydrate` 里同样用 `getMyProfile` 取）。
  - 点击好友入口：未登录 → 跳 `'auth'`；已登录 → 拉 `myProfile` → 跳 `'friends'`。
  - `handleAcceptChallenge(c)` → `setActiveChallenge(c); setView('challenge')`；`ChallengeScreen.onDone` → 回 `'friends'`。
  - 登出：清 `userId`/`myProfile`，回游客本地状态。

- [ ] **Step 2: 邀请链接 hash 路由**

  在 App 加 `useEffect`：监听 `hashchange`，解析 `#/f/<code>`：

  ```ts
  useEffect(() => {
    function onHash() {
      const m = window.location.hash.match(/^#\/f\/([A-Za-z0-9]+)/)
      if (!m) return
      setInviteCode(m[1])
      setView('friends') // 登录后由 FriendsScreen 的加好友框预填
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  ```

  `inviteCode` 传入 `FriendsScreen`，预填到加好友输入框（把 Task 10 的 `code` 初值改为 `inviteCode ?? ''`）。未登录时提示先登录。

- [ ] **Step 3: 样式收尾**（`.auth-form`、`.friends`、`.challenge`、导航入口按钮等，确保明暗双主题与 `prefers-reduced-motion` 一致）

- [ ] **Step 4: 验证构建** — Run: `tsc -b && vite build` → Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/components/FriendsScreen.tsx
git commit -m "feat: 好友/挑战/排行榜导航接线 + 邀请链接 hash 路由"
```

---

## Task 13: 集成验证

**Files:**
- 无（收尾任务）

- [ ] **Step 1: 全量测试** — Run: `npm test`（=`vitest run`）→ Expected: 全部通过、无报错、无告警。

- [ ] **Step 2: 类型 + 构建** — Run: `npm run build`（=`tsc -b && vite build`）→ Expected: 通过。

- [ ] **Step 3: 手动联调清单**（需你先建 Supabase 项目、跑 `supabase/schema.sql`、把 URL/anon key 填进 `.env.local`）：

  - 注册两个账号（A、B），各自拿到好友码；刷新页面登录态保持。
  - A 输入 B 的好友码 → 双方好友列表都出现对方。
  - A 发起挑战（先玩一遍设分）→ B 在挑战待办看到 → 应战 → 双方看到比分与胜负。
  - 好友榜/全球榜按背单词数正确排序，只显示昵称 + 单词数（无邮箱）。
  - 游客模式仍可用（不登录正常学习，数据存本地）；首次登录「导入本地数据」不丢数据。
  - 输入自己的好友码被拒绝；输入不存在的好友码提示找不到。

- [ ] **Step 4: Commit（若前序有遗漏改动）**

```bash
git add -A
git commit -m "test: 账号/好友/PK/排行榜集成验证通过"
```

---

## 任务依赖说明

线性顺序为 Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13。

- Task 3 的 `import type { Challenge }` 是 Task 7 产物的**类型占位**：若执行器把 Task 7 提到 Task 3 之前（让 `challenge.ts` 先存在），Task 3 的 import 即为真实引用。两种顺序均可；保持「Task 3 只做映射/类型/接口，challenge 行映射留给 Task 9」这一边界不变即可。
- Task 6 会把 Task 3 里 `createCloudApi` 的 `throw` 补成真实实现（auth + sync），并把 social 方法留 `throw` 占位到 Task 9。
- Task 10/11/12 是组件接线，依赖 Task 9 的 social 方法齐备后才能在真实 Supabase 上跑通，但**编译（`tsc -b`）不依赖后端存在**，故可在拿到 Supabase 凭据前完成并过 build。

## 实施前必须由用户提供

1. Supabase 项目 `Project URL` 与 `anon key`（填入 `.env.local`）。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`（Task 1 产物）。
3. Auth Settings 里确认「邮箱验证关闭」（`Settings → Auth → Providers → Email`，关掉 confirm email）。
