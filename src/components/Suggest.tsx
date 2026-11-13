import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { foldVi } from '../search/normalizeVi'

export type Option = { value: string; count: number; hint?: string }

/** Đếm số lần xuất hiện, giữ cách viết phổ biến nhất của mỗi giá trị (so sánh không phân biệt hoa/thường, khoảng trắng). */
export function countOptions(values: (string | undefined)[], extra: string[] = []): Option[] {
  const m = new Map<string, Map<string, number>>()
  for (const raw of [...values, ...extra]) {
    const v = raw?.trim().replace(/\s+/g, ' ')
    if (!v) continue
    const k = v.toLocaleLowerCase('vi')
    const forms = m.get(k) ?? new Map<string, number>()
    forms.set(v, (forms.get(v) ?? 0) + 1)
    m.set(k, forms)
  }
  const extraKeys = new Set(extra.map((e) => e.toLocaleLowerCase('vi')))
  return [...m.entries()]
    .map(([k, forms]) => {
      const best = [...forms.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const total = [...forms.values()].reduce((a, b) => a + b, 0) - (extraKeys.has(k) ? 1 : 0)
      return { value: best, count: total }
    })
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'vi'))
}

/** Lọc gợi ý: khớp không dấu; khớp đầu từ xếp trước, rồi theo số lần dùng. */
export function matchOptions(options: Option[], query: string, limit = 8): Option[] {
  const q = foldVi(query.trim())
  if (!q) return []
  const scored: { o: Option; s: number }[] = []
  for (const o of options) {
    const f = foldVi(o.value)
    if (f === q) continue // đã gõ đủ, không cần gợi ý chính nó
    const i = f.indexOf(q)
    if (i < 0) {
      // Khớp từng từ theo thứ tự đầu từ: "tmc" không, nhưng "minh chau" khớp "Thích Minh Châu"
      const words = q.split(' ')
      const fw = f.split(/[\s,.-]+/)
      if (words.length > 1 && words.every((w) => fw.some((x) => x.startsWith(w)))) scored.push({ o, s: 2 })
      continue
    }
    const wordStart = i === 0 || /[\s,.(-]/.test(f[i - 1])
    scored.push({ o, s: wordStart ? 0 : 3 })
  }
  return scored
    .sort((a, b) => a.s - b.s || b.o.count - a.o.count)
    .slice(0, limit)
    .map((x) => x.o)
}

/** Tô đậm phần khớp (theo vị trí trên chuỗi không dấu, vì foldVi giữ nguyên độ dài). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = foldVi(query.trim())
  const f = foldVi(text)
  const i = q ? f.indexOf(q) : -1
  if (i < 0 || f.length !== text.length) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function Dropdown({
  id,
  items,
  query,
  active,
  onPick,
  onHover,
}: {
  id: string
  items: Option[]
  query: string
  active: number
  onPick: (o: Option) => void
  onHover: (i: number) => void
}) {
  return (
    <ul className="suggest-list" id={id} role="listbox">
      {items.map((o, i) => (
        <li
          key={o.value}
          role="option"
          aria-selected={i === active}
          className={i === active ? 'active' : undefined}
          // Giữ con trỏ trong ô nhập khi bấm chọn.
          onPointerDown={(e) => {
            e.preventDefault()
            onPick(o)
          }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="sv">
            <Highlight text={o.value} query={query} />
          </span>
          <span className="sc">{o.hint ?? (o.count > 0 ? `${o.count} sách` : '')}</span>
        </li>
      ))}
    </ul>
  )
}

/** Điều khiển chung cho danh sách gợi ý: phím lên/xuống, Enter/Tab để chọn, Esc để đóng. */
function useSuggest(items: Option[], pick: (o: Option) => void) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const shown = open && items.length > 0
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!shown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      pick(items[Math.min(active, items.length - 1)])
      setOpen(false)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }
  return { open, setOpen, active: Math.min(active, Math.max(0, items.length - 1)), setActive, shown, onKeyDown }
}

/** Ô nhập một giá trị (nhà xuất bản, nơi xuất bản, bộ sách, kệ…) có gợi ý từ thư viện. */
export function SuggestInput({
  value,
  onChange,
  options,
  onPick,
  placeholder,
  disabled,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  onPick?: (v: string) => void
  placeholder?: string
  disabled?: boolean
  label: ReactNode
}) {
  const id = useId()
  const items = useMemo(() => matchOptions(options, value), [options, value])
  const s = useSuggest(items, (o) => {
    onChange(o.value)
    onPick?.(o.value)
  })
  return (
    <label className="suggest">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={s.shown}
        aria-controls={id}
        onChange={(e) => {
          onChange(e.target.value)
          s.setOpen(true)
          s.setActive(0)
        }}
        onFocus={() => s.setOpen(true)}
        onBlur={() => s.setOpen(false)}
        onKeyDown={s.onKeyDown}
      />
      {s.shown && (
        <Dropdown
          id={id}
          items={items}
          query={value}
          active={s.active}
          onHover={s.setActive}
          onPick={(o) => {
            onChange(o.value)
            onPick?.(o.value)
            s.setOpen(false)
          }}
        />
      )}
    </label>
  )
}

/** Ô nhiều dòng, mỗi dòng một người: gợi ý theo dòng đang gõ. */
export function SuggestLines({
  value,
  onChange,
  options,
  label,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  label: ReactNode
  rows?: number
}) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1
  const nl = value.indexOf('\n', caret)
  const lineEnd = nl < 0 ? value.length : nl
  const current = value.slice(lineStart, lineEnd)
  const others = new Set(
    value
      .split('\n')
      .map((l) => foldVi(l.trim()))
      .filter(Boolean),
  )
  const items = useMemo(
    () => matchOptions(options, current).filter((o) => !others.has(foldVi(o.value))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, current, value],
  )
  const pick = (o: Option) => {
    const next = value.slice(0, lineStart) + o.value + value.slice(lineEnd)
    onChange(next)
    const pos = lineStart + o.value.length
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(pos, pos)
      setCaret(pos)
    })
  }
  const s = useSuggest(items, pick)
  const sync = () => setCaret(ref.current?.selectionStart ?? 0)
  return (
    <label className="suggest">
      {label}
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        autoComplete="off"
        aria-expanded={s.shown}
        aria-controls={id}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          s.setOpen(true)
          s.setActive(0)
        }}
        onSelect={sync}
        onClick={sync}
        onFocus={() => {
          sync()
          s.setOpen(true)
        }}
        onBlur={() => s.setOpen(false)}
        onKeyDown={s.onKeyDown}
      />
      {s.shown && <Dropdown id={id} items={items} query={current} active={s.active} onHover={s.setActive} onPick={(o) => (pick(o), s.setOpen(false))} />}
    </label>
  )
}
