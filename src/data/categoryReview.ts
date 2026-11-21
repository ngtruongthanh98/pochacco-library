import type { Book } from '../types/book'

type Review = {
  updatedAt: string
  before: string[]
  categories: string[]
  subjects?: string[]
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim() !== '')

/** Only apply well-formed entries from a supported review. */
export const parseCategoryReview = (data: unknown): Map<string, Review> => {
  const result = new Map<string, Review>()
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 ||
      !('books' in data) || !data.books || typeof data.books !== 'object' || Array.isArray(data.books)) return result

  for (const [id, entry] of Object.entries(data.books)) {
    if (!entry || typeof entry !== 'object') continue
    const { updatedAt, before, categories, subjects } = entry
    if (typeof updatedAt === 'string' && isStringArray(before) && isStringArray(categories) &&
        categories.length > 0 && (subjects === undefined || isStringArray(subjects))) {
      result.set(id, { updatedAt, before, categories, subjects })
    }
  }
  return result
}

export const applyCategoryReview = (book: Book, review?: Review): Book => {
  const current = book.categories ?? []
  // A later save, including a manual reclassification, takes precedence.
  if (!review || book.updatedAt !== review.updatedAt || current.length !== review.before.length ||
      current.some((value, index) => value !== review.before[index])) return book

  return {
    ...book,
    categories: [...review.categories],
    ...(review.subjects?.length ? { subjects: [...new Set([...(book.subjects ?? []), ...review.subjects])] } : {}),
  }
}
