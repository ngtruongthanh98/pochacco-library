import { lazy, Suspense, useMemo, useState } from 'react'
import { computeStats, duplicatePrintBooks, type Row } from '../search/stats'
import { bindingLabel, nameToString, type Book } from '../types/book'
import StatsDeep from './StatsDeep'
import Spending from './Spending'
import Intake from './Intake'
import { BarList, Columns, DataTable, Donut, Growth, HeatGrid, OTHER, SERIES, StackBar, Tile, Treemap, foldOther, nf, pct } from './charts'
import type { Stats as StatsData } from '../search/stats'
import { formatOf } from '../data/format'
import { printCount } from '../data/printCopies'

const LibraryTrees = lazy(() => import('./LibraryTrees'))

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

function TopTable({
  title,
  rows,
  onPick,
  empty,
}: {
  title: string
  rows: Row[]
  onPick: (r: Row) => void
  empty: string
}) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 10)
  return (
    <div className="top-table">
      <h4>{title}</h4>
      {rows.length ? (
        <>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Tên</th>
                <th className="num">Cuốn</th>
                <th className="num">Trang</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.key} onClick={() => onPick(r)} className="clickable">
                  <td className="num muted">{i + 1}</td>
                  <td>{r.label}</td>
                  <td className="num">{r.count}</td>
                  <td className="num muted">{r.pages ? nf(r.pages) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <button className="link" onClick={() => setAll(!all)}>
              {all ? 'Thu gọn' : `Xem cả ${rows.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="muted small">{empty}</p>
      )}
    </div>
  )
}

type PubSort = 'count' | 'pages' | 'year' | 'translated' | 'label'
function PublisherTable({ rows, onPick }: { rows: StatsData['pubProfiles']; onPick: (label: string) => void }) {
  const [sort, setSort] = useState<PubSort>('count')
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  const sorted = useMemo(() => {
    const k: Record<PubSort, (r: StatsData['pubProfiles'][number]) => number | string> = {
      count: (r) => -r.count,
      pages: (r) => -r.pages,
      year: (r) => -(r.maxYear ?? 0),
      translated: (r) => -(r.translated / r.count),
      label: (r) => r.label,
    }
    const f = k[sort]
    const ql = q.trim().toLowerCase()
    return rows
      .filter((r) => !ql || r.label.toLowerCase().includes(ql))
      .sort((a, b) => {
        const x = f(a), y = f(b)
        return typeof x === 'string' ? x.localeCompare(y as string, 'vi') : x - (y as number) || b.count - a.count
      })
  }, [rows, sort, q])
  const max = Math.max(1, ...rows.map((r) => r.count))
  const shown = all || q ? sorted : sorted.slice(0, 15)
  const th = (k: PubSort, children: string, num?: boolean) => (
    <th className={num ? 'num' : undefined} aria-sort={sort === k ? 'descending' : undefined}>
      <button className={`th-sort${sort === k ? ' on' : ''}`} onClick={() => setSort(k)}>
        {children}
        {sort === k && ' ▾'}
      </button>
    </th>
  )
  return (
    <>
      <div className="author-filters">
        <input type="search" placeholder="Lọc nhà xuất bản…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lọc nhà xuất bản" />
      </div>
      <div className="table-scroll">
        <table className="cat-table">
          <thead>
            <tr>
              {th('label', 'Nhà xuất bản')}
              {th('count', 'Cuốn', true)}
              {th('pages', 'Trang', true)}
              {th('year', 'Năm in', true)}
              <th>Mảng chính</th>
              {th('translated', 'Sách dịch', true)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="clickable" onClick={() => onPick(r.label)}>
                <td><b>{r.label}</b></td>
                <td className="num">
                  {r.count}
                  <span className="cell-bar" style={{ width: `${(r.count / max) * 100}%` }} />
                </td>
                <td className="num">{r.pages ? nf(r.pages) : '–'}</td>
                <td className="num small">{r.minYear ? (r.minYear === r.maxYear ? r.minYear : `${r.minYear}–${r.maxYear}`) : '–'}</td>
                <td className="small">
                  {r.mainGroup ?? <span className="muted">–</span>}
                  {r.mainGroup && r.count > 1 && <span className="muted"> {Math.round(r.mainShare * 100)}%</span>}
                </td>
                <td className="num">{pct(r.translated, r.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!q && sorted.length > 15 && (
        <button className="link" onClick={() => setAll(!all)}>
          {all ? 'Thu gọn' : `Xem cả ${sorted.length} nhà xuất bản`}
        </button>
      )}
    </>
  )
}

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'duplicates', label: 'Bản trùng' },
  { id: 'relationships', label: 'Sơ đồ thư viện' },
  { id: 'topics', label: 'Thể loại' },
  { id: 'people', label: 'Tác giả & NXB' },
  { id: 'time', label: 'Thời gian' },
  { id: 'intake', label: 'Nhập sách' },
  { id: 'shelf', label: 'Kệ & hình thức' },
  { id: 'money', label: 'Chi tiêu' },
  { id: 'data', label: 'Chất lượng dữ liệu' },
] as const
type Tab = (typeof TABS)[number]['id']
const TAB_KEY = 'pochacco.statsTab'
const SCOPE_KEY = 'pochacco.statsScope'
/** Phạm vi thống kê: cả thư viện, chỉ những cuốn có bản giấy, hoặc chỉ những cuốn có bản điện tử */
const SCOPES = [
  { id: 'print', label: 'Sách giấy', hint: 'Những cuốn có bản giấy trên kệ, kể cả cuốn có thêm bản điện tử.' },
  { id: 'all', label: 'Cả thư viện', hint: 'Gộp sách giấy và sách chỉ có bản điện tử.' },
  { id: 'ebook', label: 'Sách điện tử', hint: 'Những cuốn có bản điện tử, kể cả cuốn có thêm bản giấy.' },
] as const
type Scope = (typeof SCOPES)[number]['id']
const inScope = (sc: Scope) => (b: Book) => {
  if (sc === 'all' || b.status === 'wishlist') return true
  const f = formatOf(b)
  return sc === 'print' ? f === 'print' || f === 'both' : f === 'ebook' || f === 'both'
}
const FORMAT_COLORS: Record<string, string> = {
  paperback: SERIES[0], hardcover: SERIES[1], jacket: SERIES[6], special: SERIES[4], unknown: OTHER, 'ebook-only': SERIES[2],
}

export default function Stats({
  books: allBooks,
  onSearch,
  onGroup,
  onCategory,
  onOpen,
  onPerson,
  onAdded,
}: {
  books: Book[]
  onAdded: (filter: string) => void
  onPerson: (name: string) => void
  onSearch: (q: string) => void
  onGroup: (i: number) => void
  onCategory: (id: string) => void
  onOpen: (b: Book) => void
}) {
  const [scope, setScopeState] = useState<Scope>(() => {
    try {
      const v = sessionStorage.getItem(SCOPE_KEY)
      return (SCOPES.some((x) => x.id === v) ? v : 'print') as Scope
    } catch {
      return 'print'
    }
  })
  const setScope = (v: Scope) => {
    setScopeState(v)
    try { sessionStorage.setItem(SCOPE_KEY, v) } catch { /* bỏ qua */ }
  }
  const mix = useMemo(() => {
    const m = { print: 0, both: 0, ebook: 0, copies: 0 }
    for (const b of allBooks) {
      if (b.status === 'wishlist') continue
      const f = formatOf(b)
      if (f === 'print' || f === 'both' || f === 'ebook') m[f]++
      for (const h of b.holdings) if (h.kind === 'print') m.copies += h.copies ?? 1
    }
    return m
  }, [allBooks])
  const books = useMemo(() => (scope === 'all' ? allBooks : allBooks.filter(inScope(scope))), [allBooks, scope])
  const s = useMemo(() => computeStats(books), [books])
  const t = s.totals
  const duplicates = useMemo(() => duplicatePrintBooks(books), [books])
  const extraCopies = duplicates.reduce((sum, group) => sum + group.copies - 1, 0)
  const [showAllMissing, setShowAllMissing] = useState(false)
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const v = sessionStorage.getItem(TAB_KEY)
      return (TABS.some((x) => x.id === v) ? v : 'overview') as Tab
    } catch {
      return 'overview'
    }
  })
  const setTab = (v: Tab) => {
    setTabState(v)
    try { sessionStorage.setItem(TAB_KEY, v) } catch { /* bỏ qua */ }
  }

  // Màu theo nhóm: 7 nhóm nhiều sách nhất có màu riêng, còn lại xám; dùng chung cho vành khuyên và ô vuông.
  const groupColor = useMemo(() => {
    const order = [...s.groups].filter((g) => g.count).sort((a, b) => b.count - a.count)
    const m = new Map<string, string>()
    order.forEach((g, i) => m.set(g.key, i < SERIES.length ? SERIES[i] : OTHER))
    return (key: string) => m.get(key) ?? OTHER
  }, [s.groups])
  const groupRows = useMemo(() => {
    const order = [...s.groups].filter((g) => g.count).sort((a, b) => b.count - a.count)
    const top = order.slice(0, SERIES.length)
    const rest = order.slice(SERIES.length)
    return rest.length ? [...top, { key: '__other', label: `Các nhóm khác (${rest.length})`, count: rest.reduce((a, r) => a + r.count, 0) }] : top
  }, [s.groups])
  const growthAll = s.growth
  const daysSpan = growthAll.length ? Math.round((Date.parse(growthAll.at(-1)!.date) - Date.parse(growthAll[0].date)) / 86400000) : 0
  const busiest = [...growthAll].sort((a, b) => b.added - a.added)[0]

  if (!allBooks.length)
    return (
      <div className="card empty">
        <img src={asset('empty-shelf.webp')} alt="" />
        <div className="state-title">Chưa có số liệu</div>
        <div className="muted">Thêm vài cuốn sách là trang thống kê sẽ có nội dung.</div>
      </div>
    )

  return (
    <div className="stats">
      <section className="card stats-head">
        <h2>Thống kê {tab === 'relationships' ? 'thư viện' : scope === 'print' ? 'sách giấy' : scope === 'ebook' ? 'sách điện tử' : 'thư viện'}</h2>
        {tab !== 'relationships' && <>
          <div className="scope-bar">
            <nav className="subtabs" aria-label="Phạm vi thống kê">
              {SCOPES.map((x) => (
                <button key={x.id} className={`subtab${scope === x.id ? ' active' : ''}`} aria-pressed={scope === x.id} onClick={() => setScope(x.id)} title={x.hint}>
                  {x.label}
                  <span className="count">{nf(x.id === 'print' ? mix.print + mix.both : x.id === 'ebook' ? mix.ebook + mix.both : mix.print + mix.both + mix.ebook)}</span>
                </button>
              ))}
            </nav>
            <div className="scope-mix" role="img" aria-label={`${mix.print} cuốn chỉ có bản giấy, ${mix.both} cuốn có cả hai, ${mix.ebook} cuốn chỉ có bản điện tử`}>
              {([['print', 'Chỉ bản giấy', SERIES[0]], ['both', 'Có cả hai', SERIES[2]], ['ebook', 'Chỉ bản điện tử', SERIES[3]]] as const).map(([k, label, c]) => (
                <div key={k} className="scope-seg" style={{ flexGrow: mix[k] || 0.0001, background: c }} title={`${label}: ${nf(mix[k])} cuốn`} />
              ))}
            </div>
            <p className="muted small">
              {nf(mix.print)} cuốn chỉ có bản giấy, {nf(mix.both)} cuốn có cả bản giấy và bản điện tử, {nf(mix.ebook)} cuốn chỉ có bản điện tử; tổng {nf(mix.copies)} bản giấy trên kệ.{' '}
              {SCOPES.find((x) => x.id === scope)!.hint} Mọi số liệu bên dưới tính theo phạm vi này.
            </p>
          </div>
          <div className="tiles">
            <Tile label="Đầu sách" value={nf(t.titles)} sub={scope === 'ebook' ? `${nf(mix.ebook)} cuốn chỉ có bản điện tử` : `${nf(t.copies)} bản giấy${extraCopies ? `, ${nf(extraCopies)} bản trùng` : ''}`} />
            <Tile label="Tổng số trang" value={nf(t.pages)} sub={t.medianPages ? `trung vị ${t.medianPages} trang/cuốn` : undefined} />
            <Tile label="Tác giả, dịch giả" value={nf(t.people)} sub={`${nf(t.publishers)} nhà xuất bản`} />
            <Tile label="Sách dịch" value={pct(t.translated, t.titles)} sub={`${t.translated} cuốn`} ring={t.titles ? t.translated / t.titles : 0} />
            {scope === 'ebook' ? (
              <Tile label="Có cả bản giấy" value={nf(mix.both)} sub={pct(mix.both, t.titles)} ring={t.titles ? mix.both / t.titles : 0} />
            ) : (
              <Tile label={scope === 'print' ? 'Có thêm bản điện tử' : 'Có bản điện tử'} value={nf(t.ebooks)} sub={pct(t.ebooks, t.titles)} ring={t.titles ? t.ebooks / t.titles : 0} />
            )}
            <Tile label="Đủ thông tin" value={pct(t.complete, t.titles)} sub={`${t.titles - t.complete} cuốn cần bổ sung`} ring={t.titles ? t.complete / t.titles : 0} />
          </div>
        </>}
        <nav className="subtabs stats-tabs" aria-label="Mục thống kê">
          {TABS.map((x) => (
            <button key={x.id} className={`subtab${tab === x.id ? ' active' : ''}`} onClick={() => setTab(x.id)} aria-current={tab === x.id ? 'page' : undefined}>
              {x.label}
              {x.id === 'duplicates' && <span className="count">{nf(duplicates.length)}</span>}
            </button>
          ))}
        </nav>
      </section>

      {tab === 'relationships' && (
        <Suspense fallback={<div className="card" role="status">Đang tải sơ đồ thư viện…</div>}>
          <LibraryTrees books={allBooks} onOpen={onOpen} />
        </Suspense>
      )}


      {tab === 'duplicates' && (
        <section className="card">
          <h3>Sách có nhiều bản giấy</h3>
          <p className="muted small">
            Gồm các đầu sách có từ hai bản giấy đang sở hữu hoặc đang cho mượn, kể cả các ấn bản khác nhau của cùng tác phẩm.
          </p>
          {duplicates.length ? (
            <>
              <p>{nf(duplicates.length)} đầu sách · {nf(extraCopies)} bản giấy ngoài bản đầu tiên</p>
              <table className="needs">
                <thead>
                  <tr>
                    <th scope="col">Đầu sách và các bản ghi</th>
                    <th scope="col">Số bản giấy</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map(({ records, copies }) => {
                    const first = records[0].book
                    return (
                      <tr key={first.id}>
                        <td>
                          {records.map(({ book, holdings }) => (
                            <div key={book.id}>
                              <button className="linkish" onClick={() => onOpen(book)}>{book.title}</button>
                              {book.subtitle && <div className="muted small">{book.subtitle}</div>}
                              <div className="muted small">
                                {[
                                  (book.authors ?? book.editors ?? []).map(nameToString).join(', '),
                                  book.publisher, book.year,
                                  book.status === 'lent' ? 'Đang cho mượn' : undefined,
                                ].filter(Boolean).join(' · ')}
                              </div>
                              <div className="muted small">
                                {holdings.map((holding) => [
                                  `${nf(printCount(holding))} bản`,
                                  bindingLabel(holding.binding),
                                  holding.location,
                                ].filter(Boolean).join(' · ')).join(' / ')}
                              </div>
                            </div>
                          ))}
                        </td>
                        <td className="num">{nf(copies)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Chưa có đầu sách nào có nhiều bản giấy trong phạm vi này.</p>
          )}
        </section>
      )}

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            <section className="card">
              <h3>Cơ cấu theo nhóm</h3>
              <p className="muted small">Một cuốn có thể thuộc nhiều nhóm nên tỷ lệ tính trên tổng số lượt gắn nhóm. Bấm để xem sách.</p>
              <Donut
                rows={groupRows}
                center="lượt gắn"
                colors={(r) => (r.key === '__other' ? OTHER : groupColor(r.key))}
                onPick={(r) => onGroup(Number(r.key))}
              />
            </section>
            <section className="card">
              <h3>Ngôn ngữ</h3>
              <Donut rows={foldOther(s.languages, 5)} total={t.titles} />
              <p className="muted small">
                Sách dịch: {t.translated} cuốn ({pct(t.translated, t.titles)}).
              </p>
            </section>
          </div>
          <section className="card">
            <h3>Thư viện lớn lên thế nào</h3>
            <p className="muted small">
              Số đầu sách cộng dồn theo ngày nhập vào ứng dụng
              {daysSpan ? `, trong ${nf(daysSpan)} ngày` : ''}
              {busiest ? `; đợt nhập lớn nhất ngày ${busiest.date.split('-').reverse().join('/')} với ${busiest.added} cuốn` : ''}. Rê chuột để xem từng ngày.
            </p>
            <Growth points={growthAll} />
          </section>
          {s.insights.length > 0 && (
            <section className="card">
              <div className="insights">
                <h3>Nhận xét nhanh</h3>
                <ul>
                  {s.insights.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <StatsDeep books={books} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} parts={['insights']} />
        </>
      )}

      {tab === 'topics' && (
        <>
          <section className="card">
            <h3>Bản đồ thể loại</h3>
            <p className="muted small">
              Mỗi khung là một nhóm, mỗi ô là một danh mục; diện tích tỷ lệ với số cuốn. Bấm tên nhóm hoặc một ô để xem sách. Ô nhỏ không ghi chữ, rê chuột để xem.
            </p>
            <Treemap
              tree={s.catTree}
              colorOf={(g) => groupColor(g.key)}
              onGroup={(g) => onGroup(Number(g.key))}
              onLeaf={(r) => onCategory(r.key)}
            />
          </section>
          <section className="card">
            <h3>Theo nhóm danh mục</h3>
            <p className="muted small">
              Một cuốn có thể thuộc nhiều nhóm nên tổng có thể lớn hơn số đầu sách. Bấm vào một nhóm để xem sách.
            </p>
            <BarList
              rows={[...s.groups, ...(s.noCat ? [{ key: 'none', label: 'Chưa gắn danh mục', count: s.noCat }] : [])]}
              total={t.titles}
              onPick={(r) => (r.key === 'none' ? undefined : onGroup(Number(r.key)))}
            />
            <DataTable rows={s.groups} total={t.titles} unit="cuốn" />
          </section>
          <section className="card">
            <h3>Theo danh mục chi tiết</h3>
            {s.categories.length ? (
              <>
                <BarList rows={s.categories.slice(0, 15)} total={t.titles} onPick={(r) => onCategory(r.key)} />
                {s.categories.length > 15 && <p className="muted small">Hiện 15 danh mục nhiều sách nhất; bảng bên dưới có đủ.</p>}
                <DataTable
                  rows={s.categories.map((r) => ({ ...r, label: `${r.label} (${s.categoryGroup(r.key)})` }))}
                  total={t.titles}
                  unit="cuốn"
                />
              </>
            ) : (
              <p className="muted">Chưa có cuốn nào được gắn danh mục.</p>
            )}
          </section>
          <StatsDeep books={books} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} parts={['cats', 'heat']} />
        </>
      )}

      {tab === 'people' && (
        <>
          <StatsDeep books={books} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} parts={['authors']} />
          <section className="card">
            <h3>Phân tích theo nhà xuất bản</h3>
            <p className="muted small">Bấm tên cột để sắp xếp, bấm một dòng để xem sách của nhà xuất bản đó. "Mảng chính" là nhóm danh mục chiếm nhiều sách nhất.</p>
            <div className="stats-grid">
              <div>
                <h4>Mười nhà xuất bản nhiều sách nhất</h4>
                <BarList rows={s.publishers.slice(0, 10)} total={t.titles} onPick={(r) => onSearch(r.label)} tone="olive" />
              </div>
              <div>
                <h4>Tỷ trọng</h4>
                <Donut rows={foldOther(s.publishers, 6)} total={t.titles} />
              </div>
            </div>
            <PublisherTable rows={s.pubProfiles} onPick={onSearch} />
          </section>
          <section className="card">
            <h3>Dịch giả, đơn vị liên kết, tùng thư</h3>
            <p className="muted small">Bấm một dòng để xem các sách tương ứng.</p>
            <div className="top-grid">
              <TopTable title="Dịch giả" rows={s.translators} onPick={(r) => onPerson(r.label)} empty="Chưa có sách dịch ghi dịch giả." />
              <TopTable title="Đơn vị liên kết" rows={s.partners} onPick={(r) => onSearch(r.label)} empty="Chưa ghi đơn vị liên kết." />
              {s.series.length > 0 && <TopTable title="Tùng thư" rows={s.series} onPick={(r) => onSearch(r.label)} empty="" />}
            </div>
          </section>
        </>
      )}

      {tab === 'time' && (
        <>
          <section className="card">
            <h3>Năm xuất bản theo thập niên</h3>
            <p className="muted small">Mỗi cột là một thập niên, ví dụ 2010 là các năm 2010–2019.</p>
            {s.decades.length ? (
              <>
                <Columns rows={s.decades} />
                <p className="muted small">
                  {t.oldest && `Cũ nhất: ${t.oldest.title} (${t.oldest.year}). `}
                  {t.newest && `Mới nhất: ${t.newest.title} (${t.newest.year}).`}
                </p>
                <DataTable rows={s.decades} total={s.decades.reduce((a, r) => a + r.count, 0)} unit="cuốn" />
              </>
            ) : (
              <p className="muted">Chưa có cuốn nào ghi năm xuất bản.</p>
            )}
          </section>
          <StatsDeep books={books} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} parts={['heat']} />
          <section className="card">
            <h3>Thư viện lớn lên thế nào</h3>
            <Growth points={growthAll} />
          </section>
          <section className="card">
            <h3>Nhịp bổ sung 12 tháng qua</h3>
            <Columns rows={s.months} />
            <p className="muted small">Số đầu sách được thêm vào ứng dụng mỗi tháng (nhãn là số tháng, kèm năm ở tháng đầu và tháng 1), tính cả sách muốn mua.</p>
            <DataTable rows={s.months} total={s.months.reduce((a, r) => a + r.count, 0)} unit="cuốn" />
          </section>
        </>
      )}

      {tab === 'shelf' && (
        <>
          <section className="card">
            <h3>Hình thức sách</h3>
            <p className="muted small">Loại bìa của bản giấy; sách chỉ có bản điện tử tính riêng.</p>
            <StackBar rows={s.formats} colors={FORMAT_COLORS} />
            <DataTable rows={s.formats} total={t.titles} unit="cuốn" />
          </section>
          <div className="stats-grid">
            <section className="card">
              <h3>Độ dày sách</h3>
              {t.pagesKnown ? (
                <>
                  <Columns rows={s.pageBins} />
                  <h4>Dày nhất</h4>
                  <ol className="mini-list">
                    {s.longest.map((b) => (
                      <li key={b.id}>
                        <button className="linkish" onClick={() => onOpen(b)}>
                          {b.title}
                        </button>{' '}
                        <span className="muted">{nf(b.pages!)} trang</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="muted">Chưa có cuốn nào ghi số trang.</p>
              )}
            </section>
            <section className="card">
              <h3>Tình trạng</h3>
              <Donut
                rows={s.status.filter((r) => r.count)}
                total={books.length}
                colors={(r) => ({ owned: '#4f7a2b', lent: '#d18a1c', lost: '#8f1f1b', wishlist: '#e9a93b' })[r.key] ?? OTHER}
              />
              <p className="muted small">Sách "muốn mua" chưa nằm trên kệ nên không tính vào các số liệu khác của trang.</p>
            </section>
          </div>
          <section className="card">
            <h3>Theo kệ</h3>
            <BarList
              rows={s.shelves.map((r) => ({ ...r, label: r.key ? `Kệ ${r.label}` : r.label }))}
              total={t.titles}
              onPick={(r) => r.key && onSearch(r.key)}
            />
            <DataTable rows={s.shelves.map((r) => ({ ...r, label: r.key ? `Kệ ${r.label} (${r.extra} bản)` : r.label }))} total={t.titles} unit="đầu sách" />
          </section>
        </>
      )}

      {tab === 'intake' && <Intake books={books} onOpen={onOpen} onCategory={onCategory} onPerson={onPerson} onSearch={onSearch} onAdded={onAdded} />}

      {tab === 'money' && <Spending books={books} onOpen={onOpen} onSearch={onSearch} />}

      {tab === 'data' && (
        <>
          <section className="card">
            <h3>Độ đầy đủ của dữ liệu</h3>
            <p className="muted small">
              Tỷ lệ đầu sách đã có từng loại thông tin. Thông tin càng đủ thì tìm kiếm, gợi ý sách liên quan và trích dẫn càng chính xác.
            </p>
            <BarList rows={s.completeness} total={t.titles} max={t.titles} tone="olive" />
          </section>
          {s.completenessByGroup.rows.length > 0 && (
            <section className="card">
              <h3>Độ đầy đủ theo nhóm</h3>
              <p className="muted small">Mỗi ô là tỷ lệ sách trong nhóm đã có trường đó; ô nhạt là chỗ nên bổ sung trước.</p>
              <HeatGrid
                cols={s.completenessByGroup.cols}
                rows={s.completenessByGroup.rows.map((r) => ({ ...r, sub: `${r.n} cuốn` }))}
                max={1}
                tone="olive"
                rowHead="Nhóm"
                fmt={(v) => `${Math.round(v * 100)}%`}
                title={(r, c, v) => `${r}: ${Math.round(v * 100)}% đã có ${c.toLowerCase()}`}
              />
            </section>
          )}
          {s.needsWork.length > 0 && (
            <section className="card">
              <h3>Cần bổ sung ({s.needsWork.length} cuốn)</h3>
              <table className="needs">
                <thead>
                  <tr>
                    <th>Sách</th>
                    <th>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllMissing ? s.needsWork : s.needsWork.slice(0, 15)).map(({ book, missing }) => (
                    <tr key={book.id} className="clickable" onClick={() => onOpen(book)}>
                      <td>
                        <b>{book.title}</b>
                        <div className="muted small">{(book.authors ?? []).map(nameToString).join(', ')}</div>
                      </td>
                      <td>{missing.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.needsWork.length > 15 && (
                <button className="link" onClick={() => setShowAllMissing(!showAllMissing)}>
                  {showAllMissing ? 'Thu gọn' : `Xem cả ${s.needsWork.length} cuốn`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
