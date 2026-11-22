import { CATEGORY_GROUPS } from '../data/categories'
import { nameToString, type Book } from '../types/book'
import { otherEditions } from './editions'
import { foldVi } from './normalizeVi'
import { relatedBooks } from './related'

export const BRANCH_LIMIT = 8

export type TopicNode = {
  key: string
  label: string
  books: Map<string, Book>
  children: Map<string, TopicNode>
}

function addNode(nodes: Map<string, TopicNode>, key: string, label: string, book: Book) {
  const node = nodes.get(key) ?? { key, label, books: new Map(), children: new Map() }
  node.books.set(book.id, book)
  nodes.set(key, node)
  return node.children
}

const searchable = (value: string) => foldVi(value).replace(/[^\p{L}\p{N}]+/gu, ' ')
const vietnamese = new Intl.Collator('vi', { numeric: true })
export const topicOrder = (a: TopicNode, b: TopicNode) =>
  b.books.size - a.books.size || vietnamese.compare(a.label, b.label)

export function topicTree(books: Book[], query: string) {
  const groups = new Map<string, TopicNode>()
  const categoryIndex = new Map(CATEGORY_GROUPS.flatMap(group => [
    [group.id, { group, label: 'Chưa xếp chủ đề' }] as const,
    ...group.items.map(item => [item.id, { group, label: item.label }] as const),
  ]))
  const terms = searchable(query).split(' ').filter(Boolean)
  for (const book of books) {
    const categories = book.categories?.filter(id => id.trim()) ?? []
    const subjects = book.subjects?.map(subject => subject.trim().replace(/\s+/g, ' ')).filter(Boolean) ?? []
    const bookText = terms.length ? [
      book.title, book.subtitle, book.originalTitle, ...(book.authors ?? []).map(nameToString),
    ].join(' ') : ''
    for (const category of categories.length ? categories : ['']) {
      const entry = categoryIndex.get(category)
      const groupLabel = entry?.group.label ?? 'Chưa xếp nhóm chủ đề'
      const categoryLabel = entry?.label ?? (category || 'Chưa xếp chủ đề')
      for (const subject of subjects.length ? subjects : ['']) {
        const subjectLabel = subject || 'Chưa có chủ đề chi tiết'
        if (terms.length) {
          const search = searchable([groupLabel, categoryLabel, subjectLabel, bookText].join(' '))
          if (!terms.every(term => search.includes(term))) continue
        }
        const group = addNode(groups, entry?.group.id ?? '', groupLabel, book)
        const topic = addNode(group, category, categoryLabel, book)
        const subjectKey = subject.normalize('NFC').toLocaleLowerCase('vi')
        addNode(topic, subjectKey, subjectLabel, book)
      }
    }
  }
  return [...groups.values()].sort(topicOrder)
}

export type BookLink = { book: Book; evidence: string[] }

export function bookLinks(book: Book, books: Book[], excludedId?: string): BookLink[] {
  const editions = otherEditions(book, books).filter(candidate => candidate.id !== excludedId).slice(0, BRANCH_LIMIT)
  const excluded = new Set(editions.map(candidate => candidate.id))
  if (excludedId) excluded.add(excludedId)
  return [
    ...editions.map(candidate => ({ book: candidate, evidence: ['Cùng tác phẩm'] })),
    ...relatedBooks(book, books, BRANCH_LIMIT - editions.length, excluded),
  ]
}

export function bookMatrix(visible: Book[], books: Book[]) {
  return visible.map((book, i) => {
    const candidates = visible.slice(i + 1)
    const editions = new Set(otherEditions(book, candidates).map(candidate => candidate.id))
    const signals = new Map(relatedBooks(book, books, candidates.length, new Set(), candidates)
      .map(link => [link.book.id, link.evidence]))
    return candidates.map(candidate => [
      ...(editions.has(candidate.id) ? ['Cùng tác phẩm'] : []),
      ...(signals.get(candidate.id) ?? []),
    ])
  })
}
