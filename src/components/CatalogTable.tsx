import { useState } from 'react'
import { categoryLabel } from '../data/categories'
import { formatOf } from '../data/format'
import { languageLabel, shelfLocations } from '../search/catalogFilters'
import { STATUS_LABEL } from '../search/stats'
import { nameToString, type Book } from '../types/book'

const FORMAT = { both: 'Sách giấy và ebook', print: 'Sách giấy', ebook: 'Ebook', none: '' }
const columns = [
  { key: 'author', label: 'Tác giả', cell: (book: Book) => book.authors?.map(nameToString).join(', ') },
  { key: 'translator', label: 'Dịch giả', cell: (book: Book) => book.translators?.map(nameToString).join(', ') },
  { key: 'year', label: 'Năm xuất bản', cell: (book: Book) => book.year },
  { key: 'publisher', label: 'Nhà xuất bản', cell: (book: Book) => book.publisher },
  { key: 'language', label: 'Ngôn ngữ', cell: (book: Book) => book.language && languageLabel(book.language) },
  { key: 'category', label: 'Danh mục', cell: (book: Book) => book.categories?.map(categoryLabel).join(', ') },
  { key: 'subject', label: 'Chủ đề chi tiết', cell: (book: Book) => book.subjects?.join(', ') },
  { key: 'series', label: 'Tùng thư', cell: (book: Book) => book.series },
  { key: 'volume', label: 'Số tập / quyển', cell: (book: Book) => book.volume && book.seriesNo !== undefined && String(book.seriesNo) !== book.volume ? `${book.seriesNo} · ${book.volume}` : book.volume || book.seriesNo },
  { key: 'format', label: 'Dạng sách', cell: (book: Book) => FORMAT[formatOf(book)] },
  { key: 'shelf', label: 'Vị trí kệ', cell: (book: Book) => [...new Set(shelfLocations(book))].join(', ') },
  { key: 'status', label: 'Tình trạng', cell: (book: Book) => STATUS_LABEL[book.status] },
] as const
type Column = (typeof columns)[number]['key']
const defaultColumns: Column[] = ['author', 'translator', 'year', 'format', 'shelf']
const storageKey = 'pochacco-library:table-columns'
const loadColumns = (): Column[] => {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (Array.isArray(values)) return columns.map((col) => col.key).filter((key) => values.includes(key))
  } catch {
    /* Dùng cột mặc định khi bộ nhớ trình duyệt không khả dụng. */
  }
  return defaultColumns
}

export default function CatalogTable({ books, picked, onPick, onOpen }: {
  books: Book[]
  picked?: ReadonlySet<string>
  onPick: (id: string) => void
  onOpen: (book: Book) => void
}) {
  const [visible, setVisible] = useState(loadColumns)
  const update = (next: Column[]) => {
    setVisible(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Vẫn cập nhật bảng hiện tại. */ }
  }
  const shown = columns.filter((col) => visible.includes(col.key))

  return (
    <div className="catalog-table">
      <details className="catalog-columns">
        <summary>Chọn cột</summary>
        <div className="catalog-column-options">
          {columns.map(({ key, label }) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={visible.includes(key)} onChange={(e) => {
                update(e.target.checked ? [...visible, key] : visible.filter((value) => value !== key))
              }} />
              {label}
            </label>
          ))}
        </div>
        <button type="button" className="link" onClick={() => update(defaultColumns)}>Khôi phục cột mặc định</button>
      </details>
      {shown.length > 1 && <p className="muted small catalog-scroll-hint">Vuốt ngang để xem thêm cột.</p>}
      <div className="catalog-table-scroll" tabIndex={0} role="region" aria-label="Bảng danh mục sách">
        <table>
          <caption className="catalog-sr-only">Danh mục sách</caption>
          <thead>
            <tr>
              {picked && <th scope="col">Chọn</th>}
              <th scope="col">Nhan đề</th>
              {shown.map((col) => <th scope="col" key={col.key}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id} className={picked?.has(book.id) ? 'catalog-picked' : undefined}>
                {picked && <td><input type="checkbox" aria-label={`Chọn ${book.title}`} checked={picked.has(book.id)} onChange={() => onPick(book.id)} /></td>}
                <th scope="row">
                  <button type="button" className="link" onClick={() => onOpen(book)}>{book.title}</button>
                  {book.subtitle && <span className="muted small">{book.subtitle}</span>}
                </th>
                {shown.map((col) => <td key={col.key}>{col.cell(book) || '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
