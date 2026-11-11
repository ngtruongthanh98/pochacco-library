import type { Book } from '../types/book'

export type Fallback = { image: string; label: string }

const today = () => new Date().toISOString().slice(0, 10)

/** Chọn hình Pochacco thay cho bìa, theo tình trạng của cuốn sách (ưu tiên từ trên xuống). */
export const coverFallback = (b: Book): Fallback => {
  const hasPrint = b.holdings.some((h) => h.kind === 'print')
  const hasEbook = b.holdings.some((h) => h.kind === 'ebook')
  if (b.status === 'lost') return { image: 'icon-lost', label: 'Bị thất lạc' }
  if (b.status === 'lent' && b.loan?.due && b.loan.due < today()) return { image: 'overdue', label: 'Quá hạn trả' }
  if (b.status === 'lent') return { image: 'lent', label: 'Đang cho mượn' }
  if (b.status === 'wishlist') return { image: 'wishlist', label: 'Sách cần mua' }
  const isPart = ['chapter', 'article-journal', 'paper-conference'].includes(b.type)
  const missing = isPart ? !b.containerTitle || !b.year : !b.publisher || !b.year
  if (missing) return { image: 'missing-info', label: 'Thiếu thông tin' }
  if (b.type === 'thesis') return { image: 'icon-thesis', label: 'Luận văn, luận án' }
  if (b.categories?.includes('tu-dien-tra-cuu')) return { image: 'icon-reference', label: 'Sách tra cứu' }
  if (b.originalTitle || b.translators?.length) return { image: 'icon-translation', label: 'Bản dịch' }
  if (b.tags?.some((t) => /hiếm|quý/i.test(t))) return { image: 'icon-rare', label: 'Sách hiếm' }
  if (hasEbook && !hasPrint) return { image: 'icon-ebook', label: 'Bản điện tử' }
  return { image: 'icon-print', label: 'Bản giấy' }
}

export const fallbackUrl = (f: Fallback) => `${import.meta.env.BASE_URL}assets/cover/${f.image}.webp`
