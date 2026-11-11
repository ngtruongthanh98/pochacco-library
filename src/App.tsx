import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, loadConfig, saveConfig, type StoreConfig } from './data/githubStore'
import { buildIndex } from './search/searchIndex'
import { nameToString, type Book } from './types/book'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

function State({ img, title, text }: { img: string; title: string; text?: string }) {
  return (
    <div className="state">
      <img src={asset(img)} alt="" />
      <div>
        <div className="state-title">{title}</div>
        {text && <div className="muted">{text}</div>}
      </div>
    </div>
  )
}

function Settings({ onSave }: { onSave: (c: StoreConfig) => void }) {
  const prev = loadConfig()
  const [owner, setOwner] = useState(prev?.owner ?? 'ngtruongthanh98')
  const [repo, setRepo] = useState(prev?.repo ?? 'pochacco-library-data')
  const [token, setToken] = useState(prev?.token ?? '')
  return (
    <div className="settings">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          const cfg = { owner: owner.trim(), repo: repo.trim(), token: token.trim() }
          saveConfig(cfg)
          onSave(cfg)
        }}
      >
        <div className="card-head">
          <img src={asset('sticker-card.webp')} alt="" />
          <div>
            <h2>Kết nối kho dữ liệu</h2>
            <p className="muted">
              Token chỉ lưu trên trình duyệt này. Dùng fine-grained token, chỉ cấp cho repo dữ
              liệu, quyền Contents.
            </p>
          </div>
        </div>
        <label>
          Chủ repo
          <input value={owner} onChange={(e) => setOwner(e.target.value)} required />
        </label>
        <label>
          Repo dữ liệu
          <input value={repo} onChange={(e) => setRepo(e.target.value)} required />
        </label>
        <label>
          Token GitHub
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <button type="submit">Lưu và mở thư viện</button>
      </form>
    </div>
  )
}

function BookRow({ b }: { b: Book }) {
  const people = (b.authors ?? []).map(nameToString).join(', ')
  const print = b.holdings.find((h) => h.kind === 'print')
  const hasEbook = b.holdings.some((h) => h.kind === 'ebook')
  return (
    <li className="book">
      <div className="title">{b.title}</div>
      <div className="meta">
        {[people, b.publisher, b.year, b.pages && `${b.pages} tr.`].filter(Boolean).join(' · ')}
      </div>
      <div className="where">
        {print?.kind === 'print' && print.location && <span className="tag">Kệ {print.location}</span>}
        {hasEbook && <span className="tag olive">Sách điện tử</span>}
        {b.status === 'lent' && <span className="tag warn">Đang cho mượn</span>}
        {b.status === 'wishlist' && <span className="tag gold">Muốn mua</span>}
      </div>
    </li>
  )
}

export default function App() {
  const [cfg, setCfg] = useState<StoreConfig | null>(() => loadConfig())
  const [editing, setEditing] = useState(false)
  const [books, setBooks] = useState<Book[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!cfg) return
    setLoading(true)
    setError(null)
    fetchCatalog(cfg)
      .then(setBooks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cfg])

  const index = useMemo(() => buildIndex(books), [books])
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const searching = q.trim().length > 0
  const results = searching
    ? index.search(q).map((r) => byId.get(r.id as string)!).filter(Boolean)
    : books.slice(0, 50)

  const showSettings = !cfg || editing

  return (
    <>
      <header className="hero" style={{ backgroundImage: `url(${asset('banner-wide.webp')})` }}>
        <div className="hero-inner">
          <h1>Pochacco Library</h1>
          <p>Thư viện sách cá nhân</p>
          <img className="hero-sticker" src={asset('sticker-reading.webp')} alt="" />
          {cfg && !editing && (
            <button className="link" onClick={() => setEditing(true)}>
              Cài đặt
            </button>
          )}
        </div>
      </header>
      <main>
        {showSettings ? (
          <Settings
            onSave={(c) => {
              setCfg(c)
              setEditing(false)
            }}
          />
        ) : (
          <>
            <input
              className="search"
              autoFocus
              placeholder="Tìm nhan đề, tác giả, dịch giả, NXB, ISBN... (gõ không dấu cũng được)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <img className="divider" src={asset('sticker-divider.webp')} alt="" />
            {loading && <State img="sticker-reading.webp" title="Pochacco đang lật danh mục..." />}
            {error && (
              <State img="sticker-sleeping.webp" title="Chưa tải được danh mục" text={error} />
            )}
            {!loading && !error && books.length === 0 && (
              <div className="empty">
                <img src={asset('empty-shelf.webp')} alt="" />
                <div className="state-title">Kệ sách còn trống</div>
                <div className="muted">Thêm cuốn sách đầu tiên để bắt đầu biên mục.</div>
              </div>
            )}
            {!loading && !error && books.length > 0 && searching && results.length === 0 && (
              <State
                img="sticker-magnifier.webp"
                title="Chưa có cuốn này trong thư viện"
                text="Thử gõ ít chữ hơn, hoặc tìm theo tác giả, ISBN."
              />
            )}
            {!loading && !error && books.length > 0 && !(searching && results.length === 0) && (
              <p className="muted">
                {searching ? `${results.length} kết quả` : `${books.length} đầu sách trong thư viện`}
              </p>
            )}
            <ul className="list">
              {results.map((b) => (
                <BookRow key={b.id} b={b} />
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  )
}
