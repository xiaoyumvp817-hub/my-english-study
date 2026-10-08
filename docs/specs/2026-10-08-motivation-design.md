# 激励系统（成就 · 图鉴 · 打卡）设计方案

- 日期：2026-10-08
- 状态：已确认（待进入实施计划）
- 范围：新增「激励机制」子系统 —— 单元图鉴 + 成就徽章 + 每日打卡，全部纯视觉激励、零货币、零后端

---

## 1. 背景与目标

当前应用已完成学习闭环（模板 → 点选复习 → 输入默写 → 错题本 SM-2 复习），并有 XP / 等级 / 连续学习 / 累计统计，以及刚加入的视觉特效（撒花 / 抖动 / 3D 翻牌 / 进度条 / 氛围）。但作为**儿童英语学习游戏**，还缺「让孩子主动想玩、天天回来」的激励层：没有可收集的图鉴、没有里程碑徽章、没有可视化的打卡进度。

本次目标：补上激励层，核心一句话 —— **让坚持和收集本身有回报，孩子每天打开第一眼就看到「今天学了多少、离目标还差多少、收集到哪儿了」。**

## 2. 已确认的关键决策

通过方向对齐，以下决策已由用户确认：

| 维度 | 决定 |
|------|------|
| 奖励形态 | **纯视觉激励**（点亮图鉴、徽章、称号、等级光），不引入货币 / 盲盒 |
| 图鉴最小单元 | **单元章**：完成一个 unit（该 unit 全部句子学完）点亮一枚主题章 |
| 每日目标 | **默认 5 句**，可改 3 / 5 / 10 |
| 「连续」定义 | **连续达标日**（每天达成目标才算连续，而非「学过就算」） |
| 断签保护 | **补签卡**：连续达标每满 7 天发 1 张，断签后可用 1 张回填最近未达标日 |
| 界面位置 | **首页「今日卡片」+ 独立「成就」屏** |

## 3. 设计原则

1. **以「今日」为轴心** —— 打开第一眼看到今日进度（x/5）、连续天数、图鉴进度，零启动成本。
2. **收集与里程碑驱动** —— 单元章逐个点亮 + 徽章墙逐个亮起，给「收集欲」一个出口。
3. **不惩罚、只正向** —— 达标给奖励，未达标只提示「还差 N 句」，不扣任何东西。
4. **派生优于落库** —— 图鉴和成就都从现有数据派生，避免状态漂移；只落库「目标 / 补签卡 / 已读」这类无法派生的少量状态。
5. **YAGNI** —— 货币、盲盒、换皮解锁、社交、排行榜全部后置。

## 4. 数据模型

### 4.1 新增独立模块 `motivation:v1`

新增 `src/lib/motivation.ts` + 独立 localStorage key `motivation:v1`，**不塞进现有 `Stats`**，保持解耦：

```ts
interface Motivation {
  goalPerDay: number        // 每日目标，默认 5，可改 3 / 5 / 10
  makeupCards: number       // 补签卡数量，默认 0
  awardedMilestones: number // 已发放过补签卡的连续里程碑（floor(连续达标/7) 的单调高水位），防重复发放
  seenAchievements: string[] // 已「看过」的成就 id（用于「新解锁」提示只弹一次）
}
```

### 4.2 派生数据（不落库）

- **单元章**：某 template 完成 ⟺ 该 template 所有 `item.en` 的 `normalize` 都在 `learned` 中。
- **成就解锁**：`achievements(stats, learned, templates, entries)` 纯函数返回已解锁成就 id 列表。
- **达标连续天数**：`goalStreak(dailyHistory, goal, today)` 纯函数（见 §7.2）。

> 为什么「派生不存」：成就是 stats / learned 的纯函数，落库反而要和未来改动同步、易漂移。代价是拿不到解锁时间戳（对本设计不重要）。

## 5. 单元图鉴（收集）

- **完成判定**：`templateCompleted(template, learned) = template.items.every(it => learned.has(normalize(it.en)))`。
- **展示**：图鉴按模板创建时间排序，展示所有 unit；完成 = 点亮 + 主题图（复用该 unit 已有配图 `item.image`，无图用 emoji 兜底）；未完成 = 灰显 + 进度（已完成 x / 总 y 句）。
- **计数**：首页卡片显示 `图鉴 x/y`（x = 已完成 unit 数，y = 全部 unit 数）。
- 删除模板后对应章随之消失（可接受，模板为用户自建内容）。

## 6. 成就徽章

全部为**可派生**的里程碑，判定见下表。解锁时弹 toast（撒花复用现有 `Confetti`），徽章墙亮起；`seenAchievements` 用于「新解锁」角标只弹一次。

| id | 徽章 | 名称 | 判定条件 |
|----|------|------|---------|
| first-step | 🚀 | 起步 | `totalLearned ≥ 1` |
| ten-words | 🌱 | 小有成就 | `totalLearned ≥ 10` |
| hundred-words | 💯 | 百词达人 | `totalLearned ≥ 100` |
| five-hundred | 🏆 | 五百词霸 | `totalLearned ≥ 500` |
| streak-7 | 🔥 | 坚持一周 | `goalStreak ≥ 7` |
| streak-30 | 🌙 | 坚持一月 | `goalStreak ≥ 30` |
| collector-3 | 📚 | 图鉴收藏家 | 完成 unit ≥ 3 |
| collector-10 | 🗺️ | 单元大师 | 完成 unit ≥ 10 |
| clear-wrongs | 🧹 | 错题清零 | `entries.length > 0 && entries.every(isMastered)` |
| level-5 | ⚡ | 等级飞跃 | `levelForXp(xp) ≥ 5` |

