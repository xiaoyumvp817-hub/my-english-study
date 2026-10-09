# 好友 · PK 背单词 · 排行榜 — 设计方案

- 日期：2026-10-09
- 状态：待确认
- 前置：依赖已定稿的 [2026-09-30-login-sync-design.md](2026-09-30-login-sync-design.md)（Supabase 后端 + 邮箱密码登录 + RLS + last-write-wins 同步）。本 spec 在其之上新增社交层。

---

## 1. 背景与目标

应用已有完整学习闭环 + 激励系统（成就/图鉴/打卡），但仍是「单人本地」。本次目标：引入账号体系之上的社交层 —— 每个用户独立账号，好友间可互相添加、异步 PK 背单词、按背单词数排名，让孩子有「和好朋友一起学、比一比」的动力。

核心一句话：**登录后，每个孩子有自己的账号；能和好友互相挑战背单词；好友榜/全球榜看谁背得多。**

## 2. 已定稿决策

| 维度 | 决定 |
|------|------|
| 后端 | **Supabase**（沿用 login-sync spec，托管 Auth + PostgreSQL + RLS） |
| 登录 | **邮箱 + 密码**，邮箱验证**关闭**，可选登录（游客模式保留） |
| PK 形式 | **异步挑战**：A 发起（先玩一遍设分）→ B 之后玩同一批词 → 比分数判胜负。**不做实时同屏** |
| 好友添加 | **好友码 / 邀请链接**：每个账号一个唯一码，输入码即互加；也可发邀请链接一键添加 |
| 排行榜 | **好友榜 + 全球榜**，按**累计背单词数**（`stats.totalLearned`）排 |
| 对战计分 | 分数 = 答对词数；分数高者胜；相等 = 平局 |

## 3. 设计原则

1. **隐私优先**：全球榜只暴露 `display_name`（可自定义）+ `total_learned`，**绝不泄露邮箱**；好友关系必须「输入对方码」才能建立，无公开搜索/目录。
2. **复用现有闭环**：PK 背单词复用现有默写/点选流程（`GameScreen` / 点选复习），不另造一套答题引擎。
3. **异步、零实时**：挑战用数据库行 + 拉取展示，不引入 WebSocket / Realtime，复杂度可控。
4. **同步范围补全**：把 login-sync spec 漏掉的 `learned` 与 `motivation` 一并纳入云端同步（见 §6）。
5. **YAGNI**：不做实时对战、群聊、好友申请/拒绝、付费、多设备同时在线冲突合并。

## 4. 数据模型（新增 5 张表，含 RLS）

沿用 login-sync spec 的 `templates` / `wrong_entries` / `stats` 三张表（`stats` 需补 `total_learned` 列，见 §6）。新增：

### 4.1 `profiles`（每用户一行公开档案）

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid（主键）→ `auth.users(id)` on delete cascade | 归属 |
| `display_name` | text not null | 昵称，默认取邮箱前缀，可改；**仅此字段公开** |
| `friend_code` | text unique not null | 8 位大写字母数字，如 `K7P3QM9A`，注册时生成 |
| `total_learned` | int not null default 0 | 冗余累计背单词数，排行榜排序用 |
| `created_at` | timestamptz default now() | |

- `friend_code` 唯一冲突时重新生成（客户端生成 + 服务端唯一索引兜底重试）。
- `total_learned` 在每次 `stats.totalLearned` 变化时同步 upsert 到本列。

### 4.2 `friendships`（好友关系，双向两行）

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid → `auth.users(id)` on delete cascade | 本人 |
| `friend_id` | uuid → `auth.users(id)` on delete cascade | 好友 |
| `created_at` | timestamptz default now() | |

- 唯一约束 `(user_id, friend_id)`。
- 加好友 = 一次性插入 `(A,B)` 与 `(B,A)` 两行（对称、无申请/拒绝流程）。
- 查「我的好友」：`select friend_id from friendships where user_id = auth.uid()`。

