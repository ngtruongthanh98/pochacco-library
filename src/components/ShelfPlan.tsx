import { useEffect, useMemo, useState } from 'react'
import { readConfigFile } from '../data/configStore'
import type { StoreConfig } from '../data/githubStore'
import { foldVi } from '../search/normalizeVi'
import { nameToString, type Book } from '../types/book'

// Gợi ý xếp kệ: danh sách do Claude soạn và cập nhật qua chat, lưu ở config/shelves.json trong repo dữ liệu.
// Trang này chỉ đọc và hiển thị, không ghi lại gì lên repo (đánh dấu "đã xếp" chỉ lưu trong trình duyệt).
type Tier = { name: string; note?: string; books: string[] }
type Shelf = { id: string; name: string; note?: string; tiers: Tier[] }
type Plan = { version: number; updatedAt?: string; intro?: string; assumptions?: string; shelves: Shelf[] }

const DONE_KEY = 'pochacco-library:shelf-done'
const readDone = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const isPrint = (b: Book) => b.holdings.some((h) => h.kind === 'print')
const who = (b: Book) => (b.authors?.length ? b.authors : b.editors ?? []).map(nameToString).join(', ')
const fullTitle = (b: Book) => (b.subtitle ? `${b.title}: ${b.subtitle}` : b.title)

function Row({ b, pos, onOpen }: { b: Book; pos: number; onOpen: (b: Book) => void }) {
  return (
    <li className="sp-row">
      <span className="sp-pos">{pos}</span>
      <button className="sp-title" onClick={() => onOpen(b)}>
        {fullTitle(b)}
      </button>
      <span className="muted small">{[who(b), b.year].filter(Boolean).join(' · ')}</span>
    </li>
  )
}

