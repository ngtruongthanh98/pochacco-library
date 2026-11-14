import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import type { Row } from '../search/stats'

export const nf = (n: number) => n.toLocaleString('vi-VN')
export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%')

export function Tile({ label, value, sub, ring }: { label: string; value: string; sub?: string; ring?: number }) {
  return (
    <div className={`tile${ring !== undefined ? ' has-ring' : ''}`}>
      <div>
        <div className="tile-label">{label}</div>
        <div className="tile-value">{value}</div>
        {sub && <div className="tile-sub">{sub}</div>}
      </div>
      {ring !== undefined && <Ring value={ring} />}
    </div>
  )
}

/** Vòng tiến độ nhỏ (0–1) đặt cạnh ô số liệu. */
export function Ring({ value, size = 44 }: { value: number; size?: number }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={`${c * v} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

/** Bảng màu phân loại: thứ tự cố định, tối đa 7 màu, phần còn lại gộp vào "Khác" màu xám. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
export const OTHER = '#b3a79c'
/** Màu sáng (xanh ngọc, vàng, hồng) cần chữ tối để đọc được. */
export const inkOn = (color: string) => (['#1baf7a', '#eda100', '#e87ba4', OTHER].includes(color) ? 'var(--ink)' : '#fff')

/** Gộp các mục sau mục thứ `keep` vào một dòng "Khác". */
export const foldOther = (rows: Row[], keep = 7): Row[] => {
  const nz = rows.filter((r) => r.count)
  if (nz.length <= keep) return nz
  const rest = nz.slice(keep)
  return [...nz.slice(0, keep), { key: '__other', label: `Khác (${rest.length} mục)`, count: rest.reduce((a, r) => a + r.count, 0) }]
}

/** Theo dõi bề rộng thực của khung để vẽ SVG đúng tỷ lệ, không kéo giãn chữ. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Biểu đồ vành khuyên kèm chú giải ghi số và tỷ lệ (không dựa vào màu riêng lẻ). */
export function Donut({
  rows,
  total,
  center,
  onPick,
  colors,
}: {
  rows: Row[]
  total?: number
  center?: ReactNode
  onPick?: (r: Row) => void
  colors?: (r: Row, i: number) => string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const sum = rows.reduce((a, r) => a + r.count, 0) || 1
  const tot = total ?? sum
  const size = 180
  const r = 66
  const sw = 26
  const c = 2 * Math.PI * r
  const gap = rows.length > 1 ? 2 : 0
  const col = (row: Row, i: number) => (colors ? colors(row, i) : row.key === '__other' ? OTHER : SERIES[i % SERIES.length])
  let acc = 0
  const hv = rows.find((x) => x.key === hover)
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rows.map((x) => `${x.label}: ${x.count}`).join('; ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(236,217,196,.5)" strokeWidth={sw} />
        {rows.map((row, i) => {
          const len = (row.count / sum) * c
          const seg = (
            <circle
              key={row.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={col(row, i)}
              strokeWidth={hover === row.key ? sw + 6 : sw}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setHover(row.key)}
              onMouseLeave={() => setHover(null)}
              onClick={onPick && row.key !== '__other' ? () => onPick(row) : undefined}
              style={{ cursor: onPick && row.key !== '__other' ? 'pointer' : undefined, transition: 'stroke-width .12s' }}
            >
              <title>{`${row.label}: ${nf(row.count)} (${pct(row.count, tot)})`}</title>
            </circle>
          )
          acc += len
          return seg
        })}
        <text x="50%" y="47%" textAnchor="middle" className="donut-num">
          {hv ? nf(hv.count) : nf(tot)}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="donut-sub">
          {hv ? pct(hv.count, tot) : center ?? 'cuốn'}
        </text>
      </svg>
      <ul className="legend">
        {rows.map((row, i) => (
          <li key={row.key} className={hover === row.key ? 'on' : ''} onMouseEnter={() => setHover(row.key)} onMouseLeave={() => setHover(null)}>
            <button className="legend-row" disabled={!onPick || row.key === '__other'} onClick={() => onPick?.(row)}>
              <span className="sw" style={{ background: col(row, i) }} />
              <span className="legend-label">{row.label}</span>
              <span className="legend-val">
                {nf(row.count)} <small>{pct(row.count, tot)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Thanh xếp chồng 100%: cơ cấu một tổng thể, khe 2px giữa các phần, chú giải bên dưới. */
export function StackBar({ rows, colors }: { rows: Row[]; colors?: Record<string, string> }) {
  const sum = rows.reduce((a, r) => a + r.count, 0) || 1
  const col = (r: Row, i: number) => colors?.[r.key] ?? (r.key === '__other' ? OTHER : SERIES[i % SERIES.length])
  return (
    <div className="stackbar">
      <div className="stack-track" role="img" aria-label={rows.map((r) => `${r.label}: ${r.count}`).join('; ')}>
        {rows.map((r, i) => (
          <span key={r.key} className="stack-seg" style={{ flexGrow: r.count, background: col(r, i) }} title={`${r.label}: ${nf(r.count)} (${pct(r.count, sum)})`}>
            {r.count / sum > 0.08 && <span style={{ color: inkOn(col(r, i)) }}>{pct(r.count, sum)}</span>}
          </span>
        ))}
      </div>
      <ul className="legend inline">
        {rows.map((r, i) => (
          <li key={r.key}>
            <span className="sw" style={{ background: col(r, i) }} />
            {r.label} <b>{nf(r.count)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Rect = { x: number; y: number; w: number; h: number }
/** Bố cục ô vuông kiểu "squarified": giữ các ô gần vuông để dễ so diện tích. */
const squarify = (values: number[], box: Rect): Rect[] => {
  const total = values.reduce((a, v) => a + v, 0)
  if (!total || box.w <= 0 || box.h <= 0) return values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }))
  const areas = values.map((v) => (v / total) * box.w * box.h)
  const out: Rect[] = []
  let r = { ...box }
  let i = 0
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, v) => a + v, 0)
    return Math.max(...row.map((a) => Math.max((side * side * a) / (s * s), (s * s) / (side * side * a))))
  }
  while (i < areas.length) {
    const side = Math.min(r.w, r.h)
    const row = [areas[i]]
    let j = i + 1
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++])
    const s = row.reduce((a, v) => a + v, 0)
    if (r.w >= r.h) {
      const cw = s / r.h
      let y = r.y
      for (const a of row) { out.push({ x: r.x, y, w: cw, h: a / cw }); y += a / cw }
      r = { x: r.x + cw, y: r.y, w: r.w - cw, h: r.h }
    } else {
      const rh = s / r.w
      let x = r.x
      for (const a of row) { out.push({ x, y: r.y, w: a / rh, h: rh }); x += a / rh }
      r = { x: r.x, y: r.y + rh, w: r.w, h: r.h - rh }
    }
    i = j
  }
  return out
}

export type TreeNode = Row & { children: Row[] }
/** Biểu đồ ô vuông hai tầng: khung lớn là nhóm, ô bên trong là danh mục; diện tích tỷ lệ với số cuốn. */
export function Treemap({
  tree,
  colorOf,
  onGroup,
  onLeaf,
}: {
  tree: TreeNode[]
  colorOf: (g: TreeNode) => string
  onGroup?: (g: TreeNode) => void
  onLeaf?: (r: Row) => void
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const h = Math.max(340, Math.min(620, Math.round(w * (w < 600 ? 1.25 : 0.6))))
  const groups = [...tree].map((g) => ({ ...g, size: g.children.reduce((a, c) => a + c.count, 0) })).sort((a, b) => b.size - a.size)
  const outer = squarify(groups.map((g) => g.size), { x: 0, y: 0, w, h })
  const HEAD = 22
  return (
    <div className="treemap" ref={ref} style={{ height: h }}>
      {w > 0 &&
        groups.map((g, gi) => {
          const o = outer[gi]
          const color = colorOf(g)
          const withHead = o.h > HEAD + 24 && o.w > 60
          const inner = squarify(g.children.map((c) => c.count), {
            x: 0, y: withHead ? HEAD : 0, w: o.w - 4, h: o.h - (withHead ? HEAD : 0) - 4,
          })
          return (
            <div key={g.key} className="tm-group" style={{ left: o.x, top: o.y, width: o.w, height: o.h, borderColor: color }}>
              {withHead && (
                <button className="tm-head" onClick={onGroup ? () => onGroup(g) : undefined} title={`${g.label}: ${nf(g.count)} cuốn`}>
                  {g.label} <small>{nf(g.count)}</small>
                </button>
              )}
              {g.children.map((c, ci) => {
                const r = inner[ci]
                const big = r.w > 64 && r.h > 34
                return (
                  <button
                    key={c.key}
                    className="tm-leaf"
                    style={{ left: r.x + 2, top: r.y + 2, width: Math.max(0, r.w - 2), height: Math.max(0, r.h - 2), background: color, color: inkOn(color) }}
                    title={`${c.label} (${g.label}): ${nf(c.count)} cuốn`}
                    onClick={onLeaf ? () => onLeaf(c) : undefined}
                  >
                    {big && (
                      <>
                        <span className="tm-label">{c.label}</span>
                        <span className="tm-val">{nf(c.count)}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
    </div>
  )
}

/** Đường tăng trưởng cộng dồn, rê chuột hiện ngày và số liệu tại điểm gần nhất. */
export function Growth({ points }: { points: { date: string; count: number; added: number }[] }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)
  const H = 220
  const pad = { l: 40, r: 12, t: 14, b: 26 }
  if (!points.length) return <p className="muted small">Chưa có ngày nhập.</p>
  const t0 = Date.parse(points[0].date)
  const t1 = Math.max(Date.parse(points.at(-1)!.date), t0 + 86400000)
  const max = points.at(-1)!.count
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(1, max))))
  const top = Math.ceil(max / step) * step
  const X = (d: string) => pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (w - pad.l - pad.r)
  const Y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)
  // Dạng bậc thang: sách được thêm theo đợt, nên số liệu đứng yên giữa các ngày nhập.
  let d = `M${X(points[0].date)},${Y(points[0].count - points[0].added)}`
  for (const p of points) d += `V${Y(p.count - p.added)}H${X(p.date)}V${Y(p.count)}`
  const area = `${d}V${Y(0)}H${X(points[0].date)}Z`
  const ticks = [0, top / 2, top]
  const short = t1 - t0 < 92 * 86400000
  const months = new Set<string>()
  const xt = points.filter((p) => {
    const m = short ? p.date : p.date.slice(0, 7)
    if (months.has(m)) return false
    months.add(m)
    return true
  })
  const xticks = xt.filter((_, i) => i % Math.max(1, Math.ceil(xt.length / Math.max(2, Math.floor(w / 90)))) === 0)
  const fmt = (s: string) => `${Number(s.slice(8, 10))}/${Number(s.slice(5, 7))}/${s.slice(2, 4)}`
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = 0
    points.forEach((p, i) => { if (Math.abs(X(p.date) - x) < Math.abs(X(points[best].date) - x)) best = i })
    setHi(best)
  }
  const p = hi !== null ? points[hi] : null
  return (
    <div className="growth" ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} onMouseMove={onMove} onMouseLeave={() => setHi(null)} role="img" aria-label={`Thư viện tăng từ ${points[0].count} lên ${max} đầu sách`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} className="grid" />
              <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end" className="axis">{nf(t)}</text>
            </g>
          ))}
          {xticks.map((p) => (
            <text key={p.date} x={X(p.date)} y={H - 6} textAnchor="middle" className="axis">
              {short ? `${Number(p.date.slice(8, 10))}/${Number(p.date.slice(5, 7))}` : `${Number(p.date.slice(5, 7))}/${p.date.slice(2, 4)}`}
            </text>
          ))}
          <path d={area} className="g-area" />
          <path d={d} className="g-line" />
          {p && (
            <g>
              <line x1={X(p.date)} x2={X(p.date)} y1={pad.t} y2={H - pad.b} className="crosshair" />
              <circle cx={X(p.date)} cy={Y(p.count)} r={5} className="g-dot" />
            </g>
          )}
        </svg>
      )}
      {p && (
        <div className="g-tip" style={{ left: Math.min(Math.max(X(p.date), 70), w - 70), top: Math.max(0, Y(p.count) - 54) }}>
          <b>{fmt(p.date)}</b>
          <div>{nf(p.count)} đầu sách</div>
          <div className="muted">+{nf(p.added)} trong ngày</div>
        </div>
      )}
    </div>
  )
}

/** Bảng nhiệt: hàng × cột, ô tô đậm theo giá trị; luôn ghi số trong ô. */
export function HeatGrid({
  cols,
  rows,
  max,
  fmt = (v) => (v ? String(v) : ''),
  tone = 'red',
  rowHead,
  title,
}: {
  cols: string[]
  rows: { key: string; label: string; cells: number[]; sub?: string }[]
  max: number
  fmt?: (v: number) => string
  tone?: 'red' | 'olive'
  rowHead?: string
  title?: (row: string, col: string, v: number) => string
}) {
  const lv = (v: number) => (v ? Math.min(5, Math.max(1, Math.ceil((v / (max || 1)) * 5))) : 0)
  return (
    <div className="table-scroll">
      <table className="heat">
        <thead>
          <tr>
            <th>{rowHead}</th>
            {cols.map((c) => <th key={c} className="num">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">
                {r.label}
                {r.sub && <div className="muted small">{r.sub}</div>}
              </th>
              {r.cells.map((v, i) => (
                <td key={i} className={`num heat-cell ${tone === 'olive' ? 'g' : 'h'}${lv(v)}`} title={title?.(r.label, cols[i], v)}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

