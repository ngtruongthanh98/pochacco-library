// Gợi ý sách nên bổ sung vào thư viện. Mọi nguồn đều gọi được thẳng từ trình duyệt:
// phân tích dữ liệu sẵn có (bộ thiếu tập), Google Books, Wikidata.
import { CATEGORY_GROUPS } from './categories'
import { readConfigFile, writeConfigFile } from './configStore'
import type { StoreConfig } from './githubStore'
import { cleanDescription, toName } from './lookup'
import { findCandidates } from './wiki'
import { foldVi } from '../search/normalizeVi'
import { peopleIndex, personKey } from '../search/people'
import type { Book } from '../types/book'

export type SourceId = 'series' | 'author' | 'gap' | 'about' | 'topic'
export const SOURCES: { id: SourceId; label: string; desc: string }[] = [
  { id: 'series', label: 'Bộ còn thiếu tập', desc: 'Các bộ sách bạn đang có chưa đủ tập' },
  { id: 'author', label: 'Cùng tác giả', desc: 'Tác phẩm khác của tác giả bạn có nhiều sách' },
  { id: 'gap', label: 'Mảng còn mỏng', desc: 'Thể loại mới có 0–2 cuốn' },
  { id: 'about', label: 'Viết về tác giả', desc: 'Tiểu sử, nghiên cứu về tác giả bạn đọc nhiều' },
  { id: 'topic', label: 'Chủ đề của bạn', desc: 'Theo các từ khóa bạn đặt' },
]

export type Suggestion = {
  id: string
  source: SourceId
  title: string
  subtitle?: string
  authors: string[]
  year?: number
  publisher?: string
  isbn13?: string
  cover?: string
  description?: string
  language?: string
  pages?: number
  reason: string
  /** Gom theo nhóm (tên tác giả, tên mảng…) để hiển thị */
  group: string
  infoUrl?: string
  /** Các tập còn thiếu (chỉ với nguồn "series") */
  missing?: number[]
  total?: number
  seriesKey?: string
  seriesBase?: string
}

// ---------- Cài đặt lưu trong repo dữ liệu ----------
export type SuggestConfig = { v: 1; dismissed: string[]; topics: string[]; totals: Record<string, number> }
const emptyCfg = (): SuggestConfig => ({ v: 1, dismissed: [], topics: [], totals: {} })

export async function loadSuggestCfg(cfg: StoreConfig): Promise<{ sha: string | null; data: SuggestConfig }> {
  const r = await readConfigFile<SuggestConfig>(cfg, 'suggest')
  const d = r?.data
  return {
    sha: r?.sha ?? null,
    data: {
      v: 1,
      dismissed: Array.isArray(d?.dismissed) ? d!.dismissed : [],
      topics: Array.isArray(d?.topics) ? d!.topics : [],
      totals: d?.totals && typeof d.totals === 'object' ? d.totals : {},
    },
  }
}
export async function saveSuggestCfg(cfg: StoreConfig, data: SuggestConfig, sha: string | null, msg: string): Promise<string> {
  try {
    return await writeConfigFile(cfg, 'suggest', data, sha, msg)
  } catch {
    const r = await readConfigFile<SuggestConfig>(cfg, 'suggest')
    return writeConfigFile(cfg, 'suggest', data, r?.sha ?? null, msg)
  }
}
export { emptyCfg as emptySuggestCfg }

// ---------- So khớp với sách đã có ----------
const norm = (s: string) => foldVi(s).replace(/[^a-z0-9]+/g, ' ').trim()
export function ownedMatcher(books: Book[]) {
  const titles = books.map((b) => norm([b.title, b.subtitle].filter(Boolean).join(' ')))
  const isbns = new Set(books.flatMap((b) => [b.isbn13, b.isbn10].filter(Boolean) as string[]))
  return (s: { title: string; isbn13?: string }) => {
    if (s.isbn13 && isbns.has(s.isbn13)) return true
    const t = norm(s.title)
    if (t.length < 4) return false
    return titles.some((o) => o === t || (t.length >= 10 && o.startsWith(t)) || (o.length >= 10 && t.startsWith(o)))
  }
}

