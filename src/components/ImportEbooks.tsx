import { useMemo, useState } from 'react'
import { CATEGORY_GROUPS } from '../data/categories'
import { driveViewUrl, guessFormat, parsePasted } from '../data/drive'
import { saveBatch, type StoreConfig } from '../data/githubStore'
import { ulid } from '../data/ulid'
import { foldVi } from '../search/normalizeVi'
import { nameToString, type Book, type EbookHolding } from '../types/book'
import { parseNames } from '../data/names'
import { mostCommon, sameText, SuggestInput, SuggestLines, useLibraryOptions } from './Suggest'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

type Row = {
  key: string
  raw: string
  fileId?: string
  problem?: string
  title: string
  format: EbookHolding['format']
  target: string // 'new' hoặc id sách có sẵn
  include: boolean
  suggestions: { book: Book; score: number }[]
  // Thông tin cho sách mới
  authors: string
  translators: string
  publisher: string
  place: string
  year: string
  pages: string
}

type Common = { publisher: string; place: string; year: string }
const EMPTY_INFO = { authors: '', translators: '', publisher: '', place: '', year: '', pages: '' }
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 5)

const words = (s: string) => new Set(foldVi(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1))
const similarity = (a: string, b: string) => {
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return 0
  const common = [...A].filter((w) => B.has(w)).length
  return common / Math.min(A.size, B.size)
}

