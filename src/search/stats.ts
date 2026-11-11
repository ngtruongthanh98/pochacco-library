import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { nameToString, type Book } from '../types/book'
import { foldVi } from './normalizeVi'

export type Row = { key: string; label: string; count: number; pages?: number; extra?: string }

export const LANG_LABEL: Record<string, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', fr: 'Tiếng Pháp', de: 'Tiếng Đức', ru: 'Tiếng Nga',
  zh: 'Tiếng Trung', pi: 'Pāli', km: 'Tiếng Khmer', th: 'Tiếng Thái',
}
export const STATUS_LABEL: Record<Book['status'], string> = {
  owned: 'Đang có', lent: 'Đang cho mượn', wishlist: 'Muốn mua', lost: 'Thất lạc',
}

const copiesOf = (b: Book) =>
  b.holdings.reduce((s, h) => s + (h.kind === 'print' ? (h.copies ?? 1) : 0), 0)
const locOf = (b: Book) => {
  const p = b.holdings.find((h) => h.kind === 'print')
  return p?.kind === 'print' ? p.location : undefined
}

/** Đếm theo khóa; mỗi sách có thể rơi vào nhiều khóa (ví dụ nhiều tác giả). */
const tally = (books: Book[], keys: (b: Book) => { key: string; label: string }[]): Row[] => {
  const m = new Map<string, Row>()
  for (const b of books) {
    const seen = new Set<string>()
    for (const k of keys(b)) {
      if (seen.has(k.key)) continue
      seen.add(k.key)
      const r = m.get(k.key) ?? { key: k.key, label: k.label, count: 0, pages: 0 }
      r.count++
      r.pages! += b.pages ?? 0
      m.set(k.key, r)
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'))
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export const PAGE_BINS = [
  { label: 'Dưới 100', min: 0, max: 99 },
  { label: '100–199', min: 100, max: 199 },
  { label: '200–299', min: 200, max: 299 },
  { label: '300–499', min: 300, max: 499 },
  { label: '500–799', min: 500, max: 799 },
  { label: '800–1199', min: 800, max: 1199 },
  { label: '1200 trở lên', min: 1200, max: Infinity },
]

const FIELDS: { key: string; label: string; has: (b: Book) => boolean }[] = [
  { key: 'categories', label: 'Danh mục', has: (b) => !!b.categories?.length },
  { key: 'authors', label: 'Tác giả', has: (b) => !!(b.authors?.length || b.editors?.length) },
  { key: 'publisher', label: 'Nhà xuất bản', has: (b) => !!b.publisher },
  { key: 'year', label: 'Năm xuất bản', has: (b) => !!b.year },
  { key: 'pages', label: 'Số trang', has: (b) => !!b.pages },
  { key: 'isbn', label: 'ISBN', has: (b) => !!(b.isbn13 || b.isbn10) },
  { key: 'location', label: 'Vị trí kệ', has: (b) => b.status === 'wishlist' || !!locOf(b) },
  { key: 'cover', label: 'Ảnh bìa riêng', has: (b) => !!b.cover },
]

export const computeStats = (all: Book[]) => {
  // Sách "muốn mua" chưa nằm trên kệ: tính riêng, không gộp vào số liệu thư viện.
  const books = all.filter((b) => b.status !== 'wishlist')
  const wish = all.filter((b) => b.status === 'wishlist')
  const pagesKnown = books.filter((b) => b.pages)
  const years = books.map((b) => b.year).filter((y): y is number => !!y)

  const groups: Row[] = CATEGORY_GROUPS.map((g, i) => {
    const inG = books.filter((b) => b.categories?.some((c) => g.items.some((x) => x.id === c)))
    return { key: String(i), label: g.label, count: inG.length, pages: inG.reduce((s, b) => s + (b.pages ?? 0), 0) }
  })
  const noCat = books.filter((b) => !b.categories?.length).length

  const categories = tally(books, (b) => (b.categories ?? []).map((c) => ({ key: c, label: categoryLabel(c) })))
  const categoryGroup = (id: string) => CATEGORY_GROUPS.find((g) => g.items.some((x) => x.id === id))?.label ?? ''

  const decadeMap = new Map<number, Row>()
  for (const b of books) {
    if (!b.year) continue
    const d = b.year < 1900 ? 1890 : Math.floor(b.year / 10) * 10
    const r = decadeMap.get(d) ?? { key: String(d), label: d === 1890 ? 'Trước 1900' : `${d}`, count: 0, pages: 0 }
    r.count++
    r.pages! += b.pages ?? 0
    decadeMap.set(d, r)
  }
  const decadeKeys = [...decadeMap.keys()].sort((a, b) => a - b)
  // Điền thập niên trống ở giữa để trục thời gian không bị nén.
  const decades: Row[] = []
  if (decadeKeys.length) {
    const start = decadeKeys[0] === 1890 ? 1900 : decadeKeys[0]
    if (decadeMap.has(1890)) decades.push(decadeMap.get(1890)!)
    for (let d = start; d <= decadeKeys.at(-1)!; d += 10)
      decades.push(decadeMap.get(d) ?? { key: String(d), label: `${d}`, count: 0, pages: 0 })
  }

  const languages = tally(books, (b) => [{ key: b.language ?? '?', label: b.language ? (LANG_LABEL[b.language] ?? b.language) : 'Chưa ghi' }])
  const translated = books.filter((b) => b.translators?.length || b.originalTitle).length

  const person = (n: Parameters<typeof nameToString>[0]) => ({ key: foldVi(nameToString(n)), label: nameToString(n) })
  const authors = tally(books, (b) => (b.authors ?? []).map(person))
  const translators = tally(books, (b) => (b.translators ?? []).map(person))
  const publishers = tally(books, (b) => (b.publisher ? [{ key: foldVi(b.publisher), label: b.publisher }] : []))
  const partners = tally(books, (b) => (b.partner ? [{ key: foldVi(b.partner), label: b.partner }] : []))
  const series = tally(books, (b) => (b.series ? [{ key: foldVi(b.series), label: b.series }] : []))

  const shelves = tally(books, (b) => [{ key: locOf(b) ?? '', label: locOf(b) ?? 'Chưa ghi kệ' }]).map((r) => ({
    ...r,
    extra: String(books.filter((b) => (locOf(b) ?? '') === r.key).reduce((s, b) => s + copiesOf(b), 0)),
  }))

  const pageBins: Row[] = PAGE_BINS.map((bin) => ({
    key: bin.label,
    label: bin.label,
    count: pagesKnown.filter((b) => b.pages! >= bin.min && b.pages! <= bin.max).length,
  }))
  const longest = [...pagesKnown].sort((a, b) => b.pages! - a.pages!).slice(0, 5)

  // Nhịp bổ sung: số sách thêm vào mỗi tháng, 12 tháng gần nhất.
  const now = new Date()
  const months: Row[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: d.getMonth() === 0 || i === 0 ? `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` : `${d.getMonth() + 1}`, count: 0 }
  })
  for (const b of all) {
    const m = months.find((x) => b.createdAt?.startsWith(x.key))
    if (m) m.count++
  }

  const status: Row[] = (['owned', 'lent', 'lost', 'wishlist'] as const).map((s) => ({
    key: s,
    label: STATUS_LABEL[s],
    count: all.filter((b) => b.status === s).length,
  }))

  const completeness = FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    count: books.filter(f.has).length,
  }))
  // ISBN và ảnh bìa không bắt buộc (sách cũ thường không có ISBN), nên không tính là thiếu.
  const missingScore = (b: Book) => FIELDS.filter((f) => f.key !== 'cover' && f.key !== 'isbn' && !f.has(b)).map((f) => f.label)
  const needsWork = books
    .map((b) => ({ book: b, missing: missingScore(b) }))
    .filter((x) => x.missing.length)
    .sort((a, b) => b.missing.length - a.missing.length)

  const totals = {
    titles: books.length,
    copies: books.reduce((s, b) => s + copiesOf(b), 0),
    pages: pagesKnown.reduce((s, b) => s + b.pages!, 0),
    pagesKnown: pagesKnown.length,
    people: new Set([...authors, ...translators].map((r) => r.key)).size,
    publishers: publishers.length,
    ebooks: books.filter((b) => b.holdings.some((h) => h.kind === 'ebook')).length,
    wishlist: wish.length,
    lent: all.filter((b) => b.status === 'lent').length,
    medianPages: median(pagesKnown.map((b) => b.pages!)),
    medianYear: median(years),
    oldest: books.filter((b) => b.year).sort((a, b) => a.year! - b.year!)[0],
    newest: books.filter((b) => b.year).sort((a, b) => b.year! - a.year!)[0],
    translated,
    noCat,
    complete: books.length - needsWork.length,
  }

  // Nhận xét tự động: chỉ nói điều số liệu cho thấy rõ.
  const insights: string[] = []
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
  const topGroup = [...groups].sort((a, b) => b.count - a.count)[0]
  if (topGroup?.count)
    insights.push(`Nhóm nhiều sách nhất là ${topGroup.label}: ${topGroup.count} đầu sách, ${pct(topGroup.count, books.length)}% thư viện.`)
  if (categories[0]) insights.push(`Danh mục dày nhất là ${categories[0].label} (${categories[0].count} cuốn).`)
  if (noCat) insights.push(`${noCat} cuốn (${pct(noCat, books.length)}%) chưa gắn danh mục, nên chưa hiện trong các tab lọc và gợi ý.`)
  const topDecade = [...decades].sort((a, b) => b.count - a.count)[0]
  if (topDecade?.count) {
    const share = topDecade.count / years.length
    const lead = share > 0.5 ? 'Hơn một nửa số sách' : 'Nhiều sách nhất'
    const when = topDecade.key === '1890' ? 'trước năm 1900' : `thập niên ${topDecade.label}`
    insights.push(`${lead} in vào ${when} (${topDecade.count}/${years.length} cuốn có ghi năm); năm xuất bản trung vị là ${totals.medianYear}.`)
  }
  if (books.length) insights.push(`${translated} cuốn (${pct(translated, books.length)}%) là sách dịch.`)
  if (authors[0]?.count > 1) insights.push(`Tác giả có nhiều sách nhất: ${authors[0].label} (${authors[0].count} cuốn).`)
  if (translators[0]?.count > 1) insights.push(`Dịch giả xuất hiện nhiều nhất: ${translators[0].label} (${translators[0].count} cuốn).`)
  if (publishers[0]?.count > 1) insights.push(`Nhà xuất bản nhiều sách nhất: ${publishers[0].label} (${publishers[0].count} cuốn).`)
  if (totals.pages)
    insights.push(
      `Tổng cộng khoảng ${totals.pages.toLocaleString('vi-VN')} trang (tính trên ${totals.pagesKnown} cuốn có ghi số trang); đọc 30 trang mỗi ngày thì mất khoảng ${(Math.round((totals.pages / 30 / 365) * 10) / 10).toLocaleString('vi-VN')} năm.`,
    )
  if (needsWork.length) insights.push(`${needsWork.length} cuốn còn thiếu thông tin; danh sách ở cuối trang giúp bổ sung dần.`)

  return {
    totals, groups, noCat, categories, categoryGroup, decades, languages, authors, translators, publishers,
    partners, series, shelves, pageBins, longest, months, status, completeness, needsWork, insights,
  }
}

export type Stats = ReturnType<typeof computeStats>
