import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, loadConfig, saveConfig, type StoreConfig } from './data/githubStore'
import { buildIndex } from './search/searchIndex'
import { nameToString, type Book } from './types/book'

function Settings({ onSave }: { onSave: (c: StoreConfig) => void }) {
  const [owner, setOwner] = useState('ngtruongthanh98')
  const [repo, setRepo] = useState('pochacco-library-data')
  const [token, setToken] = useState('')
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault()
        const cfg = { owner: owner.trim(), repo: repo.trim(), token: token.trim() }
        saveConfig(cfg)
        onSave(cfg)
      }}
    >
      <h2>Kết nối repo dữ liệu</h2>
      <p className="muted">
        Token chỉ lưu trên trình duyệt này. Dùng fine-grained token, chỉ cấp cho repo dữ liệu,
        quyền Contents.
      </p>
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
      <button type="submit">Lưu và tải danh mục</button>
    </form>
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
        {hasEbook && <span className="tag">Sách điện tử</span>}
        {b.status === 'lent' && <span className="tag warn">Đang cho mượn</span>}
      </div>
    </li>
  )
}

export default function App() {
  const [cfg, setCfg] = useState<StoreConfig | null>(() => loadConfig())
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
  const results = q.trim()
    ? index.search(q).map((r) => byId.get(r.id as string)!).filter(Boolean)
    : books.slice(0, 50)

  return (
    <main>
      <header>
        <h1>Thư viện sách</h1>
        {cfg && (
          <button className="link" onClick={() => setCfg(null)}>
            Cài đặt
          </button>
        )}
      </header>
      {!cfg ? (
        <Settings onSave={setCfg} />
      ) : (
        <>
          <input
            className="search"
            autoFocus
            placeholder="Tìm nhan đề, tác giả, dịch giả, NXB, ISBN... (gõ không dấu cũng được)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading && <p className="muted">Đang tải danh mục...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && (
            <p className="muted">
              {q.trim() ? `${results.length} kết quả` : `${books.length} đầu sách trong thư viện`}
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
  )
}
