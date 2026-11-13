// Thống kê chuyên sâu theo thể loại và theo tác giả, kèm các nhận xét rút ra từ số liệu.
import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { nameToString, type Book, type Name } from '../types/book'
import { foldVi } from './normalizeVi'
import { mainRole, peopleIndex, personKey, type Person, type Role } from './people'
import { LANG_LABEL, type Row } from './stats'

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
const isTranslated = (b: Book) => !!(b.translators?.length || b.originalTitle)

const countBy = (items: { key: string; label: string }[]): Row[] => {
  const m = new Map<string, Row>()
  for (const it of items) {
    const r = m.get(it.key) ?? { key: it.key, label: it.label, count: 0 }
    r.count++
    m.set(it.key, r)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'))
}

const decadeRows = (books: Book[]): Row[] => {
  const ys = books.map((b) => b.year).filter((y): y is number => !!y)
  if (!ys.length) return []
  const lo = Math.floor(Math.min(...ys) / 10) * 10
  const hi = Math.floor(Math.max(...ys) / 10) * 10
  const rows: Row[] = []
  for (let d = lo; d <= hi; d += 10) rows.push({ key: String(d), label: String(d), count: ys.filter((y) => y >= d && y < d + 10).length })
  return rows
}

export type CatProfile = {
  id: string
  label: string
  group: string
  books: Book[]
  count: number
  pages: number
  authors: Row[]
  peopleCount: number
  medianYear?: number
  minYear?: number
  maxYear?: number
  translated: number
  languages: Row[]
  publishers: Row[]
  decades: Row[]
  related: Row[]
}

export type AuthorProfile = {
  person: Person
  role: Role
  count: number
  cats: Row[]
  minYear?: number
  maxYear?: number
  coauthors: Row[]
  publishers: Row[]
}

export function categoryProfile(id: string, all: Book[], people: Map<string, Person>): CatProfile {
  const books = all.filter((b) => b.status !== 'wishlist' && b.categories?.includes(id))
  const ys = books.map((b) => b.year).filter((y): y is number => !!y)
  const pk = (label: string) => people.get(peopleKeyOf(label))
  return {
    id,
    label: categoryLabel(id),
    group: CATEGORY_GROUPS.find((g) => g.items.some((x) => x.id === id))?.label ?? '',
    books,
    count: books.length,
    pages: books.reduce((s, b) => s + (b.pages ?? 0), 0),
    authors: countBy(books.flatMap((b) => (b.authors ?? []).map((n) => { const p = pk(nameOf(n)); return { key: p?.key ?? nameOf(n), label: p?.label ?? nameOf(n) } }))),
    peopleCount: new Set(books.flatMap((b) => [...(b.authors ?? []), ...(b.translators ?? []), ...(b.editors ?? [])].map((n) => peopleKeyOf(nameOf(n))))).size,
    medianYear: median(ys),
    minYear: ys.length ? Math.min(...ys) : undefined,
    maxYear: ys.length ? Math.max(...ys) : undefined,
    translated: books.filter(isTranslated).length,
    languages: countBy(books.map((b) => ({ key: b.language ?? '?', label: b.language ? (LANG_LABEL[b.language] ?? b.language) : 'Chưa ghi' }))),
    publishers: countBy(books.filter((b) => b.publisher).map((b) => ({ key: foldVi(b.publisher!), label: b.publisher! }))),
    decades: decadeRows(books),
    related: countBy(books.flatMap((b) => (b.categories ?? []).filter((c) => c !== id).map((c) => ({ key: c, label: categoryLabel(c) })))),
  }
}

const nameOf = (n: Name) => nameToString(n).trim()
const peopleKeyOf = (s: string) => personKey(s)

export function authorProfile(p: Person): AuthorProfile {
  const ys = p.books.map((b) => b.year).filter((y): y is number => !!y)
  return {
    person: p,
    role: mainRole(p),
    count: p.books.length,
    cats: countBy(p.books.flatMap((b) => (b.categories ?? []).map((c) => ({ key: c, label: categoryLabel(c) })))),
    minYear: ys.length ? Math.min(...ys) : undefined,
    maxYear: ys.length ? Math.max(...ys) : undefined,
    coauthors: countBy(
      p.books.flatMap((b) =>
        [...(b.authors ?? []), ...(b.translators ?? []), ...(b.editors ?? [])]
          .map(nameOf)
          .filter((s) => s && personKey(s) !== p.key)
          .map((s) => ({ key: personKey(s), label: s })),
      ),
    ),
    publishers: countBy(p.books.filter((b) => b.publisher).map((b) => ({ key: foldVi(b.publisher!), label: b.publisher! }))),
  }
}

export type Heat = { rows: { key: string; label: string; cells: number[]; total: number }[]; cols: string[]; max: number }

/** Bảng chéo nhóm danh mục × thập niên xuất bản. */
export function groupDecadeHeat(all: Book[]): Heat {
  const books = all.filter((b) => b.status !== 'wishlist' && b.year)
  const ds = [...new Set(books.map((b) => (b.year! < 1900 ? 1890 : Math.floor(b.year! / 10) * 10)))].sort((a, b) => a - b)
  const cols = ds.map((d) => (d === 1890 ? 'Trước 1900' : `${d}`))
  const rows = CATEGORY_GROUPS.map((g, i) => {
    const inG = books.filter((b) => b.categories?.some((c) => g.items.some((x) => x.id === c)))
    const cells = ds.map((d) => inG.filter((b) => (b.year! < 1900 ? 1890 : Math.floor(b.year! / 10) * 10) === d).length)
    return { key: String(i), label: g.label, cells, total: inG.length }
  }).filter((r) => r.total)
  return { rows, cols, max: Math.max(1, ...rows.flatMap((r) => r.cells)) }
}

export type Insight = { text: string; kind: 'focus' | 'gap' | 'link' | 'fix' }

export function deepAnalysis(all: Book[]) {
  const books = all.filter((b) => b.status !== 'wishlist')
  const people = peopleIndex(all)
  const catIds = [...new Set(books.flatMap((b) => b.categories ?? []))]
  const cats = catIds.map((id) => categoryProfile(id, all, people)).sort((a, b) => b.count - a.count)
  const authors = [...people.values()].map(authorProfile).sort((a, b) => b.count - a.count || a.person.label.localeCompare(b.person.label, 'vi'))
  const heat = groupDecadeHeat(all)

  const out: Insight[] = []
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
  const withAuthor = books.filter((b) => b.authors?.length)

  // Mức tập trung: vài tác giả chiếm bao nhiêu phần sách.
  const authorsOnly = authors.filter((a) => a.person.roles.author.length)
  const top3 = authorsOnly.slice(0, 3)
  if (top3.length === 3 && withAuthor.length) {
    const cover = new Set(top3.flatMap((a) => a.person.roles.author)).size
    out.push({ kind: 'focus', text: `Ba tác giả nhiều sách nhất (${top3.map((a) => a.person.label).join(', ')}) có mặt trong ${cover}/${withAuthor.length} cuốn có ghi tác giả (${pct(cover, withAuthor.length)}%). Thư viện xoay quanh một nhóm tác giả rất tập trung.` })
  }
  const solo = authorsOnly.filter((a) => a.person.roles.author.length === 1).length
  if (authorsOnly.length > 5) out.push({ kind: 'focus', text: `${solo}/${authorsOnly.length} tác giả (${pct(solo, authorsOnly.length)}%) chỉ có đúng một cuốn trong thư viện.` })

  // Cặp đồng tác giả xuất hiện nhiều nhất.
  const pairs = new Map<string, { a: string; b: string; n: number }>()
  for (const b of books) {
    const ks = [...new Map((b.authors ?? []).map((n) => [personKey(nameOf(n)), people.get(personKey(nameOf(n)))?.label ?? nameOf(n)])).entries()]
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const [x, y] = [ks[i], ks[j]].sort((p, q) => p[0].localeCompare(q[0]))
        const k = `${x[0]}|${y[0]}`
        const r = pairs.get(k) ?? { a: x[1], b: y[1], n: 0 }
        r.n++
        pairs.set(k, r)
      }
  }
  const topPair = [...pairs.values()].sort((a, b) => b.n - a.n)[0]
  if (topPair && topPair.n >= 3) out.push({ kind: 'link', text: `${topPair.a} và ${topPair.b} cùng đứng tên ${topPair.n} cuốn, cặp đồng tác giả gắn bó nhất trong thư viện.` })

  // Tác giả bắc cầu nhiều thể loại.
  const bridges = authors.filter((a) => a.cats.length >= 3 && a.count >= 2).sort((a, b) => b.cats.length - a.cats.length || b.count - a.count).slice(0, 3)
  if (bridges.length)
    out.push({ kind: 'link', text: `Tác giả trải rộng nhiều thể loại nhất: ${bridges.map((a) => `${a.person.label} (${a.cats.length} thể loại)`).join(', ')}.` })

  // Hai thể loại hay đi cùng nhau.
  const co = new Map<string, number>()
  for (const b of books) {
    const cs = [...new Set(b.categories ?? [])].sort()
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) co.set(`${cs[i]}|${cs[j]}`, (co.get(`${cs[i]}|${cs[j]}`) ?? 0) + 1)
  }
  const topCo = [...co.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topCo && topCo[1] >= 2) {
    const [x, y] = topCo[0].split('|')
    out.push({ kind: 'link', text: `Hai thể loại hay được gắn cùng nhau nhất: ${categoryLabel(x)} và ${categoryLabel(y)} (${topCo[1]} cuốn).` })
  }

  // Thể loại chiếm ưu thế.
  if (cats[0] && books.length) out.push({ kind: 'focus', text: `${cats[0].label} chiếm ${pct(cats[0].count, books.length)}% thư viện (${cats[0].count} cuốn), gấp ${Math.max(1, Math.round(cats[0].count / Math.max(1, cats[1]?.count ?? 1)))} lần thể loại đứng thứ hai.` })

  // Thể loại cũ nhất, mới nhất (theo năm xuất bản trung vị).
  const dated = cats.filter((c) => c.medianYear && c.count >= 3)
  if (dated.length >= 2) {
    const s = [...dated].sort((a, b) => a.medianYear! - b.medianYear!)
    out.push({ kind: 'focus', text: `Mảng sách "già" nhất là ${s[0].label} (năm in trung vị ${s[0].medianYear}); mảng "trẻ" nhất là ${s.at(-1)!.label} (${s.at(-1)!.medianYear}).` })
  }

  // Thể loại có tỷ lệ sách dịch cao nhất.
  const tr = cats.filter((c) => c.count >= 3).sort((a, b) => b.translated / b.count - a.translated / a.count)[0]
  if (tr && tr.translated) out.push({ kind: 'focus', text: `Mảng phụ thuộc nhiều nhất vào sách dịch: ${tr.label}, ${pct(tr.translated, tr.count)}% là bản dịch.` })

  // Khoảng trống: mảng mỏng và danh mục chưa có sách.
  const thin = cats.filter((c) => c.count <= 2)
  if (thin.length) out.push({ kind: 'gap', text: `${thin.length} thể loại mới có 1–2 cuốn: ${thin.slice(0, 6).map((c) => c.label).join(', ')}${thin.length > 6 ? '…' : ''}. Đây là các mảng còn mỏng nếu muốn mở rộng.` })
  const empty = CATEGORY_GROUPS.flatMap((g) => g.items).filter((x) => !catIds.includes(x.id))
  if (empty.length) out.push({ kind: 'gap', text: `Chưa có cuốn nào trong: ${empty.slice(0, 6).map((x) => x.label).join(', ')}${empty.length > 6 ? ` và ${empty.length - 6} danh mục khác` : ''}.` })

  // Tên viết nhiều kiểu.
  const variants = [...people.values()].filter((p) => p.variants.length > 1)
  if (variants.length)
    out.push({ kind: 'fix', text: `${variants.length} người đang được ghi tên theo nhiều cách (${variants.slice(0, 3).map((p) => p.variants.map((v) => `"${v}"`).join(' / ')).join('; ')}). App đã gộp lại khi thống kê; nên sửa cho thống nhất để tìm kiếm và trích dẫn chính xác.` })

  return { cats, authors, heat, insights: out, people }
}
