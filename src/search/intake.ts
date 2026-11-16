// Phân tích nhịp nhập sách: gom theo ngày, tuần, tháng, năm và theo từng đợt nhập.
// "Đợt" là một lượt thêm nhiều cuốn cùng lúc, hoặc chuỗi cuốn thêm lẻ cách nhau không quá SESSION_GAP phút.
// Mọi mốc thời gian tính theo giờ của máy đang dùng.
import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { nameToString, type Book } from '../types/book'
import { dayKey, fmtDay } from './added'
import { LANG_LABEL, type Row } from './stats'

export type Gran = 'day' | 'week' | 'month' | 'year'
export const GRANS: { id: Gran; label: string; unit: string; span: number }[] = [
  { id: 'day', label: 'Ngày', unit: 'ngày', span: 30 },
  { id: 'week', label: 'Tuần', unit: 'tuần', span: 16 },
  { id: 'month', label: 'Tháng', unit: 'tháng', span: 12 },
  { id: 'year', label: 'Năm', unit: 'năm', span: 8 },
]
export const SESSION_GAP = 20

const pad = (n: number) => String(n).padStart(2, '0')
const created = (b: Book) => (b.createdAt ? new Date(b.createdAt) : null)
const monday = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Khóa kỳ: ngày "2026-11-17", tuần là ngày thứ Hai đầu tuần, tháng "2026-11", năm "2026" */
export function periodKey(d: Date, g: Gran): string {
  if (g === 'day') return dayKey(d)
  if (g === 'week') return dayKey(monday(d))
  if (g === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  return String(d.getFullYear())
}
const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
/** Kỳ đầu tiên của khóa, dạng Date */
function startOf(k: string, g: Gran): Date {
  if (g === 'day' || g === 'week') return parseDay(k)
  if (g === 'month') return parseDay(`${k}-01`)
  return new Date(Number(k), 0, 1)
}
function step(k: string, g: Gran, n: number): string {
  const d = startOf(k, g)
  if (g === 'day') d.setDate(d.getDate() + n)
  else if (g === 'week') d.setDate(d.getDate() + 7 * n)
  else if (g === 'month') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return periodKey(d, g)
}
/** Ngày đầu và ngày cuối của kỳ, dùng cho bộ lọc "nhap" của danh sách */
export function periodRange(k: string, g: Gran): [string, string] {
  const a = startOf(k, g)
  const b = startOf(step(k, g, 1), g)
  b.setDate(b.getDate() - 1)
  return [dayKey(a), dayKey(b)]
}
export const rangeFilter = ([a, b]: [string, string]) => (a === b ? a : `${a}_${b}`)

export function periodLabel(k: string, g: Gran): string {
  if (g === 'day') return `Ngày ${fmtDay(k)}`
  if (g === 'week') {
    const [a, b] = periodRange(k, g)
    return `Tuần ${fmtDay(a).slice(0, 5)} – ${fmtDay(b)}`
  }
  if (g === 'month') return `Tháng ${Number(k.slice(5))}/${k.slice(0, 4)}`
  return `Năm ${k}`
}
export function shortLabel(k: string, g: Gran): string {
  if (g === 'day' || g === 'week') return fmtDay(k).slice(0, 5)
  if (g === 'month') return `${Number(k.slice(5))}/${k.slice(2, 4)}`
  return k
}

/** Chuỗi kỳ liên tục (kể cả kỳ trống) kết thúc ở kỳ hiện tại */
export function timeline(books: Book[], g: Gran, span: number): Row[] {
  const m = new Map<string, Row>()
  let first: string | null = null
  for (const b of books) {
    const d = created(b)
    if (!d) continue
    const k = periodKey(d, g)
    if (!first || k < first) first = k
    const r = m.get(k) ?? { key: k, label: shortLabel(k, g), count: 0, pages: 0 }
    r.count++
    r.pages! += b.pages ?? 0
    m.set(k, r)
  }
  if (!first) return []
  const end = periodKey(new Date(), g)
  let k = step(end, g, -(span - 1))
  if (k < first) k = first
  const out: Row[] = []
  for (let i = 0; i < 400 && k <= end; i++, k = step(k, g, 1)) out.push(m.get(k) ?? { key: k, label: shortLabel(k, g), count: 0, pages: 0 })
  return out
}

export const inPeriod = (k: string, g: Gran) => (b: Book) => {
  const d = created(b)
  return !!d && periodKey(d, g) === k
}
export const prevPeriod = (k: string, g: Gran) => step(k, g, -1)

export type Session = { id: string; start: Date; end: Date; books: Book[]; bulk: boolean }
/**
 * Gom sách thành các đợt nhập, mới nhất trước.
 * Những cuốn ghi cùng một thời điểm (thêm một lượt, ví dụ nhập theo lô ảnh) là một đợt riêng.
 * Những cuốn thêm lẻ từng cuốn thì gộp lại nếu cách nhau không quá gapMin phút.
 */
export function sessions(books: Book[], gapMin = SESSION_GAP): Session[] {
  const by = new Map<string, Book[]>()
  for (const b of books) if (b.createdAt) by.set(b.createdAt, [...(by.get(b.createdAt) ?? []), b])
  const out: Session[] = []
  for (const k of [...by.keys()].sort()) {
    const bs = by.get(k)!
    const t = new Date(k)
    const bulk = bs.length >= 2
    const cur = out.at(-1)
    if (cur && !bulk && !cur.bulk && t.getTime() - cur.end.getTime() <= gapMin * 60000) {
      cur.books.push(...bs)
      cur.end = t
    } else out.push({ id: k, start: t, end: t, books: [...bs], bulk })
  }
  return out.reverse()
}
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const sessionLabel = (s: Session) =>
  `${fmtDay(dayKey(s.start))} lúc ${fmtTime(s.start)}${s.end.getTime() - s.start.getTime() > 60000 ? `–${fmtTime(s.end)}` : ''}`

// ---------- Phân tích một nhóm sách so với phần thư viện có từ trước ----------

const PLACEHOLDER = /^(nhiều tác giả|nhóm tác giả|tập thể tác giả)$/i
const people = (b: Book) => [...(b.authors ?? []), ...(b.editors ?? [])].map(nameToString).filter((x) => x && !PLACEHOLDER.test(x.trim()))
const groupOf = (c: string) => CATEGORY_GROUPS.findIndex((g) => g.items.some((x) => x.id === c))

const count = (books: Book[], keys: (b: Book) => string[], label: (k: string) => string = (k) => k): Row[] => {
  const m = new Map<string, Row>()
  for (const b of books)
    for (const k of new Set(keys(b))) {
      const r = m.get(k) ?? { key: k, label: label(k), count: 0, pages: 0 }
      r.count++
      r.pages! += b.pages ?? 0
      m.set(k, r)
    }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'))
}

export type Link = { key: string; label: string; added: number; before: number; kind: 'cat' | 'person' | 'pub' | 'series' }
export type Analysis = {
  n: number
  pages: number
  hardcover: number
  translated: number
  groups: Row[]
  categories: Row[]
  publishers: Row[]
  persons: Row[]
  decades: Row[]
  languages: Row[]
  /** Danh mục, tác giả, NXB lần đầu có trong thư viện nhờ nhóm sách này */
  fresh: { cats: Row[]; persons: Row[]; pubs: Row[] }
  /** Chỗ nhóm sách này bồi thêm vào mảng đã có (sắp theo số cuốn thêm vào) */
  links: Link[]
  /** Các cụm trong chính nhóm: những cuốn chung danh mục hoặc chung tác giả */
  clusters: { label: string; books: Book[] }[]
  missing: { isbn: number; year: number; pages: number; cover: number; cats: number }
  insights: string[]
}

export function analyze(set: Book[], all: Book[]): Analysis {
  const ids = new Set(set.map((b) => b.id))
  const firstAdd = set.reduce((m, b) => (b.createdAt && b.createdAt < m ? b.createdAt : m), '9999')
  const before = all.filter((b) => !ids.has(b.id) && b.createdAt && b.createdAt < firstAdd)

  const groups = count(set, (b) => (b.categories ?? []).map(groupOf).filter((i) => i >= 0).map(String), (k) => CATEGORY_GROUPS[Number(k)]?.label ?? k)
  const categories = count(set, (b) => b.categories ?? [], categoryLabel)
  const publishers = count(set, (b) => (b.publisher ? [b.publisher] : []))
  const persons = count(set, people)
  const series = count(set, (b) => (b.series ? [b.series] : []))
  const decades = count(set, (b) => (b.year ? [String(Math.floor(b.year / 10) * 10)] : []), (k) => `${k}s`).sort((a, b) => a.key.localeCompare(b.key))
  const languages = count(set, (b) => [b.language ?? 'vi'], (k) => LANG_LABEL[k] ?? k)

  const bCats = count(before, (b) => b.categories ?? [])
  const bPers = count(before, people)
  const bPubs = count(before, (b) => (b.publisher ? [b.publisher] : []))
  const bSeries = count(before, (b) => (b.series ? [b.series] : []))
  const idx = (rows: Row[]) => new Map(rows.map((r) => [r.key, r.count]))
  const [mc, mp, mpub, ms] = [idx(bCats), idx(bPers), idx(bPubs), idx(bSeries)]

  const fresh = {
    cats: categories.filter((r) => !mc.has(r.key)),
    persons: persons.filter((r) => !mp.has(r.key)),
    pubs: publishers.filter((r) => !mpub.has(r.key)),
  }
  const links: Link[] = [
    ...categories.filter((r) => mc.has(r.key)).map((r) => ({ key: r.key, label: r.label, added: r.count, before: mc.get(r.key)!, kind: 'cat' as const })),
    ...persons.filter((r) => mp.has(r.key)).map((r) => ({ key: r.key, label: r.label, added: r.count, before: mp.get(r.key)!, kind: 'person' as const })),
    ...series.filter((r) => ms.has(r.key)).map((r) => ({ key: r.key, label: r.label, added: r.count, before: ms.get(r.key)!, kind: 'series' as const })),
  ].sort((a, b) => b.added - a.added || b.before - a.before)

  // Cụm nội bộ: ưu tiên tác giả chung (từ 2 cuốn), rồi danh mục chung (từ 2 cuốn), không lặp cụm trùng hệt.
  const clusters: Analysis['clusters'] = []
  const seen = new Set<string>()
  const push = (label: string, bs: Book[]) => {
    const sig = bs.map((b) => b.id).sort().join()
    if (bs.length < 2 || seen.has(sig)) return
    seen.add(sig)
    clusters.push({ label, books: bs })
  }
  for (const r of persons) if (r.count >= 2) push(`Cùng tác giả ${r.label}`, set.filter((b) => people(b).includes(r.key)))
  for (const r of series) if (r.count >= 2) push(`Cùng tùng thư ${r.label}`, set.filter((b) => b.series === r.key))
  for (const r of categories) if (r.count >= 2) push(`Cùng danh mục ${r.label}`, set.filter((b) => b.categories?.includes(r.key)))

  const n = set.length
  const pages = set.reduce((s, b) => s + (b.pages ?? 0), 0)
  const hardcover = set.filter((b) => b.holdings.some((h) => h.kind === 'print' && h.binding === 'hardcover')).length
  const translated = set.filter((b) => b.translators?.length || b.originalTitle).length
  const missing = {
    isbn: set.filter((b) => !b.isbn13 && !b.isbn10).length,
    year: set.filter((b) => !b.year).length,
    pages: set.filter((b) => !b.pages).length,
    cover: set.filter((b) => !b.cover).length,
    cats: set.filter((b) => !b.categories?.length).length,
  }

  const insights: string[] = []
  if (n) {
    const g0 = groups[0]
    if (g0) insights.push(`Trọng tâm là ${g0.label.toLowerCase()} với ${g0.count}/${n} cuốn${groups[1] ? `, kế đến ${groups[1].label.toLowerCase()} (${groups[1].count})` : ''}.`)
    const yrs = set.map((b) => b.year).filter((y): y is number => !!y).sort((a, b) => a - b)
    if (yrs.length >= 2) insights.push(`Năm xuất bản trải từ ${yrs[0]} đến ${yrs.at(-1)}, trung vị ${yrs[Math.floor(yrs.length / 2)]}.`)
    const p0 = publishers[0]
    if (p0 && p0.count >= 2 && p0.count / n >= 0.3) insights.push(`${p0.label} chiếm ${p0.count}/${n} cuốn.`)
    if (translated) insights.push(`${translated} cuốn là sách dịch.`)
    if (hardcover) insights.push(`${hardcover} cuốn bìa cứng.`)
    const strong = links.filter((l) => l.kind === 'cat').slice(0, 2)
    if (strong.length) insights.push(`Bồi thêm vào mảng có sẵn: ${strong.map((l) => `${l.label} (${l.before} → ${l.before + l.added})`).join(', ')}.`)
    if (fresh.cats.length) insights.push(`Mở thêm ${fresh.cats.length} danh mục mới cho thư viện: ${fresh.cats.slice(0, 3).map((r) => r.label).join(', ')}${fresh.cats.length > 3 ? '…' : ''}.`)
    const repeat = links.filter((l) => l.kind === 'person').slice(0, 2)
    if (repeat.length) insights.push(`Có thêm sách của tác giả đã có: ${repeat.map((l) => `${l.label} (đã có ${l.before})`).join(', ')}.`)
    if (fresh.persons.length && fresh.persons.length === persons.length && persons.length >= 3) insights.push('Toàn bộ tác giả trong nhóm này đều mới với thư viện.')
    const gaps = [missing.isbn && `${missing.isbn} cuốn chưa có ISBN`, missing.year && `${missing.year} cuốn chưa có năm`, missing.cover && `${missing.cover} cuốn chưa có ảnh bìa`].filter(Boolean)
    if (gaps.length) insights.push(`Cần bổ sung: ${gaps.join(', ')}.`)
  }

  return { n, pages, hardcover, translated, groups, categories, publishers, persons, decades, languages, fresh, links, clusters, missing, insights }
}

/** Tóm tắt một dòng cho một đợt: nhóm chính và vài danh mục nổi bật */
export function gist(set: Book[]): string {
  const cats = count(set, (b) => b.categories ?? [], categoryLabel).slice(0, 3)
  return cats.map((r) => `${r.label} (${r.count})`).join(', ')
}
