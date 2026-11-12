import { useMemo, useState } from 'react'
import { inTextCite, normTopic, pageKey, pageLabel, quoteWithCite, referenceOf, sameTopic, topicCounts } from '../data/cite'
import { ulid } from '../data/ulid'
import { foldVi } from '../search/normalizeVi'
import type { Book } from '../types/book'
import type { Excerpt } from '../types/excerpt'
import { ConfirmDialog } from './ConfirmDialog'

export type ExcerptActions = {
  onSave: (ex: Excerpt) => Promise<void>
  onDelete: (ex: Excerpt) => Promise<void>
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyBtn({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [ok, setOk] = useState<boolean | null>(null)
  return (
    <button
      type="button"
      className="icon-btn txt"
      title={label === 'Chép TLTK' ? 'Chép dòng tài liệu tham khảo của sách' : undefined}
      onClick={async () => {
        setOk(await copy(text))
        setTimeout(() => setOk(null), 1600)
      }}
    >
      {ok === null ? label : ok ? 'Đã chép ✓' : 'Không chép được'}
    </button>
  )
}

// ---------------- Biểu mẫu ----------------

export function QuoteForm({
  book,
  initial,
  allTopics,
  onSave,
  onCancel,
}: {
  book: Book
  initial?: Excerpt
  allTopics: string[]
  onSave: (ex: Excerpt) => Promise<void>
  onCancel: () => void
}) {
  const hasEbook = book.holdings.some((h) => h.kind === 'ebook')
  const [text, setText] = useState(initial?.text ?? '')
  const [page, setPage] = useState(initial?.page ?? '')
  const [pageSource, setPageSource] = useState<'print' | 'ebook'>(
    initial?.pageSource ?? (book.holdings.some((h) => h.kind === 'print') || !hasEbook ? 'print' : 'ebook'),
  )
  const [topics, setTopics] = useState<string[]>(initial?.topics ?? [])
  const [topicInput, setTopicInput] = useState('')
  const [note, setNote] = useState(initial?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTopic = (raw: string) => {
    const parts = raw.split(/[,;]/).map(normTopic).filter(Boolean)
    if (!parts.length) return
    setTopics((cur) => {
      const out = [...cur]
      for (const p of parts) {
        if (out.some((t) => sameTopic(t, p))) continue
        // Dùng lại cách viết đã có để chủ đề không bị tách đôi vì khác hoa/thường.
        out.push(allTopics.find((t) => sameTopic(t, p)) ?? p)
      }
      return out
    })
    setTopicInput('')
  }
  const suggestions = useMemo(() => {
    const q = foldVi(topicInput.trim())
    return allTopics.filter((t) => !topics.some((x) => sameTopic(x, t)) && (!q || foldVi(t).includes(q))).slice(0, 8)
  }, [allTopics, topics, topicInput])

  const submit = async () => {
    if (!text.trim()) return setError('Chưa có nội dung trích dẫn.')
    const pending = normTopic(topicInput)
    const finalTopics = pending && !topics.some((t) => sameTopic(t, pending)) ? [...topics, allTopics.find((t) => sameTopic(t, pending)) ?? pending] : topics
    const now = new Date().toISOString()
    const ex: Excerpt = {
      id: initial?.id ?? ulid(),
      bookId: book.id,
      text: text.replace(/\r\n/g, '\n').trim(),
      ...(page.trim() ? { page: page.trim() } : {}),
      ...(hasEbook && pageSource === 'ebook' ? { pageSource: 'ebook' as const } : {}),
      ...(finalTopics.length ? { topics: finalTopics } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(ex)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form
      className="quote-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label>
        Nguyên văn trích dẫn
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="Chép đúng từng chữ như trong sách…" />
      </label>
      <div className="quote-form-row">
        <label className="quote-page">
          Trang
          <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="45 hoặc 45-46" inputMode="text" />
        </label>
        {hasEbook && (
          <label>
            Số trang theo
            <select value={pageSource} onChange={(e) => setPageSource(e.target.value as 'print' | 'ebook')}>
              <option value="print">Sách in (số in trên trang)</option>
              <option value="ebook">Tệp điện tử (số trang PDF)</option>
            </select>
          </label>
        )}
      </div>
      <div className="topics-field">
        <span className="label">Chủ đề</span>
        <div className="topic-input">
          {topics.map((t) => (
            <span key={t} className="topic-chip">
              {t}
              <button type="button" aria-label={`Bỏ chủ đề ${t}`} onClick={() => setTopics((c) => c.filter((x) => x !== t))}>
                ×
              </button>
            </span>
          ))}
          <input
            value={topicInput}
            onChange={(e) => {
              const v = e.target.value
              if (/[,;]$/.test(v)) addTopic(v)
              else setTopicInput(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTopic(topicInput)
              } else if (e.key === 'Backspace' && !topicInput && topics.length) setTopics((c) => c.slice(0, -1))
            }}
            placeholder={topics.length ? '' : 'Gõ chủ đề rồi Enter (vd: tha hóa, nhận thức luận)'}
            aria-label="Thêm chủ đề"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="topic-suggest">
            {suggestions.map((t) => (
              <button type="button" key={t} className="chip" onClick={() => addTopic(t)}>
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <label>
        Ghi chú của bạn
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ý nghĩa, ngữ cảnh, dùng cho bài nào…" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Hủy
        </button>
        <button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : initial ? 'Lưu trích dẫn' : 'Thêm trích dẫn'}
        </button>
      </div>
    </form>
  )
}

// ---------------- Thẻ trích dẫn ----------------

export function QuoteCard({
  ex,
  book,
  showBook,
  allTopics,
  actions,
  onTopic,
  onOpenBook,
}: {
  ex: Excerpt
  book?: Book
  showBook?: boolean
  allTopics: string[]
  actions: ExcerptActions
  onTopic?: (t: string) => void
  onOpenBook?: (b: Book) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (editing && book)
    return (
      <li className="quote editing">
        <QuoteForm
          book={book}
          initial={ex}
          allTopics={allTopics}
          onCancel={() => setEditing(false)}
          onSave={async (e) => {
            await actions.onSave(e)
            setEditing(false)
          }}
        />
      </li>
    )
  return (
    <li className="quote">
      <blockquote>
        {ex.text.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </blockquote>
      <div className="quote-meta">
        {ex.page && (
          <span className="quote-page-tag">
            {pageLabel(ex.page)}
            {ex.pageSource === 'ebook' ? ' (PDF)' : ''}
          </span>
        )}
        {showBook &&
          (book ? (
            <button type="button" className="linkish quote-book" onClick={() => onOpenBook?.(book)}>
              {book.title}
              {book.year ? ` (${book.year})` : ''}
            </button>
          ) : (
            <span className="muted">(sách đã bị xóa)</span>
          ))}
      </div>
      {!!ex.topics?.length && (
        <div className="quote-topics">
          {ex.topics.map((t) =>
            onTopic ? (
              <button key={t} type="button" className="topic-chip link-chip" onClick={() => onTopic(t)}>
                {t}
              </button>
            ) : (
              <span key={t} className="topic-chip">
                {t}
              </span>
            ),
          )}
        </div>
      )}
      {ex.note && <p className="quote-note">{ex.note}</p>}
      <div className="quote-actions">
        <CopyBtn text={quoteWithCite(book, ex)} label="Chép trích dẫn" />
        {book && <CopyBtn text={referenceOf(book)} label="Chép TLTK" />}
        {book && (
          <button type="button" className="icon-btn txt" onClick={() => setEditing(true)}>
            Sửa
          </button>
        )}
        <button type="button" className="icon-btn txt del" onClick={() => setConfirm(true)}>
          Xóa
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Xóa trích dẫn này?"
          text={`“${ex.text.slice(0, 120)}${ex.text.length > 120 ? '…' : ''}”`}
          confirmLabel="Xóa"
          cancelLabel="Giữ lại"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false)
            void actions.onDelete(ex)
          }}
        />
      )}
    </li>
  )
}

// ---------------- Phần trích dẫn trong trang sách ----------------

export function BookQuotes({
  book,
  excerpts,
  allTopics,
  actions,
  onTopic,
}: {
  book: Book
  excerpts: Excerpt[]
  allTopics: string[]
  actions: ExcerptActions
  onTopic: (t: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const mine = useMemo(
    () => excerpts.filter((e) => e.bookId === book.id).sort((a, b) => pageKey(a.page) - pageKey(b.page) || a.createdAt.localeCompare(b.createdAt)),
    [excerpts, book.id],
  )
  return (
    <section className="book-quotes">
      <div className="section-head">
        <h3>Trích dẫn{mine.length ? ` (${mine.length})` : ''}</h3>
        {!adding && (
          <button className="secondary small-btn" onClick={() => setAdding(true)}>
            + Thêm trích dẫn
          </button>
        )}
      </div>
      {adding && (
        <QuoteForm
          book={book}
          allTopics={allTopics}
          onCancel={() => setAdding(false)}
          onSave={async (e) => {
            await actions.onSave(e)
            setAdding(false)
          }}
        />
      )}
      {mine.length === 0 && !adding && <p className="muted">Chưa có trích dẫn. Ghi lại các đoạn đáng chú ý kèm số trang để dẫn nguồn khi viết bài.</p>}
      {mine.length > 0 && (
        <ul className="quote-list">
          {mine.map((e) => (
            <QuoteCard key={e.id} ex={e} book={book} allTopics={allTopics} actions={actions} onTopic={onTopic} />
          ))}
        </ul>
      )}
      {mine.length > 1 && (
        <div className="quote-export">
          <CopyBtn
            label="Chép tất cả trích dẫn của sách này"
            text={[referenceOf(book), '', ...mine.map((e) => `- ${quoteWithCite(book, e)}${e.note ? `\n  Ghi chú: ${e.note}` : ''}`)].join('\n')}
          />
        </div>
      )}
    </section>
  )
}

// ---------------- Chuyên trang trích dẫn ----------------

export const NO_TOPIC = '-'

export function QuotesPage({
  excerpts,
  books,
  topic,
  onTopic,
  actions,
  onOpenBook,
}: {
  excerpts: Excerpt[]
  books: Map<string, Book>
  topic: string | null
  onTopic: (t: string | null) => void
  actions: ExcerptActions
  onOpenBook: (b: Book) => void
}) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<'book' | 'none'>('book')
  const topics = useMemo(() => topicCounts(excerpts), [excerpts])
  const allTopics = topics.map((t) => t.topic)
  const noTopic = excerpts.filter((e) => !e.topics?.length).length

  const shown = useMemo(() => {
    const fq = foldVi(q.trim())
    return excerpts
      .filter((e) => (topic === null ? true : topic === NO_TOPIC ? !e.topics?.length : e.topics?.some((t) => sameTopic(t, topic))))
      .filter((e) => {
        if (!fq) return true
        const b = books.get(e.bookId)
        return foldVi([e.text, e.note, ...(e.topics ?? []), b?.title, b && inTextCite(b, e)].filter(Boolean).join(' ')).includes(fq)
      })
  }, [excerpts, books, topic, q])

  const byBook = useMemo(() => {
    const m = new Map<string, Excerpt[]>()
    for (const e of shown) m.set(e.bookId, [...(m.get(e.bookId) ?? []), e])
    return [...m.entries()]
      .map(([id, list]) => ({ id, book: books.get(id), list: list.sort((a, b) => pageKey(a.page) - pageKey(b.page)) }))
      .sort((a, b) => (a.book?.title ?? '').localeCompare(b.book?.title ?? '', 'vi'))
  }, [shown, books])

  const exportText = () => {
    const title = topic === null ? 'Tất cả trích dẫn' : topic === NO_TOPIC ? 'Trích dẫn chưa gắn chủ đề' : `Chủ đề: ${topic}`
    const refs = byBook.filter((g) => g.book).map((g) => referenceOf(g.book!))
    return [
      title,
      '',
      ...byBook.flatMap((g) => [g.book ? g.book.title : '(sách đã bị xóa)', ...g.list.map((e) => `- ${quoteWithCite(g.book, e)}${e.note ? `\n  Ghi chú: ${e.note}` : ''}`), '']),
      'Tài liệu tham khảo',
      ...refs.sort((a, b) => a.localeCompare(b, 'vi')).map((r, i) => `${i + 1}. ${r}`),
    ].join('\n')
  }

  const label = topic === null ? null : topic === NO_TOPIC ? 'Chưa gắn chủ đề' : topic

  return (
    <section className="card quotes-page">
      <h2>Trích dẫn</h2>
      <p className="muted">
        {excerpts.length.toLocaleString('vi-VN')} trích dẫn từ {new Set(excerpts.map((e) => e.bookId)).size.toLocaleString('vi-VN')} cuốn sách, {topics.length} chủ đề. Thêm trích dẫn ở trang
        chi tiết của từng cuốn.
      </p>
      {excerpts.length === 0 ? (
        <div className="state">
          <p>Chưa có trích dẫn nào. Mở một cuốn sách, kéo xuống phần “Trích dẫn” và bấm “+ Thêm trích dẫn”.</p>
        </div>
      ) : (
        <>
          <input className="search" type="search" placeholder="Tìm trong nội dung trích dẫn, ghi chú, nhan đề sách…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="topic-cloud" role="group" aria-label="Chủ đề">
            <button className={`fmt-pill ${topic === null ? 'active' : ''}`} onClick={() => onTopic(null)}>
              Tất cả <span className="n">{excerpts.length}</span>
            </button>
            {topics.map((t) => (
              <button key={t.topic} className={`fmt-pill ${topic !== null && sameTopic(topic, t.topic) ? 'active' : ''}`} onClick={() => onTopic(t.topic)}>
                {t.topic} <span className="n">{t.n}</span>
              </button>
            ))}
            {noTopic > 0 && (
              <button className={`fmt-pill ${topic === NO_TOPIC ? 'active' : ''}`} onClick={() => onTopic(NO_TOPIC)}>
                Chưa gắn chủ đề <span className="n">{noTopic}</span>
              </button>
            )}
          </div>
          <div className="list-head">
            <p className="muted">
              {label && <b className="current-topic">{label}: </b>}
              {shown.length.toLocaleString('vi-VN')} trích dẫn · {byBook.length} sách
            </p>
            <div className="list-controls">
              <label className="sort">
                <span>Hiển thị</span>
                <select value={group} onChange={(e) => setGroup(e.target.value as 'book' | 'none')}>
                  <option value="book">Theo từng sách</option>
                  <option value="none">Danh sách liền</option>
                </select>
              </label>
              {shown.length > 0 && <CopyBtn text={exportText()} label="Chép tất cả (kèm tài liệu tham khảo)" />}
            </div>
          </div>
          {shown.length === 0 && <p className="muted">Không có trích dẫn nào khớp.</p>}
          {group === 'book' ? (
            byBook.map((g) => (
              <div key={g.id} className="quote-group">
                <h3>
                  {g.book ? (
                    <button className="linkish" onClick={() => onOpenBook(g.book!)}>
                      {g.book.title}
                    </button>
                  ) : (
                    '(sách đã bị xóa)'
                  )}
                </h3>
                {g.book && <p className="muted small ref">{referenceOf(g.book)}</p>}
                <ul className="quote-list">
                  {g.list.map((e) => (
                    <QuoteCard key={e.id} ex={e} book={g.book} allTopics={allTopics} actions={actions} onTopic={onTopic} />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <ul className="quote-list">
              {shown
                .slice()
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((e) => (
                  <QuoteCard key={e.id} ex={e} book={books.get(e.bookId)} showBook allTopics={allTopics} actions={actions} onTopic={onTopic} onOpenBook={onOpenBook} />
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
