import { useState } from 'react'
import type { StoreConfig } from '../data/githubStore'
import { lookupIsbn } from '../data/lookup'
import type { Book } from '../types/book'
import Cover from './Cover'
import Scanner from './Scanner'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

// Biểu mẫu luôn lưu isbn13 (ISBN-10 được đổi sang 13), nên chỉ cần so isbn13.
export const findByIsbn = (books: Book[], isbn13: string) => books.find((b) => b.isbn13 === isbn13)

type Phase =
  | { kind: 'scan' }
  | { kind: 'looking'; isbn: string }
  | { kind: 'exists'; book: Book }
  | { kind: 'notfound'; isbn: string }

/** Quét một cuốn: đã có thì báo ngay kệ nào; chưa có thì tra cứu rồi mở biểu mẫu điền sẵn. */
export default function ScanOne({
  cfg,
  books,
  onOpen,
  onPrefill,
  onCancel,
}: {
  cfg: StoreConfig
  books: Book[]
  onOpen: (b: Book) => void
  onPrefill: (draft: Partial<Book>) => void
  onCancel: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'scan' })

  const handle = async (isbn: string) => {
    const existing = findByIsbn(books, isbn)
    if (existing) return setPhase({ kind: 'exists', book: existing })
    setPhase({ kind: 'looking', isbn })
    const r = await lookupIsbn(isbn)
    if (r?.draft.title) onPrefill(r.draft)
    else setPhase({ kind: 'notfound', isbn })
  }

  return (
    <div className="card scan">
      <div className="card-head">
        <img src={asset('cover/icon-searching.webp')} alt="" />
        <div>
          <h2>Quét ISBN</h2>
          <p className="muted">Đưa mã vạch ở bìa sau vào khung. Ứng dụng báo ngay cuốn này đã có hay chưa.</p>
        </div>
      </div>

      {phase.kind === 'scan' && <Scanner onIsbn={(i) => void handle(i)} hint="Giữ mã vạch nằm ngang, đủ sáng" />}

      {phase.kind === 'looking' && (
        <div className="state">
          <img src={asset('cover/not-found.webp')} alt="" />
          <div>
            <div className="state-title">Chưa có trong thư viện, đang tra cứu...</div>
            <div className="muted">ISBN {phase.isbn} · Open Library, Google Books</div>
          </div>
        </div>
      )}

      {phase.kind === 'exists' && (
        <div className="found">
          <Cover book={phase.book} cfg={cfg} />
          <div>
            <div className="state-title">Đã có trong thư viện</div>
            <div className="title">{phase.book.title}</div>
            <div className="muted">
              {(() => {
                const p = phase.book.holdings.find((h) => h.kind === 'print')
                return p?.kind === 'print' && p.location ? `Ở kệ ${p.location}` : 'Chưa ghi vị trí kệ'
              })()}
              {phase.book.status === 'lent' ? ' · đang cho mượn' : ''}
              {phase.book.status === 'wishlist' ? ' · trong danh sách muốn mua' : ''}
            </div>
          </div>
        </div>
      )}

      {phase.kind === 'notfound' && (
        <div className="state">
          <img src={asset('cover/not-added.webp')} alt="" />
          <div>
            <div className="state-title">Chưa có trong thư viện, và không tìm thấy dữ liệu trực tuyến</div>
            <div className="muted">ISBN {phase.isbn}. Sách Việt thường chưa có trên các kho dữ liệu này; anh nhập tay phần còn lại.</div>
          </div>
        </div>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Đóng
        </button>
        {phase.kind === 'exists' && (
          <button type="button" className="secondary" onClick={() => onOpen(phase.book)}>
            Mở chi tiết
          </button>
        )}
        {phase.kind === 'notfound' && (
          <button type="button" className="secondary" onClick={() => onPrefill({ isbn13: phase.isbn })}>
            Nhập tay
          </button>
        )}
        {phase.kind !== 'scan' && phase.kind !== 'looking' && (
          <button type="button" onClick={() => setPhase({ kind: 'scan' })}>
            Quét cuốn khác
          </button>
        )}
      </div>
    </div>
  )
}
