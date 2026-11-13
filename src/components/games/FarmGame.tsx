import React, { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { Rich, Xu } from './money'
import {
  ACHIEVEMENTS, activeEvent, addItem, ALL_DECOR, ANIMALS, baitNow, CROP, CROPS, dailyReward, EXPAND, expandPlots, FERT_LEVEL, FERT_PACK, fmtLeft, has,
  hasGold, ITEM_ORDER, ITEMS, levelOf, needsText, newFarm, newOrder, nextUnlock, ORCHARD_LEVEL, parseFarm, POND_LEVEL, rollTier, STATIONS, takeItems,
  TIER_ICON, TIER_MUL, tiersOf, today, TRUCK_LEVEL, unlocksBetween, weatherOf, type AnimalKind, type CropId, type Farm, type ItemId, type Order,
} from './farm'
import { EventBanner, OrchardView, PondView, TruckView, WantList, WorkshopView, type Ctx } from './FarmExtra'

const asset = (n: string) => `${import.meta.env.BASE_URL}assets/${n}`
const LOCAL_KEY = 'pochacco-library:farm'
const CLOUD_FILE = 'farm' // config/farm.json trong repo dữ liệu
const CLOUD_DELAY = 45_000

type Sync = { state: 'idle' | 'saving' | 'saved' | 'error' | 'offline'; at?: number; msg?: string }

const loadLocal = (): Farm | null => {
  try {
    return parseFarm(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'))
  } catch {
    return null
  }
}

/**
 * Nông trại Pochacco: gieo hạt, tưới, thu hoạch, bán ở chợ, giao đơn hàng, lên cấp, mở rộng ruộng.
 * Tiến trình lưu ngay vào trình duyệt, và đồng bộ lên repo dữ liệu (config/farm.json) để chơi tiếp ở máy khác.
 */
export default function FarmGame({ cfg }: { cfg: StoreConfig }) {
  const [farm, setFarm] = useState<Farm>(() => loadLocal() ?? newFarm())
  const [seed, setSeed] = useState<CropId>('lua')
  const [now, setNow] = useState(Date.now())
  const [sync, setSync] = useState<Sync>({ state: 'idle' })
  const [toast, setToast] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [askReset, setAskReset] = useState(false)
  const [view, setView] = useState<'field' | 'orchard' | 'barn' | 'pond' | 'shop' | 'truck' | 'goals'>('field')
  const shaRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const farmRef = useRef(farm)
  farmRef.current = farm

  // Đồng hồ: cập nhật mỗi giây để thấy cây lớn
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Nạp bản trên repo; bản nào lưu sau thì dùng bản đó
  useEffect(() => {
    let cancelled = false
    readConfigFile<unknown>(cfg, CLOUD_FILE)
      .then((r) => {
        if (cancelled) return
        shaRef.current = r?.sha ?? null
        const remote = r ? parseFarm(r.data) : null
        const local = loadLocal()
        if (remote && (!local || remote.savedAt > local.savedAt)) {
          setFarm(remote)
          localStorage.setItem(LOCAL_KEY, JSON.stringify(remote))
          setSync({ state: 'saved', at: remote.savedAt, msg: 'Đã tải tiến trình từ kho dữ liệu' })
        } else if (local && (!remote || local.savedAt > remote.savedAt)) {
          dirtyRef.current = true // bản trên máy mới hơn: sẽ đẩy lên
          setSync({ state: 'idle' })
        } else setSync({ state: 'saved', at: remote?.savedAt })
      })
      .catch(() => !cancelled && setSync({ state: 'offline', msg: 'Chưa kết nối được kho dữ liệu, tiến trình vẫn lưu trên máy này' }))
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [cfg])

  const pushCloud = useCallback(async () => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    setSync({ state: 'saving' })
    const data = farmRef.current
    try {
      shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, data, shaRef.current, `Nông trại: cấp ${levelOf(data.xp).lv}, ${data.coins} xu`)
      setSync({ state: 'saved', at: Date.now() })
    } catch (e) {
      // sha cũ (lưu từ máy khác): đọc sha mới rồi thử lại một lần
      try {
        const r = await readConfigFile<unknown>(cfg, CLOUD_FILE)
        shaRef.current = r?.sha ?? null
        shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, farmRef.current, shaRef.current, `Nông trại: cấp ${levelOf(data.xp).lv}, ${data.coins} xu`)
        setSync({ state: 'saved', at: Date.now() })
      } catch {
        dirtyRef.current = true
        setSync({ state: 'error', msg: (e as Error).message })
      }
    }
  }, [cfg])

  // Lưu ngay trên máy; lên repo sau 45 giây yên lặng, hoặc khi rời trang
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => void pushCloud(), CLOUD_DELAY)
    return () => clearTimeout(t)
  }, [farm, loaded, pushCloud])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void pushCloud()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void pushCloud() // rời trang Trò chơi
    }
  }, [pushCloud])

  const toastTimer = useRef(0)
  const say = (m: string) => {
    setToast(m)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  /** Mọi thay đổi đi qua đây: lưu máy ngay, kiểm tra thành tựu, báo lên cấp. */
  const update = (fn: (f: Farm) => Farm, msg?: string) => {
    const before = farmRef.current
    let next = { ...fn(before), savedAt: Date.now() }
    const got = ACHIEVEMENTS.filter((a) => !next.achievements.includes(a.id) && a.test(next))
    if (got.length) next = { ...next, achievements: [...next.achievements, ...got.map((a) => a.id)], coins: next.coins + got.reduce((s, a) => s + a.reward, 0) }
    const lv0 = levelOf(before.xp).lv
    const lv1 = levelOf(next.xp).lv
    farmRef.current = next
    setFarm(next)
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    } catch {
      /* bỏ qua */
    }
    dirtyRef.current = true
    setSync((s) => (s.state === 'saved' ? { state: 'idle' } : s))
    const notes: string[] = []
    if (msg) notes.push(msg)
    if (lv1 > lv0) {
      const unlocked = unlocksBetween(lv0, lv1)
      notes.push(`Lên cấp ${lv1}!${unlocked.length ? ` Mở khóa ${unlocked.join(', ')}` : ''}`)
    }
    for (const a of got) notes.push(`Thành tựu ${a.icon} ${a.name} (+{xu:${a.reward}})`)
    if (notes.length) say(notes.join(' · '))
  }

  const lvl = levelOf(farm.xp)
  const weather = weatherOf(today(now))
  const ev = activeEvent(now)
  const priceOf = (id: ItemId, tier = 0) => Math.round(ITEMS[id].sell * TIER_MUL[tier] * (1 + weather.sellBonus))

  // ---------- Ruộng ----------
  const plantAt = (f: Farm, idx: number[], crop: CropId): Farm => {
    const c = CROP[crop]
    const plots = [...f.plots]
    const t = Date.now()
    const rain = weather.id === 'mua'
    const total = c.minutes * 60_000
    let fert = levelOf(f.xp).lv >= FERT_LEVEL && f.useFert ? f.fert : 0
    const used = Math.min(fert, idx.length)
    for (const i of idx) {
      plots[i] = { crop, plantedAt: t, readyAt: t + (rain ? Math.round(total * 0.75) : total), watered: rain, fert: fert > 0 }
      if (fert > 0) fert--
    }
    return { ...f, plots, fert: f.fert - used, coins: f.coins - idx.length * c.seed, planted: f.planted.includes(crop) ? f.planted : [...f.planted, crop] }
  }

  const clickPlot = (i: number) => {
    const p = farm.plots[i]
    if (!p) {
      const c = CROP[seed]
      if (c.event && c.event !== ev?.id) return say(`Hạt ${c.name} chỉ có trong sự kiện`)
      if (farm.coins < c.seed) return say(`Không đủ xu mua hạt ${c.name} ({xu:${c.seed}})`)
      return update((f) => plantAt(f, [i], seed))
    }
    if (now >= p.readyAt) return harvest([i])
    if (!p.watered) {
      update((f) => {
        const plots = [...f.plots]
        const cur = plots[i]!
        // Tưới: rút ngắn 25% thời gian còn lại
        plots[i] = { ...cur, watered: true, readyAt: cur.readyAt - Math.round((cur.readyAt - Date.now()) * 0.25) }
        return { ...f, plots }
      }, 'Đã tưới 💧 cây lớn nhanh hơn')
    } else say(`${CROP[p.crop].name} còn ${fmtLeft(p.readyAt - now)} nữa mới chín`)
  }

  const harvest = (idx: number[]) => {
    const ready = idx.filter((i) => farm.plots[i] && now >= farm.plots[i]!.readyAt)
    if (!ready.length) return
    const got: Partial<Record<CropId, number>> = {}
    for (const i of ready) got[farm.plots[i]!.crop] = (got[farm.plots[i]!.crop] ?? 0) + 1
    const tiers = ready.map((i) => rollTier(!!farm.plots[i]!.fert))
    const nGold = tiers.filter((t) => t === 2).length
    const nSilver = tiers.filter((t) => t === 1).length
    const xpMul = 1 + (ev?.harvestXp ?? 0)
    update(
      (f) => {
        const plots = [...f.plots]
        let store = { inv: f.inv, q: f.q }
        let x = 0
        ready.forEach((i, k) => {
          const c = CROP[plots[i]!.crop]
          store = addItem(store, c.id, 1, tiers[k])
          x += c.xp
          plots[i] = null
        })
        return { ...f, plots, ...store, xp: f.xp + Math.round(x * xpMul), stats: { ...f.stats, harvested: f.stats.harvested + ready.length, gold: f.stats.gold + nGold } }
      },
      `Thu hoạch ${Object.entries(got).map(([k, n]) => `${n} ${CROP[k as CropId].icon}`).join(' ')}${nSilver ? ` · ${nSilver} 🥈` : ''}${nGold ? ` · ${nGold} 🥇` : ''}${xpMul > 1 ? ' · KN mùa gặt +50%' : ''}`,
    )
  }

  const plantAll = () => {
    const c = CROP[seed]
    if (c.event && c.event !== ev?.id) return say(`Hạt ${c.name} chỉ có trong sự kiện`)
    const empty = farm.plots.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
    const n = Math.min(empty.length, Math.floor(farm.coins / c.seed))
    if (!n) return say(empty.length ? `Không đủ xu mua hạt ${c.name}` : 'Không còn ô trống')
    const fertN = lvl.lv >= FERT_LEVEL && farm.useFert ? Math.min(farm.fert, n) : 0
    update((f) => plantAt(f, empty.slice(0, n), seed), `Gieo ${n} ô ${c.icon} ${c.name}${fertN ? `, bón phân ${fertN} ô` : ''}${weather.id === 'mua' ? ' (mưa tưới sẵn)' : ''}`)
  }

  const waterAll = () => {
    const idx = farm.plots.map((p, i) => (p && !p.watered && now < p.readyAt ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) return say('Không có cây nào cần tưới')
    update((f) => {
      const plots = [...f.plots]
      const t = Date.now()
      for (const i of idx) plots[i] = { ...plots[i]!, watered: true, readyAt: plots[i]!.readyAt - Math.round((plots[i]!.readyAt - t) * 0.25) }
      return { ...f, plots }
    }, `Đã tưới ${idx.length} ô 💧`)
  }

  const expand = () => {
    const to = (farm.size + 1) as 4 | 5
    const e = EXPAND[to]
    if (lvl.lv < e.level || farm.coins < e.cost) return
    update((f) => ({ ...f, size: to, coins: f.coins - e.cost, plots: expandPlots(f.plots, f.size, to) }), `Ruộng mở rộng thành ${to}×${to}!`)
  }

  const buyFert = () => {
    if (farm.coins < FERT_PACK.cost) return say(`Cần {xu:${FERT_PACK.cost}}`)
    update((f) => ({ ...f, coins: f.coins - FERT_PACK.cost, fert: f.fert + FERT_PACK.n }), `Mua ${FERT_PACK.n} túi phân bón 🧪`)
  }

  // ---------- Chuồng ----------
  const buyAnimal = (k: AnimalKind) => {
    const a = ANIMALS[k]
    if (lvl.lv < a.level || farm.coins < a.cost || farm.animals.filter((x) => x.kind === k).length >= a.max) return
    update((f) => ({ ...f, coins: f.coins - a.cost, animals: [...f.animals, { kind: k, readyAt: null, fedAt: null }] }), `Chào mừng ${a.icon} ${a.name} về nông trại!`)
  }
  const feed = (idx: number[]) => {
    let store = { inv: farm.inv, q: farm.q }
    const ok: number[] = []
    for (const i of idx) {
      const an = farm.animals[i]
      if (!an || an.readyAt) continue
      const d = ANIMALS[an.kind]
      if (!has(store.inv, d.eats)) continue
      store = takeItems(store, d.eats)
      ok.push(i)
    }
    if (!ok.length) return say(`Thiếu thức ăn: ${[...new Set(idx.map((i) => farm.animals[i]?.kind).filter(Boolean))].map((k) => `${ANIMALS[k as AnimalKind].icon} ăn ${needsText(ANIMALS[k as AnimalKind].eats)}`).join(', ')}`)
    update((f) => {
      const t = Date.now()
      const animals = f.animals.map((an, i) => (ok.includes(i) ? { ...an, fedAt: t, readyAt: t + ANIMALS[an.kind].minutes * 60_000 } : an))
      return { ...f, ...store, animals }
    }, `Đã cho ${ok.length} con ăn`)
  }
  const collect = (idx: number[]) => {
    const ready = idx.filter((i) => farm.animals[i]?.readyAt && now >= farm.animals[i].readyAt!)
    if (!ready.length) return
    const bonus = weather.id === 'gio' ? 2 : 1
    update((f) => {
      const inv = { ...f.inv }
      let x = 0
      const animals = f.animals.map((an, i) => {
        if (!ready.includes(i)) return an
        const d = ANIMALS[an.kind]
        inv[d.gives] = (inv[d.gives] ?? 0) + 1
        x += d.xp * bonus
        return { ...an, readyAt: null, fedAt: null }
      })
      return { ...f, inv, animals, xp: f.xp + x, stats: { ...f.stats, collected: f.stats.collected + ready.length } }
    }, `Nhặt ${ready.map((i) => ITEMS[ANIMALS[farm.animals[i].kind].gives].icon).join(' ')}`)
  }

  // ---------- Chợ, đơn hàng, điểm danh ----------
  /** Bán: hàng thường trước rồi tới bạc, vàng. */
  const sell = (id: ItemId, n: number) => {
    const t = tiersOf(farm, id)
    const k = Math.min(n, t.all)
    if (!k) return
    let rest = k
    let money = 0
    for (const [tier, have] of [[0, t.normal], [1, t.silver], [2, t.gold]] as const) {
      const m = Math.min(rest, have)
      money += m * priceOf(id, tier)
      rest -= m
    }
    update((f) => ({ ...f, ...takeItems(f, { [id]: k }), coins: f.coins + money, stats: { ...f.stats, earned: f.stats.earned + money } }), `Bán ${k} ${ITEMS[id].icon} được {xu:${money}}`)
  }
  const canDeliver = (o: Order) => has(farm.inv, o.want) && hasGold(farm, o.gold)
  const deliver = (o: Order) => {
    if (!canDeliver(o)) return
    update(
      (f) => ({
        ...f,
        ...takeItems(f, o.want, o.gold),
        orders: f.orders.map((x) => (x.id === o.id ? newOrder(f.xp + o.xp, ev?.id ?? null) : x)),
        coins: f.coins + o.coins,
        xp: f.xp + o.xp,
        stats: { ...f.stats, delivered: f.stats.delivered + 1, earned: f.stats.earned + o.coins },
      }),
      `${o.who} cảm ơn! +{xu:${o.coins}}, +${o.xp} kinh nghiệm`,
    )
  }
  const skipOrder = (o: Order) => update((f) => ({ ...f, orders: f.orders.map((x) => (x.id === o.id ? newOrder(f.xp, ev?.id ?? null) : x)) }))

  const day = today(now)
  const yesterday = today(now - 86_400_000)
  const canClaim = farm.daily.last !== day
  const nextStreak = farm.daily.last === yesterday ? farm.daily.streak + 1 : 1
  const claim = () => {
    if (!canClaim) return
    const r = dailyReward(nextStreak)
    update((f) => ({ ...f, coins: f.coins + r.coins, xp: f.xp + r.xp, daily: { last: day, streak: nextStreak } }), `Điểm danh ngày thứ ${nextStreak}: +{xu:${r.coins}}, +${r.xp} KN`)
  }

  const reset = () => {
    setAskReset(false)
    update(() => newFarm(), 'Bắt đầu nông trại mới')
  }

  // ---------- Hiển thị ----------
  const ripe = farm.plots.map((p, i) => (p && now >= p.readyAt ? i : -1)).filter((i) => i >= 0)
  const growing = farm.plots.filter((p) => p && now < p.readyAt).length
  const animalsReady = farm.animals.map((a, i) => (a.readyAt && now >= a.readyAt ? i : -1)).filter((i) => i >= 0)
  const animalsHungry = farm.animals.map((a, i) => (!a.readyAt ? i : -1)).filter((i) => i >= 0)
  const allSlots = [...farm.slots, ...farm.mill, ...farm.loom]
  const ovenReady = allSlots.filter((s) => s && now >= s.readyAt).length
  const treesReady = farm.trees.filter((t) => t && now >= t.readyAt).length
  const trucksBack = farm.trucks.filter((t) => t && now >= t.backAt).length
  const busy =
    growing + farm.animals.filter((a) => a.readyAt && now < a.readyAt).length + allSlots.filter((s) => s && now < s.readyAt).length +
    farm.trees.filter((t) => t && now < t.readyAt).length + farm.trucks.filter((t) => t && now < t.backAt).length
  const anyReady = ripe.length + animalsReady.length + ovenReady + treesReady + trucksBack
  const bait = baitNow(farm.bait, now)
  const nu = nextUnlock(lvl.lv)
  const ctx: Ctx = { farm, now, lv: lvl.lv, ev, weather, update, say }
  const idle = !anyReady && !busy
  const next = farm.plots.reduce<number | null>((m, p) => (p && now < p.readyAt && (m === null || p.readyAt < m) ? p.readyAt : m), null)
  const invList = ITEM_ORDER.filter((id) => (farm.inv[id] ?? 0) > 0)
  const nextSize = farm.size < 5 ? ((farm.size + 1) as 4 | 5) : null
  const barnOpen = lvl.lv >= ANIMALS.ga.level
  const lockAt = (l: number) => (lvl.lv >= l ? undefined : l)

  const tabs: { id: typeof view; label: string; badge: number; locked?: number }[] = [
    { id: 'field', label: '🌱 Ruộng', badge: ripe.length },
    { id: 'orchard', label: '🌳 Vườn', badge: treesReady, locked: lockAt(ORCHARD_LEVEL) },
    { id: 'barn', label: '🐔 Chuồng', badge: animalsReady.length, locked: barnOpen ? undefined : ANIMALS.ga.level },
    { id: 'pond', label: '🎣 Ao cá', badge: lvl.lv >= POND_LEVEL ? bait.n : 0, locked: lockAt(POND_LEVEL) },
    { id: 'shop', label: '🏭 Xưởng', badge: ovenReady, locked: lockAt(STATIONS.lo.level) },
    { id: 'truck', label: '🚚 Xe hàng', badge: trucksBack, locked: lockAt(TRUCK_LEVEL) },
    { id: 'goals', label: '🏆 Thành tựu', badge: 0 },
  ]

  return (
    <div className="farm">
      <div className="farm-top">
        <div className="farm-pochacco" aria-hidden="true">
          <img src={asset(idle ? 'anim-sleepy.webp' : anyReady ? 'anim-carry.webp' : 'anim-walk.webp')} alt="" className={idle ? 'round' : ''} />
        </div>
        <div className="farm-stats">
          <div className="farm-line">
            <span className="coins">
              <Xu n={farm.coins} />
            </span>
            <span className="lv">Cấp {lvl.lv}</span>
            {farm.decor.length > 0 && (
              <span className="decor-strip" title={ALL_DECOR.filter((d) => farm.decor.includes(d.id)).map((d) => d.name).join(', ')}>
                {ALL_DECOR.filter((d) => farm.decor.includes(d.id)).map((d) => d.icon).join('')}
              </span>
            )}
            <span className="weather" title={weather.note}>
              {weather.icon} {weather.name}
            </span>
          </div>
          <div className="xpbar" title={`${lvl.into}/${lvl.need} kinh nghiệm`}>
            <div style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
          </div>
          <div className="muted small">
            {idle
              ? 'Nông trại đang nghỉ, Pochacco ngủ gật rồi. Gieo hạt thôi!'
              : anyReady
                ? `Sẵn sàng: ${[ripe.length && `${ripe.length} ô ruộng`, treesReady && `${treesReady} cây ăn quả`, animalsReady.length && `${animalsReady.length} con trong chuồng`, ovenReady && `${ovenReady} món ở xưởng`, trucksBack && `${trucksBack} xe đã về`].filter(Boolean).join(', ')}`
                : `Ô ruộng gần chín nhất còn ${fmtLeft((next ?? now) - now)}`}
            {' · '}
            {weather.note}
          </div>
          {nu && (
            <div className="muted small next-unlock">
              Cấp {nu.level} mở: {nu.items.join(', ')}
            </div>
          )}
        </div>
        <div className={`farm-sync s-${sync.state}`} title={sync.msg}>
          {sync.state === 'saving'
            ? 'Đang lưu…'
            : sync.state === 'saved'
              ? `Đã lưu ${sync.at ? new Date(sync.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}`
              : sync.state === 'error'
                ? 'Chưa lưu lên kho được'
                : sync.state === 'offline'
                  ? 'Đang lưu trên máy'
                  : 'Đã lưu trên máy'}
          {(sync.state === 'idle' || sync.state === 'error' || sync.state === 'offline') && (
            <button className="link" onClick={() => { dirtyRef.current = true; void pushCloud() }}>
              Lưu lên kho
            </button>
          )}
        </div>
      </div>

      {canClaim && (
        <div className="daily">
          <span>
            📅 Điểm danh hôm nay {nextStreak > 1 ? `(chuỗi ${nextStreak} ngày)` : ''}: <b><Xu n={dailyReward(nextStreak).coins} sign="+" /></b>, +{dailyReward(nextStreak).xp} KN
          </span>
          <button className="small-btn" onClick={claim}>
            Nhận quà
          </button>
        </div>
      )}

      <EventBanner {...ctx} />

      <div className="farm-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} className={`farm-tab ${view === t.id ? 'on' : ''}`} disabled={!!t.locked} onClick={() => setView(t.id)} title={t.locked ? `Mở ở cấp ${t.locked}` : undefined}>
            {t.label}
            {t.locked ? <span className="lock"> 🔒{t.locked}</span> : t.badge > 0 && <span className="badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {view === 'field' && (
        <>
          <div className="seed-bar" role="radiogroup" aria-label="Hạt giống">
            {CROPS.filter((c) => !c.event || c.event === ev?.id).map((c) => {
              const locked = c.level > lvl.lv
              return (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={seed === c.id}
                  disabled={locked}
                  className={`seed ${seed === c.id ? 'on' : ''} ${c.event ? 'event' : ''}`}
                  onClick={() => setSeed(c.id)}
                  title={locked ? `Mở ở cấp ${c.level}` : `${c.name}: hạt ${c.seed} xu, bán ${c.sell} xu, chín sau ${fmtLeft(c.minutes * 60_000)}`}
                >
                  <span className="si">{locked ? '🔒' : c.icon}</span>
                  <span className="sn">{c.name}</span>
                  <span className="sp">{locked ? `cấp ${c.level}` : <><Xu n={c.seed} /> · {fmtLeft(c.minutes * 60_000)}</>}</span>
                </button>
              )
            })}
          </div>
          <div className="farm-actions">
            <button className="secondary small-btn" onClick={plantAll}>
              Gieo hết ô trống ({CROP[seed].icon})
            </button>
            <button className="secondary small-btn" onClick={waterAll}>
              Tưới tất cả 💧
            </button>
            <button className="small-btn" disabled={!ripe.length} onClick={() => harvest(ripe)}>
              Thu hoạch tất cả{ripe.length ? ` (${ripe.length})` : ''}
            </button>
          </div>
          {lvl.lv >= FERT_LEVEL ? (
            <div className="fert-bar">
              <span>
                🧪 Phân bón: <b>{farm.fert}</b> túi
              </span>
              <label className="fert-toggle">
                <input type="checkbox" checked={farm.useFert} onChange={(e) => update((f) => ({ ...f, useFert: e.target.checked }))} /> Bón khi gieo
              </label>
              <button className="secondary small-btn" disabled={farm.coins < FERT_PACK.cost} onClick={buyFert}>
                Mua {FERT_PACK.n} túi (<Xu n={FERT_PACK.cost} />)
              </button>
              <span className="muted small">Ô có bón phân ra hàng 🥈 bạc hoặc 🥇 vàng nhiều hơn, bán giá ×1,25 và ×1,6.</span>
            </div>
          ) : (
            <p className="muted small">🔒 Phân bón và hàng có sao mở ở cấp {FERT_LEVEL}.</p>
          )}
          <div className={`field ${weather.id === 'mua' ? 'rainy' : ''}`} style={{ gridTemplateColumns: `repeat(${farm.size}, 1fr)`, '--n': farm.size, maxWidth: 140 * farm.size + 40 } as React.CSSProperties}>
            {farm.plots.map((p, i) => {
              if (!p)
                return (
                  <button key={i} className="plot empty" onClick={() => clickPlot(i)} aria-label={`Ô ${i + 1}: trống, gieo ${CROP[seed].name}`}>
                    <span className="hint-seed">+{CROP[seed].icon}</span>
                  </button>
                )
              const c = CROP[p.crop]
              const ratio = Math.min(1, (now - p.plantedAt) / (p.readyAt - p.plantedAt))
              const done = now >= p.readyAt
              return (
                <button
                  key={i}
                  className={`plot ${done ? 'ripe' : 'growing'} ${p.watered ? 'wet' : ''}`}
                  onClick={() => clickPlot(i)}
                  aria-label={`Ô ${i + 1}: ${c.name}, ${done ? 'đã chín' : `còn ${fmtLeft(p.readyAt - now)}`}`}
                >
                  <span className="crop" style={{ fontSize: done ? undefined : `${0.9 + ratio * 0.9}em` }}>
                    {done ? c.icon : ratio < 0.33 ? '🌱' : ratio < 0.75 ? '🌿' : c.icon}
                  </span>
                  {!done && (
                    <span className="grow">
                      <span style={{ width: `${ratio * 100}%` }} />
                    </span>
                  )}
                  {!done && <span className="left">{fmtLeft(p.readyAt - now)}</span>}
                  {!done && !p.watered && <span className="need-water" title="Chạm để tưới">💧</span>}
                  {p.fert && <span className="fert-mark" title="Đã bón phân">🧪</span>}
                </button>
              )
            })}
          </div>
          {nextSize && (
            <div className="expand">
              <span>
                Mở rộng ruộng {nextSize}×{nextSize}: <Xu n={EXPAND[nextSize].cost} />, từ cấp {EXPAND[nextSize].level}
              </span>
              <button className="small-btn" disabled={lvl.lv < EXPAND[nextSize].level || farm.coins < EXPAND[nextSize].cost} onClick={expand}>
                Mở rộng
              </button>
            </div>
          )}
        </>
      )}

      {view === 'barn' && (
        <section className="barn">
          <div className="farm-actions">
            <button className="secondary small-btn" disabled={!animalsHungry.length} onClick={() => feed(animalsHungry)}>
              Cho cả chuồng ăn
            </button>
            <button className="small-btn" disabled={!animalsReady.length} onClick={() => collect(animalsReady)}>
              Nhặt tất cả{animalsReady.length ? ` (${animalsReady.length})` : ''}
            </button>
          </div>
          {farm.animals.length === 0 && <p className="muted">Chuồng còn trống. Mua gà để có trứng, mua bò để có sữa, nguyên liệu cho xưởng và các đơn hàng giá cao.</p>}
          <div className="pens">
            {farm.animals.map((an, i) => {
              const d = ANIMALS[an.kind]
              const ready = an.readyAt && now >= an.readyAt
              const ratio = an.readyAt && an.fedAt ? Math.min(1, (now - an.fedAt) / (an.readyAt - an.fedAt)) : 0
              return (
                <button key={i} className={`pen ${ready ? 'ready' : an.readyAt ? 'busy' : 'hungry'}`} onClick={() => (ready ? collect([i]) : !an.readyAt ? feed([i]) : say(`${d.name} còn ${fmtLeft(an.readyAt - now)}`))}>
                  <span className="pen-icon">{d.icon}</span>
                  {ready ? (
                    <span className="pen-out">{ITEMS[d.gives].icon}</span>
                  ) : an.readyAt ? (
                    <>
                      <span className="grow">
                        <span style={{ width: `${ratio * 100}%` }} />
                      </span>
                      <span className="pen-note">{fmtLeft(an.readyAt - now)}</span>
                    </>
                  ) : (
                    <span className="pen-note">Đói: {needsText(d.eats)}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="shop">
            {Object.values(ANIMALS).map((a) => {
              const count = farm.animals.filter((x) => x.kind === a.kind).length
              const locked = lvl.lv < a.level
              return (
                <div key={a.kind} className="shop-item">
                  <span className="si">{a.icon}</span>
                  <div>
                    <b>{a.name}</b> ({count}/{a.max})
                    <div className="muted small">
                      Ăn {needsText(a.eats)}, sau {fmtLeft(a.minutes * 60_000)} cho {ITEMS[a.gives].icon} {ITEMS[a.gives].name}
                    </div>
                  </div>
                  <button className="small-btn" disabled={locked || count >= a.max || farm.coins < a.cost} onClick={() => buyAnimal(a.kind)}>
                    {locked ? `Cấp ${a.level}` : count >= a.max ? 'Đủ chuồng' : <>Mua <Xu n={a.cost} /></>}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {view === 'orchard' && <OrchardView {...ctx} />}
      {view === 'pond' && <PondView {...ctx} />}
      {view === 'shop' && <WorkshopView {...ctx} />}
      {view === 'truck' && <TruckView {...ctx} />}

      {view === 'goals' && (
        <section className="goals">
          <p className="muted small">
            {farm.achievements.length}/{ACHIEVEMENTS.length} thành tựu · chuỗi điểm danh {farm.daily.streak} ngày
          </p>
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => {
              const done = farm.achievements.includes(a.id)
              return (
                <div key={a.id} className={`ach ${done ? 'done' : ''}`}>
                  <span className="ai">{done ? a.icon : '❔'}</span>
                  <b>{a.name}</b>
                  <span className="muted small">{a.desc}</span>
                  <span className="ar">{done ? 'Đã đạt' : <Xu n={a.reward} sign="+" />}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {toast && (
        <div className="farm-toast" role="status">
          <Rich text={toast} />
        </div>
      )}

      <div className="farm-panels">
        <section className="farm-panel">
          <h3>Đơn hàng</h3>
          {farm.orders.map((o) => {
            const ok = canDeliver(o)
            return (
              <div key={o.id} className={`order ${ok ? 'ready' : ''}`}>
                <div className="order-who">
                  {o.who}
                  {o.event && <span className="ev-tag">sự kiện</span>}
                  {o.gold && <span className="gold-tag">cần hàng 🥇</span>}
                </div>
                <div className="order-want">
                  <WantList farm={farm} want={o.want} gold={o.gold} />
                </div>
                <div className="order-reward">
                  <Xu n={o.coins} sign="+" /> · +{o.xp} KN
                </div>
                <div className="order-btns">
                  <button className="small-btn" disabled={!ok} onClick={() => deliver(o)}>
                    Giao
                  </button>
                  <button className="link" onClick={() => skipOrder(o)} title="Đổi đơn khác">
                    Đổi
                  </button>
                </div>
              </div>
            )
          })}
        </section>

        <section className="farm-panel">
          <h3>Kho và chợ {weather.sellBonus > 0 && <span className="bonus">giá +{Math.round(weather.sellBonus * 100)}% hôm nay</span>}</h3>
          {invList.length === 0 ? (
            <p className="muted small">Kho trống. Thu hoạch, nhặt trứng sữa hay làm bánh xong, mọi thứ sẽ nằm ở đây để bán hoặc giao đơn.</p>
          ) : (
            <ul className="inv">
              {invList.map((id) => {
                const t = tiersOf(farm, id)
                return (
                <li key={id}>
                  <span className="ii">{ITEMS[id].icon}</span>
                  <span className="in">
                    {ITEMS[id].name} × {farm.inv[id]}
                    {(t.silver > 0 || t.gold > 0) && (
                      <small className="tiers">
                        {t.silver > 0 && ` ${TIER_ICON[1]}${t.silver}`}
                        {t.gold > 0 && ` ${TIER_ICON[2]}${t.gold}`}
                      </small>
                    )}
                  </span>
                  <span className="muted small"><Xu n={priceOf(id)} />/cái</span>
                  <button className="link" onClick={() => sell(id, 1)}>
                    Bán 1
                  </button>
                  <button className="link" onClick={() => sell(id, farm.inv[id] ?? 0)}>
                    Bán hết
                  </button>
                </li>
                )
              })}
            </ul>
          )}
          <p className="muted small farm-meta">
            Thu hoạch {farm.stats.harvested.toLocaleString('vi-VN')} lần · hái {farm.stats.fruits} quả · nhặt {farm.stats.collected} · câu {farm.stats.fished} cá · làm {farm.stats.crafted} món · giao {farm.stats.delivered} đơn, {farm.stats.trips} chuyến xe · {farm.stats.gold} hàng 🥇 · kiếm <Xu n={farm.stats.earned} /> ·{' '}
            <button className="link" onClick={() => setAskReset(true)}>
              Làm lại từ đầu
            </button>
          </p>
        </section>
      </div>
      {askReset && (
        <ConfirmDialog
          title="Làm lại nông trại từ đầu?"
          text="Toàn bộ xu, cấp, kho, chuồng trại, vườn, xưởng, xe hàng, đồ trang trí, thành tựu và cây đang trồng sẽ mất."
          confirmLabel="Làm lại"
          cancelLabel="Giữ nông trại"
          danger
          onConfirm={reset}
          onCancel={() => setAskReset(false)}
        />
      )}
    </div>
  )
}
