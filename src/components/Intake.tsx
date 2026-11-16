// Trang con "Nhập sách" của Thống kê: nhịp bổ sung theo ngày, tuần, tháng, năm và phân tích từng đợt nhập.
import { useMemo, useState } from 'react'
import { nameToString, type Book } from '../types/book'
import {
  GRANS, analyze, gist, inPeriod, periodLabel, periodRange, prevPeriod, rangeFilter, sessionLabel, sessions, timeline,
  type Analysis, type Gran, type Session,
} from '../search/intake'
import { BarList, Columns, Tile, nf } from './charts'

const GRAN_KEY = 'pochacco.intakeGran'

type Nav = {
  onOpen: (b: Book) => void
  onCategory: (id: string) => void
  onPerson: (name: string) => void
  onSearch: (q: string) => void
  onAdded: (filter: string) => void
}

function BookList({ books, onOpen, limit = 12 }: { books: Book[]; onOpen: (b: Book) => void; limit?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? books : books.slice(0, limit)
  return (
    <>
      <ol className="session-books">
        {shown.map((b) => (
          <li key={b.id}>
            <button className="linkish" onClick={() => onOpen(b)}>{b.title}</button>
            <span className="muted small">
              {' '}
              {[(b.authors?.length ? b.authors : b.editors ?? []).map(nameToString).slice(0, 2).join(', '), b.year].filter(Boolean).join(', ')}
            </span>
          </li>
        ))}
      </ol>
      {books.length > limit && (
        <button className="link" onClick={() => setAll(!all)}>{all ? 'Thu gọn' : `Xem cả ${books.length} cuốn`}</button>
      )}
    </>
  )
}

function AnalysisView({ a, books, nav, prev }: { a: Analysis; books: Book[]; nav: Nav; prev?: number }) {
  const delta = prev === undefined ? null : a.n - prev
  return (
    <>
      <div className="tiles">
        <Tile label="Đầu sách" value={nf(a.n)} sub={delta === null ? undefined : delta === 0 ? 'bằng kỳ trước' : `${delta > 0 ? '+' : ''}${nf(delta)} so với kỳ trước`} />
        <Tile label="Số trang" value={a.pages ? nf(a.pages) : '—'} sub={a.n - a.missing.pages ? `${a.n - a.missing.pages}/${a.n} cuốn ghi số trang` : 'chưa ghi số trang'} />
        <Tile label="Danh mục mới" value={nf(a.fresh.cats.length)} sub={`${a.categories.length} danh mục được chạm tới`} />
        <Tile label="Tác giả mới" value={nf(a.fresh.persons.length)} sub={`${a.persons.length - a.fresh.persons.length} tác giả đã có sách`} />
      </div>

      {a.insights.length > 0 && (
        <div className="insights">
          <h4>Nhận xét</h4>
          <ul>{a.insights.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <div className="stats-grid">
        <div>
          <h4>Theo nhóm</h4>
          {a.groups.length ? <BarList rows={a.groups} total={a.n} /> : <p className="muted small">Chưa gắn danh mục.</p>}
        </div>
        <div>
          <h4>Danh mục nổi bật</h4>
          {a.categories.length ? <BarList rows={a.categories.slice(0, 8)} total={a.n} onPick={(r) => nav.onCategory(r.key)} tone="olive" /> : <p className="muted small">Chưa gắn danh mục.</p>}
        </div>
      </div>

      {a.links.length > 0 && (
        <>
          <h4>Liên kết với sách đã có</h4>
          <p className="muted small">Những mảng, tác giả, tùng thư đã có trong thư viện từ trước mà nhóm sách này bồi thêm. Bấm để xem toàn bộ.</p>
          <table className="link-table">
            <thead><tr><th>Mảng</th><th className="num">Đã có</th><th className="num">Thêm</th><th className="num">Nay</th></tr></thead>
            <tbody>
              {a.links.slice(0, 10).map((l) => (
                <tr
                  key={l.kind + l.key}
                  className="clickable"
                  onClick={() => (l.kind === 'cat' ? nav.onCategory(l.key) : l.kind === 'person' ? nav.onPerson(l.key) : nav.onSearch(l.key))}
                >
                  <td>{l.kind === 'cat' ? '' : l.kind === 'person' ? 'Tác giả ' : 'Tùng thư '}{l.label}</td>
                  <td className="num muted">{l.before}</td>
                  <td className="num">+{l.added}</td>
                  <td className="num"><b>{l.before + l.added}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(a.fresh.cats.length > 0 || a.fresh.pubs.length > 0) && (
        <>
          <h4>Lần đầu có trong thư viện</h4>
          {a.fresh.cats.length > 0 && (
            <div className="chips">
              <span className="muted small">Danh mục:</span>
              {a.fresh.cats.map((r) => <button key={r.key} className="chip-btn" onClick={() => nav.onCategory(r.key)}>{r.label}</button>)}
            </div>
          )}
          {a.fresh.pubs.length > 0 && (
            <div className="chips">
              <span className="muted small">Nhà xuất bản:</span>
              {a.fresh.pubs.slice(0, 12).map((r) => <button key={r.key} className="chip-btn" onClick={() => nav.onSearch(r.key)}>{r.label}</button>)}
            </div>
          )}
        </>
      )}

      {a.clusters.length > 0 && (
        <>
          <h4>Các cụm trong nhóm sách này</h4>
          <p className="muted small">Những cuốn cùng tác giả, cùng tùng thư hoặc cùng danh mục, nên đọc hoặc xếp kệ cạnh nhau.</p>
          {a.clusters.slice(0, 6).map((c) => (
            <div key={c.label} className="cluster">
              <b>{c.label}</b> <span className="muted small">({c.books.length} cuốn)</span>
              <div className="muted small">
                {c.books.slice(0, 6).map((b, i) => (
                  <span key={b.id}>{i ? ' · ' : ''}<button className="linkish" onClick={() => nav.onOpen(b)}>{b.title}</button></span>
                ))}
                {c.books.length > 6 ? ' …' : ''}
              </div>
            </div>
          ))}
        </>
      )}

      {a.decades.length > 1 && (
        <>
          <h4>Năm xuất bản</h4>
          <Columns rows={a.decades} />
        </>
      )}

      <h4>Danh sách</h4>
      <BookList books={books} onOpen={nav.onOpen} />
    </>
  )
}

function SessionItem({ s, all, nav }: { s: Session; all: Book[]; nav: Nav }) {
  const [open, setOpen] = useState(false)
  const a = useMemo(() => (open ? analyze(s.books, all) : null), [open, s, all])
  return (
    <div className="session">
      <div className="session-head">
        <div>
          <b>{sessionLabel(s)}</b> <span className="muted">· {nf(s.books.length)} cuốn</span>
          <div className="muted small">{gist(s.books) || 'Chưa gắn danh mục'}</div>
        </div>
        <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Thu gọn' : 'Phân tích đợt này'}</button>
      </div>
      {a && <AnalysisView a={a} books={s.books} nav={nav} />}
    </div>
  )
}

export default function Intake({ books: allBooks, ...nav }: { books: Book[] } & Nav) {
  const books = useMemo(() => allBooks.filter((b) => b.status !== 'wishlist'), [allBooks])
  const [gran, setGranState] = useState<Gran>(() => {
    try {
      const v = sessionStorage.getItem(GRAN_KEY)
      return (GRANS.some((g) => g.id === v) ? v : 'day') as Gran
    } catch {
      return 'day'
    }
  })
  const G = GRANS.find((g) => g.id === gran)!
  const rows = useMemo(() => timeline(books, gran, G.span), [books, gran, G.span])
  const lastWithData = [...rows].reverse().find((r) => r.count)?.key ?? rows.at(-1)?.key ?? null
  const [picked, setPicked] = useState<string | null>(null)
  const sel = picked && rows.some((r) => r.key === picked) ? picked : lastWithData
  const setGran = (g: Gran) => {
    setGranState(g)
    setPicked(null)
    try { sessionStorage.setItem(GRAN_KEY, g) } catch { /* bỏ qua */ }
  }

  const set = useMemo(() => (sel ? books.filter(inPeriod(sel, gran)) : []), [books, sel, gran])
  const prevN = useMemo(() => (sel ? books.filter(inPeriod(prevPeriod(sel, gran), gran)).length : 0), [books, sel, gran])
  const a = useMemo(() => analyze(set, books), [set, books])
  const ss = useMemo(() => sessions(set), [set])

  const nonEmpty = rows.filter((r) => r.count)
  const total = rows.reduce((s, r) => s + r.count, 0)
  const peak = [...rows].sort((x, y) => y.count - x.count)[0]
  const idx = sel ? rows.findIndex((r) => r.key === sel) : -1
  const go = (d: number) => {
    const r = rows[idx + d]
    if (r) setPicked(r.key)
  }

  if (!rows.length)
    return (
      <section className="card">
        <h3>Nhịp nhập sách</h3>
        <p className="muted">Chưa có sách nào ghi ngày nhập.</p>
      </section>
    )

  return (
    <>
      <section className="card">
        <div className="intake-head">
          <h3>Nhịp nhập sách</h3>
          <nav className="subtabs" aria-label="Gom theo">
            {GRANS.map((g) => (
              <button key={g.id} className={`subtab${gran === g.id ? ' active' : ''}`} aria-pressed={gran === g.id} onClick={() => setGran(g.id)}>
                {g.label}
              </button>
            ))}
          </nav>
        </div>
        <p className="muted small">
          {nf(total)} cuốn trong {rows.length} {G.unit} gần nhất, {nonEmpty.length} {G.unit} có nhập sách
          {nonEmpty.length ? `, trung bình ${nf(Math.round(total / nonEmpty.length))} cuốn mỗi ${G.unit} có nhập` : ''}
          {peak?.count ? `; nhiều nhất ${periodLabel(peak.key, gran).toLowerCase()} với ${nf(peak.count)} cuốn` : ''}. Bấm một cột để phân tích {G.unit} đó.
        </p>
        <Columns rows={rows} active={sel ?? undefined} onPick={(r) => setPicked(r.key)} />
      </section>

      {sel && (
        <section className="card">
          <div className="intake-head">
            <h3>{periodLabel(sel, gran)}</h3>
            <div className="intake-nav">
              <button className="link" disabled={idx <= 0} onClick={() => go(-1)} aria-label={`${G.label} trước`}>‹ Trước</button>
              <button className="link" disabled={idx >= rows.length - 1} onClick={() => go(1)} aria-label={`${G.label} sau`}>Sau ›</button>
              {set.length > 0 && <button className="link" onClick={() => nav.onAdded(rangeFilter(periodRange(sel, gran)))}>Xem trong danh sách</button>}
            </div>
          </div>
          {set.length ? (
            <AnalysisView a={a} books={set} nav={nav} prev={prevN} />
          ) : (
            <p className="muted">Không nhập cuốn nào trong {G.unit} này.</p>
          )}
        </section>
      )}

      {ss.length > 0 && (
        <section className="card">
          <h3>Các đợt nhập ({ss.length})</h3>
          <p className="muted small">
            Một đợt là một lượt thêm nhiều cuốn cùng lúc, hoặc chuỗi cuốn thêm lẻ cách nhau không quá 20 phút. Mở từng đợt để xem đợt đó bồi thêm vào mảng nào và có cụm sách nào bên trong.
          </p>
          {ss.map((s) => <SessionItem key={s.id} s={s} all={books} nav={nav} />)}
        </section>
      )}
    </>
  )
}
