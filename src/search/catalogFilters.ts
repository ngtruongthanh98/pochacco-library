import { LANG_LABEL } from './stats'
import { foldVi } from './normalizeVi'
import { personKey } from './people'
import { nameToString, type Book } from '../types/book'

export const shelfLocations = (book: Book) =>
  book.holdings.flatMap((holding) => holding.kind === 'print' && holding.location ? [holding.location] : [])

export const languageLabel = (code: string) => LANG_LABEL[code] ?? code
const normalized = (value: string) => foldVi(value.trim()).replace(/\s+/g, ' ')
const names = (people: Book['authors']) => (people ?? []).map(nameToString)
const missingYear = 'chua-ghi'

export const CATALOG_FILTERS = [
  { key: 'author', param: 'tac-gia', label: 'Tác giả', values: (b: Book) => names(b.authors), normalize: personKey },
  { key: 'translator', param: 'dich-gia', label: 'Dịch giả', values: (b: Book) => names(b.translators), normalize: personKey },
  { key: 'language', param: 'ngon-ngu', label: 'Ngôn ngữ', values: (b: Book) => b.language ? [b.language] : [], format: languageLabel },
  { key: 'year', param: 'nam-xb', label: 'Năm xuất bản', values: (b: Book) => [b.year ? String(b.year) : missingYear], format: (year: string) => year === missingYear ? 'Chưa ghi năm' : year },
  { key: 'publisher', param: 'nxb', label: 'Nhà xuất bản', values: (b: Book) => b.publisher ? [b.publisher] : [] },
  { key: 'subject', param: 'chu-de', label: 'Chủ đề chi tiết', values: (b: Book) => b.subjects ?? [] },
  { key: 'series', param: 'tung-thu', label: 'Tùng thư', values: (b: Book) => b.series ? [b.series] : [] },
  { key: 'shelf', param: 'ke-sach', label: 'Vị trí kệ', values: shelfLocations },
] as const satisfies readonly {
  key: string; param: string; label: string; values: (book: Book) => string[]
  normalize?: (value: string) => string; format?: (value: string) => string
}[]

type FilterKey = (typeof CATALOG_FILTERS)[number]['key']
export type CatalogFilters = Partial<Record<FilterKey, string>>
type Facet = { value: string; label: string }
type Definition = { key: FilterKey; label: string; values: (book: Book) => string[]; normalize?: (value: string) => string; format?: (value: string) => string }
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

function facetValues(filter: Definition, book: Book): Facet[] {
  return filter.values(book).flatMap((raw) => {
    const value = (filter.normalize ?? normalized)(raw)
    return value ? [{ value, label: filter.format?.(value) ?? raw.trim() }] : []
  })
}

export function catalogFacets(books: Book[]) {
  return new Map(CATALOG_FILTERS.map((filter) => {
    const options = new Map<string, Facet>()
    for (const book of books) {
      for (const facet of facetValues(filter, book)) {
        if (!options.has(facet.value)) options.set(facet.value, facet)
      }
    }
    const optionsSorted = [...options.values()].sort((a, b) => filter.key === 'year'
      ? (Number(b.value) || 0) - (Number(a.value) || 0)
      : collator.compare(a.label, b.label))
    return [filter.key, optionsSorted]
  }))
}

export function catalogMatcher(filters: CatalogFilters) {
  const active = CATALOG_FILTERS.filter((filter) => filters[filter.key])
  return (book: Book) => active.every((filter) => facetValues(filter, book).some(({ value }) => value === filters[filter.key]))
}

export function readCatalogFilters(params: URLSearchParams): CatalogFilters {
  const filters: CatalogFilters = {}
  for (const filter of CATALOG_FILTERS) {
    const raw = params.get(filter.param)?.trim()
    if (raw) filters[filter.key] = ('normalize' in filter ? filter.normalize : normalized)(raw)
  }
  return filters
}

export function writeCatalogFilters(params: URLSearchParams, filters: CatalogFilters) {
  for (const filter of CATALOG_FILTERS) {
    const value = filters[filter.key]
    if (value) params.set(filter.param, value)
  }
}
