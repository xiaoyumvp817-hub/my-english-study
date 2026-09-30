export interface TemplateItem {
  id: string
  en: string
  zh: string
  /** Optional cover image path (e.g. "images/u5-001.jpg") resolved from public/. */
  image?: string
}

export type Token =
  | { kind: 'word'; id: string; text: string }
  | { kind: 'punct'; id: string; text: string }

export interface ParseResult {
  items: TemplateItem[]
  warnings: string[]
}
