import type { TemplateItem, ParseResult } from '../types'

let seq = 0

/**
 * Parses template text into items. Each non-empty line is either
 * "English | Chinese" (pipe or tab separated) or, if no separator is
 * present, English only (with a warning and empty Chinese).
 */
export function parseTemplate(text: string): ParseResult {
  const items: TemplateItem[] = []
  const warnings: string[] = []

  const raw = text.replace(/^﻿/, '') // strip UTF-8 BOM
  const lines = raw.split(/\r?\n/)

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const parts = splitLine(trimmed)
    if (parts.length >= 2) {
      items.push({ id: `item-${seq++}`, en: parts[0], zh: parts[1] })
    } else {
      items.push({ id: `item-${seq++}`, en: trimmed, zh: '' })
      warnings.push(`第 ${idx + 1} 行缺少中文释义（请用 “|” 分隔英文与中文）`)
    }
  })

  return { items, warnings }
}

function splitLine(line: string): string[] {
  if (line.includes('|')) return line.split('|').map((s) => s.trim())
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim())
  return [line]
}
