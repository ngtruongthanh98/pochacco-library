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
