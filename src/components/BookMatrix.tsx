import { useId, useMemo, useState } from 'react'
import { bookLinks, bookMatrix } from '../search/libraryTrees'
import { findRelationshipBooks, relationshipGroups, type Relationship } from '../search/relationships'
import { nameToString, type Book } from '../types/book'
import './bookMatrix.css'

const LIMIT = 12
const FILTERS = [
  { key: 'topic', label: 'Chủ đề chung' },
  { key: 'author', label: 'Cùng tác giả hoặc chủ biên' },
  { key: 'translator', label: 'Cùng dịch giả' },
  { key: 'series', label: 'Cùng bộ sách' },
  { key: 'work', label: 'Cùng tác phẩm' },
  { key: 'title', label: 'Nhan đề gần nhau' },
] as const
type Kind = typeof FILTERS[number]['key']
type Evidence = { kind: Kind; text: string }

const suggestedKind = (text: string): Kind => {
  if (text === 'Cùng tác phẩm') return 'work'
  if (text.startsWith('Cùng bộ ')) return 'series'
  if (text.startsWith('Cùng tác giả') || text.startsWith('Cùng chủ biên')) return 'author'
  if (text.startsWith('Nhan đề')) return 'title'
  return 'topic'
}

function compare(visible: Book[], books: Book[]) {
  const matrix = bookMatrix(visible, books)
  const direct: [Relationship, Kind][] = [
    ['translator', 'translator'], ['work', 'work'],
  ]
  const extra = direct.flatMap(([relation, kind]) =>
    relationshipGroups(visible, relation).filter(group => group.books.length > 1).map(group => ({
      kind,
      label: group.label,
      ids: new Set(group.books.map(book => book.id)),
    })),
  )
  return visible.map((book, row) => visible.slice(row + 1).map((other, offset) => {
    const reasons: Evidence[] = matrix[row][offset].map(text => ({ kind: suggestedKind(text), text }))
    for (const group of extra) {
      if (!group.ids.has(book.id) || !group.ids.has(other.id)) continue
      if (group.kind === 'work' && reasons.some(reason => reason.kind === 'work')) continue
      reasons.push({
        kind: group.kind,
        text: group.kind === 'translator' ? `Cùng dịch giả ${group.label}` : `Cùng tác phẩm ${group.label}`,
      })
    }
    return reasons
  }))
}

