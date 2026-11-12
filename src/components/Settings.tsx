import { useMemo, useRef, useState } from 'react'
import { cloneGroups, CATEGORY_GROUPS, newId, type CategoryGroup } from '../data/categories'
import { saveBatch, saveTaxonomy, type StoreConfig } from '../data/githubStore'
import type { Book } from '../types/book'
import { ConfirmDialog } from './ConfirmDialog'

/** Một lần xóa: các mã bị gỡ khỏi sách, và mục nhận sách thay thế (null = bỏ phân loại). */
type Move = { from: string[]; to: string | null }

const applyMoves = (b: Book, moves: Move[]): Book => {
  let cats = b.categories ?? []
  for (const m of moves) {
    if (!cats.some((c) => m.from.includes(c))) continue
    cats = cats.filter((c) => !m.from.includes(c))
    if (m.to && !cats.includes(m.to)) cats = [...cats, m.to]
  }
  return cats.length === (b.categories ?? []).length && cats.every((c, i) => c === b.categories?.[i])
    ? b
    : { ...b, categories: cats.length ? cats : undefined }
}

const move = <T,>(arr: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const out = [...arr]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

type Target = { kind: 'group'; gi: number } | { kind: 'item'; gi: number; ci: number }

export function Settings({
  cfg,
  books,
  taxSha,
  onSaved,
}: {
  cfg: StoreConfig
  books: Book[]
  taxSha: string | null
  onSaved: (groups: CategoryGroup[], changedBooks: Book[], sha: string) => void
}) {
  const [saved, setSaved] = useState(() => cloneGroups(CATEGORY_GROUPS))
  const [draft, setDraft] = useState(() => cloneGroups(CATEGORY_GROUPS))
  const [moves, setMoves] = useState<Move[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [newItem, setNewItem] = useState<Record<string, string>>({})
  const [newGroup, setNewGroup] = useState('')
  const [del, setDel] = useState<Target | null>(null)
  const [delTo, setDelTo] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string, on?: boolean) =>
    setOpen((o) => {
      const n = new Set(o)
      if (on ?? !n.has(id)) n.add(id)
      else n.delete(id)
      return n
    })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const shaRef = useRef(taxSha)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || moves.length > 0
  const simBooks = useMemo(() => (moves.length ? books.map((b) => applyMoves(b, moves)) : books), [books, moves])
  const countOf = (ids: string[]) => simBooks.filter((b) => b.categories?.some((c) => ids.includes(c))).length
  const allIds = () => new Set([...saved, ...draft].flatMap((g) => [g.id, ...g.items.map((c) => c.id)]).concat(books.flatMap((b) => b.categories ?? [])))

  const startEdit = (key: string, label: string) => {
    setEditing(key)
    setEditText(label)
    setError(null)
  }
  // So sánh giữ nguyên dấu (chỉ bỏ khác biệt hoa/thường): "vi mô" và "vĩ mô" là hai mục khác nhau.
  const same = (a: string, b: string) => a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi')
  const labelTaken = (label: string, exceptId: string) =>
    draft.some((g) => g.items.some((c) => c.id !== exceptId && same(c.label, label))) ||
    draft.some((g) => g.id !== exceptId && same(g.label, label))
  const commitEdit = () => {
    const label = editText.trim()
    if (!editing) return
    if (!label) return setError('Tên không được để trống.')
    if (labelTaken(label, editing)) return setError(`Đã có mục tên “${label}”. Hãy chọn tên khác để khỏi nhầm.`)
    setDraft((d) => d.map((g) => ({ ...g, label: g.id === editing ? label : g.label, items: g.items.map((c) => (c.id === editing ? { ...c, label } : c)) })))
    setEditing(null)
    setError(null)
  }

  const addItem = (gi: number) => {
    const g = draft[gi]
    const label = (newItem[g.id] ?? '').trim()
    if (!label) return
    if (labelTaken(label, '')) return setError(`Đã có mục tên “${label}”.`)
    const id = newId(label, allIds())
    setDraft((d) => d.map((x, i) => (i === gi ? { ...x, items: [...x.items, { id, label }] } : x)))
    setNewItem((n) => ({ ...n, [g.id]: '' }))
    toggle(g.id, true)
    setError(null)
  }
  const addGroup = () => {
    const label = newGroup.trim()
    if (!label) return
    if (labelTaken(label, '')) return setError(`Đã có mục tên “${label}”.`)
    const id = newId(label, allIds())
    setDraft((d) => [...d, { id, label, items: [] }])
    toggle(id, true)
    setNewGroup('')
    setError(null)
  }
  const moveItemToGroup = (gi: number, ci: number, toGroupId: string) => {
    setDraft((d) => {
      const item = d[gi].items[ci]
      return d.map((g, i) =>
        i === gi ? { ...g, items: g.items.filter((_, k) => k !== ci) } : g.id === toGroupId ? { ...g, items: [...g.items, item] } : g,
      )
    })
  }

  // --- xóa ---
  const removedIds = (t: Target) => (t.kind === 'group' ? [draft[t.gi].id, ...draft[t.gi].items.map((c) => c.id)] : [draft[t.gi].items[t.ci].id])
  const askDelete = (t: Target) => {
    setError(null)
    if (t.kind === 'group' && draft.length <= 1) return setError('Cần giữ lại ít nhất một nhóm.')
    setDelTo('')
    setDel(t)
  }
  const confirmDelete = () => {
    if (!del) return
    const ids = removedIds(del)
    if (countOf(ids) > 0) setMoves((m) => [...m, { from: ids, to: delTo || null }])
    setDraft((d) =>
      del.kind === 'group' ? d.filter((_, i) => i !== del.gi) : d.map((g, i) => (i === del.gi ? { ...g, items: g.items.filter((_, k) => k !== del.ci) } : g)),
    )
    setDel(null)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const now = new Date().toISOString()
      const changed = simBooks.filter((b, i) => b !== books[i]).map((b) => ({ ...b, updatedAt: now }))
      if (changed.length) await saveBatch(cfg, [], changed, `Phân loại: cập nhật ${changed.length} sách theo cấu trúc mới`)
      const sha = await saveTaxonomy(cfg, draft, shaRef.current, 'Cập nhật cấu trúc phân loại sách')
      shaRef.current = sha
      onSaved(draft, changed, sha)
      setSaved(cloneGroups(draft))
      setMoves([])
      setDone(changed.length ? `Đã lưu. ${changed.length} sách được chuyển sang mục mới.` : 'Đã lưu cấu trúc phân loại.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const undo = () => {
    setDraft(cloneGroups(saved))
    setMoves([])
    setEditing(null)
    setError(null)
    setDone(null)
  }

  const delIds = del ? removedIds(del) : []
  const delCount = del ? countOf(delIds) : 0
  const delName = del ? (del.kind === 'group' ? draft[del.gi].label : draft[del.gi].items[del.ci].label) : ''
  const nameCell = (key: string, label: string, cls: string) =>
    editing === key ? (
      <input
        className="tax-edit"
        autoFocus
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(null)
        }}
        onBlur={commitEdit}
        aria-label="Tên mới"
      />
    ) : (
      <span className={cls}>{label}</span>
    )

  return (
    <section className="card settings">
      <h2>Cài đặt</h2>
      <h3>Phân loại sách</h3>
      <p className="muted">
        Mỗi <b>nhóm</b> (mục cha) chứa các <b>mục con</b>. Sách gắn vào mục con. Bạn đổi tên, sắp xếp, thêm, chuyển mục sang nhóm khác hoặc xóa thoải mái; sách đã gắn không bị mất khi đổi tên hay chuyển nhóm.
      </p>

      {(dirty || error || done) && (
        <div className={`tax-bar ${error ? 'err' : ''}`} role="status">
          <span>{error ?? (dirty ? 'Có thay đổi chưa lưu.' : done)}</span>
          {dirty && (
            <div className="tax-bar-actions">
              <button className="secondary" onClick={undo} disabled={busy}>
                Hoàn tác
              </button>
              <button onClick={() => void save()} disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tax-toolbar">
        <button className="link" onClick={() => setOpen(new Set(draft.map((g) => g.id)))}>Mở tất cả</button>
        <button className="link" onClick={() => setOpen(new Set())}>Thu gọn tất cả</button>
      </div>
      <div className="tax">
        {draft.map((g, gi) => (
          <div className="tax-group" key={g.id}>
            <div className="tax-head">
              <button
                className="icon-btn tax-toggle"
                aria-expanded={open.has(g.id)}
                aria-label={open.has(g.id) ? `Thu gọn ${g.label}` : `Mở ${g.label}`}
                onClick={() => toggle(g.id)}
              >
                {open.has(g.id) ? '▾' : '▸'}
              </button>
              {nameCell(g.id, g.label, 'tax-name group')}
              <span className="tax-count">{g.items.length} mục · </span>
              <span className="tax-count">{countOf(g.items.map((c) => c.id))} sách</span>
              <div className="tax-tools">
                <button className="icon-btn" aria-label="Chuyển nhóm lên" disabled={gi === 0} onClick={() => setDraft((d) => move(d, gi, -1))}>↑</button>
                <button className="icon-btn" aria-label="Chuyển nhóm xuống" disabled={gi === draft.length - 1} onClick={() => setDraft((d) => move(d, gi, 1))}>↓</button>
                <button className="icon-btn txt" onClick={() => startEdit(g.id, g.label)}>Sửa tên</button>
                <button className="icon-btn txt del" onClick={() => askDelete({ kind: 'group', gi })}>Xóa</button>
              </div>
            </div>
            {open.has(g.id) && (
            <>
            <ul className="tax-items">
              {g.items.map((c, ci) => (
                <li key={c.id}>
                  {nameCell(c.id, c.label, 'tax-name')}
                  <span className="tax-count">{countOf([c.id])}</span>
                  <div className="tax-tools">
                    <button
                      className="icon-btn"
                      aria-label="Lên"
                      disabled={ci === 0}
                      onClick={() => setDraft((d) => d.map((x, i) => (i === gi ? { ...x, items: move(x.items, ci, -1) } : x)))}
                    >↑</button>
                    <button
                      className="icon-btn"
                      aria-label="Xuống"
                      disabled={ci === g.items.length - 1}
                      onClick={() => setDraft((d) => d.map((x, i) => (i === gi ? { ...x, items: move(x.items, ci, 1) } : x)))}
                    >↓</button>
                    <button className="icon-btn txt" onClick={() => startEdit(c.id, c.label)}>Sửa tên</button>
                    {draft.length > 1 && (
                      <select
                        className="tax-move"
                        aria-label={`Chuyển “${c.label}” sang nhóm khác`}
                        value=""
                        onChange={(e) => e.target.value && moveItemToGroup(gi, ci, e.target.value)}
                      >
                        <option value="">Chuyển nhóm…</option>
                        {draft.filter((x) => x.id !== g.id).map((x) => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    )}
                    <button className="icon-btn txt del" onClick={() => askDelete({ kind: 'item', gi, ci })}>Xóa</button>
                  </div>
                </li>
              ))}
              {g.items.length === 0 && <li className="muted tax-empty">Nhóm này chưa có mục con.</li>}
            </ul>
            <form
              className="tax-add"
              onSubmit={(e) => {
                e.preventDefault()
                addItem(gi)
              }}
            >
              <input
                placeholder="Tên mục con mới…"
                value={newItem[g.id] ?? ''}
                onChange={(e) => setNewItem((n) => ({ ...n, [g.id]: e.target.value }))}
              />
              <button type="submit" className="secondary" disabled={!(newItem[g.id] ?? '').trim()}>+ Thêm mục con</button>
            </form>
            </>
            )}
          </div>
        ))}
      </div>

      <form
        className="tax-add tax-add-group"
        onSubmit={(e) => {
          e.preventDefault()
          addGroup()
        }}
      >
        <input placeholder="Tên nhóm (mục cha) mới…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <button type="submit" className="secondary" disabled={!newGroup.trim()}>+ Thêm nhóm</button>
      </form>

      {del && delCount === 0 && (
        <ConfirmDialog
          title={`Xóa ${del.kind === 'group' ? 'nhóm' : 'mục'} “${delName}”?`}
          text={del.kind === 'group' && draft[del.gi].items.length ? `Nhóm này có ${draft[del.gi].items.length} mục con, chưa có sách nào gắn vào. Các mục con sẽ bị xóa theo.` : 'Chưa có sách nào gắn vào mục này.'}
          confirmLabel="Xóa"
          cancelLabel="Giữ lại"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {del && delCount > 0 && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDel(null)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
            <h3 id="del-title">Xóa {del.kind === 'group' ? 'nhóm' : 'mục'} “{delName}”?</h3>
            <p>
              Có <b>{delCount}</b> sách đang gắn vào {del.kind === 'group' ? 'các mục của nhóm này' : 'mục này'}. Chọn nơi chuyển những sách đó sang:
            </p>
            <select className="dialog-select" value={delTo} onChange={(e) => setDelTo(e.target.value)} aria-label="Chuyển sách sang mục">
              <option value="">Bỏ phân loại (không gắn mục nào)</option>
              {draft.map((g, gi) => {
                const items = g.items.filter((c) => !(del.kind === 'group' ? del.gi === gi : del.gi === gi && draft[gi].items[del.ci].id === c.id))
                return items.length && !(del.kind === 'group' && del.gi === gi) ? (
                  <optgroup key={g.id} label={g.label}>
                    {items.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </select>
            <p className="muted small">Thay đổi chỉ được ghi khi bạn bấm “Lưu thay đổi”.</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setDel(null)}>Giữ lại</button>
              <button className="danger" onClick={confirmDelete}>Xóa và chuyển sách</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