// ---------- 1. Bộ còn thiếu tập (không cần mạng) ----------
/** Số tập của một số bộ phổ biến bản tiếng Việt; người dùng sửa được. */
export const KNOWN_TOTALS: Record<string, number> = {
  vilenintoantap: 55,
  cmacvaphangghentoantap: 50,
  hochiminhtoantap: 15,
}
const volRe = /^(.*?)[\s,:–-]*(?:tập|tap|t\.|quyển|quyen|vol\.?)\s*(\d{1,3})\b/i
export const seriesKeyOf = (base: string) => personKey(base.replace(/\(\d{4}\)/g, ''))

export function seriesGaps(books: Book[], totals: Record<string, number>): Suggestion[] {
  const groups = new Map<string, { base: string; vols: Set<number>; sample: Book }>()
  for (const b of books) {
    let base: string | undefined
    let n: number | undefined
    const m = volRe.exec(b.title)
    if (m && m[1].trim().length >= 4) {
      base = m[1].trim()
      n = Number(m[2])
    } else if (b.series && b.seriesNo) {
      base = b.series
      n = b.seriesNo
    } else if (b.volume && /^\d+$/.test(b.volume)) {
      base = b.title
      n = Number(b.volume)
    }
    if (!base || !n) continue
    const key = seriesKeyOf(base)
    const g = groups.get(key) ?? { base, vols: new Set<number>(), sample: b }
    g.vols.add(n)
    groups.set(key, g)
  }
  const out: Suggestion[] = []
  for (const [key, g] of groups) {
    if (g.vols.size < 2 && !totals[key]) continue
    const max = Math.max(...g.vols)
    const total = totals[key] ?? KNOWN_TOTALS[key] ?? max
    const missing: number[] = []
    for (let i = 1; i <= total; i++) if (!g.vols.has(i)) missing.push(i)
    if (!missing.length) continue
    const s = g.sample
    out.push({
      id: `series:${key}`,
      source: 'series',
      title: g.base,
      authors: (s.authors ?? []).map((n) => ('literal' in n ? n.literal : [n.given, n.family].filter(Boolean).join(' '))),
      publisher: s.publisher,
      reason: `Bạn có ${g.vols.size}/${total} tập; còn thiếu ${fmtRanges(missing)}.${totals[key] || KNOWN_TOTALS[key] ? '' : ' (Tổng số tập đang đoán theo tập lớn nhất bạn có.)'}`,
      group: 'Bộ sách',
      missing,
      total,
      seriesKey: key,
      seriesBase: g.base,
    })
  }
  return out.sort((a, b) => (a.missing!.length - b.missing!.length))
}
export const fmtRanges = (xs: number[]) => {
  const parts: string[] = []
  for (let i = 0; i < xs.length; ) {
    let j = i
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++
    parts.push(j > i ? `tập ${xs[i]}–${xs[j]}` : `tập ${xs[i]}`)
    i = j + 1
  }
  return parts.join(', ')
}

// ---------- Google Books ----------
type GBItem = {
  id: string
  volumeInfo: {
    title: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; description?: string
    industryIdentifiers?: { type: string; identifier: string }[]; pageCount?: number; language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }; infoLink?: string; printType?: string
  }
}
const CACHE = 'pochacco-library:suggest:'
const TTL = 3 * 24 * 3600 * 1000
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE + key) ?? 'null') as { at: number; v: T } | null
    if (c && Date.now() - c.at < TTL) return c.v
  } catch {
    /* bỏ qua */
  }
  const v = await fn()
  try {
    localStorage.setItem(CACHE + key, JSON.stringify({ at: Date.now(), v }))
  } catch {
    /* đầy bộ nhớ */
  }
  return v
}

