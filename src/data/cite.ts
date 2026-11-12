import { nameToString, type Book, type Name } from '../types/book'
import type { Excerpt } from '../types/excerpt'

const short = (n: Name) => ('literal' in n ? n.literal : n.family)

export const pageLabel = (page?: string) => {
  const p = page?.trim()
  if (!p) return ''
  return /[-–,]/.test(p) ? `tr. ${p.replace(/\s*-\s*/g, '–')}` : `tr. ${p}`
}

/** Dẫn nguồn trong bài: (Tác giả, năm, tr. 45) */
export function inTextCite(book: Book | undefined, ex: Pick<Excerpt, 'page'>): string {
  if (!book) return pageLabel(ex.page) ? `(${pageLabel(ex.page)})` : ''
  const a = book.authors?.length ? book.authors : book.editors ?? []
  const who = a.length === 0 ? book.title : a.length <= 2 ? a.map(short).join(' & ') : `${short(a[0])} và cs.`
  return `(${[who, book.year, pageLabel(ex.page)].filter(Boolean).join(', ')})`
}

/** Tài liệu tham khảo: Tác giả (năm), Nhan đề, Người dịch dịch, NXB, Nơi. */
export function referenceOf(book: Book): string {
  const a = (book.authors?.length ? book.authors : book.editors ?? []).map(nameToString).join(', ')
  const ed = !book.authors?.length && book.editors?.length ? ' (chủ biên)' : ''
  const tr = book.translators?.length ? `${book.translators.map(nameToString).join(', ')} dịch` : ''
  const head = a ? `${a}${ed} (${book.year ?? 'k.n.'}), ` : `${book.year ? `(${book.year}) ` : ''}`
  return head + [book.title, tr, book.publisher, book.place].filter(Boolean).join(', ') + '.'
}

export const quoteWithCite = (book: Book | undefined, ex: Excerpt) => `“${ex.text.trim()}” ${inTextCite(book, ex)}`.trim()

/** Sắp theo số trang (trang đầu tiên trong chuỗi), trang La Mã/không số xếp trước. */
export const pageKey = (p?: string) => {
  const m = p?.match(/\d+/)
  return m ? Number(m[0]) : p?.trim() ? -1 : Number.MAX_SAFE_INTEGER
}

export const normTopic = (t: string) => t.trim().replace(/\s+/g, ' ')
export const sameTopic = (a: string, b: string) => normTopic(a).toLocaleLowerCase('vi') === normTopic(b).toLocaleLowerCase('vi')

/** Danh sách chủ đề đã dùng, kèm số trích dẫn; giữ cách viết xuất hiện đầu tiên. */
export function topicCounts(all: Excerpt[]): { topic: string; n: number }[] {
  const m = new Map<string, { topic: string; n: number }>()
  for (const e of all)
    for (const t of e.topics ?? []) {
      const k = normTopic(t).toLocaleLowerCase('vi')
      const cur = m.get(k)
      if (cur) cur.n++
      else m.set(k, { topic: normTopic(t), n: 1 })
    }
  return [...m.values()].sort((a, b) => b.n - a.n || a.topic.localeCompare(b.topic, 'vi'))
}
