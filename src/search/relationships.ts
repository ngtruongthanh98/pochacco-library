import { categoryLabel } from '../data/categories'
import { formatOf } from '../data/format'
import { nameToString, type Book } from '../types/book'
import { relationText } from './editions'
import { LANG_LABEL } from './stats'

export const HOLDING_GROUPS = [
  { key: 'print', label: 'Chỉ sách giấy', color: '#a74635' },
  { key: 'ebook', label: 'Chỉ ebook', color: '#386a80' },
  { key: 'both', label: 'Sách giấy và ebook', color: '#6b702e' },
  { key: 'audio', label: 'Chỉ có tệp nghe', color: '#815485' },
  { key: 'none', label: 'Chưa ghi bản lưu', color: '#766958' },
] as const

export type HoldingGroup = typeof HOLDING_GROUPS[number]['key']

export function holdingGroup(b: Book): HoldingGroup {
  const format = formatOf(b)
  return format === 'none' && b.holdings.some(h => h.kind === 'audio') ? 'audio' : format
}

export const RELATIONSHIPS = [
  { key: 'topic', label: 'Chủ đề và thẻ' },
  { key: 'category', label: 'Danh mục (phân loại rộng)' },
  { key: 'author', label: 'Tác giả' },
  { key: 'translator', label: 'Dịch giả' },
  { key: 'series', label: 'Bộ sách' },
  { key: 'publisher', label: 'Nhà xuất bản' },
  { key: 'language', label: 'Ngôn ngữ' },
  { key: 'decade', label: 'Thập niên xuất bản' },
  { key: 'work', label: 'Ấn bản cùng tác phẩm' },
] as const
export type Relationship = typeof RELATIONSHIPS[number]['key']
export type BookGroup = { key: string; label: string; books: Book[] }

const identity = (value: string) => value.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi')
const collator = new Intl.Collator('vi', { numeric: true })
const groupOrder = (a: BookGroup, b: BookGroup) => b.books.length - a.books.length || collator.compare(a.label, b.label)

function groupLabels(book: Book, relationship: Relationship): { key: string; label: string }[] {
  const labels = (...values: (string | undefined)[]) => {
    const present = new Map<string, string>()
    for (const value of values) {
      if (value?.trim()) present.set(identity(value), value.trim())
    }
    return [...present].map(([key, label]) => ({ key, label }))
  }
  switch (relationship) {
    case 'topic': return labels(...(book.subjects ?? []), ...(book.tags ?? []))
    case 'category': return labels(...(book.categories ?? []).map(categoryLabel))
    case 'author': return labels(...(book.authors ?? []).map(nameToString))
    case 'translator': return labels(...(book.translators ?? []).map(nameToString))
    case 'series': return labels(book.series, book.collectionTitle)
    case 'publisher': return labels(book.publisher)
    case 'language': return labels(book.language && (LANG_LABEL[book.language.toLowerCase()] ?? book.language))
    case 'decade': return book.year && book.year > 0 && Number.isInteger(book.year) ? labels(`Thập niên ${Math.floor(book.year / 10) * 10}`) : []
    case 'work': return book.workKey?.trim() ? [{ key: book.workKey.trim(), label: book.originalTitle || book.title }] : []
  }
}

export function relationshipGroups(books: Book[], relationship: Relationship): BookGroup[] {
  const groups = new Map<string, BookGroup>()
  for (const book of books) {
    for (const { key, label } of groupLabels(book, relationship)) {
      const existing = groups.get(key)
      if (existing) existing.books.push(book)
      else groups.set(key, { key, label, books: [book] })
    }
  }
  return [...groups.values()].sort(groupOrder)
}

export function sharedGroups(groups: BookGroup[], root: BookGroup): BookGroup[] {
  const source = new Set(root.books.map(b => b.id))
  return groups.flatMap(group => {
    if (group.key === root.key) return []
    const books = group.books.filter(book => source.has(book.id))
    return books.length ? [{ ...group, books }] : []
  }).sort(groupOrder)
}

export function groupsForBook(groups: BookGroup[], book: Book, relationship: Relationship): BookGroup[] {
  const keys = new Set(groupLabels(book, relationship).map(group => group.key))
  return groups.flatMap(group => {
    if (!keys.has(group.key)) return []
    const books = group.books.filter(other => other.id !== book.id)
    return books.length ? [{ ...group, books }] : []
  }).sort(groupOrder)
}

export function findRelationshipBooks(books: Book[], query: string, relationship: Relationship): Book[] {
  const needle = relationText(query)
  const terms = needle.split(' ')
  const results = needle ? books.filter(book => {
    const search = [book.title, book.subtitle, book.originalTitle, book.publisher, book.series, book.isbn13,
      ...(book.authors ?? []).map(nameToString), ...(book.translators ?? []).map(nameToString),
      ...groupLabels(book, 'topic').map(group => group.label), ...groupLabels(book, 'category').map(group => group.label), ...groupLabels(book, relationship).map(group => group.label),
    ]
    const haystack = relationText(search.join(' '))
    return terms.every(term => haystack.includes(term))
  }) : [...books]
  return results.sort((a, b) => {
    if (needle) {
      const rank = (book: Book) => {
        const title = relationText(book.title)
        return title === needle ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : 3
      }
      const difference = rank(a) - rank(b)
      if (difference) return difference
    }
    return collator.compare(a.title, b.title)
  })
}
