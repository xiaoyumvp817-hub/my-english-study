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