export default function BookMatrix({ books, selected, onSelection, onOpen }: {
  books: Book[]
  selected: string[]
  onSelection: (ids: string[]) => void
  onOpen: (book: Book) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [pair, setPair] = useState<[string, string] | null>(null)
  const pairId = useId()
  const byId = useMemo(() => new Map(books.map(book => [book.id, book])), [books])
  const visible = useMemo(() => selected.flatMap(id => {
    const book = byId.get(id)
    return book ? [book] : []
  }), [selected, byId])
  const search = useMemo(() => query.trim() ? findRelationshipBooks(books, query, 'topic') : [], [books, query])
  const results = search.filter(book => !selected.includes(book.id)).slice(0, 8)
  const edges = useMemo(() => compare(visible, books), [visible, books])
  const add = (ids: string[]) => onSelection([...new Set([...visible.map(book => book.id), ...ids])].slice(0, LIMIT))
  const remove = (id: string) => {
    onSelection(visible.filter(book => book.id !== id).map(book => book.id))
    if (pair?.includes(id)) setPair(null)
  }
  const filtered = (evidence: Evidence[]) => kind === 'all' ? evidence : evidence.filter(reason => reason.kind === kind)
  const row = pair ? visible.findIndex(book => book.id === pair[0]) : -1
  const col = pair ? visible.findIndex(book => book.id === pair[1]) : -1
  const current = row >= 0 && col > row ? filtered(edges[row][col - row - 1]) : []
  const linkedPairs = edges.reduce((total, entries) => total + entries.filter(entry => filtered(entry).length > 0).length, 0)

  return <div className="library-tree-panel book-matrix">
    <p className="muted small">Chọn từ 2 đến {LIMIT} đầu sách để đối chiếu từng cặp. Bạn có thể tìm sách thuộc nhiều chủ đề rồi đưa vào cùng một ma trận.</p>
    <label className="rel-filter-group">Tìm và thêm sách
      <input type="search" placeholder="Nhan đề, tác giả, dịch giả hoặc chủ đề…" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    {query.trim() && (results.length ? <ul className="library-root-picker">
      {results.map(book => <li key={book.id}>
        <button type="button" className="rel-book-title" disabled={visible.length >= LIMIT} onClick={() => add([book.id])}>
          <strong>＋ {book.title}</strong>
          <small>{[book.year, book.publisher, ...(book.translators ?? book.authors ?? []).map(nameToString)].filter(Boolean).join(' · ')}</small>
        </button>
      </li>)}
    </ul> : <p className="muted small">Không còn sách khớp từ khóa để thêm.</p>)}
    {!!visible.length && <>
      <div className="matrix-selected-head">
        <strong>{visible.length}/{LIMIT} đầu sách đã chọn</strong>
        <button type="button" className="link" onClick={() => { onSelection([]); setPair(null) }}>Bỏ chọn tất cả</button>
      </div>
      <ol className="matrix-selected">
        {visible.map(book => <li key={book.id}>
          <span>{book.title}</span>
          <button type="button" className="link" aria-label={`Bỏ ${book.title}`} onClick={() => remove(book.id)}>Bỏ</button>
        </li>)}
      </ol>
      {visible.length === 1 && <div>
        <button type="button" className="secondary" onClick={() => add(bookLinks(visible[0], books).map(link => link.book.id))}>
          Thêm nhóm sách liên quan
        </button>
      </div>}
    </>}
    {visible.length >= 2 && <>
      <div className="matrix-tools">
        <label>Kiểu liên hệ
          <select value={kind} onChange={event => { setKind(event.target.value as Kind | 'all'); setPair(null) }}>
            <option value="all">Tất cả liên hệ</option>
            {FILTERS.map(filter => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
          </select>
        </label>
        <p className="muted small" role="status">Ghi nhận liên hệ ở {linkedPairs}/{visible.length * (visible.length - 1) / 2} cặp.</p>
      </div>
      <p className="muted small">Số và độ đậm trong ô thể hiện số căn cứ liên hệ. Chọn ô để xem chi tiết. Dấu – nghĩa là chưa ghi nhận liên hệ theo bộ lọc.</p>
      <div className="library-matrix-scroll" tabIndex={0} role="region" aria-label="Ma trận liên hệ giữa các sách">
        <table className="library-matrix">
          <thead><tr><th scope="col">Đầu sách</th>{visible.map((book, index) =>
            <th key={book.id} scope="col" aria-label={book.title} title={book.title}>{index + 1}</th>,
          )}</tr></thead>
          <tbody>{visible.map((book, i) => <tr key={book.id}>
            <th scope="row"><button type="button" className="rel-book-title" onClick={() => onOpen(book)}>{i + 1}. {book.title}</button></th>
            {visible.map((other, j) => {
              if (i >= j) return <td key={other.id} className="matrix-empty" />
              const evidence = filtered(edges[i][j - i - 1])
              const active = pair?.[0] === book.id && pair[1] === other.id
              return <td key={other.id}>{evidence.length ? (
                <button type="button" className={`matrix-link matrix-level-${Math.min(evidence.length, 3)}`}
                  aria-label={`${book.title} và ${other.title}, ${evidence.length} căn cứ`}
                  aria-controls={pairId} aria-pressed={active}
                  onClick={() => setPair(active ? null : [book.id, other.id])}>{evidence.length}</button>
              ) : '–'}</td>
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <div id={pairId} aria-live="polite">
        {!!current.length && <div className="matrix-evidence">
          <strong>{visible[row].title} ↔ {visible[col].title}</strong>
          <ul>{current.map(({ kind: category, text }) => <li key={`${category}:${text}`}>{text}</li>)}</ul>
          <div className="library-tree-actions">
            <button type="button" className="secondary" onClick={() => onOpen(visible[row])}>Mở sách {row + 1}</button>
            <button type="button" className="secondary" onClick={() => onOpen(visible[col])}>Mở sách {col + 1}</button>
          </div>
        </div>}
      </div>
    </>}
  </div>
}
