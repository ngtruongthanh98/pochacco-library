import { useEffect, useRef, useState } from 'react'
import 'foliate-js/view.js'
import { driveErrorText } from '../data/configStore'

type TocItem = { label: string; href: string; subitems?: TocItem[] }
type Relocate = { fraction?: number; tocItem?: { label?: string }; pageItem?: { label?: string }; cfi?: string }
// foliate-view là custom element không có kiểu; chỉ dùng vài phương thức.
type FoliateView = HTMLElement & {
  open: (f: File) => Promise<void>
  init: (o: { lastLocation?: string; showTextStart?: boolean }) => Promise<void>
  close: () => void
  goLeft: () => Promise<void>
  goRight: () => Promise<void>
  goTo: (href: string) => Promise<void>
  goToFraction: (f: number) => Promise<void>
  book: { toc?: TocItem[]; dir?: string; metadata?: { title?: unknown } }
  renderer: HTMLElement & { setStyles?: (css: string) => void; next: () => Promise<void> }
}

const MB = 1024 * 1024
const fmtMB = (n: number) => `${(n / MB).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
const locKey = (id: string) => `pochacco-library:last-cfi:${id}`
const PREF_KEY = 'pochacco-library:book-reader'

type Prefs = { size: number; flow: 'paginated' | 'scrolled'; spacing: number }
const loadPrefs = (): Prefs => {
  try {
    return { size: 100, flow: 'paginated', spacing: 1.6, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }
  } catch {
    return { size: 100, flow: 'paginated', spacing: 1.6 }
  }
}

const css = ({ size, spacing }: Prefs) => `
  html { color-scheme: light; }
  html, body { font-size: ${size}% !important; }
  p, li, blockquote, dd { line-height: ${spacing}; text-align: justify; hyphens: auto; widows: 2; orphans: 2; }
  [align="left"] { text-align: left; } [align="center"] { text-align: center; } [align="right"] { text-align: right; }
  pre { white-space: pre-wrap !important; }
  img, svg { max-width: 100%; height: auto; }
  ::selection { background: rgba(233, 169, 59, 0.45); }
