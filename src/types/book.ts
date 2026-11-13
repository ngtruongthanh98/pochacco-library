// Mô hình dữ liệu khớp với schema/book.schema.json trong repo pochacco-library-data.

export type ItemType =
  | 'book'
  | 'chapter'
  | 'article-journal'
  | 'paper-conference'
  | 'thesis'
  | 'webpage'
  | 'document'

/** Tên có cấu trúc theo CSL: tên người Việt và pháp danh dùng `literal`. */
export type Name =
  | { family: string; given?: string }
  | { literal: string }

export type Binding = 'paperback' | 'hardcover' | 'jacket' | 'special'
export const BINDINGS: { value: Binding; label: string }[] = [
  { value: 'paperback', label: 'Bìa mềm' },
  { value: 'hardcover', label: 'Bìa cứng' },
  { value: 'jacket', label: 'Bìa cứng có áo' },
  { value: 'special', label: 'Bản đặc biệt' },
]
export const bindingLabel = (b?: Binding) => BINDINGS.find((x) => x.value === b)?.label

export type PrintHolding = {
  kind: 'print'
  location?: string
  copies?: number
  condition?: string
  /** Loại bìa của bản giấy này (bỏ trống là chưa ghi). */
  binding?: Binding
}

export type EbookHolding = {
  kind: 'ebook'
  /** mobi: gồm cả AZW, AZW3, PRC (định dạng Kindle/Mobipocket) */
  format: 'pdf' | 'epub' | 'mobi' | 'djvu' | 'other'
  storage: 'gdrive' | 'local' | 'url'
  fileId?: string
  path?: string
  url?: string
  sha256?: string
  pdfPages?: number
  /** Trang in = trang PDF - pageOffset */
  pageOffset?: number
  textLayer?: 'native' | 'ocr' | 'none'
  sameEditionAsPrint?: boolean
}

export type Holding = PrintHolding | EbookHolding

export type Book = {
  id: string
  type: ItemType
  workKey?: string
  isbn13?: string
  isbn10?: string
  issn?: string
  title: string
  subtitle?: string
  originalTitle?: string
  authors?: Name[]
  translators?: Name[]
  editors?: Name[]
  publisher?: string
  partner?: string
  place?: string
  year?: number
  edition?: number
  pages?: number
  sizeCm?: string
  language?: string
  categories?: string[]
  subjects?: string[]
  tags?: string[]
  series?: string
  seriesNo?: number
  containerTitle?: string
  volume?: string
  issue?: string
  pageRange?: string
  genre?: string
  eventTitle?: string
  eventPlace?: string
  collectionTitle?: string
  doi?: string
  url?: string
  holdings: Holding[]
  status: 'owned' | 'lent' | 'lost' | 'wishlist'
  loan?: { to: string; date: string; due?: string }
  acquired?: { date?: string; from?: string; price?: number; gift?: boolean }
  /** Mô tả, giới thiệu nội dung sách (nhiều đoạn, ngăn bằng dòng trống) */
  description?: string
  notes?: string
  cover?: string
  source?: 'manual' | 'openlibrary' | 'googlebooks' | 'ocr' | 'import'
  createdAt: string
  updatedAt: string
}

export const nameToString = (n: Name): string =>
  'literal' in n ? n.literal : [n.given, n.family].filter(Boolean).join(' ')
