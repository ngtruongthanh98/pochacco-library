// Tra cứu thông tin sách theo ISBN từ Open Library và Google Books, gộp thành một bản nháp.
// Cả hai API mở, không cần khóa, gọi thẳng từ trình duyệt.

import type { Book, Name } from '../types/book'

export type LookupResult = {
  draft: Partial<Book>
  sources: ('openlibrary' | 'googlebooks')[]
}

const VI_CHARS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹàáèéìíòóùúýõãĩũ]/i

/** "Immanuel Kant" → Kant, Immanuel; tên Việt hoặc tên có dấu tiếng Việt thì giữ nguyên thứ tự. */
export const toName = (raw: string, lang?: string): Name => {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (s.includes(',')) {
    const [family, ...rest] = s.split(',')
    const given = rest.join(',').trim()
    return given ? { family: family.trim(), given } : { literal: family.trim() }
  }
  const parts = s.split(' ')
  if (lang === 'vi' || VI_CHARS.test(s) || parts.length === 1) return { literal: s }
  return { family: parts.at(-1)!, given: parts.slice(0, -1).join(' ') }
}

const yearOf = (s?: string) => {
  const m = s?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)
  return m ? Number(m[1]) : undefined
}

type OLData = {
  title?: string
  subtitle?: string
  authors?: { name: string }[]
  publishers?: { name: string }[]
  publish_places?: { name: string }[]
  publish_date?: string
  number_of_pages?: number
  cover?: { small?: string; medium?: string; large?: string }
}

type GBVolume = {
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    pageCount?: number
    language?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

const withTimeout = async (url: string, ms = 8000) => {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

const fromOpenLibrary = async (isbn: string): Promise<OLData | null> => {
  try {
    const res = await withTimeout(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`)
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, OLData>
    return j[`ISBN:${isbn}`] ?? null
  } catch {
    return null
  }
}

const fromGoogleBooks = async (isbn: string): Promise<GBVolume['volumeInfo'] | null> => {
  try {
    const res = await withTimeout(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
    if (!res.ok) return null
    const j = (await res.json()) as { items?: GBVolume[] }
    return j.items?.[0]?.volumeInfo ?? null
  } catch {
    return null
  }
}

const LANGS = new Set(['vi', 'en', 'fr', 'de', 'ru', 'zh', 'pi', 'km', 'th'])

/** Tra hai nguồn song song; trường nào nguồn này thiếu thì lấy của nguồn kia. */
export const lookupIsbn = async (isbn13: string): Promise<LookupResult | null> => {
  const [ol, gb] = await Promise.all([fromOpenLibrary(isbn13), fromGoogleBooks(isbn13)])
  if (!ol && !gb) return null
  const lang = gb?.language && LANGS.has(gb.language) ? gb.language : undefined
  const authors = ol?.authors?.length
    ? ol.authors.map((a) => toName(a.name, lang))
    : gb?.authors?.map((a) => toName(a, lang))
  const gbThumb = gb?.imageLinks?.thumbnail ?? gb?.imageLinks?.smallThumbnail
  const cover = ol?.cover ? `ol:${isbn13}` : gbThumb ? gbThumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : undefined
  const draft: Partial<Book> = {
    isbn13,
    title: ol?.title ?? gb?.title,
    subtitle: ol?.subtitle ?? gb?.subtitle,
    authors: authors?.length ? authors : undefined,
    publisher: ol?.publishers?.[0]?.name ?? gb?.publisher,
    place: ol?.publish_places?.[0]?.name,
    year: yearOf(ol?.publish_date) ?? yearOf(gb?.publishedDate),
    pages: ol?.number_of_pages ?? (gb?.pageCount || undefined),
    language: lang,
    cover,
    source: ol ? 'openlibrary' : 'googlebooks',
  }
  return {
    draft: JSON.parse(JSON.stringify(draft)) as Partial<Book>,
    sources: [...(ol ? (['openlibrary'] as const) : []), ...(gb ? (['googlebooks'] as const) : [])],
  }
}

// ---------- Tìm theo nhan đề / tác giả (khi không có ISBN) ----------

export type Candidate = {
  key: string
  title: string
  authors: Name[]
  year?: number
  publisher?: string
  pages?: number
  isbn13?: string
  language?: string
  cover?: string
  source: 'openlibrary' | 'googlebooks'
}

const isbn13Of = (list?: string[]) => list?.find((x) => /^97[89]\d{10}$/.test(x))

/** Tra Open Library và Google Books theo nhan đề (và tác giả nếu có), gộp tối đa 8 ứng viên. */
export const searchByTitle = async (title: string, author?: string): Promise<Candidate[]> => {
  const t = title.trim()
  if (!t) return []
  const a = author?.trim()
  const olUrl = `https://openlibrary.org/search.json?limit=5&fields=key,title,author_name,first_publish_year,publisher,number_of_pages_median,isbn,cover_i,language&title=${encodeURIComponent(t)}${a ? `&author=${encodeURIComponent(a)}` : ''}`
  const gbUrl = `https://www.googleapis.com/books/v1/volumes?maxResults=5&q=${encodeURIComponent(`intitle:${t}${a ? ` inauthor:${a}` : ''}`)}`
  const [ol, gb] = await Promise.all([
    withTimeout(olUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    withTimeout(gbUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
  const out: Candidate[] = []
  for (const d of (ol?.docs ?? []) as {
    key: string; title: string; author_name?: string[]; first_publish_year?: number; publisher?: string[]
    number_of_pages_median?: number; isbn?: string[]; cover_i?: number
  }[]) {
    const isbn = isbn13Of(d.isbn)
    out.push({
      key: `ol${d.key}`,
      title: d.title,
      authors: (d.author_name ?? []).map((n) => toName(n)),
      year: d.first_publish_year,
      publisher: d.publisher?.[0],
      pages: d.number_of_pages_median,
      isbn13: isbn,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      source: 'openlibrary',
    })
  }
  for (const it of (gb?.items ?? []) as (GBVolume & { id: string; volumeInfo: { industryIdentifiers?: { type: string; identifier: string }[] } })[]) {
    const v = it.volumeInfo ?? {}
    const lang = v.language && LANGS.has(v.language) ? v.language : undefined
    const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail
    out.push({
      key: `gb${it.id}`,
      title: [v.title, v.subtitle].filter(Boolean).join(': ') || t,
      authors: (v.authors ?? []).map((n) => toName(n, lang)),
      year: yearOf(v.publishedDate),
      publisher: v.publisher,
      pages: v.pageCount || undefined,
      isbn13: isbn13Of(v.industryIdentifiers?.map((x) => x.identifier)),
      language: lang,
      cover: thumb ? thumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : undefined,
      source: 'googlebooks',
    })
  }
  return out.slice(0, 10)
}
