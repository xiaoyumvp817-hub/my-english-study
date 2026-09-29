export interface TemplateItem {
  id: string
  en: string
  zh: string
}

export type Token =
  | { kind: 'word'; id: string; text: string }
  | { kind: 'punct'; id: string; text: string }

export interface ParseResult {
  items: TemplateItem[]
  warnings: string[]
}
