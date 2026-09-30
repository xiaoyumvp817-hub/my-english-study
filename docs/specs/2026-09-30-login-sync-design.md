# 登录/注册 + 跨设备进度同步 — 设计方案

> 目标：用户可以注册、登录账号；用同一账号在另一台设备（异地）登录后，所有学习进度（模板库、错题本、统计）自动保留，无需每次重新导入。

## 1. 已定稿决策

| 维度 | 决定 |
|------|------|
| 后端 | **Supabase**（托管 Auth + PostgreSQL + 行级安全 RLS） |
| 登录方式 | **邮箱 + 密码**（`signUp` / `signInWithPassword` / `signOut`） |
| 登录门槛 | **可选登录**：未登录仍是「游客模式」（数据存 localStorage），顶部提供「登录/注册」入口；登录后切换为云端同步 |
| 邮箱验证 | **关闭**（注册即用，无需收确认邮件，减少摩擦） |
| 同步模型 | **登录后以云端为准**：登录时全量拉取 + 每次改动即时 upsert（last-write-wins），不做实时冲突合并 |

---

## 2. 总体架构

```
浏览器(React SPA)  ──HTTP──▶  Supabase（托管后端）
  │  @supabase/supabase-js       ├─ Auth：邮箱密码，签发 JWT + 自动刷新
  │                              ├─ PostgreSQL：templates / wrong_entries / stats
  │                              └─ RLS：auth.uid() = user_id 隔离行级数据

部署不变：前端仍放 GitHub Pages（纯静态），后端就是 Supabase 云服务。
```

- 前端**无需自建服务器**；GitHub Pages 纯静态正好契合「前端直连云后端」。
- 登录后 supabase-js 自动在请求头携带 JWT，数据库用 RLS 按 `user_id` 隔离，所以公开的 `anon key` 无安全风险（见 §8）。

---

## 3. 数据库设计 + RLS

三张表，与现有 localStorage 三块数据一一对应，**数据结构基本不变**（jsonb 存数组/对象，前端零重写）。

### `templates`
| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text（主键） | 沿用前端 `tpl-${Date.now()}-${random}` 字符串 id |
| `user_id` | uuid → `auth.users(id)` on delete cascade | 归属 |
| `name` | text | 模板名 |
| `created_at` | bigint | 毫秒时间戳 |
| `items` | jsonb | `TemplateItem[]`（`{id, en, zh, image?}`）整条存 |
| `warnings` | jsonb | `string[]` |
| `updated_at` | timestamptz default now() | 乐观更新用 |

### `wrong_entries`
| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid（主键） | 由数据库生成 |
| `user_id` | uuid → `auth.users(id)` on delete cascade | |
| `key` | text | `normalize(en)\|wordIndex`（应用内去重键） |
| `en` / `zh` / `word` | text | |
| `word_index` | int | |
| `added_at` / `due_at` / `last_review_at` | bigint | |
| `repetition` / `reviews` / `lapses` | int | |
| `interval_days` | int | |
| `ease_factor` | double precision | SM-2 系数 |
| — | — | 唯一约束 `(user_id, key)` |

### `stats`
| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid（主键）→ `auth.users(id)` on delete cascade | 每用户一行 |
| `xp` / `streak_days` / `review_count` | int | |
| `last_study_date` | text | `YYYY-MM-DD` |
| `daily_history` | jsonb | `Record<string, number>` |
| `updated_at` | timestamptz default now() | |

### RLS（三张表一致）

```sql
alter table public.templates       enable row level security;
alter table public.wrong_entries   enable row level security;
alter table public.stats           enable row level security;

create policy "own rows" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- wrong_entries、stats 同理
```

> 完整的建表 + 策略 SQL 会在实现阶段一次性写好，交你在 Supabase SQL Editor 执行。

---

## 4. 认证流程

- 新增依赖 `@supabase/supabase-js`（v2）；`src/lib/supabase.ts` 单例初始化客户端。
- **注册** `signUp({ email, password })`（已关邮箱验证，返回即登录态）。
- **登录** `signInWithPassword({ email, password })`。
- **登出** `signOut()`。
- **恢复会话**：页面加载 `getSession()`（刷新不丢登录态）；`onAuthStateChange` 监听登录/登出切换。

