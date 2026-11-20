import type { Book } from '../types/book'

/** Dạng sở hữu, tính từ holdings nên tự cập nhật: thêm bản giấy là cuốn sách rời khỏi "Ebook only". */
export type Format = 'both' | 'print' | 'ebook' | 'none'
export type FormatKey = Exclude<Format, 'none'> | 'hasPrint' | 'hasEbook'
export type FormatFilter = FormatKey | null

export const formatOf = (b: Book): Format => {
  const p = b.holdings.some((h) => h.kind === 'print')
  const e = b.holdings.some((h) => h.kind === 'ebook')
  return p && e ? 'both' : p ? 'print' : e ? 'ebook' : 'none'
}
export const isEbookOnly = (b: Book) => formatOf(b) === 'ebook'

/** Sách có khớp bộ lọc dạng sách không. "Có sách giấy" gồm cả sách giấy có thêm ebook; "Có ebook" tương tự. */
export const matchFormat = (b: Book, k: FormatFilter) => {
  if (!k) return true
  const f = formatOf(b)
  if (k === 'hasPrint') return f === 'print' || f === 'both'
  if (k === 'hasEbook') return f === 'ebook' || f === 'both'
  return f === k
}

export const FORMAT_OPTIONS: { key: FormatKey; slug: string; label: string }[] = [
  { key: 'hasPrint', slug: 'co-sach-giay', label: 'Có sách giấy' },
  { key: 'print', slug: 'chi-sach-giay', label: 'Chỉ sách giấy' },
  { key: 'both', slug: 'ca-hai', label: 'Có cả hai' },
  { key: 'ebook', slug: 'ebook-only', label: 'Ebook only' },
  { key: 'hasEbook', slug: 'co-ebook', label: 'Có ebook' },
]
