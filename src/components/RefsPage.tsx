import { useMemo, useState, type ReactNode } from 'react'
import type { RefList } from '../data/refLists'
import { buildReferences, STYLES, type RefEntry, type StyleId } from '../data/references'
import type { Book } from '../types/book'

const STYLE_KEY = 'pochacco-library:cite-style'
const NUM_KEY = 'pochacco-library:cite-numbered'

const loadStyle = (): StyleId => {
  const v = localStorage.getItem(STYLE_KEY)
  return STYLES.some((s) => s.id === v) ? (v as StyleId) : 'vn'
}

/**
 * Một danh mục tài liệu tham khảo: chọn kiểu trích dẫn, xem cảnh báo thiếu thông tin,
 * sao chép (giữ chữ nghiêng khi dán vào Word) hoặc tải tệp.
 */
function RefsView({
  title,
  headActions,
  fileName,
  books,
  style,
  numbered,
  onStyle,
  onNumbered,
  onRemove,
  onPickMore,
  onOpenBook,
  onEditBook,
  onBulk,
}: {
  title: ReactNode
  headActions?: ReactNode
  fileName: string
  books: Book[]
  style: StyleId
  numbered: boolean
  onStyle: (s: StyleId) => void
  onNumbered: (v: boolean) => void
  onRemove: (id: string) => void
  onPickMore: () => void
  onOpenBook: (b: Book) => void
  onEditBook: (b: Book) => void
  onBulk: (books: Book[]) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const setStyle = onStyle
  const setNumbered = onNumbered
  const entries = useMemo(() => buildReferences(books, style), [books, style])
  const isVn = style === 'vn'
  const isBib = style === 'bibtex'
  const useNum = isVn && numbered
  const withIssues = entries.filter((e) => e.issues.length)
  const errors = entries.filter((e) => e.issues.some((i) => i.level === 'error'))
  // Kiểu Việt Nam chia hai nhóm: tiếng Việt, tiếng nước ngoài
  const groups: { title: string | null; items: RefEntry[] }[] =
    isVn && entries.some((e) => e.vi) && entries.some((e) => !e.vi)
      ? [
          { title: 'Tài liệu tiếng Việt', items: entries.filter((e) => e.vi) },
          { title: 'Tài liệu tiếng nước ngoài', items: entries.filter((e) => !e.vi) },
        ]
      : [{ title: null, items: entries }]
  const numberOf = new Map(entries.map((e, i) => [e.book.id, i + 1]))

  const plain = () =>
    isBib
      ? entries.map((e) => e.text).join('\n\n')
      : groups
          .map((g) => [g.title, ...g.items.map((e) => (useNum ? `[${numberOf.get(e.book.id)}] ` : '') + e.text)].filter(Boolean).join('\n'))
          .join('\n\n')
  const html = () =>
    groups
      .map(
        (g) =>
          (g.title ? `<p><b>${g.title}</b></p>` : '') +
          g.items
            .map((e) => `<p style="margin:0 0 6pt 0;${useNum ? '' : 'padding-left:0.5in;text-indent:-0.5in;'}">${useNum ? `[${numberOf.get(e.book.id)}] ` : ''}${e.html}</p>`)
            .join(''),
      )
      .join('')

  const flash = (m: string) => {
    setCopied(m)
    window.setTimeout(() => setCopied(null), 2500)
  }
  const copyAll = async () => {
    try {
      if (!isBib && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html()], { type: 'text/html' }),
            'text/plain': new Blob([plain()], { type: 'text/plain' }),
          }),
        ])
      } else await navigator.clipboard.writeText(plain())
      flash(isBib ? 'Đã sao chép BibTeX' : 'Đã sao chép, dán vào Word sẽ giữ chữ nghiêng')
    } catch {
      flash('Trình duyệt không cho sao chép, hãy dùng nút tải tệp')
    }
  }
  const copyOne = async (e: RefEntry) => {
    try {
      if (!isBib && 'ClipboardItem' in window)
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([e.html], { type: 'text/html' }), 'text/plain': new Blob([e.text], { type: 'text/plain' }) })])
      else await navigator.clipboard.writeText(e.text)
      flash('Đã sao chép một mục')
    } catch {
      flash('Trình duyệt không cho sao chép')
    }
  }
  const download = (kind: 'doc' | 'txt' | 'bib') => {
    const name = `${fileName}-${STYLES.find((s) => s.id === style)!.label.toLowerCase().replace(/\s+/g, '-')}`
    const data =
      kind === 'doc'
        ? `<html><head><meta charset="utf-8"><title>Tài liệu tham khảo</title></head><body style="font-family:'Times New Roman';font-size:13pt"><h3>TÀI LIỆU THAM KHẢO</h3>${html()}</body></html>`
        : plain()
    const type = kind === 'doc' ? 'application/msword' : 'text/plain'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿', data], { type: `${type};charset=utf-8` }))
    a.download = `${name}.${kind}`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  if (!books.length)
    return (
      <>
        <div className="refs-head">
          <h2>{title}</h2>
          <div className="refs-head-actions">{headActions}</div>
        </div>
        <p className="muted">
          Danh mục này chưa có cuốn nào. Bấm <b>Chọn sách</b> để sang Thư viện và chạm vào các cuốn cần dùng; hoặc mở một cuốn và bấm{' '}
          <b>Thêm vào trích dẫn</b>.
        </p>
        <button onClick={onPickMore}>Chọn sách</button>
      </>
    )

  const missingPlace = entries.filter((e) => e.book.publisher && e.issues.some((i) => i.field === 'place'))
  return (
    <>
      <div className="refs-head">
        <h2>
          {title} <span className="muted small">({books.length} cuốn)</span>
        </h2>
        <div className="refs-head-actions">
          <button className="secondary small-btn" onClick={onPickMore}>
            + Chọn thêm sách
          </button>
          {headActions}
        </div>
      </div>

      <div className="fmt-filter refs-styles" role="radiogroup" aria-label="Kiểu trích dẫn">
        {STYLES.map((s) => (
          <button key={s.id} role="radio" aria-checked={style === s.id} className={`fmt-pill ${style === s.id ? 'active' : ''}`} onClick={() => setStyle(s.id)} title={s.note}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="muted small refs-note">
        {STYLES.find((s) => s.id === style)!.note}
        {isVn && ' Tài liệu tiếng Việt xếp trước, theo tên tác giả (người Việt xếp theo tên, người nước ngoài theo họ).'}
      </p>
      {isVn && (
        <label className="check refs-opt">
          <input
            type="checkbox"
            checked={numbered}
            onChange={(e) => {
              setNumbered(e.target.checked)
            }}
          />
          Đánh số [1], [2]… (dẫn trong bài bằng số)
        </label>
      )}

      {withIssues.length > 0 ? (
        <div className={`refs-warn ${errors.length ? 'has-error' : ''}`}>
          <div className="refs-warn-title">
            ⚠️ {withIssues.length} cuốn cần bổ sung thông tin cho {STYLES.find((s) => s.id === style)!.label}
            {errors.length > 0 && <span> ({errors.length} cuốn thiếu thông tin bắt buộc)</span>}
          </div>
          <div className="refs-bulk">
            {missingPlace.length > 1 && (
              <button className="small-btn" onClick={() => onBulk(missingPlace.map((e) => e.book))}>
                Điền nơi xuất bản cho {missingPlace.length} cuốn
              </button>
            )}
            {withIssues.length > 1 && (
              <button className="secondary small-btn" onClick={() => onBulk(withIssues.map((e) => e.book))}>
                Sửa hàng loạt {withIssues.length} cuốn này
              </button>
            )}
          </div>
          <ul>
            {withIssues.map((e) => (
              <li key={e.book.id}>
                <button className="linkish" onClick={() => onOpenBook(e.book)}>
                  {e.book.title}
                </button>
                <span className="refs-issues">
                  {e.issues.map((i, k) => (
                    <span key={k} className={`refs-issue ${i.level}`}>
                      {i.level === 'error' ? 'Thiếu' : 'Nên bổ sung'}: {i.text}
                    </span>
                  ))}
                </span>
                <button className="secondary small-btn" onClick={() => onEditBook(e.book)}>
                  Sửa thông tin
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="refs-ok">✓ Tất cả {books.length} cuốn đã đủ thông tin cho {STYLES.find((s) => s.id === style)!.label}.</p>
      )}

      <div className="refs-actions">
        <button onClick={copyAll}>Sao chép tất cả</button>
        {isBib ? (
          <button className="secondary" onClick={() => download('bib')}>
            Tải tệp .bib
          </button>
        ) : (
          <>
            <button className="secondary" onClick={() => download('doc')}>
              Tải tệp Word
            </button>
            <button className="secondary" onClick={() => download('txt')}>
              Tải tệp .txt
            </button>
          </>
        )}
        {copied && <span className="refs-copied">{copied}</span>}
      </div>

      <div className={`refs-list ${isBib ? 'bib' : ''}`}>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && <h3 className="refs-group">{g.title}</h3>}
            <ol className={useNum ? 'numbered' : ''}>
              {g.items.map((e) => (
                <li key={e.book.id} className={e.issues.some((i) => i.level === 'error') ? 'err' : e.issues.length ? 'warn' : ''}>
                  {useNum && <span className="refs-num">[{numberOf.get(e.book.id)}]</span>}
                  <div className="refs-entry">
                    {isBib ? <pre>{e.text}</pre> : <p dangerouslySetInnerHTML={{ __html: e.html }} />}
                    <div className="refs-meta">
                      <span className="muted small">
                        Dẫn trong bài: <code>{useNum ? `[${numberOf.get(e.book.id)}, tr. …]` : e.inText}</code>
                      </span>
                      {e.issues.length > 0 && (
                        <span className={`refs-flag ${e.issues.some((i) => i.level === 'error') ? 'error' : 'warn'}`} title={e.issues.map((i) => i.text).join(', ')}>
                          ⚠ {e.issues.length}
                        </span>
                      )}
                      <button className="link" onClick={() => copyOne(e)}>
                        Sao chép
                      </button>
                      <button className="link" onClick={() => onRemove(e.book.id)}>
                        Bỏ khỏi danh sách
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  )
}

const TEMP = 'tam'
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')

/**
 * Trang Tài liệu tham khảo: các danh mục đã lưu theo bài viết và danh sách tạm.
 * Mở một danh mục để xem, sửa, xuất lại; danh mục đang mở là nơi nhận các cuốn được chọn ở Thư viện.
 */
export default function RefsPage({
  view,
  lists,
  tempIds,
  byId,
  onView,
  onCreate,
  onRename,
  onDelete,
  onPatch,
  onTempChange,
  onPickMore,
  onOpenBook,
  onEditBook,
  onBulk,
}: {
  view: string | null
  lists: RefList[]
  tempIds: string[]
  byId: Map<string, Book>
  onView: (v: string | null) => void
  onCreate: (name: string, ids: string[]) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onPatch: (id: string, patch: Partial<Pick<RefList, 'books' | 'style' | 'numbered'>>) => void
  onTempChange: (ids: string[]) => void
  onPickMore: (view: string) => void
  onOpenBook: (b: Book) => void
  onEditBook: (b: Book) => void
  onBulk: (books: Book[]) => void
}) {
  const [tempStyle, setTempStyle] = useState<StyleId>(loadStyle)
  const [tempNum, setTempNum] = useState(() => localStorage.getItem(NUM_KEY) !== '0')
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [askDelete, setAskDelete] = useState(false)
  const booksOf = (ids: string[]) => ids.map((id) => byId.get(id)).filter((b): b is Book => !!b)
  const list = view && view !== TEMP ? lists.find((l) => l.id === view) : undefined

  // ----- Trang tổng: các danh mục -----
  if (!view || (view !== TEMP && !list)) {
    const create = () => {
      const n = newName.trim()
      if (!n) return
      onCreate(n, [])
      setNewName('')
    }
    return (
      <section className="card refs">
        <div className="refs-head">
          <h2>Tài liệu tham khảo</h2>
        </div>
        <p className="muted">Mỗi bài viết một danh mục: chọn sách vào danh mục, xem cảnh báo thiếu thông tin, rồi xuất theo kiểu trích dẫn của tạp chí.</p>
        <form
          className="refs-new"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên danh mục mới, vd. Bài Feenberg CELG 2026" />
          <button type="submit" disabled={!newName.trim()}>
            + Tạo danh mục
          </button>
        </form>
        <ul className="refs-lists">
          {tempIds.length > 0 && (
            <li>
              <button className="refs-listcard temp" onClick={() => onView(TEMP)}>
                <b>Danh sách tạm</b>
                <span className="muted small">{tempIds.length} cuốn chưa lưu vào danh mục nào</span>
              </button>
            </li>
          )}
          {[...lists]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((l) => (
              <li key={l.id}>
                <button className="refs-listcard" onClick={() => onView(l.id)}>
                  <b>{l.name}</b>
                  <span className="muted small">
                    {l.books.length} cuốn · {STYLES.find((s) => s.id === l.style)?.label} · sửa {fmtDate(l.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {!lists.length && !tempIds.length && <p className="muted small">Chưa có danh mục nào. Tạo một danh mục cho bài đang viết để bắt đầu.</p>}
      </section>
    )
  }

  // ----- Danh sách tạm -----
  if (view === TEMP)
    return (
      <section className="card refs">
        <button className="link back" onClick={() => onView(null)}>
          ← Các danh mục
        </button>
        <RefsView
          title="Danh sách tạm"
          fileName="tai-lieu-tham-khao"
          books={booksOf(tempIds)}
          style={tempStyle}
          numbered={tempNum}
          onStyle={(s) => {
            setTempStyle(s)
            localStorage.setItem(STYLE_KEY, s)
          }}
          onNumbered={(v) => {
            setTempNum(v)
            localStorage.setItem(NUM_KEY, v ? '1' : '0')
          }}
          onRemove={(id) => onTempChange(tempIds.filter((x) => x !== id))}
          onPickMore={() => onPickMore(TEMP)}
          onOpenBook={onOpenBook}
          onEditBook={onEditBook}
          onBulk={onBulk}
          headActions={
            <>
              <form
                className="refs-save-as"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newName.trim()) return
                  onCreate(newName.trim(), tempIds)
                  onTempChange([])
                  setNewName('')
                }}
              >
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Đặt tên để lưu thành danh mục" />
                <button type="submit" className="small-btn" disabled={!newName.trim()}>
                  Lưu
                </button>
              </form>
              <button className="link" onClick={() => onTempChange([])}>
                Bỏ chọn tất cả
              </button>
            </>
          }
        />
      </section>
    )

  // ----- Một danh mục đã lưu -----
  const l = list!
  return (
    <section className="card refs">
      <button className="link back" onClick={() => onView(null)}>
        ← Các danh mục
      </button>
      <RefsView
        title={
          renaming !== null ? (
            <form
              className="refs-rename"
              onSubmit={(e) => {
                e.preventDefault()
                if (renaming.trim()) onRename(l.id, renaming.trim())
                setRenaming(null)
              }}
            >
              <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} />
              <button type="submit" className="small-btn">
                Đổi tên
              </button>
            </form>
          ) : (
            l.name
          )
        }
        fileName={l.name}
        books={booksOf(l.books)}
        style={l.style}
        numbered={l.numbered}
        onStyle={(s) => onPatch(l.id, { style: s })}
        onNumbered={(v) => onPatch(l.id, { numbered: v })}
        onRemove={(id) => onPatch(l.id, { books: l.books.filter((x) => x !== id) })}
        onPickMore={() => onPickMore(l.id)}
        onOpenBook={onOpenBook}
        onEditBook={onEditBook}
        onBulk={onBulk}
        headActions={
          <>
            {renaming === null && (
              <button className="link" onClick={() => setRenaming(l.name)}>
                Đổi tên
              </button>
            )}
            <button className="link" onClick={() => setAskDelete(true)}>
              Xóa danh mục
            </button>
          </>
        }
      />
      {l.books.length > booksOf(l.books).length && (
        <p className="muted small">{l.books.length - booksOf(l.books).length} cuốn trong danh mục đã bị xóa khỏi thư viện nên không hiện ở đây.</p>
      )}
      {askDelete && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setAskDelete(false)}>
          <div className="dialog">
            <h3>Xóa danh mục “{l.name}”?</h3>
            <p>Chỉ xóa danh mục, các cuốn sách trong thư viện vẫn giữ nguyên.</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setAskDelete(false)}>
                Giữ lại
              </button>
              <button
                className="danger"
                onClick={() => {
                  setAskDelete(false)
                  onDelete(l.id)
                }}
              >
                Xóa danh mục
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
