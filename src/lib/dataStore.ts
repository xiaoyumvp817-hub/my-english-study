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
