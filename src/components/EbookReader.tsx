import { lazy, Suspense, useEffect, useState } from 'react'
import { driveViewUrl } from '../data/drive'
import type { Book, EbookHolding } from '../types/book'
import { driveMediaUrl } from '../data/configStore'
import { QuoteForm, type ExcerptActions } from './Quotes'

const PdfReader = lazy(() => import('./PdfReader'))

/**
 * Đọc sách điện tử ngay trong ứng dụng: nhúng trình xem của Google Drive (/preview) toàn màn hình.
 * Kèm ô quy đổi trang in sang trang PDF theo độ lệch trang đã khai báo.
 */
export default function EbookReader({
  book,
  holding,
  onClose,
  driveApiKey,
  allTopics = [],
  excerptActions,
  onOpenSettings,
}: {
  book: Book
  holding: EbookHolding
  onClose: () => void
  driveApiKey?: string
  allTopics?: string[]
  excerptActions?: ExcerptActions
  onOpenSettings?: () => void
}) {
  const canPdfJs = holding.format === 'pdf' && !!holding.fileId && !!driveApiKey
  const [mode, setMode] = useState<'pdfjs' | 'drive'>(canPdfJs ? 'pdfjs' : 'drive')
  const [quote, setQuote] = useState<{ text: string; pdfPage: number } | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [printPage, setPrintPage] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const id = holding.fileId!
  const offset = holding.pageOffset ?? 0
  const pdfPage = /^\d+$/.test(printPage) ? Number(printPage) + offset : null

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.reader-quote') && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => setSlow(true), 8000)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [onClose])

  return (
    <div className="reader" role="dialog" aria-label={`Đọc: ${book.title}`}>
      <header className="reader-bar">
        <button className="reader-close" onClick={onClose} aria-label="Đóng trình đọc">
          ← Đóng
        </button>
        <div className="reader-title">
          <div className="rt-main">{book.title}</div>
          <div className="rt-sub">
            {holding.format.toUpperCase()}
            {offset ? ` · lệch ${offset} trang so với bản in` : ''}
            {holding.textLayer === 'ocr' ? ' · chữ từ OCR, đối chiếu bản in khi trích dẫn' : ''}
          </div>
        </div>
        {canPdfJs && (
          <button className="link reader-switch" onClick={() => setMode(mode === 'pdfjs' ? 'drive' : 'pdfjs')}>
            {mode === 'pdfjs' ? 'Xem bằng Google Drive' : 'Xem bằng trình đọc PDF'}
          </button>
        )}
        {holding.format === 'pdf' && mode === 'drive' && (
          <label className="page-calc" title="Nhập số trang in để biết cần tới trang nào trong tệp PDF">
            Trang in
            <input inputMode="numeric" value={printPage} onChange={(e) => setPrintPage(e.target.value.replace(/\D/g, ''))} placeholder="số" />
            <span>{pdfPage ? `→ trang PDF ${pdfPage}` : offset ? `(+${offset})` : ''}</span>
          </label>
        )}
        <a className="reader-open" href={driveViewUrl(id)} target="_blank" rel="noopener noreferrer">
          Mở trong tab mới
        </a>
      </header>

      {holding.format === 'epub' && (
        <div className="reader-note">
          Trình xem của Google Drive thường không hiển thị được EPUB. Nếu khung bên dưới không có nội dung, hãy bấm "Mở
          trong tab mới" rồi mở tệp bằng ứng dụng đọc sách.
        </div>
      )}

      {mode === 'pdfjs' && driveApiKey ? (
        <div className="reader-frame pdfjs">
          <Suspense fallback={<div className="reader-loading">Đang tải trình đọc PDF…</div>}>
            <PdfReader
              url={driveMediaUrl(id, driveApiKey)}
              fileId={id}
              offset={offset}
              onFallback={() => setMode('drive')}
              onQuote={excerptActions ? (text, pdfPage) => setQuote({ text, pdfPage }) : undefined}
            />
          </Suspense>
        </div>
      ) : (
      <div className="reader-frame">
        {!loaded && <div className="reader-loading">Đang mở sách từ Google Drive...</div>}
        <iframe
          src={`https://drive.google.com/file/d/${id}/preview`}
          title={book.title}
          allow="autoplay; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
      )}

      {mode === 'drive' && !driveApiKey && holding.format === 'pdf' && loaded && (
        <div className="reader-help">
          Drive báo <b>“Tệp này quá lớn không thể xem trước”</b>? Thêm khóa Google Drive API ở{' '}
          {onOpenSettings ? (
            <button className="link" onClick={onOpenSettings}>
              Cài đặt
            </button>
          ) : (
            'Cài đặt'
          )}{' '}
          để dùng trình đọc PDF riêng của ứng dụng: mở được tệp lớn, tải dần từng trang, bôi đen chữ để trích dẫn.
        </div>
      )}

      {savedMsg && <div className="reader-toast">{savedMsg}</div>}

      {quote && excerptActions && (
        <div className="dialog-backdrop reader-quote" onMouseDown={(e) => e.target === e.currentTarget && setQuote(null)}>
          <div className="dialog wide" role="dialog" aria-label="Ghi trích dẫn">
            <h3>Ghi trích dẫn</h3>
            <QuoteForm
              book={book}
              allTopics={allTopics}
              prefill={
                holding.pageOffset !== undefined
                  ? { text: quote.text, page: String(quote.pdfPage - offset), pageSource: 'print' }
                  : { text: quote.text, page: String(quote.pdfPage), pageSource: 'ebook' }
              }
              onCancel={() => setQuote(null)}
              onSave={async (ex) => {
                await excerptActions.onSave(ex)
                setQuote(null)
                window.getSelection()?.removeAllRanges()
                setSavedMsg('Đã lưu trích dẫn')
                setTimeout(() => setSavedMsg(null), 2200)
              }}
            />
          </div>
        </div>
      )}

      {slow && mode === 'drive' && (
        <div className="reader-help">
          Không thấy nội dung hoặc Drive báo cần quyền truy cập? Trình xem nhúng chỉ chạy ổn định khi tệp được chia sẻ ở chế
          độ <b>"Bất kỳ ai có đường liên kết"</b> (quyền Người xem). Đổi trong Google Drive: chuột phải vào tệp, chọn Chia
          sẻ. Link chỉ nằm trong repo dữ liệu riêng tư của anh nên người ngoài không biết đến. Nếu không muốn đổi, bấm "Mở
          trong tab mới".
          <button className="link" onClick={() => setSlow(false)}>
            Ẩn
          </button>
        </div>
      )}
    </div>
  )
}
