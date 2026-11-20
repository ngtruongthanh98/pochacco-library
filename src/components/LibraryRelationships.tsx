import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Background, Controls, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './libraryRelationships.css'
import { nameToString, type Book } from '../types/book'
import {
  findRelationshipBooks, groupsForBook, HOLDING_GROUPS, holdingGroup, RELATIONSHIPS,
  relationshipGroups, sharedGroups, type BookGroup, type HoldingGroup, type Relationship,
} from '../search/relationships'
import { foldVi } from '../search/normalizeVi'
import { LANG_LABEL } from '../search/stats'
import { nf } from './charts'

const GRAPH_LIMIT = 6
const LIST_LIMIT = 18
const VIEWS = [
  { key: 'format', label: 'Định dạng' },
  { key: 'group', label: 'Mối liên hệ' },
  { key: 'book', label: 'Theo từng cuốn' },
] as const
type View = typeof VIEWS[number]['key']
type SelectableFormat = HoldingGroup | 'all'
type GraphItem = { key: string; label: string; detail: string; color?: string; active?: boolean }

const flowLabels = {
  'controls.ariaLabel': 'Điều khiển sơ đồ',
  'controls.zoomIn.ariaLabel': 'Phóng to sơ đồ',
  'controls.zoomOut.ariaLabel': 'Thu nhỏ sơ đồ',
  'controls.fitView.ariaLabel': 'Vừa khung sơ đồ',
}
const fit = { padding: 0.14, maxZoom: 1.15 }
const countLabel = (count: number) => `${nf(count)} đầu sách`
const formInfo = (key: HoldingGroup) => HOLDING_GROUPS.find(group => group.key === key)!

function RelationshipDiagram({ root, items, onRoot, onPick, caption, itemName = 'nhóm' }: {
  root: GraphItem
  items: GraphItem[]
  onRoot?: () => void
  onPick: (key: string) => void
  caption: string
  itemName?: string
}) {
  const label = (item: GraphItem, onClick?: () => void) => {
    const children = <><span className="rel-node-title">{item.label}</span><small>{item.detail}</small></>
    const style = { '--relationship-color': item.color ?? '#a74635' } as CSSProperties
    return onClick
      ? <button type="button" className="rel-node nodrag nopan" style={style} title={`${item.label} · ${item.detail}`}
          aria-pressed={Boolean(item.active)} onClick={onClick}>{children}</button>
      : <div className="rel-node" style={style} title={`${item.label} · ${item.detail}`}>{children}</div>
  }
  const visible = items.slice(0, GRAPH_LIMIT)
  const nodes: Node[] = [
    { id: 'root', position: { x: 0, y: Math.max(0, (visible.length - 1) * 35) },
      sourcePosition: Position.Right, data: { label: label(root, onRoot) }, className: 'rel-flow-node rel-flow-root' },
    ...visible.map((item, index) => ({
      id: `node-${index}`, position: { x: 202, y: index * 70 }, targetPosition: Position.Left,
      data: { label: label(item, () => onPick(item.key)) }, className: 'rel-flow-node',
    })),
  ]
  const edges: Edge[] = visible.map((item, index) => ({
    id: `link-${index}`, source: 'root', target: `node-${index}`,
    style: { stroke: item.color ?? '#b48565', strokeWidth: item.active ? 3 : 1.6, opacity: item.active ? 1 : 0.7 },
  }))
  return (
    <figure className="rel-figure">
      <div className="rel-canvas" aria-label="Sơ đồ tương tác">
        <ReactFlow key={JSON.stringify([root.key, ...visible.map(item => item.key)])} nodes={nodes} edges={edges}
          fitView fitViewOptions={fit} minZoom={0.4} maxZoom={2} zoomOnScroll={false} panOnDrag
          nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
          elementsSelectable={false} deleteKeyCode={null} ariaLabelConfig={flowLabels} proOptions={{ hideAttribution: true }}>
          <Background gap={18} color="#e9d6c0" />
          <Controls orientation="horizontal" position="bottom-left" showInteractive={false} fitViewOptions={fit} />
        </ReactFlow>
      </div>
      <figcaption className="muted small">{caption}{items.length > GRAPH_LIMIT && ` Sơ đồ hiện ${GRAPH_LIMIT} ${itemName} đầu. Danh sách có đủ ${nf(items.length)} ${itemName}.`}</figcaption>
    </figure>
  )
}

