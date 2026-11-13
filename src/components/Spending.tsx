import { useMemo, useState } from 'react'
import { fmtVnd, fmtVndShort } from '../data/money'
import { spending, type SpendRow } from '../search/spending'
import type { Book } from '../types/book'
import { Columns, Tile, nf } from './charts'

const off = (paid: number, cover: number) => (cover ? Math.round((1 - paid / cover) * 100) : null)

function SpendTable({ title, rows, total, onPick }: { title: string; rows: SpendRow[]; total: number; onPick?: (r: SpendRow) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 8)
  const max = Math.max(1, ...rows.map((r) => r.spent))
  return (
    <div className="spend-table">
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            <th>Tên</th>
            <th className="num">Cuốn</th>
            <th className="num">Đã chi</th>
            <th className="num">TB/cuốn</th>
            <th className="num" title="Trên những cuốn có ghi giá bìa">So giá bìa</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const o = off(r.paidWithCover, r.cover)
            const paidN = r.books.filter((b) => !b.acquired?.gift && b.acquired?.price !== undefined).length
            return (
              <tr key={r.key} className={onPick ? 'clickable' : undefined} onClick={onPick ? () => onPick(r) : undefined}>
                <td>
                  {r.label}
                  <span className="cell-bar" style={{ width: `${(r.spent / max) * 100}%`, marginLeft: 0 }} />
                </td>
                <td className="num">{r.count}</td>
                <td className="num">
                  {!paidN && r.books.some((b) => b.acquired?.gift) ? (
                    <span className="muted">được tặng</span>
                  ) : (
                    <>
                      {fmtVndShort(r.spent)}
                      <small className="muted"> {total && r.spent ? `${Math.round((r.spent / total) * 100)}%` : ''}</small>
                    </>
                  )}
                </td>
                <td className="num">{paidN ? fmtVndShort(Math.round(r.spent / paidN)) : '–'}</td>
                <td className={`num ${o !== null && o > 0 ? 'save' : o !== null && o < 0 ? 'over' : ''}`}>{o === null ? '–' : o > 0 ? `−${o}%` : o < 0 ? `+${-o}%` : '0%'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > 8 && (
        <button className="link" onClick={() => setAll(!all)}>
          {all ? 'Thu gọn' : `Xem cả ${rows.length}`}
        </button>
      )}
    </div>
  )
}

export default function Spending({ books, onOpen, onSearch }: { books: Book[]; onOpen: (b: Book) => void; onSearch: (q: string) => void }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<number | 'all'>('all')
  const s = useMemo(() => spending(books, year), [books, year])

  if (!s.anyEver)
    return (
      <section className="card spending">
        <h3>Chi tiêu mua sách</h3>
        <p className="muted">
          Chưa có cuốn nào ghi giá mua. Từ giờ, khi thêm hoặc sửa sách, điền phần <b>Mua sách</b> (giá mua, giá bìa, mua ở đâu) là mục này sẽ tự tổng hợp chi tiêu theo tháng, theo nhà
          xuất bản, theo nơi mua và so với giá bìa. Với sách trong danh sách muốn mua, bấm <b>“Đã mua cuốn này”</b> ở trang chi tiết.
        </p>
      </section>
    )

  const saved = s.coverSum - s.paidCoverSum
  const pct = off(s.paidCoverSum, s.coverSum)
  return (
    <section className="card spending">
      <div className="spend-head">
        <h3>Chi tiêu mua sách</h3>
        <div className="seg" role="radiogroup" aria-label="Khoảng thời gian">
          <button className={year === 'all' ? 'on' : ''} onClick={() => setYear('all')}>
            Tất cả
          </button>
          {[...new Set([thisYear, ...s.years])].sort((a, b) => b - a).slice(0, 4).map((y) => (
            <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="tiles">
        <Tile label="Đã chi" value={fmtVndShort(s.spent)} sub={`${nf(s.paid.length)} cuốn có giá`} />
        <Tile label="Trung bình" value={s.avg ? fmtVndShort(s.avg) : '–'} sub="mỗi cuốn" />
        <Tile label="So với giá bìa" value={pct === null ? '–' : pct >= 0 ? `−${pct}%` : `+${-pct}%`} sub={s.coverSum ? (saved >= 0 ? `tiết kiệm ${fmtVndShort(saved)}` : `trả thêm ${fmtVndShort(-saved)}`) : 'chưa ghi giá bìa'} />
        <Tile label="Được tặng" value={nf(s.gifts.length)} sub="cuốn" />
      </div>
      {s.insights.length > 0 && (
        <ul className="spend-insights">
          {s.insights.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <h4>{year === 'all' ? 'Theo tháng, 12 tháng gần nhất' : `Theo tháng năm ${year}`}</h4>
      <Columns rows={s.months} unit="nghìn đồng" />
      <p className="muted small">Đơn vị: nghìn đồng. Rê chuột (hoặc chạm) lên cột để xem số tiền.</p>
      <details className="data-table">
        <summary>Xem bảng theo tháng</summary>
        <table>
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="num">Cuốn</th>
              <th className="num">Đã chi</th>
            </tr>
          </thead>
          <tbody>
            {s.months.map((m) => (
              <tr key={m.key}>
                <td>{m.key.split('-').reverse().join('/')}</td>
                <td className="num">{m.books}</td>
                <td className="num">{m.spent ? fmtVnd(m.spent) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="spend-grid">
        <SpendTable title="Theo nhà xuất bản" rows={s.publishers} total={s.spent} onPick={(r) => r.key && onSearch(r.label)} />
        <SpendTable title="Theo nơi mua" rows={s.shops} total={s.spent} />
      </div>
      <div className="spend-grid">
        {s.priciest.length > 0 && (
          <div>
            <h4>Mua đắt nhất</h4>
            <ol className="mini-list">
              {s.priciest.map((b) => (
                <li key={b.id}>
                  <button className="linkish" onClick={() => onOpen(b)}>
                    {b.title}
                  </button>{' '}
                  <span className="muted">{fmtVnd(b.acquired!.price!)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {s.bestDeals.length > 0 && (
          <div>
            <h4>Mua được giá nhất</h4>
            <ol className="mini-list">
              {s.bestDeals.map(({ b, off }) => (
                <li key={b.id}>
                  <button className="linkish" onClick={() => onOpen(b)}>
                    {b.title}
                  </button>{' '}
                  <span className="muted">
                    {fmtVndShort(b.acquired!.price!)} / bìa {fmtVndShort(b.coverPrice!)} (−{Math.round(off * 100)}%)
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
