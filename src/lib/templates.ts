import type { TemplateItem } from '../types'

/** A named batch of uploaded sentences, persisted for long-term accumulation. */
export interface Template {
  id: string // `tpl-${Date.now()}-${随机}`
  name: string
  createdAt: number
  items: TemplateItem[]
  warnings: string[]
}

export type TemplateSort = 'time' | 'name'

export function makeTemplate(
  name: string,
  items: TemplateItem[],
  warnings: string[],
  now: number,
): Template {
  return {
    id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    items,
    warnings,
  }
}

/** Returns a new array sorted by time (newest first) or name (locale, pinyin for zh). */
export function sortTemplates(list: Template[], by: TemplateSort): Template[] {
  const sorted = [...list]
  if (by === 'name') {
    return sorted.sort(
      (a, b) => a.name.localeCompare(b.name, 'zh') || b.createdAt - a.createdAt,
    )
  }
  return sorted.sort((a, b) => b.createdAt - a.createdAt)
}

const STORAGE_KEY = 'templates:v1'

export function loadTemplates(): Template[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Template[]) : []
  } catch {
    return []
  }
}

export function saveTemplates(list: Template[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // storage unavailable or full — non-fatal
  }
}
