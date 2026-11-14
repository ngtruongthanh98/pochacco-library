// Lọc sách theo ngày nhập vào thư viện (createdAt). Ngày tính theo giờ của máy đang dùng.
import type { Book } from '../types/book'

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addedDay = (b: Book) => (b.createdAt ? dayKey(new Date(b.createdAt)) : '')
export const fmtDay = (k: string) => k.split('-').reverse().join('/')

/**
 * Giá trị bộ lọc (ghi trên địa chỉ web, tham số "nhap"):
 * "hom-nay", "7-ngay", "30-ngay", một ngày "2026-11-14", hoặc khoảng "2026-11-01_2026-11-14".
 */
export const ADDED_PRESETS: { key: string; label: string }[] = [
  { key: 'hom-nay', label: 'Hôm nay' },
  { key: '7-ngay', label: '7 ngày qua' },
  { key: '30-ngay', label: '30 ngày qua' },
]
const shift = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return dayKey(d)
}
export function addedRange(f: string): [string, string] | null {
  const today = dayKey(new Date())
  if (f === 'hom-nay') return [today, today]
  if (f === '7-ngay') return [shift(6), today]
  if (f === '30-ngay') return [shift(29), today]
  const m = /^(\d{4}-\d{2}-\d{2})(?:_(\d{4}-\d{2}-\d{2}))?$/.exec(f)
  if (!m) return null
  const a = m[1]
  const b = m[2] ?? m[1]
  return a <= b ? [a, b] : [b, a]
}
export const isAddedFilter = (f: string | null): f is string => !!f && addedRange(f) !== null
export function addedMatcher(f: string | null) {
  const r = f ? addedRange(f) : null
  if (!r) return () => true
  return (b: Book) => {
    const d = addedDay(b)
    return !!d && d >= r[0] && d <= r[1]
  }
}
export function addedLabel(f: string): string {
  const p = ADDED_PRESETS.find((x) => x.key === f)
  if (p) return p.label
  const r = addedRange(f)
  if (!r) return ''
  return r[0] === r[1] ? `Ngày ${fmtDay(r[0])}` : `Từ ${fmtDay(r[0])} đến ${fmtDay(r[1])}`
}
/** Các đợt nhập: mỗi ngày có sách được thêm, mới nhất trước */
export function batches(books: Book[]): { day: string; count: number }[] {
  const m = new Map<string, number>()
  for (const b of books) {
    const d = addedDay(b)
    if (d) m.set(d, (m.get(d) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, count]) => ({ day, count }))
}
