import { useMemo, useState } from 'react'
import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { addBook, prepareCover, updateBook, uploadCover, type StoreConfig } from '../data/githubStore'
import Cover from './Cover'
import { ulid } from '../data/ulid'
import { parseIsbn } from '../search/isbn'
import { foldVi } from '../search/normalizeVi'
import { nameToString, type Book, type ItemType, type Name } from '../types/book'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

const TYPES: { value: ItemType; label: string }[] = [
  { value: 'book', label: 'Sách' },
  { value: 'chapter', label: 'Chương trong sách tuyển' },
  { value: 'article-journal', label: 'Bài tạp chí' },
  { value: 'paper-conference', label: 'Bài kỷ yếu hội thảo' },
  { value: 'thesis', label: 'Luận văn, luận án' },
  { value: 'document', label: 'Tài liệu khác' },
]

const LANGS = [
  ['vi', 'Tiếng Việt'],
  ['en', 'Tiếng Anh'],
  ['fr', 'Tiếng Pháp'],
  ['de', 'Tiếng Đức'],
  ['ru', 'Tiếng Nga'],
  ['zh', 'Tiếng Trung'],
  ['pi', 'Pāli'],
  ['km', 'Tiếng Khmer'],
  ['th', 'Tiếng Thái'],
] as const

const STATUSES: { value: Book['status']; label: string }[] = [
  { value: 'owned', label: 'Đang có' },
  { value: 'lent', label: 'Đang cho mượn' },
  { value: 'wishlist', label: 'Muốn mua' },
  { value: 'lost', label: 'Thất lạc' },
]

/** Mỗi dòng một người. "Họ, Tên" (có dấu phẩy) cho tên nước ngoài; không dấu phẩy thì giữ nguyên thứ tự. */
const parseNames = (text: string): Name[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(',')
      if (i > 0) {
        const family = l.slice(0, i).trim()
        const given = l.slice(i + 1).trim()
        return given ? { family, given } : { family }
      }
      return { literal: l }
    })

const splitList = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined)

type Fields = Record<
  | 'type' | 'title' | 'subtitle' | 'originalTitle' | 'authors' | 'translators' | 'editors'
  | 'publisher' | 'partner' | 'place' | 'year' | 'edition' | 'pages' | 'sizeCm' | 'language'
  | 'isbn' | 'containerTitle' | 'volume' | 'issue' | 'pageRange' | 'genre'
  | 'subjects' | 'tags' | 'series' | 'seriesNo'
  | 'location' | 'copies' | 'condition' | 'status' | 'notes',
  string
>

const EMPTY: Fields = {
  type: 'book', title: '', subtitle: '', originalTitle: '', authors: '', translators: '', editors: '',
  publisher: '', partner: '', place: '', year: '', edition: '', pages: '', sizeCm: '', language: 'vi',
  isbn: '', containerTitle: '', volume: '', issue: '', pageRange: '', genre: '',
  subjects: '', tags: '', series: '', seriesNo: '',
  location: '', copies: '1', condition: '', status: 'owned', notes: '',
}

type Built = { book: Book } | { error: string }

const MANAGED = [
  'type', 'isbn13', 'isbn10', 'title', 'subtitle', 'originalTitle', 'authors', 'translators', 'editors',
  'publisher', 'partner', 'place', 'year', 'edition', 'pages', 'sizeCm', 'language',
  'containerTitle', 'volume', 'issue', 'pageRange', 'genre', 'categories', 'subjects', 'tags',
  'series', 'seriesNo', 'holdings', 'status', 'notes',
] as const

const namesToText = (ns?: Name[]) =>
  (ns ?? []).map((n) => ('literal' in n ? n.literal : n.given ? `${n.family}, ${n.given}` : `${n.family},`)).join('\n')