async function googleBooks(q: string, lang: 'vi' | 'any' = 'vi', max = 20): Promise<GBItem[]> {
  return cached(`gb:${lang}:${q}`, async () => {
    const url = `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: String(max), printType: 'books', ...(lang === 'vi' ? { langRestrict: 'vi' } : {}) })}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(r.status === 429 ? 'Google Books đang giới hạn lượt tra, thử lại sau ít phút.' : `Google Books lỗi HTTP ${r.status}`)
    const j = (await r.json()) as { items?: GBItem[] }
    return j.items ?? []
  })
}

const fromGB = (it: GBItem, source: SourceId, group: string, reason: string): Suggestion => {
  const v = it.volumeInfo
  const isbn13 = v.industryIdentifiers?.find((x) => x.type === 'ISBN_13')?.identifier
  const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail
  return {
    id: `gb:${it.id}`,
    source,
    title: v.title,
    subtitle: v.subtitle,
    authors: v.authors ?? [],
    year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || undefined : undefined,
    publisher: v.publisher,
    isbn13,
    cover: thumb ? thumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : undefined,
    description: cleanDescription(v.description),
    language: v.language,
    pages: v.pageCount || undefined,
    reason,
    group,
    infoUrl: v.infoLink?.replace(/^http:/, 'https:'),
  }
}

// ---------- Wikidata: tác phẩm của tác giả ----------
type WdRow = { w: { value: string }; wLabel: { value: string }; date?: { value: string } }
async function wikidataWorks(qid: string): Promise<{ qid: string; label: string; year?: number }[]> {
  return cached(`wd:${qid}`, async () => {
    const q = `SELECT ?w ?wLabel (MIN(?d) AS ?date) WHERE { ?w wdt:P50 wd:${qid} . ?w rdfs:label ?vi . FILTER(LANG(?vi) = "vi") OPTIONAL { ?w wdt:P577 ?d } SERVICE wikibase:label { bd:serviceParam wikibase:language "vi,en". } } GROUP BY ?w ?wLabel LIMIT 60`
    const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, { headers: { Accept: 'application/sparql-results+json' } })
    if (!r.ok) return []
    const j = (await r.json()) as { results: { bindings: WdRow[] } }
    return j.results.bindings.map((b) => ({ qid: b.w.value.split('/').pop()!, label: b.wLabel.value, year: b.date ? Number(b.date.value.slice(0, 4)) || undefined : undefined }))
  })
}
const QCACHE = 'pochacco-library:wiki-q:'
async function qidOf(name: string): Promise<string | undefined> {
  const k = QCACHE + personKey(name)
  const c = localStorage.getItem(k)
  if (c) return c
  const cs = await findCandidates(name).catch(() => [])
  const h = cs.find((x) => x.human)
  if (h) localStorage.setItem(k, h.qid)
  return h?.qid
}

// ---------- Chạy một nguồn ----------
export type Ctx = { books: Book[]; cfg: SuggestConfig }

/** Tác giả "chính" của thư viện: có từ 2 cuốn trở lên, nhiều nhất trước. */
const topAuthors = (books: Book[], n: number) =>
  [...peopleIndex(books).values()]
    .filter((p) => p.roles.author.length >= 2)
    .sort((a, b) => b.roles.author.length - a.roles.author.length)
    .slice(0, n)

export async function runSource(src: SourceId, { books, cfg }: Ctx): Promise<Suggestion[]> {
  if (src === 'series') return seriesGaps(books, cfg.totals)

  if (src === 'author') {
    const out: Suggestion[] = []
    for (const p of topAuthors(books, 6)) {
      const reason = `Bạn có ${p.roles.author.length} cuốn của ${p.label}.`
      const qid = await qidOf(p.label).catch(() => undefined)
      if (qid) {
        for (const w of await wikidataWorks(qid).catch(() => []))
          out.push({ id: `wd:${w.qid}`, source: 'author', title: w.label, authors: [p.label], year: w.year, reason: `${reason} Wikidata ghi đây là một tác phẩm của tác giả này.`, group: p.label, infoUrl: `https://www.wikidata.org/wiki/${w.qid}` })
      }
      const items = await googleBooks(`inauthor:"${p.label}"`).catch(() => [])
      for (const it of items) out.push(fromGB(it, 'author', p.label, reason))
    }
    return out
  }

  if (src === 'gap') {
    const counts = new Map<string, number>()
    for (const b of books) for (const c of b.categories ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
    const thin = CATEGORY_GROUPS.flatMap((g) => g.items.map((c) => ({ ...c, group: g.label })))
      .filter((c) => (counts.get(c.id) ?? 0) <= 2 && c.id !== 'khac')
      .sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))
      .slice(0, 8)
    const out: Suggestion[] = []
    for (const c of thin) {
      const n = counts.get(c.id) ?? 0
      const items = await googleBooks(c.label, 'vi', 12).catch(() => [])
      for (const it of items) out.push(fromGB(it, 'gap', c.label, n ? `Mảng ${c.label} mới có ${n} cuốn.` : `Chưa có cuốn nào trong mảng ${c.label}.`))
    }
    return out
  }

  if (src === 'about') {
    const out: Suggestion[] = []
    for (const p of topAuthors(books, 5)) {
      const items = await googleBooks(`intitle:"${p.label}"`, 'vi', 15).catch(() => [])
      for (const it of items) {
        // Bỏ những cuốn do chính người đó viết (đã có ở nguồn "Cùng tác giả").
        if ((it.volumeInfo.authors ?? []).some((a) => personKey(a) === p.key)) continue
        out.push(fromGB(it, 'about', p.label, `Sách viết về ${p.label}, tác giả bạn có ${p.roles.author.length} cuốn.`))
      }
    }
    return out
  }

  // topic
  const out: Suggestion[] = []
  for (const t of cfg.topics) {
    const items = await googleBooks(t, 'vi', 20).catch(() => [])
    for (const it of items) out.push(fromGB(it, 'topic', t, `Theo chủ đề bạn đặt: “${t}”.`))
  }
  return out
}

