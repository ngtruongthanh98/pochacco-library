import type { Row } from '../search/stats'

export const nf = (n: number) => n.toLocaleString('vi-VN')
export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%')

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

/** Bảng số liệu đi kèm mỗi biểu đồ (mở ra khi cần), để không phụ thuộc vào màu hay hình. */
export function DataTable({ rows, total, unit }: { rows: Row[]; total: number; unit: string }) {
  return (
    <details className="data-table">
      <summary>Xem bảng số liệu</summary>
      <table>
        <thead>
          <tr>
            <th>Mục</th>
            <th className="num">Số {unit}</th>
            <th className="num">Tỷ lệ</th>
            {rows.some((r) => r.pages) && <th className="num">Số trang</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="num">{nf(r.count)}</td>
              <td className="num">{pct(r.count, total)}</td>
              {rows.some((x) => x.pages) && <td className="num">{r.pages ? nf(r.pages) : ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** Biểu đồ thanh ngang: một đại lượng, một màu; số và tỷ lệ ghi ngay cuối thanh. */
export function BarList({
  rows,
  total,
  onPick,
  tone = 'red',
  max: maxIn,
}: {
  rows: Row[]
  total: number
  onPick?: (r: Row) => void
  tone?: 'red' | 'olive' | 'status'
  max?: number
}) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            className={`bar-row${onPick ? '' : ' static'}`}
            onClick={onPick ? () => onPick(r) : undefined}
            title={`${r.label}: ${nf(r.count)} cuốn (${pct(r.count, total)})${r.pages ? `, ${nf(r.pages)} trang` : ''}`}
          >
            <span className="bar-label">{r.label}</span>
            <span className="bar-track">
              <span
                className={`bar-fill t-${tone === 'status' ? r.key : tone}`}
                style={{ width: r.count ? `max(${(r.count / max) * 100}%, 4px)` : 0 }}
              />
            </span>
            <span className="bar-val">
              {nf(r.count)} <small>{pct(r.count, total)}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Biểu đồ cột dọc cho chuỗi có thứ tự (thời gian, khoảng số trang); rê chuột hiện giá trị. */
export function Columns({ rows, unit = 'cuốn' }: { rows: Row[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const ticks = [max, Math.round(max / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i)
  return (
    <div className="columns" role="img" aria-label={rows.map((r) => `${r.label}: ${r.count} ${unit}`).join('; ')}>
      <div className="col-grid">
        {ticks.map((t) => (
          <div key={t} className="col-tick" style={{ bottom: `${(t / max) * 100}%` }}>
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="col-bars" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}>
        {rows.map((r) => (
          <div key={r.key} className="col" title={`${r.label}: ${nf(r.count)} ${unit}`}>
            <div className="col-area">
              <div className="col-fill" style={{ height: r.count ? `max(${(r.count / max) * 100}%, 3px)` : 0 }}>
                <span className="col-tip">{nf(r.count)}</span>
              </div>
            </div>
            <div className="col-label">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

