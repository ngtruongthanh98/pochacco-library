import { useEffect, useState } from 'react'
import { driveViewUrl } from '../data/drive'
import type { Book, EbookHolding } from '../types/book'

/**
 * Đọc sách điện tử ngay trong ứng dụng: nhúng trình xem của Google Drive (/preview) toàn màn hình.
 * Kèm ô quy đổi trang in sang trang PDF theo độ lệch trang đã khai báo.
 */
export default function EbookReader({
  book,
  holding,
  onClose,
}: {
  book: Book
  holding: EbookHolding
  onClose: () => void
}) {
  const [printPage, setPrintPage] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)
  const id = holding.fileId!
  const offset = holding.pageOffset ?? 0
  const pdfPage = /^\d+$/.test(printPage) ? Number(printPage) + offset : null

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
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
        {holding.format === 'pdf' && (
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

      {slow && (
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
