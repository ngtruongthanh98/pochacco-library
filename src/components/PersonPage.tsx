import { useEffect, useMemo, useState } from 'react'
import { categoryLabel } from '../data/categories'
import type { StoreConfig } from '../data/githubStore'
import { loadPeople, savePeople, type PersonNote } from '../data/peopleStore'
import { findCandidates, loadPerson, wikidataUrl, type Candidate, type WikiPerson } from '../data/wiki'
import { authorProfile } from '../search/insights'
import { foldVi } from '../search/normalizeVi'
import { booksAbout, peopleIndex, personKey, ROLE_LABEL, type Person, type Role } from '../search/people'
import { nameToString, type Book } from '../types/book'
import type { Excerpt } from '../types/excerpt'
import { BarList, Tile, nf } from './charts'

// Ghi chú dùng chung giữa các lần mở trang (chỉ đọc repo một lần).
type Notes = { sha: string | null; people: Record<string, PersonNote> }
let notesCache: Notes | null = null
let notesLoading: Promise<Notes> | null = null
const getNotes = (cfg: StoreConfig) => {
  if (notesCache) return Promise.resolve(notesCache)
  notesLoading ??= loadPeople(cfg)
    .then((r): Notes => (notesCache = r))
    .catch((): Notes => (notesCache = { sha: null, people: {} }))
  return notesLoading
}

const Q_CACHE = 'pochacco-library:wiki-q:'

