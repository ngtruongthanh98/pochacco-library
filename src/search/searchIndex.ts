import MiniSearch from 'minisearch'
import { nameToString, type Book } from '../types/book'
import { foldVi, normalizeIsbn } from './normalizeVi'

type Doc = {
  id: string
  title: string
  people: string
  publisher: string
  subjects: string
  isbn: string
}

const toDoc = (b: Book): Doc => ({
  id: b.id,
  title: [b.title, b.subtitle, b.originalTitle].filter(Boolean).join(' '),
  people: [...(b.authors ?? []), ...(b.translators ?? []), ...(b.editors ?? [])]
    .map(nameToString)
    .join(' '),
  publisher: [b.publisher, b.partner].filter(Boolean).join(' '),
  subjects: [...(b.subjects ?? []), ...(b.tags ?? []), b.series ?? ''].join(' '),
  isbn: [b.isbn13, b.isbn10].filter(Boolean).map((x) => normalizeIsbn(x!)).join(' '),
})

export const buildIndex = (books: Book[]) => {
  const index = new MiniSearch<Doc>({
    fields: ['title', 'people', 'publisher', 'subjects', 'isbn'],
    storeFields: ['id'],
    processTerm: (term) => foldVi(term),
    searchOptions: {
      boost: { title: 3, people: 2, isbn: 5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })
  index.addAll(books.map(toDoc))
  return index
}
