// Chi tiêu mua sách: từ trường acquired (ngày, nơi mua, giá) và giá bìa.
import type { Book } from '../types/book'
import { foldVi } from './normalizeVi'

export type SpendRow = { key: string; label: string; count: number; spent: number; cover: number; paidWithCover: number; books: Book[] }

const monthKey = (d: string) => d.slice(0, 7)

export function spending(all: Book[], year: number | 'all') {
  const bought = all.filter((b) => b.status !== 'wishlist' && b.acquired?.date)
  const years = [...new Set(bought.map((b) => Number(b.acquired!.date!.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a)
  const inYear = year === 'all' ? bought : bought.filter((b) => b.acquired!.date!.startsWith(String(year)))
  const paid = inYear.filter((b) => !b.acquired!.gift && typeof b.acquired!.price === 'number')
  const gifts = inYear.filter((b) => b.acquired!.gift)
  const spent = paid.reduce((s, b) => s + b.acquired!.price!, 0)
  const withCover = paid.filter((b) => b.coverPrice)
  const coverSum = withCover.reduce((s, b) => s + b.coverPrice!, 0)
  const paidCoverSum = withCover.reduce((s, b) => s + b.acquired!.price!, 0)

  // Theo tháng: 12 tháng của năm đã chọn, hoặc 12 tháng gần nhất.
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = year === 'all' ? new Date(now.getFullYear(), now.getMonth() - 11 + i, 1) : new Date(year, i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bs = paid.filter((b) => monthKey(b.acquired!.date!) === key)
    const sum = bs.reduce((s, b) => s + b.acquired!.price!, 0)
    return {
      key,
      label: year === 'all' && (i === 0 || d.getMonth() === 0) ? `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` : `T${d.getMonth() + 1}`,
      count: Math.round(sum / 1000),
      spent: sum,
      books: bs.length,
    }
  })
  const monthPool = year === 'all' ? bought.filter((b) => months.some((m) => monthKey(b.acquired!.date!) === m.key)) : inYear

  const group = (get: (b: Book) => string | undefined, fallback: string): SpendRow[] => {
    const m = new Map<string, SpendRow>()
    for (const b of inYear) {
      const raw = get(b)?.trim()
      const key = raw ? foldVi(raw) : ''
      const r = m.get(key) ?? { key, label: raw || fallback, count: 0, spent: 0, cover: 0, paidWithCover: 0, books: [] }
      r.count++
      r.books.push(b)
      const p = b.acquired!.gift ? undefined : b.acquired!.price
      if (p !== undefined) r.spent += p
      if (p !== undefined && b.coverPrice) {
        r.cover += b.coverPrice
        r.paidWithCover += p
      }
      m.set(key, r)
    }
    return [...m.values()].sort((a, b) => b.spent - a.spent || b.count - a.count)
  }

  const priciest = [...paid].sort((a, b) => b.acquired!.price! - a.acquired!.price!).slice(0, 5)
  const bestDeals = withCover
    .map((b) => ({ b, off: 1 - b.acquired!.price! / b.coverPrice! }))
    .filter((x) => x.off > 0)
    .sort((a, b) => b.off - a.off)
    .slice(0, 5)

  const insights: string[] = []
  const thisMonth = monthKey(new Date().toISOString())
  const lastMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth() + 1).padStart(2, '0')}`
  const sumM = (k: string) => bought.filter((b) => !b.acquired!.gift && b.acquired!.price !== undefined && monthKey(b.acquired!.date!) === k).reduce((s, b) => s + b.acquired!.price!, 0)
  if (year === 'all' || year === now.getFullYear()) {
    const a = sumM(thisMonth)
    const b = sumM(lastMonth)
    if (a || b) insights.push(`Tháng này đã chi ${a.toLocaleString('vi-VN')}đ${b ? `, tháng trước ${b.toLocaleString('vi-VN')}đ` : ''}.`)
  }
  if (coverSum) {
    const pct = Math.round((1 - paidCoverSum / coverSum) * 100)
    insights.push(
      pct > 0
        ? `Với ${withCover.length} cuốn có ghi giá bìa, bạn trả ít hơn ${pct}% so với giá bìa, tiết kiệm ${(coverSum - paidCoverSum).toLocaleString('vi-VN')}đ.`
        : `Với ${withCover.length} cuốn có ghi giá bìa, bạn trả ${pct < 0 ? `cao hơn ${-pct}%` : 'đúng'} giá bìa.`,
    )
  }
  const pubs = group((b) => b.publisher, 'Chưa ghi NXB')
  if (pubs[0]?.spent && spent) insights.push(`Chi nhiều nhất cho sách ${pubs[0].label}: ${Math.round((pubs[0].spent / spent) * 100)}% tổng chi.`)
  const missingPrice = inYear.filter((b) => !b.acquired!.gift && b.acquired!.price === undefined).length
  if (missingPrice) insights.push(`${missingPrice} cuốn có ngày mua nhưng chưa ghi giá, chưa được tính vào tổng.`)

  return {
    years,
    bought: inYear,
    paid,
    gifts,
    spent,
    avg: paid.length ? Math.round(spent / paid.length) : 0,
    withCover,
    coverSum,
    paidCoverSum,
    months,
    monthBooks: monthPool.length,
    publishers: pubs,
    shops: group((b) => b.acquired!.from, 'Chưa ghi nơi mua'),
    priciest,
    bestDeals,
    insights,
    anyEver: bought.length > 0,
  }
}