---

## 5. 同步策略（核心）

**模型：登录后以云端为准；登录时全量拉取 + 每次改动即时 upsert。**

- **登录时**：并行拉取三张表全部数据 → 灌入应用状态。
- **每次改动**（增/改名/删模板、记录错词、复习、加 XP）：立即 upsert 到 Supabase，同时镜像一份到 localStorage 作兜底缓存（网络抖动时下次可读缓存）。
- **登出 / 游客模式**：走回 localStorage 读写（现状不变）。

> 不做实时订阅/离线冲突合并：异地登录是「不同时间、不同设备」而非「同时改同一行」，last-write-wins 已足够，避免引入不必要复杂度。

### 数据流

```
游客：AppState ──▶ localStorage（现状，不动）
登录：AppState ──▶ Supabase upsert（主） + localStorage（兜底缓存）
登录时：Supabase ──▶ AppState（全量拉取）
```

---

## 6. 现有本地数据迁移

登录后不能丢当前 localStorage 里的数据：

- **首次登录时**提供「把本地数据导入云端」按钮。
  - 云端为空、本地有数据 → 一键上传三块本地数据。
  - 云端已有数据 → 直接加载云端；导入时**合并**：错题本按 `key` 去重（云端优先）、模板直接追加、统计按 `daily_history` 按天合并，不静默覆盖。

---

## 7. 前端改动

| 文件 | 动作 |
|------|------|
| `src/lib/supabase.ts` | 新增：初始化客户端、类型化三张表的读写函数 |
| `src/lib/dataStore.ts` | 新增：统一读写层（登录走云端、游客走 localStorage，同一接口），替换 `App.tsx` 里对 `loadTemplates/saveTemplates`、`loadEntries/saveEntries`、`loadStats/saveStats` 的直接调用 |
| `src/components/AuthScreen.tsx` | 新增：登录/注册/登出表单（邮箱 + 密码） |
| `src/App.tsx` | 修改：加登录态与「登录/退出」入口；数据读写改走 `dataStore`；首次登录提供「导入本地数据」 |
| `src/App.css` | 修改：登录表单样式（复用现有 OKLCH token 与 primary/ghost 类） |

- 现有 `templates.ts` / `wrongbook.ts` / `stats.ts` 的**纯逻辑不动**（SM-2、排序、streak、归一化全部复用），只把「存/取」抽到 `dataStore` 换实现。
- 图片仍是 `public/images/` 静态文件，云端只存 `image` 路径字符串，跨设备自然加载。

---

## 8. 环境变量与安全

- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 放 `.env.local`（已 gitignore，不提交）。
- anon key 会打进前端 bundle——**这是设计如此**：安全由 RLS 保证，anon key 本身不是秘密；`service_role` key 永远只放服务端，绝不进前端。
- 建库脚本用 `auth.uid() = user_id` 强制隔离，跨账号越权读取被数据库层拒绝。

---

## 9. 部署与实施顺序

1. 建 Supabase 项目（用户手动，需账号）→ 给 `Project URL` + `anon key` → 跑建表/RLS 脚本。
2. 装依赖、加 env、写 `supabase.ts`（TDD）。
3. 写 `dataStore.ts`（本地/云端两套实现，同一接口，TDD）。
4. 写 `AuthScreen` + 接入 `App.tsx`。
5. 「本地数据导入云端」流程（TDD）。
6. `npm test` + `npm run build` 全绿 → 推 GitHub Pages。

---

## 10. 风险与注意事项

1. **Supabase 需用户账号**：建项目这一步我代做不了，需用户提供 URL + anon key。
2. **国内网络**：Supabase 域名在国内可能偶发不稳，靠「每次改动同步写 localStorage 兜底缓存」缓解；若访问困难可后续考虑自定义域名/镜像。
3. **免费档限制**：500MB 库、5 万月活、2 个项目——个人学习用量远超够用。
4. **邮箱验证关闭的代价**：任何人都能用任意邮箱注册（无法防滥用）。个人自用无碍；若日后公开，再开启验证或加 captcha。
