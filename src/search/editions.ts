import { nameToString, type Book } from '../types/book'
import { foldVi } from './normalizeVi'

/** Khóa nhận diện "cùng một cuốn": nhan đề, phụ đề, tác giả đầu, tập. */
const editionKey = (b: Book) =>
  [b.title, b.subtitle ?? '', b.authors?.[0] ? nameToString(b.authors[0]) : '', b.seriesNo ?? '', b.volume ?? ''].map((x) => foldVi(String(x))).join('|')

/**
 * Các bản khác của cùng một cuốn trong thư viện: bản bìa cứng / bìa mềm, bản in khác ISBN, lần tái bản khác...
 * Ghép theo workKey nếu có, nếu không thì theo nhan đề, phụ đề, tác giả đầu và số tập.
 */
export function otherEditions(book: Book, all: Book[]): Book[] {
  const key = editionKey(book)
  return all
    .filter((b) => b.id !== book.id && ((book.workKey && b.workKey === book.workKey) || editionKey(b) === key))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
}
