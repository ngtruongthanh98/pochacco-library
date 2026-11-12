// Định tuyến bằng phần # của địa chỉ web (chạy được trên GitHub Pages, không cần cấu hình máy chủ).
//   #/                          danh sách; ?q=… tìm kiếm, ?nhom=… nhóm, ?loai=… danh mục, ?xep=… cách sắp xếp, ?trang=… số trang
//   #/thong-ke                  trang thống kê
//   #/cai-dat                   trang cài đặt (tùy biến phân loại)
//   #/sach/<id>                 chi tiết sách
//   #/sach/<id>/sua             sửa sách
//   #/sach/<id>/doc/<i>         đọc bản điện tử thứ i
//   #/them  #/quet  #/quet-ke  #/nhap-ebook
import { CATEGORY_GROUPS } from './data/categories'
import { isSortKey, type SortKey } from './search/sortBooks'
import { FORMAT_OPTIONS, type FormatFilter } from './data/format'

export type ScanMode = 'one' | 'shelf' | 'ebooks'

export type Route = {
  page: 'library' | 'stats' | 'settings' | 'quotes'
  openId: string | null
  editing: boolean
  reading: number | null
  scanMode: ScanMode | null
  adding: boolean
  q: string
  group: number
  cat: string | null
  sort: SortKey | null
  /** Lọc theo dạng: chỉ ebook, chỉ sách giấy, có cả hai */
  fmt: FormatFilter
  /** Chủ đề đang xem ở trang Trích dẫn */
  topic: string | null
  /** Trang thứ mấy của danh sách (từ 1) */
  pg: number
}

export const EMPTY_ROUTE: Route = {
  page: 'library',
  openId: null,
  editing: false,
  reading: null,
  scanMode: null,
  adding: false,
  q: '',
  group: -1,
  cat: null,
  sort: null,
  fmt: null,
  topic: null,
  pg: 1,
}

const groupSlug = (i: number) => CATEGORY_GROUPS[i].id

const SCAN_PATH: Record<ScanMode, string> = { one: 'quet', shelf: 'quet-ke', ebooks: 'nhap-ebook' }

export function formatRoute(r: Route): string {
  if (r.openId) {
    const base = `#/sach/${encodeURIComponent(r.openId)}`
    if (r.reading !== null) return `${base}/doc/${r.reading}`
    return r.editing ? `${base}/sua` : base
  }
  if (r.page === 'stats') return '#/thong-ke'
  if (r.page === 'settings') return '#/cai-dat'
  if (r.page === 'quotes') return r.topic ? `#/trich-dan?${new URLSearchParams({ 'chu-de': r.topic })}` : '#/trich-dan'
  if (r.scanMode) return `#/${SCAN_PATH[r.scanMode]}`
  if (r.adding) return '#/them'
  const params = new URLSearchParams()
  if (r.q.trim()) params.set('q', r.q)
  if (r.cat) params.set('loai', r.cat)
  else if (r.group >= 0) params.set('nhom', groupSlug(r.group))
  if (r.sort) params.set('xep', r.sort)
  if (r.fmt) params.set('ban', FORMAT_OPTIONS.find((o) => o.key === r.fmt)!.slug)
  if (r.pg > 1) params.set('trang', String(r.pg))
  const qs = params.toString()
  return qs ? `#/?${qs}` : '#/'
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, qs = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const r: Route = { ...EMPTY_ROUTE }
  if (parts[0] === 'sach' && parts[1]) {
    r.openId = parts[1]
    if (parts[2] === 'sua') r.editing = true
    if (parts[2] === 'doc' && /^\d+$/.test(parts[3] ?? '')) r.reading = Number(parts[3])
    return r
  }
  if (parts[0] === 'thong-ke') return { ...r, page: 'stats' }
  if (parts[0] === 'cai-dat') return { ...r, page: 'settings' }
  if (parts[0] === 'trich-dan') return { ...r, page: 'quotes', topic: new URLSearchParams(qs).get('chu-de') }
  if (parts[0] === 'them') return { ...r, adding: true }
  const scan = (Object.keys(SCAN_PATH) as ScanMode[]).find((k) => SCAN_PATH[k] === parts[0])
  if (scan) return { ...r, scanMode: scan }
  const params = new URLSearchParams(qs)
  r.q = params.get('q') ?? ''
  const xep = params.get('xep')
  if (isSortKey(xep)) r.sort = xep
  r.fmt = FORMAT_OPTIONS.find((o) => o.slug === params.get('ban'))?.key ?? null
  const trang = Number(params.get('trang'))
  if (Number.isInteger(trang) && trang > 1) r.pg = trang
  const loai = params.get('loai')
  const nhom = params.get('nhom')
  if (loai) {
    const g = CATEGORY_GROUPS.findIndex((x) => x.items.some((i) => i.id === loai))
    if (g >= 0) {
      r.group = g
      r.cat = loai
    }
  } else if (nhom) {
    r.group = CATEGORY_GROUPS.findIndex((_, i) => groupSlug(i) === nhom)
  }
  return r
}

/** Hai địa chỉ chỉ khác nhau ở từ khóa tìm kiếm hoặc cách sắp xếp: thay thế thay vì thêm mục lịch sử mới. */
export function onlyQueryChanged(a: Route, b: Route): boolean {
  const list = (r: Route) => !r.openId && r.page === 'library' && !r.scanMode && !r.adding
  return list(a) && list(b) && a.group === b.group && a.cat === b.cat && (a.q !== b.q || a.sort !== b.sort)
}

type HistState = { pochacco: true; depth: number; scrollY?: number }

const histState = (): HistState | null => {
  const s = window.history.state as HistState | null
  return s && s.pochacco ? s : null
}

export const historyDepth = () => histState()?.depth ?? 0

// Vị trí cuộn ngay trước thao tác của người dùng (các nút thường cuộn lên đầu trước khi địa chỉ kịp đổi).
let scrollBeforeAction: number | null = null
if (typeof document !== 'undefined') {
  const remember = () => {
    scrollBeforeAction = window.scrollY
  }
  document.addEventListener('click', remember, true)
  document.addEventListener('keydown', remember, true)
}

export function writeHistory(hash: string, mode: 'push' | 'replace') {
  const cur = histState()
  const depth = cur?.depth ?? 0
  if (mode === 'push') {
    // Nhớ vị trí cuộn của trang hiện tại để khi quay lại thì trở về đúng chỗ.
    window.history.replaceState({ ...(cur ?? { pochacco: true, depth }), scrollY: scrollBeforeAction ?? window.scrollY }, '')
    window.history.pushState({ pochacco: true, depth: depth + 1 } satisfies HistState, '', hash)
  } else {
    window.history.replaceState({ pochacco: true, depth, scrollY: cur?.scrollY } satisfies HistState, '', hash)
  }
}

export const savedScroll = () => histState()?.scrollY