function Hub({ books, onPerson }: { books: Book[]; onPerson: (n: string) => void }) {
  const idx = useMemo(() => peopleIndex(books), [books])
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const list = useMemo(() => {
    const f = foldVi(q.trim())
    return [...idx.values()]
      .filter((p) => (!role || p.roles[role].length) && (!f || p.variants.some((v) => foldVi(v).includes(f))))
      .sort((a, b) => b.books.length - a.books.length || a.label.localeCompare(b.label, 'vi'))
  }, [idx, q, role])
  const exact = list.some((p) => foldVi(p.label) === foldVi(q.trim()))
  return (
    <div className="people-hub">
      <section className="card">
        <h2>Tác giả và nhân vật</h2>
        <p className="muted">
          Xem tiểu sử từ Wikipedia, các sách của một người trong thư viện và các sách viết về họ. Gõ tên một tác giả, hoặc bất kỳ nhân vật lịch sử
          nào (ví dụ Trần Hưng Đạo, Nguyễn Trãi), rồi nhấn Enter.
        </p>
        <form
          className="people-search"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) onPerson(list[0] && foldVi(list[0].label) === foldVi(q.trim()) ? list[0].label : q.trim())
          }}
        >
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên tác giả hoặc nhân vật lịch sử…" aria-label="Tên người cần tra" autoFocus />
          <button type="submit" disabled={!q.trim()}>
            Tra cứu
          </button>
        </form>
        {q.trim() && !exact && (
          <p className="small">
            <button className="linkish" onClick={() => onPerson(q.trim())}>
              Tra "{q.trim()}" trên Wikipedia
            </button>
            <span className="muted"> (người này chưa có sách nào trong thư viện)</span>
          </p>
        )}
      </section>
      <section className="card">
        <div className="hub-head">
          <h3>Người có trong thư viện ({list.length})</h3>
          <div className="seg">
            {(['', 'author', 'translator', 'editor'] as const).map((r) => (
              <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
                {r ? ROLE_LABEL[r] : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <ul className="people-list">
          {list.map((p) => (
            <li key={p.key}>
              <button onClick={() => onPerson(p.label)}>
                <span className="pl-name">{p.label}</span>
                <span className="pl-meta">
                  {(Object.keys(ROLE_LABEL) as Role[])
                    .filter((r) => p.roles[r].length)
                    .map((r) => ROLE_LABEL[r].toLowerCase())
                    .join(', ')}
                </span>
                <span className="pl-count">{p.books.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function WikiCard({
  cfg,
  name,
  pkey,
  onAboutNames,
}: {
  cfg: StoreConfig
  name: string
  pkey: string
  onAboutNames: (names: string[]) => void
}) {
  const [note, setNote] = useState<PersonNote | null>(null)
  const [noteText, setNoteText] = useState('')
  const [info, setInfo] = useState<WikiPerson | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'off' | 'error'>('loading')
  const [cands, setCands] = useState<Candidate[] | null>(null)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    let dead = false
    setInfo(null)
    setCands(null)
    setPicking(false)
    setState('loading')
    ;(async () => {
      const n = (await getNotes(cfg)).people[pkey] ?? null
      if (dead) return
      setNote(n)
      setNoteText(n?.note ?? '')
      if (n?.qid === null) return setState('off')
      let qid = n?.qid ?? localStorage.getItem(Q_CACHE + pkey) ?? undefined
      try {
        if (!qid) {
          const cs = await findCandidates(name)
          if (dead) return
          setCands(cs)
          qid = cs[0]?.qid
          if (!qid) return setState('none')
          localStorage.setItem(Q_CACHE + pkey, qid)
        }
        const v = await loadPerson(qid)
        if (dead) return
        setInfo(v)
        setState('ok')
      } catch {
        if (!dead) setState('error')
      }
    })()
    return () => {
      dead = true
    }
  }, [cfg, name, pkey])

  useEffect(() => {
    if (info) onAboutNames([info.label, ...info.otherNames])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])

  const persist = async (patch: Partial<PersonNote>, msg: string) => {
    setSaving('Đang lưu…')
    try {
      const c = (await getNotes(cfg))
      const next = { ...c.people, [pkey]: { ...c.people[pkey], ...patch, updatedAt: new Date().toISOString() } }
      const n = next[pkey]
      if (n.qid === undefined && !n.note) delete next[pkey]
      c.sha = await savePeople(cfg, next, c.sha, msg)
      c.people = next
      setNote(next[pkey] ?? null)
      setSaving('Đã lưu')
      setTimeout(() => setSaving(''), 1500)
    } catch (e) {
      setSaving(e instanceof Error ? e.message : 'Không lưu được')
    }
  }

  const choose = async (qid: string | null) => {
    setPicking(false)
    if (qid) localStorage.setItem(Q_CACHE + pkey, qid)
    else localStorage.removeItem(Q_CACHE + pkey)
    await persist({ qid }, qid ? `Chọn trang Wikipedia cho ${name}` : `Không tra Wikipedia cho ${name}`)
    if (qid) {
      setState('loading')
      try {
        setInfo(await loadPerson(qid))
        setState('ok')
      } catch {
        setState('error')
      }
    } else {
      setInfo(null)
      setState('off')
    }
  }

  const openPicker = async () => {
    setPicking(true)
    if (!cands) {
      try {
        setCands(await findCandidates(name))
      } catch {
        setCands([])
      }
    }
  }

  const facts = info
    ? [
        info.born || info.birthPlace ? `Sinh: ${[info.born, info.birthPlace].filter(Boolean).join(', ')}` : '',
        info.died || info.deathPlace ? `Mất: ${[info.died, info.deathPlace].filter(Boolean).join(', ')}` : '',
        info.countries.length ? `Quốc tịch: ${info.countries.join(', ')}` : '',
        info.occupations.length ? `Nghề nghiệp: ${info.occupations.join(', ')}` : '',
      ].filter(Boolean)
    : []

  return (
    <>
      <section className="card wiki-card">
        {state === 'loading' && <p className="muted">Đang tra Wikipedia…</p>}
        {state === 'ok' && info && (
          <div className="wiki">
            {info.thumb && <img className="wiki-img" src={info.thumb} alt={info.label} loading="lazy" referrerPolicy="no-referrer" />}
            <div className="wiki-body">
              <div className="wiki-title">
                <h3>{info.label}</h3>
                {info.description && <span className="muted">{info.description}</span>}
              </div>
              {info.otherNames.length > 0 && <div className="muted small">Tên khác: {info.otherNames.join(', ')}</div>}
              {facts.length > 0 && (
                <ul className="wiki-facts">
                  {facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              {info.extract && <p className="wiki-extract">{info.extract}</p>}
              <div className="wiki-links small">
                {info.pageUrl && (
                  <a href={info.pageUrl} target="_blank" rel="noreferrer">
                    Đọc tiếp trên Wikipedia{info.pageLang === 'en' ? ' (tiếng Anh)' : ''}
                  </a>
                )}
                <a href={wikidataUrl(info.qid)} target="_blank" rel="noreferrer">
                  Wikidata
                </a>
                <button className="linkish" onClick={openPicker}>
                  Không đúng người?
                </button>
              </div>
              {!info.human && <p className="muted small">Trang này không phải về một người (có thể là tổ chức hoặc khái niệm).</p>}
            </div>
          </div>
        )}
        {state === 'none' && (
          <p className="muted">
            Không tìm thấy "{name}" trên Wikipedia.{' '}
            <button className="linkish" onClick={openPicker}>
              Thử lại
            </button>
          </p>
        )}
        {state === 'error' && (
          <p className="error">
            Không kết nối được Wikipedia.{' '}
            <button className="linkish" onClick={() => location.reload()}>
              Tải lại
            </button>
          </p>
        )}
        {state === 'off' && (
          <p className="muted small">
            Đã tắt tra cứu Wikipedia cho người này.{' '}
            <button className="linkish" onClick={openPicker}>
              Chọn trang
            </button>
          </p>
        )}
        {picking && (
          <div className="wiki-pick">
            <h4>Chọn đúng người</h4>
            {!cands ? (
              <p className="muted small">Đang tìm…</p>
            ) : (
              <ul>
                {cands.map((c) => (
                  <li key={c.qid}>
                    <button className={info?.qid === c.qid ? 'on' : ''} onClick={() => choose(c.qid)}>
                      <b>{c.label}</b> {c.description && <span className="muted">· {c.description}</span>}
                      {!c.human && <span className="muted small"> (không phải người)</span>}
                    </button>
                  </li>
                ))}
                {!cands.length && <li className="muted small">Không có kết quả.</li>}
              </ul>
            )}
            <div className="row-actions">
              <button className="secondary" onClick={() => choose(null)}>
                Không tra người này
              </button>
              <button className="link" onClick={() => setPicking(false)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Ghi chú của bạn</h3>
        <textarea
          rows={3}
          value={noteText}
          placeholder="Ví dụ: đọc cùng tác phẩm nào, quan điểm chính, ý tưởng cho bài viết…"
          onChange={(e) => setNoteText(e.target.value)}
        />
        <div className="row-actions">
          <button disabled={noteText === (note?.note ?? '')} onClick={() => persist({ note: noteText.trim() || undefined }, `Ghi chú về ${name}`)}>
            Lưu ghi chú
          </button>
          {saving && <span className="muted small">{saving}</span>}
        </div>
      </section>
    </>
  )
}

function InLibrary({
  p,
  about,
  excerpts,
  onOpen,
  onPerson,
  onCategory,
}: {
  p: Person | undefined
  about: { book: Book; where: string }[]
  excerpts: Excerpt[]
  onOpen: (b: Book) => void
  onPerson: (n: string) => void
  onCategory: (id: string) => void
}) {
  const a = useMemo(() => (p ? authorProfile(p) : null), [p])
  const byYear = useMemo(() => (p ? [...p.books].sort((x, y) => (x.year ?? 9999) - (y.year ?? 9999) || x.title.localeCompare(y.title, 'vi')) : []), [p])
  const quotes = useMemo(() => (p ? excerpts.filter((e) => p.roles.author.some((b) => b.id === e.bookId)) : []), [p, excerpts])
  const roleOf = (b: Book) => (Object.keys(ROLE_LABEL) as Role[]).filter((r) => p?.roles[r].includes(b)).map((r) => ROLE_LABEL[r])
  const [allBooks, setAllBooks] = useState(false)
  const shown = allBooks ? byYear : byYear.slice(0, 12)

  return (
    <>
      {p && a && (
        <section className="card">
          <h3>Trong thư viện của bạn</h3>
          <div className="tiles small-tiles">
            <Tile label="Đầu sách" value={nf(p.books.length)} sub={(Object.keys(ROLE_LABEL) as Role[]).filter((r) => p.roles[r].length).map((r) => `${ROLE_LABEL[r].toLowerCase()} ${p.roles[r].length}`).join(', ')} />
            <Tile label="Tổng số trang" value={nf(p.books.reduce((s, b) => s + (b.pages ?? 0), 0))} />
            <Tile label="Năm in" value={a.minYear ? (a.minYear === a.maxYear ? `${a.minYear}` : `${a.minYear}–${a.maxYear}`) : '–'} />
            <Tile label="Thể loại" value={nf(a.cats.length)} sub={a.cats[0]?.label} />
            {quotes.length > 0 && <Tile label="Trích dẫn đã lưu" value={nf(quotes.length)} />}
          </div>
          {p.variants.length > 1 && (
            <p className="warn-text small">
              Tên đang được ghi theo {p.variants.length} cách: {p.variants.map((v) => `"${v}"`).join(', ')}. Có thể dùng "Sửa hàng loạt" hoặc sửa từng cuốn cho thống nhất.
            </p>
          )}
          <div className="person-grid">
            <div>
              <h4>Thể loại</h4>
              <BarList rows={a.cats.slice(0, 8)} total={p.books.length} onPick={(r) => onCategory(r.key)} />
            </div>
            {a.coauthors.length > 0 && (
              <div>
                <h4>Thường đi cùng</h4>
                <BarList rows={a.coauthors.slice(0, 8)} total={p.books.length} tone="olive" onPick={(r) => onPerson(r.label)} />
              </div>
            )}
          </div>
          <h4>Các cuốn theo năm in</h4>
          <table className="person-books">
            <tbody>
              {shown.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => onOpen(b)}>
                  <td className="num muted">{b.year ?? '–'}</td>
                  <td>
                    <b>{b.title}</b>
                    {b.volume && <span className="muted"> · tập {b.volume}</span>}
                    <div className="muted small">{[b.publisher, (b.categories ?? []).map(categoryLabel).join(', ')].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="small">{roleOf(b).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {byYear.length > 12 && (
            <button className="link" onClick={() => setAllBooks(!allBooks)}>
              {allBooks ? 'Thu gọn' : `Xem cả ${byYear.length} cuốn`}
            </button>
          )}
          {quotes.length > 0 && (
            <>
              <h4>Một vài trích dẫn đã lưu</h4>
              <ul className="person-quotes">
                {quotes.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <blockquote>{e.text.length > 280 ? e.text.slice(0, 280) + '…' : e.text}</blockquote>
                    <span className="muted small">
                      {p.books.find((b) => b.id === e.bookId)?.title}
                      {e.page && `, tr. ${e.page}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <section className="card">
        <h3>Sách viết về người này</h3>
        {about.length ? (
          <ul className="about-list">
            {about.map(({ book, where }) => (
              <li key={book.id}>
                <button className="linkish" onClick={() => onOpen(book)}>
                  {book.title}
                </button>
                <span className="muted small">
                  {' '}
                  {[(book.authors ?? []).map(nameToString).join(', '), book.year].filter(Boolean).join(' · ')} · tên xuất hiện trong {where}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Chưa thấy cuốn nào nhắc tới tên này trong nhan đề, chủ đề hay phần mô tả.</p>
        )}
      </section>
    </>
  )
}

export default function PersonPage({
  cfg,
  books,
  excerpts,
  person,
  onPerson,
  onOpen,
  onCategory,
}: {
  cfg: StoreConfig
  books: Book[]
  excerpts: Excerpt[]
  person: string | null
  onPerson: (name: string | null) => void
  onOpen: (b: Book) => void
  onCategory: (id: string) => void
}) {
  const idx = useMemo(() => peopleIndex(books), [books])
  const [extraNames, setExtraNames] = useState<string[]>([])
  useEffect(() => setExtraNames([]), [person])
  if (!person) return <Hub books={books} onPerson={onPerson} />
  const key = personKey(person)
  const p = idx.get(key)
  const name = p?.label ?? person
  const about = booksAbout([name, ...(p?.variants ?? []), ...extraNames], books, new Set(p?.books ?? []))
  return (
    <div className="person-page">
      <div className="person-top">
        <button className="link" onClick={() => onPerson(null)}>
          ← Tất cả tác giả và nhân vật
        </button>
        <h2>{name}</h2>
        {!p && <p className="muted small">Chưa có sách nào của người này trong thư viện.</p>}
      </div>
      <WikiCard cfg={cfg} name={name} pkey={key} onAboutNames={setExtraNames} />
      <InLibrary p={p} about={about} excerpts={excerpts} onOpen={onOpen} onPerson={(n) => onPerson(n)} onCategory={onCategory} />
    </div>
  )
}
