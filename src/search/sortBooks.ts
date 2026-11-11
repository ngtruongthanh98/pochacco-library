import { nameToString, type Book } from '../types/book'

export type SortKey = 'phu-hop' | 'moi' | 'nhan-de' | 'tac-gia' | 'nam' | 'ke'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'phu-hop', label: 'Phù hợp nhất' },
  { key: 'moi', label: 'Mới thêm' },
  { key: 'nhan-de', label: 'Nhan đề (A–Z)' },
  { key: 'tac-gia', label: 'Tác giả (A–Z)' },
  { key: 'nam', label: 'Năm xuất bản (mới trước)' },
  { key: 'ke', label: 'Vị trí kệ' },
]

export const isSortKey = (s: string | null): s is SortKey => SORT_OPTIONS.some((o) => o.key === s)

const PREF_KEY = 'pochacco-library:sort'
export const loadSortPref = (): SortKey => {
  try {
    const v = localStorage.getItem(PREF_KEY)
    return isSortKey(v) && v !== 'phu-hop' ? v : 'moi'
  } catch {
    return 'moi'
  }
}
export const saveSortPref = (k: SortKey) => {
  try {
    if (k !== 'phu-hop') localStorage.setItem(PREF_KEY, k)
  } catch {
    /* bỏ qua */
  }
}

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true })
const cmp = (a: string, b: string) => collator.compare(a, b)

const authorOf = (b: Book) => {
  const p = b.authors?.[0] ?? b.editors?.[0]
  return p ? nameToString(p) : ''
}
const shelfOf = (b: Book) => {
  for (const h of b.holdings) if (h.kind === 'print' && h.location) return h.location
  return ''
}
const byTitle = (a: Book, b: Book) => cmp(a.title, b.title)

/** Sắp xếp ổn định; sách thiếu dữ liệu của tiêu chí (không tác giả, không năm, không kệ) xếp cuối. */
export function sortBooks(list: Book[], key: SortKey): Book[] {
  if (key === 'phu-hop') return list
  const out = [...list]
  const missingLast = (get: (b: Book) => string) => (a: Book, b: Book) => {
    const x = get(a)
    const y = get(b)
    if (!x !== !y) return x ? -1 : 1
    return cmp(x, y) || byTitle(a, b)
  }
  switch (key) {
    case 'moi':
      out.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))
      break
    case 'nhan-de':
      out.sort(byTitle)
      break
    case 'tac-gia':
      out.sort(missingLast(authorOf))
      break
    case 'ke':
      out.sort(missingLast(shelfOf))
      break
    case 'nam':
      out.sort((a, b) => {
        if (!a.year !== !b.year) return a.year ? -1 : 1
        return (b.year ?? 0) - (a.year ?? 0) || byTitle(a, b)
      })
      break
  }
  return out
}
