import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  addItem, baitNow, BAIT_MAX, BAIT_MIN, FISH, fmtLeft, has, hasGold, ITEMS, needsText, newBigOrder, ORCHARD_LEVEL, POND_LEVEL, RECIPE, RECIPES,
  STATIONS, takeItems, tiersOf, TREE_SLOT_COST, TREES, TRUCK2_LEVEL, TRUCK_LEVEL,
  type ActiveEvent, type Farm, type FishId, type GoodId, type ItemId, type Order, type Slot, type Station, type TreeKind, type Weather,
} from './farm'

export type Ctx = {
  farm: Farm
  now: number
  lv: number
  ev: ActiveEvent | null
  weather: Weather
  update: (fn: (f: Farm) => Farm, msg?: string) => void
  say: (m: string) => void
}

const SLOT_KEY: Record<Station, 'slots' | 'mill' | 'loom'> = { lo: 'slots', xay: 'mill', det: 'loom' }

/** Danh sách món cần, kèm số đã có và yêu cầu sao vàng. */
export function WantList({ farm, want, gold }: { farm: Farm; want: Order['want']; gold?: Order['gold'] }) {
  return (
    <>
      {Object.entries(want).map(([k, n]) => {
        const id = k as ItemId
        const have = farm.inv[id] ?? 0
        const g = gold?.[id] ?? 0
        const ok = have >= (n ?? 0) && tiersOf(farm, id).gold >= g
        return (
          <span key={k} className={ok ? 'enough' : ''} title={`${ITEMS[id].name}${g ? `, trong đó ${g} hàng sao vàng` : ''}`}>
            {ITEMS[id].icon} {Math.min(have, n ?? 0)}/{n}
            {g > 0 && <small className="gold-need"> 🥇{Math.min(g, tiersOf(farm, id).gold)}/{g}</small>}
          </span>
        )
      })}
    </>
  )
}

