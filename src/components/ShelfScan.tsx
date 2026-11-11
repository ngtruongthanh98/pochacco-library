import { useMemo, useRef, useState } from 'react'
import { addBooks, updateBook, type StoreConfig } from '../data/githubStore'
import { lookupIsbn } from '../data/lookup'
import { ulid } from '../data/ulid'
import { nameToString, type Book } from '../types/book'
import Cover from './Cover'
import { findByIsbn } from './ScanOne'
import Scanner from './Scanner'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

type Item = {
  key: string
  isbn: string
  status: 'checking' | 'exists' | 'found' | 'notfound'
  copies: number
  existing?: Book
  draft?: Partial<Book>
  title: string
  include: boolean
  move: boolean
}

const printLocation = (b: Book) => {
  const p = b.holdings.find((h) => h.kind === 'print')
  return p?.kind === 'print' ? p.location : undefined
}

const STATUS_TEXT: Record<Item['status'], string> = {
  checking: 'Đang tra cứu',
  exists: 'Đã có',
  found: 'Mới, có dữ liệu',
  notfound: 'Mới, chưa có dữ liệu',
}

/** Quét liên tục một kệ, rồi duyệt lại và lưu tất cả trong một lần. */
export default function ShelfScan({
  cfg,
  books,
  onDone,
  onCancel,
}: {
  cfg: StoreConfig
  books: Book[]
  onDone: (added: Book[], updated: Book[], shelf: string) => void
  onCancel: () => void
}) {
  const [shelf, setShelf] = useState('')
  const [phase, setPhase] = useState<'setup' | 'scan' | 'review'>('setup')
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queue = useRef(Promise.resolve())
  const seen = useRef(new Map<string, string>()) // isbn -> key, để nhận ra quét lặp ngay lập tức

  const locations = useMemo(
    () => [...new Set(books.map(printLocation).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'vi')),
    [books],
  )
  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)))

  const onIsbn = (isbn: string) => {
    // Quét lại cùng một ISBN trong phiên này = thêm một bản nữa của cuốn đó.
    const prevKey = seen.current.get(isbn)
    if (prevKey) {
      setItems((xs) => xs.map((x) => (x.key === prevKey ? { ...x, copies: x.copies + 1 } : x)))
      return
    }
    const existing = findByIsbn(books, isbn)
    const key = `${isbn}-${Date.now()}`
    seen.current.set(isbn, key)
    const item: Item = existing
      ? { key, isbn, status: 'exists', copies: 1, existing, title: existing.title, include: false, move: false }
      : { key, isbn, status: 'checking', copies: 1, title: '', include: true, move: false }
    setItems((xs) => [item, ...xs])
    if (existing) return
    // Tra cứu lần lượt, cách nhau một chút để lịch sự với các API mở.
    queue.current = queue.current.then(async () => {
      const r = await lookupIsbn(isbn)
      if (r?.draft.title) patch(key, { status: 'found', draft: r.draft, title: r.draft.title })
      else patch(key, { status: 'notfound', include: false })
      await new Promise((ok) => setTimeout(ok, 600))
    })
  }

  const counts = {
    total: items.length,
    exists: items.filter((x) => x.status === 'exists').length,
    found: items.filter((x) => x.status === 'found').length,
    notfound: items.filter((x) => x.status === 'notfound').length,
    checking: items.filter((x) => x.status === 'checking').length,
  }
  const toAdd = items.filter((x) => x.status !== 'exists' && x.status !== 'checking' && x.include && x.title.trim())
  const toMove = items.filter((x) => x.status === 'exists' && x.move)

  const save = async () => {
    setBusy(true)
    setError(null)
    const now = new Date().toISOString()
    const loc = shelf.trim()
    const added: Book[] = toAdd.map((x) =>
      JSON.parse(
        JSON.stringify({
          type: 'book',
          ...x.draft,
          id: ulid(),
          isbn13: x.isbn,
          title: x.title.trim(),
          holdings: [{ kind: 'print', location: loc || undefined, copies: x.copies }],
          status: 'owned',
          source: x.draft?.source ?? 'manual',
          createdAt: now,
          updatedAt: now,
        }),
      ) as Book,
    )
    const updated: Book[] = toMove.map((x) => {
      const b = x.existing!
      const i = b.holdings.findIndex((h) => h.kind === 'print')
      const holdings =
        i >= 0
          ? b.holdings.map((h, k) => (k === i && h.kind === 'print' ? { ...h, location: loc } : h))
          : [{ kind: 'print' as const, location: loc, copies: 1 }, ...b.holdings]
      return { ...b, holdings, updatedAt: now }
    })
    try {
      if (added.length) await addBooks(cfg, added, `Thêm ${added.length} sách${loc ? ` (kệ ${loc})` : ''}`)
      for (const b of updated) await updateBook(cfg, b)
      onDone(added, updated, loc)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (phase === 'setup')
    return (
      <form
        className="card scan"
        onSubmit={(e) => {
          e.preventDefault()
          setPhase('scan')
        }}
      >
        <div className="card-head">
          <img src={asset('cover/lent.webp')} alt="" />
          <div>
            <h2>Quét theo kệ</h2>
            <p className="muted">
              Chọn kệ đang đứng trước, rồi quét lần lượt từng cuốn. Quét xong cả kệ thì duyệt lại một lượt và
              lưu tất cả cùng lúc. Cuốn nào quét hai lần được tính là hai bản.
            </p>
          </div>
        </div>
        <label>
          Kệ
          <input list="dl-shelves" placeholder="T1-K2" value={shelf} onChange={(e) => setShelf(e.target.value)} required autoFocus />
        </label>
        <datalist id="dl-shelves">{locations.map((l) => <option key={l} value={l} />)}</datalist>
        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Hủy
          </button>
          <button type="submit">Bắt đầu quét</button>
        </div>
      </form>
    )

  return (
    <div className="card scan">
      <div className="shelf-bar">
        <div>
          <div className="muted small">Đang quét kệ</div>
          <div className="shelf-name">{shelf}</div>
        </div>
        <div className="tally">
          <span><b>{counts.total}</b> cuốn</span>
          <span className="t-new"><b>{counts.found + counts.notfound}</b> mới</span>
          <span className="t-old"><b>{counts.exists}</b> đã có</span>
        </div>
      </div>

      {phase === 'scan' && <Scanner onIsbn={onIsbn} hint="Quét lần lượt từng cuốn; nghe tiếng bíp là xong một cuốn" />}

      {phase === 'review' && (
        <p className="hint">
          Bỏ chọn những cuốn không muốn lưu. Cuốn chưa có dữ liệu trực tuyến cần gõ nhan đề mới lưu được; các
          thông tin khác bổ sung sau. Cuốn đã có ở kệ khác có thể chuyển sang kệ {shelf}.
        </p>
      )}

      <ul className="scan-list">
        {items.map((x) => (
          <li key={x.key} className={`scan-item s-${x.status}`}>
            {x.existing ? (
              <Cover book={x.existing} cfg={cfg} />
            ) : (
              <Cover
                cfg={cfg}
                book={{
                  id: x.key, type: 'book', title: x.title || x.isbn, holdings: [], status: 'owned',
                  createdAt: '', updatedAt: '', ...x.draft,
                }}
              />
            )}
            <div className="scan-body">
              <div className="scan-top">
                <span className={`pill p-${x.status}`}>{STATUS_TEXT[x.status]}</span>
                {x.copies > 1 && <span className="pill">{x.copies} bản</span>}
                <span className="muted small">ISBN {x.isbn}</span>
              </div>
              {x.status === 'notfound' && phase === 'review' ? (
                <input
                  placeholder="Gõ nhan đề để lưu"
                  value={x.title}
                  onChange={(e) => patch(x.key, { title: e.target.value, include: !!e.target.value.trim() })}
                />
              ) : (
                <div className="title">{x.title || (x.status === 'checking' ? '...' : 'Chưa có nhan đề')}</div>
              )}
              {x.draft && (
                <div className="meta">
                  {[x.draft.authors?.map(nameToString).join(', '), x.draft.publisher, x.draft.year].filter(Boolean).join(' · ')}
                </div>
              )}
              {x.existing && (
                <div className="meta">
                  {printLocation(x.existing) ? `Đang ghi ở kệ ${printLocation(x.existing)}` : 'Chưa ghi kệ'}
                </div>
              )}
              {phase === 'review' && x.status !== 'exists' && x.status !== 'checking' && (
                <label className="check">
                  <input type="checkbox" checked={x.include} disabled={!x.title.trim()} onChange={(e) => patch(x.key, { include: e.target.checked })} />
                  Lưu cuốn này
                </label>
              )}
              {phase === 'review' && x.existing && printLocation(x.existing) !== shelf.trim() && (
                <label className="check">
                  <input type="checkbox" checked={x.move} onChange={(e) => patch(x.key, { move: e.target.checked })} />
                  Chuyển sang kệ {shelf}
                </label>
              )}
            </div>
            <button
              type="button"
              className="link remove"
              aria-label="Bỏ khỏi danh sách"
              onClick={() => {
                seen.current.delete(x.isbn)
                setItems((xs) => xs.filter((y) => y.key !== x.key))
              }}
            >
              Bỏ
            </button>
          </li>
        ))}
      </ul>
      {!items.length && <p className="muted center">Chưa quét cuốn nào.</p>}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        {phase === 'scan' ? (
          <>
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" disabled={!items.length} onClick={() => setPhase('review')}>
              Xong kệ này, duyệt lại
            </button>
          </>
        ) : (
          <>
            <button type="button" className="secondary" disabled={busy} onClick={() => setPhase('scan')}>
              Quét thêm
            </button>
            <button type="button" disabled={busy || counts.checking > 0 || (!toAdd.length && !toMove.length)} onClick={() => void save()}>
              {busy
                ? 'Đang lưu...'
                : counts.checking
                  ? `Chờ tra cứu xong (${counts.checking})...`
                  : `Lưu ${toAdd.length} sách mới${toMove.length ? `, chuyển ${toMove.length} cuốn` : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