const toFields = (b: Book): Fields => {
  const p = b.holdings.find((h) => h.kind === 'print')
  const s = (v: unknown) => (v === undefined || v === null ? '' : String(v))
  return {
    ...EMPTY,
    type: b.type, title: b.title, subtitle: s(b.subtitle), originalTitle: s(b.originalTitle),
    authors: namesToText(b.authors), translators: namesToText(b.translators), editors: namesToText(b.editors),
    publisher: s(b.publisher), partner: s(b.partner), place: s(b.place), year: s(b.year),
    edition: s(b.edition), pages: s(b.pages), sizeCm: s(b.sizeCm), language: b.language ?? 'vi',
    isbn: s(b.isbn13 ?? b.isbn10), containerTitle: s(b.containerTitle), volume: s(b.volume),
    issue: s(b.issue), pageRange: s(b.pageRange), genre: s(b.genre),
    subjects: (b.subjects ?? []).join(', '), tags: (b.tags ?? []).join(', '),
    series: s(b.series), seriesNo: s(b.seriesNo),
    location: p?.kind === 'print' ? s(p.location) : '',
    copies: p?.kind === 'print' ? s(p.copies ?? 1) : '1',
    condition: p?.kind === 'print' ? s(p.condition) : '',
    status: b.status, notes: s(b.notes),
  }
}

const build = (f: Fields, categories: string[], original?: Book): Built => {
  const title = f.title.trim()
  if (!title) return { error: 'Cần nhập nhan đề.' }
  const year = f.year.trim() ? toInt(f.year) : undefined
  if (f.year.trim() && (year === undefined || year > new Date().getFullYear() + 1))
    return { error: 'Năm xuất bản không hợp lệ.' }
  for (const [k, label] of [['pages', 'Số trang'], ['edition', 'Lần tái bản'], ['copies', 'Số bản']] as const)
    if (f[k].trim() && !toInt(f[k])) return { error: `${label} phải là số nguyên dương.` }

  let isbn13: string | undefined
  let isbn10: string | undefined
  if (f.isbn.trim()) {
    const r = parseIsbn(f.isbn)
    if (!r.ok) return { error: r.message }
    isbn13 = r.isbn13
    isbn10 = r.isbn10
  }

  const now = new Date().toISOString()
  function opt(v: string): string | undefined
  function opt<T>(v: T[]): T[] | undefined
  function opt(v: string | unknown[]) {
    return v.length === 0 ? undefined : v
  }
  const book: Book = {
    id: ulid(),
    type: f.type as ItemType,
    isbn13,
    isbn10,
    title,
    subtitle: opt(f.subtitle.trim()),
    originalTitle: opt(f.originalTitle.trim()),
    authors: opt(parseNames(f.authors)),
    translators: opt(parseNames(f.translators)),
    editors: opt(parseNames(f.editors)),
    publisher: opt(f.publisher.trim()),
    partner: opt(f.partner.trim()),
    place: opt(f.place.trim()),
    year,
    edition: toInt(f.edition),
    pages: toInt(f.pages),
    sizeCm: opt(f.sizeCm.trim()),
    language: opt(f.language),
    containerTitle: opt(f.containerTitle.trim()),
    volume: opt(f.volume.trim()),
    issue: opt(f.issue.trim()),
    pageRange: opt(f.pageRange.trim()),
    genre: opt(f.genre.trim()),
    categories: opt(categories),
    subjects: opt(splitList(f.subjects)),
    tags: opt(splitList(f.tags)),
    series: opt(f.series.trim()),
    seriesNo: f.seriesNo.trim() && !isNaN(Number(f.seriesNo)) ? Number(f.seriesNo) : undefined,
    holdings:
      f.status === 'wishlist'
        ? []
        : [
            {
              kind: 'print',
              location: opt(f.location.trim()),
              copies: toInt(f.copies) ?? 1,
              condition: opt(f.condition.trim()),
            },
          ],
    status: f.status as Book['status'],
    notes: opt(f.notes.trim()),
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }
  if (original) {
    // Giữ nguyên những gì biểu mẫu không quản lý (sách điện tử, cho mượn, bìa, ngày tạo...).
    const kept: Record<string, unknown> = { ...original }
    for (const k of MANAGED) delete kept[k]
    const otherHoldings = original.holdings.filter((h, i) =>
      h.kind === 'ebook' ? true : i !== original.holdings.findIndex((x) => x.kind === 'print'),
    )
    const merged = {
      ...kept,
      ...book,
      id: original.id,
      source: original.source,
      createdAt: original.createdAt,
      updatedAt: now,
      holdings: [...book.holdings, ...otherHoldings.filter((h) => !(f.status === 'wishlist' && h.kind === 'print'))],
    }
    return { book: JSON.parse(JSON.stringify(merged)) as Book }
  }
  // Bỏ các khóa undefined để bản ghi gọn và khớp schema.
  const clean = JSON.parse(JSON.stringify(book)) as Book
  return { book: clean }
}

