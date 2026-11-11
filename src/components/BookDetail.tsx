import { useState } from 'react'
import { categoryLabel } from '../data/categories'
import Cover from './Cover'
import { deleteBook, type StoreConfig } from '../data/githubStore'
import { nameToString, type Book, type Name } from '../types/book'

const TYPE_LABEL: Record<string, string> = {
  book: 'Sách',
  chapter: 'Chương trong sách tuyển',
  'article-journal': 'Bài tạp chí',
  'paper-conference': 'Bài kỷ yếu hội thảo',
  thesis: 'Luận văn, luận án',
  webpage: 'Trang web',
  document: 'Tài liệu khác',
}
const STATUS_LABEL: Record<Book['status'], string> = {
  owned: 'Đang có',
  lent: 'Đang cho mượn',
  wishlist: 'Muốn mua',
  lost: 'Thất lạc',
}
const LANG_LABEL: Record<string, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', fr: 'Tiếng Pháp', de: 'Tiếng Đức', ru: 'Tiếng Nga',
  zh: 'Tiếng Trung', pi: 'Pāli', km: 'Tiếng Khmer', th: 'Tiếng Thái',
}

const names = (ns?: Name[]) => (ns?.length ? ns.map(nameToString).join('; ') : undefined)
const fmtDate = (iso?: string) => {
  if (!iso) return undefined
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}
const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d)
const isbnPretty = (s?: string) =>
  s && s.length === 13 ? `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6, 12)}-${s.slice(12)}` : s

export default function BookDetail({
  cfg,
  book,
  onBack,
  onEdit,
  onDeleted,
}: {
  cfg: StoreConfig
  book: Book
  onBack: () => void
  onEdit: () => void
  onDeleted: (b: Book) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows: [string, string | number | undefined][] = [
    ['Loại', TYPE_LABEL[book.type] ?? book.type],
    ['Phụ đề', book.subtitle],
    ['Nhan đề gốc', book.originalTitle],
    ['Tác giả', names(book.authors)],
    ['Dịch giả', names(book.translators)],
    ['Chủ biên, biên soạn', names(book.editors)],
    ['Nằm trong', book.containerTitle],
    ['Tập / số', [book.volume, book.issue].filter(Boolean).join(' / ') || undefined],
    ['Trang', book.pageRange],
    [book.type === 'thesis' ? 'Cơ sở đào tạo' : 'Nhà xuất bản', book.publisher],
    ['Loại luận văn', book.genre],
    ['Đơn vị liên kết', book.partner],
    ['Nơi xuất bản', book.place],
    ['Năm xuất bản', book.year],
    ['Lần tái bản', book.edition],
    ['Số trang', book.pages],
    ['Khổ', book.sizeCm ? `${book.sizeCm} cm` : undefined],
    ['Ngôn ngữ', book.language ? (LANG_LABEL[book.language] ?? book.language) : undefined],
    ['ISBN', isbnPretty(book.isbn13) ?? book.isbn10],
    ['Chủ đề chi tiết', book.subjects?.join(', ')],
    ['Nhãn', book.tags?.join(', ')],
    ['Tùng thư', book.series ? `${book.series}${book.seriesNo !== undefined ? `, số ${book.seriesNo}` : ''}` : undefined],
    ['Trạng thái', STATUS_LABEL[book.status]],
    ['Cho mượn', book.loan ? `${book.loan.to}, từ ${dmy(book.loan.date)}${book.loan.due ? `, hẹn trả ${dmy(book.loan.due)}` : ''}` : undefined],
    ['Ghi chú', book.notes],
  ]

  return (
    <article className="card detail">
      <button className="link back" onClick={onBack}>
        ← Quay lại danh sách
      </button>
      <header className="detail-head">
        <Cover book={book} cfg={cfg} size="lg" />
        <div className="detail-title">
        <h2>{book.title}</h2>
        {book.subtitle && <div className="detail-sub">{book.subtitle}</div>}
        <div className="detail-by">
          {[names(book.authors), [book.publisher, book.year].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </div>
        {!!book.categories?.length && (
          <div className="chips">
            {book.categories.map((c) => (
              <span key={c} className="chip static">
                {categoryLabel(c)}
              </span>
            ))}
          </div>
        )}
        </div>
      </header>

      <dl className="fields">
        {rows
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      {book.holdings.length > 0 && (
        <section>
          <h3>Bản lưu giữ</h3>
          <ul className="holdings">
            {book.holdings.map((h, i) =>
              h.kind === 'print' ? (
                <li key={i}>
                  <span className="tag">Bản giấy</span> {h.location ? `Kệ ${h.location}` : 'Chưa ghi vị trí'}
                  {h.copies && h.copies > 1 ? `, ${h.copies} bản` : ''}
                  {h.condition ? `, ${h.condition}` : ''}
                </li>
              ) : (
                <li key={i}>
                  <span className="tag olive">Sách điện tử</span> {h.format.toUpperCase()}
                  {h.storage === 'gdrive' ? ' trên Google Drive' : h.storage === 'local' ? ' trên máy' : ''}
                  {h.pdfPages ? `, ${h.pdfPages} trang` : ''}
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <p className="muted small">
        Thêm lúc {fmtDate(book.createdAt)}
        {book.updatedAt !== book.createdAt ? ` · sửa lần cuối ${fmtDate(book.updatedAt)}` : ''}
      </p>

      {error && <p className="error">{error}</p>}

      {confirming ? (
        <div className="confirm">
          <div>
            <div className="state-title">Xóa cuốn này khỏi thư viện?</div>
            <div className="muted">
              Bản ghi sẽ mất khỏi danh mục. Nếu xóa nhầm, bản cũ vẫn còn trong lịch sử commit của repo dữ liệu.
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
      ) : (
        <div className="actions">
          <button className="secondary" onClick={() => setConfirming(true)}>
            Xóa
          </button>
          <button onClick={onEdit}>Sửa</button>
        </div>
      )}
    </article>
  )
}
