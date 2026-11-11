import type { Book, PrintHolding } from '../types/book'

export const COPY_PREFIX = 'Copy of '

/**
 * Bản nháp để tạo cuốn tương tự (thường là tập khác của cùng bộ sách).
 * Giữ: loại, tác giả, dịch giả, chủ biên, xuất bản, ngôn ngữ, phân loại, bộ sách, mô tả, vị trí kệ.
 * Bỏ: ISBN, số trang, ảnh bìa, bản điện tử, ghi chú, cho mượn — những thứ riêng của từng tập.
 */
export function duplicateDraft(b: Book): Partial<Book> {
  const print = b.holdings.find((h): h is PrintHolding => h.kind === 'print')
  const title = b.title.startsWith(COPY_PREFIX) ? b.title : `${COPY_PREFIX}${b.title}`
  return {
    type: b.type,
    title,
    subtitle: b.subtitle,
    originalTitle: b.originalTitle,
    authors: b.authors,
    translators: b.translators,
    editors: b.editors,
    publisher: b.publisher,
    partner: b.partner,
    place: b.place,
    year: b.year,
    edition: b.edition,
    sizeCm: b.sizeCm,
    language: b.language,
    containerTitle: b.containerTitle,
    genre: b.genre,
    categories: b.categories,
    subjects: b.subjects,
    tags: b.tags,
    series: b.series,
    // Tập kế tiếp của bộ sách.
    seriesNo: b.seriesNo !== undefined ? b.seriesNo + 1 : undefined,
    description: b.description,
    status: b.status === 'wishlist' ? 'wishlist' : 'owned',
    holdings: print ? [{ kind: 'print', location: print.location, copies: 1, condition: print.condition }] : [],
  }
}
