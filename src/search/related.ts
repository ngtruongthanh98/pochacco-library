import { nameToString, type Book, type Name } from '../types/book'
import { relationText } from './editions'

export type Related = { book: Book; score: number; reason: string }

const STOP = new Set(
  'va cua cac nhung trong ve voi mot cho la tu den the and of an for tap quyen phan ban sach gioi thieu tai lieu lich su viet nam hoi ky'.split(' '),
)
const GENERIC = new Set(['lich su', 'viet nam', 'hoi ky', 'tieu su', 'chinh tri', 'van hoa', 'van hoc', 'sach tham khao', 'tai lieu luu tru'])

// Chỉ gắn cụm khi nhan đề hoặc chủ đề có dấu hiệu đặc trưng. Các cách viết cũ và
// tên tiếng nước ngoài được nhận diện ngay cả khi bản ghi thiếu thẻ chủ đề.
const TOPICS: [string, RegExp][] = [
  ['Hội nghị và Hiệp định Paris 1973', /\b(?:(?:hiep dinh|hoi nghi|dam phan|thuong luong) (?:tai |ve viet nam tai )?(?:paris|pa ri)|le duc tho.{0,35}kissinger|paris peace (?:accords|talks))\b/],
  ['Hà Nội – Điện Biên Phủ trên không', /\b(?:dien bien phu tren khong|linebacker ii|ha noi.{0,30}12 ngay dem|12 ngay dem.{0,30}ha noi)\b/],
  ['Đường Trường Sơn – Đường Hồ Chí Minh', /\b(?:truong son|duong (?:mon )?ho chi minh|ho chi minh trail)\b/],
  ['Tổng tiến công và nổi dậy Mậu Thân 1968', /\b(?:mau than(?: 1968)?|tet offensive)\b/],
  ['Võ Văn Kiệt', /\b(?:vo van kiet|sau dan)\b/],
  ['Võ Nguyên Giáp', /\bvo nguyen giap\b/],
  ['Phạm Văn Đồng', /\bpham van dong\b/],
  ['Cách mạng Pháp', /\b(?:cach mang phap|revolution francaise|french revolution)\b/],
  ['Công nghệ và xã hội', /\b(?:cong nghe va xa hoi|mat trai cua cong nghe|lung doan cong nghe|technopoly|dark side of technology|van hoa (?:va|truoc) cong nghe)\b/],
  ['Tình yêu và kết nối cảm xúc', /\b(?:quan he tinh cam|ket noi cam xuc|thuat yeu duong|cam giac duoc yeu|the nao la tinh yeu|ban ve tinh yeu va su co doc|nghiep tinh yeu)\b/],
  ['Khế ước xã hội', /\b(?:khe uoc xa hoi|du contrat social|social contract)\b/],
  ['Tâm lý học đám đông', /\b(?:tam ly (?:hoc )?dam dong|psychologie des foules|crowd psychology)\b/],
  ['Chiến tranh Việt Nam', /\b(?:chien tranh viet nam|khang chien chong my|vietnam war)\b/],
]
const personKeys = (names?: Name[]) => new Map((names ?? []).map((n) => [relationText(nameToString(n)), nameToString(n)] as const).filter(([k]) => k))
const profile = (b: Book) => {
  const title = relationText([b.title, b.subtitle, b.originalTitle].filter(Boolean).join(' '))
  const subjects = new Map([...(b.subjects ?? []), ...(b.tags ?? [])].map((s) => [relationText(s), s] as const).filter(([k]) => k && !GENERIC.has(k)))
  const subjectText = [...subjects.keys()]
  const authors = personKeys(b.authors)
  const editors = personKeys(b.editors)
  const topics = new Set(TOPICS.filter(([, re]) => [title, ...subjectText].some((s) => re.test(s))).map(([label]) => label))
  return {
    subjects, authors, editors, topics,
    words: new Set(title.split(' ').filter((w) => w.length >= 3 && !STOP.has(w))),
    categories: new Set(b.categories ?? []),
    series: relationText(b.series ?? ''),
  }
}

