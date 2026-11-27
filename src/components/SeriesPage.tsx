import { useEffect, useMemo, useState } from 'react'
import { formatOf } from '../data/format'
import type { StoreConfig } from '../data/githubStore'
import { bookSeries, compareSeriesEntries, fmtRanges, seriesCoverage, seriesSource } from '../data/series'
import { loadSuggestCfg } from '../data/suggest'
import { foldVi } from '../search/normalizeVi'
import { nameToString, type Book } from '../types/book'
import './seriesPage.css'

const formatLabel = { both: 'Sách giấy và ebook', print: 'Sách giấy', ebook: 'Ebook', none: 'Chưa ghi bản lưu' }
const collator = new Intl.Collator('vi')

export default function SeriesPage({ books, cfg, selected, onSeries, onOpen }: {
  books: Book[]
  cfg: StoreConfig
  selected: string | null
  onSeries: (key: string | null) => void
  onOpen: (book: Book) => void
}) {
  const [query, setQuery] = useState('')
  const [totals, setTotals] = useState<Record<string, number>>({})
  useEffect(() => {
    let active = true
    loadSuggestCfg(cfg).then(({ data }) => {
      if (active) setTotals(data.totals)
    }).catch(() => {})
    return () => { active = false }
  }, [cfg])

  const groups = useMemo(() => bookSeries(books)
    .filter((group) => group.explicit || group.entries.length > 1)
    .sort((a, b) => collator.compare(a.name, b.name)), [books])
  const current = selected ? groups.find((group) => group.key === selected) : undefined
  const term = foldVi(query.trim())
  const matches = groups.filter((group) => !term || foldVi(group.name).includes(term)
    || group.entries.some(({ book }) => foldVi([
      book.title, ...(book.authors ?? []).map(nameToString), ...(book.translators ?? []).map(nameToString),
    ].join(' ')).includes(term)))

  if (!current) {
    return (
      <section className="card series-page">
        <h2>Bộ sách</h2>
        {selected && <p role="status">Không tìm thấy bộ sách này trong danh mục.</p>}
        <label>
          Tìm bộ sách
          <input type="search" placeholder="Tên bộ, tên sách, tác giả hoặc dịch giả" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <p className="muted" aria-live="polite">{term ? `${matches.length}/${groups.length} bộ sách` : `${groups.length} bộ sách`}</p>
        {matches.length ? (
          <ul className="series-directory">
            {matches.map((group) => (
              <li key={group.key}>
                <button className="series-link" onClick={() => onSeries(group.key)}>
                  <strong>{group.name}</strong>
                  <span className="muted small">{group.entries.length} mục trong danh mục</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p>Chưa tìm thấy bộ sách phù hợp.</p>}
      </section>
    )
  }

  const coverage = seriesCoverage(current, totals)
  const source = seriesSource(current.key)
  const unit = source ? 'bộ' : 'tập'
  const countFormat = (kind: 'print' | 'ebook') => coverage.owned.filter(({ book }) => book.holdings.some((holding) => holding.kind === kind)).length
  const complete = coverage.knownTotal !== null && !coverage.conflict &&
    coverage.present.size === coverage.knownTotal && !coverage.missingParts.length
  const subtitle = (book: Book) => [
    book.translators?.length ? `Dịch giả ${book.translators.map(nameToString).join(', ')}` : book.authors?.map(nameToString).join(', '),
    book.publisher, book.year,
  ].filter(Boolean).join(' · ')

  return (
    <section className="card series-page">
      <nav aria-label="Điều hướng bộ sách">
        <button className="link" onClick={() => onSeries(null)}>← Tất cả bộ sách</button>
      </nav>
      <header className="series-header">
        <h2>{current.name}</h2>
        <p className="muted">{current.entries.length} mục · {countFormat('print')} có bản giấy · {countFormat('ebook')} có ebook</p>
      </header>
      <div className="series-coverage">
        {complete ? (
          <strong>Đã có đủ {coverage.knownTotal} {unit}</strong>
        ) : coverage.conflict ? (
          <strong>Số đã ghi vượt tổng số {unit} khai báo</strong>
        ) : coverage.knownTotal !== null ? (
          <strong>Đã ghi nhận {coverage.present.size}/{coverage.knownTotal} {unit}</strong>
        ) : (
          <strong>Chưa xác minh tổng số {unit}</strong>
        )}
        {coverage.knownTotal !== null && !coverage.conflict && (
          <progress value={coverage.present.size} max={coverage.knownTotal} aria-label={`Số ${unit} đã ghi nhận`} />
        )}
        {coverage.missing.length > 0 && (
          <p>{coverage.knownTotal ? 'Còn thiếu' : 'Khoảng trống trong dãy số đã ghi gồm'} {fmtRanges(coverage.missing, unit)}.</p>
        )}
        {coverage.missingParts.length > 0 && <p>Bộ Vị Trí còn thiếu {fmtRanges(coverage.missingParts, 'quyển')}.</p>}
        {!complete && coverage.unnumbered && <p className="muted">Một số sách đã có chưa ghi số, nên chưa thể đối chiếu đủ.</p>}
        {coverage.configured && <p className="muted">Tổng số theo cài đặt của bạn trong Gợi ý bổ sung.</p>}
        {source && (
          <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
        )}
      </div>
      <h3>Sách trong bộ</h3>
      <ul className="series-volumes">
        {[...current.entries].sort(compareSeriesEntries).map(({ book, numbers }) => (
          <li key={book.id}>
            <button className="series-link" onClick={() => onOpen(book)}>
              <span className="series-volume-label">
                {numbers.length ? fmtRanges(numbers, unit === 'bộ' ? 'Bộ' : 'Tập') : 'Chưa ghi số'}
                {book.seriesNo !== undefined && book.volume && Number(book.volume) !== book.seriesNo && (
                  <span>{/^\d/.test(book.volume) ? `Quyển ${book.volume}` : book.volume}</span>
                )}
              </span>
              <span className="series-book-info">
                <strong>{book.title}</strong>
                {subtitle(book) && <span className="muted small">{subtitle(book)}</span>}
                <span className="series-format">{book.status === 'wishlist' ? 'Muốn mua' : book.status === 'lost' ? 'Đã mất' : formatLabel[formatOf(book)]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