`

const flatten = (items: TocItem[] | null | undefined, depth = 0): { label: string; href: string; depth: number }[] =>
  (items ?? []).flatMap((i) => [{ label: i.label?.trim() || '(không tên)', href: i.href, depth }, ...flatten(i.subitems, depth + 1)])

/**
 * Trình đọc EPUB, MOBI, AZW, AZW3, PRC, FB2, CBZ (thư viện foliate-js). Tải cả tệp qua Google Drive API
 * rồi dàn trang ngay trong trình duyệt. Có mục lục, cỡ chữ, lật trang/cuộn, bôi đen để trích dẫn.
 */
export default function BookReader({
  url,
  fileId,
  fileName,
  onQuote,
}: {
  url: string
  fileId: string
  fileName: string
  onQuote?: (text: string, where: { page?: string; chapter?: string }) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<FoliateView | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loc, setLoc] = useState<Relocate>({})
  const [toc, setToc] = useState<{ label: string; href: string; depth: number }[]>([])
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [sel, setSel] = useState('')
  const locRef = useRef(loc)
  locRef.current = loc

  // --- Tải tệp và mở sách ---
  useEffect(() => {
    let cancelled = false
    let view: FoliateView | null = null
    ;(async () => {
      let blob: Blob
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(await driveErrorText(res))
        const total = Number(res.headers.get('content-length')) || 0
        if (res.body) {
          const reader = res.body.getReader()
          const chunks: Uint8Array[] = []
          let loaded = 0
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            loaded += value.length
            if (!cancelled) setProgress({ loaded, total })
          }
          blob = new Blob(chunks as BlobPart[])
        } else blob = await res.blob()
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Không tải được tệp từ Google Drive.')
        return
      }
      if (cancelled) return
      try {
        view = document.createElement('foliate-view') as FoliateView
        hostRef.current!.replaceChildren(view)
        viewRef.current = view
        await view.open(new File([blob], fileName))
        if (cancelled) return
        view.renderer.setAttribute('flow', prefs.flow)
        view.renderer.setAttribute('max-inline-size', '760px')
        view.renderer.setAttribute('gap', '6%')
        view.renderer.setStyles?.(css(prefs))
        view.addEventListener('relocate', (e: Event) => {
          const d = (e as CustomEvent<Relocate>).detail
          setLoc(d)
          try {
            if (d.cfi) localStorage.setItem(locKey(fileId), d.cfi)
          } catch {
            /* bỏ qua */
          }
        })
        view.addEventListener('load', (e: Event) => {
          const doc = (e as CustomEvent<{ doc: Document }>).detail.doc
          // Phím và bôi đen bên trong khung sách (iframe).
          doc.addEventListener('keydown', onKey)
          doc.addEventListener('selectionchange', () => setSel(doc.getSelection()?.toString().trim() ?? ''))
        })
        setToc(flatten(view.book.toc))
        let last: string | undefined
        try {
          last = localStorage.getItem(locKey(fileId)) ?? undefined
        } catch {
          /* bỏ qua */
        }
        await view.init({ lastLocation: last, showTextStart: !last })
        if (!cancelled) setReady(true)
      } catch (e) {
        const m = (e as Error).message ?? ''
        if (!cancelled)
          setError(
            /unsupported|not supported|DRM|encrypt/i.test(m) || (e as Error).name === 'UnsupportedTypeError'
              ? 'Không mở được tệp này. Có thể tệp có khóa bản quyền (DRM, thường gặp ở sách mua trên Kindle) hoặc là định dạng cũ chưa hỗ trợ.'
              : `Không mở được sách: ${m}`,
          )
      }
    })()
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'SELECT' || document.querySelector('.reader-quote')) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') void viewRef.current?.goLeft()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && prefs.flow === 'paginated')) void viewRef.current?.goRight()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      window.removeEventListener('keydown', onKey)
      try {
        view?.close()
      } catch {
        /* bỏ qua */
      }
      view?.remove()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, fileId, fileName])

  // Đổi cỡ chữ / giãn dòng / kiểu đọc
  useEffect(() => {
    const v = viewRef.current
    if (!v || !ready) return
    v.renderer.setAttribute('flow', prefs.flow)
    v.renderer.setStyles?.(css(prefs))
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
    } catch {
      /* bỏ qua */
    }
  }, [prefs, ready])

  if (error)
    return (
      <div className="pdf-error">
        <p>{error}</p>
      </div>
    )

  const pct = loc.fraction !== undefined ? Math.round(loc.fraction * 100) : null
  const curToc = toc.find((t) => t.label === loc.tocItem?.label)
  return (
    <div className="pdf-reader book-reader">
      <div className="pdf-tools">
        <button className="pg" onClick={() => void viewRef.current?.goLeft()} disabled={!ready} aria-label="Trang trước" title="Trang trước (←)">
          ‹
        </button>
        <button className="pg" onClick={() => void viewRef.current?.goRight()} disabled={!ready} aria-label="Trang sau" title="Trang sau (→)">
          ›
        </button>
        {toc.length > 0 && (
          <select
            className="toc-select"
            value={curToc?.href ?? ''}
            onChange={(e) => e.target.value && void viewRef.current?.goTo(e.target.value)}
            aria-label="Mục lục"
          >
            {!curToc && <option value="">Mục lục…</option>}
            {toc.map((t, i) => (
              <option key={`${t.href}-${i}`} value={t.href}>
                {'  '.repeat(t.depth)}
                {t.label}
              </option>
            ))}
          </select>
        )}
        <input
          className="book-progress"
          type="range"
          min={0}
          max={1000}
          value={Math.round((loc.fraction ?? 0) * 1000)}
          disabled={!ready}
          onChange={(e) => void viewRef.current?.goToFraction(Number(e.target.value) / 1000)}
          aria-label="Vị trí trong sách"
        />
        <span className="zoom-label">{pct !== null ? `${pct}%` : ''}</span>
        <div className="pdf-zoom" role="group" aria-label="Cỡ chữ">
          <button className="pg" onClick={() => setPrefs((p) => ({ ...p, size: Math.max(70, p.size - 10) }))} title="Chữ nhỏ hơn">
            A−
          </button>
          <button className="pg" onClick={() => setPrefs((p) => ({ ...p, size: Math.min(220, p.size + 10) }))} title="Chữ lớn hơn">
            A+
          </button>
          <button
            className={`pg fit ${prefs.flow === 'scrolled' ? 'on' : ''}`}
            onClick={() => setPrefs((p) => ({ ...p, flow: p.flow === 'paginated' ? 'scrolled' : 'paginated' }))}
            title="Chuyển giữa lật trang và cuộn dọc"
          >
            {prefs.flow === 'paginated' ? 'Lật trang' : 'Cuộn dọc'}
          </button>
        </div>
        {onQuote && (
          <button
            className="secondary small-btn"
            disabled={!sel}
            title={sel ? 'Ghi đoạn đang bôi đen thành trích dẫn' : 'Bôi đen một đoạn chữ để trích dẫn'}
            onClick={() => onQuote(sel.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' '), { page: loc.pageItem?.label, chapter: loc.tocItem?.label })}
          >
            Trích đoạn đã chọn
          </button>
        )}
      </div>
      <div className="book-host">
        <div className="book-mount" ref={hostRef} />
        {!ready && (
          <div className="reader-loading">
            Đang mở sách…
            {progress && (
              <span>
                {' '}
                {fmtMB(progress.loaded)}
                {progress.total ? ` / ${fmtMB(progress.total)}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
      {ready && (loc.tocItem?.label || loc.pageItem?.label) && (
        <div className="book-status">
          {loc.tocItem?.label}
          {loc.pageItem?.label ? ` · tr. ${loc.pageItem.label}` : ''}
        </div>
      )}
    </div>
  )
}
