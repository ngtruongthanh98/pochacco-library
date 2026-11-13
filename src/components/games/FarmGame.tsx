import React, { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { CROP, CROPS, EXPAND, expandPlots, fmtLeft, levelOf, newFarm, newOrder, parseFarm, type CropId, type Farm, type Order } from './farm'

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

  const update = (fn: (f: Farm) => Farm, msg?: string) => {
    setFarm((cur) => {
      const next = { ...fn(cur), savedAt: Date.now() }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      return next
    })
    dirtyRef.current = true
    if (sync.state === 'saved') setSync({ state: 'idle' })
    if (msg) {
      setToast(msg)
      window.clearTimeout((update as unknown as { t?: number }).t)
      ;(update as unknown as { t?: number }).t = window.setTimeout(() => setToast(null), 2200)
    }
  }

  const lvl = levelOf(farm.xp)
  const gainXp = (f: Farm, x: number): Farm => {
    const before = levelOf(f.xp).lv
    const after = levelOf(f.xp + x).lv
    if (after > before) {
      const unlocked = CROPS.filter((c) => c.level > before && c.level <= after).map((c) => `${c.icon} ${c.name}`)
      setTimeout(() => setToast(`Lên cấp ${after}!${unlocked.length ? ` Mở khóa ${unlocked.join(', ')}` : ''}`), 50)
    }
    return { ...f, xp: f.xp + x }
  }

  const clickPlot = (i: number) => {
    const p = farm.plots[i]
    if (!p) {
      const c = CROP[seed]
      if (farm.coins < c.seed) return setToast(`Không đủ xu mua hạt ${c.name} (${c.seed} xu)`)
      update((f) => {
        const plots = [...f.plots]
        const t = Date.now()
        plots[i] = { crop: seed, plantedAt: t, readyAt: t + c.minutes * 60_000, watered: false }
        return { ...f, coins: f.coins - c.seed, plots }
      })
      return
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
    } else setToast(`${CROP[p.crop].name} còn ${fmtLeft(p.readyAt - now)} nữa mới chín`)
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
        return gainXp({ ...f, plots, inv, stats: { ...f.stats, harvested: f.stats.harvested + ready.length } }, x)
      },
      `Thu hoạch ${Object.entries(got).map(([k, n]) => `${n} ${CROP[k as CropId].icon}`).join(' ')}`,
    )
  }

  const plantAll = () => {
    const c = CROP[seed]
    const empty = farm.plots.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
    const n = Math.min(empty.length, Math.floor(farm.coins / c.seed))
    if (!n) return setToast(empty.length ? `Không đủ xu mua hạt ${c.name}` : 'Không còn ô trống')
    update((f) => {
      const plots = [...f.plots]
      const t = Date.now()
      for (const i of empty.slice(0, n)) plots[i] = { crop: seed, plantedAt: t, readyAt: t + c.minutes * 60_000, watered: false }
      return { ...f, coins: f.coins - n * c.seed, plots }
    }, `Gieo ${n} ô ${c.icon} ${c.name}`)
  }

  const waterAll = () => {
    const idx = farm.plots.map((p, i) => (p && !p.watered && now < p.readyAt ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) return setToast('Không có cây nào cần tưới')
    update((f) => {
      const plots = [...f.plots]
      const t = Date.now()
      for (const i of idx) plots[i] = { ...plots[i]!, watered: true, readyAt: plots[i]!.readyAt - Math.round((plots[i]!.readyAt - t) * 0.25) }
      return { ...f, plots }
    }, `Đã tưới ${idx.length} ô 💧`)
  }

  const sell = (id: CropId, n: number) => {
    const have = farm.inv[id] ?? 0
    const k = Math.min(n, have)
    if (!k) return
    const c = CROP[id]
    update((f) => ({ ...f, coins: f.coins + c.sell * k, inv: { ...f.inv, [id]: have - k }, stats: { ...f.stats, earned: f.stats.earned + c.sell * k } }), `Bán ${k} ${c.icon} được ${c.sell * k} xu`)
  }

  const canDeliver = (o: Order) => Object.entries(o.want).every(([k, n]) => (farm.inv[k as CropId] ?? 0) >= (n ?? 0))
  const deliver = (o: Order) => {
    if (!canDeliver(o)) return
    update((f) => {
      const inv = { ...f.inv }
      for (const [k, n] of Object.entries(o.want)) inv[k as CropId] = (inv[k as CropId] ?? 0) - (n ?? 0)
      const orders = f.orders.map((x) => (x.id === o.id ? newOrder(f.xp + o.xp) : x))
      return gainXp({ ...f, inv, orders, coins: f.coins + o.coins, stats: { ...f.stats, delivered: f.stats.delivered + 1, earned: f.stats.earned + o.coins } }, o.xp)
    }, `${o.who} cảm ơn! +${o.coins} xu, +${o.xp} kinh nghiệm`)
  }
  const skipOrder = (o: Order) => update((f) => ({ ...f, orders: f.orders.map((x) => (x.id === o.id ? newOrder(f.xp) : x)) }))

  const expand = () => {
    const to = (farm.size + 1) as 4 | 5
    const e = EXPAND[to]
    if (lvl.lv < e.level || farm.coins < e.cost) return
    update((f) => ({ ...f, size: to, coins: f.coins - e.cost, plots: expandPlots(f.plots, f.size, to) }), `Ruộng mở rộng thành ${to}×${to}!`)
  }

  const reset = () => {
    setAskReset(false)
    update(() => newFarm(), 'Bắt đầu nông trại mới')
  }

  const ripe = farm.plots.map((p, i) => (p && now >= p.readyAt ? i : -1)).filter((i) => i >= 0)
  const growing = farm.plots.filter((p) => p && now < p.readyAt).length
  const idle = !ripe.length && !growing
  const next = farm.plots.reduce<number | null>((m, p) => (p && now < p.readyAt && (m === null || p.readyAt < m) ? p.readyAt : m), null)
  const invList = CROPS.filter((c) => (farm.inv[c.id] ?? 0) > 0)
  const nextSize = farm.size < 5 ? ((farm.size + 1) as 4 | 5) : null

  return (
    <div className="farm">
      <div className="farm-top">
        <div className="farm-pochacco" aria-hidden="true">
          <img src={asset(idle ? 'anim-sleepy.webp' : ripe.length ? 'anim-carry.webp' : 'anim-walk.webp')} alt="" className={idle ? 'round' : ''} />
        </div>
        <div className="farm-stats">
          <div className="farm-line">
            <span className="coins">🪙 {farm.coins.toLocaleString('vi-VN')} xu</span>
            <span className="lv">Cấp {lvl.lv}</span>
          </div>
          <div className="xpbar" title={`${lvl.into}/${lvl.need} kinh nghiệm`}>
            <div style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
          </div>
          <div className="muted small">
            {idle
              ? 'Ruộng trống, Pochacco ngủ gật rồi. Chọn hạt giống và gieo thôi!'
              : ripe.length
                ? `${ripe.length} ô đã chín, thu hoạch nào!`
                : `Ô gần chín nhất còn ${fmtLeft((next ?? now) - now)}`}
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

      <div className="field" style={{ gridTemplateColumns: `repeat(${farm.size}, 1fr)`, '--n': farm.size, maxWidth: 140 * farm.size + 40 } as React.CSSProperties}>
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
                    const have = farm.inv[k as CropId] ?? 0
                    return (
                      <span key={k} className={have >= (n ?? 0) ? 'enough' : ''}>
                        {CROP[k as CropId].icon} {Math.min(have, n ?? 0)}/{n}
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
          <h3>Kho và chợ</h3>
          {invList.length === 0 ? (
            <p className="muted small">Kho trống. Thu hoạch xong, nông sản sẽ nằm ở đây để bán hoặc giao đơn.</p>
          ) : (
            <ul className="inv">
              {invList.map((c) => (
                <li key={c.id}>
                  <span className="ii">{c.icon}</span>
                  <span className="in">
                    {c.name} × {farm.inv[c.id]}
                  </span>
                  <span className="muted small">{c.sell} xu/cái</span>
                  <button className="link" onClick={() => sell(c.id, 1)}>
                    Bán 1
                  </button>
                  <button className="link" onClick={() => sell(c.id, farm.inv[c.id] ?? 0)}>
                    Bán hết
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          <p className="muted small farm-meta">
            Đã thu hoạch {farm.stats.harvested.toLocaleString('vi-VN')} lần · giao {farm.stats.delivered} đơn · kiếm {farm.stats.earned.toLocaleString('vi-VN')} xu ·{' '}
            <button className="link" onClick={() => setAskReset(true)}>
              Làm lại từ đầu
            </button>
          </p>
        </section>
      </div>
      {askReset && (
        <ConfirmDialog
          title="Làm lại nông trại từ đầu?"
          text="Toàn bộ xu, cấp, kho và cây đang trồng sẽ mất."
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
