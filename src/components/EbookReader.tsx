import { lazy, Suspense, useEffect, useState } from 'react'
import { driveViewUrl } from '../data/drive'
import type { Book, EbookHolding } from '../types/book'
import { driveFileMeta, driveMediaUrl, readerKind, type DriveMeta } from '../data/configStore'
import type { Excerpt } from '../types/excerpt'
import { QuoteForm, type ExcerptActions } from './Quotes'

const PdfReader = lazy(() => import('./PdfReader'))
const BookReader = lazy(() => import('./BookReader'))

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
  const hasKey = !!holding.fileId && !!driveApiKey
  const ownReader = holding.format === 'epub' || holding.format === 'mobi'
  // Có khóa API: hỏi Drive tên/kiểu tệp thật rồi chọn trình đọc (định dạng khai báo có thể sai).
  const [mode, setMode] = useState<'detect' | 'pdfjs' | 'book' | 'drive' | 'nokey' | 'error'>(
    hasKey ? 'detect' : ownReader ? 'nokey' : 'drive',
  )
  const [meta, setMeta] = useState<DriveMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Pick<Excerpt, 'text' | 'page' | 'pageSource' | 'note'> | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [printPage, setPrintPage] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const id = holding.fileId!
  const offset = holding.pageOffset ?? 0
  const pdfPage = /^\d+$/.test(printPage) ? Number(printPage) + offset : null

  useEffect(() => {
    if (!hasKey) return
    let cancelled = false
    driveFileMeta(holding.fileId!, driveApiKey!)
      .then((m) => {
        if (cancelled) return
        setMeta(m)
        const k = readerKind(m)
        setMode(k === 'pdf' ? 'pdfjs' : k === 'book' ? 'book' : 'drive')
      })
      .catch((e: Error) => {
        if (cancelled) return
        setMetaError(e.message)
        setMode('error')
      })
    return () => {
      cancelled = true
    }
  }, [hasKey, holding.fileId, driveApiKey])

  const realFormat = meta ? (meta.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? holding.format).toUpperCase() : holding.format.toUpperCase()

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
            {realFormat}
            {offset ? ` · lệch ${offset} trang so với bản in` : ''}
            {holding.textLayer === 'ocr' ? ' · chữ từ OCR, đối chiếu bản in khi trích dẫn' : ''}
          </div>
        </div>
        {hasKey && meta && readerKind(meta) && (
          <button className="link reader-switch" onClick={() => setMode(mode === 'drive' ? (readerKind(meta) === 'pdf' ? 'pdfjs' : 'book') : 'drive')}>
            {mode === 'drive' ? 'Xem bằng trình đọc của ứng dụng' : 'Xem bằng Google Drive'}
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

      {mode === 'detect' ? (
        <div className="reader-frame pdfjs">
          <div className="reader-loading">Đang kiểm tra tệp trên Google Drive…</div>
        </div>
      ) : mode === 'error' ? (
        <div className="reader-frame pdfjs">
          <div className="pdf-error">
            <p>{metaError}</p>
            <button onClick={() => setMode('drive')}>Thử xem bằng Google Drive</button>
          </div>
        </div>
      ) : mode === 'nokey' ? (
        <div className="reader-frame pdfjs">
          <div className="pdf-error">
            <p>
              Google Drive không xem trước được {holding.format === 'mobi' ? 'MOBI, AZW, AZW3, PRC' : 'EPUB'}. Thêm khóa Google Drive API ở{' '}
              {onOpenSettings ? (
                <button className="link" onClick={onOpenSettings}>
                  Cài đặt
                </button>
              ) : (
                'Cài đặt'
              )}{' '}
              để đọc ngay trong ứng dụng.
            </p>
            <button className="secondary" onClick={() => setMode('drive')}>
              Vẫn thử xem bằng Google Drive
            </button>
          </div>
        </div>
      ) : mode === 'book' && driveApiKey && meta ? (
        <div className="reader-frame pdfjs">
          <Suspense fallback={<div className="reader-loading">Đang tải trình đọc sách…</div>}>
            <BookReader
              url={driveMediaUrl(id, driveApiKey)}
              fileId={id}
              fileName={meta.name}
              onQuote={
                excerptActions
                  ? (text, where) =>
                      setQuote({
                        text,
                        ...(where.page ? { page: where.page, pageSource: 'print' as const } : {}),
                        ...(where.chapter ? { note: `Chương/mục: ${where.chapter}` } : {}),
                      })
                  : undefined
              }
            />
          </Suspense>
        </div>
      ) : mode === 'pdfjs' && driveApiKey ? (
        <div className="reader-frame pdfjs">
          <Suspense fallback={<div className="reader-loading">Đang tải trình đọc PDF…</div>}>
            <PdfReader
              url={driveMediaUrl(id, driveApiKey)}
              fileId={id}
              offset={offset}
              onFallback={() => setMode('drive')}
              onQuote={
                excerptActions
                  ? (text, pdfPage) =>
                      setQuote(
                        holding.pageOffset !== undefined
                          ? { text, page: String(pdfPage - offset), pageSource: 'print' }
                          : { text, page: String(pdfPage), pageSource: 'ebook' },
                      )
                  : undefined
              }
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
              prefill={quote}
              onCancel={() => setQuote(null)}
              onSave={async (ex) => {
                await excerptActions.onSave(ex)
                setQuote(null)
                window.getSelection()?.removeAllRanges()
                document.querySelectorAll('iframe').forEach((f) => {
                  try {
                    f.contentWindow?.getSelection()?.removeAllRanges()
                  } catch {
                    /* khung khác nguồn */
                  }
                })
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
