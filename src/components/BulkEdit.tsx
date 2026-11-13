import { useMemo, useState } from 'react'
import { SHOP_DEFAULTS, todayIso } from '../data/money'
import { CATEGORY_GROUPS, categoryLabel } from '../data/categories'
import { saveBatch, type StoreConfig } from '../data/githubStore'
import { placeIndex, pubKey, suggestPlace } from '../data/publisherPlace'
import { BINDINGS, type Binding, type Book } from '../types/book'
import { SuggestInput, useLibraryOptions } from './Suggest'

const LANGS = [
  ['vi', 'Tiếng Việt'],
  ['en', 'Tiếng Anh'],
  ['fr', 'Tiếng Pháp'],
  ['de', 'Tiếng Đức'],
  ['ru', 'Tiếng Nga'],
  ['zh', 'Tiếng Trung'],
  ['pi', 'Pāli'],
  ['km', 'Tiếng Khmer'],
  ['th', 'Tiếng Thái'],
] as const

type FieldKey = 'publisher' | 'place' | 'year' | 'language' | 'series' | 'location' | 'binding' | 'category' | 'subjects' | 'buyDate' | 'buyFrom'
const LABEL: Record<FieldKey, string> = {
  publisher: 'Nhà xuất bản',
  place: 'Nơi xuất bản',
  year: 'Năm xuất bản',
  language: 'Ngôn ngữ',
  series: 'Tùng thư',
  location: 'Vị trí kệ',
  binding: 'Loại bìa',
  category: 'Thêm danh mục',
  subjects: 'Thêm chủ đề',
  buyDate: 'Ngày mua',
  buyFrom: 'Mua ở đâu',
}

/**
 * Sửa nhiều cuốn một lần. Hai phần:
 * 1) Điền nơi xuất bản theo nhà xuất bản cho các cuốn còn thiếu (có gợi ý từ thư viện và bảng NXB phổ biến).
 * 2) Điền chung một trường cho tất cả cuốn đã chọn; mặc định chỉ điền vào chỗ còn trống.
 */
