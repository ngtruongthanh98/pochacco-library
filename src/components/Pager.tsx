export const PAGE_SIZES = [10, 50, 100, 0] as const // 0 = tất cả
export type PageSize = (typeof PAGE_SIZES)[number]
export const sizeLabel = (n: PageSize) => (n === 0 ? 'Tất cả' : String(n))

const SIZE_KEY = 'pochacco-library:page-size'
export const loadPageSize = (): PageSize => {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY))
    return (PAGE_SIZES as readonly number[]).includes(v) && localStorage.getItem(SIZE_KEY) !== null ? (v as PageSize) : 50
  } catch {
    return 50
  }
}
export const savePageSize = (n: PageSize) => {
  try {
    localStorage.setItem(SIZE_KEY, String(n))
  } catch {
    /* bỏ qua */
  }
}

/** Dãy số trang gọn: 1 … 4 5 [6] 7 8 … 20 */
function pageItems(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, cur - 1, cur, cur + 1])
  if (cur <= 3) [2, 3, 4].forEach((n) => set.add(n))
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n))
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

export function Pager({
  page,
  pages,
  from,
  to,
  total,
  onPage,
}: {
  page: number
  pages: number
  from: number
  to: number
  total: number
  onPage: (p: number) => void
}) {
  const fmt = (n: number) => n.toLocaleString('vi-VN')
  return (
    <nav className="pager" aria-label="Phân trang">
      <span className="muted pager-info">
        Cuốn {fmt(from)}–{fmt(to)} / {fmt(total)}
      </span>
      {pages > 1 && (
        <div className="pager-nums">
          <button className="pg" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
            ‹
          </button>
          {pageItems(page, pages).map((it, i) =>
            it === '…' ? (
              <span key={`e${i}`} className="pg-gap">
                …
              </span>
            ) : (
              <button
                key={it}
                className={it === page ? 'pg active' : 'pg'}
                aria-current={it === page ? 'page' : undefined}
                onClick={() => onPage(it)}
              >
                {it}
              </button>
            ),
          )}
          <button className="pg" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
            ›
          </button>
        </div>
      )}
    </nav>
  )
}