function BookResults({ books, relation, onOpen, onFocus, empty }: {
  books: Book[]; relation: Relationship; onOpen: (book: Book) => void; onFocus: (book: Book) => void; empty: string
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(LIST_LIMIT)
  const results = useMemo(() => findRelationshipBooks(books, query, relation), [books, query, relation])
  return (
    <div className="rel-results">
      <input type="search" aria-label="Tìm sách trong kết quả" placeholder="Tìm nhan đề, tác giả, chủ đề…" value={query}
        onChange={event => { setQuery(event.target.value); setLimit(LIST_LIMIT) }} />
      {query && <p className="muted small" role="status">{countLabel(results.length)} phù hợp</p>}
      {results.length ? <ul className="rel-books">
        {results.slice(0, limit).map(book => {
          const holding = formInfo(holdingGroup(book))
          const copies = book.holdings.reduce((sum, h) => sum + (h.kind === 'print' ? h.copies ?? 1 : 0), 0)
          const ebookFormats = [...new Set(book.holdings.flatMap(h => h.kind === 'ebook' ? [h.format.toUpperCase()] : []))]
          const metadata = [(book.authors ?? []).map(nameToString).join(', '), book.year, book.seriesNo && `Tập ${book.seriesNo}`]
            .filter(Boolean).join(' · ')
          const files = [copies > 1 && `${nf(copies)} bản giấy`, ebookFormats.join(', '),
            holding.key !== 'audio' && book.holdings.some(h => h.kind === 'audio') && 'Tệp nghe đi kèm',
            book.status === 'lent' && 'Đang cho mượn'].filter(Boolean).join(' · ')
          return <li key={book.id}>
            <div>
              <button type="button" className="rel-book-title" onClick={() => onOpen(book)}>{book.title}</button>
              {metadata && <p className="muted small">{metadata}</p>}
              <p className="rel-holding small"><span style={{ backgroundColor: holding.color }} />{holding.label}{files && ` · ${files}`}</p>
            </div>
            <button type="button" className="secondary rel-book-action" onClick={() => onFocus(book)}
              aria-label={`Xem mối liên hệ của ${book.title}`}>Sơ đồ</button>
          </li>
        })}
      </ul> : <p className="muted small">{query ? 'Không tìm thấy sách khớp từ khóa.' : empty}</p>}
      {results.length > limit && <button type="button" className="link" onClick={() => setLimit(value => value + LIST_LIMIT)}>
        Xem thêm · còn {nf(results.length - limit)}
      </button>}
    </div>
  )
}

export default function LibraryRelationships({ books, onOpen }: { books: Book[]; onOpen: (book: Book) => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [view, setView] = useState<View>('format')
  const [relationship, setRelationship] = useState<Relationship>('topic')
  const [format, setFormat] = useState<SelectableFormat>('all')
  const [formatFilter, setFormatFilter] = useState<SelectableFormat>('all')
  const [groupKey, setGroupKey] = useState('')
  const [linkKey, setLinkKey] = useState('')
  const [groupQuery, setGroupQuery] = useState('')
  const [bookId, setBookId] = useState('')
  const [neighborId, setNeighborId] = useState('')
  const [groupLimit, setGroupLimit] = useState(LIST_LIMIT)

  const owned = useMemo(() => books.filter(book => book.status === 'owned' || book.status === 'lent'), [books])
  const formats = useMemo(() => {
    const entries = new Map<HoldingGroup, Book[]>(HOLDING_GROUPS.map(group => [group.key, []]))
    for (const book of owned) entries.get(holdingGroup(book))!.push(book)
    return entries
  }, [owned])
  const scoped = formatFilter === 'all' ? owned : formats.get(formatFilter)!
  const groups = useMemo(() => view === 'format' ? [] : relationshipGroups(scoped, relationship), [scoped, relationship, view])
  const rootGroup = groups.find(group => group.key === groupKey)
  const rootBook = view === 'book' ? owned.find(book => book.id === bookId) : undefined
  const links = useMemo(() => {
    if (view === 'book') return rootBook ? groupsForBook(groups, rootBook, relationship) : []
    return rootGroup ? sharedGroups(groups, rootGroup) : groups
  }, [groups, relationship, rootBook, rootGroup, view])
  const focusedLink = links.find(group => group.key === linkKey)
  const matchingGroups = useMemo(() => links.filter(group => foldVi(group.label).includes(foldVi(groupQuery.trim()))),
    [links, groupQuery])
  const selectGroup = (key: string) => {
    setGroupKey(key); setLinkKey(''); setNeighborId(''); setGroupQuery(''); setGroupLimit(LIST_LIMIT)
  }
  const selectLink = (key: string) => {
    if (view === 'group' && !rootGroup) selectGroup(key)
    else {
      setNeighborId('')
      setLinkKey(current => current === key ? '' : key)
    }
  }
  const selectView = (next: View) => {
    setView(next); selectGroup('')
  }
  const focusBook = (book: Book) => {
    setBookId(book.id)
    if (view === 'format') setFormatFilter('all')
    selectView('book')
    heading.current?.focus()
  }

  const groupsToItems = (items: BookGroup[], shared: boolean): GraphItem[] => items.map(group => ({
    key: group.key, label: group.label, detail: shared ? `${nf(group.books.length)} sách chung` : countLabel(group.books.length),
    active: focusedLink?.key === group.key,
  }))
  const formatItems = HOLDING_GROUPS.map(entry => ({
    ...entry, detail: countLabel(formats.get(entry.key)!.length), active: entry.key === format,
  }))
  const libraryRoot = { key: 'library', label: 'Thư viện của tôi', detail: countLabel(owned.length), active: format === 'all' }
  const bookRoot = rootBook && { key: rootBook.id, label: rootBook.title, detail: formInfo(holdingGroup(rootBook)).label,
    color: formInfo(holdingGroup(rootBook)).color }
  const groupRoot = rootGroup ? { key: rootGroup.key, label: rootGroup.label, detail: countLabel(rootGroup.books.length) }
    : { key: 'groups', label: 'Thư viện của tôi', detail: countLabel(scoped.length) }
  const neighbors = useMemo(() => {
    const entries = new Map<string, { book: Book; labels: string[] }>()
    if (view !== 'book') return []
    for (const group of focusedLink ? [focusedLink] : links) {
      for (const book of group.books) {
        const previous = entries.get(book.id)
        if (previous) previous.labels.push(group.label)
        else entries.set(book.id, { book, labels: [group.label] })
      }
    }
    return [...entries.values()].sort((a, b) =>
      b.labels.length - a.labels.length || a.book.title.localeCompare(b.book.title, 'vi'))
  }, [focusedLink, links, view])
  const selectedNeighbor = neighbors.find(item => item.book.id === neighborId)
  const displayed = view === 'format' ? (format === 'all' ? owned : formats.get(format)!)
    : view === 'book' && rootBook
      ? (selectedNeighbor ? [selectedNeighbor.book] : neighbors.map(item => item.book))
      : focusedLink?.books ?? rootGroup?.books ?? scoped
  const resultTitle = view === 'format' ? (format === 'all' ? 'Tất cả sách' : formInfo(format).label)
    : selectedNeighbor ? 'Sách đã chọn'
    : focusedLink ? (rootGroup && view === 'group' ? `Sách chung với ${focusedLink.label}` : focusedLink.label)
    : view === 'book' ? (rootBook ? 'Sách có liên hệ' : 'Chọn sách để xem sơ đồ')
    : rootGroup?.label ?? 'Sách trong phạm vi lọc'
  const resultKey = JSON.stringify([view, format, formatFilter, relationship, rootGroup?.key, rootBook?.id, focusedLink?.key, selectedNeighbor?.book.id])
  const graphItems = view === 'book' ? neighbors.map(({ book, labels }) => ({
    key: book.id, label: book.title, detail: labels.join(' · '), color: formInfo(holdingGroup(book)).color,
    active: book.id === neighborId,
  })) : groupsToItems(links, Boolean(rootGroup))
  const relationLabel = RELATIONSHIPS.find(item => item.key === relationship)!.label
  const caption = view === 'format' ? 'Chọn một nút để xem sách theo định dạng.'
    : view === 'book' ? 'Mỗi nút là một cuốn có liên hệ với cuốn ở giữa. Nhãn dưới nhan đề cho biết thông tin chung.'
    : rootGroup ? 'Mỗi đường nối cho biết hai nhóm có sách chung. Chọn nút để xem những cuốn thuộc cả hai.'
    : 'Chọn một nhóm để xem sách và tìm các nhóm có sách chung.'

  return (
    <section className="card library-relationships" aria-labelledby="library-relationships-heading">
      <div className="rel-heading">
        <h3 id="library-relationships-heading" ref={heading} tabIndex={-1}>Sơ đồ thư viện</h3>
        <p className="muted small">Gồm sách đang có và đang cho mượn.</p>
      </div>
      {!owned.length ? <p className="muted">Chưa có sách để lập sơ đồ.</p> : <>
        <nav className="subtabs" aria-label="Cách xem sơ đồ">
          {VIEWS.map(item => <button type="button" key={item.key} className={`subtab${view === item.key ? ' active' : ''}`}
            aria-pressed={view === item.key} onClick={() => selectView(item.key)}>{item.label}</button>)}
        </nav>
        {view !== 'format' && <div className="rel-filters">
          <label>Liên hệ theo<select value={relationship} onChange={event => {
            setRelationship(event.target.value as Relationship)
            selectGroup('')
          }}>{RELATIONSHIPS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label>Định dạng<select value={formatFilter} onChange={event => {
            setFormatFilter(event.target.value as SelectableFormat)
            selectGroup('')
          }}><option value="all">Mọi định dạng</option>{HOLDING_GROUPS.map(item =>
            <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        </div>}
        {view === 'book' && rootBook && <div className="rel-context">
          <div><strong>{rootBook.title}</strong><p className="muted small">
            {[(rootBook.authors ?? []).map(nameToString).join(', '), rootBook.year,
              rootBook.language && (LANG_LABEL[rootBook.language.toLowerCase()] ?? rootBook.language)].filter(Boolean).join(' · ')}
          </p></div>
          <button type="button" className="secondary" onClick={() => { setBookId(''); selectGroup('') }}>Chọn cuốn khác</button>
        </div>}
        {view === 'group' && rootGroup && <div className="rel-context">
          <button type="button" className="link" onClick={() => selectGroup('')}>← Tất cả nhóm</button>
          <strong>{rootGroup.label}</strong>
          {focusedLink && <button type="button" className="link" onClick={() => selectGroup(focusedLink.key)}>Khám phá nhóm {focusedLink.label}</button>}
        </div>}
        <div className="rel-workspace">
          <div className="rel-discovery">
            {view === 'format'
              ? <>
                  <RelationshipDiagram root={libraryRoot} items={formatItems} caption={caption}
                    onRoot={() => setFormat('all')} onPick={key => setFormat(key as HoldingGroup)} />
                  <div className="rel-format-key" aria-label="Lọc định dạng">
                    <button type="button" className="secondary" aria-pressed={format === 'all'} onClick={() => setFormat('all')}>Tất cả · {nf(owned.length)}</button>
                    {formatItems.map(item => <button type="button" className="secondary" key={item.key} aria-pressed={item.active}
                      onClick={() => setFormat(item.key)}><span style={{ backgroundColor: item.color }} />{item.label} · {nf(formats.get(item.key)!.length)}</button>)}
                  </div>
                </>
              : (view === 'group' || bookRoot) && <>
                  {graphItems.length ? <RelationshipDiagram root={bookRoot || groupRoot}
                    items={graphItems} caption={caption} itemName={view === 'book' ? 'cuốn' : 'nhóm'}
                    onPick={view === 'book' ? key => setNeighborId(current => current === key ? '' : key) : selectLink}
                    onRoot={selectedNeighbor ? () => setNeighborId('') : focusedLink ? () => setLinkKey('') : undefined} />
                    : <p className="rel-empty muted">{view === 'book' || rootGroup
                      ? `Chưa tìm thấy sách chung theo ${relationLabel.toLocaleLowerCase('vi')} trong phạm vi lọc.`
                      : `Chưa có dữ liệu về ${relationLabel.toLocaleLowerCase('vi')} trong phạm vi lọc.`}</p>}
                  {links.length > 0 && <div className="rel-group-picker">
                    <label className="rel-filter-group">Tìm nhóm<input type="search" placeholder="Nhập tên nhóm…" value={groupQuery}
                      onChange={event => { setGroupQuery(event.target.value); setGroupLimit(LIST_LIMIT) }} /></label>
                    {focusedLink && <button type="button" className="link" onClick={() => setLinkKey('')}>Bỏ lọc nhóm</button>}
                    <div className="rel-groups">
                      {matchingGroups.slice(0, groupLimit).map(group => <button type="button" className="secondary"
                          key={group.key} title={group.label} aria-pressed={focusedLink?.key === group.key} onClick={() => selectLink(group.key)}>
                        <span>{group.label}</span><b>{nf(group.books.length)}</b>
                      </button>)}
                    </div>
                    {!matchingGroups.length && <p className="muted small">Không tìm thấy nhóm khớp từ khóa.</p>}
                    {matchingGroups.length > groupLimit && <button type="button" className="link" onClick={() => setGroupLimit(value => value + LIST_LIMIT)}>
                      Xem thêm nhóm · còn {nf(matchingGroups.length - groupLimit)}
                    </button>}
                  </div>}
                </>}
          </div>
          <aside className="rel-book-panel">
            <h4>{resultTitle}</h4>
            <p className="muted small" aria-live="polite">{countLabel(displayed.length)}</p>
            {selectedNeighbor && <>
              <p className="muted small">Cùng thông tin: {selectedNeighbor.labels.join(' · ')}</p>
              <button type="button" className="link" onClick={() => setNeighborId('')}>Xem tất cả sách có liên hệ</button>
            </>}
            <BookResults key={resultKey} books={displayed} relation={relationship} onOpen={onOpen} onFocus={focusBook}
              empty="Chưa có sách trong nhóm này." />
          </aside>
        </div>
      </>}
    </section>
  )
}