export default function BulkEdit({
  cfg,
  books,
  all,
  focus,
  onClose,
  onSaved,
}: {
  cfg: StoreConfig
  books: Book[]
  all: Book[]
  /** Mở sẵn trường này (vd. 'place' khi bấm từ cảnh báo thiếu nơi xuất bản). */
  focus?: FieldKey
  onClose: () => void
  onSaved: (updated: Book[]) => void
}) {
  const opts = useLibraryOptions(all)
  const idx = useMemo(() => placeIndex(all), [all])

  // Phần 1: nhóm các cuốn thiếu nơi xuất bản theo NXB
  const groups = useMemo(() => {
    const m = new Map<string, { publisher: string; books: Book[] }>()
    for (const b of books)
      if (b.publisher && !b.place && b.type !== 'thesis') {
        const k = pubKey(b.publisher)
        const g = m.get(k) ?? { publisher: b.publisher, books: [] }
        g.books.push(b)
        m.set(k, g)
      }
    return [...m.entries()].map(([k, g]) => ({ key: k, ...g, hint: suggestPlace(g.publisher, idx) })).sort((a, b) => b.books.length - a.books.length)
  }, [books, idx])
  const [places, setPlaces] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [g.key, g.hint?.place ?? ''])))
  const [usePlaces, setUsePlaces] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.key, !!g.hint])))

  // Phần 2: trường chung
  const [on, setOn] = useState<Record<FieldKey, boolean>>(() => ({ publisher: false, place: false, year: false, language: false, series: false, location: false, binding: false, category: false, subjects: false, buyDate: false, buyFrom: false, ...(focus ? { [focus]: true } : {}) }))
  const [val, setVal] = useState<Record<FieldKey, string>>({ publisher: '', place: '', year: '', language: 'vi', series: '', location: '', binding: 'paperback', category: '', subjects: '', buyDate: todayIso(), buyFrom: '' })
  const [onlyEmpty, setOnlyEmpty] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: FieldKey) => (v: string) => setVal((x) => ({ ...x, [k]: v }))
  const toggle = (k: FieldKey) => setOn((x) => ({ ...x, [k]: !x[k] }))

  /** Áp mọi thay đổi lên một cuốn; trả về bản mới hoặc null nếu không đổi gì. */
  const apply = (b0: Book): Book | null => {
    let b: Book = { ...b0 }
    let changed = false
    const put = <K extends keyof Book>(k: K, v: Book[K]) => {
      if (v === undefined || v === '' || (onlyEmpty && b[k] !== undefined && b[k] !== '')) return
      if (b[k] === v) return
      b = { ...b, [k]: v }
      changed = true
    }
    const g = b.publisher && !b.place ? groups.find((x) => x.key === pubKey(b.publisher!)) : undefined
    if (g && usePlaces[g.key] && places[g.key]?.trim()) put('place', places[g.key].trim())
    if (on.publisher) put('publisher', val.publisher.trim())
    if (on.place) put('place', val.place.trim())
    if (on.year && /^\d{3,4}$/.test(val.year.trim())) put('year', Number(val.year.trim()))
    if (on.language) put('language', val.language)
    if (on.series) put('series', val.series.trim())
    if (on.location && val.location.trim()) {
      const i = b.holdings.findIndex((h) => h.kind === 'print')
      const h = b.holdings[i]
      if (h?.kind === 'print' && (!onlyEmpty || !h.location) && h.location !== val.location.trim()) {
        b = { ...b, holdings: b.holdings.map((x, k) => (k === i ? { ...h, location: val.location.trim() } : x)) }
        changed = true
      }
    }
    if (on.binding) {
      const holdings = b.holdings.map((h) => (h.kind === 'print' && (!onlyEmpty || !h.binding) && h.binding !== val.binding ? { ...h, binding: val.binding as Binding } : h))
      if (holdings.some((h, k) => h !== b.holdings[k])) {
        b = { ...b, holdings }
        changed = true
      }
    }
    if (on.category && val.category && !(b.categories ?? []).includes(val.category)) {
      b = { ...b, categories: [...(b.categories ?? []), val.category] }
      changed = true
    }
    if (on.subjects) {
      const add = val.subjects.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      const cur = b.subjects ?? []
      const more = add.filter((s) => !cur.some((c) => c.toLocaleLowerCase('vi') === s.toLocaleLowerCase('vi')))
      if (more.length) {
        b = { ...b, subjects: [...cur, ...more] }
        changed = true
      }
    }
    if ((on.buyDate && val.buyDate) || (on.buyFrom && val.buyFrom.trim())) {
      if (b.status !== 'wishlist') {
        const a = { ...(b.acquired ?? {}) }
        if (on.buyDate && val.buyDate && (!onlyEmpty || !a.date)) a.date = val.buyDate
        if (on.buyFrom && val.buyFrom.trim() && (!onlyEmpty || !a.from)) a.from = val.buyFrom.trim()
        if (a.from && !a.date) a.date = val.buyDate || todayIso()
        if (JSON.stringify(a) !== JSON.stringify(b.acquired ?? {})) {
          b = { ...b, acquired: a }
          changed = true
        }
      }
    }
    return changed ? { ...b, updatedAt: new Date().toISOString() } : null
  }
  const preview = books.map((b) => ({ old: b, next: apply(b) })).filter((x) => x.next)

  const save = async () => {
    const updated = preview.map((x) => x.next!)
    if (!updated.length) return
    setBusy(true)
    setError(null)
    try {
      await saveBatch(cfg, [], updated, `Sửa hàng loạt ${updated.length} sách`)
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const fieldInput = (k: FieldKey) => {
    switch (k) {
      case 'publisher':
        return <SuggestInput label={null} value={val.publisher} onChange={set('publisher')} options={opts.publishers} placeholder="Chính trị quốc gia Sự thật" />
      case 'place':
        return <SuggestInput label={null} value={val.place} onChange={set('place')} options={opts.places} placeholder="Hà Nội" />
      case 'year':
        return <input inputMode="numeric" value={val.year} onChange={(e) => set('year')(e.target.value)} placeholder="2020" />
      case 'language':
        return (
          <select value={val.language} onChange={(e) => set('language')(e.target.value)}>
            {LANGS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )
      case 'series':
        return <SuggestInput label={null} value={val.series} onChange={set('series')} options={opts.series} />
      case 'location':
        return <SuggestInput label={null} value={val.location} onChange={set('location')} options={opts.locations} placeholder="T1-K2" />
      case 'binding':
        return (
          <select value={val.binding} onChange={(e) => set('binding')(e.target.value)}>
            {BINDINGS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </select>
        )
      case 'category':
        return (
          <select value={val.category} onChange={(e) => set('category')(e.target.value)}>
            <option value="">Chọn danh mục…</option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )
      case 'buyDate':
        return <input type="date" value={val.buyDate} max={todayIso()} onChange={(e) => set('buyDate')(e.target.value)} />
      case 'buyFrom':
        return <SuggestInput label={null} value={val.buyFrom} onChange={set('buyFrom')} options={SHOP_DEFAULTS.map((value) => ({ value, count: 0 }))} placeholder="Hội sách, Oreka…" />
      case 'subjects':
        return <input value={val.subjects} onChange={(e) => set('subjects')(e.target.value)} placeholder="triết học Mác, tha hóa (cách nhau bằng dấu phẩy)" />
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Sửa hàng loạt" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog bulk">
        <h3>Sửa hàng loạt {books.length} cuốn</h3>

        {groups.length > 0 && (
          <section className="bulk-sec">
            <h4>Điền nơi xuất bản theo nhà xuất bản</h4>
            <p className="muted small">Các cuốn dưới đây có nhà xuất bản nhưng chưa ghi nơi xuất bản. Gợi ý lấy từ những cuốn khác trong thư viện, hoặc từ trụ sở chính của NXB.</p>
            <div className="bulk-places">
              {groups.map((g) => (
                <div key={g.key} className="bulk-place">
                  <label className="check">
                    <input type="checkbox" checked={!!usePlaces[g.key]} onChange={(e) => setUsePlaces((x) => ({ ...x, [g.key]: e.target.checked }))} />
                    <span>
                      <b>{g.publisher}</b> <span className="muted small">({g.books.length} cuốn)</span>
                    </span>
                  </label>
                  <span className="bulk-arrow">→</span>
                  <SuggestInput
                    label={null}
                    value={places[g.key] ?? ''}
                    onChange={(v) => {
                      setPlaces((x) => ({ ...x, [g.key]: v }))
                      if (v.trim()) setUsePlaces((x) => ({ ...x, [g.key]: true }))
                    }}
                    options={opts.places}
                    placeholder="Nơi xuất bản"
                  />
                  {g.hint && <span className="muted small bulk-why">{g.hint.from === 'library' ? `theo ${g.hint.count} cuốn khác` : 'trụ sở NXB'}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bulk-sec">
          <h4>Điền chung cho tất cả cuốn đã chọn</h4>
          <label className="check">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> Chỉ điền vào chỗ còn trống (không ghi đè thông tin đã có)
          </label>
          <div className="bulk-fields">
            {(Object.keys(LABEL) as FieldKey[]).map((k) => (
              <div key={k} className={`bulk-field ${on[k] ? 'on' : ''}`}>
                <label className="check">
                  <input type="checkbox" checked={on[k]} onChange={() => toggle(k)} /> {LABEL[k]}
                </label>
                {on[k] && fieldInput(k)}
              </div>
            ))}
          </div>
          {on.category && val.category && <p className="muted small">Sẽ thêm danh mục “{categoryLabel(val.category)}”, giữ nguyên các danh mục đang có.</p>}
        </section>

        <section className="bulk-preview">
          <b>{preview.length ? `Sẽ sửa ${preview.length}/${books.length} cuốn` : 'Chưa có thay đổi nào'}</b>
          {preview.length > 0 && (
            <details>
              <summary>Xem danh sách</summary>
              <ul>
                {preview.slice(0, 60).map((x) => (
                  <li key={x.old.id}>
                    {x.old.title}
                    <span className="muted small">
                      {' '}
                      {(['publisher', 'place', 'year', 'language', 'series'] as const)
                        .filter((k) => x.next![k] !== x.old[k])
                        .map((k) => `${LABEL[k].toLowerCase()}: ${x.next![k]}`)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button onClick={save} disabled={busy || !preview.length}>
            {busy ? 'Đang lưu...' : `Lưu ${preview.length || ''} cuốn`}
          </button>
        </div>
      </div>
    </div>
  )
}