> 成就可后续在 `motivation.ts` 的 `ACHIEVEMENTS` 数组里增删，判定均为纯函数，与 UI 解耦。

## 7. 打卡与连续（含补签卡）

### 7.1 达标定义

- **当日计数** `todayCount = dailyHistory[today]`（复用现有 `recordStudy`，每学完一句 +1、复习答对一题 +1）。
- **达标日**：`todayCount ≥ goal`。
- **学过未达标**：`0 < todayCount < goal`。

### 7.2 达标连续天数（纯函数）

```ts
function goalStreak(dailyHistory: Record<string, number>, goal: number, today: string): number {
  // 今天未达标则从昨天开始数
  let day = today
  if ((dailyHistory[day] ?? 0) < goal) day = yesterday(day)
  let streak = 0
  while ((dailyHistory[day] ?? 0) >= goal) {
    streak++
    day = yesterday(day)
  }
  return streak
}
```

### 7.3 补签卡

- **发放**：每连续达标满 7 天发 1 张（7 / 14 / 21…）。实现用单调高水位 `awardedMilestones`：每次学习后 `cur = floor(goalStreak / 7)`，若 `cur > awardedMilestones` 则 `makeupCards += (cur - awardedMilestones)` 并更新 `awardedMilestones = cur`；断签（streak 回落）不扣卡、不重复发。
- **使用**：断签后，用 1 张回填「最近一个未达标日」：把该日 `dailyHistory[day] = goal`（使该日达标），`makeupCards -= 1`，连续天数按回填后重算恢复。
- **展示**：`makeupCards > 0` 时首页卡片显示 `补签卡 ×n`，成就屏提供使用入口。
- 暂不设上限（后续若囤积过多再加）。

## 8. 界面设计

### 8.1 首页「今日卡片」（`TemplateLibrary` 顶部）

紧凑一行卡片，点击进入成就屏：

- 今日进度条 `今日 x / goal 句`（满格 = 达标）
- 🔥 连续达标 N 天
- 图鉴 `x / y`
- 补签卡 `×n`（仅 `n > 0` 时显示）

### 8.2 成就屏（新 `view: 'achievements'`，三段式）

1. **打卡日历**：当月网格热力图 —— 达标日 = 实心高亮、学过未达标 = 半格、未学 = 空；切换月份查看历史。
2. **单元图鉴**：grid 展示所有 unit 章，点亮 / 灰显 + 进度。
3. **成就徽章墙**：已解锁 = 彩色、未解锁 = 灰显（可预览条件）、新解锁 = 角标 + toast。
4. 底部：每日目标设置（3 / 5 / 10 三选一）。

## 9. 持久化与迁移

- 新增 key：`motivation:v1`（`goalPerDay / makeupCards / awardedMilestones / seenAchievements`）。
- 读取时对旧 / 缺失字段用默认值兜底（`goalPerDay=5`、`makeupCards=0`、`awardedMilestones=0`、`seenAchievements=[]`）。
- **不迁移**：现有 `stats:v1`、`learned:v1`、`wrongbook:v2` 原样复用，`dailyHistory` 已是热力图数据源。
- 旧 `Stats.streakDays / lastStudyDate`（「学习日连续」）保留字段但不再作为 UI 连续天数来源，改由 `goalStreak` 计算。

## 10. 技术落地

| 文件 | 变更 | 职责 |
|------|------|------|
| `src/lib/motivation.ts` | 新增 | `Motivation` 模型 + `load/save` + `goalStreak` + `templateCompleted` + 成就定义与判定 + 补签卡发放 / 使用纯函数 |
| `src/lib/stats.ts` | 改造 | 暴露 `dailyHistory` 供 `goalStreak` 使用；补签回填写 `dailyHistory` |
| `src/components/TodayCard.tsx` | 新增 | 首页今日卡片（进度条 + 连续 + 图鉴 + 补签卡） |
| `src/components/AchievementsScreen.tsx` | 新增 | 成就屏（日历 + 图鉴 + 徽章墙 + 目标设置） |
| `src/components/StreakBar.tsx` | 改造 | 🔥 连续天数改由 `goalStreak` 计算（若仍在用 `stats.streakDays`） |
| `src/App.tsx` | 改造 | 新增 `view: 'achievements'`、挂载 `motivation` state + 持久化、解锁 toast（复用 `Confetti`）、学习后刷新补签卡发放 |
| `src/App.css` | 改造 | 今日卡片、日历热力、图鉴 grid、徽章墙样式 |

**测试**：`motivation.ts` 为纯函数（`goalStreak` / 成就判定 / 补签卡发放 / 回填），用 vitest 覆盖，延续现有 `*.test.ts` 范式。

## 11. 非目标 / 明确后置（YAGNI）

- 货币、盲盒 / 抽奖、主题换皮解锁（金币消费）
- 排行榜、社交、学习伙伴
- 云端同步 / 多设备（等账号体系落地）
- 音效（Web Audio）—— 独立任务，不在本 spec
- 补签卡上限、断签宽限期（如后续需要再议）
