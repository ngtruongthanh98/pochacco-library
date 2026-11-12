import type { Book } from '../types/book'

/** Dạng sở hữu, tính từ holdings nên tự cập nhật: thêm bản giấy là cuốn sách rời khỏi "Ebook only". */
export type Format = 'both' | 'print' | 'ebook' | 'none'
export type FormatFilter = Exclude<Format, 'none'> | null

export const formatOf = (b: Book): Format => {
  const p = b.holdings.some((h) => h.kind === 'print')
  const e = b.holdings.some((h) => h.kind === 'ebook')
  return p && e ? 'both' : p ? 'print' : e ? 'ebook' : 'none'
}
export const isEbookOnly = (b: Book) => formatOf(b) === 'ebook'

export const FORMAT_OPTIONS: { key: Exclude<Format, 'none'>; slug: string; label: string }[] = [
  { key: 'ebook', slug: 'ebook-only', label: 'Ebook only' },
  { key: 'print', slug: 'chi-sach-giay', label: 'Chỉ sách giấy' },
  { key: 'both', slug: 'ca-hai', label: 'Có cả hai' },
]
