import type { Book, PrintHolding } from '../types/book'
import { ulid } from './ulid'

export const printCount = (holding: PrintHolding) =>
  Number.isSafeInteger(holding.copies) && holding.copies! > 0 ? holding.copies! : 1

/** Mã xác định từ bản ghi cũ, dùng ngay cả khi chưa từng lưu mã vào danh mục. */
export const printCopyIds = (bookId: string, holding: PrintHolding, printIndex: number): string[] =>
  Array.from({ length: printCount(holding) }, (_, i) =>
    holding.copyIds?.[i] || `PG-${bookId}-${printIndex + 1}-${i + 1}`,
  )

export const resizePrintCopies = (bookId: string, existing: string[], count: number): string[] =>
  Array.from({ length: count }, (_, i) => existing[i] ?? `PG-${bookId}-${ulid()}`)

export function withPrintCopyIds(book: Book): Book {
  let printIndex = 0
  const used = new Set<string>()
  return {
    ...book,
    holdings: book.holdings.map((holding) => {
      if (holding.kind !== 'print') return holding
      const copyIds = printCopyIds(book.id, holding, printIndex++).map((id) => {
        const unique = id.startsWith(`PG-${book.id}-`) && !used.has(id) ? id : `PG-${book.id}-${ulid()}`
        used.add(unique)
        return unique
      })
      return { ...holding, copyIds }
    }),
  }
}
