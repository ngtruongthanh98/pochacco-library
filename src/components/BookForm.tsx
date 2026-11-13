import { fmtVnd, parseVnd, SHOP_DEFAULTS, todayIso } from '../data/money'
import { useMemo, useState } from 'react'
import { placeIndex, suggestPlace } from '../data/publisherPlace'
import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { addBook, prepareCover, updateBook, uploadCover, type StoreConfig } from '../data/githubStore'
import Cover from './Cover'
import { SuggestInput, SuggestLines, useLibraryOptions } from './Suggest'
import { namesToText, parseNames } from '../data/names'
import { PasteInfo } from './PasteInfo'
import { FIELD_LABEL } from '../data/pasteParse'
import { ulid } from '../data/ulid'
import { parseIsbn } from '../search/isbn'
import { foldVi } from '../search/normalizeVi'
import { driveViewUrl, guessFormat, parseDriveLink } from '../data/drive'
import { lookupIsbn, searchByTitle, type Candidate } from '../data/lookup'
import { BINDINGS, bindingLabel, nameToString, type Binding, type Book, type EbookHolding, type ItemType, type PrintHolding } from '../types/book'

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

const splitList = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined)

/** Một bản giấy thêm (khác loại bìa hoặc để ở kệ khác). */
type PrintDraft = { binding: string; location: string; copies: string; condition: string }
const toDraft = (h: PrintHolding): PrintDraft => ({ binding: h.binding ?? '', location: h.location ?? '', copies: String(h.copies ?? 1), condition: h.condition ?? '' })

type Fields = Record<
  | 'type' | 'title' | 'subtitle' | 'originalTitle' | 'authors' | 'translators' | 'editors'
  | 'publisher' | 'partner' | 'place' | 'year' | 'edition' | 'pages' | 'sizeCm' | 'language'
  | 'isbn' | 'containerTitle' | 'volume' | 'issue' | 'pageRange' | 'genre'
  | 'subjects' | 'tags' | 'series' | 'seriesNo'
  | 'location' | 'copies' | 'condition' | 'binding' | 'status' | 'notes' | 'description'
  | 'buyDate' | 'buyFrom' | 'buyPrice' | 'coverPrice' | 'gift',
  string
>

const EMPTY: Fields = {
  type: 'book', title: '', subtitle: '', originalTitle: '', authors: '', translators: '', editors: '',
  publisher: '', partner: '', place: '', year: '', edition: '', pages: '', sizeCm: '', language: 'vi',
  isbn: '', containerTitle: '', volume: '', issue: '', pageRange: '', genre: '',
  subjects: '', tags: '', series: '', seriesNo: '',
  location: '', copies: '1', condition: '', binding: '', status: 'owned', notes: '', description: '',
  buyDate: '', buyFrom: '', buyPrice: '', coverPrice: '', gift: '',
}

type Built = { book: Book } | { error: string }

const MANAGED = [
  'type', 'isbn13', 'isbn10', 'title', 'subtitle', 'originalTitle', 'authors', 'translators', 'editors',
  'publisher', 'partner', 'place', 'year', 'edition', 'pages', 'sizeCm', 'language',
  'containerTitle', 'volume', 'issue', 'pageRange', 'genre', 'categories', 'subjects', 'tags',
  'series', 'seriesNo', 'holdings', 'status', 'notes', 'description', 'acquired', 'coverPrice',
] as const

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
    binding: p?.kind === 'print' ? s(p.binding) : '',
    status: b.status, notes: s(b.notes), description: s(b.description),
    buyDate: s(b.acquired?.date), buyFrom: s(b.acquired?.from),
    buyPrice: b.acquired?.price !== undefined ? b.acquired.price.toLocaleString('vi-VN') : '',
    coverPrice: b.coverPrice !== undefined ? b.coverPrice.toLocaleString('vi-VN') : '',
    gift: b.acquired?.gift ? '1' : '',
  }
}