const findDuplicates = (book: Book, books: Book[]) => {
  const t = foldVi(book.title)
  const a = book.authors?.[0] ? foldVi(nameToString(book.authors[0])) : ''
  return books.filter(
    (b) =>
      (book.isbn13 && b.isbn13 === book.isbn13) ||
      (foldVi(b.title) === t && (!a || !b.authors?.[0] || foldVi(nameToString(b.authors[0])) === a)),
  )
}

const uniq = (xs: (string | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => !!x && !!x.trim()))].sort((a, b) => a.localeCompare(b, 'vi'))

export default function BookForm({
  cfg,
  books,
  initial,
  onSaved,
  onCancel,
}: {
  cfg: StoreConfig
  books: Book[]
  initial?: Book
  onSaved: (b: Book) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<Fields>(() => (initial ? toFields(initial) : EMPTY))
  const [error, setError] = useState<string | null>(null)
  const [dupes, setDupes] = useState<Book[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [cats, setCats] = useState<string[]>(initial?.categories ?? [])
  const [catTab, setCatTab] = useState(0)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const pickCover = async (file?: File) => {
    if (!file) return
    setError(null)
    try {
      const blob = await prepareCover(file)
      setCoverBlob(blob)
      setCoverPreview(URL.createObjectURL(blob))
      setCoverRemoved(false)
    } catch {
      setError('Không đọc được ảnh này, thử ảnh khác (JPEG hoặc PNG).')
    }
  }
  const toggleCat = (id: string) =>
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setError(null)
    setF({ ...f, [k]: e.target.value })
  }

  const lists = useMemo(
    () => ({
      publishers: uniq(books.map((b) => b.publisher)),
      partners: uniq(books.map((b) => b.partner)),
      places: uniq(books.map((b) => b.place)),
      locations: uniq(books.flatMap((b) => b.holdings.map((h) => (h.kind === 'print' ? h.location : undefined)))),
      series: uniq(books.map((b) => b.series)),
    }),
    [books],
  )
  const inContainer = ['chapter', 'article-journal', 'paper-conference'].includes(f.type)

  const save = async (force: boolean) => {
    setError(null)
    const r = build(f, cats, initial)
    if ('error' in r) return setError(r.error)
    if (!force) {
      const d = findDuplicates(r.book, books.filter((b) => b.id !== initial?.id))
      if (d.length) return setDupes(d)
    }
    setBusy(true)
    try {
      const book = { ...r.book }
      if (coverBlob) book.cover = await uploadCover(cfg, book.id, coverBlob, book.title)
      else if (coverRemoved) delete book.cover
      await (initial ? updateBook(cfg, book) : addBook(cfg, book))
      onSaved(book)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="card book-form"
      onSubmit={(e) => {
        e.preventDefault()
        void save(false)
      }}
    >
      <div className="card-head">
        <img src={asset('sticker-carrying.webp')} alt="" />
        <div>
          <h2>{initial ? 'Sửa sách' : 'Thêm sách'}</h2>
          <p className="muted">Chỉ nhan đề là bắt buộc. Thiếu thông tin gì có thể bổ sung sau.</p>
        </div>
      </div>

      <fieldset className="cover-field">
        <legend>Ảnh bìa</legend>
        <Cover
          cfg={cfg}
          size="lg"
          preview={coverPreview}
          book={{
            ...(initial ?? { id: 'new', holdings: [], createdAt: '', updatedAt: '' }),
            ...(coverRemoved ? { cover: undefined } : {}),
            type: f.type as ItemType,
            title: f.title || 'Sách mới',
            publisher: f.publisher || undefined,
            year: toInt(f.year),
            containerTitle: f.containerTitle || undefined,
            originalTitle: f.originalTitle || undefined,
            translators: parseNames(f.translators),
            isbn13: f.isbn ? (parseIsbn(f.isbn) as { isbn13?: string }).isbn13 : undefined,
            categories: cats,
            tags: splitList(f.tags),
            status: f.status as Book['status'],
          }}
        />
        <div className="cover-actions">
          <p className="hint">
            Chụp bìa sách hoặc chọn ảnh có sẵn. Chưa có ảnh thì ứng dụng lấy bìa từ Open Library theo
            ISBN, không có nữa thì dùng hình Pochacco hợp với tình trạng cuốn sách.
          </p>
          <label className="button file">
            {coverPreview || (initial?.cover && !coverRemoved) ? 'Đổi ảnh bìa' : 'Chụp hoặc chọn ảnh bìa'}
            <input type="file" accept="image/*" onChange={(e) => void pickCover(e.target.files?.[0])} />
          </label>
          {(coverPreview || (initial?.cover?.startsWith('repo:') && !coverRemoved)) && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setCoverBlob(null)
                setCoverPreview(null)
                setCoverRemoved(true)
              }}
            >
              Bỏ ảnh đã chọn
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Thông tin chính</legend>
        <div className="row">
          <label>
            Loại tài liệu
            <select value={f.type} onChange={set('type')}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            ISBN
            <input inputMode="numeric" placeholder="978-604-..." value={f.isbn} onChange={set('isbn')} />
          </label>
        </div>
        <label>
          Nhan đề *
          <input value={f.title} onChange={set('title')} required autoFocus={!initial} />
        </label>
        <div className="row">
          <label>
            Phụ đề
            <input value={f.subtitle} onChange={set('subtitle')} />
          </label>
          <label>
            Nhan đề gốc (sách dịch)
            <input value={f.originalTitle} onChange={set('originalTitle')} />
          </label>
        </div>
        <p className="hint">
          Mỗi dòng một người. Tên nước ngoài viết <b>Họ, Tên</b> (ví dụ <i>Kant, Immanuel</i>); tên Việt
          và pháp danh viết như bình thường, không dấu phẩy.
        </p>
        <div className="row3">
          <label>
            Tác giả
            <textarea rows={2} value={f.authors} onChange={set('authors')} />
          </label>
          <label>
            Dịch giả
            <textarea rows={2} value={f.translators} onChange={set('translators')} />
          </label>
          <label>
            Chủ biên, biên soạn
            <textarea rows={2} value={f.editors} onChange={set('editors')} />
          </label>
        </div>
      </fieldset>

      {inContainer && (
        <fieldset>
          <legend>Nằm trong</legend>
          <label>
            {f.type === 'article-journal' ? 'Tên tạp chí' : f.type === 'paper-conference' ? 'Tên kỷ yếu' : 'Tên sách tuyển'}
            <input value={f.containerTitle} onChange={set('containerTitle')} />
          </label>
          <div className="row3">
            <label>
              Tập
              <input value={f.volume} onChange={set('volume')} />
            </label>
            <label>
              Số
              <input value={f.issue} onChange={set('issue')} />
            </label>
            <label>
              Trang (vd. 45-62)
              <input value={f.pageRange} onChange={set('pageRange')} />
            </label>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>Xuất bản</legend>
        <div className="row">
          <label>
            {f.type === 'thesis' ? 'Cơ sở đào tạo' : 'Nhà xuất bản'}
            <input list="dl-publishers" value={f.publisher} onChange={set('publisher')} />
          </label>
          {f.type === 'thesis' ? (
            <label>
              Loại (vd. Luận văn thạc sĩ)
              <input value={f.genre} onChange={set('genre')} />
            </label>
          ) : (
            <label>
              Đơn vị liên kết
              <input list="dl-partners" placeholder="Nhã Nam, Omega Plus..." value={f.partner} onChange={set('partner')} />
            </label>
          )}
        </div>
        <div className="row3">
          <label>
            Nơi xuất bản
            <input list="dl-places" placeholder="Hà Nội" value={f.place} onChange={set('place')} />
          </label>
          <label>
            Năm
            <input inputMode="numeric" value={f.year} onChange={set('year')} />
          </label>
          <label>
            Lần tái bản
            <input inputMode="numeric" value={f.edition} onChange={set('edition')} />
          </label>
        </div>
        <div className="row3">
          <label>
            Số trang
            <input inputMode="numeric" value={f.pages} onChange={set('pages')} />
          </label>
          <label>
            Khổ (cm)
            <input placeholder="16 x 24" value={f.sizeCm} onChange={set('sizeCm')} />
          </label>
          <label>
            Ngôn ngữ
            <select value={f.language} onChange={set('language')}>
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Phân loại</legend>
        <div className="tabs" role="tablist">
          {CATEGORY_GROUPS.map((g, i) => {
            const n = g.items.filter((c) => cats.includes(c.id)).length
            return (
              <button
                key={g.label}
                type="button"
                role="tab"
                aria-selected={catTab === i}
                className={catTab === i ? 'tab active' : 'tab'}
                onClick={() => setCatTab(i)}
              >
                {g.label}
                {n > 0 && <span className="count">{n}</span>}
              </button>
            )
          })}
        </div>
        <div className="chips">
          {CATEGORY_GROUPS[catTab].items.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cats.includes(c.id) ? 'chip on' : 'chip'}
              aria-pressed={cats.includes(c.id)}
              onClick={() => toggleCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {cats.length
            ? `Đã chọn: ${cats.map(categoryLabel).join(', ')}`
            : 'Chọn một hoặc nhiều danh mục; chuyển tab để xem các nhóm khác.'}
        </p>
        <label>
          Chủ đề chi tiết (cách nhau bằng dấu phẩy)
          <input placeholder="Thuyết duyên khởi, Vi Diệu Pháp" value={f.subjects} onChange={set('subjects')} />
        </label>
        <div className="row3">
          <label>
            Nhãn
            <input value={f.tags} onChange={set('tags')} />
          </label>
          <label>
            Tùng thư
            <input list="dl-series" value={f.series} onChange={set('series')} />
          </label>
          <label>
            Số trong tùng thư
            <input inputMode="decimal" value={f.seriesNo} onChange={set('seriesNo')} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Bản giấy</legend>
        <div className="row">
          <label>
            Trạng thái
            <select value={f.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label>
            Vị trí (tủ, kệ)
            <input list="dl-locations" placeholder="T1-K2" value={f.location} onChange={set('location')} disabled={f.status === 'wishlist'} />
          </label>
        </div>
        <div className="row">
          <label>
            Số bản
            <input inputMode="numeric" value={f.copies} onChange={set('copies')} disabled={f.status === 'wishlist'} />
          </label>
          <label>
            Tình trạng
            <input placeholder="tốt, ố vàng, mất bìa..." value={f.condition} onChange={set('condition')} disabled={f.status === 'wishlist'} />
          </label>
        </div>
        <label>
          Ghi chú
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </label>
      </fieldset>

      <datalist id="dl-publishers">{lists.publishers.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="dl-partners">{lists.partners.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="dl-places">{['Hà Nội', 'TP. Hồ Chí Minh', 'Huế', 'Đà Nẵng', ...lists.places].filter((x, i, a) => a.indexOf(x) === i).map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="dl-locations">{lists.locations.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="dl-series">{lists.series.map((x) => <option key={x} value={x} />)}</datalist>

      {dupes && (
        <div className="dupes">
          <div className="state-title">Có vẻ anh đã có cuốn này:</div>
          <ul>
            {dupes.map((d) => {
              const loc = d.holdings.find((h) => h.kind === 'print')
              return (
                <li key={d.id}>
                  <b>{d.title}</b>
                  {d.year ? ` (${d.year})` : ''}
                  {d.publisher ? `, ${d.publisher}` : ''}
                  {loc?.kind === 'print' && loc.location ? `, kệ ${loc.location}` : ''}
                </li>
              )
            })}
          </ul>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setDupes(null)}>
              Sửa lại
            </button>
            <button type="button" disabled={busy} onClick={() => { setDupes(null); void save(true) }}>
              Vẫn lưu (ấn bản khác)
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Hủy
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Lưu sách'}
        </button>
      </div>
    </form>
  )
}