/** Bỏ trùng, bỏ sách đã có (kể cả đang trong danh sách Muốn mua) và gợi ý đã bỏ qua. */
export function clean(list: Suggestion[], books: Book[], dismissed: string[]): Suggestion[] {
  const owned = ownedMatcher(books)
  const seen = new Set<string>()
  const ds = new Set(dismissed)
  return list.filter((s) => {
    if (ds.has(s.id)) return false
    if (s.source !== 'series' && owned(s)) return false
    const k = norm(s.title) + '|' + (s.isbn13 ?? '')
    const k2 = norm(s.title)
    if (seen.has(k) || seen.has(k2)) return false
    seen.add(k)
    seen.add(k2)
    return true
  })
}

/** Bản nháp để mở form "Thêm sách" với trạng thái Muốn mua. */
export function toDraft(s: Suggestion, vol?: number): Partial<Book> {
  const lang = s.language && /^(vi|en|fr|de|ru|zh)$/.test(s.language) ? s.language : undefined
  return JSON.parse(
    JSON.stringify({
      title: vol ? `${s.seriesBase ?? s.title} - Tập ${vol}` : s.title,
      subtitle: s.subtitle,
      authors: s.authors.length ? s.authors.map((a) => toName(a, lang)) : undefined,
      publisher: s.publisher,
      year: s.year,
      pages: s.pages,
      isbn13: s.isbn13,
      language: lang,
      description: s.description,
      cover: s.cover,
      status: 'wishlist',
      holdings: [],
      source: s.id.startsWith('gb:') ? 'googlebooks' : 'manual',
    }),
  ) as Partial<Book>
}

// ---------- Tìm trên các trang mua bán ----------
export const SHOPS: { id: string; label: string; url: (q: string) => string }[] = [
  { id: 'oreka', label: 'Oreka', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(`site:oreka.vn ${q}`)}` },
  { id: 'chotot', label: 'Chợ Tốt', url: (q) => `https://www.chotot.com/mua-ban-sach?q=${encodeURIComponent(q)}` },
  { id: 'shopee', label: 'Shopee', url: (q) => `https://shopee.vn/search?keyword=${encodeURIComponent(q)}` },
  { id: 'tiki', label: 'Tiki', url: (q) => `https://tiki.vn/search?q=${encodeURIComponent(q)}` },
  { id: 'fahasa', label: 'Fahasa', url: (q) => `https://www.fahasa.com/searchengine?q=${encodeURIComponent(q)}` },
  { id: 'vuasachcu', label: 'Vựa Sách Cũ', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(`site:vuasachcu.com ${q}`)}` },
  { id: 'sachxua', label: 'Sách Xưa', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(`site:sachxua.vn ${q}`)}` },
]
export const shopQuery = (s: Suggestion, vol?: number) =>
  [vol ? `${s.seriesBase ?? s.title} tập ${vol}` : s.title, s.authors[0]].filter(Boolean).join(' ')
