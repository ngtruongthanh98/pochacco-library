import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import BookDetail from './components/BookDetail'
import Cover from './components/Cover'
import EbookReader from './components/EbookReader'
import ImportEbooks from './components/ImportEbooks'
import ScanOne from './components/ScanOne'
import ShelfScan from './components/ShelfScan'
import Stats from './components/Stats'
import PersonPage from './components/PersonPage'
import SuggestPage from './components/SuggestPage'
import BookForm from './components/BookForm'
import { applyTaxonomy, DEFAULT_GROUPS, CATEGORY_GROUPS, categoryLabel, parseTaxonomy, type CategoryGroup } from './data/categories'
import { buildAccountFile, isValidUsername, login, LoginError } from './auth/accounts'
import { clearConfig, fetchCatalog, fetchTaxonomy, loadConfig, saveConfig, type StoreConfig } from './data/githubStore'
import { Settings } from './components/Settings'
const GamesPage = lazy(() => import('./components/games/GamesPage'))
import { ReaderSettings } from './components/ReaderSettings'
import { readConfigFile, type ReaderConfig } from './data/configStore'
import { QuotesPage, type ExcerptActions } from './components/Quotes'
import { fetchExcerpts, saveExcerpts } from './data/excerptStore'
import { topicCounts } from './data/cite'
import type { Excerpt } from './types/excerpt'
import { buildIndex } from './search/searchIndex'
import { duplicateDraft, editionDraft } from './data/duplicate'
import RefsPage from './components/RefsPage'
import BulkEdit from './components/BulkEdit'
import BackupPanel, { downloadBackup, LAST_BACKUP_KEY } from './components/BackupPanel'
import { loadRefLists, newListId, saveRefLists, type RefList } from './data/refLists'
import { bindingLabel, type Binding } from './types/book'

const PICK_KEY = 'pochacco-library:cite-picks'
const TARGET_KEY = 'pochacco-library:cite-target'
const SNOOZE_KEY = 'pochacco-library:backup-snooze'

/** Nhãn loại bìa trên thẻ sách: chỉ hiện khi khác bìa mềm, hoặc khi cuốn có nhiều loại bìa. */
const bindingTags = (b: Book): Binding[] => {
  const all = [...new Set(b.holdings.flatMap((h) => (h.kind === 'print' && h.binding ? [h.binding] : [])))]
  return all.length > 1 ? all : all.filter((x) => x !== 'paperback')
}
import { FORMAT_OPTIONS, formatOf, isEbookOnly, type FormatFilter } from './data/format'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ScrollTop } from './components/ScrollTop'
import { loadPageSize, PAGE_SIZES, Pager, savePageSize, sizeLabel, type PageSize } from './components/Pager'
import { ADDED_PRESETS, addedLabel, addedMatcher, batches, dayKey, fmtDay } from './search/added'
import { loadSortPref, saveSortPref, sortBooks, SORT_OPTIONS, type SortKey } from './search/sortBooks'
import { formatRoute, historyDepth, onlyQueryChanged, parseRoute, savedScroll, writeHistory, type Route, type ScanMode } from './router'
import { nameToString, type Book, type EbookHolding } from './types/book'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

/** Hình động Pochacco; người dùng tắt hiệu ứng chuyển động thì hiện hình tĩnh. */
type AnimName = 'walk' | 'read' | 'carry' | 'sleepy'
function Anim({ name, className }: { name: AnimName; className?: string }) {
  return (
    <picture className={`${className ?? ''} anim-${name}`}>
      <source srcSet={asset(`anim-${name}-still.webp`)} media="(prefers-reduced-motion: reduce)" />
      <img src={asset(`anim-${name}.webp`)} alt="" width={240} height={240} />
    </picture>
  )
}