const cache = new WeakMap<Book[], { profiles: Map<string, ReturnType<typeof profile>>; frequency: Map<string, number> }>()
function index(all: Book[]) {
  const cached = cache.get(all)
  if (cached) return cached
  const profiles = new Map(all.map((b) => [b.id, profile(b)]))
  const frequency = new Map<string, number>()
  for (const { words } of profiles.values()) {
    for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1)
  }
  const result = { profiles, frequency }
  cache.set(all, result)
  return result
}

const sharedKeys = <T>(a: Iterable<T>, b: { has(key: T): boolean }) => [...a].filter((k) => b.has(k))

export function relatedBooks(book: Book, all: Book[], limit = 8, excluded = new Set<string>()): Related[] {
  const { profiles, frequency } = index(all)
  const me = profiles.get(book.id) ?? profile(book)
  const results: Related[] = []
  for (const candidate of all) {
    if (candidate.id === book.id || excluded.has(candidate.id) || candidate.status === 'wishlist') continue
    if (!candidate.holdings.some((h) => h.kind === 'print' || h.kind === 'ebook')) continue
    const other = profiles.get(candidate.id)!
    const signals: { score: number; reason: string }[] = []
    const add = (score: number, reason: string) => signals.push({ score, reason })
    const topics = sharedKeys(me.topics, other.topics)
    const specific = topics.filter((t) => t !== 'Chiến tranh Việt Nam')
    if (specific.length) add(20 + Math.min(6, (specific.length - 1) * 3), `Cùng chủ đề ${specific.slice(0, 2).join(', ')}`)
    else if (topics.length) add(5, 'Cùng chủ đề Chiến tranh Việt Nam')

    const authors = sharedKeys(me.authors.keys(), other.authors)
    if (authors.length) add(11 + Math.min(3, authors.length - 1), `Cùng tác giả ${authors.map((key) => me.authors.get(key)).join(', ')}`)
    const editors = sharedKeys(me.editors.keys(), other.editors)
    if (editors.length) add(6, `Cùng chủ biên ${editors.map((key) => me.editors.get(key)).join(', ')}`)
    const series = me.series && me.series === other.series
    if (series) add(relationText(book.title) === relationText(candidate.title) ? 24 : 7, `Cùng bộ ${book.series}`)

    const subjects = sharedKeys(me.subjects.keys(), other.subjects)
      .filter((subject) => !TOPICS.some(([label, pattern]) => topics.includes(label) && pattern.test(subject)))
    if (subjects.length) {
      add(Math.min(16, 7 + (subjects.length - 1) * 3), `Chung chủ đề ${subjects.slice(0, 2).map((s) => me.subjects.get(s)).join(', ')}`)
    }

    // Tần suất theo toàn danh mục giúp tên hiếm có trọng số cao hơn cụm từ chung.
    const words = sharedKeys(me.words, other.words)
    const rareWords = words.filter((word) => (frequency.get(word) ?? 0) <= Math.max(3, all.length * 0.035))
    const overlap = words.length / Math.max(1, me.words.size + other.words.size - words.length)
    const categories = sharedKeys(me.categories, other.categories)
    const titleMatch = rareWords.length >= 2 && overlap >= 0.24
    const strongTitleMatch = categories.length > 0 && rareWords.length >= 3 && overlap >= 0.4
    if (titleMatch && (signals.length > 0 || strongTitleMatch))
      add(Math.min(9, 4 + overlap * 5), 'Nhan đề có nhiều từ khóa chung')

    if (!signals.length) continue
    const score = signals.reduce((sum, signal) => sum + signal.score, 0) + (categories.length ? 1 : 0)
    const reason = signals.sort((a, b) => b.score - a.score)[0].reason
    results.push({ book: candidate, score, reason })
  }
  return results.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title, 'vi') || a.book.id.localeCompare(b.book.id)).slice(0, limit)
}
