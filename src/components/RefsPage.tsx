import { useMemo, useState } from 'react'
import { buildReferences, STYLES, type RefEntry, type StyleId } from '../data/references'
import type { Book } from '../types/book'

const STYLE_KEY = 'pochacco-library:cite-style'
const NUM_KEY = 'pochacco-library:cite-numbered'

const loadStyle = (): StyleId => {
  const v = localStorage.getItem(STYLE_KEY)
  return STYLES.some((s) => s.id === v) ? (v as StyleId) : 'vn'
}

/**
 * Danh mục tài liệu tham khảo từ các cuốn đã chọn: chọn kiểu trích dẫn, xem cảnh báo thiếu thông tin,
 * sao chép (giữ chữ nghiêng khi dán vào Word) hoặc tải tệp.
 */
export default function RefsPage({
  books,
  onRemove,
  onClear,
  onOpenBook,
  onEditBook,
  onBack,
}: {
  books: Book[]
  onRemove: (id: string) => void
  onClear: () => void
  onOpenBook: (b: Book) => void
  onEditBook: (b: Book) => void
  onBack: () => void
}) {
  const [style, setStyleState] = useState<StyleId>(loadStyle)
  const [numbered, setNumbered] = useState(() => localStorage.getItem(NUM_KEY) !== '0')
  const [copied, setCopied] = useState<string | null>(null)
  const setStyle = (s: StyleId) => {
    setStyleState(s)
    localStorage.setItem(STYLE_KEY, s)
  }
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
    const name = `tai-lieu-tham-khao-${STYLES.find((s) => s.id === style)!.label.toLowerCase().replace(/\s+/g, '-')}`
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
      <section className="card refs">
        <h2>Tài liệu tham khảo</h2>
        <p className="muted">
          Chưa chọn cuốn nào. Ở trang Thư viện, bấm <b>Chọn sách để trích dẫn</b> rồi tick các cuốn cần dùng; hoặc mở một cuốn và bấm{' '}
          <b>Thêm vào trích dẫn</b>.
        </p>
        <button onClick={onBack}>Về thư viện để chọn sách</button>
      </section>
    )

  return (
    <section className="card refs">
      <div className="refs-head">
        <h2>Tài liệu tham khảo <span className="muted small">({books.length} cuốn)</span></h2>
        <div className="refs-head-actions">
          <button className="secondary small-btn" onClick={onBack}>
            + Chọn thêm sách
          </button>
          <button className="link" onClick={onClear}>
            Bỏ chọn tất cả
          </button>
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
              localStorage.setItem(NUM_KEY, e.target.checked ? '1' : '0')
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
    </section>
  )
}
