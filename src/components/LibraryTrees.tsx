import { lazy, Suspense, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { BRANCH_LIMIT, bookLinks, bookMatrix, topicOrder, topicTree, type BookLink, type TopicNode } from '../search/libraryTrees'
import { findRelationshipBooks } from '../search/relationships'
import { nameToString, type Book } from '../types/book'
import './libraryRelationships.css'
import './libraryTrees.css'

const LibraryRelationships = lazy(() => import('./LibraryRelationships'))

type OpenBook = (book: Book) => void

const count = new Intl.NumberFormat('vi-VN')
const PAGE = 20
const editionDetails = (book: Book) => [book.publisher, book.year, book.edition && `Ấn bản ${book.edition}`].filter(Boolean).join(' · ')
const VIEWS = [
  { id: 'topics', label: 'Cây chủ đề' },
  { id: 'related', label: 'Cây sách liên quan' },
  { id: 'other', label: 'Các sơ đồ khác' },
] as const

function Branch({ label, detail, size, children }: {
  label: string; detail?: string; size?: number; children: () => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return <li>
    <details className="library-branch" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>
        <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
        {size !== undefined && <span className="library-tree-count">{count.format(size)} đầu sách</span>}
      </summary>
      {open && children()}
    </details>
  </li>
}

function BookLeaf({ book, onOpen, detail }: { book: Book; onOpen: OpenBook; detail?: string }) {
  return <li className="library-tree-leaf">
    <button type="button" className="rel-book-title" onClick={() => onOpen(book)}>{book.title}</button>
    {detail && <small>{detail}</small>}
  </li>
}

function TopicBooks({ books, onOpen }: { books: Map<string, Book>; onOpen: OpenBook }) {
  const [limit, setLimit] = useState(PAGE)
  const sorted = useMemo(() => [...books.values()].sort((a, b) => a.title.localeCompare(b.title, 'vi')), [books])
  return <ul className="library-tree">
    {sorted.slice(0, limit).map(book => <BookLeaf key={book.id} book={book} onOpen={onOpen} />)}
    {limit < sorted.length && <li><button type="button" className="secondary" onClick={() => setLimit(n => n + PAGE)}>
      Xem thêm sách ({count.format(sorted.length - limit)})
    </button></li>}
  </ul>
}

function TopicLevel({ nodes, onOpen }: { nodes: TopicNode[]; onOpen: OpenBook }) {
  const [limit, setLimit] = useState(PAGE)
  return <ul className="library-tree">
    {nodes.slice(0, limit).map(node => <Branch key={node.key} label={node.label} size={node.books.size}>
      {() => node.children.size
        ? <TopicLevel nodes={[...node.children.values()].sort(topicOrder)} onOpen={onOpen} />
        : <TopicBooks books={node.books} onOpen={onOpen} />}
    </Branch>)}
    {limit < nodes.length && <li><button type="button" className="secondary" onClick={() => setLimit(n => n + PAGE)}>
      Xem thêm nhánh ({count.format(nodes.length - limit)})
    </button></li>}
  </ul>
}

function TopicTree({ books, onOpen }: { books: Book[]; onOpen: OpenBook }) {
  const [query, setQuery] = useState('')
  const nodes = useMemo(() => topicTree(books, query), [books, query])
  const total = new Set(nodes.flatMap(node => [...node.books.keys()])).size
  return <div className="library-tree-panel">
    <p className="muted small">Mở lần lượt nhóm chủ đề, chủ đề sách và chủ đề chi tiết để xem các đầu sách. Một đầu sách có thể nằm ở nhiều nhánh.</p>
    <label className="rel-filter-group">Tìm trong cây chủ đề
      <input type="search" placeholder="Nhập tên chủ đề, nhan đề hoặc tác giả…" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <p className="library-tree-root" role="status">Chủ đề thư viện <span>{count.format(total)} đầu sách</span></p>
    {nodes.length
      ? <TopicLevel key={query} nodes={nodes} onOpen={onOpen} />
      : <p className="muted">Không tìm thấy sách phù hợp.</p>}
  </div>
}

function Matrix({ visible, books, onOpen }: { visible: Book[]; books: Book[]; onOpen: OpenBook }) {
  const [pair, setPair] = useState<[number, number] | null>(null)
  const edges = useMemo(() => bookMatrix(visible, books), [visible, books])
  const pairId = useId()
  return <>
    <p className="muted small">Ma trận đối chiếu các cặp giữa sách gốc và những sách ở nhánh cấp một. Chọn dấu ✓ để xem căn cứ liên hệ. Dấu – cho biết dữ liệu hiện tại chưa ghi nhận liên hệ.</p>
    <div className="library-matrix-scroll" tabIndex={0} role="region" aria-label="Bảng ma trận sách liên quan">
      <table className="library-matrix">
        <thead><tr><th scope="col">Sách</th>{visible.map((book, i) =>
          <th key={book.id} scope="col" aria-label={book.title}>{i + 1}</th>,
        )}</tr></thead>
        <tbody>{visible.map((book, row) => <tr key={book.id}>
          <th scope="row"><button type="button" className="rel-book-title" onClick={() => onOpen(book)}>{row + 1}. {book.title}</button></th>
          {visible.map((other, col) => {
            if (row === col) return <td key={other.id} aria-label="Cùng một đầu sách">·</td>
            const [first, second] = row < col ? [row, col] : [col, row]
            const evidence = edges[first][second - first - 1]
            const active = pair?.[0] === first && pair[1] === second
            return <td key={other.id}>{evidence.length
              ? <button type="button" className="matrix-link" aria-label={`Liên hệ giữa ${book.title} và ${other.title}`}
                aria-controls={pairId} aria-pressed={active} onClick={() => setPair(active ? null : [first, second])}>✓</button>
              : <span aria-label="Chưa ghi nhận liên hệ">–</span>}</td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <div id={pairId} aria-live="polite">
      {pair && <div className="matrix-evidence">
        <strong>{visible[pair[0]].title} ↔ {visible[pair[1]].title}</strong>
        <ul>{edges[pair[0]][pair[1] - pair[0] - 1].map(reason => <li key={reason}>{reason}</li>)}</ul>
      </div>}
    </div>
  </>
}

function NeighborBranch({ link, root, books, onFocus, onOpen }: {
  link: BookLink; root: Book; books: Book[]; onFocus: OpenBook; onOpen: OpenBook
}) {
  const next = useMemo(() => bookLinks(link.book, books, root.id), [link.book, books, root.id])
  return <div className="library-neighbor">
    <div className="library-tree-actions">
      <button type="button" className="secondary" onClick={() => onOpen(link.book)}>Mở hồ sơ</button>
      <button type="button" className="secondary" onClick={() => onFocus(link.book)}>Đặt làm sách gốc</button>
    </div>
    {next.length ? <ul className="library-tree">
      {next.map(item => <BookLeaf key={item.book.id} book={item.book} detail={item.evidence.join(' · ')} onOpen={onOpen} />)}
    </ul> : <p className="muted small">Chưa tìm thấy nhánh tiếp theo.</p>}
  </div>
}

function RelatedTree({ books, onOpen }: { books: Book[]; onOpen: OpenBook }) {
  const [query, setQuery] = useState('')
  const [bookId, setBookId] = useState('')
  const [showMatrix, setShowMatrix] = useState(false)
  const rootHeading = useRef<HTMLDivElement>(null)
  const root = books.find(book => book.id === bookId)
  const results = useMemo(() => query.trim() ? findRelationshipBooks(books, query, 'topic') : [], [books, query])
  const links = useMemo(() => root ? bookLinks(root, books) : [], [books, root])
  const visible = useMemo(() => root ? [root, ...links.map(link => link.book)] : [], [links, root])
  const focusBook = (book: Book) => {
    setBookId(book.id)
    setQuery('')
    setShowMatrix(false)
    requestAnimationFrame(() => rootHeading.current?.focus())
  }
  return <div className="library-tree-panel">
    <p className="muted small">Chọn sách gốc, rồi mở một nhánh để xem các sách liên quan ở cấp tiếp theo. Mỗi cấp hiển thị tối đa {BRANCH_LIMIT} đầu sách, ưu tiên các ấn bản cùng tác phẩm.</p>
    <label className="rel-filter-group">Tìm sách gốc
      <input type="search" placeholder="Nhập nhan đề, tác giả hoặc chủ đề…" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    {query.trim() && (results.length ? <ul className="library-root-picker">
      {results.slice(0, 10).map(book => <li key={book.id}>
        <button type="button" className="rel-book-title" onClick={() => focusBook(book)}>
          <strong>{book.title}</strong>
          <small>{[book.subtitle, (book.authors ?? []).map(nameToString).join(', '), editionDetails(book)].filter(Boolean).join(' · ')}</small>
        </button>
      </li>)}
      {results.length > 10 && <li className="muted small">Hiện 10 trong {count.format(results.length)} kết quả. Gõ thêm để thu hẹp tìm kiếm.</li>}
    </ul> : <p className="muted" role="status">Không tìm thấy sách khớp từ khóa.</p>)}
    {root && <>
      <div className="library-tree-root" tabIndex={-1} ref={rootHeading}>
        <div><small>Sách gốc</small><strong>{root.title}</strong><small>{editionDetails(root)}</small></div>
        <button type="button" className="secondary" onClick={() => onOpen(root)}>Mở hồ sơ</button>
      </div>
      {links.length ? <>
        <ul className="library-tree" key={`tree-${root.id}`}>
          {links.map(link => <Branch key={link.book.id} label={link.book.title} detail={[...link.evidence, editionDetails(link.book)].filter(Boolean).join(' · ')}>
            {() => <NeighborBranch link={link} root={root} books={books} onFocus={focusBook} onOpen={onOpen} />}
          </Branch>)}
        </ul>
        <details key={`matrix-${root.id}`} className="library-matrix-panel" onToggle={event => setShowMatrix(event.currentTarget.open)}>
          <summary>Ma trận sách liên quan · {visible.length} đầu sách</summary>
          {showMatrix && <Matrix key={root.id} visible={visible} books={books} onOpen={onOpen} />}
        </details>
      </> : <p className="muted">Chưa tìm thấy sách liên quan trong thư viện.</p>}
    </>}
  </div>
}

export default function LibraryTrees({ books, onOpen }: { books: Book[]; onOpen: OpenBook }) {
  const [view, setView] = useState<typeof VIEWS[number]['id']>('topics')
  const owned = useMemo(() => books.filter(book => book.status === 'owned' || book.status === 'lent'), [books])
  return <>
    <section className="card library-trees" aria-labelledby="library-trees-heading">
      <h3 id="library-trees-heading">Sơ đồ thư viện</h3>
      <nav className="subtabs" aria-label="Loại sơ đồ thư viện">
        {VIEWS.map(item => <button type="button" key={item.id}
          className={`subtab${item.id === view ? ' active' : ''}`} aria-pressed={item.id === view} onClick={() => setView(item.id)}>
          {item.label}
        </button>)}
      </nav>
      {!owned.length && <p className="muted">Chưa có sách để lập sơ đồ.</p>}
      {!!owned.length && view === 'topics' && <TopicTree books={owned} onOpen={onOpen} />}
      {!!owned.length && view === 'related' && <RelatedTree books={owned} onOpen={onOpen} />}
    </section>
    {view === 'other' && <Suspense fallback={<div className="card" role="status">Đang tải sơ đồ…</div>}>
      <LibraryRelationships books={books} onOpen={onOpen} />
    </Suspense>}
  </>
}