// ================= Xưởng: lò bánh, máy xay, khung dệt =================
export function WorkshopView({ farm, now, lv, ev, update, say }: Ctx) {
  const stations = (Object.keys(STATIONS) as Station[])
  const make = (st: Station, slot: number, id: GoodId) => {
    const r = RECIPE[id]
    const key = SLOT_KEY[st]
    if (farm[key][slot] || lv < r.level || !has(farm.inv, r.needs)) return
    update((f) => {
      const arr = [...f[key]]
      arr[slot] = { recipe: id, readyAt: Date.now() + r.minutes * 60_000 }
      return { ...f, ...takeItems(f, r.needs), [key]: arr }
    }, `${STATIONS[st].icon} Đang làm ${r.icon} ${r.name}`)
  }
  const takeOut = (st: Station, idx: number[]) => {
    const key = SLOT_KEY[st]
    const ready = idx.filter((i) => farm[key][i] && now >= farm[key][i]!.readyAt)
    if (!ready.length) return
    update((f) => {
      let store = { inv: f.inv, q: f.q }
      let x = 0
      const arr = f[key].map((s, i) => {
        if (!ready.includes(i) || !s) return s
        const r = RECIPE[s.recipe]
        store = addItem(store, r.id, 1)
        x += r.xp
        return null
      })
      return {
        ...f, ...store, [key]: arr, xp: f.xp + x,
        stats: { ...f.stats, crafted: f.stats.crafted + ready.length, woven: f.stats.woven + (st === 'det' ? ready.length : 0) },
      }
    }, `Xong ${ready.map((i) => RECIPE[farm[key][i]!.recipe].icon).join(' ')}`)
  }
  const buySlot = (st: Station) => {
    const key = SLOT_KEY[st]
    const cost = STATIONS[st].slotCost[farm[key].length]
    if (cost === undefined || farm.coins < cost) return
    update((f) => ({ ...f, coins: f.coins - cost, [key]: [...f[key], null] }), `${STATIONS[st].name} có thêm một ô`)
  }

  return (
    <section className="workshop">
      {stations.map((st) => {
        const def = STATIONS[st]
        if (lv < def.level)
          return (
            <p key={st} className="station-locked muted">
              🔒 {def.icon} {def.name} mở ở cấp {def.level}
            </p>
          )
        const slots: Slot[] = farm[SLOT_KEY[st]]
        const ready = slots.map((s, i) => (s && now >= s.readyAt ? i : -1)).filter((i) => i >= 0)
        const cost = def.slotCost[slots.length]
        const recipes = RECIPES.filter((r) => r.station === st && (!r.event || r.event === ev?.id))
        return (
          <div key={st} className="station">
            <div className="station-head">
              <h4>
                {def.icon} {def.name}
              </h4>
              <button className="small-btn" disabled={!ready.length} onClick={() => takeOut(st, ready)}>
                Lấy hết{ready.length ? ` (${ready.length})` : ''}
              </button>
              {cost !== undefined && (
                <button className="secondary small-btn" disabled={farm.coins < cost} onClick={() => buySlot(st)}>
                  Thêm ô ({cost.toLocaleString('vi-VN')} xu)
                </button>
              )}
            </div>
            <div className="ovens">
              {slots.map((s, i) =>
                s ? (
                  <button key={i} className={`oven st-${st} ${now >= s.readyAt ? 'ready' : 'busy'}`} onClick={() => (now >= s.readyAt ? takeOut(st, [i]) : say(`${RECIPE[s.recipe].name} còn ${fmtLeft(s.readyAt - now)}`))}>
                    <span className="oven-icon">{RECIPE[s.recipe].icon}</span>
                    <span className="pen-note">{now >= s.readyAt ? 'Xong! Chạm để lấy' : fmtLeft(s.readyAt - now)}</span>
                  </button>
                ) : (
                  <div key={i} className="oven empty">
                    <span className="pen-note">Ô trống: chọn món bên dưới</span>
                  </div>
                ),
              )}
            </div>
            <div className="recipes">
              {recipes.map((r) => {
                const locked = lv < r.level
                const free = slots.findIndex((x) => !x)
                const enough = has(farm.inv, r.needs)
                return (
                  <div key={r.id} className={`recipe ${locked ? 'locked' : ''} ${r.event ? 'event' : ''}`}>
                    <span className="si">{locked ? '🔒' : r.icon}</span>
                    <div>
                      <b>{r.name}</b>
                      {r.event && <span className="ev-tag">sự kiện</span>}
                      <div className="muted small">
                        {needsText(r.needs)} · {fmtLeft(r.minutes * 60_000)} · bán {r.sell.toLocaleString('vi-VN')} xu
                      </div>
                    </div>
                    <button className="small-btn" disabled={locked || free < 0 || !enough} onClick={() => make(st, free, r.id)}>
                      {locked ? `Cấp ${r.level}` : free < 0 ? 'Đang bận' : enough ? 'Làm' : 'Thiếu'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// ================= Vườn cây ăn quả =================
export function OrchardView({ farm, now, lv, update, say }: Ctx) {
  const [pick, setPick] = useState<TreeKind>('xoai')
  const [cut, setCut] = useState<number | null>(null)
  if (lv < ORCHARD_LEVEL) return <p className="muted">🔒 Vườn cây ăn quả mở ở cấp {ORCHARD_LEVEL}.</p>
  const plant = (i: number) => {
    const t = TREES[pick]
    if (lv < t.level) return say(`Cây ${t.name} mở ở cấp ${t.level}`)
    if (farm.coins < t.cost) return say(`Cần ${t.cost} xu để trồng cây ${t.name}`)
    update((f) => {
      const trees = [...f.trees]
      const n = Date.now()
      trees[i] = { kind: t.kind, plantedAt: n, since: n, readyAt: n + t.first * 60_000, picks: 0 }
      return { ...f, coins: f.coins - t.cost, trees }
    }, `Trồng cây ${t.name} 🌱 lứa đầu sau ${fmtLeft(t.first * 60_000)}`)
  }
  const harvest = (idx: number[]) => {
    const ready = idx.filter((i) => farm.trees[i] && now >= farm.trees[i]!.readyAt)
    if (!ready.length) return
    let gotGold = 0
    update((f) => {
      let store = { inv: f.inv, q: f.q }
      let x = 0
      let n = 0
      const t0 = Date.now()
      const trees = f.trees.map((tr, i) => {
        if (!tr || !ready.includes(i)) return tr
        const d = TREES[tr.kind]
        for (let k = 0; k < d.yield; k++) {
          const r = Math.random()
          const tier = r < 0.08 ? 2 : r < 0.3 ? 1 : 0
          if (tier === 2) gotGold++
          store = addItem(store, d.kind, 1, tier)
        }
        x += d.xp * d.yield
        n += d.yield
        return { ...tr, since: t0, readyAt: t0 + d.cycle * 60_000, picks: tr.picks + 1 }
      })
      return { ...f, ...store, trees, xp: f.xp + x, stats: { ...f.stats, fruits: f.stats.fruits + n, gold: f.stats.gold + gotGold } }
    }, `Hái ${ready.map((i) => `${TREES[farm.trees[i]!.kind].yield} ${TREES[farm.trees[i]!.kind].icon}`).join(' ')}`)
  }
  const buySlot = () => {
    const cost = TREE_SLOT_COST[farm.trees.length]
    if (cost === undefined || farm.coins < cost) return
    update((f) => ({ ...f, coins: f.coins - cost, trees: [...f.trees, null] }), 'Vườn có thêm một chỗ trồng cây')
  }
  const ready = farm.trees.map((t, i) => (t && now >= t.readyAt ? i : -1)).filter((i) => i >= 0)
  const slotCost = TREE_SLOT_COST[farm.trees.length]
  return (
    <section className="orchard">
      <div className="seed-bar" role="radiogroup" aria-label="Giống cây ăn quả">
        {Object.values(TREES).map((t) => {
          const locked = lv < t.level
          return (
            <button key={t.kind} role="radio" aria-checked={pick === t.kind} disabled={locked} className={`seed ${pick === t.kind ? 'on' : ''}`} onClick={() => setPick(t.kind)}>
              <span className="si">{locked ? '🔒' : t.icon}</span>
              <span className="sn">Cây {t.name}</span>
              <span className="sp">{locked ? `cấp ${t.level}` : `${t.cost} xu · ${t.yield} quả mỗi ${fmtLeft(t.cycle * 60_000)}`}</span>
            </button>
          )
        })}
      </div>
      <div className="farm-actions">
        <button className="small-btn" disabled={!ready.length} onClick={() => harvest(ready)}>
          Hái tất cả{ready.length ? ` (${ready.length})` : ''}
        </button>
        {slotCost !== undefined && (
          <button className="secondary small-btn" disabled={farm.coins < slotCost} onClick={buySlot}>
            Thêm chỗ trồng ({slotCost.toLocaleString('vi-VN')} xu)
          </button>
        )}
      </div>
      <div className="trees">
        {farm.trees.map((t, i) => {
          if (!t)
            return (
              <button key={i} className="tree empty" onClick={() => plant(i)}>
                <span className="tree-icon">🕳️</span>
                <span className="pen-note">
                  Trồng cây {TREES[pick].name} ({TREES[pick].cost} xu)
                </span>
              </button>
            )
          const d = TREES[t.kind]
          const done = now >= t.readyAt
          const ratio = Math.min(1, (now - t.since) / (t.readyAt - t.since))
          const young = t.picks === 0 && !done
          return (
            <div key={i} className={`tree ${done ? 'ready' : ''}`}>
              <button className="tree-main" onClick={() => (done ? harvest([i]) : say(`Cây ${d.name} còn ${fmtLeft(t.readyAt - now)} nữa ra quả`))}>
                <span className="tree-icon">{young && ratio < 0.5 ? '🌱' : young ? '🌿' : d.tree}</span>
                {done && <span className="tree-fruits">{d.icon.repeat(Math.min(3, d.yield))}</span>}
                <b>Cây {d.name}</b>
                {done ? (
                  <span className="pen-note">Chín rồi! Chạm để hái</span>
                ) : (
                  <>
                    <span className="grow">
                      <span style={{ width: `${ratio * 100}%` }} />
                    </span>
                    <span className="pen-note">
                      {young ? 'Lứa đầu' : 'Lứa tới'} sau {fmtLeft(t.readyAt - now)}
                    </span>
                  </>
                )}
              </button>
              <span className="tree-meta muted small">
                Đã hái {t.picks} lứa ·{' '}
                <button className="link" onClick={() => setCut(i)}>
                  chặt
                </button>
              </span>
            </div>
          )
        })}
      </div>
      <p className="muted small">Cây ăn quả trồng một lần, hái mãi. Mỗi lứa có thể ra quả hạng bạc 🥈 hoặc vàng 🥇, bán giá cao hơn.</p>
      {cut !== null && farm.trees[cut] && (
        <ConfirmDialog
          title={`Chặt cây ${TREES[farm.trees[cut]!.kind].name}?`}
          text="Chỗ trồng sẽ trống để trồng cây khác. Không hoàn lại tiền mua cây."
          confirmLabel="Chặt cây"
          cancelLabel="Giữ lại"
          danger
          onConfirm={() => {
            const i = cut
            setCut(null)
            update((f) => ({ ...f, trees: f.trees.map((x, j) => (j === i ? null : x)) }), 'Đã chặt cây')
          }}
          onCancel={() => setCut(null)}
        />
      )}
    </section>
  )
}

// ================= Ao cá: trò canh thời điểm =================
type Bite = { fish: FishId; speed: number; center: number; good: number; perfect: number; start: number }
export function PondView({ farm, now, lv, weather, update, say }: Ctx) {
  const [phase, setPhase] = useState<'idle' | 'wait' | 'bite'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const biteRef = useRef<Bite | null>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const timer = useRef(0)
  const bait = baitNow(farm.bait, now)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Kim chạy qua lại trên thanh khi cá cắn
  useEffect(() => {
    if (phase !== 'bite') return
    let raf = 0
    const tick = (t: number) => {
      const b = biteRef.current
      if (!b) return
      const el = (t - b.start) / 1000
      const p = (el * b.speed) % 2
      posRef.current = p < 1 ? p : 2 - p
      if (markRef.current) markRef.current.style.left = `${posRef.current * 100}%`
      if (el > 4) {
        biteRef.current = null
        setPhase('idle')
        setMsg('Cá giật mồi chạy mất rồi…')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const cast = () => {
    if (phase !== 'idle') return
    const b = baitNow(farm.bait)
    if (b.n < 1) return say(`Hết mồi rồi, mồi mới sau ${fmtLeft(b.nextIn)}`)
    update((f) => {
      const c = baitNow(f.bait)
      return { ...f, bait: { n: c.n - 1, at: c.n >= BAIT_MAX ? Date.now() : c.at } }
    })
    setMsg(null)
    setPhase('wait')
    const rain = weather.id === 'mua'
    const wait = (rain ? 700 : 1200) + Math.random() * (rain ? 1200 : 2200)
    timer.current = window.setTimeout(() => {
      const chep = Math.random() < (rain ? 0.35 : 0.25)
      biteRef.current = {
        fish: chep ? 'cachep' : 'ca',
        speed: chep ? 1.5 : 0.95,
        center: 0.25 + Math.random() * 0.5,
        good: chep ? 0.09 : 0.13,
        perfect: 0.035,
        start: performance.now(),
      }
      setPhase('bite')
    }, wait)
  }

  const strike = () => {
    if (phase === 'wait') {
      window.clearTimeout(timer.current)
      setPhase('idle')
      setMsg('Giật sớm quá, cá chưa cắn câu!')
      return
    }
    const b = biteRef.current
    if (phase !== 'bite' || !b) return
    biteRef.current = null
    setPhase('idle')
    const off = Math.abs(posRef.current - b.center)
    if (off > b.good) {
      setMsg(`Hụt mất ${FISH[b.fish].icon}! Lần sau canh lúc kim vào vùng xanh.`)
      return
    }
    const perfect = off <= b.perfect
    const d = FISH[b.fish]
    setMsg(`${perfect ? 'Tuyệt đỉnh! ' : ''}Câu được ${d.icon} ${d.name}${perfect ? ' hạng vàng 🥇' : ''}`)
    update((f) => ({
      ...f,
      ...addItem(f, b.fish, 1, perfect ? 2 : 0),
      xp: f.xp + d.xp * (perfect ? 2 : 1),
      stats: { ...f.stats, fished: f.stats.fished + 1, gold: f.stats.gold + (perfect ? 1 : 0) },
    }))
  }

  // Phím Space để thả câu hoặc giật
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lv < POND_LEVEL || e.key !== ' ' || (e.target as HTMLElement)?.closest('input, textarea, button')) return
      e.preventDefault()
      if (phase === 'idle') cast()
      else strike()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (lv < POND_LEVEL) return <p className="muted">🔒 Ao cá mở ở cấp {POND_LEVEL}.</p>
  const b = biteRef.current
  return (
    <section className="pond-wrap">
      <div className="pond-info">
        <span>
          🪱 Mồi: <b>{bait.n}</b>/{BAIT_MAX}
        </span>
        <span className="muted small">{bait.n < BAIT_MAX ? `mồi mới sau ${fmtLeft(bait.nextIn)}` : `hồi 1 mồi mỗi ${BAIT_MIN} phút`}</span>
        {weather.id === 'mua' && <span className="muted small">🌧️ Trời mưa, cá cắn nhanh hơn</span>}
      </div>
      <button className={`pond ${phase}`} onClick={() => (phase === 'idle' ? cast() : strike())} aria-label={phase === 'idle' ? 'Thả câu' : 'Giật cần'}>
        <span className="pond-fish f1">🐟</span>
        <span className="pond-fish f2">🐠</span>
        <span className="pond-fish f3">🐟</span>
        {phase !== 'idle' && <span className={`bobber ${phase === 'bite' ? 'pull' : ''}`}>🔴</span>}
        <span className="pond-label">{phase === 'idle' ? 'Chạm để thả câu' : phase === 'wait' ? 'Chờ cá cắn câu…' : 'Cá cắn rồi! Giật đúng lúc!'}</span>
      </button>
      {phase === 'bite' && b && (
        <div className="reel">
          <div className="reel-bar">
            <span className="zone good" style={{ left: `${(b.center - b.good) * 100}%`, width: `${b.good * 200}%` }} />
            <span className="zone perfect" style={{ left: `${(b.center - b.perfect) * 100}%`, width: `${b.perfect * 200}%` }} />
            <div className="needle" ref={markRef} />
          </div>
          <button className="reel-btn" onClick={strike}>
            Giật cần!
          </button>
        </div>
      )}
      {msg && <p className="pond-msg">{msg}</p>}
      <p className="muted small">
        Thả câu, chờ phao chìm, rồi bấm Giật khi kim nằm trong vùng xanh. Trúng vùng vàng ở giữa được cá hạng vàng 🥇 và gấp đôi kinh nghiệm. Cá chép 🐠 hiếm và lanh hơn cá rô 🐟. Phím Space cũng dùng được.
      </p>
      <p className="muted small">Đã câu {farm.stats.fished} con.</p>
    </section>
  )
}

// ================= Xe giao hàng =================
export function TruckView({ farm, now, lv, update }: Ctx) {
  const need = lv >= TRUCK2_LEVEL ? 2 : 1
  useEffect(() => {
    if (lv >= TRUCK_LEVEL && (!farm.bigOrder || farm.trucks.length < need))
      update((f) => ({ ...f, bigOrder: f.bigOrder ?? newBigOrder(f.xp), trucks: f.trucks.length < need ? [...f.trucks, ...Array(need - f.trucks.length).fill(null)] : f.trucks }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv, farm.bigOrder, farm.trucks.length])
  if (lv < TRUCK_LEVEL) return <p className="muted">🔒 Xe giao hàng mở ở cấp {TRUCK_LEVEL}.</p>
  const o = farm.bigOrder
  const free = farm.trucks.findIndex((t) => !t)
  const ok = !!o && has(farm.inv, o.want) && hasGold(farm, o.gold)
  const send = () => {
    if (!o || !ok || free < 0) return
    update((f) => {
      const trucks = [...f.trucks]
      const t = Date.now()
      trucks[free] = { order: o, leftAt: t, backAt: t + (o.hours ?? 2) * 3_600_000 }
      return { ...f, ...takeItems(f, o.want, o.gold), trucks, bigOrder: newBigOrder(f.xp) }
    }, `🚚 Xe đã lên đường, về sau ${o.hours} giờ`)
  }
  const cash = (i: number) => {
    const tr = farm.trucks[i]
    if (!tr || now < tr.backAt) return
    update(
      (f) => ({
        ...f,
        trucks: f.trucks.map((x, j) => (j === i ? null : x)),
        coins: f.coins + tr.order.coins,
        xp: f.xp + tr.order.xp,
        stats: { ...f.stats, trips: f.stats.trips + 1, earned: f.stats.earned + tr.order.coins },
      }),
      `Xe về! +${tr.order.coins.toLocaleString('vi-VN')} xu, +${tr.order.xp} KN`,
    )
  }
  return (
    <section className="trucks-view">
      <div className="trucks">
        {farm.trucks.map((tr, i) => {
          if (!tr)
            return (
              <div key={i} className="truck idle">
                <span className="truck-icon">🚚</span>
                <span className="pen-note">Xe {i + 1} đang đợi hàng</span>
              </div>
            )
          const back = now >= tr.backAt
          const ratio = Math.min(1, (now - tr.leftAt) / (tr.backAt - tr.leftAt))
          return (
            <button key={i} className={`truck ${back ? 'ready' : 'away'}`} onClick={() => cash(i)} disabled={!back}>
              <span className="truck-road">
                <span className="truck-icon" style={{ left: `${(ratio < 0.5 ? ratio * 2 : 2 - ratio * 2) * 80}%` }}>
                  {ratio < 0.5 ? '🚚' : '🛻'}
                </span>
              </span>
              {back ? (
                <span className="pen-note">Xe về rồi! Nhận {tr.order.coins.toLocaleString('vi-VN')} xu</span>
              ) : (
                <span className="pen-note">
                  {ratio < 0.5 ? 'Đang chở hàng đi' : 'Đang trên đường về'} · còn {fmtLeft(tr.backAt - now)}
                </span>
              )}
            </button>
          )
        })}
        {need < 2 && (
          <div className="truck locked">
            <span className="truck-icon">🔒</span>
            <span className="pen-note">Xe thứ hai mở ở cấp {TRUCK2_LEVEL}</span>
          </div>
        )}
      </div>
      {o && (
        <div className={`order big ${ok ? 'ready' : ''}`}>
          <div className="order-who">📦 {o.who}</div>
          <div className="order-want">
            <WantList farm={farm} want={o.want} gold={o.gold} />
          </div>
          <div className="order-reward">
            +{o.coins.toLocaleString('vi-VN')} xu · +{o.xp} KN · xe đi về {o.hours} giờ
          </div>
          <div className="order-btns">
            <button className="small-btn" disabled={!ok || free < 0} onClick={send}>
              {free < 0 ? 'Xe đang bận' : 'Chất lên xe'}
            </button>
            <button className="link" onClick={() => update((f) => ({ ...f, bigOrder: newBigOrder(f.xp) }))}>
              Đổi đơn
            </button>
          </div>
        </div>
      )}
      <p className="muted small">Đơn chở bằng xe lớn gấp ba đơn thường nhưng thưởng gấp đôi. Xe đi càng xa càng lâu về; đóng trang vẫn chạy.</p>
    </section>
  )
}

// ================= Sự kiện theo mùa =================
export function EventBanner({ farm, now, ev, update }: Ctx) {
  const [open, setOpen] = useState(false)
  if (!ev) return null
  const days = Math.max(1, Math.ceil((ev.end - now) / 86_400_000))
  const buy = (id: string) => {
    const d = ev.decor.find((x) => x.id === id)!
    if (farm.decor.includes(id) || farm.coins < d.cost) return
    update((f) => ({ ...f, coins: f.coins - d.cost, decor: [...f.decor, id] }), `Trang trí ${d.icon} ${d.name}`)
  }
  return (
    <div className={`event-banner ev-${ev.id}`}>
      <div className="event-line">
        <span className="ev-icon">{ev.icon}</span>
        <span>
          <b>{ev.name}</b> đang diễn ra, còn {days} ngày. {ev.blurb}
        </span>
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? 'Thu gọn' : 'Đồ trang trí'}
        </button>
      </div>
      {open && (
        <div className="event-decor">
          {ev.decor.map((d) => {
            const own = farm.decor.includes(d.id)
            return (
              <div key={d.id} className="shop-item">
                <span className="si">{d.icon}</span>
                <div>
                  <b>{d.name}</b>
                  <div className="muted small">Trang trí giữ mãi sau sự kiện</div>
                </div>
                <button className="small-btn" disabled={own || farm.coins < d.cost} onClick={() => buy(d.id)}>
                  {own ? 'Đã có' : `${d.cost} xu`}
                </button>
              </div>
            )
          })}
          <p className="muted small">
            Món sự kiện: {RECIPE[ev.recipe].icon} {RECIPE[ev.recipe].name} ({needsText(RECIPE[ev.recipe].needs)}), làm ở lò bánh. Đơn hàng sự kiện thưởng cao hơn đơn thường.
          </p>
        </div>
      )}
    </div>
  )
}
