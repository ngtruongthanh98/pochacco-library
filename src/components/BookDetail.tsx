import { useMemo, useState } from 'react'
import { categoryLabel } from '../data/categories'
import { isEbookOnly } from '../data/format'
import type { Excerpt } from '../types/excerpt'
import { BookQuotes, type ExcerptActions } from './Quotes'
import { driveViewUrl } from '../data/drive'
import { deleteBook, type StoreConfig } from '../data/githubStore'
import { relatedBooks } from '../search/related'
import { otherEditions } from '../search/editions'
import { bindingLabel, nameToString, type Book, type EbookHolding, type Name } from '../types/book'
import Cover from './Cover'

function Description({ text, onEdit }: { text?: string; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  if (!text?.trim())
    return (
      <section className="description empty-desc">
        <h3>Giới thiệu</h3>
        <p className="muted">
          Chưa có mô tả.{' '}
          <button type="button" className="link" onClick={onEdit}>
            Thêm mô tả
          </button>
        </p>
      </section>
    )
  const paras = text.trim().split(/\n\s*\n/)
  const long = text.length > 700 || paras.length > 4
  return (
    <section className="description">
      <h3>Giới thiệu</h3>
      <div className={long && !open ? 'desc-body clamped' : 'desc-body'}>
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long && (
        <button type="button" className="link desc-toggle" onClick={() => setOpen(!open)}>
          {open ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </section>
  )
}

const TYPE_LABEL: Record<string, string> = {
  book: 'Sách',
  chapter: 'Chương trong sách tuyển',
  'article-journal': 'Bài tạp chí',
  'paper-conference': 'Bài kỷ yếu hội thảo',
  thesis: 'Luận văn, luận án',
  webpage: 'Trang web',
  document: 'Tài liệu khác',
}
const STATUS: Record<Book['status'], { label: string; cls: string }> = {
  owned: { label: 'Đang có', cls: 'ok' },
  lent: { label: 'Đang cho mượn', cls: 'warn' },
  wishlist: { label: 'Muốn mua', cls: 'gold' },
  lost: { label: 'Thất lạc', cls: 'bad' },
}
const LANG_LABEL: Record<string, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', fr: 'Tiếng Pháp', de: 'Tiếng Đức', ru: 'Tiếng Nga',
  zh: 'Tiếng Trung', pi: 'Pāli', km: 'Tiếng Khmer', th: 'Tiếng Thái',
}

const fmtDate = (iso?: string) => {
  if (!iso) return undefined
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d)
const isbnPretty = (s?: string) =>
  s && s.length === 13 ? `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6, 12)}-${s.slice(12)}` : s

/** Tên người bấm được: bấm thì tìm các sách khác có người này. */
function People({ label, names, onSearch }: { label: string; names?: Name[]; onSearch: (q: string) => void }) {
  // onSearch ở đây mở trang tác giả (tiểu sử, mọi sách của người đó).
  if (!names?.length) return null
  return (
    <div className="people">
      <span className="people-role">{label}</span>
      {names.map((n, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <button className="linkish" onClick={() => onSearch(nameToString(n))} title="Xem trang tác giả">
            {nameToString(n)}
          </button>
        </span>
      ))}
    </div>
  )
}

export default function BookDetail({
  cfg,
  book,
  books,
  onBack,
  onEdit,
  onDuplicate,
  onAddEdition,
  picked = false,
  pickName,
  onTogglePick,
  onDeleted,
  excerpts,
  allTopics,
  excerptActions,
  onTopic,
  onOpen,
  onSearch,
  onPerson,
  onCategory,
  onRead,
}: {
  cfg: StoreConfig
  book: Book
  books: Book[]
  onBack: () => void
  onEdit: () => void
  onDuplicate: () => void
  onAddEdition: () => void
  picked?: boolean
  pickName?: string
  onTogglePick?: () => void
  onDeleted: (b: Book) => void
  excerpts: Excerpt[]
  allTopics: string[]
  excerptActions: ExcerptActions
  onTopic: (t: string) => void
  onOpen: (b: Book) => void
  onSearch: (q: string) => void
  onPerson: (name: string) => void
  onCategory: (id: string) => void
  onRead: (h: EbookHolding) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editions = useMemo(() => otherEditions(book, books), [book, books])
  const related = useMemo(() => {
    const ed = new Set(editions.map((b) => b.id))
    return relatedBooks(book, books).filter((r) => !ed.has(r.book.id))
  }, [book, books, editions])

  const prints = book.holdings.filter((h) => h.kind === 'print')
  const mainLoc = prints[0]?.kind === 'print' ? prints[0].location : undefined
  const st = STATUS[book.status]
  const facts = [
    book.year && String(book.year),
    book.pages && `${book.pages} trang`,
    book.language && (LANG_LABEL[book.language] ?? book.language),
    book.edition && `Tái bản lần ${book.edition}`,
  ].filter(Boolean) as string[]

  const rows: [string, React.ReactNode][] = [
    ['Loại tài liệu', TYPE_LABEL[book.type] ?? book.type],
    [
      book.type === 'thesis' ? 'Cơ sở đào tạo' : 'Nhà xuất bản',
      book.publisher && (
        <button className="linkish" onClick={() => onSearch(book.publisher!)}>
          {book.publisher}
        </button>
      ),
    ],
    ['Loại luận văn', book.genre],
    [
      'Đơn vị liên kết',
      book.partner && (
        <button className="linkish" onClick={() => onSearch(book.partner!)}>
          {book.partner}
        </button>
      ),
    ],
    ['Nơi xuất bản', book.place],
    ['Năm xuất bản', book.year],
    ['Số trang', book.pages],
    ['Khổ', book.sizeCm ? `${book.sizeCm} cm` : undefined],
    ['Nằm trong', book.containerTitle],
    ['Tập / số', [book.volume, book.issue].filter(Boolean).join(' / ') || undefined],
    ['Trang', book.pageRange],
    ['ISBN', isbnPretty(book.isbn13) ?? book.isbn10],
    [
      'Tùng thư',
      book.series && (
        <button className="linkish" onClick={() => onSearch(book.series!)}>
          {book.series}
          {book.seriesNo !== undefined ? `, số ${book.seriesNo}` : ''}
        </button>
      ),
    ],
    ['Chủ đề chi tiết', book.subjects?.join(', ')],
    ['Nhãn', book.tags?.join(', ')],
  ]

  return (
    <article className="card detail">
      <div className="detail-top">
        <button className="link back" onClick={onBack}>
          ← Quay lại danh sách
        </button>
        <div className="detail-actions">
          <button
            className="secondary small-btn"
            onClick={onDuplicate}
            title="Tạo cuốn tương tự (ví dụ tập khác của bộ sách) từ thông tin của cuốn này"
          >
            Nhân bản
          </button>
          <button
            className="secondary small-btn"
            onClick={onAddEdition}
            title="Tạo cuốn mới cho bản bìa khác (thường có ISBN riêng), giữ nguyên nhan đề và tác giả"
          >
            Thêm bản bìa khác
          </button>
          {onTogglePick && (
            <button className={`small-btn ${picked ? '' : 'secondary'}`} onClick={onTogglePick} aria-pressed={picked}>
              {picked ? (pickName ? `✓ Có trong «${pickName}»` : '✓ Đã chọn để trích dẫn') : pickName ? `Thêm vào «${pickName}»` : 'Thêm vào trích dẫn'}
            </button>
          )}
          <button className="secondary small-btn" onClick={onEdit}>
            Sửa thông tin
          </button>
        </div>
      </div>

      {isEbookOnly(book) && (
        <div className="ebook-only-note">
          <span className="tag ebook-only">Ebook only</span>
          <span>
            Cuốn này mới có bản điện tử. Khi có sách giấy, bấm{' '}
            <button type="button" className="link" onClick={onEdit}>Sửa thông tin</button> và đánh dấu “Có bản giấy trên kệ”; nhãn này sẽ tự bỏ.
          </span>
        </div>
      )}

      <header className="detail-hero">
        <Cover book={book} cfg={cfg} size="lg" />
        <div className="hero-info">
          {!!book.categories?.length && (
            <div className="chips">
              {book.categories.map((c) => (
                <button key={c} className="chip static" onClick={() => onCategory(c)}>
                  {categoryLabel(c)}
                </button>
              ))}
            </div>
          )}
          <h2>{book.title}</h2>
          {book.subtitle && <div className="detail-sub">{book.subtitle}</div>}
          {book.originalTitle && (
            <div className="muted">
              Nguyên tác: <i>{book.originalTitle}</i>
            </div>
          )}
          <People label="Tác giả" names={book.authors} onSearch={onPerson} />
          <People label="Dịch giả" names={book.translators} onSearch={onPerson} />
          <People label="Biên soạn" names={book.editors} onSearch={onPerson} />
          {(book.publisher || facts.length > 0) && (
            <div className="facts">
              {book.publisher && <span>{book.publisher}</span>}
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          )}
          <div className="where-box">
            <div>
              <div className="muted small">Vị trí</div>
              <div className="where-loc">
                {book.status === 'wishlist' ? 'Chưa có' : mainLoc ? `Kệ ${mainLoc}` : 'Chưa ghi kệ'}
              </div>
            </div>
            <span className={`status s-${st.cls}`}>{st.label}</span>
          </div>
          {(() => {
            const eb = book.holdings.find((h): h is EbookHolding => h.kind === 'ebook' && !!h.fileId && h.storage === 'gdrive')
            return eb ? (
              <button className="read-now" onClick={() => onRead(eb)}>
                Đọc sách điện tử
              </button>
            ) : null
          })()}
          {book.loan && (
            <div className="loan">
              Cho <b>{book.loan.to}</b> mượn từ {dmy(book.loan.date)}
              {book.loan.due ? `, hẹn trả ${dmy(book.loan.due)}` : ''}
            </div>
          )}
        </div>
      </header>

      {book.notes && <blockquote className="notes">{book.notes}</blockquote>}

      <Description key={book.id} text={book.description} onEdit={onEdit} />

      <BookQuotes key={`q-${book.id}`} book={book} excerpts={excerpts} allTopics={allTopics} actions={excerptActions} onTopic={onTopic} />

      <section>
        <h3>Thông tin xuất bản</h3>
        <dl className="fields">
          {rows
            .filter(([, v]) => v !== undefined && v !== '' && v !== false && v !== 0)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      {book.holdings.length > 0 && (
        <section>
          <h3>Bản lưu giữ</h3>
          <ul className="holdings">
            {book.holdings.map((h, i) =>
              h.kind === 'print' ? (
                <li key={i}>
                  <span className="tag">Bản giấy</span>
                  {h.binding && <span className="tag binding">{bindingLabel(h.binding)}</span>} {h.location ? `Kệ ${h.location}` : 'Chưa ghi vị trí'}
                  {h.copies && h.copies > 1 ? `, ${h.copies} bản` : ''}
                  {h.condition ? `, ${h.condition}` : ''}
                </li>
              ) : (
                <li key={i} className="ebook-li">
                  <span className="tag olive">Sách điện tử</span> {h.format.toUpperCase()}
                  {h.storage === 'gdrive' ? ' trên Google Drive' : h.storage === 'local' ? ' trên máy' : ''}
                  {h.pdfPages ? `, ${h.pdfPages} trang` : ''}
                  {h.pageOffset ? `, lệch ${h.pageOffset} trang so với bản in` : ''}
                  {h.sameEditionAsPrint ? ', cùng ấn bản với bản giấy' : ''}
                  {h.textLayer === 'ocr' ? ', chữ từ OCR' : h.textLayer === 'none' ? ', ảnh scan chưa có chữ' : ''}
                  {h.storage === 'gdrive' && h.fileId && (
                    <>
                      <button className="open-drive" onClick={() => onRead(h)}>
                        Đọc ngay
                      </button>
                      <a className="drive-link" href={driveViewUrl(h.fileId)} target="_blank" rel="noopener noreferrer">
                        Mở trên Drive
                      </a>
                    </>
                  )}
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {editions.length > 0 && (
        <section>
          <h3>Các bản khác của cuốn này</h3>
          <ul className="editions">
            {editions.map((b) => {
              const bindings = [...new Set(b.holdings.flatMap((h) => (h.kind === 'print' && h.binding ? [bindingLabel(h.binding)!] : [])))]
              const ebook = b.holdings.some((h) => h.kind === 'ebook')
              return (
                <li key={b.id}>
                  <button className="edition-card" onClick={() => onOpen(b)}>
                    <Cover book={b} cfg={cfg} />
                    <span className="related-body">
                      <span className="related-title">
                        {bindings.length ? bindings.join(', ') : b.holdings.some((h) => h.kind === 'print') ? 'Bản giấy' : ebook ? 'Sách điện tử' : 'Muốn mua'}
                      </span>
                      <span className="related-by">
                        {[b.publisher, b.year, b.edition ? `tái bản lần ${b.edition}` : '', b.pages ? `${b.pages} trang` : '', b.isbn13 ? `ISBN ${b.isbn13}` : 'chưa có ISBN']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <h3>Sách liên quan trong thư viện</h3>
        {related.length ? (
          <ul className="related">
            {related.map((r) => (
              <li key={r.book.id}>
                <button className="related-card" onClick={() => onOpen(r.book)}>
                  <Cover book={r.book} cfg={cfg} />
                  <span className="related-body">
                    <span className="related-title">{r.book.title}</span>
                    <span className="related-by">
                      {[(r.book.authors ?? []).map(nameToString).join(', '), r.book.year].filter(Boolean).join(' · ')}
                    </span>
                    <span className="related-why">{r.reason}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Chưa tìm thấy cuốn nào liên quan. Gắn danh mục, chủ đề chi tiết hoặc tùng thư cho sách để gợi ý chính
            xác hơn.
          </p>
        )}
      </section>

      <footer className="detail-foot">
        <span className="muted small">
          Thêm ngày {fmtDate(book.createdAt)}
          {book.updatedAt !== book.createdAt ? ` · sửa lần cuối ${fmtDate(book.updatedAt)}` : ''}
        </span>
        {!confirming && (
          <button className="link danger-link" onClick={() => setConfirming(true)}>
            Xóa sách này
          </button>
        )}
      </footer>

      {error && <p className="error">{error}</p>}
      {confirming && (
        <div className="confirm">
          <div>
            <div className="state-title">Xóa cuốn này khỏi thư viện?</div>
            <div className="muted">
              Bản ghi sẽ mất khỏi danh mục
              {excerpts.some((e) => e.bookId === book.id)
                ? `, cùng ${excerpts.filter((e) => e.bookId === book.id).length} trích dẫn của cuốn này`
                : ''}
              . Nếu xóa nhầm, bản cũ vẫn còn trong lịch sử commit của repo dữ liệu.
            </div>
          </div>
          <div className="actions">
            <button className="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Không xóa
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await deleteBook(cfg, book)
                  onDeleted(book)
                } catch (err) {
                  setError((err as Error).message)
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