### 4.3 `challenges`（异步对战）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid（主键，数据库生成） | |
| `challenger_id` | uuid → `auth.users(id)` on delete cascade | 发起方 |
| `challengee_id` | uuid → `auth.users(id)` on delete cascade | 应战方 |
| `words` | jsonb not null | 词条快照 `{en, zh}[]`（发起时把单元词条整批存下，跨账号隐私隔离） |
| `challenger_score` | int | 发起方答对词数 |
| `challenger_duration_ms` | int | 发起方用时（展示用） |
| `challengee_score` | int null | 应战方答对词数（未玩为 null） |
| `challengee_duration_ms` | int null | 应战方用时 |
| `status` | text not null default 'pending' | `pending` / `completed` |
| `created_at` | timestamptz default now() | |
| `completed_at` | timestamptz null | |

- 胜负判定为**派生**（不落库）：`challenger_score` vs `challengee_score`，高者胜，相等平局。
- 词条快照保证 B 看到的题目与 A 完全一致，且不跨越 RLS 去读 A 的私有模板。

### 4.4 `learned`（已学单词，登录同步用，非社交）

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid（主键）→ `auth.users(id)` on delete cascade | 每用户一行 |
| `items` | jsonb not null default '[]' | `normalize` 后的已学词条 key 数组（`string[]`） |
| `updated_at` | timestamptz default now() | |

### 4.5 `motivation`（激励状态，登录同步用，非社交）

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid（主键）→ `auth.users(id)` on delete cascade | 每用户一行 |
| `goal_per_day` | int not null default 5 | |
| `makeup_cards` | int not null default 0 | |
| `awarded_milestones` | int not null default 0 | |
| `seen_achievements` | jsonb not null default '[]' | `string[]` |

### 4.6 RLS（新增表统一策略）

```sql
alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.challenges     enable row level security;
alter table public.learned        enable row level security;
alter table public.motivation     enable row level security;

-- profiles：本人可读写；他人只读（昵称/码/单词数供排行榜与加好友查询）
create policy "own profile full" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public profile read" on public.profiles
  for select using (true);

-- friendships：只读/写自己的好友行
create policy "own friendships" on public.friendships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- challenges：仅对战双方可读写
create policy "participant challenges" on public.challenges
  for all using (auth.uid() in (challenger_id, challengee_id))
  with check (auth.uid() in (challenger_id, challengee_id));

-- learned / motivation：本人独占
create policy "own learned" on public.learned
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own motivation" on public.motivation
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> `profiles` 的「他人只读」策略只暴露了 `display_name / friend_code / total_learned` 三列 —— **不要**把邮箱等敏感字段放进这张表；邮箱只在 `auth.users` 内、由 Supabase 托管、RLS 不暴露。

## 5. 好友与好友码流程

1. 注册/首次登录后创建 `profiles` 行，生成唯一 `friend_code`（8 位大写字母数字，冲突重试）。
2. 「我的好友码」卡片展示 `friend_code` + 一键复制邀请链接 `https://<site>/#/f/<code>`。
3. **加好友**：输入对方码 → 校验码存在且非本人 → 插入双向两行 → 立即出现在双方好友列表。
4. **邀请链接**：登录用户打开 `#/f/<code>` → 识别码 → 确认后走同一套「加好友」。
5. **删好友**：删除双向两行（可选，MVP 可后置，见 §10）。

## 6. 同步范围补全（修正 login-sync spec）

原 login-sync spec（2026-09-30）只同步 `templates / wrong_entries / stats`，但应用现已新增 `learned` 与 `motivation` 两块 localStorage，登录后若不同步会丢失「已学单词、成就、补签卡」。本次补全：

| 本地 key | 云端表 | 说明 |
|----------|--------|------|
| `learned:v1` | `learned`（§4.4） | `string[]` 整存 jsonb |
| `motivation:v1` | `motivation`（§4.5） | 4 个标量 + `seen_achievements` jsonb |

- 同步策略沿用 login-sync §5：**登录后以云端为准，全量拉取 + 每次改动即时 upsert，last-write-wins**；游客仍走 localStorage。
- `stats` 表补 `total_learned` 列（当前 `stats.ts` 用 `totalLearned`，login-sync 旧 spec 写的 `review_count` 已过时，以 `totalLearned` 为准）。

## 7. 异步 PK 流程

