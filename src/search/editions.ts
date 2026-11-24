import { nameToString, type Book } from '../types/book'
import { foldVi, normalizeIsbn } from './normalizeVi'

export const relationText = (text: string) => foldVi(text).replace(/[^a-z0-9]+/g, ' ').trim()

const titleAliases: Record<string, string> = {
  'ban ve khe uoc xa hoi': 'khe uoc xa hoi',
  'du contrat social': 'khe uoc xa hoi',
  'tam ly dam dong': 'tam ly hoc dam dong',
  'psychologie des foules': 'tam ly hoc dam dong',
}

export const relationTitle = (title: string) => {
  const key = relationText(title)
  return titleAliases[key] ?? key
}

const volumeOf = (book: Book) => relationText(book.volume ?? String(book.seriesNo ??
  relationText(`${book.title} ${book.subtitle ?? ''}`).match(/\b(?:tap|quyen|vol) (\d+|[ivx]+)\b/)?.[1] ?? ''))
  .replace(/^(?:tap|quyen|vol) /, '')

const contributor = (book: Book) => relationText(nameToString(book.authors?.[0] ?? book.editors?.[0] ?? { literal: '' }))

export function otherEditions(book: Book, all: Book[]): Book[] {
  const work = book.workKey?.trim()
  const title = relationTitle(book.title)
  const original = book.originalTitle && relationTitle(book.originalTitle)
  const subtitle = relationText(book.subtitle ?? '')
  const isbn = normalizeIsbn(book.isbn13 ?? book.isbn10 ?? '')
  const author = contributor(book)
  const volume = volumeOf(book)
  return all.filter((b) => {
    if (b.id === book.id || volume !== volumeOf(b)) return false
    if (isbn && isbn === normalizeIsbn(b.isbn13 ?? b.isbn10 ?? '')) return true
    if (work && b.workKey) return work === b.workKey.trim()
    if (!author || author !== contributor(b)) return false
    if (original && b.originalTitle && original === relationTitle(b.originalTitle)) return true
    return title === relationTitle(b.title) && subtitle === relationText(b.subtitle ?? '')
  }).sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id.localeCompare(b.id))
}

// Một tác phẩm có thể in trọn tập hoặc chia tập thành các phần riêng.
const partOf = (book: Book) => {
  const text = relationText(`${book.title} ${book.subtitle ?? ''}`)
  return text.match(/\b(?:phan|part|nam thu|book) (\d+|[ivxlcdm]+)\b/)?.[1] ?? ''
}

/** Nhóm các biểu ghi cùng tác phẩm theo quy tắc dùng ở trang chi tiết sách. */
export function groupEditions(books: Book[]): Book[][] {
  const keysOf = (book: Book) => [
    ['work', book.workKey?.trim()],
    ['isbn', normalizeIsbn(book.isbn13 ?? book.isbn10 ?? '')],
    ['title', relationTitle(book.title)],
    ['original', book.originalTitle && relationTitle(book.originalTitle)],
  ].flatMap(([kind, value]) => value ? [`${kind}:${value}`] : [])

  const byKey = new Map<string, Book[]>()
  const keysById = new Map<string, string[]>()
  for (const book of books) {
    const keys = keysOf(book)
    keysById.set(book.id, keys)
    for (const key of keys) {
      const bucket = byKey.get(key)
      if (bucket) bucket.push(book)
      else byKey.set(key, [book])
    }
  }

  const visited = new Set<string>()
  const groups: Book[][] = []
  for (const book of books) {
    if (visited.has(book.id)) continue
    const group = [book]
    visited.add(book.id)
    for (const member of group) {
      const candidates = new Set(keysById.get(member.id)!.flatMap((key) => byKey.get(key)!))
      for (const edition of otherEditions(member, [...candidates])) {
        if (visited.has(edition.id) || partOf(member) !== partOf(edition)) continue
        visited.add(edition.id)
        group.push(edition)
      }
    }
    groups.push(group)
  }
  return groups
}