/** Dán nhiều link Google Drive; ghép với sách giấy đã có hoặc tạo sách mới; lưu một lần. */
export default function ImportEbooks({
  cfg,
  books,
  onDone,
  onCancel,
}: {
  cfg: StoreConfig
  books: Book[]
  onDone: (added: Book[], updated: Book[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [category, setCategory] = useState('')
  const [common, setCommon] = useState<Common>({ publisher: '', place: '', year: '' })
  const opts = useLibraryOptions(books)
  const placeOf = (pub: string) => mostCommon(books, (b) => sameText(b.publisher, pub), (b) => b.place)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attached = useMemo(() => {
    const m = new Map<string, Book>()
    for (const b of books) for (const h of b.holdings) if (h.kind === 'ebook' && h.fileId) m.set(h.fileId, b)
    return m
  }, [books])

  const analyse = () => {
    const seen = new Set<string>()
    setRows(
      parsePasted(text).map((l, i) => {
        const base = { key: `${i}`, raw: l.raw, title: l.text, format: guessFormat(l.raw), target: 'new', include: false, suggestions: [], ...EMPTY_INFO }
        if (!l.ref) return { ...base, problem: 'Không phải link Google Drive' }
        if (l.ref.kind === 'folder') return { ...base, problem: 'Link thư mục: hãy dán link của từng tệp trong thư mục' }
        if (seen.has(l.ref.id)) return { ...base, fileId: l.ref.id, problem: 'Trùng với một dòng phía trên' }
        seen.add(l.ref.id)
        const owner = attached.get(l.ref.id)
        if (owner) return { ...base, fileId: l.ref.id, problem: `Đã gắn vào "${owner.title}"` }
        const suggestions = l.text
          ? books
              .map((b) => ({ book: b, score: similarity(l.text, b.title) }))
              .filter((x) => x.score >= 0.5)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
          : []
        const best = suggestions[0]
        return {
          ...base,
          fileId: l.ref.id,
          format: l.ref.kind === 'doc' ? 'other' : base.format,
          suggestions,
          target: best && best.score >= 0.8 ? best.book.id : 'new',
          include: true,
        }
      }),
    )
  }

  const sorted = useMemo(() => [...books].sort((a, b) => a.title.localeCompare(b.title, 'vi')), [books])
  const label = (book: Book) =>
    `${book.title}${book.authors?.length ? ` - ${book.authors.map(nameToString).join(', ')}` : ''}${book.year ? ` (${book.year})` : ''}`
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const ready = (rows ?? []).filter((r) => r.include && r.fileId && !r.problem && (r.target !== 'new' || r.title.trim()))
  const nNew = ready.filter((r) => r.target === 'new').length
  const nAttach = ready.length - nNew

  const save = async () => {
    setBusy(true)
    setError(null)
    const now = new Date().toISOString()
    const holding = (r: Row): EbookHolding => ({ kind: 'ebook', format: r.format, storage: 'gdrive', fileId: r.fileId })
    const added: Book[] = ready
      .filter((r) => r.target === 'new')
      .map((r) => {
        const authors = parseNames(r.authors)
        const translators = parseNames(r.translators)
        const publisher = (r.publisher || common.publisher).trim()
        // Nơi XB chung chỉ dùng khi sách theo NXB chung (NXB riêng thì nơi XB có thể khác).
        const place = (r.place || (!r.publisher.trim() || sameText(r.publisher, common.publisher) ? common.place : '')).trim()
        const year = Number(r.year || common.year)
        const pages = Number(r.pages)
        return {
        id: ulid(),
        type: 'book' as const,
        title: r.title.trim(),
        ...(authors.length ? { authors } : {}),
        ...(translators.length ? { translators } : {}),
        ...(publisher ? { publisher } : {}),
        ...(place ? { place } : {}),
        ...(year >= 1000 && year <= 2100 ? { year } : {}),
        ...(pages > 0 ? { pages } : {}),
        ...(category ? { categories: [category] } : {}),
        holdings: [holding(r)],
        status: 'owned' as const,
        source: 'import' as const,
        createdAt: now,
        updatedAt: now,
      }
      })
    const byBook = new Map<string, EbookHolding[]>()
    for (const r of ready.filter((r) => r.target !== 'new')) byBook.set(r.target, [...(byBook.get(r.target) ?? []), holding(r)])
    const updated: Book[] = [...byBook].map(([id, hs]) => {
      const b = books.find((x) => x.id === id)!
      return { ...b, holdings: [...b.holdings, ...hs], updatedAt: now }
    })
    try {
      await saveBatch(cfg, added, updated, `Nhập ${ready.length} sách điện tử`)
      onDone(added, updated)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="card scan">
      <div className="card-head">
        <img src={asset('cover/icon-ebook.webp')} alt="" />
        <div>
          <h2>Nhập sách điện tử từ Google Drive</h2>
          <p className="muted">
            Dán link chia sẻ của các tệp sách, mỗi dòng một link. Có thể ghi tên sách hoặc tên tệp trên cùng dòng (trước
            hoặc sau link, ngăn bằng dấu |) để ứng dụng tự ghép với sách giấy đã có.
          </p>
        </div>
      </div>

      {!rows ? (
        <>
          <textarea
            className="mono paste"
            rows={8}
            placeholder={'Phê phán lý tính thuần túy | https://drive.google.com/file/d/.../view\nhttps://drive.google.com/file/d/.../view  Thang_Phap_Tap_Yeu.pdf\nhttps://drive.google.com/file/d/.../view'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="hint">
            Trên Google Drive: chuột phải vào tệp, chọn Chia sẻ, rồi Sao chép đường liên kết. Để đọc ngay trong ứng dụng,
            nên để tệp ở chế độ "Bất kỳ ai có đường liên kết" (Người xem); tệp "Bị hạn chế" vẫn mở được trong tab mới khi
            trình duyệt đã đăng nhập Google của anh.
          </p>
          <div className="actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" disabled={!text.trim()} onClick={analyse}>
              Đọc danh sách link
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="inline-select">
            Danh mục cho các sách mới (có thể bỏ trống)
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Không gắn</option>
              {CATEGORY_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {nNew > 0 && (
            <fieldset className="import-common">
              <legend>Điền chung cho các sách mới</legend>
              <p className="hint">Dùng cho những sách mới để trống ô tương ứng. Tiện khi cả loạt cùng một nhà xuất bản hoặc một bộ.</p>
              <div className="row3">
                <SuggestInput
                  label="Nhà xuất bản"
                  value={common.publisher}
                  onChange={(v) => setCommon((c) => ({ ...c, publisher: v }))}
                  options={opts.publishers}
                  onPick={(pub) => {
                    const pl = placeOf(pub)
                    if (pl) setCommon((c) => (c.place ? c : { ...c, place: pl }))
                  }}
                />
                <SuggestInput label="Nơi xuất bản" value={common.place} onChange={(v) => setCommon((c) => ({ ...c, place: v }))} options={opts.places} />
                <label>
                  Năm
                  <input inputMode="numeric" value={common.year} onChange={(e) => setCommon((c) => ({ ...c, year: digits(e.target.value) }))} />
                </label>
              </div>
            </fieldset>
          )}
          <ul className="scan-list">
            {rows.map((r) => (
              <li key={r.key} className={`scan-item ${r.problem ? 's-exists' : ''}`}>
                <div className="scan-body">
                  <div className="scan-top">
                    {r.problem ? (
                      <span className="pill p-notfound">Bỏ qua</span>
                    ) : r.target === 'new' ? (
                      <span className="pill p-found">Sách mới</span>
                    ) : (
                      <span className="pill p-exists">Gắn vào sách có sẵn</span>
                    )}
                    {r.fileId && (
                      <a className="small" href={driveViewUrl(r.fileId)} target="_blank" rel="noopener noreferrer">
                        Mở tệp
                      </a>
                    )}
                  </div>
                  {r.problem ? (
                    <div className="muted small">
                      {r.problem}: <span className="mono-inline">{r.raw.slice(0, 80)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="import-grid">
                        <label>
                          Gắn vào
                          <select value={r.target} onChange={(e) => patch(r.key, { target: e.target.value })}>
                            <option value="new">Tạo sách mới (chỉ có bản điện tử)</option>
                            {r.suggestions.length > 0 && (
                              <optgroup label="Gợi ý theo nhan đề">
                                {r.suggestions.map(({ book }) => (
                                  <option key={book.id} value={book.id}>
                                    {label(book)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Sách khác trong thư viện">
                              {sorted
                                .filter((b) => !r.suggestions.some((x) => x.book.id === b.id))
                                .map((book) => (
                                  <option key={book.id} value={book.id}>
                                    {label(book)}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </label>
                        <label>
                          Định dạng
                          <select value={r.format} onChange={(e) => patch(r.key, { format: e.target.value as EbookHolding['format'] })}>
                            <option value="pdf">PDF</option>
                            <option value="epub">EPUB</option>
                  <option value="mobi">MOBI / AZW / PRC</option>
                            <option value="djvu">DjVu</option>
                            <option value="other">Khác</option>
                          </select>
                        </label>
                      </div>
                      {r.target === 'new' && (
                        <div className="import-info">
                          <label className="full">
                            Nhan đề *
                            <input placeholder="Bắt buộc với sách mới" value={r.title} onChange={(e) => patch(r.key, { title: e.target.value })} />
                          </label>
                          <SuggestLines label="Tác giả" rows={1} value={r.authors} onChange={(v) => patch(r.key, { authors: v })} options={opts.people} />
                          <SuggestLines label="Dịch giả" rows={1} value={r.translators} onChange={(v) => patch(r.key, { translators: v })} options={opts.people} />
                          <SuggestInput
                            label="Nhà xuất bản"
                            placeholder={common.publisher}
                            value={r.publisher}
                            onChange={(v) => patch(r.key, { publisher: v })}
                            options={opts.publishers}
                            onPick={(pub) => {
                              const pl = placeOf(pub)
                              if (pl && !r.place) patch(r.key, { publisher: pub, place: pl })
                            }}
                          />
                          <SuggestInput label="Nơi xuất bản" placeholder={common.place} value={r.place} onChange={(v) => patch(r.key, { place: v })} options={opts.places} />
                          <label>
                            Năm
                            <input inputMode="numeric" placeholder={common.year} value={r.year} onChange={(e) => patch(r.key, { year: digits(e.target.value) })} />
                          </label>
                          <label>
                            Số trang
                            <input inputMode="numeric" value={r.pages} onChange={(e) => patch(r.key, { pages: digits(e.target.value) })} />
                          </label>
                        </div>
                      )}
                      {!r.suggestions.length && r.title && r.target === 'new' && (
                        <div className="muted small">Không thấy sách giấy nào có nhan đề gần giống.</div>
                      )}
                      <label className="check">
                        <input type="checkbox" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} />
                        Nhập dòng này
                      </label>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => setRows(null)}>
              Sửa danh sách link
            </button>
            <button type="button" disabled={busy || !ready.length} onClick={() => void save()}>
              {busy ? 'Đang lưu...' : `Lưu ${nNew} sách mới${nAttach ? `, gắn ${nAttach} bản vào sách có sẵn` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
