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
  // Nâng mục con thành nhóm
  const [promo, setPromo] = useState<{ gi: number; ci: number } | null>(null)
  const [promoKeep, setPromoKeep] = useState<'keep' | 'move'>('keep')
  const [promoChild, setPromoChild] = useState('')
  const [promoTo, setPromoTo] = useState('')
  const [promoTake, setPromoTake] = useState<Set<string>>(() => new Set())
  // Hạ nhóm thành mục con
  const [demo, setDemo] = useState<number | null>(null)
  const [demoTo, setDemoTo] = useState('')
  const [demoMode, setDemoMode] = useState<'merge' | 'flat'>('merge')
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

  // --- nâng mục con thành nhóm ---
  const askPromote = (gi: number, ci: number) => {
    const c = draft[gi].items[ci]
    setError(null)
    setPromo({ gi, ci })
    setPromoKeep('keep')
    setPromoChild(`${c.label} (chung)`)
    setPromoTo('')
    setPromoTake(new Set())
  }
  const confirmPromote = () => {
    if (!promo) return
    const g = draft[promo.gi]
    const c = g.items[promo.ci]
    const n = countOf([c.id])
    const child = promoChild.trim()
    if (n > 0 && promoKeep === 'keep') {
      if (!child) return setError('Đặt tên cho mục con giữ sách cũ.')
      if (same(child, c.label) || labelTaken(child, c.id)) return setError(`Đã có mục tên “${child}”. Hãy chọn tên khác.`)
    }
    const gid = newId(c.label, allIds())
    const taken = g.items.filter((x) => promoTake.has(x.id))
    // Mục cũ: giữ nguyên mã (sách không phải sửa) và đổi tên, hoặc bỏ đi và chuyển sách.
    const keepOld = n > 0 && promoKeep === 'keep'
    const items = [...(keepOld ? [{ id: c.id, label: child }] : []), ...taken]
    if (n > 0 && !keepOld) setMoves((m) => [...m, { from: [c.id], to: promoTo || null }])
    setDraft((d) => {
      const out: CategoryGroup[] = []
      d.forEach((x, i) => {
        if (i !== promo.gi) return out.push(x)
        out.push({ ...x, items: x.items.filter((it) => it.id !== c.id && !promoTake.has(it.id)) })
        out.push({ id: gid, label: c.label, items })
      })
      return out
    })
    toggle(gid, true)
    setPromo(null)
    setError(null)
  }

  // --- hạ nhóm thành mục con ---
  const askDemote = (gi: number) => {
    setError(null)
    if (draft.length <= 1) return setError('Cần ít nhất hai nhóm mới hạ được một nhóm xuống làm mục con.')
    setDemo(gi)
    setDemoTo(draft.find((_, i) => i !== gi)!.id)
    setDemoMode('merge')
  }
  const confirmDemote = () => {
    if (demo === null) return
    const g = draft[demo]
    if (!demoTo) return
    let newItems: { id: string; label: string }[]
    if (demoMode === 'flat') {
      newItems = g.items
    } else if (g.items.length === 1) {
      // Một mục con duy nhất: giữ mã cũ, chỉ đổi tên theo nhóm, khỏi phải sửa sách.
      newItems = [{ id: g.items[0].id, label: g.label }]
    } else {
      const id = newId(g.label, allIds())
      newItems = [{ id, label: g.label }]
      const ids = g.items.map((c) => c.id)
      if (countOf(ids) > 0) setMoves((m) => [...m, { from: ids, to: id }])
    }
    if (demoMode === 'flat') {
      const clash = newItems.find((c) => draft.some((x) => x.id !== g.id && x.items.some((y) => same(y.label, c.label))))
      if (clash) return setError(`Nhóm đích đã có mục tên “${clash.label}”.`)
    }
    setDraft((d) => d.filter((_, i) => i !== demo).map((x) => (x.id === demoTo ? { ...x, items: [...x.items, ...newItems] } : x)))
    toggle(demoTo, true)
    setDemo(null)
    setError(null)
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
        Mỗi <b>nhóm</b> (mục cha) chứa các <b>mục con</b>. Sách gắn vào mục con. Bạn đổi tên, sắp xếp, thêm, chuyển mục sang nhóm khác, nâng một mục con thành nhóm, hạ một nhóm thành mục con hoặc xóa thoải mái; sách đã gắn không bị mất khi đổi tên hay chuyển nhóm.
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
                {draft.length > 1 && (
                  <button className="icon-btn txt" onClick={() => askDemote(gi)} title="Biến nhóm này thành một mục con của nhóm khác">
                    Hạ thành mục con
                  </button>
                )}
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
                    <button className="icon-btn txt" onClick={() => askPromote(gi, ci)} title="Biến mục này thành một nhóm (mục cha) riêng">
                      Nâng thành nhóm
                    </button>
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


      {promo && (() => {
        const g = draft[promo.gi]
        const c = g.items[promo.ci]
        const n = countOf([c.id])
        const sibs = g.items.filter((x) => x.id !== c.id)
        return (
          <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPromo(null)}>
            <div className="dialog tax-dialog" role="dialog" aria-modal="true" aria-labelledby="promo-title">
              <h3 id="promo-title">Nâng “{c.label}” thành nhóm</h3>
              <p>
                “{c.label}” sẽ thành một nhóm (mục cha) mới, nằm ngay sau nhóm “{g.label}”. Sau đó bạn thêm các mục con cho nhóm này.
              </p>
              {n > 0 ? (
                <fieldset className="tax-opts">
                  <legend>
                    {n} sách đang gắn vào “{c.label}”. Vì sách chỉ gắn vào mục con, chọn chỗ cho các sách này:
                  </legend>
                  <label className="radio">
                    <input type="radio" checked={promoKeep === 'keep'} onChange={() => setPromoKeep('keep')} />
                    <span>
                      Giữ trong một mục con của nhóm mới, tên:
                      <input className="tax-inline" value={promoChild} onChange={(e) => setPromoChild(e.target.value)} onFocus={() => setPromoKeep('keep')} aria-label="Tên mục con giữ sách cũ" />
                      <small className="muted">Không phải sửa sách nào.</small>
                    </span>
                  </label>
                  <label className="radio">
                    <input type="radio" checked={promoKeep === 'move'} onChange={() => setPromoKeep('move')} />
                    <span>
                      Chuyển sang mục khác:
                      <select className="tax-inline" value={promoTo} onChange={(e) => { setPromoTo(e.target.value); setPromoKeep('move') }} aria-label="Chuyển sách sang mục">
                        <option value="">Bỏ phân loại</option>
                        {draft.map((x) => {
                          const its = x.items.filter((y) => y.id !== c.id && !promoTake.has(y.id))
                          return its.length ? (
                            <optgroup key={x.id} label={x.label}>
                              {its.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                            </optgroup>
                          ) : null
                        })}
                      </select>
                    </span>
                  </label>
                </fieldset>
              ) : (
                <p className="muted small">Chưa có sách nào gắn vào mục này, nhóm mới sẽ bắt đầu trống.</p>
              )}
              {sibs.length > 0 && (
                <fieldset className="tax-opts">
                  <legend>Đưa thêm các mục con của “{g.label}” vào nhóm mới (không bắt buộc):</legend>
                  <div className="tax-checks">
                    {sibs.map((x) => (
                      <label key={x.id} className="check">
                        <input
                          type="checkbox"
                          checked={promoTake.has(x.id)}
                          onChange={(e) => setPromoTake((t) => { const nx = new Set(t); if (e.target.checked) nx.add(x.id); else nx.delete(x.id); return nx })}
                        />
                        {x.label} <span className="muted small">({countOf([x.id])})</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {error && <p className="error small">{error}</p>}
              <p className="muted small">Thay đổi chỉ được ghi khi bạn bấm “Lưu thay đổi”.</p>
              <div className="dialog-actions">
                <button className="secondary" onClick={() => { setPromo(null); setError(null) }}>Hủy</button>
                <button onClick={confirmPromote}>Nâng thành nhóm</button>
              </div>
            </div>
          </div>
        )
      })()}

      {demo !== null && (() => {
        const g = draft[demo]
        const n = countOf(g.items.map((c) => c.id))
        const to = draft.find((x) => x.id === demoTo)
        return (
          <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDemo(null)}>
            <div className="dialog tax-dialog" role="dialog" aria-modal="true" aria-labelledby="demo-title">
              <h3 id="demo-title">Hạ nhóm “{g.label}” thành mục con</h3>
              <label className="tax-field">
                Đưa vào nhóm
                <select className="dialog-select" value={demoTo} onChange={(e) => setDemoTo(e.target.value)}>
                  {draft.filter((_, i) => i !== demo).map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                </select>
              </label>
              {g.items.length > 0 ? (
                <fieldset className="tax-opts">
                  <legend>
                    Nhóm này có {g.items.length} mục con ({g.items.map((c) => c.label).join(', ')}), {n} sách. Xử lý các mục con thế nào?
                  </legend>
                  <label className="radio">
                    <input type="radio" checked={demoMode === 'merge'} onChange={() => setDemoMode('merge')} />
                    <span>
                      <b>Gộp lại</b> thành một mục “{g.label}” trong nhóm “{to?.label}”.{' '}
                      <small className="muted">
                        {g.items.length === 1 ? 'Không phải sửa sách nào.' : n ? `${n} sách sẽ được gắn vào mục gộp.` : ''}
                      </small>
                    </span>
                  </label>
                  <label className="radio">
                    <input type="radio" checked={demoMode === 'flat'} onChange={() => setDemoMode('flat')} />
                    <span>
                      <b>Giữ nguyên các mục con</b>, chuyển hết sang nhóm “{to?.label}” và bỏ tên nhóm “{g.label}”.{' '}
                      <small className="muted">Không phải sửa sách nào.</small>
                    </span>
                  </label>
                </fieldset>
              ) : (
                <p className="muted small">Nhóm này chưa có mục con, sẽ thành một mục trống trong nhóm “{to?.label}”.</p>
              )}
              {error && <p className="error small">{error}</p>}
              <p className="muted small">Thay đổi chỉ được ghi khi bạn bấm “Lưu thay đổi”.</p>
              <div className="dialog-actions">
                <button className="secondary" onClick={() => { setDemo(null); setError(null) }}>Hủy</button>
                <button onClick={confirmDemote}>Hạ thành mục con</button>
              </div>
            </div>
          </div>
        )
      })()}
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