1. **发起**：A 在某个单元点「挑战好友」→ 选好友 B。
2. **发起方先玩**：A 复用现有默写/点选流程答完这批词 → 得 `challenger_score`（答对词数）+ `challenger_duration_ms`。
3. **建挑战**：系统把该单元词条快照 + `challenger_score` 一次性写入 `challenges` 行（`status=pending`，此时 `challenger_score` 已确定、`challengee_score` 为 null）→ 送达 B。
4. **应战**：B 在「挑战」页看到待办（拉 `challengee_id = me and status = 'pending'`）→ 玩同一批词（`words` 快照）→ 得 `challengee_score` + `challengee_duration_ms`，`status=completed`、`completed_at` 记时。
5. **判胜**：前端派生 —— `challenger_score > challengee_score` 则 A 胜，反之 B 胜，相等平局；双方在结果页看到比分与胜负。

## 8. 排行榜

- **指标**：`profiles.total_learned`（累计背单词数），只展示 `display_name` + `total_learned`。
- **好友榜**：`select display_name, total_learned from profiles where user_id in (我的好友 ∪ 我) order by total_learned desc`。
- **全球榜**：`select display_name, total_learned from profiles order by total_learned desc limit 50`。
- 展示我的名次 + 前 N 名；不缓存（量小，直接查）。

## 9. 前端改动

| 文件 | 动作 |
|------|------|
| `src/lib/supabase.ts` | 扩展：新增 5 张表的类型化读写 + `friend_code` 生成 + 加好友 + 挑战读写 + 排行榜查询 |
| `src/lib/dataStore.ts` | 扩展：`learned` / `motivation` 纳入统一读写层（登录走云端、游客走 localStorage） |
| `src/components/AuthScreen.tsx` | 登录/注册后展示「我的好友码」卡片 |
| `src/components/FriendsScreen.tsx` | 新增：好友列表 + 加好友（输码/链接）+ 挑战待办 + 排行榜（好友榜/全球榜两个 tab） |
| `src/components/ChallengeScreen.tsx` | 新增：应战答题（复用默写/点选流程）+ 比分/胜负结果页 |
| `src/App.tsx` | 新增 `friends` / `challenge` view + 导航入口 + 邀请链接 hash 路由处理 |
| `src/App.css` | 好友/挑战/排行榜样式（复用 OKLCH token + primary/ghost/卡片类） |

- 纯逻辑（SM-2、streak、归一化、成就判定）全部复用，不改。
- `display_name` 默认取邮箱 `@` 前缀，用户可在设置里改（存 `profiles`）。

## 10. 部署与实施顺序

1. 建 Supabase 项目（用户手动）→ 跑建表 + RLS SQL（§4.6）。
2. 装 `@supabase/supabase-js`、配 env、写 `supabase.ts`（TDD）。
3. `dataStore` 补 `learned` / `motivation` 同步（TDD）。
4. 好友体系：`profiles` + 好友码 + 加/列好友（TDD）。
5. 异步 PK：挑战创建 / 应战 / 计分 / 结果（TDD）。
6. 排行榜：好友榜 + 全球榜查询（TDD）。
7. UI：`AuthScreen` 好友码卡片、`FriendsScreen`、`ChallengeScreen`、`App.tsx` 接线。
8. `npm test` + `npm run build` 全绿 → 推 GitHub Pages。

**后置（YAGNI）**：删好友、挑战拒绝、战绩历史页、周榜、实时对战、头像、群组。

## 11. 风险与注意事项

1. **Supabase 需用户账号**：建项目/跑 SQL 需你手动，提供 `Project URL` + `anon key`。
2. **邮箱验证关闭**：任何人可用任意邮箱注册 —— 靠「好友码制 + 无公开搜索」控制社交面，全球榜只暴露昵称+单词数，无邮箱泄露；若日后公开，再开验证/加 captcha。
3. **国内网络**：Supabase 域名可能偶发不稳，靠「每次改动同步写 localStorage 兜底缓存」缓解（沿用 login-sync §10）。
4. **免费档限制**：500MB 库、5 万月活 —— 个人 + 好友圈远超够用。
5. **好友码冲突**：8 位字母数字空间足够大，冲突概率极低；仍按唯一索引失败重试兜底。
6. **对战计分可被篡改（低风险）**：`challenges` 的 RLS 只校验「是否为对战双方」，双方理论上可改对方的分数字段（如 A 把 `challengee_score` 改成 0 让自己赢）。友好小圈子风险极低；若日后需严谨，再收紧为「只有 challengee 能写 `challengee_score`」的列级策略或加触发器。
