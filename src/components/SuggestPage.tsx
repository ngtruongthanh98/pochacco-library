import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoreConfig } from '../data/githubStore'
import {
  clean, emptySuggestCfg, fmtRanges, KNOWN_TOTALS, loadSuggestCfg, runSource, saveSuggestCfg, SHOPS, shopQuery, SOURCES, toDraft,
  type SourceId, type SuggestConfig, type Suggestion,
} from '../data/suggest'
import type { Book } from '../types/book'

type SrcState = { status: 'idle' | 'loading' | 'ok' | 'error'; items: Suggestion[]; error?: string }

function Shops({ s, vol }: { s: Suggestion; vol?: number }) {
  const q = shopQuery(s, vol)
  return (
    <div className="sg-shops">
      <span className="muted small">Tìm mua:</span>
      {SHOPS.map((x) => (
        <a key={x.id} href={x.url(q)} target="_blank" rel="noreferrer" className="sg-shop">
          {x.label}
        </a>
      ))}
    </div>
  )
}

function Card({ s, onWish, onDismiss }: { s: Suggestion; onWish: (vol?: number) => void; onDismiss: () => void }) {
  const [more, setMore] = useState(false)
  return (
    <article className="sg-card">
      <div className="sg-cover">{s.cover ? <img src={s.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">📖</span>}</div>
      <div className="sg-body">
        <h4>
          {s.infoUrl ? (
            <a href={s.infoUrl} target="_blank" rel="noreferrer">
              {s.title}
            </a>
          ) : (
            s.title
          )}
        </h4>
        {s.subtitle && <div className="muted small">{s.subtitle}</div>}
        <div className="sg-meta small">{[s.authors.join(', '), s.publisher, s.year].filter(Boolean).join(' · ')}</div>
        <p className="sg-reason small">{s.reason}</p>
        {s.description && (
          <p className={`sg-desc small${more ? ' open' : ''}`} onClick={() => setMore(!more)}>
            {s.description}
          </p>
        )}
        <div className="sg-actions">
          <button className="small-btn" onClick={() => onWish()}>
            ＋ Muốn mua
          </button>
          <button className="secondary small-btn" onClick={onDismiss}>
            Bỏ qua
          </button>
        </div>
        <Shops s={s} />
      </div>
    </article>
  )
}

function SeriesCard({ s, onWish, onDismiss, onTotal }: { s: Suggestion; onWish: (vol: number) => void; onDismiss: () => void; onTotal: (n: number | null) => void }) {
  const [vol, setVol] = useState(s.missing![0])
  const [edit, setEdit] = useState(false)
  const [tot, setTot] = useState(String(s.total ?? ''))
  return (
    <article className="sg-card series">
      <div className="sg-cover">
        <span className="sg-vols" aria-hidden="true">
          {s.total! - s.missing!.length}/{s.total}
        </span>
      </div>
      <div className="sg-body">
        <h4>{s.title}</h4>
        <div className="sg-meta small">{[s.authors.join(', '), s.publisher].filter(Boolean).join(' · ')}</div>
        <p className="sg-reason small">{s.reason}</p>
        <div className="sg-volbar" role="img" aria-label={`Đã có ${s.total! - s.missing!.length} trên ${s.total} tập`}>
          {Array.from({ length: s.total! }, (_, i) => (
            <span key={i} className={s.missing!.includes(i + 1) ? 'miss' : 'have'} title={`Tập ${i + 1}${s.missing!.includes(i + 1) ? ': còn thiếu' : ''}`} />
          ))}
        </div>
        <div className="sg-actions">
          <label className="sg-volpick">
            Tập
            <select value={vol} onChange={(e) => setVol(Number(e.target.value))}>
              {s.missing!.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button className="small-btn" onClick={() => onWish(vol)}>
            ＋ Muốn mua tập {vol}
          </button>
          <button className="secondary small-btn" onClick={() => setEdit(!edit)}>
            Sửa tổng số tập
          </button>
          <button className="secondary small-btn" onClick={onDismiss}>
            Bỏ qua
          </button>
        </div>
        {edit && (
          <form
            className="sg-total"
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(tot)
              onTotal(n > 0 ? Math.round(n) : null)
              setEdit(false)
            }}
          >
            <span className="small">Bộ này có tổng cộng</span>
            <input type="number" min={1} max={300} value={tot} onChange={(e) => setTot(e.target.value)} aria-label="Tổng số tập" />
            <span className="small">tập</span>
            <button type="submit" className="small-btn">
              Lưu
            </button>
          </form>
        )}
        <Shops s={s} vol={vol} />
      </div>
    </article>
  )
}

export default function SuggestPage({ cfg, books, onWish }: { cfg: StoreConfig; books: Book[]; onWish: (draft: Partial<Book>) => void }) {
  const [sc, setSc] = useState<SuggestConfig | null>(null)
  const shaRef = useRef<string | null>(null)
  const [src, setSrc] = useState<SourceId>('series')
  const [state, setState] = useState<Record<SourceId, SrcState>>(() =>
    Object.fromEntries(SOURCES.map((x) => [x.id, { status: 'idle', items: [] }])) as unknown as Record<SourceId, SrcState>,
  )
  const [topicText, setTopicText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    loadSuggestCfg(cfg)
      .then((r) => {
        shaRef.current = r.sha
        setSc(r.data)
      })
      .catch(() => setSc(emptySuggestCfg()))
  }, [cfg])

  const persist = async (next: SuggestConfig, m: string) => {
    setSc(next)
    try {
      shaRef.current = await saveSuggestCfg(cfg, next, shaRef.current, m)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không lưu được')
    }
  }

  const load = async (id: SourceId, force = false, withCfg?: SuggestConfig) => {
    const conf = withCfg ?? sc
    if (!conf) return
    if (!force && (state[id].status === 'loading' || state[id].status === 'ok')) return
    setState((s) => ({ ...s, [id]: { status: 'loading', items: s[id].items } }))
    try {
      const items = await runSource(id, { books, cfg: conf })
      setState((s) => ({ ...s, [id]: { status: 'ok', items } }))
    } catch (e) {
      setState((s) => ({ ...s, [id]: { status: 'error', items: [], error: e instanceof Error ? e.message : 'Lỗi không rõ' } }))
    }
  }
  useEffect(() => {
    if (sc) void load(src)
    setGroup(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, sc === null])

  const cur = state[src]
  const items = useMemo(() => (sc ? clean(cur.items, books, sc.dismissed) : []), [cur.items, books, sc])
  const groups = useMemo(() => [...new Set(items.map((x) => x.group))], [items])
  const shown = group ? items.filter((x) => x.group === group) : items

  const dismiss = (s: Suggestion) => sc && persist({ ...sc, dismissed: [...sc.dismissed, s.id] }, `Bỏ qua gợi ý: ${s.title}`)
  const setTotal = (s: Suggestion, n: number | null) => {
    if (!sc || !s.seriesKey) return
    const totals = { ...sc.totals }
    if (n) totals[s.seriesKey] = n
    else delete totals[s.seriesKey]
    const next = { ...sc, totals }
    void persist(next, `Số tập của bộ ${s.title}: ${n ?? 'tự đoán'}`)
    // chạy lại ngay với số mới
    setState((st) => ({ ...st, series: { status: 'idle', items: [] } }))
    setTimeout(() => runSource('series', { books, cfg: next }).then((it) => setState((st) => ({ ...st, series: { status: 'ok', items: it } }))), 0)
  }

  if (!sc) return <div className="card"><p className="muted">Đang tải gợi ý…</p></div>

  return (
    <div className="suggest">
      <section className="card">
        <h2>Gợi ý bổ sung</h2>
        <p className="muted">
          Những cuốn có thể thêm vào tủ, chọn dựa trên chính thư viện của bạn. Bấm “Muốn mua” để đưa vào danh sách muốn mua (bạn được xem lại trước khi lưu), hoặc bấm tên
          một trang để tìm mua sách cũ, sách mới.
        </p>
        <div className="sg-tabs" role="tablist">
          {SOURCES.map((x) => (
            <button key={x.id} role="tab" aria-selected={src === x.id} className={src === x.id ? 'on' : ''} onClick={() => setSrc(x.id)}>
              <b>{x.label}</b>
              <small>{x.desc}</small>
            </button>
          ))}
        </div>
      </section>

      {src === 'topic' && (
        <section className="card">
          <h3>Chủ đề của bạn</h3>
          <form
            className="sg-topic-form"
            onSubmit={(e) => {
              e.preventDefault()
              const t = topicText.trim()
              if (!t || sc.topics.includes(t)) return
              setTopicText('')
              const next = { ...sc, topics: [...sc.topics, t] }
              void load('topic', true, next)
              void persist(next, `Thêm chủ đề gợi ý: ${t}`)
            }}
          >
            <input value={topicText} onChange={(e) => setTopicText(e.target.value)} placeholder="Ví dụ: Phật giáo Nam tông, mỹ học Kant, lịch sử Nam Bộ…" />
            <button type="submit" disabled={!topicText.trim()}>
              Thêm
            </button>
          </form>
          {sc.topics.length > 0 && (
            <div className="chips">
              {sc.topics.map((t) => (
                <span key={t} className="chip static">
                  {t}{' '}
                  <button
                    className="chip-x"
                    aria-label={`Bỏ chủ đề ${t}`}
                    onClick={() => {
                      const next = { ...sc, topics: sc.topics.filter((x) => x !== t) }
                      void load('topic', true, next)
                      void persist(next, `Bỏ chủ đề gợi ý: ${t}`)
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="sg-head">
          <h3>
            {SOURCES.find((x) => x.id === src)!.label}
            {cur.status === 'ok' && <span className="muted small"> · {items.length} gợi ý</span>}
          </h3>
          {src !== 'series' && (
            <button className="link" onClick={() => void load(src, true)} disabled={cur.status === 'loading'}>
              Tải lại
            </button>
          )}
        </div>
        {groups.length > 1 && (
          <div className="chips sg-groups">
            <button className={`chip ${group === null ? 'on' : ''}`} onClick={() => setGroup(null)}>
              Tất cả
            </button>
            {groups.map((g) => (
              <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(g)}>
                {g} <small>{items.filter((x) => x.group === g).length}</small>
              </button>
            ))}
          </div>
        )}
        {msg && <p className="error small">{msg}</p>}
        {cur.status === 'loading' && <p className="muted">Đang tìm gợi ý… (lần đầu có thể mất vài giây)</p>}
        {cur.status === 'error' && <p className="error">{cur.error}</p>}
        {cur.status === 'ok' && !items.length && (
          <p className="muted">
            {src === 'series'
              ? 'Các bộ sách bạn có đều đủ tập (theo số tập app biết).'
              : src === 'topic' && !sc.topics.length
                ? 'Thêm một vài chủ đề ở trên để nhận gợi ý.'
                : 'Chưa tìm được gợi ý mới cho mục này.'}
          </p>
        )}
        <div className="sg-list">
          {shown.map((s) =>
            s.source === 'series' ? (
              <SeriesCard key={s.id} s={s} onWish={(v) => onWish(toDraft(s, v))} onDismiss={() => dismiss(s)} onTotal={(n) => setTotal(s, n)} />
            ) : (
              <Card key={s.id} s={s} onWish={() => onWish(toDraft(s))} onDismiss={() => dismiss(s)} />
            ),
          )}
        </div>
        {src === 'series' && (
          <p className="muted small">
            App nhận ra bộ sách qua nhan đề có chữ “Tập n” hoặc trường Tùng thư và số tập. Số tập đã biết sẵn: {Object.entries(KNOWN_TOTALS).length} bộ; bộ khác app tạm đoán theo tập lớn nhất bạn có, bấm
            “Sửa tổng số tập” để chỉnh.
          </p>
        )}
        {sc.dismissed.length > 0 && (
          <p className="muted small">
            Đã bỏ qua {sc.dismissed.length} gợi ý.{' '}
            <button className="linkish" onClick={() => void persist({ ...sc, dismissed: [] }, 'Hiện lại các gợi ý đã bỏ qua')}>
              Hiện lại tất cả
            </button>
          </p>
        )}
        <p className="muted small">Nguồn: Google Books, Wikidata và dữ liệu thư viện của bạn. Nút tìm Oreka, Vựa Sách Cũ, Sách Xưa tìm qua Google trong trang đó.</p>
      </section>
    </div>
  )
}
export { fmtRanges }
