import { useMemo, useState } from 'react'
import { computeStats, type Row } from '../search/stats'
import { nameToString, type Book } from '../types/book'
import StatsDeep from './StatsDeep'
import { BarList, Columns, DataTable, Tile, nf, pct } from './charts'

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

export default function Stats({
  books,
  onSearch,
  onGroup,
  onCategory,
  onOpen,
  onPerson,
}: {
  books: Book[]
  onPerson: (name: string) => void
  onSearch: (q: string) => void
  onGroup: (i: number) => void
  onCategory: (id: string) => void
  onOpen: (b: Book) => void
}) {
  const s = useMemo(() => computeStats(books), [books])
  const t = s.totals
  const [showAllMissing, setShowAllMissing] = useState(false)

  if (!t.titles && !t.wishlist)
    return (
      <div className="card empty">
        <img src={asset('empty-shelf.webp')} alt="" />
        <div className="state-title">Chưa có số liệu</div>
        <div className="muted">Thêm vài cuốn sách là trang thống kê sẽ có nội dung.</div>
      </div>
    )

  return (
    <div className="stats">
      <section className="card">
        <h2>Thống kê thư viện</h2>
        <div className="tiles">
          <Tile label="Đầu sách" value={nf(t.titles)} sub={`${nf(t.copies)} bản giấy`} />
          <Tile label="Tổng số trang" value={nf(t.pages)} sub={t.medianPages ? `trung vị ${t.medianPages} trang/cuốn` : undefined} />
          <Tile label="Tác giả, dịch giả" value={nf(t.people)} sub={`${nf(t.publishers)} nhà xuất bản`} />
          <Tile label="Sách dịch" value={pct(t.translated, t.titles)} sub={`${t.translated} cuốn`} />
          <Tile label="Có bản điện tử" value={nf(t.ebooks)} sub={pct(t.ebooks, t.titles)} />
          <Tile label="Đủ thông tin" value={pct(t.complete, t.titles)} sub={`${t.titles - t.complete} cuốn cần bổ sung`} />
        </div>
        {s.insights.length > 0 && (
          <div className="insights">
            <h3>Nhận xét nhanh</h3>
            <ul>
              {s.insights.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
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

      <StatsDeep books={books} onCategory={onCategory} onPerson={onPerson} onOpen={onOpen} />

      <div className="stats-grid">
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
      </div>

      <div className="stats-grid">
        <section className="card">
          <h3>Ngôn ngữ</h3>
          <BarList rows={s.languages} total={t.titles} tone="olive" />
          <p className="muted small">
            Sách dịch: {t.translated} cuốn ({pct(t.translated, t.titles)}), có nhan đề nguyên tác hoặc dịch giả.
          </p>
        </section>
        <section className="card">
          <h3>Tình trạng</h3>
          <BarList rows={s.status} total={books.length} tone="status" />
          <p className="muted small">Sách "muốn mua" chưa nằm trên kệ nên không tính vào các số liệu khác của trang.</p>
        </section>
      </div>

      <section className="card">
        <h3>Người viết, người dịch, nơi in</h3>
        <p className="muted small">Bấm một dòng để xem các sách tương ứng.</p>
        <div className="top-grid">
          <TopTable title="Tác giả" rows={s.authors} onPick={(r) => onPerson(r.label)} empty="Chưa ghi tác giả." />
          <TopTable title="Dịch giả" rows={s.translators} onPick={(r) => onPerson(r.label)} empty="Chưa có sách dịch ghi dịch giả." />
          <TopTable title="Nhà xuất bản" rows={s.publishers} onPick={(r) => onSearch(r.label)} empty="Chưa ghi nhà xuất bản." />
          <TopTable title="Đơn vị liên kết" rows={s.partners} onPick={(r) => onSearch(r.label)} empty="Chưa ghi đơn vị liên kết." />
          {s.series.length > 0 && <TopTable title="Tùng thư" rows={s.series} onPick={(r) => onSearch(r.label)} empty="" />}
        </div>
      </section>

      <div className="stats-grid">
        <section className="card">
          <h3>Theo kệ</h3>
          <BarList
            rows={s.shelves.map((r) => ({ ...r, label: r.key ? `Kệ ${r.label}` : r.label }))}
            total={t.titles}
            onPick={(r) => r.key && onSearch(r.key)}
          />
          <DataTable rows={s.shelves.map((r) => ({ ...r, label: r.key ? `Kệ ${r.label} (${r.extra} bản)` : r.label }))} total={t.titles} unit="đầu sách" />
        </section>
        <section className="card">
          <h3>Nhịp bổ sung 12 tháng qua</h3>
          <Columns rows={s.months} />
          <p className="muted small">Số đầu sách được thêm vào ứng dụng mỗi tháng (nhãn là số tháng, kèm năm ở tháng đầu và tháng 1), tính cả sách muốn mua.</p>
        </section>
      </div>

      <section className="card">
        <h3>Độ đầy đủ của dữ liệu</h3>
        <p className="muted small">
          Tỷ lệ đầu sách đã có từng loại thông tin. Thông tin càng đủ thì tìm kiếm, gợi ý sách liên quan và trích dẫn càng chính xác.
        </p>
        <BarList rows={s.completeness} total={t.titles} max={t.titles} tone="olive" />
        {s.needsWork.length > 0 && (
          <>
            <h4>Cần bổ sung ({s.needsWork.length} cuốn)</h4>
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
          </>
        )}
      </section>
    </div>
  )
}
