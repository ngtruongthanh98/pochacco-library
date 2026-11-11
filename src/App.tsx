import { useEffect, useMemo, useState } from 'react'
import { buildAccountFile, isValidUsername, login, LoginError } from './auth/accounts'
import { clearConfig, fetchCatalog, loadConfig, saveConfig, type StoreConfig } from './data/githubStore'
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
  const [creating, setCreating] = useState(false)
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


  return (
    <>
      <header className="hero" style={{ backgroundImage: `url(${asset('banner-wide.webp')})` }}>
        <div className="hero-inner">
          <h1>Pochacco Library</h1>
          <p>Thư viện sách cá nhân</p>
          <img className="hero-sticker" src={asset('sticker-reading.webp')} alt="" />
          {cfg && (
            <button
              className="link"
              onClick={() => {
                clearConfig()
                setCfg(null)
                setBooks([])
                setQ('')
              }}
            >
              Đăng xuất
            </button>
          )}
        </div>
      </header>
      <main>
        {!cfg ? (
          creating ? (
            <CreateAccount onBack={() => setCreating(false)} />
          ) : (
            <Login onLogin={setCfg} onCreate={() => setCreating(true)} />
          )
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
