import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './pdf-textlayer.css'
import { driveErrorText } from '../data/configStore'

GlobalWorkerOptions.workerSrc = workerUrl

const MB = 1024 * 1024
const fmtMB = (n: number) => `${(n / MB).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`

const lastPageKey = (id: string) => `pochacco-library:last-page:${id}`

/**
 * Trình đọc PDF trong ứng dụng (PDF.js). Tải tệp qua Google Drive API theo từng đoạn
 * nên mở được cả tệp rất lớn mà trình xem của Drive từ chối. Có lớp chữ để bôi đen và trích dẫn.
 */
export default function PdfReader({
  url,
  fileId,
  offset,
  onFallback,
  onQuote,
}: {
  url: string
  fileId: string
  /** Trang PDF = trang in + offset */
  offset: number
  onFallback: () => void
  onQuote?: (text: string, pdfPage: number) => void
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [page, setPage] = useState(() => {
    try {
      return Math.max(1, Number(localStorage.getItem(lastPageKey(fileId))) || 1)
    } catch {
      return 1
    }
  })
  const [zoom, setZoom] = useState(1)
  const [pageInput, setPageInput] = useState('')
  const [printInput, setPrintInput] = useState('')
  const [rendering, setRendering] = useState(false)
  const [hasSel, setHasSel] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // --- Mở tài liệu ---
  useEffect(() => {
    let cancelled = false
    let task: ReturnType<typeof getDocument> | null = null
    ;(async () => {
      // Thử đọc vài byte đầu để báo lỗi quyền truy cập rõ ràng thay vì lỗi chung của PDF.js.
      try {
        const probe = await fetch(url, { headers: { Range: 'bytes=0-1023' } })
        if (!probe.ok) {
          if (!cancelled) setError(await driveErrorText(probe))
          return
        }
        await probe.arrayBuffer()
      } catch {
        if (!cancelled) setError('Không kết nối được tới Google Drive. Kiểm tra mạng rồi thử lại.')
        return
      }
      if (cancelled) return
      task = getDocument({ url, rangeChunkSize: MB, disableAutoFetch: true, disableStream: true })
      task.onProgress = (p: { loaded: number; total: number }) => !cancelled && setProgress(p)
      try {
        const d = await task.promise
        if (cancelled) return void d.loadingTask.destroy()
        setDoc(d)
        setPage((p) => Math.min(p, d.numPages))
      } catch (e) {
        if (!cancelled) setError(`Không mở được tệp PDF: ${(e as Error).message}`)
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [url])

  useEffect(() => () => void doc?.loadingTask.destroy(), [doc])

  // --- Theo dõi bề rộng khung để vừa chiều ngang ---
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // --- Vẽ trang ---
  useEffect(() => {
    if (!doc || !width) return
    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayer: TextLayer | null = null
    setRendering(true)
    ;(async () => {
      const p = await doc.getPage(page)
      if (cancelled) return
      const base = p.getViewport({ scale: 1 })
      const scale = Math.max(0.3, ((Math.min(width, 1100) - 24) / base.width) * zoom)
      const vp = p.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const canvas = canvasRef.current!
      canvas.width = Math.floor(vp.width * dpr)
      canvas.height = Math.floor(vp.height * dpr)
      canvas.style.width = `${Math.floor(vp.width)}px`
      canvas.style.height = `${Math.floor(vp.height)}px`
      const holder = pageRef.current!
      holder.style.width = `${Math.floor(vp.width)}px`
      holder.style.height = `${Math.floor(vp.height)}px`
      holder.style.setProperty('--scale-factor', String(scale))
      holder.style.setProperty('--total-scale-factor', String(scale))
      holder.style.setProperty('--scale-round-x', '1px')
      holder.style.setProperty('--scale-round-y', '1px')
      renderTask = p.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
      try {
        await renderTask.promise
      } catch {
        return
      }
      if (cancelled) return
      const tl = textRef.current!
      tl.replaceChildren()
      textLayer = new TextLayer({ textContentSource: p.streamTextContent(), container: tl, viewport: vp })
      await textLayer.render().catch(() => undefined)
      if (!cancelled) setRendering(false)
    })()
    try {
      localStorage.setItem(lastPageKey(fileId), String(page))
    } catch {
      /* bỏ qua */
    }
    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
    }
  }, [doc, page, width, zoom, fileId])

  const go = useCallback(
    (n: number) => {
      if (!doc) return
      const t = Math.min(Math.max(1, n), doc.numPages)
      setPage(t)
      wrapRef.current?.scrollTo({ top: 0 })
    },
    [doc],
  )

  // Phím mũi tên chuyển trang (trừ khi đang gõ trong ô nhập)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, page])

  // Có đang bôi đen chữ trên trang không
  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection()
      setHasSel(!!s && !s.isCollapsed && !!textRef.current && textRef.current.contains(s.anchorNode))
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  if (error)
    return (
      <div className="pdf-error">
        <p>{error}</p>
        <button onClick={onFallback}>Xem bằng trình xem Google Drive</button>
      </div>
    )

  const printPage = page - offset
  return (
    <div className="pdf-reader">
      <div className="pdf-tools">
        <button className="pg" onClick={() => go(page - 1)} disabled={!doc || page <= 1} aria-label="Trang trước">
          ‹
        </button>
        <form
          className="pdf-goto"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^\d+$/.test(pageInput)) go(Number(pageInput))
            setPageInput('')
          }}
        >
          <label>
            <span className="muted">Trang PDF</span>
            <input inputMode="numeric" value={pageInput} placeholder={String(page)} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))} />
          </label>
          <span className="muted">/ {doc ? doc.numPages : '…'}</span>
        </form>
        <button className="pg" onClick={() => go(page + 1)} disabled={!doc || page >= (doc?.numPages ?? 1)} aria-label="Trang sau">
          ›
        </button>
        <form
          className="pdf-goto"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^\d+$/.test(printInput)) go(Number(printInput) + offset)
            setPrintInput('')
          }}
          title="Nhập số trang in trên sách để nhảy tới đúng trang trong tệp"
        >
          <label>
            <span className="muted">Trang in</span>
            <input inputMode="numeric" value={printInput} placeholder={printPage >= 1 ? String(printPage) : '–'} onChange={(e) => setPrintInput(e.target.value.replace(/\D/g, ''))} />
          </label>
        </form>
        <div className="pdf-zoom">
          <button className="pg" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Thu nhỏ">
            −
          </button>
          <button className="pg zoom-label" onClick={() => setZoom(1)} title="Vừa chiều ngang">
            {Math.round(zoom * 100)}%
          </button>
          <button className="pg" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} aria-label="Phóng to">
            +
          </button>
        </div>
        {onQuote && (
          <button
            className="secondary small-btn"
            disabled={!hasSel}
            title={hasSel ? 'Ghi đoạn đang bôi đen thành trích dẫn' : 'Bôi đen một đoạn chữ trên trang để trích dẫn'}
            onClick={() => {
              const t = window.getSelection()?.toString().replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
              if (t) onQuote(t, page)
            }}
          >
            Trích đoạn đã chọn
          </button>
        )}
      </div>
      <div className="pdf-scroll" ref={wrapRef}>
        {!doc && (
          <div className="reader-loading">
            Đang mở sách…
            {progress && progress.total > 0 && (
              <span>
                {' '}
                {fmtMB(progress.loaded)} / {fmtMB(progress.total)}
              </span>
            )}
          </div>
        )}
        <div className={`pdf-page ${doc ? '' : 'hidden'} ${rendering ? 'busy' : ''}`} ref={pageRef}>
          <canvas ref={canvasRef} />
          <div className="textLayer" ref={textRef} />
        </div>
      </div>
    </div>
  )
}
