import { useEffect, useRef, useState } from 'react'
import { coverFallback, fallbackUrl } from '../data/coverFallback'
import { loadCoverUrl, type StoreConfig } from '../data/githubStore'
import type { Book } from '../types/book'

/**
 * Bìa sách: ảnh tự tải lên (repo:) → ảnh từ đường dẫn (https:) → bìa Open Library theo ISBN →
 * hình Pochacco hợp với tình trạng sách. Ảnh trong repo riêng tư chỉ tải khi bìa lọt vào màn hình.
 */
export default function Cover({
  book,
  cfg,
  size = 'sm',
  preview,
}: {
  book: Book
  cfg: StoreConfig
  size?: 'sm' | 'lg'
  /** Ảnh vừa chọn trong biểu mẫu, chưa lưu */
  preview?: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: '200px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const cover = book.cover
  const isbn = book.isbn13 ?? book.isbn10
  useEffect(() => {
    setFailed(false)
    setSrc(null)
    if (preview || !visible) return
    let alive = true
    if (cover?.startsWith('repo:')) {
      loadCoverUrl(cfg, cover.slice(5))
        .then((u) => alive && setSrc(u))
        .catch(() => alive && setFailed(true))
    } else if (cover?.startsWith('https://')) {
      setSrc(cover)
    } else if (cover?.startsWith('ol:') || (!cover && isbn)) {
      const id = cover?.startsWith('ol:') ? cover.slice(3) : isbn
      setSrc(`https://covers.openlibrary.org/b/isbn/${id}-M.jpg?default=false`)
    }
    return () => {
      alive = false
    }
  }, [cover, isbn, visible, preview, cfg])

  const fb = coverFallback(book)
  const real = preview ?? (!failed ? src : null)
  return (
    <div ref={ref} className={`cover cover-${size}${real ? '' : ' cover-fallback'}`} title={real ? undefined : fb.label}>
      {real ? (
        <img src={real} alt={`Bìa: ${book.title}`} onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <>
          <img src={fallbackUrl(fb)} alt="" />
          {size === 'lg' && <span className="cover-label">{fb.label}</span>}
        </>
      )}
    </div>
  )
}
