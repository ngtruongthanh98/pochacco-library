import { useMemo, useState } from 'react'
import { CATEGORY_GROUPS } from '../data/categories'
import { driveViewUrl, guessFormat } from '../data/drive'
import { checkDraft, draftsToJson, emptyDraft, JSON_SAMPLE, LINE_SAMPLE, parseJson, parseLines, type EbookDraft, type ParsedDraft } from '../data/ebookImport'
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
  resourceKey?: string
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
type Mode = 'form' | 'lines' | 'json'
const MODES: { id: Mode; label: string; note: string }[] = [
  { id: 'form', label: 'Điền từng ô', note: 'Dễ nhất khi nhập vài cuốn' },
  { id: 'lines', label: 'Dán theo dòng', note: 'Nhanh khi có sẵn danh sách hoặc bảng Excel' },
  { id: 'json', label: 'JSON', note: 'Cho danh sách soạn bằng máy hoặc AI' },
]
const FORMAT_LABEL: Record<EbookHolding['format'], string> = { pdf: 'PDF', epub: 'EPUB', mobi: 'MOBI', djvu: 'DjVu', other: 'Khác' }
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
  const [mode, setMode] = useState<Mode>('form')
  const [drafts, setDrafts] = useState<EbookDraft[]>([emptyDraft()])
  const [lines, setLines] = useState('')
  const [json, setJson] = useState('')
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

  const parsedForm = useMemo(
    () => drafts.map((d, i) => ({ ...checkDraft(d, `${i}`), blank: !d.title.trim() && !d.link.trim() })),
    [drafts],
  )
  const parsedLines = useMemo(() => parseLines(lines), [lines])
  const parsedJson = useMemo(() => parseJson(json), [json])
  const current: ParsedDraft[] =
    mode === 'form' ? parsedForm.filter((p) => !p.blank) : mode === 'lines' ? parsedLines : parsedJson.items
  const nValid = current.filter((p) => !p.errors.length).length

  const setDraft = (i: number, p: Partial<EbookDraft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)))
  const toForm = (items: ParsedDraft[]) => {
    setDrafts(items.length ? items.map((p) => p.draft) : [emptyDraft()])
    setMode('form')
  }

  const analyse = (items: ParsedDraft[]) => {
    const seen = new Set<string>()
    setRows(
      items.map((p, i) => {
        const d = p.draft
        const raw = p.source || d.link
        const base = {
          key: `${i}`,
          raw: `${d.title} ${d.link}`.trim() || raw,
          title: d.title.trim(),
          format: d.format ?? guessFormat(`${d.title} ${raw}`),
          target: 'new',
          include: false,
          suggestions: [],
          authors: d.authors,
          translators: d.translators,
          publisher: d.publisher.trim(),
          place: d.place.trim(),
          year: d.year.replace(/\D/g, '').slice(0, 4),
          pages: d.pages,
        }
        const ref = p.ref
        if (p.errors.length || !ref) return { ...base, problem: p.errors[0] ?? 'Không đọc được link' }
        if (seen.has(ref.id)) return { ...base, fileId: ref.id, problem: 'Trùng link với một tài liệu phía trên' }
        seen.add(ref.id)
        const owner = attached.get(ref.id)
        if (owner) return { ...base, fileId: ref.id, problem: `Tệp này đã gắn vào "${owner.title}"` }
        const suggestions = books
          .map((b) => ({ book: b, score: similarity(base.title, b.title) }))
          .filter((x) => x.score >= 0.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
        const best = suggestions[0]
        return {
          ...base,
          fileId: ref.id,
          resourceKey: ref.resourceKey,
          format: ref.kind === 'doc' ? 'other' : base.format,
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
    const holding = (r: Row): EbookHolding => ({ kind: 'ebook', format: r.format, storage: 'gdrive', fileId: r.fileId, ...(r.resourceKey ? { resourceKey: r.resourceKey } : {}) })
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
            Mỗi tài liệu cần <b>tên tài liệu</b> và <b>link Google Drive</b>; tác giả, nhà xuất bản, năm có thì điền thêm.
            Ứng dụng sẽ tự ghép với sách giấy cùng nhan đề đã có trong thư viện.
          </p>
        </div>
      </div>

      {!rows ? (
        <div className="ei">
          <div className="ei-modes" role="tablist">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
                <span>{m.label}</span>
                <small>{m.note}</small>
              </button>
            ))}
          </div>

          {mode === 'form' && (
            <>
              <ol className="ei-cards">
                {drafts.map((d, i) => {
                  const p = parsedForm[i]
                  const linkErr = p.errors.find((e) => /link/i.test(e))
                  const ok = !p.blank && !p.errors.length
                  return (
                    <li key={i} className={`ei-card ${ok ? 'ok' : ''}`}>
                      <div className="ei-card-head">
                        <span className="ei-num">{i + 1}</span>
                        {ok ? (
                          <span className="ei-ready">✓ Sẵn sàng · {FORMAT_LABEL[d.format ?? guessFormat(d.title + ' ' + d.link)]}</span>
                        ) : p.blank ? (
                          <span className="muted small">Chưa điền</span>
                        ) : (
                          <span className="ei-err">{p.errors.join(' · ')}</span>
                        )}
                        {drafts.length > 1 && (
                          <button type="button" className="ei-x" aria-label="Xóa tài liệu này" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>
                            ×
                          </button>
                        )}
                      </div>
                      <div className="ei-fields">
                        <label className="ei-title">
                          <span>Tên tài liệu <em>*</em></span>
                          <input value={d.title} placeholder="Ví dụ: Phê phán lý tính thuần túy" onChange={(e) => setDraft(i, { title: e.target.value })} />
                        </label>
                        <label className={`ei-link ${d.link && linkErr ? 'bad' : ''}`}>
                          <span>Link Google Drive <em>*</em></span>
                          <input
                            value={d.link}
                            inputMode="url"
                            placeholder="https://drive.google.com/file/d/.../view"
                            onChange={(e) => setDraft(i, { link: e.target.value.trim() })}
                          />
                        </label>
                        <label>
                          Tác giả
                          <input value={d.authors.replace(/\n/g, '; ')} placeholder="Nhiều người: ngăn bằng dấu ;" onChange={(e) => setDraft(i, { authors: e.target.value.split(/\s*;\s*/).join('\n') })} />
                        </label>
                        <SuggestInput
                          label="Nhà xuất bản"
                          value={d.publisher}
                          onChange={(v) => setDraft(i, { publisher: v })}
                          options={opts.publishers}
                          onPick={(pub) => {
                            const pl = placeOf(pub)
                            if (pl && !d.place) setDraft(i, { publisher: pub, place: pl })
                          }}
                        />
                        <label className="ei-year">
                          Năm
                          <input inputMode="numeric" value={d.year} onChange={(e) => setDraft(i, { year: digits(e.target.value).slice(0, 4) })} />
                        </label>
                      </div>
                    </li>
                  )
                })}
              </ol>
              <div className="ei-row">
                <button type="button" className="secondary ei-add" onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}>
                  + Thêm tài liệu
                </button>
                {nValid > 0 && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setJson(draftsToJson(parsedForm.filter((p) => !p.blank).map((p) => p.draft)))
                      setMode('json')
                    }}
                  >
                    Xem dạng JSON
                  </button>
                )}
              </div>
            </>
          )}

          {mode === 'lines' && (
            <>
              <div className="ei-guide">
                <div className="ei-cols">
                  <span className="req">Tên tài liệu</span>|<span>Tác giả</span>|<span className="req">Link Drive</span>|<span>Nhà xuất bản</span>|<span>Năm</span>
                </div>
                <p className="hint">
                  Mỗi dòng một tài liệu, các cột ngăn bằng dấu <code>|</code>. Cột trống vẫn giữ dấu <code>|</code> (ví dụ{' '}
                  <code>Tên | | link</code>). Nhiều tác giả ngăn bằng dấu <code>;</code>. Dán thẳng từ Excel hoặc Google Sheets theo
                  đúng thứ tự cột cũng được. Dòng bắt đầu bằng <code>#</code> được bỏ qua.
                </p>
                <button type="button" className="link" onClick={() => setLines((t) => (t.trim() ? t : LINE_SAMPLE))}>
                  Chèn ví dụ
                </button>
              </div>
              <textarea className="mono paste" rows={7} placeholder={LINE_SAMPLE} value={lines} onChange={(e) => setLines(e.target.value)} />
            </>
          )}

          {mode === 'json' && (
            <>
              <div className="ei-guide">
                <p className="hint">
                  Một mảng các đối tượng. Bắt buộc có <code>title</code> và <code>link</code>; tùy chọn <code>authors</code>,{' '}
                  <code>translators</code> (chuỗi hoặc mảng), <code>publisher</code>, <code>place</code>, <code>year</code>,{' '}
                  <code>pages</code>, <code>format</code> (pdf, epub, mobi, djvu, other).
                </p>
                <div className="ei-row">
                  <button type="button" className="link" onClick={() => setJson(JSON_SAMPLE)}>
                    Chèn mẫu
                  </button>
                  <button type="button" className="link" onClick={() => void navigator.clipboard?.writeText(JSON_SAMPLE)}>
                    Sao chép mẫu
                  </button>
                </div>
              </div>
              <textarea className="mono paste" rows={10} spellCheck={false} placeholder={JSON_SAMPLE} value={json} onChange={(e) => setJson(e.target.value)} />
              {parsedJson.error && <p className="error">{parsedJson.error}</p>}
            </>
          )}

          {mode !== 'form' && current.length > 0 && (
            <div className="ei-preview">
              <div className="ei-row">
                <b>Xem trước</b>
                <span className="muted small">
                  {nValid}/{current.length} tài liệu hợp lệ
                </span>
                <button type="button" className="link" onClick={() => toForm(current)}>
                  Sửa trong dạng ô
                </button>
              </div>
              <div className="ei-table-wrap">
                <table className="ei-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên tài liệu</th>
                      <th>Tác giả</th>
                      <th>Nhà xuất bản</th>
                      <th>Năm</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map((p, i) => (
                      <tr key={i} className={p.errors.length ? 'bad' : ''}>
                        <td>{i + 1}</td>
                        <td>{p.draft.title || <span className="ei-miss">thiếu</span>}</td>
                        <td>{p.draft.authors.replace(/\n/g, '; ')}</td>
                        <td>{p.draft.publisher}</td>
                        <td>{p.draft.year}</td>
                        <td>{p.errors.length ? <span className="ei-err">{p.errors.join(' · ')}</span> : <span className="ei-ok">✓ {FORMAT_LABEL[p.draft.format ?? guessFormat(p.source)]}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <details className="ei-help">
            <summary>Cách lấy link Google Drive</summary>
            <p className="hint">
              Trên Google Drive: chuột phải vào tệp, chọn Chia sẻ, rồi Sao chép đường liên kết. Mỗi tài liệu cần link của
              chính tệp đó, không dùng link thư mục. Để đọc ngay trong ứng dụng, nên để tệp ở chế độ "Bất kỳ ai có đường liên
              kết" (Người xem); tệp "Bị hạn chế" vẫn mở được trong tab mới khi trình duyệt đã đăng nhập Google của anh.
            </p>
          </details>

          <div className="actions">
            {current.length > nValid && nValid > 0 && <span className="muted small ei-skip">{current.length - nValid} tài liệu lỗi sẽ được hiện lại ở bước sau để anh xem</span>}
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" disabled={!nValid} onClick={() => analyse(current)}>
              {nValid ? `Tiếp tục với ${nValid} tài liệu` : 'Tiếp tục'}
            </button>
          </div>
        </div>
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
                      <a className="small" href={driveViewUrl(r.fileId, r.resourceKey)} target="_blank" rel="noopener noreferrer">
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
              Quay lại sửa danh sách
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
