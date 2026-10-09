import { describe, it, expect } from 'vitest'
import { pullAll, importLocalToCloud } from './dataStore'
import type { CloudApi } from './supabase'
import type { Template } from './templates'
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
    calls,
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
