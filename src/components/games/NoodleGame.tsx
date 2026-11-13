import { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  ALL_DECOR, BADGE_GOAL, basePrice, bowlsOf, cookMsOf, CUST, DECOR, judge, MAX_SHOWN, NAMES, nAsset, newOrder, newShop, parseShop, patienceMs, SEASONS,
  seasonAt, seatsOf, SHIFT_SECONDS, shopRank, spawnGap, SPICE_NAMES, stovesOf, TOP, TOPPINGS, UPGRADES,
  type CustKind, type Order, type SeasonId, type Shop, type TopId, type UpgradeId,
} from './noodle'

const LOCAL_KEY = 'pochacco-library:micay'
const CLOUD_FILE = 'micay' // config/micay.json trong repo dữ liệu
const CLOUD_DELAY = 20_000

type Cust = { id: number; kind: CustKind; name: string; order: Order; arrive: number; patience: number; stove: number | null }
type Stove = { cust: number | null; tops: TopId[]; spice: number; cookAt: number | null }
type Pop = { id: number; text: string; tone: 'good' | 'bad' | 'info'; at: number }
type Run = {
  t: number
  last: number
  nextSpawn: number
  custs: Cust[]
  stoves: Stove[]
  sel: number
  clean: number
  dirty: number
  washUntil: number | null
  served: number
  stars: number
  earned: number
  gems: number
  lost: number
  perfect: number
  lastServe: number
  pops: Pop[]
  seq: number
}

