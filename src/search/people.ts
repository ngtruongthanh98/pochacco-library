// Gom người (tác giả, dịch giả, người biên soạn) trong thư viện về một khóa chung, kể cả khi cùng một người
// được ghi theo nhiều cách ("V. I. Lênin" và "V.I. Lênin").
import { nameToString, type Book, type Name } from '../types/book'
import { foldVi } from './normalizeVi'

export type Role = 'author' | 'translator' | 'editor'
export const ROLE_LABEL: Record<Role, string> = { author: 'Tác giả', translator: 'Dịch giả', editor: 'Biên soạn' }

/** Khóa so khớp: bỏ dấu, bỏ dấu chấm, khoảng trắng và gạch nối. */
export const personKey = (s: string) => foldVi(s).replace(/[.\s\-‐–_,']/g, '')

export type Person = {
  key: string
  label: string
  /** Các cách viết khác nhau đang có trong dữ liệu */
  variants: string[]
  books: Book[]
  roles: Record<Role, Book[]>
}

export function peopleIndex(books: Book[]): Map<string, Person> {
  const m = new Map<string, Person & { vc: Map<string, number> }>()
  const add = (n: Name, b: Book, role: Role) => {
    const label = nameToString(n).trim()
    if (!label) return
    const key = personKey(label)
    let p = m.get(key)
    if (!p) {
      p = { key, label, variants: [], books: [], roles: { author: [], translator: [], editor: [] }, vc: new Map() }
      m.set(key, p)
    }
    p.vc.set(label, (p.vc.get(label) ?? 0) + 1)
    if (!p.roles[role].includes(b)) p.roles[role].push(b)
    if (!p.books.includes(b)) p.books.push(b)
  }
  for (const b of books) {
    if (b.status === 'wishlist') continue
    for (const n of b.authors ?? []) add(n, b, 'author')
    for (const n of b.translators ?? []) add(n, b, 'translator')
    for (const n of b.editors ?? []) add(n, b, 'editor')
  }
  for (const p of m.values()) {
    const vs = [...p.vc.entries()].sort((a, b) => b[1] - a[1])
    p.label = vs[0][0]
    p.variants = vs.map((v) => v[0])
  }
  return m as Map<string, Person>
}

/** Vai trò chính của một người: vai trò có nhiều sách nhất. */
export const mainRole = (p: Person): Role =>
  (['author', 'translator', 'editor'] as Role[]).sort((a, b) => p.roles[b].length - p.roles[a].length)[0]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Sách viết VỀ một người (không phải do người đó viết): tên xuất hiện trong nhan đề, phụ đề, chủ đề hoặc phần mô tả.
 * `names` gồm tên trong thư viện và các tên khác (ví dụ tên trên Wikipedia).
 */
export function booksAbout(names: string[], books: Book[], exclude: Set<Book> = new Set()): { book: Book; where: string }[] {
  const pats = [...new Set(names.map((n) => foldVi(n).replace(/\s+/g, ' ').trim()).filter((n) => n.replace(/[^a-z]/g, '').length >= 4))].map(
    (n) => new RegExp(`(^|[^a-z0-9])(?<!thanh pho |tp\\.? ?|duong mon |duong |chien dich |quan |tinh )${esc(n).replace(/\\\. ?/g, '\\.?\\s*')}($|[^a-z0-9])`),
  )
  if (!pats.length) return []
  const hit = (s?: string) => !!s && pats.some((p) => p.test(foldVi(s)))
  const out: { book: Book; where: string }[] = []
  for (const b of books) {
    if (exclude.has(b) || b.status === 'wishlist') continue
    const where = hit(b.title) || hit(b.subtitle) ? 'nhan đề' : b.subjects?.some(hit) ? 'chủ đề' : hit(b.description) ? 'mô tả' : ''
    if (where) out.push({ book: b, where })
  }
  return out
}
