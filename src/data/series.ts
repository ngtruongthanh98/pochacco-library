import { formatOf } from './format'
import { personKey } from '../search/people'
import type { Book } from '../types/book'

export const seriesKeyOf = (name: string) => personKey(name.replace(/\(\d{4}\)/g, ''))

const ABHIDHAMMA = seriesKeyOf('Tạng Vô Tỷ Pháp (Abhidhammapiṭaka) - bản dịch Tịnh Sự')
export const KNOWN_TOTALS: Record<string, number> = {
  vilenintoantap: 55,
  cmacvaphangghentoantap: 50,
  hochiminhtoantap: 15,
  [ABHIDHAMMA]: 7,
}

const titleVolume = /^(.*?)[\s,:–—-]+(?:tập|tap|t\.|quyển|quyen|vol\.?)\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\b/i
const volumeRange = /^(?:(?:tập|quyển)\s+)?(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/i

function numberedRange(first?: string, last?: string): number[] {
  const start = Number(first)
  const end = Number(last ?? first)
  return start > 0 && end >= start && end < 1000
    ? Array.from({ length: end - start + 1 }, (_, index) => start + index)
    : []
}

type Entry = { book: Book; numbers: number[] }
export type BookSeries = { key: string; name: string; entries: Entry[]; explicit: boolean }

export function bookSeries(books: Book[]): BookSeries[] {
  const groups = new Map<string, BookSeries>()
  for (const book of books) {
    const title = titleVolume.exec(book.title)
    const volume = volumeRange.exec(book.volume?.trim() ?? '')
    const explicitName = book.series?.trim()
    const name = explicitName || (title && title[1].trim().length >= 4 ? title[1].trim() : volume ? book.title : '')
    if (!name) continue
    const key = seriesKeyOf(name)
    if (!key) continue
    const n = book.seriesNo
    const numbers = n !== undefined && Number.isFinite(n) && n >= 1 && n < 1000
      ? [Math.floor(n)]
      : volume ? numberedRange(volume[1], volume[2]) : numberedRange(title?.[2], title?.[3])
    // Hai bộ 3 và 4 được đóng chung trong ấn bản này.
    if (key === ABHIDHAMMA && n === 3 && /puggalapaññatti/i.test(book.originalTitle ?? book.title)) numbers.push(4)
    const group = groups.get(key) ?? { key, name, explicit: false, entries: [] }
    if (explicitName && !group.explicit) {
      group.name = explicitName
      group.explicit = true
    }
    group.entries.push({ book, numbers })
    groups.set(key, group)
  }
  return [...groups.values()]
}

const collator = new Intl.Collator('vi', { numeric: true })
export const compareSeriesEntries = (a: Entry, b: Entry) =>
  (a.numbers[0] ?? Infinity) - (b.numbers[0] ?? Infinity)
  || collator.compare(a.book.volume ?? String(a.book.seriesNo ?? ''), b.book.volume ?? String(b.book.seriesNo ?? ''))
  || collator.compare(a.book.title, b.book.title)
  || (a.book.year ?? 0) - (b.book.year ?? 0)

export function seriesCoverage(series: BookSeries, totals: Record<string, number>) {
  const owned = series.entries.filter(({ book }) => (book.status === 'owned' || book.status === 'lent') && formatOf(book) !== 'none')
  const present = new Set(owned.flatMap((entry) => entry.numbers))
  const unnumbered = owned.some((entry) => entry.numbers.length === 0)
  const custom = totals[series.key]
  const configured = Number.isInteger(custom) && custom > 0 && custom < 1000
  const knownTotal = configured ? custom : Object.hasOwn(KNOWN_TOTALS, series.key) ? KNOWN_TOTALS[series.key] : null
  const observedMax = Math.max(0, ...present)
  const total = knownTotal ?? observedMax
  const conflict = knownTotal !== null && observedMax > knownTotal
  const missing = unnumbered || conflict ? [] : Array.from({ length: total }, (_, i) => i + 1).filter((n) => !present.has(n))
  const missingParts = missingPatthanaParts(series.key, owned)
  return { owned, present, total, knownTotal, configured, conflict, unnumbered, missing, missingParts }
}

function missingPatthanaParts(key: string, owned: Entry[]): number[] {
  if (key !== ABHIDHAMMA) return []
  const patthana = owned.filter(({ numbers }) => numbers.includes(7))
  if (!patthana.length) return []
  const parts = patthana.map(({ book }) => {
    const range = volumeRange.exec(book.volume?.trim() ?? '')
    if (range) return numberedRange(range[1], range[2])
    // Các biểu ghi cũ dùng 7.1, 7.2 và 7.3 cho ba cặp quyển.
    const index = [7.1, 7.2, 7.3].indexOf(book.seriesNo ?? 7)
    return index === -1 ? [] : [index * 2 + 1, index * 2 + 2]
  })
  if (parts.some((part) => !part.length)) return []
  const present = new Set(parts.flat())
  return [1, 2, 3, 4, 5, 6].filter((part) => !present.has(part))
}

export const seriesSource = (key: string) => key === ABHIDHAMMA
  ? { url: 'https://budsas.panha.vn/sach/index.html', label: 'Danh mục Tạng Vi Diệu Pháp tại BuddhaSasana' }
  : null

export function fmtRanges(numbers: number[], unit = 'tập'): string {
  const parts: string[] = []
  for (let i = 0; i < numbers.length; ) {
    let j = i
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++
    parts.push(j > i ? `${unit} ${numbers[i]}–${numbers[j]}` : `${unit} ${numbers[i]}`)
    i = j + 1
  }
  return parts.join(', ')
}
