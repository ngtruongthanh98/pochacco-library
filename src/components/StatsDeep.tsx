import { Fragment, useMemo, useState } from 'react'
import { deepAnalysis, type CatProfile, type Insight } from '../search/insights'
import { foldVi } from '../search/normalizeVi'
import { ROLE_LABEL, type Role } from '../search/people'
import type { Book } from '../types/book'
import { BarList, Columns, Tile, nf, pct } from './charts'

const KIND: Record<Insight['kind'], string> = { focus: 'Trọng tâm', link: 'Liên kết', gap: 'Khoảng trống', fix: 'Cần chỉnh' }

type CatSort = 'count' | 'people' | 'year' | 'translated' | 'pages' | 'label'
const span = (a?: number, b?: number) => (a ? (a === b ? `${a}` : `${a}–${b}`) : '')

function CatDetail({ c, total, onCategory, onPerson, onOpen }: { c: CatProfile; total: number; onCategory: (id: string) => void; onPerson: (n: string) => void; onOpen: (b: Book) => void }) {
  const newest = [...c.books].filter((b) => b.year).sort((a, b) => b.year! - a.year!).slice(0, 5)
  return (
    <div className="cat-detail">
      <div className="cat-detail-head">
        <div>
          <h4>{c.label}</h4>
          <div className="muted small">Nhóm {c.group}</div>
        </div>
        <button className="secondary" onClick={() => onCategory(c.id)}>
          Xem {c.count} cuốn
        </button>
      </div>
      <div className="tiles small-tiles">
        <Tile label="Đầu sách" value={nf(c.count)} sub={`${pct(c.count, total)} thư viện`} />
        <Tile label="Số trang" value={nf(c.pages)} sub={c.count ? `${nf(Math.round(c.pages / c.count))} trang/cuốn` : undefined} />
        <Tile label="Người viết, dịch" value={nf(c.peopleCount)} sub={`${c.authors.length} tác giả`} />
        <Tile label="Năm in" value={c.medianYear ? String(c.medianYear) : '–'} sub={c.minYear ? `trung vị; từ ${span(c.minYear, c.maxYear)}` : 'chưa ghi năm'} />
        <Tile label="Sách dịch" value={pct(c.translated, c.count)} sub={`${c.translated} cuốn`} />
      </div>
      <div className="cat-detail-grid">
        <div>
          <h5>Tác giả trong mảng này</h5>
          {c.authors.length ? (
            <BarList rows={c.authors.slice(0, 8)} total={c.count} onPick={(r) => onPerson(r.label)} />
          ) : (
            <p className="muted small">Chưa ghi tác giả.</p>
          )}
        </div>
        <div>
          <h5>Năm xuất bản theo thập niên</h5>
          {c.decades.length ? <Columns rows={c.decades} /> : <p className="muted small">Chưa có năm xuất bản.</p>}
        </div>
        <div>
          <h5>Nhà xuất bản</h5>
          {c.publishers.length ? <BarList rows={c.publishers.slice(0, 6)} total={c.count} tone="olive" /> : <p className="muted small">Chưa ghi.</p>}
          {c.languages.length > 1 && (
            <p className="muted small">Ngôn ngữ: {c.languages.map((l) => `${l.label} ${l.count}`).join(', ')}.</p>
          )}
        </div>
        <div>
          {c.related.length > 0 && (
            <>
              <h5>Hay đi cùng thể loại</h5>
              <div className="chips">
                {c.related.slice(0, 6).map((r) => (
                  <button key={r.key} className="chip" onClick={() => onCategory(r.key)}>
                    {r.label} <small>{r.count}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {newest.length > 0 && (
            <>
              <h5>In gần đây nhất</h5>
              <ol className="mini-list">
                {newest.map((b) => (
                  <li key={b.id}>
                    <button className="linkish" onClick={() => onOpen(b)}>
                      {b.title}
                    </button>{' '}
                    <span className="muted">{b.year}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StatsDeep({
  books,
  onCategory,
  onPerson,
  onOpen,
}: {
  books: Book[]
  onCategory: (id: string) => void
  onPerson: (name: string) => void
  onOpen: (b: Book) => void
}) {
  const d = useMemo(() => deepAnalysis(books), [books])
  const total = books.filter((b) => b.status !== 'wishlist').length
  const [catSort, setCatSort] = useState<CatSort>('count')
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [aq, setAq] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [allAuthors, setAllAuthors] = useState(false)

  const cats = useMemo(() => {
    const k: Record<CatSort, (c: CatProfile) => number | string> = {
      count: (c) => -c.count,
      people: (c) => -c.peopleCount,
      year: (c) => c.medianYear ?? 9999,
      translated: (c) => -(c.count ? c.translated / c.count : 0),
      pages: (c) => -(c.count ? c.pages / c.count : 0),
      label: (c) => c.label,
    }
    const f = k[catSort]
    return [...d.cats].sort((a, b) => {
      const x = f(a), y = f(b)
      return typeof x === 'string' ? x.localeCompare(y as string, 'vi') : x - (y as number) || b.count - a.count
    })
  }, [d.cats, catSort])

  const authors = useMemo(() => {
    const q = foldVi(aq.trim())
    return d.authors.filter((a) => (!role || a.person.roles[role].length) && (!q || a.person.variants.some((v) => foldVi(v).includes(q))))
  }, [d.authors, aq, role])
  const shownAuthors = allAuthors || aq ? authors : authors.slice(0, 15)

  const Th = ({ k, children, num }: { k: CatSort; children: string; num?: boolean }) => (
    <th className={num ? 'num' : undefined} aria-sort={catSort === k ? 'descending' : undefined}>
      <button className={`th-sort${catSort === k ? ' on' : ''}`} onClick={() => setCatSort(k)}>
        {children}
        {catSort === k && ' ▾'}
      </button>
    </th>
  )

  return (
    <>
      {d.insights.length > 0 && (
        <section className="card">
          <h3>Insight từ thư viện</h3>
          <p className="muted small">Rút ra từ việc đối chiếu thể loại, tác giả, năm in và ngôn ngữ.</p>
          <ul className="deep-insights">
            {d.insights.map((x) => (
              <li key={x.text} className={`di-${x.kind}`}>
                <span className="di-kind">{KIND[x.kind]}</span>
                <span>{x.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Phân tích theo thể loại</h3>
        <p className="muted small">Bấm tên cột để sắp xếp, bấm một dòng để xem chân dung mảng sách đó.</p>
        <div className="table-scroll">
          <table className="cat-table">
            <thead>
              <tr>
                <Th k="label">Thể loại</Th>
                <Th k="count" num>Cuốn</Th>
                <Th k="people" num>Người viết</Th>
                <th>Tác giả chính</th>
                <Th k="year" num>Năm in</Th>
                <Th k="translated" num>Sách dịch</Th>
                <Th k="pages" num>Trang/cuốn</Th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <Fragment key={c.id}>
                  <tr className={`clickable${openCat === c.id ? ' open' : ''}`} onClick={() => setOpenCat(openCat === c.id ? null : c.id)}>
                    <td>
                      <b>{c.label}</b>
                      <div className="muted small">{c.group}</div>
                    </td>
                    <td className="num">
                      {c.count}
                      <span className="cell-bar" style={{ width: `${(c.count / Math.max(1, d.cats[0]?.count ?? 1)) * 100}%` }} />
                    </td>
                    <td className="num">{c.peopleCount}</td>
                    <td className="small">{c.authors.slice(0, 2).map((a) => `${a.label} (${a.count})`).join(', ') || <span className="muted">–</span>}</td>
                    <td className="num">{c.medianYear ?? '–'}</td>
                    <td className="num">{pct(c.translated, c.count)}</td>
                    <td className="num">{c.pages && c.count ? nf(Math.round(c.pages / c.count)) : '–'}</td>
                  </tr>
                  {openCat === c.id && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <CatDetail c={c} total={total} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.heat.rows.length > 0 && d.heat.cols.length > 1 && (
        <section className="card">
          <h3>Thể loại qua các thời kỳ</h3>
          <p className="muted small">Số cuốn của mỗi nhóm theo thập niên xuất bản; ô càng đậm càng nhiều sách. Rê chuột lên ô để xem chi tiết.</p>
          <div className="table-scroll">
            <table className="heat">
              <thead>
                <tr>
                  <th />
                  {d.heat.cols.map((c) => (
                    <th key={c} className="num">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.heat.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    {r.cells.map((n, i) => (
                      <td
                        key={i}
                        className={`num heat-cell h${n ? Math.min(5, Math.ceil((n / d.heat.max) * 5)) : 0}`}
                        title={`${r.label}, ${d.heat.cols[i]}: ${n} cuốn`}
                      >
                        {n || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h3>Phân tích theo tác giả</h3>
        <p className="muted small">Gồm cả dịch giả và người biên soạn. Bấm một người để xem trang thông tin, tiểu sử và toàn bộ sách liên quan.</p>
        <div className="author-filters">
          <input type="search" placeholder="Lọc theo tên…" value={aq} onChange={(e) => setAq(e.target.value)} aria-label="Lọc tác giả" />
          <div className="seg">
            {(['', 'author', 'translator', 'editor'] as const).map((r) => (
              <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
                {r ? ROLE_LABEL[r] : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="author-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th className="num">Cuốn</th>
                <th>Vai trò</th>
                <th>Thể loại</th>
                <th className="num">Năm in</th>
                <th>Hay đi cùng</th>
              </tr>
            </thead>
            <tbody>
              {shownAuthors.map((a) => (
                <tr key={a.person.key} className="clickable" onClick={() => onPerson(a.person.label)}>
                  <td>
                    <b>{a.person.label}</b>
                    {a.person.variants.length > 1 && <div className="muted small">còn ghi: {a.person.variants.slice(1).join(', ')}</div>}
                  </td>
                  <td className="num">{a.count}</td>
                  <td className="small">
                    {(Object.keys(ROLE_LABEL) as Role[])
                      .filter((r) => a.person.roles[r].length)
                      .map((r) => `${ROLE_LABEL[r]}${a.person.roles[r].length !== a.count ? ` ${a.person.roles[r].length}` : ''}`)
                      .join(', ')}
                  </td>
                  <td className="small">{a.cats.slice(0, 2).map((c) => c.label).join(', ') || <span className="muted">–</span>}{a.cats.length > 2 && <span className="muted"> +{a.cats.length - 2}</span>}</td>
                  <td className="num small">{span(a.minYear, a.maxYear) || '–'}</td>
                  <td className="small">{a.coauthors.slice(0, 2).map((c) => c.label).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!aq && authors.length > 15 && (
          <button className="link" onClick={() => setAllAuthors(!allAuthors)}>
            {allAuthors ? 'Thu gọn' : `Xem cả ${authors.length} người`}
          </button>
        )}
        {!authors.length && <p className="muted small">Không có ai khớp.</p>}
      </section>
    </>
  )
}
