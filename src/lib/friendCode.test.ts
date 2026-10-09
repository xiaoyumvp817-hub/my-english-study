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
