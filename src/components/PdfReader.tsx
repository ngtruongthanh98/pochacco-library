import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './pdf-textlayer.css'
import { driveErrorText } from '../data/configStore'

GlobalWorkerOptions.workerSrc = workerUrl

const MB = 1024 * 1024
const GAP = 14
const PAD = 12
const CSS_PER_PT = 96 / 72
const fmtMB = (n: number) => `${(n / MB).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
const lastPageKey = (id: string) => `pochacco-library:last-page:${id}`
const FIT_KEY = 'pochacco-library:pdf-fit'

type Fit = 'width' | 'page'

/** Một trang: chỉ vẽ khi nằm gần vùng nhìn thấy, rời xa thì giải phóng để tiết kiệm bộ nhớ (sách hàng nghìn trang). */
const PageView = memo(function PageView({
  doc,
  num,
  boxW,
  boxH,
  active,
}: {
  doc: PDFDocumentProxy
  num: number
  boxW: number
  boxH: number
  active: boolean
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const holder = holderRef.current
    if (!active || !holder) return
    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayer: TextLayer | null = null
    const canvas = document.createElement('canvas')
    const text = document.createElement('div')
    text.className = 'textLayer'
    ;(async () => {
      const p = await doc.getPage(num)
      if (cancelled) return
      const base = p.getViewport({ scale: 1 })
      // Vừa khung chung của mọi trang, giữ đúng tỉ lệ của trang này.
      const scale = Math.min(boxW / base.width, boxH / base.height)
      const vp = p.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      canvas.width = Math.floor(vp.width * dpr)
      canvas.height = Math.floor(vp.height * dpr)
      const inner = document.createElement('div')
      inner.className = 'pdf-inner'
      inner.style.width = `${Math.floor(vp.width)}px`
      inner.style.height = `${Math.floor(vp.height)}px`
      inner.style.setProperty('--scale-factor', String(scale))
      inner.style.setProperty('--total-scale-factor', String(scale))
      inner.style.setProperty('--scale-round-x', '1px')
      inner.style.setProperty('--scale-round-y', '1px')
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      inner.append(canvas, text)
      renderTask = p.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
      try {
        await renderTask.promise
      } catch {
        return
      }
      if (cancelled) return
      holder.replaceChildren(inner)
      setDone(true)
      textLayer = new TextLayer({ textContentSource: p.streamTextContent(), container: text, viewport: vp })
      await textLayer.render().catch(() => undefined)
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
      holder.replaceChildren()
      canvas.width = 0
      canvas.height = 0
      setDone(false)
    }
  }, [doc, num, boxW, boxH, active])
  return (
    <div className="pdf-page" data-page={num} style={{ width: boxW, height: boxH }}>
      <div className="pdf-holder" ref={holderRef} />
      {!done && <span className="pdf-page-num">{num}</span>}
    </div>
  )
})

/**
 * Trình đọc PDF trong ứng dụng (PDF.js), cuộn liên tục. Tải tệp qua Google Drive API theo từng đoạn
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
  const [base, setBase] = useState<{ w: number; h: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [page, setPage] = useState(() => {
    try {
      return Math.max(1, Number(localStorage.getItem(lastPageKey(fileId))) || 1)
    } catch {
      return 1
    }
  })
  const [fit, setFit] = useState<Fit>(() => {
    try {
      const v = localStorage.getItem(FIT_KEY)
      if (v === 'width' || v === 'page') return v
    } catch {
      /* bỏ qua */
    }
    return window.innerWidth > window.innerHeight ? 'page' : 'width'
  })
  const [zoom, setZoom] = useState(1)
  const [pageInput, setPageInput] = useState('')
  const [printInput, setPrintInput] = useState('')
  const [selPage, setSelPage] = useState<number | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [range, setRange] = useState<[number, number]>([1, 3])
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingJump = useRef<number | null>(page)

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
        const first = (await d.getPage(1)).getViewport({ scale: 1 })
        if (cancelled) return void d.loadingTask.destroy()
        setBase({ w: first.width, h: first.height })
        setDoc(d)
        setPage((p) => {
          const t = Math.min(p, d.numPages)
          pendingJump.current = t
          return t
        })
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

  // --- Kích thước khung đọc ---
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Khung chung cho mọi trang (theo tỉ lệ trang 1)
  const avail = { w: Math.max(200, size.w - PAD * 2), h: Math.max(200, size.h - PAD * 2) }
  const fitScale = base ? (fit === 'width' ? Math.min(avail.w, 1400) / base.w : Math.min(avail.h / base.h, avail.w / base.w)) : 1
  const scale = fitScale * zoom
  const boxW = base ? Math.floor(base.w * scale) : 0
  const boxH = base ? Math.floor(base.h * scale) : 0
  const step = boxH + GAP
  const n = doc?.numPages ?? 0

  const updateFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !step || !n) return
    const top = el.scrollTop - PAD
    const cur = Math.min(n, Math.max(1, Math.floor((top + el.clientHeight * 0.35) / step) + 1))
    setPage(cur)
    const first = Math.max(1, Math.floor(top / step) + 1 - 1)
    const last = Math.min(n, Math.floor((top + el.clientHeight) / step) + 1 + 1)
    setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]))
  }, [step, n])

  const scrollToPage = useCallback(
    (p: number) => {
      const el = scrollRef.current
      if (!el || !step) return
      el.scrollTo({ top: (p - 1) * step })
    },
    [step],
  )

  // Đổi cỡ (zoom, vừa trang/ngang, đổi kích thước cửa sổ): giữ nguyên trang đang đọc.
  const pageRef = useRef(page)
  pageRef.current = page
  useLayoutEffect(() => {
    if (!step || !n) return
    const target = pendingJump.current ?? pageRef.current
    pendingJump.current = null
    scrollToPage(target)
    updateFromScroll()
  }, [step, n, scrollToPage, updateFromScroll])

  useEffect(() => {
    try {
      if (doc) localStorage.setItem(lastPageKey(fileId), String(page))
    } catch {
      /* bỏ qua */
    }
  }, [page, fileId, doc])

  const go = useCallback((p: number) => n && scrollToPage(Math.min(Math.max(1, p), n)), [n, scrollToPage])

  // Phím: ← → lật trang; Home/End về đầu/cuối. Lăn chuột, PageUp/PageDown, Space cuộn như trình duyệt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.querySelector('.reader-quote')) return
      if (e.key === 'ArrowRight') go(pageRef.current + 1)
      else if (e.key === 'ArrowLeft') go(pageRef.current - 1)
      else if (e.key === 'Home') go(1)
      else if (e.key === 'End') go(n)
      else if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(e.key) && document.activeElement !== scrollRef.current) {
        // Cho phím cuộn tác động vào khung đọc dù chưa bấm vào trang.
        scrollRef.current?.focus({ preventScroll: true })
        return
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, n])

  // Ctrl + lăn chuột để phóng to/thu nhỏ
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom((z) => Math.min(4, Math.max(0.3, +(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Đoạn đang bôi đen thuộc trang nào
  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection()
      const node = s && !s.isCollapsed ? s.anchorNode : null
      const el = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null
      const pg = el?.closest('.textLayer') && scrollRef.current?.contains(el) ? el.closest<HTMLElement>('.pdf-page')?.dataset.page : undefined
      setSelPage(pg ? Number(pg) : null)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const setFitMode = (f: Fit) => {
    setFit(f)
    setZoom(1)
    try {
      localStorage.setItem(FIT_KEY, f)
    } catch {
      /* bỏ qua */
    }
  }

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
        <button className="pg" onClick={() => go(page - 1)} disabled={!doc || page <= 1} aria-label="Trang trước" title="Trang trước (←)">
          ‹
        </button>
        <form
          className="pdf-goto"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^\d+$/.test(pageInput)) go(Number(pageInput))
            setPageInput('')
            ;(document.activeElement as HTMLElement)?.blur()
          }}
        >
          <label>
            <span className="muted">Trang PDF</span>
            <input inputMode="numeric" value={pageInput} placeholder={String(page)} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))} />
          </label>
          <span className="muted">/ {doc ? n.toLocaleString('vi-VN') : '…'}</span>
        </form>
        <button className="pg" onClick={() => go(page + 1)} disabled={!doc || page >= n} aria-label="Trang sau" title="Trang sau (→)">
          ›
        </button>
        <form
          className="pdf-goto"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^\d+$/.test(printInput)) go(Number(printInput) + offset)
            setPrintInput('')
            ;(document.activeElement as HTMLElement)?.blur()
          }}
          title="Nhập số trang in trên sách để nhảy tới đúng trang trong tệp"
        >
          <label>
            <span className="muted">Trang in</span>
            <input inputMode="numeric" value={printInput} placeholder={printPage >= 1 ? String(printPage) : '–'} onChange={(e) => setPrintInput(e.target.value.replace(/\D/g, ''))} />
          </label>
        </form>
        <div className="pdf-zoom" role="group" aria-label="Cỡ hiển thị">
          <button className={`pg fit ${fit === 'page' && zoom === 1 ? 'on' : ''}`} onClick={() => setFitMode('page')} title="Thấy trọn một trang">
            Vừa trang
          </button>
          <button className={`pg fit ${fit === 'width' && zoom === 1 ? 'on' : ''}`} onClick={() => setFitMode('width')} title="Trang rộng bằng khung đọc">
            Vừa ngang
          </button>
          <button className="pg" onClick={() => setZoom((z) => Math.max(0.3, +(z / 1.2).toFixed(3)))} aria-label="Thu nhỏ" title="Thu nhỏ (Ctrl + lăn chuột)">
            −
          </button>
          <span className="zoom-label" title="So với kích thước thật của trang">
            {Math.round((scale / CSS_PER_PT) * 100)}%
          </span>
          <button className="pg" onClick={() => setZoom((z) => Math.min(4, +(z * 1.2).toFixed(3)))} aria-label="Phóng to" title="Phóng to (Ctrl + lăn chuột)">
            +
          </button>
        </div>
        {onQuote && (
          <button
            className="secondary small-btn"
            disabled={!selPage}
            title={selPage ? 'Ghi đoạn đang bôi đen thành trích dẫn' : 'Bôi đen một đoạn chữ trên trang để trích dẫn'}
            onClick={() => {
              const t = window.getSelection()?.toString().replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
              if (t && selPage) onQuote(t, selPage)
            }}
          >
            Trích đoạn đã chọn
          </button>
        )}
      </div>
      <div className="pdf-scroll" ref={scrollRef} onScroll={updateFromScroll} tabIndex={-1}>
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
        {doc && boxW > 0 && (
          <div className="pdf-pages" style={{ padding: `${PAD}px 0`, gap: GAP }}>
            {Array.from({ length: n }, (_, i) => (
              <PageView key={i + 1} doc={doc} num={i + 1} boxW={boxW} boxH={boxH} active={i + 1 >= range[0] && i + 1 <= range[1]} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