export default function ShelfPlan({ cfg, books, onOpen }: { cfg: StoreConfig; books: Book[]; onOpen: (b: Book) => void }) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState(readDone)

  useEffect(() => {
    readConfigFile<Plan>(cfg, 'shelves')
      .then((r) => setPlan(r?.data ?? null))
      .catch((e: Error) => setErr(e.message))
  }, [cfg])

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])

  // Vị trí của từng sách trong kế hoạch, sách giấy chưa có chỗ, và mã sách không còn trong thư viện.
  const { where, unplaced, missing, total } = useMemo(() => {
    const where = new Map<string, string>()
    const missing: string[] = []
    let total = 0
    for (const s of plan?.shelves ?? [])
      for (const t of s.tiers)
        t.books.forEach((id, i) => {
          total++
          if (byId.has(id)) where.set(id, `Kệ ${s.id} · ${t.name} · vị trí ${i + 1}`)
          else missing.push(id)
        })
    const unplaced = books.filter((b) => isPrint(b) && !where.has(b.id))
    return { where, unplaced, missing, total }
  }, [plan, byId, books])

  const hits = useMemo(() => {
    const f = foldVi(q.trim())
    if (f.length < 2) return []
    return books
      .filter((b) => isPrint(b) && foldVi(`${fullTitle(b)} ${who(b)}`).includes(f))
      .slice(0, 30)
  }, [q, books])

  const toggleDone = (k: string) => {
    const next = { ...done, [k]: !done[k] }
    if (!next[k]) delete next[k]
    setDone(next)
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next))
    } catch {
      /* bỏ qua */
    }
  }

  if (err) return <section className="card"><p>{err}</p></section>
  if (plan === undefined) return <section className="card"><p className="muted">Đang tải gợi ý xếp kệ...</p></section>
  if (plan === null)
    return (
      <section className="card">
        <h2>Gợi ý xếp kệ</h2>
        <p>Chưa có gợi ý nào. Nhắn trong chat để Claude soạn danh sách xếp kệ (lưu ở config/shelves.json).</p>
      </section>
    )

  const tierCount = plan.shelves.reduce((n, s) => n + s.tiers.length, 0)
  const doneCount = plan.shelves.reduce((n, s) => n + s.tiers.filter((t) => done[`${s.id}/${t.name}`]).length, 0)

  return (
    <div className="shelf-plan">
      <section className="card">
        <h2>Gợi ý xếp kệ</h2>
        {plan.intro && <p>{plan.intro}</p>}
        {plan.assumptions && <p className="muted small">{plan.assumptions}</p>}
        <p className="muted small">
          {plan.shelves.length} kệ, {tierCount} ngăn, {total} cuốn đã có chỗ. Đã xếp xong {doneCount}/{tierCount} ngăn.
          {plan.updatedAt && ` Cập nhật ngày ${plan.updatedAt.split('-').reverse().join('/')}.`} Muốn đổi cách xếp thì nhắn trong chat.
        </p>
        <input type="search" placeholder="Tìm sách để biết nằm ở kệ nào..." value={q} onChange={(e) => setQ(e.target.value)} />
        {q.trim().length >= 2 && (
          <ul className="sp-hits">
            {hits.length === 0 && <li className="muted small">Không thấy sách giấy nào khớp.</li>}
            {hits.map((b) => (
              <li key={b.id}>
                <button className="sp-title" onClick={() => onOpen(b)}>
                  {fullTitle(b)}
                </button>
                <span className={where.has(b.id) ? 'sp-loc' : 'sp-loc none'}>{where.get(b.id) ?? 'Chưa có chỗ'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="chips">
          {plan.shelves.map((s) => (
            <a key={s.id} className="chip" href={`#ke-${s.id}`} onClick={(e) => {
              e.preventDefault()
              setOpen((o) => ({ ...o, [s.id]: true }))
              document.getElementById(`ke-${s.id}`)?.scrollIntoView({ behavior: 'smooth' })
            }}>
              {s.id}. {s.name}
            </a>
          ))}
        </div>
      </section>

      {plan.shelves.map((s) => {
        const n = s.tiers.reduce((k, t) => k + t.books.length, 0)
        const isOpen = open[s.id] ?? false
        return (
          <section key={s.id} id={`ke-${s.id}`} className="card sp-shelf">
            <button className="sp-head" onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))} aria-expanded={isOpen}>
              <span className="sp-badge">{s.id}</span>
              <span className="sp-name">
                <strong>{s.name}</strong>
                <span className="muted small">
                  {s.tiers.length} ngăn · {n} cuốn
                </span>
              </span>
              <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
            </button>
            {s.note && <p className="muted small">{s.note}</p>}
            {isOpen &&
              s.tiers.map((t) => {
                const k = `${s.id}/${t.name}`
                return (
                  <div key={k} className={done[k] ? 'sp-tier done' : 'sp-tier'}>
                    <div className="sp-tier-head">
                      <strong>{t.name}</strong>
                      {t.note && <span className="muted small">{t.note}</span>}
                      <label className="sp-done small">
                        <input type="checkbox" checked={!!done[k]} onChange={() => toggleDone(k)} /> Đã xếp
                      </label>
                    </div>
                    <ol className="sp-list">
                      {t.books.map((id, i) => {
                        const b = byId.get(id)
                        return b ? <Row key={id} b={b} pos={i + 1} onOpen={onOpen} /> : null
                      })}
                    </ol>
                  </div>
                )
              })}
          </section>
        )
      })}

      {(unplaced.length > 0 || missing.length > 0) && (
        <section className="card">
          <h2>Sách giấy chưa có chỗ</h2>
          <p className="muted small">
            Sách thêm vào sau lần lập gợi ý gần nhất. Nhắn trong chat để Claude xếp chúng vào kệ.
            {missing.length > 0 && ` Có ${missing.length} mã sách trong gợi ý không còn trong thư viện.`}
          </p>
          <ol className="sp-list">
            {unplaced.map((b, i) => (
              <Row key={b.id} b={b} pos={i + 1} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
