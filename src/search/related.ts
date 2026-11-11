import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { nameToString, type Book } from '../types/book'
import { foldVi } from './normalizeVi'

export type Related = { book: Book; score: number; reason: string }

const people = (b: Book) =>
  [...(b.authors ?? []), ...(b.translators ?? []), ...(b.editors ?? [])].map((n) => ({
    key: foldVi(nameToString(n)),
    label: nameToString(n),
  }))

const groupOf = (cat: string) => CATEGORY_GROUPS.findIndex((g) => g.items.some((i) => i.id === cat))

// Từ quá phổ biến trong nhan đề, không nói lên quan hệ giữa hai cuốn.
const STOP = new Set(
  'va cua cac nhung trong ve voi mot cho la tu den the and of the a an in on to for tap quyen phan ban'.split(' '),
)
const titleWords = (b: Book) =>
  new Set(
    foldVi([b.title, b.originalTitle].filter(Boolean).join(' '))
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )

/**
 * Chấm điểm mức liên quan giữa cuốn đang xem và từng cuốn khác trong thư viện, theo:
 * ấn bản khác của cùng tác phẩm, cùng tùng thư, chung tác giả/dịch giả, chung danh mục,
 * chung chủ đề chi tiết, nhan đề có từ khóa chung. Mỗi gợi ý giữ lý do mạnh nhất để hiển thị.
 */
export const relatedBooks = (book: Book, all: Book[], limit = 8): Related[] => {
  const myPeople = people(book)
  const myCats = new Set(book.categories ?? [])
  const myGroups = new Set([...myCats].map(groupOf).filter((g) => g >= 0))
  const mySubjects = new Set([...(book.subjects ?? []), ...(book.tags ?? [])].map(foldVi))
  const myWords = titleWords(book)
  const myWork = book.workKey ?? (book.originalTitle ? foldVi(book.originalTitle) : undefined)

  const out: Related[] = []
  for (const b of all) {
    if (b.id === book.id) continue
    const reasons: { w: number; text: string }[] = []

    const work = b.workKey ?? (b.originalTitle ? foldVi(b.originalTitle) : undefined)
    if (myWork && work === myWork) reasons.push({ w: 10, text: 'Ấn bản hoặc bản dịch khác' })

    if (book.series && b.series && foldVi(book.series) === foldVi(b.series))
      reasons.push({ w: 7, text: `Cùng tùng thư ${b.series}${b.seriesNo !== undefined ? `, số ${b.seriesNo}` : ''}` })

    const shared = people(b).filter((p) => myPeople.some((m) => m.key === p.key))
    if (shared.length) reasons.push({ w: 5 * shared.length, text: `Cùng ${shared.map((p) => p.label).join(', ')}` })

    const sharedCats = (b.categories ?? []).filter((c) => myCats.has(c))
    if (sharedCats.length) reasons.push({ w: 3 * sharedCats.length, text: `Cùng mục ${sharedCats.map(categoryLabel).join(', ')}` })
    else if ((b.categories ?? []).some((c) => myGroups.has(groupOf(c))))
      reasons.push({ w: 1, text: `Cùng nhóm ${CATEGORY_GROUPS[groupOf(b.categories!.find((c) => myGroups.has(groupOf(c)))!)].label}` })

    const sharedSubj = [...(b.subjects ?? []), ...(b.tags ?? [])].filter((s) => mySubjects.has(foldVi(s)))
    if (sharedSubj.length) reasons.push({ w: 2 * sharedSubj.length, text: `Chung chủ đề ${sharedSubj.join(', ')}` })

    const words = titleWords(b)
    const common = [...words].filter((w) => myWords.has(w))
    if (common.length && myWords.size) {
      const j = common.length / new Set([...words, ...myWords]).size
      if (j >= 0.2) reasons.push({ w: 3 * j, text: 'Nhan đề gần giống' })
    }

    if (!reasons.length) continue
    let score = reasons.reduce((s, r) => s + r.w, 0)
    if (book.year && b.year && Math.abs(book.year - b.year) <= 5) score += 0.3
    reasons.sort((x, y) => y.w - x.w)
    out.push({ book: b, score, reason: reasons[0].text })
  }
  return out
    .sort((x, y) => y.score - x.score || (x.book.seriesNo ?? 0) - (y.book.seriesNo ?? 0))
    .filter((r) => r.score >= 1)
    .slice(0, limit)
}