/** Để yên vài phút không thao tác: Pochacco ngủ gật ở góc màn hình; động vào là tỉnh. */
function Napper() {
  const [nap, setNap] = useState(false)
  useEffect(() => {
    let t = 0
    const arm = () => {
      window.clearTimeout(t)
      setNap(false)
      t = window.setTimeout(() => setNap(!document.querySelector('.reader, .dialog-backdrop')), 3 * 60 * 1000)
    }
    const evs = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [])
  if (!nap) return null
  return (
    <div className="napper" role="status">
      <Anim name="sleepy" />
      <span>Pochacco ngủ gật bên trang sách rồi… zzz</span>
    </div>
  )
}

function State({ img, title, text }: { img: string; title: string; text?: string }) {
  const anim = img.match(/^anim-(walk|read|carry|sleepy)$/)?.[1] as AnimName | undefined
  return (
    <div className={anim ? 'state state-anim' : 'state'}>
      {anim ? <Anim name={anim} /> : <img src={asset(img)} alt="" />}
      <div>
        <div className="state-title">{title}</div>
        {text && <div className="muted">{text}</div>}
      </div>
    </div>
  )
}

function Login({ onLogin, onCreate }: { onLogin: (c: StoreConfig) => void; onCreate: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const cfg = await login(username, password)
          saveConfig(cfg, remember)
          onLogin(cfg)
        } catch (err) {
          setError(err instanceof LoginError ? err.message : 'Không đăng nhập được, thử lại sau.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="card-head">
        <img src={asset('sticker-card.webp')} alt="" />
        <div>
          <h2>Đăng nhập</h2>
          <p className="muted">Trình báo danh để vào thư viện.</p>
        </div>
      </div>
      <label>
        Tên đăng nhập
        <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Mật khẩu
        <input type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
        Hiện mật khẩu
      </label>
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Ghi nhớ trên thiết bị này
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Đang mở khóa...' : 'Đăng nhập'}
      </button>
      <button type="button" className="link" onClick={onCreate}>
        Tạo tài khoản mới
      </button>
    </form>
  )
}

function CreateAccount({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [owner, setOwner] = useState('ngtruongthanh98')
  const [repo, setRepo] = useState('pochacco-library-data')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  if (result) {
    const href = URL.createObjectURL(new Blob([result], { type: 'application/json' }))
    return (
      <div className="card">
        <div className="card-head">
          <img src={asset('sticker-salute.webp')} alt="" />
          <div>
            <h2>Đã tạo tệp tài khoản</h2>
            <p className="muted">
              Tệp này chỉ chứa token đã mã hóa bằng mật khẩu, không chứa mật khẩu. Đưa tệp lên repo
              ứng dụng tại <code>public/accounts.json</code> (thay tệp cũ); sau khi trang cập nhật, đăng
              nhập bằng tài khoản mới.
            </p>
          </div>
        </div>
        <textarea className="mono" readOnly value={result} rows={8} />
        <a className="button" href={href} download="accounts.json">
          Tải accounts.json
        </a>
        <button type="button" className="link" onClick={onBack}>
          Quay lại đăng nhập
        </button>
      </div>
    )
  }

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        if (!isValidUsername(username))
          return setError('Tên đăng nhập 3 đến 32 ký tự: chữ thường không dấu, số, dấu chấm, gạch.')
        if (password.length < 8) return setError('Mật khẩu cần ít nhất 8 ký tự.')
        if (password !== password2) return setError('Hai lần nhập mật khẩu không khớp.')
        setBusy(true)
        try {
          const cfg = { owner: owner.trim(), repo: repo.trim(), token: token.trim() }
          await fetchCatalog(cfg) // kiểm tra token đọc được repo dữ liệu
          const file = await buildAccountFile(username, password, cfg)
          setResult(JSON.stringify(file, null, 2) + '\n')
        } catch (err) {
          setError(`Token không đọc được repo dữ liệu: ${(err as Error).message}`)
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="card-head">
        <img src={asset('sticker-card.webp')} alt="" />
        <div>
          <h2>Tạo tài khoản</h2>
          <p className="muted">
            Token GitHub chỉ cần nhập một lần ở đây. Nó được mã hóa bằng mật khẩu ngay trên trình
            duyệt, không gửi đi đâu.
          </p>
        </div>
      </div>
      <label>
        Tên đăng nhập
        <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Mật khẩu
        <input type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        Nhập lại mật khẩu
        <input type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
        Hiện mật khẩu
      </label>
      <div className="row">
        <label>
          Chủ repo
          <input value={owner} onChange={(e) => setOwner(e.target.value)} required />
        </label>
        <label>
          Repo dữ liệu
          <input value={repo} onChange={(e) => setRepo(e.target.value)} required />
        </label>
      </div>
      <label>
        Token GitHub (fine-grained, chỉ repo dữ liệu, quyền Contents)
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Đang kiểm tra và mã hóa...' : 'Tạo tệp tài khoản'}
      </button>
      <button type="button" className="link" onClick={onBack}>
        Đã có tài khoản? Đăng nhập
      </button>
    </form>
  )
}

function BookRow({ b, cfg, onOpen, index = 0, selecting = false, picked = false, onPick }: { b: Book; cfg: StoreConfig; onOpen: () => void; index?: number; selecting?: boolean; picked?: boolean; onPick?: () => void }) {
  const people = (b.authors ?? []).map(nameToString).join(', ')
  const print = b.holdings.find((h) => h.kind === 'print')
  const hasEbook = b.holdings.some((h) => h.kind === 'ebook')
  const ebookOnly = isEbookOnly(b)
  return (
    <li
      className={`book${picked ? ' picked' : ''}${selecting ? ' selecting' : ''}`}
      style={{ '--i': Math.min(index, 12) } as CSSProperties}
      role="button"
      tabIndex={0}
      onClick={selecting ? onPick : onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (selecting ? onPick?.() : onOpen())}
    >
      {(selecting || picked) && (
        <button
          type="button"
          className={`pick-box${picked ? ' on' : ''}`}
          aria-pressed={picked}
          aria-label={picked ? 'Bỏ chọn cuốn này' : 'Chọn cuốn này để trích dẫn'}
          onClick={(e) => {
            e.stopPropagation()
            onPick?.()
          }}
        >
          {picked ? '✓' : ''}
        </button>
      )}
      <Cover book={b} cfg={cfg} />
      <div className="book-body">
      <div className="title">{b.title}</div>
      <div className="meta">
        {[people, b.publisher, b.year, b.pages && `${b.pages} tr.`].filter(Boolean).join(' · ')}
      </div>
      {!!b.categories?.length && (
        <div className="cats">{b.categories.map(categoryLabel).join(" · ")}</div>
      )}
      <div className="where">
        {print?.kind === 'print' && print.location && <span className="tag">Kệ {print.location}</span>}
        {bindingTags(b).map((x) => (
          <span key={x} className="tag binding">{bindingLabel(x as Binding)}</span>
        ))}
        {ebookOnly ? <span className="tag ebook-only">Ebook only</span> : hasEbook && <span className="tag olive">Sách điện tử</span>}
        {b.status === 'lent' && <span className="tag warn">Đang cho mượn</span>}
        {b.status === 'wishlist' && <span className="tag gold">Muốn mua</span>}
      </div>
      </div>
    </li>
  )
}

export default function App() {
  const [cfg, setCfg] = useState<StoreConfig | null>(() => loadConfig())
  const [creating, setCreating] = useState(false)
  const [initial] = useState(() => parseRoute(window.location.hash))
  const [adding, setAdding] = useState(initial.adding)
  const [saved, setSaved] = useState<Book | null>(null)
  const [group, setGroup] = useState(initial.group)
  const [cat, setCat] = useState<string | null>(initial.cat)
  const [openId, setOpenId] = useState<string | null>(initial.openId)
  const [editing, setEditing] = useState(initial.editing)
  const [scanMode, setScanMode] = useState<ScanMode | null>(initial.scanMode)
  const [prefill, setPrefill] = useState<Partial<Book> | null>(null)
  const [dupFrom, setDupFrom] = useState<Book | null>(null)
  const [dupMode, setDupMode] = useState<'copy' | 'edition'>('copy')
  const [page, setPage] = useState<'library' | 'stats' | 'settings' | 'quotes' | 'games' | 'refs' | 'people' | 'suggest'>(initial.page)
  const [person, setPerson] = useState<string | null>(initial.person)
  // Các cuốn đã chọn để tạo danh mục tài liệu tham khảo (giữ qua các lần mở trang)
  const [picked, setPickedState] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(PICK_KEY) ?? '[]')
    } catch {
      return []
    }
  })
  const setPicked = (fn: (xs: string[]) => string[]) =>
    setPickedState((xs) => {
      const next = fn(xs)
      localStorage.setItem(PICK_KEY, JSON.stringify(next))
      return next
    })
  const [selecting, setSelecting] = useState(false)
  // Danh mục tài liệu theo bài viết (config/reflists.json)
  const [refLists, setRefLists] = useState<RefList[]>([])
  const refSha = useRef<string | null>(null)
  const refLoaded = useRef(false)
  const refTimer = useRef(0)
  const refListsRef = useRef(refLists)
  refListsRef.current = refLists
  const [refView, setRefView] = useState<string | null>(initial.refList)
  /** Nơi nhận các cuốn được chọn: 'tam' (danh sách tạm) hoặc id danh mục. */
  const [pickTarget, setPickTargetState] = useState<string>(() => localStorage.getItem(TARGET_KEY) ?? 'tam')
  const setPickTarget = (t: string) => {
    setPickTargetState(t)
    localStorage.setItem(TARGET_KEY, t)
  }
  const targetList = pickTarget !== 'tam' ? refLists.find((l) => l.id === pickTarget) : undefined
  const workingIds = targetList ? targetList.books : picked
  const [bulk, setBulk] = useState<Book[] | null>(null)
  // Nhắc tải bản sao lưu về máy mỗi tuần
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem(LAST_BACKUP_KEY))
  const [snooze, setSnooze] = useState(() => localStorage.getItem(SNOOZE_KEY))
  const [backupBusy, setBackupBusy] = useState(false)
  const [reading, setReading] = useState<number | null>(initial.reading)
  const [notice, setNotice] = useState<{ title: string; text: string; queue?: string[] } | null>(null)
  const [queue, setQueue] = useState<{ ids: string[]; total: number } | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState(initial.q)
  const [sort, setSort] = useState<SortKey | null>(initial.sort)
  const [fmt, setFmt] = useState<FormatFilter>(initial.fmt)
  const [topic, setTopic] = useState<string | null>(initial.topic)
  const [added, setAdded] = useState<string | null>(initial.added)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [excerpts, setExcerpts] = useState<Excerpt[]>([])
  const [exError, setExError] = useState<string | null>(null)
  const [readerCfg, setReaderCfg] = useState<ReaderConfig>({})
  const [readerSha, setReaderSha] = useState<string | null>(null)
  const [sortPref, setSortPref] = useState<SortKey>(() => loadSortPref())
  const [pageSize, setPageSize] = useState<PageSize>(() => loadPageSize())
  // Trang hiện tại gắn với bộ lọc đã tạo ra nó: đổi từ khóa, nhóm hay cách xếp thì tự về trang 1.
  const [pgState, setPgState] = useState({ pg: initial.pg, key: '' })
  const [confirmLogout, setConfirmLogout] = useState(false)
  // Phân loại tùy biến: taxVer tăng mỗi khi bộ phân loại đổi để mọi nơi render lại; taxReady = đã nạp xong cấu hình.
  const [taxVer, setTaxVer] = useState(0)
  const [taxReady, setTaxReady] = useState(false)
  const [taxSha, setTaxSha] = useState<string | null>(null)
  const sortPrefRef = useRef(sortPref)
  sortPrefRef.current = sortPref

  // --- Đồng bộ trang đang xem với địa chỉ web (nút Quay lại, chia sẻ link) ---
  const route: Route = { page, openId, editing, reading, scanMode, adding, q, group, cat, sort, fmt, topic, added, pg: pgState.pg, refList: page === 'refs' ? refView : null, person: page === 'people' ? person : null }
  const routeHash = formatRoute(route)
  const navMode = useRef<'push' | 'replace'>('replace')
  const lastRoute = useRef(route)
  useEffect(() => {
    const cur = window.location.hash || '#/'
    if (cfg && !taxReady) return // chờ nạp phân loại để không làm mất tham số nhóm/danh mục trong địa chỉ
    if (routeHash !== cur) {
      const mode = navMode.current === 'replace' || onlyQueryChanged(lastRoute.current, route) ? 'replace' : 'push'
      writeHistory(routeHash, mode)
    }
    navMode.current = 'push'
    lastRoute.current = route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeHash, taxReady])

  useEffect(() => {
    const onPop = () => {
      const r = parseRoute(window.location.hash)
      setPage(r.page)
      setOpenId(r.openId)
      setEditing(r.editing)
      setReading(r.reading)
      setScanMode(r.scanMode)
      setAdding(r.adding)
      setQ(r.q)
      setGroup(r.group)
      setCat(r.cat)
      setSort(r.sort)
      setFmt(r.fmt)
      setAdded(r.added)
      setTopic(r.topic)
      setRefView(r.refList)
      setPerson(r.person)
      setPgState({ pg: r.pg, key: `${r.q}|${r.group}|${r.cat}|${r.fmt}|${r.sort ?? (r.q.trim() ? 'phu-hop' : sortPrefRef.current)}` })
      setQueue(null)
      const y = savedScroll() ?? 0
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const doLogout = () => {
    clearConfig()
    replaceNext()
    setConfirmLogout(false)
    setCfg(null)
    setBooks([])
    setQ('')
    setOpenId(null)
    setEditing(false)
    setReading(null)
    setScanMode(null)
    setAdding(false)
    setPage('library')
  }

  /** Sửa danh mục tài liệu: cập nhật ngay trên màn hình, ghi lên repo sau 1,5 giây yên lặng. */
  const changeLists = (fn: (ls: RefList[]) => RefList[], message: string) => {
    const next = fn(refListsRef.current)
    refListsRef.current = next
    setRefLists(next)
    if (!cfg) return
    window.clearTimeout(refTimer.current)
    refTimer.current = window.setTimeout(() => {
      saveRefLists(cfg, refListsRef.current, refSha.current, message)
        .then((sha) => (refSha.current = sha))
        .catch((e: Error) => setNotice({ title: 'Chưa lưu được danh mục tài liệu', text: e.message }))
    }, 1500)
  }
  const now = () => new Date().toISOString()
  const patchList = (id: string, patch: Partial<Pick<RefList, 'books' | 'style' | 'numbered' | 'name'>>) =>
    changeLists((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: now() } : l)), `Danh mục tài liệu: ${refListsRef.current.find((l) => l.id === id)?.name ?? ''}`)
  const togglePick = (id: string) => {
    if (targetList) {
      const has = targetList.books.includes(id)
      patchList(targetList.id, { books: has ? targetList.books.filter((x) => x !== id) : [...targetList.books, id] })
    } else setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const [buyMode, setBuyMode] = useState(false)
  useEffect(() => setMoreOpen(false), [page, openId])
  const goTab = (pg: typeof page) => {
    setPage(pg); setOpenId(null); setAdding(false); setScanMode(null); setEditing(false); setReading(null); window.scrollTo(0, 0)
  }
  // Thanh tab: trên điện thoại chỉ hiện 4 mục chính, các mục "more" nằm trong nút "Thêm".
  const navTabs: { id: typeof page; label: string; title: string; more?: boolean; mOrder?: number; deskIcon?: boolean; icon: React.ReactNode; go: () => void }[] = [
    { id: 'library', label: 'Thư viện', title: 'Danh sách sách', icon: <><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2z" /><path d="M8 7h7" /></>, go: () => { setPage('library'); setOpenId(null); setAdding(false); setScanMode(null); setEditing(false); setReading(null) } },
    { id: 'stats', label: 'Thống kê', title: 'Thống kê và phân tích thư viện', icon: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, go: () => goTab('stats') },
    { id: 'quotes', label: 'Trích dẫn', title: 'Các đoạn trích đã lưu', more: true, icon: <><path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6" /></>, go: () => goTab('quotes') },
    { id: 'people', label: 'Tác giả', title: 'Tác giả và nhân vật lịch sử', mOrder: 3, icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>, go: () => openPerson(null) },
    { id: 'suggest', label: 'Gợi ý', title: 'Sách nên bổ sung vào tủ', more: true, icon: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></>, go: () => goTab('suggest') },
    { id: 'refs', label: 'Tài liệu', title: 'Danh mục tài liệu tham khảo theo bài viết', more: true, icon: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></>, go: () => openRefs(null) },
    { id: 'games', label: 'Trò chơi', title: 'Nông trại, mì cay và các trò khác', mOrder: 4, deskIcon: true, icon: <><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 11v3M5.5 12.5h3" /><circle cx="16" cy="11.5" r="0.9" fill="currentColor" /><circle cx="18" cy="13.5" r="0.9" fill="currentColor" /></>, go: () => goTab('games') },
    { id: 'settings', label: 'Cài đặt', title: 'Phân loại sách, sao lưu, xuất dữ liệu', more: true, deskIcon: true, icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, go: () => goTab('settings') },
  ]

  const openPerson = (name: string | null) => {
    setPage('people')
    setPerson(name)
    setOpenId(null)
    setAdding(false)
    setScanMode(null)
    setEditing(false)
    setReading(null)
    window.scrollTo(0, 0)
  }

  const openRefs = (view: string | null) => {
    setSelecting(false)
    setOpenId(null)
    setAdding(false)
    setEditing(false)
    setReading(null)
    setScanMode(null)
    if (view) setPickTarget(view)
    setRefView(view)
    setPage('refs')
    window.scrollTo(0, 0)
  }

  /** Quay về trang trước trong lịch sử nếu nó thuộc ứng dụng; nếu không (mở thẳng từ link) thì tự chuyển trang. */
  const goBack = (fallback: () => void) => {
    if (historyDepth() > 0) window.history.back()
    else fallback()
  }
  /** Lần chuyển trang kế tiếp thay thế mục lịch sử hiện tại thay vì thêm mục mới. */
  const replaceNext = () => {
    navMode.current = 'replace'
  }

  useEffect(() => {
    if (!cfg) return
    setLoading(true)
    setError(null)
    setTaxReady(false)
    // Phân loại tùy biến: lỗi hay thiếu tệp thì dùng bộ mặc định, không chặn việc xem sách.
    const tax = fetchTaxonomy(cfg)
      .then((t) => {
        const parsed = t ? parseTaxonomy(t.data) : null
        applyTaxonomy(parsed ?? DEFAULT_GROUPS)
        setTaxSha(t?.sha ?? null)
      })
      .catch(() => applyTaxonomy(DEFAULT_GROUPS))
    setExError(null)
    // Trích dẫn: lỗi không chặn việc xem sách.
    const ex = fetchExcerpts(cfg)
      .then(setExcerpts)
      .catch((e: Error) => setExError(e.message))
    const rc = readConfigFile<ReaderConfig>(cfg, 'reader')
      .then((r) => {
        setReaderCfg(r?.data ?? {})
        setReaderSha(r?.sha ?? null)
      })
      .catch(() => undefined)
    loadRefLists(cfg)
      .then((r) => {
        refSha.current = r.sha
        setRefLists(r.lists)
        refLoaded.current = true
      })
      .catch(() => undefined)
    Promise.all([fetchCatalog(cfg).then(setBooks), tax, ex, rc])
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        // Đọc lại nhóm/danh mục từ địa chỉ web theo bộ phân loại vừa nạp (có thể là nhóm tùy biến).
        const r = parseRoute(window.location.hash)
        setGroup(r.group)
        setCat(r.cat)
        setTaxVer((v) => v + 1)
        setTaxReady(true)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const index = useMemo(() => buildIndex(books), [books, taxVer])
  const allTopics = useMemo(() => topicCounts(excerpts).map((t) => t.topic), [excerpts])
  const excerptActions: ExcerptActions = {
    onSave: async (ex) => {
      if (!cfg) return
      const isNew = !excerpts.some((e) => e.id === ex.id)
      const b = books.find((x) => x.id === ex.bookId)
      await saveExcerpts(cfg, { upserts: [ex] }, `${isNew ? 'Thêm' : 'Sửa'} trích dẫn: ${b?.title ?? ex.bookId}${ex.page ? `, tr. ${ex.page}` : ''}`)
      setExcerpts((prev) => (isNew ? [...prev, ex] : prev.map((e) => (e.id === ex.id ? ex : e))))
    },
    onDelete: async (ex) => {
      if (!cfg) return
      const b = books.find((x) => x.id === ex.bookId)
      try {
        await saveExcerpts(cfg, { removeIds: [ex.id] }, `Xóa trích dẫn: ${b?.title ?? ex.bookId}${ex.page ? `, tr. ${ex.page}` : ''}`)
        setExcerpts((prev) => prev.filter((e) => e.id !== ex.id))
      } catch (e) {
        setNotice({ title: 'Không xóa được trích dẫn', text: (e as Error).message })
      }
    },
  }
  const openTopic = (t: string | null) => {
    setPage('quotes')
    setOpenId(null)
    setEditing(false)
    setTopic(t)
    window.scrollTo(0, 0)
  }
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const backupDue =
    !!cfg && !loading && books.length > 0 &&
    (!lastBackup || Date.now() - new Date(lastBackup).getTime() > 7 * 86_400_000) &&
    (!snooze || Date.now() > new Date(snooze).getTime())
  const openBook = openId ? byId.get(openId) : undefined
  const readingHolding =
    openBook && reading !== null && openBook.holdings[reading]?.kind === 'ebook'
      ? (openBook.holdings[reading] as EbookHolding)
      : null

  useEffect(() => {
    const base = 'Pochacco Library'
    document.title = openBook ? `${openBook.title} · ${base}` : page === 'stats' ? `Thống kê · ${base}` : page === 'settings' ? `Cài đặt · ${base}` : page === 'quotes' ? `Trích dẫn · ${base}` : page === 'games' ? `Trò chơi · ${base}` : page === 'refs' ? `Tài liệu tham khảo · ${base}` : page === 'people' ? `${person ?? 'Tác giả'} · ${base}` : page === 'suggest' ? `Gợi ý bổ sung · ${base}` : base
  }, [openBook, page])
  const searching = q.trim().length > 0
  const matched = searching ? index.search(q).map((r) => byId.get(r.id as string)!).filter(Boolean) : books
  const inGroup = (b: Book, g: number) =>
    g < 0 || (b.categories ?? []).some((c) => CATEGORY_GROUPS[g].items.some((i) => i.id === c))
  const groupCount = (g: number) => matched.filter((b) => inGroup(b, g)).length
  const catCount = (id: string) => matched.filter((b) => b.categories?.includes(id)).length
  const inCats = matched.filter((b) => (cat ? b.categories?.includes(cat) : inGroup(b, group)))
  const addedOk = addedMatcher(added)
  const inAdded = added ? inCats.filter(addedOk) : inCats
  const addedCount = (f: string) => inCats.filter(addedMatcher(f)).length
  const fmtCount = (k: FormatFilter) => (k ? inAdded.filter((b) => formatOf(b) === k).length : inAdded.length)
  const filtered = fmt ? inAdded.filter((b) => formatOf(b) === fmt) : inAdded
  const filtering = searching || group >= 0 || fmt !== null || added !== null
  // Đang tìm thì mặc định xếp theo độ phù hợp; không tìm thì theo lựa chọn đã nhớ.
  const sortKey: SortKey = sort ?? (searching ? 'phu-hop' : sortPref)
  const sorted = sortBooks(filtered, sortKey === 'phu-hop' && !searching ? 'moi' : sortKey)
  const listKey = `${q}|${group}|${cat}|${fmt}|${added}|${sortKey}`
  // Lần đầu (key rỗng) chấp nhận số trang từ địa chỉ web; sau đó chỉ giữ khi bộ lọc không đổi.
  const wantedPg = pgState.key === '' || pgState.key === listKey ? pgState.pg : 1
  const pages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize))
  const curPage = Math.min(Math.max(1, wantedPg), pages)
  const startIdx = pageSize === 0 ? 0 : (curPage - 1) * pageSize
  const results = pageSize === 0 ? sorted : sorted.slice(startIdx, startIdx + pageSize)
  // Ghi lại trang đã chỉnh (vượt quá số trang, hay bộ lọc vừa đổi) để địa chỉ web khớp với màn hình.
  if (!loading && sorted.length > 0 && (curPage !== pgState.pg || pgState.key !== listKey)) {
    setPgState({ pg: curPage, key: listKey })
  }
  const goPage = (p: number) => {
    setPgState({ pg: p, key: listKey })
    window.scrollTo(0, 0)
  }

  return (
    <>
      <header className="hero">
        <div className="hero-art" aria-hidden="true" />
        <Anim name="walk" className="hero-walker" />
        <div className="hero-inner">
          <div className="hero-text">
            <h1>
              <img className="wordmark" src={asset('wordmark.webp')} alt="Pochacco Library" width={900} height={308} />
            </h1>
            <p className="hero-sub">Thư viện sách cá nhân</p>
            {cfg && !loading && books.length > 0 && (
              <p className="hero-stats">
                <span><b>{books.length.toLocaleString('vi-VN')}</b> đầu sách</span>
                <span><b>{books.filter((b) => b.holdings.some((h) => h.kind === 'print')).length.toLocaleString('vi-VN')}</b> sách giấy</span>
                <span><b>{books.filter((b) => b.holdings.some((h) => h.kind === 'ebook')).length.toLocaleString('vi-VN')}</b> sách điện tử</span>
                {excerpts.length > 0 && <span><b>{excerpts.length.toLocaleString('vi-VN')}</b> trích dẫn</span>}
              </p>
            )}
          </div>
        </div>
      </header>
      {cfg && (
        <nav className="topbar" aria-label="Trang">
          <div className="pages">
            {navTabs.map((t) => (
              <button
                key={t.id}
                className={`page-tab ${t.more ? 'tab-more' : 'tab-main'}${page === t.id ? ' active' : ''}`}
                onClick={t.go}
                title={t.title}
                aria-current={page === t.id ? 'page' : undefined}
                style={t.mOrder ? ({ '--m-order': t.mOrder } as CSSProperties) : undefined}
              >
                <svg className={`tab-icon${t.deskIcon ? ' desk' : ''}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.icon}
                </svg>
                <span className="tab-text">{t.label}</span>
              </button>
            ))}
            {(() => {
              const cur = navTabs.find((t) => t.more && t.id === page)
              return (
                <button
                  className={`page-tab tab-morebtn${cur ? ' active' : ''}${moreOpen ? ' open' : ''}`}
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  onClick={() => setMoreOpen((o) => !o)}
                >
                  <svg className="tab-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {cur ? cur.icon : <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>}
                  </svg>
                  <span className="tab-text">{cur ? cur.label : 'Thêm'}</span>
                </button>
              )
            })()}
            <button className="logout" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => setConfirmLogout(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
          {moreOpen && (
            <>
              <div className="more-backdrop" onClick={() => setMoreOpen(false)} />
              <div className="more-menu" role="menu">
                {navTabs.filter((t) => t.more).map((t) => (
                  <button key={t.id} role="menuitem" className={page === t.id ? 'on' : ''} onClick={() => { setMoreOpen(false); t.go() }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {t.icon}
                    </svg>
                    <span>
                      <b>{t.label}</b>
                      <small>{t.title}</small>
                    </span>
                  </button>
                ))}
                <button role="menuitem" className="danger-item" onClick={() => { setMoreOpen(false); setConfirmLogout(true) }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  <span>
                    <b>Đăng xuất</b>
                    <small>Thoát khỏi thư viện trên máy này</small>
                  </span>
                </button>
              </div>
            </>
          )}
        </nav>
      )}
      <main>
        {!cfg ? (
          creating ? (
            <CreateAccount onBack={() => setCreating(false)} />
          ) : (
            <Login onLogin={setCfg} onCreate={() => setCreating(true)} />
          )
        ) : queue && queue.ids.length && byId.get(queue.ids[0]) ? (
          <BookForm
            key={`queue-${queue.ids[0]}`}
            cfg={cfg}
            books={books}
            initial={byId.get(queue.ids[0])}
            cancelLabel="Bỏ qua cuốn này"
            banner={
              <div className="queue-bar">
                <span>
                  Bổ sung thông tin: cuốn <b>{queue.total - queue.ids.length + 1}</b>/{queue.total}
                </span>
                <button type="button" className="link" onClick={() => setQueue(null)}>
                  Dừng, làm sau
                </button>
              </div>
            }
            onCancel={() => {
              const rest = queue.ids.slice(1)
              setQueue(rest.length ? { ...queue, ids: rest } : null)
              if (!rest.length) setNotice({ title: 'Đã xem hết danh sách', text: `${queue.total} sách mới; cuốn nào bỏ qua có thể bổ sung sau ở trang Thống kê, mục Cần bổ sung.` })
              window.scrollTo(0, 0)
            }}
            onSaved={(b) => {
              setBooks((prev) => prev.map((x) => (x.id === b.id ? b : x)))
              const rest = queue.ids.slice(1)
              setQueue(rest.length ? { ...queue, ids: rest } : null)
              if (!rest.length) setNotice({ title: 'Đã bổ sung xong', text: `${queue.total} sách mới đã được xem qua.` })
              window.scrollTo(0, 0)
            }}
          />
        ) : page === 'suggest' && !openId && !adding ? (
          loading ? (
            <State img="anim-read" title="Pochacco đang xem tủ sách..." />
          ) : (
            <SuggestPage
              cfg={cfg}
              books={books}
              onWish={(d) => {
                setPrefill(d)
                setDupFrom(null)
                setAdding(true)
                window.scrollTo(0, 0)
              }}
            />
          )
        ) : page === 'people' && !openId ? (
          loading ? (
            <State img="anim-read" title="Pochacco đang tìm sách..." />
          ) : (
            <PersonPage
              cfg={cfg}
              books={books}
              excerpts={excerpts}
              person={person}
              onPerson={openPerson}
              onOpen={(b) => {
                setOpenId(b.id)
                window.scrollTo(0, 0)
              }}
              onCategory={(id) => {
                setPage('library'); setQ('')
                setGroup(CATEGORY_GROUPS.findIndex((g) => g.items.some((x) => x.id === id)))
                setCat(id); window.scrollTo(0, 0)
              }}
            />
          )
        ) : page === 'refs' ? (
          <RefsPage
            view={refView}
            lists={refLists}
            tempIds={picked}
            byId={byId}
            onView={(v) => {
              if (v) setPickTarget(v)
              setRefView(v)
              window.scrollTo(0, 0)
            }}
            onCreate={(name, ids) => {
              const id = newListId()
              const t = now()
              changeLists((ls) => [...ls, { id, name, style: (localStorage.getItem('pochacco-library:cite-style') as RefList['style']) || 'vn', numbered: true, books: ids, createdAt: t, updatedAt: t }], `Tạo danh mục tài liệu: ${name}`)
              setPickTarget(id)
              setRefView(id)
            }}
            onRename={(id, name) => patchList(id, { name })}
            onDelete={(id) => {
              changeLists((ls) => ls.filter((l) => l.id !== id), 'Xóa danh mục tài liệu')
              if (pickTarget === id) setPickTarget('tam')
              setRefView(null)
            }}
            onPatch={patchList}
            onTempChange={(ids) => setPicked(() => ids)}
            onPickMore={(v) => {
              setPickTarget(v)
              setPage('library')
              setSelecting(true)
              window.scrollTo(0, 0)
            }}
            onOpenBook={(b) => {
              setPage('library')
              setOpenId(b.id)
              window.scrollTo(0, 0)
            }}
            onEditBook={(b) => {
              setPage('library')
              setOpenId(b.id)
              setEditing(true)
              window.scrollTo(0, 0)
            }}
            onBulk={(bs) => setBulk(bs)}
          />
        ) : page === 'games' ? (
          <Suspense fallback={<State img="anim-read" title="Pochacco đang dọn sân chơi..." />}>
            <GamesPage
              cfg={cfg}
              books={books}
              onOpenBook={(b) => {
                setPage('library')
                setOpenId(b.id)
                window.scrollTo(0, 0)
              }}
            />
          </Suspense>
        ) : page === 'quotes' ? (
          loading ? (
            <State img="anim-read" title="Pochacco đang gom trích dẫn..." />
          ) : exError ? (
            <State img="anim-sleepy" title="Không tải được trích dẫn" text={exError} />
          ) : (
            <QuotesPage
              excerpts={excerpts}
              books={byId}
              topic={topic}
              onTopic={setTopic}
              actions={excerptActions}
              onOpenBook={(b) => {
                setPage('library')
                setOpenId(b.id)
                window.scrollTo(0, 0)
              }}
            />
          )
        ) : page === 'settings' ? (
          loading ? (
            <State img="anim-read" title="Pochacco đang mở tủ sách..." />
          ) : (
            <>
            <Settings
              cfg={cfg}
              books={books}
              taxSha={taxSha}
              onSaved={(groups: CategoryGroup[], changed, sha) => {
                applyTaxonomy(groups)
                setTaxSha(sha)
                if (changed.length) {
                  const upd = new Map(changed.map((b) => [b.id, b]))
                  setBooks((prev) => prev.map((b) => upd.get(b.id) ?? b))
                }
                // Bộ lọc đang chọn có thể đã bị xóa hay đổi chỗ.
                setGroup(-1)
                setCat(null)
                setTaxVer((v) => v + 1)
              }}
            />
            <ReaderSettings
              cfg={cfg}
              books={books}
              config={readerCfg}
              sha={readerSha}
              onSaved={(c, sha) => {
                setReaderCfg(c)
                setReaderSha(sha)
              }}
            />
            <BackupPanel
              cfg={cfg}
              books={books}
              excerpts={excerpts}
              onRestored={() => {
                fetchCatalog(cfg).then(setBooks).catch(() => undefined)
                fetchExcerpts(cfg).then(setExcerpts).catch(() => undefined)
              }}
            />
            </>
          )
        ) : page === 'stats' ? (
          loading ? (
            <State img="anim-read" title="Pochacco đang đếm sách..." />
          ) : (
            <Stats
              books={books}
              onSearch={(text) => {
                setPage('library'); setGroup(-1); setCat(null); setQ(text); window.scrollTo(0, 0)
              }}
              onGroup={(i) => {
                setPage('library'); setQ(''); setGroup(i); setCat(null); window.scrollTo(0, 0)
              }}
              onCategory={(id) => {
                setPage('library'); setQ('')
                setGroup(CATEGORY_GROUPS.findIndex((g) => g.items.some((x) => x.id === id)))
                setCat(id); window.scrollTo(0, 0)
              }}
              onOpen={(b) => {
                setPage('library'); setOpenId(b.id); window.scrollTo(0, 0)
              }}
              onPerson={openPerson}
            />
          )
        ) : openId && byId.get(openId) && editing ? (
          <BookForm
            key={`edit-${openId}-${buyMode}`}
            cfg={cfg}
            books={books}
            initial={byId.get(openId)}
            markBought={buyMode}
            banner={
              buyMode ? (
                <div className="dup-banner">
                  <b>Đã mua «{byId.get(openId)!.title}»</b>
                  <span>Trạng thái đã chuyển sang “Đang có”, ngày mua là hôm nay. Ghi giá mua, giá bìa, nơi mua và vị trí kệ rồi bấm Lưu.</span>
                </div>
              ) : undefined
            }
            onCancel={() => goBack(() => { setEditing(false); setBuyMode(false) })}
            onSaved={(b) => {
              setBooks((prev) => prev.map((x) => (x.id === b.id ? b : x)))
              goBack(() => { setEditing(false); setBuyMode(false) })
            }}
          />
        ) : openId && byId.get(openId) ? (
          <>
                        <BookDetail
              key={openId}
              cfg={cfg}
              book={byId.get(openId)!}
              excerpts={excerpts}
              allTopics={allTopics}
              excerptActions={excerptActions}
              onTopic={(t) => openTopic(t)}
              books={books}
              onDuplicate={() => {
                const src = byId.get(openId)!
                setPrefill(duplicateDraft(src))
                setDupFrom(src)
                setDupMode('copy')
                setAdding(true)
                setOpenId(null)
                setEditing(false)
                window.scrollTo(0, 0)
              }}
              picked={workingIds.includes(openId)}
              pickName={targetList?.name}
              onTogglePick={() => togglePick(openId)}
              onAddEdition={() => {
                const src = byId.get(openId)!
                setPrefill(editionDraft(src))
                setDupFrom(src)
                setDupMode('edition')
                setAdding(true)
                setOpenId(null)
                setEditing(false)
                window.scrollTo(0, 0)
              }}
              onOpen={(b) => {
                setOpenId(b.id)
                window.scrollTo(0, 0)
              }}
              onPerson={openPerson}
              onSearch={(text) => {
                setOpenId(null)
                setGroup(-1)
                setCat(null)
                setQ(text)
                window.scrollTo(0, 0)
              }}
              onRead={(h) => setReading(byId.get(openId)!.holdings.indexOf(h))}
              onCategory={(id) => {
                setOpenId(null)
                setQ('')
                setGroup(CATEGORY_GROUPS.findIndex((g) => g.items.some((i) => i.id === id)))
                setCat(id)
                window.scrollTo(0, 0)
              }}
              onBack={() => goBack(() => setOpenId(null))}
              onEdit={() => { setBuyMode(false); setEditing(true); window.scrollTo(0, 0) }}
              onBought={() => { setBuyMode(true); setEditing(true); window.scrollTo(0, 0) }}
              onDeleted={(b) => {
                setBooks((prev) => prev.filter((x) => x.id !== b.id))
                const orphan = excerpts.filter((e) => e.bookId === b.id).map((e) => e.id)
                if (orphan.length && cfg)
                  void saveExcerpts(cfg, { removeIds: orphan }, `Xóa ${orphan.length} trích dẫn của sách đã xóa: ${b.title}`)
                    .then(() => setExcerpts((prev) => prev.filter((e) => e.bookId !== b.id)))
                    .catch(() => undefined)
                replaceNext()
                setOpenId(null)
                setSaved(null)
                setNotice({ title: 'Đã xóa khỏi thư viện', text: b.title })
              }}
            />
          </>
        ) : scanMode === 'one' ? (
          <ScanOne
            cfg={cfg}
            books={books}
            onCancel={() => goBack(() => setScanMode(null))}
            onOpen={(b) => {
              replaceNext()
              setScanMode(null)
              setOpenId(b.id)
              window.scrollTo(0, 0)
            }}
            onPrefill={(d) => {
              replaceNext()
              setScanMode(null)
              setPrefill(d)
              setAdding(true)
              window.scrollTo(0, 0)
            }}
          />
        ) : scanMode === 'ebooks' ? (
          <ImportEbooks
            cfg={cfg}
            books={books}
            onCancel={() => goBack(() => setScanMode(null))}
            onDone={(added, updated) => {
              const upd = new Map(updated.map((b) => [b.id, b]))
              setBooks((prev) => [...added, ...prev.map((b) => upd.get(b.id) ?? b)])
              goBack(() => setScanMode(null))
              setSaved(null)
              setNotice({
                title: 'Đã nhập sách điện tử',
                text: `${added.length} sách mới${updated.length ? `, gắn bản điện tử vào ${updated.length} sách có sẵn` : ''}.`,
                queue: added.map((b) => b.id),
              })
              window.scrollTo(0, 0)
            }}
          />
        ) : scanMode === 'shelf' ? (
          <ShelfScan
            cfg={cfg}
            books={books}
            onCancel={() => goBack(() => setScanMode(null))}
            onDone={(added, updated, shelfName) => {
              const upd = new Map(updated.map((b) => [b.id, b]))
              setBooks((prev) => [...added, ...prev.map((b) => upd.get(b.id) ?? b)])
              goBack(() => setScanMode(null))
              setSaved(null)
              setNotice({
                title: `Đã lưu kệ ${shelfName || '(chưa đặt tên)'}`,
                text: `${added.length} sách mới${updated.length ? `, chuyển ${updated.length} cuốn sang kệ này` : ''}.`,
              })
            }}
          />
        ) : adding ? (
          <BookForm
            key={dupFrom ? `dup-${dupMode}-${dupFrom.id}` : prefill ? `prefill-${prefill.isbn13}` : 'new'}
            cfg={cfg}
            books={books}
            prefill={prefill ?? undefined}
            banner={
              dupFrom && dupMode === 'edition' ? (
                <div className="dup-banner">
                  <b>Thêm bản bìa khác của «{dupFrom.title}»</b>
                  <span>
                    Đã giữ nhan đề, tác giả, xuất bản, phân loại và vị trí kệ; loại bìa đã đặt sẵn, anh đổi lại nếu cần. Nhập ISBN,
                    số trang và khổ sách của bản này. Hai bản sẽ hiện trong mục “Các bản khác của cuốn này”. Khi lưu, nếu app hỏi trùng sách, chọn
                    “Vẫn lưu (ấn bản khác)”.
                  </span>
                </div>
              ) : dupFrom ? (
                <div className="dup-banner">
                  <b>Nhân bản từ «{dupFrom.title}»</b>
                  <span>
                    Đã chép tác giả, xuất bản, phân loại, bộ sách, mô tả và vị trí kệ
                    {dupFrom.seriesNo !== undefined ? `; số tập tăng lên ${dupFrom.seriesNo + 1}` : ''}. Đã bỏ ISBN, số
                    trang, ảnh bìa, bản điện tử và ghi chú. Nhớ sửa nhan đề (bỏ chữ “Copy of”, thêm số tập).
                  </span>
                </div>
              ) : undefined
            }
            onCancel={() => {
              goBack(() => setAdding(false))
              setPrefill(null)
              setDupFrom(null)
            }}
            onSaved={(b) => {
              setBooks((prev) => [b, ...prev])
              replaceNext()
              setAdding(false)
              setPrefill(null)
              if (dupFrom) {
                // Mở luôn cuốn vừa tạo để có thể nhân bản tiếp cho tập sau.
                setDupFrom(null)
                setOpenId(b.id)
                window.scrollTo(0, 0)
              } else {
                setSaved(b)
                setQ('')
              }
            }}
          />
        ) : (
          <>
            {notice && (
              <div className="toast toast-anim">
                <Anim name="carry" />
                <div>
                  <div className="state-title">{notice.title}</div>
                  <div className="muted">{notice.text}</div>
                  {!!notice.queue?.length && (
                    <button
                      className="small-btn toast-action"
                      onClick={() => {
                        setQueue({ ids: notice.queue!, total: notice.queue!.length })
                        setNotice(null)
                        window.scrollTo(0, 0)
                      }}
                    >
                      Bổ sung thông tin cho {notice.queue.length} sách mới
                    </button>
                  )}
                </div>
                <button className="link" onClick={() => setNotice(null)}>
                  Đóng
                </button>
              </div>
            )}
            {saved && (
              <div className="toast toast-anim">
                <Anim name="carry" />
                <div>
                  <div className="state-title">Pochacco đã xếp sách lên kệ</div>
                  <div className="muted">{saved.title}</div>
                </div>
                <button className="link" onClick={() => setSaved(null)}>
                  Đóng
                </button>
              </div>
            )}
            {backupDue && (
              <div className="backup-nudge">
                <span>
                  {lastBackup ? `Đã ${Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000)} ngày chưa tải bản sao lưu về máy.` : 'Chưa có bản sao lưu nào trên máy này.'} Nên giữ một bản ngoài GitHub phòng khi cần khôi phục.
                </span>
                <button
                  className="small-btn"
                  disabled={backupBusy}
                  onClick={() => {
                    setBackupBusy(true)
                    downloadBackup(cfg, false)
                      .then((m) => {
                        setLastBackup(m.createdAt)
                        setNotice({ title: 'Đã tải bản sao lưu', text: `${m.books} sách, ${m.excerpts} trích dẫn. Cất tệp .zip ở nơi an toàn (Google Drive, máy tính).` })
                      })
                      .catch((e: Error) => setNotice({ title: 'Chưa tải được bản sao lưu', text: e.message }))
                      .finally(() => setBackupBusy(false))
                  }}
                >
                  {backupBusy ? 'Đang nén…' : 'Tải bản sao lưu'}
                </button>
                <button
                  className="link"
                  onClick={() => {
                    const until = new Date(Date.now() + 3 * 86_400_000).toISOString()
                    localStorage.setItem(SNOOZE_KEY, until)
                    setSnooze(until)
                  }}
                >
                  Nhắc sau
                </button>
              </div>
            )}
            <div className="toolbar">
              <button className="secondary" onClick={() => { setSaved(null); setNotice(null); setScanMode('shelf') }}>
                Quét theo kệ
              </button>
              <button className="secondary" onClick={() => { setSaved(null); setNotice(null); setScanMode('one') }}>
                Quét ISBN
              </button>
              <button className="secondary" onClick={() => { setSaved(null); setNotice(null); setScanMode('ebooks') }}>
                Nhập sách điện tử
              </button>
              <button onClick={() => { setSaved(null); setNotice(null); setPrefill(null); setAdding(true) }}>+ Thêm sách</button>
              <button className={selecting ? '' : 'secondary'} onClick={() => setSelecting(!selecting)} aria-pressed={selecting}>
                {selecting ? 'Xong, thôi chọn' : 'Chọn sách để trích dẫn'}
              </button>
            </div>
            {selecting && (
              <p className="pick-hint">
                {targetList ? <>Đang chọn sách cho danh mục <b>«{targetList.name}»</b>. </> : null}
                Chạm vào cuốn sách để chọn hoặc bỏ chọn. Có thể tìm kiếm, đổi danh mục rồi chọn tiếp; các cuốn đã chọn vẫn được giữ.
              </p>
            )}
            <input
              className="search"
              autoFocus
              placeholder="Tìm nhan đề, tác giả, dịch giả, NXB, ISBN... (gõ không dấu cũng được)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <img className="divider" src={asset('sticker-divider.webp')} alt="" />
            {books.length > 0 && (
              <nav className="filter">
                <div className="tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={group < 0}
                    className={group < 0 ? 'tab active' : 'tab'}
                    onClick={() => { setGroup(-1); setCat(null) }}
                  >
                    Tất cả
                    {matched.length > 0 && <span className="count">{matched.length}</span>}
                  </button>
                  {CATEGORY_GROUPS.map((g, i) => {
                    const n = groupCount(i)
                    return (
                      <button
                        key={g.label}
                        role="tab"
                        aria-selected={group === i}
                        className={`tab${group === i ? ' active' : ''}${n === 0 ? ' empty' : ''}`}
                        onClick={() => { setGroup(i); setCat(null) }}
                      >
                        {g.label}
                        {n > 0 && <span className="count">{n}</span>}
                      </button>
                    )
                  })}
                </div>
                {group >= 0 && (
                  <div className="subtabs">
                    <button className={cat === null ? 'subtab active' : 'subtab'} onClick={() => setCat(null)}>
                      Cả nhóm
                    </button>
                    {CATEGORY_GROUPS[group].items.map((c) => {
                      const n = catCount(c.id)
                      return (
                        <button
                          key={c.id}
                          className={`subtab${cat === c.id ? ' active' : ''}${n === 0 ? ' empty' : ''}`}
                          onClick={() => setCat(c.id)}
                        >
                          {c.label}
                          {n > 0 && <span className="count">{n}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </nav>
            )}
            {loading && <State img="anim-read" title="Pochacco đang lật danh mục..." />}
            {error && (
              <State img="anim-sleepy" title="Chưa tải được danh mục" text={error} />
            )}
            {!loading && !error && books.length === 0 && (
              <div className="empty">
                <img src={asset('empty-shelf.webp')} alt="" />
                <div className="state-title">Kệ sách còn trống</div>
                <div className="muted">Thêm cuốn sách đầu tiên để bắt đầu biên mục.</div>
              </div>
            )}
            {!loading && !error && books.length > 0 && (
              <div className="fmt-filter" role="group" aria-label="Lọc theo dạng sách">
                {[{ key: null, label: 'Mọi dạng' }, ...FORMAT_OPTIONS].map((o) => {
                  const n = fmtCount(o.key as FormatFilter)
                  return (
                    <button
                      key={o.key ?? 'all'}
                      className={`fmt-pill ${o.key === 'ebook' ? 'ebook' : ''} ${fmt === o.key ? 'active' : ''}`}
                      aria-pressed={fmt === o.key}
                      onClick={() => setFmt(o.key as FormatFilter)}
                    >
                      {o.label} <span className="n">{n.toLocaleString('vi-VN')}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!loading && !error && books.length > 0 && (
              <div className="added-filter" role="group" aria-label="Lọc theo ngày nhập">
                <div className="af-chips">
                <span className="af-label">Ngày nhập</span>
                <button className={`fmt-pill ${!added ? 'active' : ''}`} aria-pressed={!added} onClick={() => { setAdded(null); setRangeOpen(false) }}>
                  Mọi lúc
                </button>
                {ADDED_PRESETS.map((p) => {
                  const n = addedCount(p.key)
                  return (
                    <button key={p.key} className={`fmt-pill ${added === p.key ? 'active' : ''}`} aria-pressed={added === p.key} disabled={!n && added !== p.key} onClick={() => { setAdded(p.key); setRangeOpen(false) }}>
                      {p.label} <span className="n">{n.toLocaleString('vi-VN')}</span>
                    </button>
                  )
                })}
                <select
                  className={`af-batch ${added && /^\d{4}-\d{2}-\d{2}$/.test(added) ? 'active' : ''}`}
                  value={added && /^\d{4}-\d{2}-\d{2}$/.test(added) ? added : ''}
                  onChange={(e) => { setAdded(e.target.value || null); setRangeOpen(false) }}
                  aria-label="Chọn đợt nhập"
                >
                  <option value="">Đợt nhập…</option>
                  {batches(inCats).map((x) => (
                    <option key={x.day} value={x.day}>
                      {fmtDay(x.day)} · {x.count} cuốn
                    </option>
                  ))}
                </select>
                <button className={`fmt-pill ${added?.includes('_') ? 'active' : ''}`} aria-expanded={rangeOpen} onClick={() => setRangeOpen(!rangeOpen)}>
                  Khoảng ngày…
                </button>
                </div>
                {rangeOpen && (
                  <form
                    className="af-range"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = new FormData(e.currentTarget)
                      const a = String(f.get('from') || '')
                      const b = String(f.get('to') || '') || dayKey(new Date())
                      if (a) setAdded(`${a}_${b}`)
                      setRangeOpen(false)
                    }}
                  >
                    <label>
                      Từ <input type="date" name="from" required max={dayKey(new Date())} defaultValue={added?.includes('_') ? added.split('_')[0] : ''} />
                    </label>
                    <label>
                      đến <input type="date" name="to" max={dayKey(new Date())} defaultValue={added?.includes('_') ? added.split('_')[1] : ''} />
                    </label>
                    <button type="submit" className="small-btn">Lọc</button>
                  </form>
                )}
                {added && filtered.length > 0 && (
                  <div className="af-bulk">
                    <span className="muted small">{addedLabel(added)}: {filtered.length.toLocaleString('vi-VN')} cuốn.</span>
                    <button
                      className="small-btn secondary"
                      onClick={() => {
                        const ids = filtered.map((b) => b.id)
                        if (targetList) patchList(targetList.id, { books: [...new Set([...targetList.books, ...ids])] })
                        else setPicked((xs) => [...new Set([...xs, ...ids])])
                        setSelecting(true)
                      }}
                    >
                      Chọn cả {filtered.length.toLocaleString('vi-VN')} cuốn
                    </button>
                  </div>
                )}
              </div>
            )}
            {!loading && !error && books.length > 0 && filtering && sorted.length === 0 && (
              <State
                img="sticker-magnifier.webp"
                title={searching ? 'Chưa có cuốn này trong thư viện' : added ? `Không có sách nhập ${addedLabel(added).toLowerCase()}` : fmt === 'ebook' ? 'Không có cuốn nào chỉ có bản điện tử' : 'Mục này chưa có sách'}
                text={searching ? 'Thử gõ ít chữ hơn, hoặc tìm theo tác giả, ISBN.' : added ? 'Chọn “Mọi lúc” để xem toàn bộ.' : fmt ? 'Chọn “Mọi dạng” để xem toàn bộ.' : 'Gắn danh mục khi thêm sách để sách hiện ở đây.'}
              />
            )}
            {!loading && !error && books.length > 0 && !(filtering && sorted.length === 0) && (
              <div className="list-head">
                <p className="muted">
                  {filtering
                    ? `${sorted.length.toLocaleString('vi-VN')} kết quả`
                    : `${books.length.toLocaleString('vi-VN')} đầu sách trong thư viện`}
                </p>
                <div className="list-controls">
                <label className="sort">
                  <span>Mỗi trang</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const n = Number(e.target.value) as PageSize
                      savePageSize(n)
                      setPageSize(n)
                      setPgState({ pg: 1, key: listKey })
                    }}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {sizeLabel(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sort">
                  <span>Sắp xếp</span>
                  <select
                    value={sortKey}
                    onChange={(e) => {
                      const k = e.target.value as SortKey
                      if (k !== 'phu-hop') {
                        saveSortPref(k)
                        setSortPref(k)
                      }
                      // Không tìm kiếm: lựa chọn được nhớ làm mặc định nên không cần ghi vào địa chỉ web.
                      // Đang tìm kiếm: mặc định là "Phù hợp nhất", chọn khác thì ghi lại.
                      setSort(searching && k !== 'phu-hop' ? k : null)
                    }}
                  >
                    {SORT_OPTIONS.filter((o) => searching || o.key !== 'phu-hop').map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              </div>
            )}
            <ul className="list">
              {results.map((b, i) => (
                <BookRow
                  key={b.id}
                  b={b}
                  cfg={cfg}
                  index={i}
                  selecting={selecting}
                  picked={workingIds.includes(b.id)}
                  onPick={() => togglePick(b.id)}
                  onOpen={() => { setNotice(null); setOpenId(b.id); window.scrollTo(0, 0) }}
                />
              ))}
            </ul>
            {sorted.length > 0 && (
              <Pager
                page={curPage}
                pages={pages}
                from={startIdx + 1}
                to={startIdx + results.length}
                total={sorted.length}
                onPage={goPage}
              />
            )}
            {sorted.length > 0 && curPage === pages && (
              <div className="list-end">
                <Anim name="read" />
                <span>
                  {filtering
                    ? `Hết ${sorted.length.toLocaleString('vi-VN')} cuốn phù hợp.`
                    : `Đã xem hết ${books.length.toLocaleString('vi-VN')} cuốn trên kệ.`}{' '}
                  Pochacco ngồi đọc tiếp đây.
                </span>
              </div>
            )}
          </>
        )}
      </main>
      {cfg && (workingIds.length > 0 || (selecting && targetList)) && page === 'library' && !adding && !editing && reading === null && !scanMode && (
        <div className="pick-bar" role="status">
          <span>
            {targetList ? (
              <>
                «{targetList.name}»: <b>{workingIds.length}</b> cuốn
              </>
            ) : (
              <>
                Đã chọn <b>{workingIds.length}</b> cuốn
              </>
            )}
          </span>
          <button className="small-btn" onClick={() => openRefs(targetList ? targetList.id : 'tam')} disabled={!workingIds.length}>
            {targetList ? 'Xem danh mục' : 'Tạo danh mục tài liệu'}
          </button>
          <button className="link" onClick={() => setBulk(workingIds.map((id) => byId.get(id)).filter((b): b is Book => !!b))} disabled={!workingIds.length}>
            Sửa hàng loạt
          </button>
          {targetList ? (
            <button className="link" onClick={() => { setSelecting(false); setPickTarget('tam') }}>
              Xong
            </button>
          ) : (
            <button className="link" onClick={() => setPicked(() => [])}>
              Bỏ chọn
            </button>
          )}
        </div>
      )}
      {cfg && bulk && (
        <BulkEdit
          cfg={cfg}
          books={bulk}
          all={books}
          onClose={() => setBulk(null)}
          onSaved={(updated) => {
            const m = new Map(updated.map((b) => [b.id, b]))
            setBooks((prev) => prev.map((b) => m.get(b.id) ?? b))
            setBulk(null)
            setNotice({ title: 'Đã sửa hàng loạt', text: `Đã cập nhật ${updated.length} cuốn.` })
          }}
        />
      )}
      {cfg && <ScrollTop />}
      {cfg && <Napper />}
      {confirmLogout && (
        <ConfirmDialog
          title="Đăng xuất khỏi thư viện?"
          text="Bạn sẽ cần nhập lại tên đăng nhập và mật khẩu để vào lại. Dữ liệu sách vẫn an toàn trên GitHub."
          confirmLabel="Đăng xuất"
          danger
          onConfirm={doLogout}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
      {openBook && readingHolding && (
        <EbookReader
          book={openBook}
          holding={readingHolding}
          onClose={() => goBack(() => setReading(null))}
          driveApiKey={readerCfg.driveApiKey}
          allTopics={allTopics}
          excerptActions={excerptActions}
          onOpenSettings={() => {
            replaceNext()
            setReading(null)
            setOpenId(null)
            setPage('settings')
          }}
        />
      )}
    </>
  )
}
