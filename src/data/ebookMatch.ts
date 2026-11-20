// Ghép bản điện tử với sách đã có trong thư viện: so nhan đề, số tập, tác giả và năm.

import { foldVi } from '../search/normalizeVi'
import { nameToString, type Book } from '../types/book'

export type MatchInput = { title: string; authors: string[]; year?: number }
export type Match = {
  book: Book
  score: number
  /** Điểm khớp riêng của nhan đề (0-1) */
  titleScore: number
  /** Lý do khớp, để hiện cho người dùng */
  reasons: string[]
  /** Dấu hiệu không phải cùng một cuốn (khác tập, khác tác giả...) */
  conflicts: string[]
}

const STOP = new Set(['va', 'cua', 'cac', 'nhung', 'mot', 'so', 've', 'trong', 'voi', 'cho', 'la', 'the', 'and', 'of', 'a', 'an', 'to', 'in'])
const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }
const roman = (s: string) => {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]]
    const next = ROMAN[s[i + 1]] ?? 0
    n += v < next ? -v : v
  }
  return n
}

const norm = (s: string) =>
  foldVi(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const VOL = /\b(?:tap|quyen|cuon|phan|vol|volume|book|tome|t|q)\s*\.?\s*(\d{1,3}|[ivxlc]{1,6})\b/

/** Số tập/quyển ghi trong nhan đề (Tập 2, Quyển II, T.3, Vol. 4), nếu có. */
export const volumeOf = (title: string): number | null => {
  const m = norm(title).match(VOL)
  if (!m) return null
  return /^\d+$/.test(m[1]) ? Number(m[1]) : roman(m[1])
}

const VOLG = new RegExp(VOL.source, 'g')
const tokens = (s: string) => norm(s).replace(VOLG, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w))

/** Hệ số Dice trên các từ có nghĩa: cả hai nhan đề phải giống nhau, không chỉ một bên nằm trong bên kia. */
export const titleSimilarity = (a: string, b: string): number => {
  if (!a.trim() || !b.trim()) return 0
  if (norm(a) === norm(b)) return 1
  const A = new Set(tokens(a))
  const B = new Set(tokens(b))
  if (!A.size || !B.size) return 0
  const common = [...A].filter((w) => B.has(w)).length
  return (2 * common) / (A.size + B.size)
}

const nameTokens = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 1))
/** Hai tên coi là cùng một người khi các chữ của tên ngắn hơn đều có trong tên dài hơn (Kant / Immanuel Kant). */
const samePerson = (a: string, b: string) => {
  const A = nameTokens(a)
  const B = nameTokens(b)
  if (!A.size || !B.size) return false
  const [small, big] = A.size <= B.size ? [A, B] : [B, A]
  return [...small].every((w) => big.has(w))
}

const bookPeople = (b: Book) => [...(b.authors ?? []), ...(b.editors ?? [])].map(nameToString)

export const scoreMatch = (input: MatchInput, book: Book): Match => {
  const reasons: string[] = []
  const conflicts: string[] = []
  const full = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title
  const titleScore = Math.max(titleSimilarity(input.title, book.title), titleSimilarity(input.title, full))
  let score = titleScore
  if (titleScore === 1) reasons.push('trùng nhan đề')
  else if (titleScore >= 0.6) reasons.push('nhan đề gần giống')

  const va = volumeOf(input.title)
  const vb = volumeOf(full)
  if (va !== null && vb !== null && va !== vb) {
    conflicts.push(`khác tập (${va} và ${vb})`)
    score *= 0.3
  } else if ((va === null) !== (vb === null)) {
    conflicts.push(va === null ? `sách có sẵn là tập ${vb}` : `sách có sẵn không ghi tập`)
    score *= 0.7
  }

  const people = bookPeople(book)
  if (input.authors.length && people.length) {
    if (input.authors.some((a) => people.some((p) => samePerson(a, p)))) {
      reasons.push('cùng tác giả')
      score = Math.min(1, score + 0.1)
    } else {
      conflicts.push('khác tác giả')
      score *= 0.5
    }
  }

  if (input.year && book.year && Math.abs(input.year - book.year) > 1) {
    conflicts.push(`khác năm (${input.year} và ${book.year})`)
    score *= 0.85
  } else if (input.year && book.year) reasons.push('cùng năm')

  return { book, score, titleScore, reasons, conflicts }
}

/**
 * Gợi ý sách có sẵn cho một bản điện tử, và cuốn được ghép tự động nếu chắc chắn.
 * Chỉ tự ghép khi nhan đề trùng hẳn, không có dấu hiệu khác cuốn, và không có cuốn thứ hai giống ngang.
 */
export const suggestMatches = (input: MatchInput, books: Book[]): { suggestions: Match[]; auto: Match | null } => {
  if (!input.title.trim()) return { suggestions: [], auto: null }
  const all = books
    .map((b) => scoreMatch(input, b))
    .filter((m) => m.titleScore >= 0.6 && m.score >= 0.45)
    .sort((a, b) => b.score - a.score)
  const suggestions = all.slice(0, 6)
  const [best, second] = suggestions
  const auto =
    best && best.titleScore >= 0.95 && !best.conflicts.length && best.score >= 0.95 && (!second || best.score - second.score >= 0.1) ? best : null
  return { suggestions, auto }
}