const loadLocal = (): Shop | null => {
  try {
    return parseShop(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'))
  } catch {
    return null
  }
}
const emptyStove = (): Stove => ({ cust: null, tops: [], spice: 0, cookAt: null })

/** Tiệm mì cay Pochacco: người chơi là chủ tiệm. */
export default function NoodleGame({ cfg }: { cfg: StoreConfig }) {
  const [shop, setShop] = useState<Shop>(() => loadLocal() ?? newShop())
  const [phase, setPhase] = useState<'menu' | 'play' | 'pause' | 'summary'>('menu')
  const [, setFrame] = useState(0)
  const [summary, setSummary] = useState<null | { served: number; earned: number; gems: number; lost: number; avg: number; best: boolean; badge?: SeasonId }>(null)
  const [askReset, setAskReset] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const shopRef = useRef(shop)
  shopRef.current = shop
  const run = useRef<Run | null>(null)
  const shaRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const season = seasonAt()

  // ---------- Lưu tiến trình ----------
  useEffect(() => {
    let cancelled = false
    readConfigFile<unknown>(cfg, CLOUD_FILE)
      .then((r) => {
        if (cancelled) return
        shaRef.current = r?.sha ?? null
        const remote = r ? parseShop(r.data) : null
        const local = loadLocal()
        if (remote && (!local || remote.savedAt > local.savedAt)) {
          setShop(remote)
          localStorage.setItem(LOCAL_KEY, JSON.stringify(remote))
        } else if (local && (!remote || local.savedAt > remote.savedAt)) dirtyRef.current = true
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [cfg])

  const pushCloud = useCallback(async () => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    const data = shopRef.current
    const message = `Tiệm mì cay: ngày ${data.day}, ${data.coins} xu`
    try {
      shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, data, shaRef.current, message)
    } catch {
      try {
        const r = await readConfigFile<unknown>(cfg, CLOUD_FILE)
        shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, shopRef.current, r?.sha ?? null, message)
      } catch {
        dirtyRef.current = true
      }
    }
  }, [cfg])
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => void pushCloud(), CLOUD_DELAY)
    return () => clearTimeout(t)
  }, [shop, loaded, pushCloud])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void pushCloud()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void pushCloud()
    }
  }, [pushCloud])

  const save = (fn: (s: Shop) => Shop) => {
    const next = { ...fn(shopRef.current), savedAt: Date.now() }
    shopRef.current = next
    setShop(next)
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    } catch {
      /* bỏ qua */
    }
    dirtyRef.current = true
  }
  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((x) => (x === m ? null : x)), 2600)
  }

  // ---------- Một ca bán ----------
  const pop = (r: Run, text: string, tone: Pop['tone'] = 'info') => {
    r.pops = [...r.pops.slice(-3), { id: r.seq++, text, tone, at: r.t }]
  }

  const startShift = () => {
    const s = shopRef.current
    run.current = {
      t: 0, last: performance.now(), nextSpawn: 600, custs: [], stoves: Array.from({ length: stovesOf(s) }, emptyStove), sel: 0,
      clean: bowlsOf(s), dirty: 0, washUntil: null, served: 0, stars: 0, earned: 0, gems: 0, lost: 0, perfect: 0, lastServe: -9999, pops: [], seq: 1,
    }
    setSummary(null)
    setPhase('play')
  }

  const endShift = () => {
    const r = run.current
    if (!r) return
    const s = shopRef.current
    const key = season.key
    const seasonCount = (s.seasonServed[key] ?? 0) + r.served
    const newBadge = seasonCount >= BADGE_GOAL && !s.badges.includes(season.def.id) ? season.def.id : undefined
    const best = r.earned > s.best
    save((x) => ({
      ...x,
      coins: x.coins + r.earned,
      gems: x.gems + r.gems + (newBadge ? 10 : 0),
      day: x.day + 1,
      best: Math.max(x.best, r.earned),
      served: x.served + r.served,
      perfect: x.perfect + r.perfect,
      earned: x.earned + r.earned,
      lost: x.lost + r.lost,
      seasonServed: { ...x.seasonServed, [key]: seasonCount },
      badges: newBadge ? [...x.badges, newBadge] : x.badges,
    }))
    setSummary({ served: r.served, earned: r.earned, gems: r.gems, lost: r.lost, avg: r.served ? r.stars / r.served : 0, best, badge: newBadge })
    setPhase('summary')
    run.current = null
    void pushCloud()
  }

  // Vòng lặp 10 lần/giây
  useEffect(() => {
    if (phase !== 'play') return
    const r = run.current
    if (!r) return
    r.last = performance.now()
    const s = shopRef.current
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(250, now - r.last)
      r.last = now
      r.t += dt
      if (r.t >= SHIFT_SECONDS * 1000) {
        window.clearInterval(id)
        endShift()
        return
      }
      // khách mới
      if (r.t >= r.nextSpawn && r.t < SHIFT_SECONDS * 1000 - 12_000) {
        if (r.custs.length < seatsOf(s)) {
          const kinds = Object.keys(CUST) as CustKind[]
          const order = newOrder(s)
          const kind: CustKind = order.takeaway ? 'aomua' : kinds[Math.floor(Math.random() * 2)]
          r.custs.push({ id: r.seq++, kind, name: NAMES[Math.floor(Math.random() * NAMES.length)], order, arrive: r.t, patience: patienceMs(s) * (order.takeaway ? 0.85 : 1), stove: null })
        }
        r.nextSpawn = r.t + spawnGap(s.day)
      }
      // khách hết kiên nhẫn
      r.custs = r.custs.filter((c) => {
        if (r.t - c.arrive < c.patience) return true
        r.lost++
        if (c.stove !== null) r.stoves[c.stove] = emptyStove()
        pop(r, `${c.name} chờ lâu quá nên bỏ về…`, 'bad')
        return false
      })
      // rửa bát
      if (r.washUntil !== null && r.t >= r.washUntil) {
        r.dirty--
        r.clean++
        r.washUntil = null
      }
      r.pops = r.pops.filter((p) => r.t - p.at < 2400)
      setFrame((f) => f + 1)
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Tạm dừng khi rời tab
  useEffect(() => {
    const onHide = () => document.hidden && setPhase((p) => (p === 'play' ? 'pause' : p))
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const act = (fn: (r: Run) => void) => {
    const r = run.current
    if (!r || phase !== 'play') return
    fn(r)
    setFrame((f) => f + 1)
  }
  const takeOrder = (cid: number) =>
    act((r) => {
      const c = r.custs.find((x) => x.id === cid)
      if (!c || c.stove !== null) return
      const free = r.stoves.findIndex((s) => s.cust === null)
      if (free < 0) return pop(r, 'Các bếp đều đang bận', 'bad')
      r.stoves[free] = { cust: cid, tops: [], spice: 0, cookAt: null }
      c.stove = free
      r.sel = free
    })
  const toggleTop = (t: TopId) =>
    act((r) => {
      const st = r.stoves[r.sel]
      if (!st || st.cust === null) return pop(r, 'Nhận một đơn trước đã')
      st.tops = st.tops.includes(t) ? st.tops.filter((x) => x !== t) : [...st.tops, t]
    })
  const setSpice = (i: number, n: number) =>
    act((r) => {
      if (r.stoves[i].cust !== null) r.stoves[i].spice = n
      r.sel = i
    })
  const cook = (i: number) =>
    act((r) => {
      const st = r.stoves[i]
      if (st.cust === null || st.cookAt !== null) return
      st.cookAt = r.t
      r.sel = i
    })
  const discard = (i: number) =>
    act((r) => {
      const st = r.stoves[i]
      const c = r.custs.find((x) => x.id === st.cust)
      if (c) c.stove = null
      r.stoves[i] = emptyStove()
      pop(r, 'Đổ nồi, nấu lại từ đầu')
    })
  const serve = (i: number) =>
    act((r) => {
      const st = r.stoves[i]
      const c = r.custs.find((x) => x.id === st.cust)
      if (!c || st.cookAt === null) return
      if (r.clean <= 0) return pop(r, 'Hết bát sạch, rửa bát đã!', 'bad')
      const s = shopRef.current
      const cooked = (r.t - st.cookAt) / cookMsOf(s)
      const j = judge(c.order, st.tops, st.spice, cooked)
      const base = basePrice(s, c.order)
      const left = Math.max(0, 1 - (r.t - c.arrive) / c.patience)
      const shown = s.shown.length
      const seasonal = s.shown.some((id) => id.startsWith(`${season.def.id}-`)) ? 0.1 : 0
      const pay = j.stars === 0 ? Math.round(base * 0.3) : base
      const tip = Math.round(base * [0, 0, 0.15, 0.4][j.stars] * (0.6 + 0.4 * left) * (1 + 0.03 * shown + seasonal))
      r.earned += pay + tip
      r.served++
      r.stars += j.stars
      if (j.stars === 3) {
        r.perfect++
        r.gems++
      }
      r.clean--
      r.dirty++
      r.lastServe = r.t
      r.custs = r.custs.filter((x) => x.id !== c.id)
      r.stoves[i] = emptyStove()
      const starText = j.stars ? '★'.repeat(j.stars) : 'Chê'
      pop(r, `${starText} ${c.name}: +${pay + tip} xu${tip ? ` (tiền boa ${tip})` : ''}${j.stars === 3 ? ' +1 💎' : ''}${j.notes.length ? ` · ${j.notes.join(', ')}` : ''}`, j.stars >= 2 ? 'good' : 'bad')
    })
  const wash = () =>
    act((r) => {
      if (r.washUntil !== null || r.dirty <= 0) return
      r.washUntil = r.t + 1300
    })

  // Phím tắt khi đang chơi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') setPhase((p) => (p === 'play' ? 'pause' : p === 'pause' ? 'play' : p))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- Quản lý tiệm ----------
  const buyUpgrade = (u: UpgradeId) => {
    const lv = shop.up[u]
    const cost = UPGRADES[u].cost[lv]
    if (cost === undefined || shop.coins < cost) return
    save((s) => ({ ...s, coins: s.coins - cost, up: { ...s.up, [u]: s.up[u] + 1 } }))
    flash(`Đã nâng cấp: ${UPGRADES[u].name}`)
  }
  const unlockTop = (t: TopId) => {
    const c = TOP[t].unlock
    if (shop.tops.includes(t) || shop.coins < c) return
    save((s) => ({ ...s, coins: s.coins - c, tops: [...s.tops, t] }))
    flash(`Thực đơn có thêm ${TOP[t].name}`)
  }
  const buyDecor = (id: string) => {
    const dd = DECOR[id]
    if (shop.decor.includes(id) || shop.gems < dd.gems) return
    save((s) => ({ ...s, gems: s.gems - dd.gems, decor: [...s.decor, id], shown: s.shown.length < MAX_SHOWN ? [...s.shown, id] : s.shown }))
    flash(`Đã mua ${dd.name}`)
  }
  const toggleShown = (id: string) => {
    if (shop.shown.includes(id)) return save((s) => ({ ...s, shown: s.shown.filter((x) => x !== id) }))
    if (shop.shown.length >= MAX_SHOWN) return flash(`Quầy chỉ bày được ${MAX_SHOWN} món, cất bớt một món trước nhé`)
    save((s) => ({ ...s, shown: [...s.shown, id] }))
  }

  // ---------- Hiển thị ----------
  const r = run.current
  const playing = phase === 'play' || phase === 'pause'
  const cookMs = cookMsOf(shop)
  const owner = r && r.t - r.lastServe < 1300 ? 'chu-bung' : r && r.stoves.some((s) => s.cookAt !== null) ? 'chu-nau' : phase === 'summary' ? 'chu-bung' : 'chu-dung'
  const shown = shop.shown.map((id) => DECOR[id]).filter(Boolean)
  const wide = shown.filter((x) => x.wide).slice(0, 2)
  const small = shown.filter((x) => !wide.includes(x))
  const leftSec = r ? Math.max(0, Math.ceil(SHIFT_SECONDS - r.t / 1000)) : SHIFT_SECONDS
  const seasonCount = shop.seasonServed[season.key] ?? 0

  return (
    <div className="noodle" style={{ ['--tint' as string]: season.def.tint }}>
      <div className="ns-hud">
        <span className="ns-chip">
          <img src={nAsset('coin')} alt="" /> <b>{(shop.coins + (r?.earned ?? 0)).toLocaleString('vi-VN')}</b> xu
        </span>
        <span className="ns-chip">
          <img src={nAsset('gem')} alt="" /> <b>{shop.gems + (r?.gems ?? 0)}</b>
        </span>
        <span className="ns-chip">Ngày {shop.day}</span>
        {playing && r && (
          <>
            <span className={`ns-chip ${leftSec <= 20 ? 'hot' : ''}`}>
              <img src={nAsset('clock')} alt="" /> {Math.floor(leftSec / 60)}:{String(leftSec % 60).padStart(2, '0')}
            </span>
            <span className="ns-chip">
              <img src={nAsset('bowl')} alt="" /> {r.served} tô
            </span>
            <button className="pg" onClick={() => setPhase(phase === 'play' ? 'pause' : 'play')} aria-label={phase === 'play' ? 'Tạm dừng' : 'Chơi tiếp'}>
              {phase === 'play' ? '❚❚' : '▶'}
            </button>
          </>
        )}
        {!playing && <span className="muted small">{shopRank(shop.served)}</span>}
      </div>

      <div className="ns-season">
        <img src={nAsset(`${season.def.id}-badge`)} alt="" />
        <span>
          <b>{season.def.name}</b>: {season.def.note} Bán {BADGE_GOAL} tô trong mùa để nhận {season.def.badge} ({Math.min(seasonCount, BADGE_GOAL)}/{BADGE_GOAL}).
        </span>
      </div>

      <div className="ns-scene">
        <div className="ns-stall">
          <img className="ns-stall-bg" src={nAsset('shop')} alt="Quầy mì cay của Pochacco" />
          <span className="ns-sign s-mid">Mì cay</span>
          <span className="ns-sign s-right">Pochacco</span>
          <img className={`ns-owner o-${owner}`} src={nAsset(owner)} alt="" />
          <img className="ns-stall-front" src={nAsset('shop')} alt="" aria-hidden="true" />
          {wide.map((x, i) => (
            <img key={x.id} className={`ns-decor wide w${i}`} src={nAsset(x.id)} alt={x.name} title={x.name} />
          ))}
          {small.map((x, i) => (
            <img key={x.id} className={`ns-decor sm s${i}`} src={nAsset(x.id)} alt={x.name} title={x.name} />
          ))}
        </div>
        <div className="ns-queue">
          {r && phase !== 'summary' ? (
            r.custs.length ? (
              r.custs.map((c) => {
                const left = Math.max(0, 1 - (r.t - c.arrive) / c.patience)
                return (
                  <div key={c.id} className={`ns-cust ${c.stove !== null ? 'taken' : ''}`}>
                    <div className="ns-bubble">
                      <div className="ns-want">
                        {c.order.tops.map((t) => (
                          <img key={t} src={nAsset(t)} alt={TOP[t].name} title={TOP[t].name} />
                        ))}
                      </div>
                      <div className="ns-spicewant" title={SPICE_NAMES[c.order.spice]}>
                        <img src={nAsset('spice')} alt="" /> cấp {c.order.spice}
                        {c.order.takeaway && <img className="ns-bag" src={nAsset('bag')} alt="Mang về" title="Mang về" />}
                      </div>
                      <div className={`ns-patience ${left < 0.3 ? 'low' : ''}`}>
                        <span style={{ width: `${left * 100}%` }} />
                      </div>
                      {c.stove === null ? (
                        <button className="small-btn" onClick={() => takeOrder(c.id)} disabled={phase !== 'play'}>
                          Nhận đơn
                        </button>
                      ) : (
                        <span className="ns-at">Bếp {c.stove + 1}</span>
                      )}
                    </div>
                    <img className="ns-cust-img" src={nAsset(CUST[c.kind].img)} alt="" />
                    <span className="ns-cust-name">{c.name}</span>
                  </div>
                )
              })
            ) : (
              <p className="ns-empty muted">Chưa có khách… Pochacco đang lau quầy chờ.</p>
            )
          ) : (
            <div className="ns-welcome">
              <img src={nAsset('hotpot')} alt="" />
            </div>
          )}
        </div>
        {r && (
          <div className="ns-pops" aria-live="polite">
            {r.pops.map((p) => (
              <div key={p.id} className={`ns-pop ${p.tone}`}>
                {p.text}
              </div>
            ))}
          </div>
        )}
        {phase === 'pause' && (
          <div className="ns-overlay">
            <h3>Tạm nghỉ</h3>
            <button onClick={() => setPhase('play')}>Bán tiếp</button>
          </div>
        )}
      </div>

      {playing && r && (
        <div className="ns-kitchen">
          <div className="ns-stoves">
            {r.stoves.map((st, i) => {
              const c = r.custs.find((x) => x.id === st.cust)
              const p = st.cookAt !== null ? (r.t - st.cookAt) / cookMs : 0
              return (
                <div key={i} className={`ns-stove ${r.sel === i ? 'sel' : ''} ${c ? '' : 'idle'}`} onClick={() => act((rr) => (rr.sel = i))}>
                  <div className="ns-stove-head">
                    <b>Bếp {i + 1}</b>
                    <span className="muted small">{c ? `đơn của ${c.name}` : 'trống, nhận một đơn để nấu'}</span>
                  </div>
                  {c && (
                    <>
                      <div className="ns-pot">
                        {st.tops.length ? st.tops.map((t) => <img key={t} src={nAsset(t)} alt={TOP[t].name} />) : <span className="muted small">Chạm topping bên dưới để bỏ vào nồi</span>}
                      </div>
                      <div className="ns-check">
                        {c.order.tops.map((t) => (
                          <span key={t} className={st.tops.includes(t) ? 'ok' : ''}>
                            {st.tops.includes(t) ? '✓' : '○'} {TOP[t].name}
                          </span>
                        ))}
                        {c.order.takeaway && <span className="bag">🛍️ mang về</span>}
                      </div>
                      <div className="ns-spice" role="radiogroup" aria-label="Cấp độ cay">
                        <img src={nAsset('ot')} alt="" />
                        {Array.from({ length: 8 }, (_, n) => (
                          <button key={n} role="radio" aria-checked={st.spice === n} className={`lvl l${n} ${st.spice === n ? 'on' : ''}`} onClick={(e) => (e.stopPropagation(), setSpice(i, n))} title={SPICE_NAMES[n]}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="ns-cook">
                        <div className={`ns-bar ${p > 1.08 ? 'over' : p >= 0.85 ? 'good' : ''}`}>
                          <span className="zone" style={{ left: `${(0.85 / 1.3) * 100}%`, width: `${((1.08 - 0.85) / 1.3) * 100}%` }} />
                          <span className="fill" style={{ width: `${Math.min(1, p / 1.3) * 100}%` }} />
                        </div>
                        <span className="ns-state small">{st.cookAt === null ? 'Chưa nấu' : p < 0.85 ? 'Đang sôi…' : p <= 1.08 ? 'Chín tới, múc ngay!' : p < 1.3 ? 'Sắp nhũn rồi!' : 'Mì nhũn mất rồi'}</span>
                      </div>
                      <div className="ns-actions">
                        {st.cookAt === null ? (
                          <button className="small-btn" onClick={(e) => (e.stopPropagation(), cook(i))}>
                            🔥 Bắt đầu nấu
                          </button>
                        ) : (
                          <button className="small-btn" onClick={(e) => (e.stopPropagation(), serve(i))}>
                            🥢 Múc ra và mang cho khách
                          </button>
                        )}
                        <button className="link" onClick={(e) => (e.stopPropagation(), discard(i))}>
                          Đổ nồi
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="ns-tray" aria-label="Khay topping">
            {TOPPINGS.filter((t) => shop.tops.includes(t.id)).map((t) => {
              const st = r.stoves[r.sel]
              const inPot = !!st?.tops.includes(t.id)
              return (
                <button key={t.id} className={`ns-top ${inPot ? 'in' : ''}`} onClick={() => toggleTop(t.id)} title={inPot ? `Vớt ${t.name} ra` : `Bỏ ${t.name} vào bếp ${r.sel + 1}`}>
                  <img src={nAsset(t.id)} alt="" />
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>
          <div className="ns-wash">
            <img src={nAsset('wash')} alt="" />
            <span>
              Bát sạch <b>{r.clean}</b> · bát bẩn <b>{r.dirty}</b>
            </span>
            <button className="secondary small-btn" disabled={r.dirty <= 0 || r.washUntil !== null} onClick={wash}>
              {r.washUntil !== null ? 'Đang rửa…' : 'Rửa một bát'}
            </button>
            {r.washUntil !== null && (
              <span className="ns-washbar">
                <span style={{ width: `${Math.min(1, 1 - (r.washUntil - r.t) / 1300) * 100}%` }} />
              </span>
            )}
          </div>
        </div>
      )}

      {phase === 'summary' && summary && (
        <div className="ns-summary">
          <img src={nAsset('chu-bung')} alt="" />
          <div>
            <h3>{summary.best ? 'Kỷ lục doanh thu mới!' : 'Đóng cửa, hết ca rồi!'}</h3>
            <p>
              Bán <b>{summary.served}</b> tô · thu <b>{summary.earned.toLocaleString('vi-VN')} xu</b> · <b>{summary.gems}</b> 💎 · trung bình {summary.avg.toFixed(1)} ★
              {summary.lost ? ` · ${summary.lost} khách bỏ về` : ''}
            </p>
            {summary.badge && (
              <p className="ns-badge-new">
                <img src={nAsset(`${summary.badge}-badge`)} alt="" /> Nhận {SEASONS[summary.badge].badge}! +10 💎
              </p>
            )}
          </div>
        </div>
      )}

      {(phase === 'menu' || phase === 'summary') && (
        <div className="ns-manage">
          <div className="ns-start">
            <button onClick={startShift}>{phase === 'summary' ? `Mở tiệm ngày ${shop.day}` : `Mở tiệm, bán ngày ${shop.day}`}</button>
            <span className="muted small">
              Một ca hai phút rưỡi: nhận đơn, bỏ đúng topping, chọn đúng cấp cay, canh mì chín tới rồi múc ra. Đừng quên rửa bát! Tô 3 sao được thêm 1 💎.
            </span>
          </div>

          <section>
            <h4>Nâng cấp tiệm</h4>
            <div className="ns-grid">
              {(Object.keys(UPGRADES) as UpgradeId[]).map((u) => {
                const def = UPGRADES[u]
                const lv = shop.up[u]
                const cost = def.cost[lv]
                return (
                  <div key={u} className="ns-card">
                    <img src={nAsset(def.icon)} alt="" />
                    <div>
                      <b>{def.name}</b> <span className="muted small">{lv}/{def.cost.length}</span>
                      <div className="muted small">{def.desc}</div>
                    </div>
                    <button className="small-btn" disabled={cost === undefined || shop.coins < cost} onClick={() => buyUpgrade(u)}>
                      {cost === undefined ? 'Tối đa' : `${cost.toLocaleString('vi-VN')} xu`}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h4>Thực đơn topping</h4>
            <div className="ns-tops">
              {TOPPINGS.map((t) => {
                const own = shop.tops.includes(t.id)
                return (
                  <div key={t.id} className={`ns-topcard ${own ? 'own' : ''}`}>
                    <img src={nAsset(t.id)} alt="" />
                    <b>{t.name}</b>
                    {own ? (
                      <span className="muted small">+{t.price} xu/tô</span>
                    ) : (
                      <button className="small-btn" disabled={shop.coins < t.unlock} onClick={() => unlockTop(t.id)}>
                        {t.unlock} xu
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h4>
              Đồ trang trí {season.def.name.toLowerCase()} <span className="muted small">(mua bằng 💎, chỉ bán trong mùa, giữ mãi)</span>
            </h4>
            <div className="ns-decor-shop">
              {season.def.decor.map((x) => {
                const own = shop.decor.includes(x.id)
                return (
                  <div key={x.id} className={`ns-decorcard ${own ? 'own' : ''}`}>
                    <img src={nAsset(x.id)} alt="" />
                    <b>{x.name}</b>
                    {own ? (
                      <button className={`small-btn ${shop.shown.includes(x.id) ? '' : 'secondary'}`} onClick={() => toggleShown(x.id)}>
                        {shop.shown.includes(x.id) ? 'Đang bày' : 'Bày ra'}
                      </button>
                    ) : (
                      <button className="small-btn" disabled={shop.gems < x.gems} onClick={() => buyDecor(x.id)}>
                        {x.gems} 💎
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {shop.decor.some((id) => !season.def.decor.some((x) => x.id === id)) && (
              <>
                <p className="muted small">Đồ của các mùa trước:</p>
                <div className="ns-decor-shop">
                  {ALL_DECOR.filter((x) => shop.decor.includes(x.id) && !season.def.decor.includes(x)).map((x) => (
                    <div key={x.id} className="ns-decorcard own">
                      <img src={nAsset(x.id)} alt="" />
                      <b>{x.name}</b>
                      <button className={`small-btn ${shop.shown.includes(x.id) ? '' : 'secondary'}`} onClick={() => toggleShown(x.id)}>
                        {shop.shown.includes(x.id) ? 'Đang bày' : 'Bày ra'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="muted small">
              Bày tối đa {MAX_SHOWN} món trên quầy ({shop.shown.length}/{MAX_SHOWN}). Mỗi món bày làm khách vui, tiền boa tăng 3%; bày đồ đúng mùa thì tiền boa tăng thêm 10%.
            </p>
          </section>

          <section>
            <h4>Huy hiệu theo mùa</h4>
            <div className="ns-badges">
              {Object.values(SEASONS).map((x) => (
                <div key={x.id} className={`ns-badge ${shop.badges.includes(x.id) ? 'own' : ''}`} title={x.badge}>
                  <img src={nAsset(`${x.id}-badge`)} alt="" />
                  <span>{x.name}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="muted small">
            {shopRank(shop.served)} · đã bán {shop.served.toLocaleString('vi-VN')} tô, {shop.perfect} tô 3 sao · tổng thu {shop.earned.toLocaleString('vi-VN')} xu · kỷ lục một ngày {shop.best.toLocaleString('vi-VN')} xu ·{' '}
            <button className="link" onClick={() => setAskReset(true)}>
              Làm lại từ đầu
            </button>
          </p>
        </div>
      )}

      {msg && (
        <div className="farm-toast" role="status">
          {msg}
        </div>
      )}
      {askReset && (
        <ConfirmDialog
          title="Đóng tiệm, làm lại từ đầu?"
          text="Toàn bộ xu, kim cương, nâng cấp, topping, đồ trang trí và huy hiệu sẽ mất."
          confirmLabel="Làm lại"
          cancelLabel="Giữ tiệm"
          danger
          onConfirm={() => {
            setAskReset(false)
            save(() => newShop())
          }}
          onCancel={() => setAskReset(false)}
        />
      )}
    </div>
  )
}