const build = (
  f: Fields,
  categories: string[],
  original: Book | undefined,
  ebooks: EbookHolding[],
  hasPrint: boolean,
  extraPrints: PrintDraft[] = [],
): Built => {
  if (!hasPrint && !ebooks.length && f.status !== 'wishlist')
    return { error: 'Sách cần có bản giấy hoặc ít nhất một bản điện tử.' }
  const title = f.title.trim()
  if (!title) return { error: 'Cần nhập nhan đề.' }
  const year = f.year.trim() ? toInt(f.year) : undefined
  if (f.year.trim() && (year === undefined || year > new Date().getFullYear() + 1))
    return { error: 'Năm xuất bản không hợp lệ.' }
  for (const [k, label] of [['pages', 'Số trang'], ['edition', 'Lần tái bản'], ['copies', 'Số bản']] as const)
    if (f[k].trim() && !toInt(f[k])) return { error: `${label} phải là số nguyên dương.` }
  for (const x of extraPrints) if (x.copies.trim() && !toInt(x.copies)) return { error: 'Số bản của bản giấy khác phải là số nguyên dương.' }

  const buyPrice = parseVnd(f.buyPrice)
  const coverPrice = parseVnd(f.coverPrice)
  if (buyPrice === null) return { error: 'Giá mua không đọc được. Ví dụ: 85000, 85.000 hoặc 85k.' }
  if (coverPrice === null) return { error: 'Giá bìa không đọc được. Ví dụ: 120000, 120.000 hoặc 120k.' }
  const gift = f.gift === '1'
  const bought = f.status !== 'wishlist' && (buyPrice !== undefined || gift || f.buyFrom.trim() || f.buyDate)
  const acquired = bought
    ? {
        // Ghi giá mà chưa ghi ngày thì tính là mua hôm nay.
        date: f.buyDate || todayIso(),
        from: f.buyFrom.trim() || undefined,
        price: gift ? undefined : buyPrice,
        gift: gift || undefined,
      }
    : undefined

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
    holdings: [
      ...(f.status === 'wishlist' || !hasPrint
        ? []
        : [
            {
              kind: 'print' as const,
              location: opt(f.location.trim()),
              copies: toInt(f.copies) ?? 1,
              condition: opt(f.condition.trim()),
              binding: (f.binding || undefined) as Binding | undefined,
            },
            ...extraPrints.map((x) => ({
              kind: 'print' as const,
              location: opt(x.location.trim()),
              copies: toInt(x.copies) ?? 1,
              condition: opt(x.condition.trim()),
              binding: (x.binding || undefined) as Binding | undefined,
            })),
          ]),
      ...ebooks,
    ],
    status: f.status as Book['status'],
    acquired,
    coverPrice,
    notes: opt(f.notes.trim()),
    description: opt(f.description.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()),
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }
  if (original) {
    // Giữ nguyên những gì biểu mẫu không quản lý (sách điện tử, cho mượn, bìa, ngày tạo...).
    const kept: Record<string, unknown> = { ...original }
    for (const k of MANAGED) delete kept[k]
    // Mọi bản giấy và bản điện tử đều do biểu mẫu quản lý.
    const merged = {
      ...kept,
      ...book,
      id: original.id,
      source: original.source,
      createdAt: original.createdAt,
      updatedAt: now,
      holdings: [...book.holdings.filter((h) => h.kind === 'print'), ...ebooks],
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

export default function BookForm({
  cfg,
  books,
  initial,
  prefill,
  banner,
  cancelLabel = 'Hủy',
  markBought = false,
  onSaved,
  onCancel,
}: {
  cfg: StoreConfig
  books: Book[]
  initial?: Book
  /** Dữ liệu điền sẵn cho sách mới (từ quét ISBN) */
  prefill?: Partial<Book>
  /** Dòng thông báo phía trên biểu mẫu, ví dụ tiến độ bổ sung hàng loạt */
  banner?: React.ReactNode
  cancelLabel?: string
  /** Mở từ nút "Đã mua cuốn này": chuyển sang Đang có, ngày mua hôm nay */
  markBought?: boolean
  onSaved: (b: Book) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<Fields>(() =>
    initial
      ? markBought
        ? { ...toFields(initial), status: 'owned', buyDate: initial.acquired?.date ?? todayIso() }
        : toFields(initial)
      : prefill
        ? toFields({ id: '', type: 'book', title: '', holdings: [], status: 'owned', createdAt: '', updatedAt: '', ...prefill })
        : EMPTY,
  )
  const [error, setError] = useState<string | null>(null)
  const [dupes, setDupes] = useState<Book[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [cats, setCats] = useState<string[]>(initial?.categories ?? prefill?.categories ?? [])
  const [catTab, setCatTab] = useState(0)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const startHoldings = initial?.holdings ?? prefill?.holdings ?? []
  const [ebooks, setEbooks] = useState<EbookHolding[]>(
    startHoldings.filter((h): h is EbookHolding => h.kind === 'ebook'),
  )
  const [extraPrints, setExtraPrints] = useState<PrintDraft[]>(() =>
    startHoldings.filter((h): h is PrintHolding => h.kind === 'print').slice(1).map(toDraft),
  )
  const setExtra = (i: number, k: keyof PrintDraft) => (v: string) => setExtraPrints((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const [hasPrint, setHasPrint] = useState(
    startHoldings.length === 0 || startHoldings.some((h) => h.kind === 'print') || initial?.status === 'wishlist',
  )
  const [driveLink, setDriveLink] = useState('')
  const [lookupState, setLookupState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [filledMsg, setFilledMsg] = useState<string | null>(null)
  const [pendingCover, setPendingCover] = useState<string | undefined>(undefined)
  const lookup = async () => {
    setFilledMsg(null)
    setLookupState('busy')
    setCandidates([])
    const isbn = f.isbn.trim() ? parseIsbn(f.isbn) : null
    let found: Candidate[] = []
    if (isbn?.ok) {
      const r = await lookupIsbn(isbn.isbn13)
      if (r?.draft.title)
        found = [{
          key: 'isbn', title: r.draft.title, authors: r.draft.authors ?? [], year: r.draft.year,
          publisher: r.draft.publisher, pages: r.draft.pages, isbn13: isbn.isbn13, language: r.draft.language,
          cover: r.draft.cover?.startsWith('ol:') ? `https://covers.openlibrary.org/b/isbn/${isbn.isbn13}-M.jpg` : r.draft.cover,
          description: r.draft.description,
          source: r.draft.source === 'googlebooks' ? 'googlebooks' : 'openlibrary',
        }]
    }
    if (!found.length && f.title.trim()) {
      const firstAuthor = f.authors.split('\n')[0]?.split(',').reverse().join(' ').trim()
      found = await searchByTitle(f.title, firstAuthor)
    }
    setCandidates(found)
    setLookupState('done')
  }
  const applyCandidate = (c: Candidate) => {
    const filled: string[] = []
    const next = { ...f }
    const fill = (k: keyof Fields, v: string | undefined, label: string) => {
      if (v && !f[k].trim()) {
        next[k] = v
        filled.push(label)
      }
    }
    fill('title', c.title, 'nhan đề')
    fill('authors', c.authors.map((n) => ('literal' in n ? n.literal : n.given ? `${n.family}, ${n.given}` : n.family)).join('\n'), 'tác giả')
    fill('publisher', c.publisher, 'nhà xuất bản')
    fill('year', c.year ? String(c.year) : undefined, 'năm')
    fill('pages', c.pages ? String(c.pages) : undefined, 'số trang')
    fill('isbn', c.isbn13, 'ISBN')
    fill('description', c.description, 'mô tả')
    if (c.language && c.language !== f.language) {
      next.language = c.language
      filled.push('ngôn ngữ')
    }
    setF(next)
    if (c.cover && !initial?.cover && !coverBlob) {
      setPendingCover(c.cover)
      filled.push('ảnh bìa')
    }
    setCandidates([])
    setLookupState('idle')
    setFilledMsg(filled.length ? `Đã điền: ${filled.join(', ')}. Các ô đã có sẵn được giữ nguyên.` : 'Các ô đều đã có thông tin, không thay đổi gì.')
  }
  const [driveErr, setDriveErr] = useState<string | null>(null)
  const addDrive = () => {
    setDriveErr(null)
    const ref = parseDriveLink(driveLink)
    if (!ref) return setDriveErr('Không nhận ra link Google Drive. Dán link chia sẻ của tệp (drive.google.com/file/d/...).')
    if (ref.kind === 'folder')
      return setDriveErr('Đây là link thư mục. Hãy dán link của từng tệp sách, hoặc dùng trang "Nhập sách điện tử" để dán nhiều link một lần.')
    if (ebooks.some((e) => e.fileId === ref.id)) return setDriveErr('Tệp này đã được gắn vào cuốn sách.')
    setEbooks([...ebooks, { kind: 'ebook', format: ref.kind === 'doc' ? 'other' : guessFormat(driveLink), storage: 'gdrive', fileId: ref.id }])
    setDriveLink('')
  }
  const patchEbook = (i: number, p: Partial<EbookHolding>) =>
    setEbooks(ebooks.map((e, k) => (k === i ? (JSON.parse(JSON.stringify({ ...e, ...p })) as EbookHolding) : e)))
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


  // --- Gợi ý từ thư viện ---
  const opts = useLibraryOptions(books, initial?.id)
  const buyFromOpts = useMemo(() => {
    const c = new Map<string, number>()
    for (const b of books) if (b.acquired?.from) c.set(b.acquired.from, (c.get(b.acquired.from) ?? 0) + 1)
    for (const d of SHOP_DEFAULTS) if (!c.has(d)) c.set(d, 0)
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
  }, [books])
  const placeIdx = useMemo(() => placeIndex(books), [books])

  /** Giá trị hay đi kèm nhất trong những sách thỏa điều kiện (vd: nơi xuất bản của một NXB). */
  const mostCommon = (match: (b: Book) => boolean, get: (b: Book) => string | undefined) => {
    const c = new Map<string, number>()
    for (const b of books) if (b.id !== initial?.id && match(b)) {
      const v = get(b)?.trim()
      if (v) c.set(v, (c.get(v) ?? 0) + 1)
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }
  const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi')
  const [autoMsg, setAutoMsg] = useState<string | null>(null)
  const setField = (k: keyof Fields) => (v: string) => {
    setError(null)
    setF((cur) => ({ ...cur, [k]: v }))
  }
  const pickPublisher = (pub: string) => {
    const place = mostCommon((b) => same(b.publisher, pub), (b) => b.place)
    setF((cur) => (cur.place.trim() || !place ? cur : { ...cur, place }))
    if (place && !f.place.trim()) setAutoMsg(`Đã điền nơi xuất bản “${place}” theo các sách khác của ${pub}.`)
  }
  const pickSeries = (series: string) => {
    const pub = mostCommon((b) => same(b.series, series), (b) => b.publisher)
    const partner = mostCommon((b) => same(b.series, series), (b) => b.partner)
    const place = mostCommon((b) => same(b.series, series), (b) => b.place)
    const filled: string[] = []
    const patch: Partial<Fields> = {}
    if (!f.publisher.trim() && pub) (patch.publisher = pub), filled.push('nhà xuất bản')
    if (!f.partner.trim() && partner) (patch.partner = partner), filled.push('đơn vị liên kết')
    if (!f.place.trim() && place) (patch.place = place), filled.push('nơi xuất bản')
    setF((cur) => ({ ...cur, ...patch }))
    if (filled.length) setAutoMsg(`Đã điền ${filled.join(', ')} theo các cuốn khác trong tùng thư “${series}”.`)
  }
  const inContainer = ['chapter', 'article-journal', 'paper-conference'].includes(f.type)

  const save = async (force: boolean) => {
    setError(null)
    const r = build(f, cats, initial, ebooks, hasPrint, extraPrints)
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
      else if (!initial && prefill?.cover) book.cover = prefill.cover
      if (!coverBlob && !coverRemoved && !book.cover && pendingCover) book.cover = pendingCover
      if (!initial && prefill?.source) book.source = prefill.source
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
      {banner}
      <div className="card-head">
        <img src={asset('sticker-carrying.webp')} alt="" />
        <div>
          <h2>{initial ? 'Sửa sách' : 'Thêm sách'}</h2>
          {prefill && !initial && !banner && (
            <p className="hint">
              {prefill.title
                ? `Đã điền sẵn từ ${prefill.source === 'googlebooks' ? 'Google Books' : 'Open Library'}. Kiểm tra lại rồi bổ sung kệ, danh mục.`
                : 'Không tìm thấy dữ liệu trực tuyến cho ISBN này. Nhập phần còn lại bằng tay.'}
            </p>
          )}
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
            ...(initial ?? { id: 'new', holdings: [], createdAt: '', updatedAt: '', cover: prefill?.cover }),
            ...(!initial?.cover && pendingCover ? { cover: pendingCover } : {}),
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
        <div className="lookup">
          <button type="button" className="secondary small-btn" disabled={lookupState === 'busy' || (!f.title.trim() && !f.isbn.trim())} onClick={() => void lookup()}>
            {lookupState === 'busy' ? 'Đang tra...' : 'Tra thông tin trực tuyến'}
          </button>
          <button type="button" className="secondary small-btn" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
            Dán thông tin từ Fahasa, Tiki, Cục Xuất bản…
          </button>
          <span className="hint">Tra trực tuyến: theo ISBN nếu có, không thì theo nhan đề và tác giả. Sách Việt Nam thường thiếu ở đó, hãy dùng nút Dán thông tin.</span>
        </div>
        {pasteOpen && (
          <PasteInfo
            query={f.isbn.trim() || [f.title.trim(), f.authors.split('\n')[0]?.trim()].filter(Boolean).join(' ')}
            isbn={f.isbn.replace(/[^\dXx]/g, '')}
            current={{
              title: f.title, authors: f.authors, translators: f.translators, editors: f.editors, publisher: f.publisher,
              partner: f.partner, place: f.place, year: f.year, pages: f.pages, sizeCm: f.sizeCm, isbn: f.isbn,
              language: f.language, description: f.description,
            }}
            publishers={opts.publishers}
            onClose={() => setPasteOpen(false)}
            onApply={(patch, source) => {
              setF((cur) => {
                const next = { ...cur, ...patch }
                if (source && !cur.notes.includes(source)) next.notes = [cur.notes.trim(), `Nguồn thông tin: ${source}`].filter(Boolean).join('\n')
                return next
              })
              const names = (Object.keys(patch) as (keyof typeof FIELD_LABEL)[]).map((k) => FIELD_LABEL[k].toLowerCase())
              setFilledMsg(`Đã điền ${names.join(', ')}${source ? '; đã ghi link nguồn vào ghi chú' : ''}. Kiểm tra lại rồi bấm Lưu.`)
              setPasteOpen(false)
              if (patch.publisher && !patch.place) pickPublisher(patch.publisher)
            }}
          />
        )}
        {filledMsg && <p className="filled">{filledMsg}</p>}
        {lookupState === 'done' && (
          <div className="candidates">
            {candidates.length ? (
              <>
                <div className="muted small">Chọn đúng ấn bản (Open Library, Google Books):</div>
                {candidates.map((c) => (
                  <div key={c.key} className="cand">
                    {c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <div className="cand-noimg" />}
                    <div className="cand-body">
                      <div className="title">{c.title}</div>
                      <div className="meta">
                        {[c.authors.map(nameToString).join(', '), c.publisher, c.year, c.pages && `${c.pages} tr.`].filter(Boolean).join(' · ')}
                      </div>
                      <div className="muted small">
                        {c.isbn13 ? `ISBN ${c.isbn13} · ` : ''}
                        {c.source === 'googlebooks' ? 'Google Books' : 'Open Library'}
                      </div>
                    </div>
                    <button type="button" className="small-btn" onClick={() => applyCandidate(c)}>
                      Dùng
                    </button>
                  </div>
                ))}
                <button type="button" className="link" onClick={() => setLookupState('idle')}>
                  Không có ấn bản nào đúng
                </button>
              </>
            ) : (
              <p className="muted small">
                Không tìm thấy dữ liệu trực tuyến. Sách Việt thường chưa có trên các kho này; anh nhập tay giúp nhé.
              </p>
            )}
          </div>
        )}
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
          <SuggestLines label="Tác giả" value={f.authors} onChange={setField('authors')} options={opts.people} />
          <SuggestLines label="Dịch giả" value={f.translators} onChange={setField('translators')} options={opts.people} />
          <SuggestLines label="Chủ biên, biên soạn" value={f.editors} onChange={setField('editors')} options={opts.people} />
        </div>
        <label>
          Mô tả, giới thiệu nội dung
          <textarea
            className="description-input"
            rows={5}
            value={f.description}
            onChange={set('description')}
            placeholder="Tóm tắt nội dung, lời giới thiệu ở bìa sau, mục lục chính, nhận xét của bạn... Để một dòng trống giữa các đoạn."
          />
          {f.description.trim() && (
            <span className="hint">{f.description.trim().split(/\s+/).length.toLocaleString('vi-VN')} chữ</span>
          )}
        </label>
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
        {autoMsg && (
          <p className="auto-msg" role="status">
            {autoMsg}{' '}
            <button type="button" className="link" onClick={() => setAutoMsg(null)}>
              Ẩn
            </button>
          </p>
        )}
        <div className="row">
          <SuggestInput
            label={f.type === 'thesis' ? 'Cơ sở đào tạo' : 'Nhà xuất bản'}
            value={f.publisher}
            onChange={setField('publisher')}
            options={opts.publishers}
            onPick={pickPublisher}
          />
          {f.type === 'thesis' ? (
            <label>
              Loại (vd. Luận văn thạc sĩ)
              <input value={f.genre} onChange={set('genre')} />
            </label>
          ) : (
            <SuggestInput label="Đơn vị liên kết" placeholder="Nhã Nam, Omega Plus..." value={f.partner} onChange={setField('partner')} options={opts.partners} />
          )}
        </div>
        <div className="row3">
          <div className="place-field">
            <SuggestInput label="Nơi xuất bản" placeholder="Hà Nội" value={f.place} onChange={setField('place')} options={opts.places} />
            {(() => {
              const h = !f.place.trim() && f.type !== 'thesis' ? suggestPlace(f.publisher, placeIdx) : null
              return h ? (
                <button type="button" className="place-hint" onClick={() => setF((cur) => ({ ...cur, place: h.place }))} title={h.from === 'library' ? `Theo ${h.count} cuốn khác của NXB này trong thư viện` : 'Trụ sở chính của NXB này'}>
                  Gợi ý: {h.place}
                </button>
              ) : null
            })()}
          </div>
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
          <SuggestInput label="Tùng thư" value={f.series} onChange={setField('series')} options={opts.series} onPick={pickSeries} />
          <label>
            Số trong tùng thư
            <input inputMode="decimal" value={f.seriesNo} onChange={set('seriesNo')} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Bản giấy</legend>
        <label className="check">
          <input type="checkbox" checked={hasPrint} onChange={(e) => setHasPrint(e.target.checked)} disabled={f.status === 'wishlist'} />
          Có bản giấy trên kệ
        </label>
        <div className="row">
          <label>
            Trạng thái
            <select value={f.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <SuggestInput
            label="Vị trí (tủ, kệ)"
            placeholder="T1-K2"
            value={f.location}
            onChange={setField('location')}
            options={opts.locations}
            disabled={f.status === 'wishlist' || !hasPrint}
          />
        </div>
        <div className="row">
          <label>
            Số bản
            <input inputMode="numeric" value={f.copies} onChange={set('copies')} disabled={f.status === 'wishlist' || !hasPrint} />
          </label>
          <label>
            Tình trạng
            <input placeholder="tốt, ố vàng, mất bìa..." value={f.condition} onChange={set('condition')} disabled={f.status === 'wishlist' || !hasPrint} />
          </label>
          <label>
            Loại bìa
            <select value={f.binding} onChange={set('binding')} disabled={f.status === 'wishlist' || !hasPrint}>
              <option value="">Chưa ghi</option>
              {BINDINGS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </label>
        </div>
        {hasPrint && f.status !== 'wishlist' && (
          <div className="extra-prints">
            {extraPrints.map((x, i) => (
              <div key={i} className="extra-print">
                <div className="extra-print-head">
                  <b>Bản giấy thứ {i + 2}</b>
                  <button type="button" className="link" onClick={() => setExtraPrints((xs) => xs.filter((_, j) => j !== i))}>
                    Bỏ bản này
                  </button>
                </div>
                <div className="row">
                  <label>
                    Loại bìa
                    <select value={x.binding} onChange={(e) => setExtra(i, 'binding')(e.target.value)}>
                      <option value="">Chưa ghi</option>
                      {BINDINGS.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </label>
                  <SuggestInput label="Vị trí (tủ, kệ)" placeholder="T1-K2" value={x.location} onChange={setExtra(i, 'location')} options={opts.locations} />
                </div>
                <div className="row">
                  <label>
                    Số bản
                    <input inputMode="numeric" value={x.copies} onChange={(e) => setExtra(i, 'copies')(e.target.value)} />
                  </label>
                  <label>
                    Tình trạng
                    <input placeholder="tốt, ố vàng, mất bìa..." value={x.condition} onChange={(e) => setExtra(i, 'condition')(e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="secondary small-btn"
              onClick={() =>
                setExtraPrints((xs) => [
                  ...xs,
                  { binding: f.binding === 'hardcover' || f.binding === 'jacket' ? 'paperback' : f.binding ? 'hardcover' : '', location: f.location, copies: '1', condition: '' },
                ])
              }
            >
              + Thêm bản giấy khác (bìa khác hoặc để kệ khác)
            </button>
            <p className="hint">Dùng khi các bản chung một ISBN. Nếu bản bìa khác có ISBN riêng, nên tạo cuốn riêng bằng nút “Thêm bản bìa khác” ở trang chi tiết.</p>
          </div>
        )}
        <label>
          Ghi chú
          <textarea rows={2} value={f.notes} onChange={set('notes')} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Mua sách</legend>
        {f.status === 'wishlist' ? (
          <p className="hint">Sách đang ở danh sách muốn mua. Khi mua về, đổi trạng thái thành “Đang có” rồi ghi giá mua ở đây.</p>
        ) : (
          <p className="hint">Dùng cho trang Thống kê → Chi tiêu. Gõ số tiền kiểu 85000, 85.000 hay 85k đều được. Ghi giá mà bỏ trống ngày thì tính là mua hôm nay.</p>
        )}
        {f.status !== 'wishlist' && (
          <>
            <div className="row">
              <label>
                Ngày mua
                <input type="date" value={f.buyDate} max={todayIso()} onChange={set('buyDate')} />
              </label>
              <SuggestInput label="Mua ở đâu" placeholder="Fahasa, Oreka, hội sách..." value={f.buyFrom} onChange={setField('buyFrom')} options={buyFromOpts} />
            </div>
            <label className="check">
              <input type="checkbox" checked={f.gift === '1'} onChange={(e) => setField('gift')(e.target.checked ? '1' : '')} />
              Được tặng (không tính tiền)
            </label>
          </>
        )}
        <div className="row">
          {f.status !== 'wishlist' && (
            <label>
              Giá mua
              <input inputMode="decimal" placeholder="85.000" value={f.buyPrice} onChange={set('buyPrice')} disabled={f.gift === '1'} />
            </label>
          )}
          <label>
            Giá bìa
            <input inputMode="decimal" placeholder="120.000" value={f.coverPrice} onChange={set('coverPrice')} />
          </label>
        </div>
        {(() => {
          const b = parseVnd(f.buyPrice)
          const c = parseVnd(f.coverPrice)
          if (f.gift === '1' || !b || !c || f.status === 'wishlist') return null
          const d = Math.round((1 - b / c) * 100)
          return <p className="hint">{d > 0 ? `Rẻ hơn giá bìa ${d}% (tiết kiệm ${fmtVnd(c - b)}).` : d < 0 ? `Đắt hơn giá bìa ${-d}%.` : 'Đúng giá bìa.'}</p>
        })()}
      </fieldset>

      <fieldset>
        <legend>Sách điện tử</legend>
        <p className="hint">
          Dán link chia sẻ của tệp trên Google Drive. Độ lệch trang = số trang PDF đứng trước trang in số 1 (bìa, trang
          lót...), để trích dẫn luôn theo số trang in.
        </p>
        {ebooks.map((e, i) => (
          <div key={e.fileId ?? i} className="ebook-row">
            <div className="ebook-head">
              <span className="tag olive">{e.format.toUpperCase()}</span>
              {e.fileId && (
                <a href={driveViewUrl(e.fileId)} target="_blank" rel="noopener noreferrer">
                  Mở trên Google Drive
                </a>
              )}
              <button type="button" className="link remove" onClick={() => setEbooks(ebooks.filter((_, k) => k !== i))}>
                Bỏ
              </button>
            </div>
            <div className="row3">
              <label>
                Định dạng
                <select value={e.format} onChange={(ev) => patchEbook(i, { format: ev.target.value as EbookHolding['format'] })}>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="mobi">MOBI / AZW / PRC</option>
                  <option value="djvu">DjVu</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <label>
                Độ lệch trang
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={e.pageOffset ?? ''}
                  onChange={(ev) => patchEbook(i, { pageOffset: /^-?\d+$/.test(ev.target.value) ? Number(ev.target.value) : undefined })}
                />
              </label>
              <label>
                Lớp chữ
                <select value={e.textLayer ?? ''} onChange={(ev) => patchEbook(i, { textLayer: (ev.target.value || undefined) as EbookHolding['textLayer'] })}>
                  <option value="">Chưa rõ</option>
                  <option value="native">Có sẵn (tìm được chữ)</option>
                  <option value="ocr">Đã OCR</option>
                  <option value="none">Ảnh scan, chưa có chữ</option>
                </select>
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={!!e.sameEditionAsPrint}
                onChange={(ev) => patchEbook(i, { sameEditionAsPrint: ev.target.checked || undefined })}
              />
              Cùng ấn bản với bản giấy (số trang khớp nhau)
            </label>
          </div>
        ))}
        <div className="manual">
          <input
            placeholder="https://drive.google.com/file/d/..."
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDrive()
              }
            }}
          />
          <button type="button" className="secondary" onClick={addDrive}>
            Thêm
          </button>
        </div>
        {driveErr && <p className="error">{driveErr}</p>}
      </fieldset>


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
                  {loc?.kind === 'print' && loc.binding ? `, ${bindingLabel(loc.binding)?.toLowerCase()}` : ''}
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
          {cancelLabel}
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Lưu sách'}
        </button>
      </div>
    </form>
  )
}
