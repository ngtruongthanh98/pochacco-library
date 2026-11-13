import React, { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  ACHIEVEMENTS, ANIMALS, CROP, CROPS, dailyReward, EXPAND, expandPlots, fmtLeft, has, ITEM_ORDER, ITEMS, levelOf, needsText, newFarm, newOrder,
  parseFarm, RECIPE, RECIPES, SLOT_COST, take, today, weatherOf, type AnimalKind, type CropId, type Farm, type GoodId, type ItemId, type Order,
} from './farm'

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
  const [view, setView] = useState<'field' | 'barn' | 'bakery' | 'goals'>('field')
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
      const unlocked = [
        ...CROPS.filter((c) => c.level > lv0 && c.level <= lv1).map((c) => `${c.icon} ${c.name}`),
        ...Object.values(ANIMALS).filter((a) => a.level > lv0 && a.level <= lv1).map((a) => `${a.icon} ${a.name}`),
        ...RECIPES.filter((r) => r.level > lv0 && r.level <= lv1).map((r) => `${r.icon} ${r.name}`),
      ]
      notes.push(`Lên cấp ${lv1}!${unlocked.length ? ` Mở khóa ${unlocked.join(', ')}` : ''}`)
    }
    for (const a of got) notes.push(`Thành tựu ${a.icon} ${a.name} (+${a.reward} xu)`)
    if (notes.length) say(notes.join(' · '))
  }

  const lvl = levelOf(farm.xp)
  const weather = weatherOf(today(now))
  const priceOf = (id: ItemId) => Math.round(ITEMS[id].sell * (1 + weather.sellBonus))

  // ---------- Ruộng ----------
  const plantAt = (f: Farm, idx: number[], crop: CropId): Farm => {
    const c = CROP[crop]
    const plots = [...f.plots]
    const t = Date.now()
    const rain = weather.id === 'mua'
    const total = c.minutes * 60_000
    for (const i of idx) plots[i] = { crop, plantedAt: t, readyAt: t + (rain ? Math.round(total * 0.75) : total), watered: rain }
    return { ...f, plots, coins: f.coins - idx.length * c.seed, planted: f.planted.includes(crop) ? f.planted : [...f.planted, crop] }
  }

  const clickPlot = (i: number) => {
    const p = farm.plots[i]
    if (!p) {
      const c = CROP[seed]
      if (farm.coins < c.seed) return say(`Không đủ xu mua hạt ${c.name} (${c.seed} xu)`)
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
    update(
      (f) => {
        const plots = [...f.plots]
        const inv = { ...f.inv }
        let x = 0
        for (const i of ready) {
          const c = CROP[plots[i]!.crop]
          inv[c.id] = (inv[c.id] ?? 0) + 1
          x += c.xp
          plots[i] = null
        }
        return { ...f, plots, inv, xp: f.xp + x, stats: { ...f.stats, harvested: f.stats.harvested + ready.length } }
      },
      `Thu hoạch ${Object.entries(got).map(([k, n]) => `${n} ${CROP[k as CropId].icon}`).join(' ')}`,
    )
  }

  const plantAll = () => {
    const c = CROP[seed]
    const empty = farm.plots.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
    const n = Math.min(empty.length, Math.floor(farm.coins / c.seed))
    if (!n) return say(empty.length ? `Không đủ xu mua hạt ${c.name}` : 'Không còn ô trống')
    update((f) => plantAt(f, empty.slice(0, n), seed), `Gieo ${n} ô ${c.icon} ${c.name}${weather.id === 'mua' ? ' (mưa tưới sẵn)' : ''}`)
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

  // ---------- Chuồng ----------
  const buyAnimal = (k: AnimalKind) => {
    const a = ANIMALS[k]
    if (lvl.lv < a.level || farm.coins < a.cost || farm.animals.filter((x) => x.kind === k).length >= a.max) return
    update((f) => ({ ...f, coins: f.coins - a.cost, animals: [...f.animals, { kind: k, readyAt: null, fedAt: null }] }), `Chào mừng ${a.icon} ${a.name} về nông trại!`)
  }
  const feed = (idx: number[]) => {
    let inv = { ...farm.inv }
    const ok: number[] = []
    for (const i of idx) {
      const an = farm.animals[i]
      if (!an || an.readyAt) continue
      const d = ANIMALS[an.kind]
      if (!has(inv, d.eats)) continue
      inv = take(inv, d.eats)
      ok.push(i)
    }
    if (!ok.length) return say('Thiếu thức ăn: gà ăn 1 🌾, bò ăn 2 🌽')
    update((f) => {
      const t = Date.now()
      const animals = f.animals.map((an, i) => (ok.includes(i) ? { ...an, fedAt: t, readyAt: t + ANIMALS[an.kind].minutes * 60_000 } : an))
      return { ...f, inv, animals }
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

  // ---------- Lò bánh ----------
  const bake = (slot: number, id: GoodId) => {
    const r = RECIPE[id]
    if (farm.slots[slot] || lvl.lv < r.level || !has(farm.inv, r.needs)) return
    update((f) => {
      const slots = [...f.slots]
      slots[slot] = { recipe: id, readyAt: Date.now() + r.minutes * 60_000 }
      return { ...f, inv: take(f.inv, r.needs), slots }
    }, `Đang làm ${r.icon} ${r.name}`)
  }
  const takeOut = (idx: number[]) => {
    const ready = idx.filter((i) => farm.slots[i] && now >= farm.slots[i]!.readyAt)
    if (!ready.length) return
    update((f) => {
      const inv = { ...f.inv }
      let x = 0
      const slots = f.slots.map((s, i) => {
        if (!ready.includes(i) || !s) return s
        const r = RECIPE[s.recipe]
        inv[r.id] = (inv[r.id] ?? 0) + 1
        x += r.xp
        return null
      })
      return { ...f, inv, slots, xp: f.xp + x, stats: { ...f.stats, crafted: f.stats.crafted + ready.length } }
    }, `Ra lò ${ready.map((i) => RECIPE[farm.slots[i]!.recipe].icon).join(' ')}`)
  }
  const buySlot = () => {
    const cost = SLOT_COST[farm.slots.length]
    if (cost === undefined || farm.coins < cost) return
    update((f) => ({ ...f, coins: f.coins - cost, slots: [...f.slots, null] }), 'Lò bánh có thêm một ô nướng')
  }

  // ---------- Chợ, đơn hàng, điểm danh ----------
  const sell = (id: ItemId, n: number) => {
    const have = farm.inv[id] ?? 0
    const k = Math.min(n, have)
    if (!k) return
    const price = priceOf(id)
    update((f) => ({ ...f, coins: f.coins + price * k, inv: { ...f.inv, [id]: have - k }, stats: { ...f.stats, earned: f.stats.earned + price * k } }), `Bán ${k} ${ITEMS[id].icon} được ${price * k} xu`)
  }
  const canDeliver = (o: Order) => has(farm.inv, o.want)
  const deliver = (o: Order) => {
    if (!canDeliver(o)) return
    update(
      (f) => ({
        ...f,
        inv: take(f.inv, o.want),
        orders: f.orders.map((x) => (x.id === o.id ? newOrder(f.xp + o.xp) : x)),
        coins: f.coins + o.coins,
        xp: f.xp + o.xp,
        stats: { ...f.stats, delivered: f.stats.delivered + 1, earned: f.stats.earned + o.coins },
      }),
      `${o.who} cảm ơn! +${o.coins} xu, +${o.xp} kinh nghiệm`,
    )
  }
  const skipOrder = (o: Order) => update((f) => ({ ...f, orders: f.orders.map((x) => (x.id === o.id ? newOrder(f.xp) : x)) }))

  const day = today(now)
  const yesterday = today(now - 86_400_000)
  const canClaim = farm.daily.last !== day
  const nextStreak = farm.daily.last === yesterday ? farm.daily.streak + 1 : 1
  const claim = () => {
    if (!canClaim) return
    const r = dailyReward(nextStreak)
    update((f) => ({ ...f, coins: f.coins + r.coins, xp: f.xp + r.xp, daily: { last: day, streak: nextStreak } }), `Điểm danh ngày thứ ${nextStreak}: +${r.coins} xu, +${r.xp} KN`)
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
  const ovenReady = farm.slots.map((s, i) => (s && now >= s.readyAt ? i : -1)).filter((i) => i >= 0)
  const busy = growing + farm.animals.filter((a) => a.readyAt && now < a.readyAt).length + farm.slots.filter((s) => s && now < s.readyAt).length
  const anyReady = ripe.length + animalsReady.length + ovenReady.length
  const idle = !anyReady && !busy
  const next = farm.plots.reduce<number | null>((m, p) => (p && now < p.readyAt && (m === null || p.readyAt < m) ? p.readyAt : m), null)
  const invList = ITEM_ORDER.filter((id) => (farm.inv[id] ?? 0) > 0)
  const nextSize = farm.size < 5 ? ((farm.size + 1) as 4 | 5) : null
  const barnOpen = lvl.lv >= ANIMALS.ga.level
  const bakeryOpen = lvl.lv >= RECIPES[0].level

  const tabs: { id: typeof view; label: string; badge: number; locked?: number }[] = [
    { id: 'field', label: '🌱 Ruộng', badge: ripe.length },
    { id: 'barn', label: '🐔 Chuồng', badge: animalsReady.length, locked: barnOpen ? undefined : ANIMALS.ga.level },
    { id: 'bakery', label: '🍞 Lò bánh', badge: ovenReady.length, locked: bakeryOpen ? undefined : RECIPES[0].level },
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
            <span className="coins">🪙 {farm.coins.toLocaleString('vi-VN')} xu</span>
            <span className="lv">Cấp {lvl.lv}</span>
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
                ? `Sẵn sàng: ${[ripe.length && `${ripe.length} ô ruộng`, animalsReady.length && `${animalsReady.length} con trong chuồng`, ovenReady.length && `${ovenReady.length} món ra lò`].filter(Boolean).join(', ')}`
                : `Ô ruộng gần chín nhất còn ${fmtLeft((next ?? now) - now)}`}
            {' · '}
            {weather.note}
          </div>
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
            📅 Điểm danh hôm nay {nextStreak > 1 ? `(chuỗi ${nextStreak} ngày)` : ''}: <b>+{dailyReward(nextStreak).coins} xu</b>, +{dailyReward(nextStreak).xp} KN
          </span>
          <button className="small-btn" onClick={claim}>
            Nhận quà
          </button>
        </div>
      )}

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
            {CROPS.map((c) => {
              const locked = c.level > lvl.lv
              return (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={seed === c.id}
                  disabled={locked}
                  className={`seed ${seed === c.id ? 'on' : ''}`}
                  onClick={() => setSeed(c.id)}
                  title={locked ? `Mở ở cấp ${c.level}` : `${c.name}: hạt ${c.seed} xu, bán ${c.sell} xu, chín sau ${fmtLeft(c.minutes * 60_000)}`}
                >
                  <span className="si">{locked ? '🔒' : c.icon}</span>
                  <span className="sn">{c.name}</span>
                  <span className="sp">{locked ? `cấp ${c.level}` : `${c.seed} xu · ${fmtLeft(c.minutes * 60_000)}`}</span>
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
                </button>
              )
            })}
          </div>
          {nextSize && (
            <div className="expand">
              <span>
                Mở rộng ruộng {nextSize}×{nextSize}: {EXPAND[nextSize].cost.toLocaleString('vi-VN')} xu, từ cấp {EXPAND[nextSize].level}
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
          {farm.animals.length === 0 && <p className="muted">Chuồng còn trống. Mua gà để có trứng, mua bò để có sữa, nguyên liệu cho lò bánh và các đơn hàng giá cao.</p>}
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
                    {locked ? `Cấp ${a.level}` : count >= a.max ? 'Đủ chuồng' : `Mua ${a.cost} xu`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {view === 'bakery' && (
        <section className="bakery">
          <div className="farm-actions">
            <button className="small-btn" disabled={!ovenReady.length} onClick={() => takeOut(ovenReady)}>
              Lấy hết món đã xong{ovenReady.length ? ` (${ovenReady.length})` : ''}
            </button>
            {SLOT_COST[farm.slots.length] !== undefined && (
              <button className="secondary small-btn" disabled={farm.coins < SLOT_COST[farm.slots.length]} onClick={buySlot}>
                Thêm ô nướng ({SLOT_COST[farm.slots.length]} xu)
              </button>
            )}
          </div>
          <div className="ovens">
            {farm.slots.map((s, i) =>
              s ? (
                <button key={i} className={`oven ${now >= s.readyAt ? 'ready' : 'busy'}`} onClick={() => (now >= s.readyAt ? takeOut([i]) : say(`${RECIPE[s.recipe].name} còn ${fmtLeft(s.readyAt - now)}`))}>
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
            {RECIPES.map((r) => {
              const locked = lvl.lv < r.level
              const free = farm.slots.findIndex((s) => !s)
              const ok = !locked && free >= 0 && has(farm.inv, r.needs)
              return (
                <div key={r.id} className={`recipe ${locked ? 'locked' : ''}`}>
                  <span className="si">{locked ? '🔒' : r.icon}</span>
                  <div>
                    <b>{r.name}</b>
                    <div className="muted small">
                      {needsText(r.needs)} · {fmtLeft(r.minutes * 60_000)} · bán {r.sell} xu
                    </div>
                  </div>
                  <button className="small-btn" disabled={!ok} onClick={() => bake(free, r.id)}>
                    {locked ? `Cấp ${r.level}` : free < 0 ? 'Lò bận' : has(farm.inv, r.needs) ? 'Làm' : 'Thiếu'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
                  <span className="ar">{done ? 'Đã đạt' : `+${a.reward} xu`}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {toast && (
        <div className="farm-toast" role="status">
          {toast}
        </div>
      )}

      <div className="farm-panels">
        <section className="farm-panel">
          <h3>Đơn hàng</h3>
          {farm.orders.map((o) => {
            const ok = canDeliver(o)
            return (
              <div key={o.id} className={`order ${ok ? 'ready' : ''}`}>
                <div className="order-who">{o.who}</div>
                <div className="order-want">
                  {Object.entries(o.want).map(([k, n]) => {
                    const have = farm.inv[k as ItemId] ?? 0
                    return (
                      <span key={k} className={have >= (n ?? 0) ? 'enough' : ''} title={ITEMS[k as ItemId].name}>
                        {ITEMS[k as ItemId].icon} {Math.min(have, n ?? 0)}/{n}
                      </span>
                    )
                  })}
                </div>
                <div className="order-reward">
                  +{o.coins} xu · +{o.xp} KN
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
              {invList.map((id) => (
                <li key={id}>
                  <span className="ii">{ITEMS[id].icon}</span>
                  <span className="in">
                    {ITEMS[id].name} × {farm.inv[id]}
                  </span>
                  <span className="muted small">{priceOf(id)} xu/cái</span>
                  <button className="link" onClick={() => sell(id, 1)}>
                    Bán 1
                  </button>
                  <button className="link" onClick={() => sell(id, farm.inv[id] ?? 0)}>
                    Bán hết
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small farm-meta">
            Thu hoạch {farm.stats.harvested.toLocaleString('vi-VN')} lần · nhặt {farm.stats.collected} · làm {farm.stats.crafted} món · giao {farm.stats.delivered} đơn · kiếm {farm.stats.earned.toLocaleString('vi-VN')} xu ·{' '}
            <button className="link" onClick={() => setAskReset(true)}>
              Làm lại từ đầu
            </button>
          </p>
        </section>
      </div>
      {askReset && (
        <ConfirmDialog
          title="Làm lại nông trại từ đầu?"
          text="Toàn bộ xu, cấp, kho, chuồng trại, lò bánh, thành tựu và cây đang trồng sẽ mất."
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
