import { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import {
  ALL_HOLES, BALL_R, COLS, HOLE_R, OBSTACLE, ROWS, SURFACE, VMAX, WORLDS,
  coinsFor, gAsset, levelOf, millClosed, moving, newGolf, parseCourse, parseGolf, resultName, simulate, starsFor, step, unlocked, worldOpen,
  type Ball, type Course, type GolfSave, type Mods,
} from './golf'
import {
  FRIEND, GIFT, KIND_LABEL, SHOP, TASKS, TOUR_RIVALS, TASK_BONUS_GEMS, TASK_REWARD, TOUR_WIN, caddieMods, dailyFor, newTour, todayKey, tourTotal,
  type HoleEvent, type ShopKind,
} from './golfMeta'

const LOCAL_KEY = 'pochacco-library:golf'
const CLOUD_FILE = 'golf'
const CLOUD_DELAY = 20_000
const SWING_FRAMES = Array.from({ length: 12 }, (_, i) => `swing_${String(i + 1).padStart(2, '0')}`)
const FRAME_MS = 45
const IMPACT_FRAME = 6
const HINT_AFTER = 4
const MAX_DRAG = 3.2 // ô
const MAX_ROLL = 15 // giây, chống kẹt bóng

type Fx = { kind: 'cloud' | 'splash' | 'text'; x: number; y: number; at: number; text?: string }
type Play = {
  course: Course
  ball: Ball
  t: number
  strokes: number
  water: number
  forgiven: boolean
  from: { x: number; y: number }
  phase: 'aim' | 'swing' | 'roll' | 'water' | 'sunk'
  swingAt: number
  rollAt: number
  pending: { vx: number; vy: number } | null
  sinkAt: number
  fx: Fx[]
  drag: { sx: number; sy: number; cx: number; cy: number } | null
  tour: boolean
}
type Result = {
  holeIdx: number; strokes: number; par: number; name: string; stars: number; coins: number; gems: number; best: boolean; prevBest?: number
  tour?: { lostHeart: boolean; hearts: number; over: 'win' | 'lose' | null; firstWin: boolean }
}
type Panel = 'shop' | 'daily' | 'records' | 'tour' | null
export type DrawOpts = { hint: boolean; ball: string; tee: string; club: string; mods: Mods }

const loadLocal = (): GolfSave | null => {
  try {
    return parseGolf(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'))
  } catch {
    return null
  }
}

// Ảnh dùng trên canvas, tải một lần.
const IMG = new Map<string, HTMLImageElement>()
const img = (n: string) => {
  let i = IMG.get(n)
  if (!i) {
    i = new Image()
    i.src = gAsset(n)
    IMG.set(n, i)
  }
  return i
}
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
const vmaxOf = (club: string) => VMAX * (club === 'wood_club' ? 1.12 : 1)

function Stars({ n, big }: { n: number; big?: boolean }) {
  return (
    <span className={`gh-stars${big ? ' big' : ''}`} aria-label={`${n} sao`}>
      {[0, 1, 2].map((k) => (
        <span key={k} className={k < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function GolfGame({ cfg }: { cfg: StoreConfig }) {
  const [save, setSave] = useState<GolfSave>(() => loadLocal() ?? newGolf())
  const saveRef = useRef(save)
  saveRef.current = save
  const shaRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const [loaded, setLoaded] = useState(false)

  const [worldIdx, setWorldIdx] = useState(() => {
    let i = 0
    const s = loadLocal() ?? newGolf()
    while (i + 1 < WORLDS.length && worldOpen(s, i + 1)) i++
    return i
  })
  const world = WORLDS[worldIdx]
  const [view, setView] = useState<'lobby' | 'play'>('lobby')
  const [panel, setPanel] = useState<Panel>(null)
  const [holeIdx, setHoleIdx] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [, force] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [power, setPower] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const play = useRef<Play | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const cellRef = useRef(36)

  const flash = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast((x) => (x === m ? null : x)), 3200)
  }

  // ---------- Lưu tiến trình ----------
  useEffect(() => {
    let cancelled = false
    readConfigFile<unknown>(cfg, CLOUD_FILE)
      .then((r) => {
        if (cancelled) return
        shaRef.current = r?.sha ?? null
        const remote = r ? parseGolf(r.data) : null
        const local = loadLocal()
        if (remote && (!local || remote.savedAt > local.savedAt)) {
          setSave(remote)
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
    const data = saveRef.current
    const msg = `Golf: ${Object.keys(data.best).length} lỗ, ${data.coins} xu`
    try {
      shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, data, shaRef.current, msg)
    } catch {
      try {
        const r = await readConfigFile<unknown>(cfg, CLOUD_FILE)
        shaRef.current = await writeConfigFile(cfg, CLOUD_FILE, saveRef.current, r?.sha ?? null, msg)
      } catch {
        dirtyRef.current = true
      }
    }
  }, [cfg])
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => void pushCloud(), CLOUD_DELAY)
    return () => clearTimeout(t)
  }, [save, loaded, pushCloud])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void pushCloud()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void pushCloud()
    }
  }, [pushCloud])
  const update = (fn: (s: GolfSave) => GolfSave) => {
    const next = { ...fn(saveRef.current), savedAt: Date.now() }
    saveRef.current = next
    setSave(next)
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    } catch {
      /* bỏ qua */
    }
    dirtyRef.current = true
  }

  // Nhiệm vụ của hôm nay
  useEffect(() => {
    if (saveRef.current.daily.date !== todayKey()) update((s) => ({ ...s, daily: dailyFor(s) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tải trước ảnh
  useEffect(() => {
    const names = [
      ...new Set(Object.values(SURFACE).map((s) => s.tile)), 'hole_plain', 'cloud_effect', 'blue_fast_ball', 'golden_fast_ball', 'aiming_ball', 'wood_bridge',
      save.equip.ball, save.equip.tee, ...Object.keys(OBSTACLE), ...ALL_HOLES.map((h) => h.flag), ...SWING_FRAMES, 'ready', 'address_ball', 'follow_through', 'victory_trophy',
    ]
    for (const n of names) img(n)
  }, [save.equip.ball, save.equip.tee])

  // ---------- Bắt đầu một lỗ ----------
  const startHole = (wi: number, i: number, tour = false) => {
    const course = parseCourse(WORLDS[wi].holes[i])
    play.current = {
      course, ball: { x: course.tee.x, y: course.tee.y, vx: 0, vy: 0 }, t: 0, strokes: 0, water: 0, forgiven: false,
      from: { ...course.tee }, phase: 'aim', swingAt: 0, rollAt: 0, pending: null, sinkAt: 0, fx: [], drag: null, tour,
    }
    setWorldIdx(wi)
    setHoleIdx(i)
    setResult(null)
    setShowHint(false)
    setPower(0)
    setPanel(null)
    setView('play')
  }
  const startTour = (wi: number) => {
    const t = newTour(WORLDS[wi].id)
    update((s) => ({ ...s, tour: t }))
    startHole(wi, 0, true)
  }
  const resumeTour = () => {
    const t = saveRef.current.tour
    if (!t) return
    startHole(WORLDS.findIndex((w) => w.id === t.world), t.idx, true)
  }

  const inPlay = view === 'play'
  useEffect(() => {
    if (!inPlay) return
    document.body.classList.add('golf-playing')
    return () => document.body.classList.remove('golf-playing')
  }, [inPlay])

  // ---------- Kích thước canvas ----------
  useEffect(() => {
    if (!inPlay) return
    const fit = () => {
      const wrap = wrapRef.current
      const cv = canvasRef.current
      if (!wrap || !cv) return
      const w = wrap.clientWidth
      const phone = window.matchMedia('(max-width: 640px)').matches
      const availH = phone ? window.innerHeight - 165 : Math.min(window.innerHeight - 200, 760)
      const cell = Math.max(22, Math.floor(Math.min(w / COLS, availH / ROWS)))
      cellRef.current = cell
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.style.width = `${cell * COLS}px`
      cv.style.height = `${cell * ROWS}px`
      cv.width = Math.round(cell * COLS * dpr)
      cv.height = Math.round(cell * ROWS * dpr)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [inPlay])

  // ---------- Kết thúc lỗ ----------
  const finishHole = useCallback(() => {
    const p = play.current
    if (!p) return
    const def = p.course.def
    const wi = WORLDS.findIndex((w) => w.holes.includes(def))
    const hi = WORLDS[wi].holes.indexOf(def)
    const strokes = p.strokes
    const s0 = saveRef.current
    const prev = s0.best[def.id]
    const stars = starsFor(strokes, def.par)
    const improved = prev === undefined || strokes < prev
    let coins = improved ? coinsFor(strokes, def.par) : 5
    let gems = strokes === 1 && prev !== 1 ? 3 : 0
    const msgs: string[] = []

    // Nhiệm vụ ngày
    const ev: HoleEvent = { strokes, par: def.par, water: p.water, stars, tour: p.tour }
    const daily = dailyFor(s0)
    const tasks = daily.tasks.map((t) => {
      if (t.done) return t
      const def2 = TASKS.find((x) => x.id === t.id)!
      const prog = Math.min(def2.goal, t.prog + def2.inc(ev))
      const done = prog >= def2.goal
      if (done) {
        coins += TASK_REWARD
        msgs.push(`Xong nhiệm vụ “${def2.text}”: +${TASK_REWARD} xu`)
      }
      return { ...t, prog, done }
    })
    let bonus = daily.bonus
    if (!bonus && tasks.every((t) => t.done)) {
      bonus = true
      gems += TASK_BONUS_GEMS
      msgs.push(`Xong cả 3 nhiệm vụ hôm nay: +${TASK_BONUS_GEMS} kim cương`)
    }

    // Giải đấu
    let tourInfo: Result['tour']
    let tour = s0.tour
    let caddies = s0.caddies
    let tourWins = s0.tourWins
    if (p.tour && tour) {
      const lostHeart = strokes > def.par + 2
      const hearts = tour.hearts - (lostHeart ? 1 : 0)
      const mine = [...tour.mine, strokes]
      let over: 'win' | 'lose' | null = null
      let firstWin = false
      if (hearts <= 0) over = 'lose'
      else if (mine.length >= WORLDS[wi].holes.length) {
        const my = tourTotal(mine)
        over = tour.rivals.every((r) => my <= tourTotal(r.scores)) ? 'win' : 'lose'
      }
      if (over === 'win') {
        const host = WORLDS[wi].host
        firstWin = !caddies.includes(host)
        if (firstWin) {
          caddies = [...caddies, host]
          coins += TOUR_WIN.coins
          gems += TOUR_WIN.gems
          msgs.push(`${FRIEND[host].name} thành caddie của bạn!`)
        } else coins += 60
        tourWins = { ...tourWins, [WORLDS[wi].id]: (tourWins[WORLDS[wi].id] ?? 0) + 1 }
      } else if (over === 'lose') coins += 20
      tour = over ? null : { ...tour, idx: tour.idx + 1, hearts, mine }
      tourInfo = { lostHeart, hearts, over, firstWin }
      if (over) setTourEnd({ world: WORLDS[wi].id, mine, rivals: s0.tour!.rivals, result: over, firstWin })
    }

    update((s) => ({
      ...s,
      coins: s.coins + coins,
      gems: s.gems + gems,
      xp: s.xp + 10 + Math.max(0, def.par - strokes + 1) * 5,
      best: { ...s.best, [def.id]: prev === undefined ? strokes : Math.min(prev, strokes) },
      stars: { ...s.stars, [def.id]: Math.max(s.stars[def.id] ?? 0, stars) },
      holeInOnes: s.holeInOnes + (strokes === 1 ? 1 : 0),
      played: s.played + 1,
      daily: { ...daily, tasks, bonus },
      tour,
      caddies,
      tourWins,
    }))
    if (msgs.length) flash(msgs.join(' · '))
    setResult({ holeIdx: hi, strokes, par: def.par, name: resultName(strokes, def.par), stars, coins, gems, best: improved && prev !== undefined, prevBest: prev, tour: tourInfo })
  }, [])
  const [tourEnd, setTourEnd] = useState<{ world: string; mine: number[]; rivals: { id: string; scores: number[] }[]; result: 'win' | 'lose'; firstWin: boolean } | null>(null)

  // ---------- Vòng lặp: vật lý + vẽ ----------
  const optsRef = useRef<DrawOpts>({ hint: false, ball: save.equip.ball, tee: save.equip.tee, club: save.equip.club, mods: caddieMods(save.caddie) })
  optsRef.current = { hint: showHint, ball: save.equip.ball, tee: save.equip.tee, club: save.equip.club, mods: caddieMods(save.caddie) }
  useEffect(() => {
    if (!inPlay) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const p = play.current
      const cv = canvasRef.current
      const o = optsRef.current
      if (p && cv) {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        p.t += dt
        if (p.phase === 'swing' && p.pending && now - p.swingAt >= IMPACT_FRAME * FRAME_MS) {
          p.ball.vx = p.pending.vx
          p.ball.vy = p.pending.vy
          p.pending = null
          p.phase = 'roll'
          p.rollAt = p.t
        }
        if (p.phase === 'roll') {
          const sub = 4
          for (let k = 0; k < sub; k++) {
            const ev = step(p.course, p.ball, dt / sub, p.t, o.mods)
            if (ev === 'sand') p.fx.push({ kind: 'cloud', x: p.ball.x, y: p.ball.y, at: p.t })
            if (ev === 'water') {
              p.phase = 'water'
              p.water += 1
              // Rái Cá Xanh: lần rơi nước đầu tiên ở mỗi lỗ không phạt
              const free = saveRef.current.caddie === 'blue_otter_costume' && !p.forgiven
              if (free) p.forgiven = true
              else p.strokes += 1
              p.fx.push({ kind: 'splash', x: p.ball.x, y: p.ball.y, at: p.t }, { kind: 'text', x: p.ball.x, y: p.ball.y - 0.4, at: p.t, text: free ? 'Tõm! Rái Cá cứu' : 'Tõm! +1 gậy' })
              p.sinkAt = p.t
              force((x) => x + 1)
              break
            }
            if (ev === 'sink') {
              p.phase = 'sunk'
              p.sinkAt = p.t
              p.ball.vx = p.ball.vy = 0
              force((x) => x + 1)
              window.setTimeout(finishHole, 900)
              break
            }
          }
          if (p.phase === 'roll' && (!moving(p.ball) || p.t - p.rollAt > MAX_ROLL)) {
            p.ball.vx = p.ball.vy = 0
            p.phase = 'aim'
            p.from = { x: p.ball.x, y: p.ball.y }
            force((x) => x + 1)
          }
        }
        if (p.phase === 'water' && p.t - p.sinkAt > 0.9) {
          p.ball = { x: p.from.x, y: p.from.y, vx: 0, vy: 0 }
          p.phase = 'aim'
          force((x) => x + 1)
        }
        p.fx = p.fx.filter((f) => p.t - f.at < 1.2)
        draw(cv, p, cellRef.current, o)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inPlay, finishHole])

  // ---------- Kéo để ngắm ----------
  const toCell = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const c = cellRef.current
    return { x: (e.clientX - r.left) / c, y: (e.clientY - r.top) / c }
  }
  const onDown = (e: React.PointerEvent) => {
    const p = play.current
    if (!p || p.phase !== 'aim' || result) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const q = toCell(e)
    p.drag = { sx: q.x, sy: q.y, cx: q.x, cy: q.y }
    setPower(0)
    force((x) => x + 1)
  }
  const onMove = (e: React.PointerEvent) => {
    const p = play.current
    if (!p?.drag) return
    const q = toCell(e)
    p.drag.cx = q.x
    p.drag.cy = q.y
    setPower(Math.min(1, Math.hypot(p.drag.sx - q.x, p.drag.sy - q.y) / MAX_DRAG))
  }
  const onUp = () => {
    const p = play.current
    if (!p?.drag) return
    const { sx, sy, cx, cy } = p.drag
    p.drag = null
    const dx = sx - cx
    const dy = sy - cy
    const len = Math.hypot(dx, dy)
    const pw = Math.min(1, len / MAX_DRAG)
    setPower(0)
    if (pw < 0.05) return force((x) => x + 1)
    const vm = vmaxOf(saveRef.current.equip.club)
    p.pending = { vx: (dx / len) * pw * vm, vy: (dy / len) * pw * vm }
    p.phase = 'swing'
    p.swingAt = performance.now()
    p.strokes += 1
    force((x) => x + 1)
  }

  // Hoạt cảnh Pochacco ở góc
  const [, tick] = useState(0)
  useEffect(() => {
    if (!inPlay) return
    const id = window.setInterval(() => tick((x) => x + 1), FRAME_MS)
    return () => clearInterval(id)
  }, [inPlay])
  const p = play.current
  let pose = 'ready'
  if (p) {
    if (p.phase === 'swing' || (p.phase === 'roll' && performance.now() - p.swingAt < SWING_FRAMES.length * FRAME_MS)) {
      const f = Math.min(SWING_FRAMES.length - 1, Math.floor((performance.now() - p.swingAt) / FRAME_MS))
      pose = SWING_FRAMES[f]
    } else if (p.phase === 'roll') pose = 'follow_through'
    else if (p.phase === 'sunk' || result) pose = 'victory_trophy'
    else if (p.drag) pose = 'address_ball'
  }

  // ---------- Cửa hàng, quà ----------
  const buy = (id: string) => {
    const it = SHOP.find((x) => x.id === id)!
    const s = saveRef.current
    if (s.owned.includes(id)) return equip(id)
    if (it.level && levelOf(s.xp).lv < it.level) return flash(`Cần đạt cấp ${it.level} để mua ${it.name}.`)
    if (it.gem ? s.gems < it.price : s.coins < it.price) return flash(it.gem ? 'Chưa đủ kim cương.' : 'Chưa đủ xu.')
    update((x) => ({
      ...x,
      coins: x.coins - (it.gem ? 0 : it.price),
      gems: x.gems - (it.gem ? it.price : 0),
      owned: [...x.owned, id],
      equip: { ...x.equip, [it.kind]: id },
    }))
    flash(`Đã mua ${it.name}!`)
  }
  const equip = (id: string) => {
    const it = SHOP.find((x) => x.id === id)!
    update((x) => ({ ...x, equip: { ...x.equip, [it.kind]: id } }))
  }
  const claimGift = () => {
    const s = saveRef.current
    const today = todayKey()
    if (s.daily.gift === today) return
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
    const streak = s.daily.gift === yk ? s.daily.streak + 1 : 1
    const g = GIFT(streak)
    update((x) => ({ ...x, coins: x.coins + g.coins, gems: x.gems + g.gems, daily: { ...dailyFor(x), gift: today, streak } }))
    flash(`Quà ngày ${streak}: +${g.coins} xu${g.gems ? `, +${g.gems} kim cương` : ''}`)
  }

  const lv = levelOf(save.xp)
  const daily = save.daily.date === todayKey() ? save.daily : dailyFor(save)
  const giftReady = save.daily.gift !== todayKey()
  const tasksLeft = daily.tasks.filter((t) => !t.done).length

  // ---------- Sảnh ----------
  if (view === 'lobby') {
    const wOpen = worldOpen(save, worldIdx)
    const totalStars = world.holes.reduce((s, h) => s + (save.stars[h.id] ?? 0), 0)
    const nextIdx = world.holes.findIndex((h, i) => unlocked(save, world, i) && !save.best[h.id])
    const allDone = world.holes.every((h) => save.best[h.id])
    const totalBest = allDone ? world.holes.reduce((s, h) => s + save.best[h.id], 0) : 0
    const totalPar = world.holes.reduce((s, h) => s + h.par, 0)
    const tourHere = save.tour && save.tour.world === world.id ? save.tour : null
    return (
      <div className="golf">
        <div className="golf-top">
          <img className="golf-title" src={gAsset('game_title_sign')} alt="Pochacco Golf" />
          <div className="golf-wallet">
            <span className="golf-chip">
              <img src={gAsset('coin_icon')} alt="Xu" /> {save.coins.toLocaleString('vi-VN')}
            </span>
            <span className="golf-chip">
              <img src={gAsset('gem_icon')} alt="Kim cương" /> {save.gems}
            </span>
            <span className="golf-chip lv" title={`${lv.into}/${lv.need} kinh nghiệm`}>
              <img src={gAsset('star_icon')} alt="" /> Cấp {lv.lv}
              <span className="golf-xp">
                <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
              </span>
            </span>
          </div>
        </div>

        <div className="golf-menu" role="toolbar" aria-label="Menu golf">
          <button onClick={claimGift} className={giftReady ? 'ping' : ''} disabled={!giftReady}>
            <img src={gAsset('gift_button')} alt="" />
            <span>{giftReady ? 'Nhận quà' : `Ngày ${save.daily.streak}`}</span>
          </button>
          <button onClick={() => setPanel(panel === 'daily' ? null : 'daily')} className={panel === 'daily' ? 'on' : ''}>
            <img src={gAsset('daily_tasks_button')} alt="" />
            <span>Nhiệm vụ{tasksLeft ? ` (${tasksLeft})` : ' ✓'}</span>
          </button>
          <button onClick={() => setPanel(panel === 'shop' ? null : 'shop')} className={panel === 'shop' ? 'on' : ''}>
            <img src={gAsset('shop_button')} alt="" />
            <span>Cửa hàng</span>
          </button>
          <button onClick={() => setPanel(panel === 'tour' ? null : 'tour')} className={panel === 'tour' ? 'on' : ''}>
            <img src={gAsset('leaderboard_button')} alt="" />
            <span>Giải đấu</span>
          </button>
          <button onClick={() => setPanel(panel === 'records' ? null : 'records')} className={panel === 'records' ? 'on' : ''}>
            <img src={gAsset('trophy_button')} alt="" />
            <span>Kỷ lục</span>
          </button>
        </div>
        {toast && <div className="golf-toast">{toast}</div>}

        {panel === 'daily' && (
          <section className="golf-panel">
            <h4>Nhiệm vụ hôm nay</h4>
            <ul className="golf-tasks">
              {daily.tasks.map((t) => {
                const d = TASKS.find((x) => x.id === t.id)!
                return (
                  <li key={t.id} className={t.done ? 'done' : ''}>
                    <span>
                      {t.done ? '✓ ' : ''}
                      {d.text}
                    </span>
                    <span className="gt-bar">
                      <span style={{ width: `${(t.prog / d.goal) * 100}%` }} />
                    </span>
                    <small>
                      {t.prog}/{d.goal} · +{TASK_REWARD} xu
                    </small>
                  </li>
                )
              })}
            </ul>
            <p className="muted small">
              Xong cả 3 được thêm {TASK_BONUS_GEMS} kim cương{daily.bonus ? ' (đã nhận)' : ''}. Nhiệm vụ đổi mỗi ngày. Quà điểm danh tăng dần theo chuỗi ngày, ngày thứ 7 được 5 kim cương.
            </p>
          </section>
        )}

        {panel === 'shop' && (
          <section className="golf-panel">
            <h4>Cửa hàng</h4>
            {(Object.keys(KIND_LABEL) as ShopKind[]).map((k) => (
              <div key={k} className="golf-shop-group">
                <h5>{KIND_LABEL[k]}</h5>
                <div className="golf-shop">
                  {SHOP.filter((x) => x.kind === k).map((it) => {
                    const own = save.owned.includes(it.id)
                    const on = save.equip[k] === it.id
                    const locked = !own && it.level && lv.lv < it.level
                    return (
                      <button key={it.id} className={`golf-item ${on ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => buy(it.id)} title={it.perk ?? it.name}>
                        <img src={gAsset(it.id)} alt="" />
                        <b>{it.name}</b>
                        {it.perk && <small className="gi-perk">{it.perk}</small>}
                        <span className="gi-price">
                          {on ? (
                            'Đang dùng'
                          ) : own ? (
                            'Dùng'
                          ) : locked ? (
                            `Cấp ${it.level}`
                          ) : (
                            <>
                              <img src={gAsset(it.gem ? 'gem_icon' : 'coin_icon')} alt="" /> {it.price}
                            </>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {panel === 'tour' && (
          <section className="golf-panel">
            <h4>Giải đấu</h4>
            <p className="small">
              Đánh liền 9 lỗ của một khu, so tổng số gậy với các bạn. Bạn có 3 tim, lỗ nào đánh quá par 2 gậy thì mất 1 tim. Thắng lần đầu thì chủ sân thành <b>caddie</b> của bạn, kèm{' '}
              {TOUR_WIN.coins} xu và {TOUR_WIN.gems} kim cương.
            </p>
            {save.tour && (
              <div className="golf-tour-resume">
                <span>
                  Đang dở giải {WORLDS.find((w) => w.id === save.tour!.world)?.name}: lỗ {save.tour.idx + 1}/9, còn {'❤'.repeat(save.tour.hearts)}
                </span>
                <button onClick={resumeTour}>Đánh tiếp</button>
                <button className="link" onClick={() => update((s) => ({ ...s, tour: null }))}>
                  Bỏ giải
                </button>
              </div>
            )}
            <div className="golf-tours">
              {WORLDS.map((w, wi) => {
                const open = worldOpen(save, wi)
                return (
                  <div key={w.id} className={`golf-tour ${open ? '' : 'locked'}`}>
                    <img src={gAsset(w.host)} alt="" />
                    <div>
                      <b>Giải {w.name}</b>
                      <small>
                        Đối thủ: {TOUR_RIVALS[w.id].map((r) => FRIEND[r.id].name).join(', ')}
                        {save.tourWins[w.id] ? ` · đã thắng ${save.tourWins[w.id]} lần` : ''}
                      </small>
                    </div>
                    <button disabled={!open || !!save.tour} onClick={() => startTour(wi)}>
                      {open ? 'Vào giải' : '🔒'}
                    </button>
                  </div>
                )
              })}
            </div>
            <h5>Caddie</h5>
            {save.caddies.length ? (
              <div className="golf-caddies">
                <button className={!save.caddie ? 'on' : ''} onClick={() => update((s) => ({ ...s, caddie: null }))}>
                  Không dùng
                </button>
                {save.caddies.map((id) => (
                  <button key={id} className={save.caddie === id ? 'on' : ''} onClick={() => update((s) => ({ ...s, caddie: id }))}>
                    <img src={gAsset(id)} alt="" />
                    <span>
                      <b>{FRIEND[id].name}</b>
                      <small>{FRIEND[id].perk}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted small">Chưa có caddie. Thắng giải đầu tiên để Cừu Trắng theo bạn ra sân.</p>
            )}
          </section>
        )}

        {panel === 'records' && (
          <section className="golf-panel">
            <h4>Kỷ lục</h4>
            <p className="small">
              {Object.keys(save.best).length}/{ALL_HOLES.length} lỗ · {Object.values(save.stars).reduce((a, b) => a + b, 0)}/{ALL_HOLES.length * 3} sao · {save.holeInOnes} lần hole-in-one · đã chơi{' '}
              {save.played} lỗ
            </p>
            {WORLDS.map((w) => (
              <details key={w.id} className="golf-rec">
                <summary>
                  {w.name}: {w.holes.filter((h) => save.best[h.id]).length}/9 lỗ, {w.holes.reduce((a, h) => a + (save.stars[h.id] ?? 0), 0)} sao
                </summary>
                <table>
                  <tbody>
                    {w.holes.map((h, i) => (
                      <tr key={h.id}>
                        <td>
                          {i + 1}. {h.name}
                        </td>
                        <td className="num">par {h.par}</td>
                        <td className="num">{save.best[h.id] ?? '–'}</td>
                        <td>
                          <Stars n={save.stars[h.id] ?? 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </section>
        )}

        <div className="golf-worlds" role="tablist" aria-label="Khu sân">
          {WORLDS.map((w, wi) => {
            const open = worldOpen(save, wi)
            return (
              <button key={w.id} role="tab" aria-selected={wi === worldIdx} className={`${wi === worldIdx ? 'on' : ''} ${open ? '' : 'locked'}`} onClick={() => setWorldIdx(wi)}>
                <img src={gAsset(w.host)} alt="" />
                <span>{open ? w.name : `🔒 ${w.name}`}</span>
              </button>
            )
          })}
        </div>

        <div className={`golf-host ${world.id}`}>
          <img src={gAsset(world.host)} alt={world.hostName} />
          <div className="golf-say">
            <b>
              {world.hostName} · {world.name}
            </b>
            <span>
              {!wOpen
                ? `Khu này mở khi bạn đi hết 9 lỗ của ${WORLDS[worldIdx - 1].name}.`
                : allDone
                  ? `Bạn đã đi hết 9 lỗ với ${totalBest} gậy (par ${totalPar}). Vào Giải đấu để so tài với mình nhé!`
                  : world.hello}
            </span>
          </div>
        </div>
        <div className="golf-meta muted small">
          {totalStars}/{world.holes.length * 3} sao{save.caddie ? ` · caddie: ${FRIEND[save.caddie].name}` : ''}
        </div>
        <div className="golf-holes">
          {world.holes.map((h, i) => {
            const open = unlocked(save, world, i)
            return (
              <button key={h.id} className={`golf-hole ${open ? '' : 'locked'} ${save.best[h.id] ? 'done' : ''}`} disabled={!open} onClick={() => startHole(worldIdx, i)}>
                <img src={gAsset(open ? h.flag : 'hole_plain')} alt="" />
                <b>Lỗ {i + 1}</b>
                <span className="gh-name">{h.name}</span>
                <span className="gh-par">
                  Par {h.par}
                  {save.best[h.id] ? ` · tốt nhất ${save.best[h.id]}` : ''}
                </span>
                <Stars n={save.stars[h.id] ?? 0} />
                {!open && <span className="gh-lock">🔒</span>}
              </button>
            )
          })}
        </div>
        {wOpen && (
          <div className="golf-actions">
            <button className="golf-play" onClick={() => startHole(worldIdx, nextIdx >= 0 ? nextIdx : 0)}>
              <img src={gAsset('play_button')} alt="" />
              {nextIdx >= 0 ? `Chơi lỗ ${nextIdx + 1}` : 'Chơi lại từ lỗ 1'}
            </button>
            {tourHere ? (
              <button className="secondary" onClick={resumeTour}>
                Đánh tiếp giải (lỗ {tourHere.idx + 1})
              </button>
            ) : (
              <button className="secondary" disabled={!!save.tour} onClick={() => startTour(worldIdx)}>
                Vào giải {world.name}
              </button>
            )}
          </div>
        )}
        <div className="golf-gear">
          <img src={gAsset(save.equip.bag)} alt="Túi gậy" />
          <img src={gAsset(save.equip.club)} alt="Gậy" />
          <img src={gAsset(save.equip.ball)} alt="Bóng" />
          <span className="muted small">
            Đang dùng: {SHOP.find((x) => x.id === save.equip.club)?.name}, {SHOP.find((x) => x.id === save.equip.ball)?.name}
          </span>
        </div>
        <p className="muted small golf-help">
          Cách chơi: chạm vào sân rồi <b>kéo ngược</b> lại như kéo ná, kéo càng xa càng mạnh, thả tay để đánh. Bóng nảy vào tường được. Cát, cỏ hoa, lá thu, tuyết làm bóng chậm; băng
          trơn; suối cạn cuốn bóng đi; rơi xuống nước bị phạt 1 gậy.
        </p>
        {tourEnd && <TourEndDialog end={tourEnd} onClose={() => setTourEnd(null)} />}
      </div>
    )
  }

  // ---------- Đang chơi ----------
  const def = world.holes[holeIdx]
  const strokes = p?.strokes ?? 0
  const canHint = strokes >= (save.equip.club === 'gold_club' ? 1 : HINT_AFTER)
  const tour = p?.tour ? save.tour : null
  return (
    <div className={`golf playing ${world.id}`}>
      <div className="golf-hud">
        <button className="golf-icon-btn" onClick={() => setView('lobby')} aria-label="Về sảnh">
          <img src={gAsset('pause_button')} alt="" />
        </button>
        <div className="golf-hud-mid">
          <b>
            {p?.tour ? 'Giải · ' : ''}Lỗ {holeIdx + 1}: {def.name}
          </b>
          <span>
            Par {def.par} · Gậy <b className={strokes > def.par ? 'over' : ''}>{strokes}</b>
            {tour ? ` · ${'❤'.repeat(Math.max(0, tour.hearts))}` : save.best[def.id] ? ` · tốt nhất ${save.best[def.id]}` : ''}
          </span>
        </div>
        {!p?.tour && (
          <button className="secondary small-btn" onClick={() => startHole(worldIdx, holeIdx)}>
            Đánh lại
          </button>
        )}
        {save.caddie && <img className="golf-caddie" src={gAsset(save.caddie)} alt={`Caddie ${FRIEND[save.caddie].name}`} title={`Caddie ${FRIEND[save.caddie].name}: ${FRIEND[save.caddie].perk}`} />}
      </div>
      {toast && <div className="golf-toast in-play">{toast}</div>}
      <div className="golf-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="golf-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={`Sân lỗ ${holeIdx + 1}. Kéo ngược để ngắm và chọn lực, thả tay để đánh.`}
          role="img"
        />
        {result && (
          <div className="golf-result" role="dialog" aria-label="Kết quả lỗ">
            <img src={gAsset('victory_trophy')} alt="" />
            <h3>{result.name}</h3>
            <p>
              {result.strokes} gậy · par {result.par}
              {result.best && result.prevBest ? ` · kỷ lục mới (trước: ${result.prevBest})` : ''}
            </p>
            <Stars n={result.stars} big />
            <p className="golf-reward">
              <img src={gAsset('coin_icon')} alt="" /> +{result.coins}
              {result.gems > 0 && (
                <>
                  {' '}
                  <img src={gAsset('gem_icon')} alt="" /> +{result.gems}
                </>
              )}
            </p>
            {result.tour && (
              <p className="small">
                {result.tour.lostHeart ? 'Quá par 2 gậy: mất 1 tim. ' : ''}
                Còn {'❤'.repeat(Math.max(0, result.tour.hearts))}
                {result.tour.over === 'lose' && result.tour.hearts <= 0 ? ' · hết tim, giải dừng tại đây.' : ''}
              </p>
            )}
            <div className="golf-result-actions">
              {result.tour ? (
                result.tour.over ? (
                  <button onClick={() => setView('lobby')}>Xem kết quả giải</button>
                ) : (
                  <button onClick={() => startHole(worldIdx, result.holeIdx + 1, true)}>Lỗ tiếp theo của giải</button>
                )
              ) : (
                <>
                  {result.holeIdx + 1 < world.holes.length ? (
                    <button onClick={() => startHole(worldIdx, result.holeIdx + 1)}>Lỗ tiếp theo</button>
                  ) : (
                    <button onClick={() => setView('lobby')}>Xong {world.name}!</button>
                  )}
                  <button className="secondary" onClick={() => startHole(worldIdx, result.holeIdx)}>
                    Chơi lại lỗ này
                  </button>
                </>
              )}
              <button className="link" onClick={() => setView('lobby')}>
                Về sảnh
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="golf-bottom">
        <img className="golf-poch" src={gAsset(pose)} alt="Pochacco" />
        <div className="golf-bottom-mid">
          <div className="golf-power" aria-label={`Lực ${Math.round(power * 100)}%`}>
            <span style={{ width: `${power * 100}%` }} />
            <em>{power > 0 ? `${Math.round(power * 100)}%` : 'Lực'}</em>
          </div>
          <span className="golf-tip small">{p?.drag ? (power < 0.05 ? 'Kéo xa hơn để có lực, kéo về chỗ cũ để hủy' : 'Thả tay để đánh') : def.tip}</span>
        </div>
        {canHint && (
          <button className={`golf-hint ${showHint ? 'on' : ''}`} onClick={() => setShowHint(!showHint)} aria-pressed={showHint}>
            {showHint ? 'Tắt gợi ý' : 'Gợi ý đường bóng'}
          </button>
        )}
      </div>
    </div>
  )
}


function TourEndDialog({ end, onClose }: { end: { world: string; mine: number[]; rivals: { id: string; scores: number[] }[]; result: 'win' | 'lose'; firstWin: boolean }; onClose: () => void }) {
  const w = WORLDS.find((x) => x.id === end.world)!
  const n = end.mine.length
  const par = w.holes.slice(0, n).reduce((a, h) => a + h.par, 0)
  const rows = [
    { id: 'you', name: 'Pochacco (bạn)', img: 'victory_trophy', total: tourTotal(end.mine) },
    ...end.rivals.map((r) => ({ id: r.id, name: FRIEND[r.id].name, img: r.id, total: tourTotal(r.scores, n) })),
  ].sort((a, b) => a.total - b.total || (a.id === 'you' ? -1 : 1))
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog golf-tour-end" role="dialog" aria-label="Kết quả giải đấu">
        <h3>{end.result === 'win' ? `Vô địch giải ${w.name}!` : `Giải ${w.name} kết thúc`}</h3>
        <p className="small muted">
          Sau {n} lỗ (par {par}). {end.result === 'win' ? (end.firstWin ? `${FRIEND[w.host].name} sẽ làm caddie cho bạn.` : 'Thêm một lần vô địch!') : n < 9 ? 'Bạn đã hết tim. Thử lại nhé!' : 'Chỉ thiếu chút nữa thôi, thử lại nhé!'}
        </p>
        <ol className="golf-board">
          {rows.map((r, i) => (
            <li key={r.id} className={r.id === 'you' ? 'me' : ''}>
              <span className="gb-rank">{i + 1}</span>
              <img src={gAsset(r.img)} alt="" />
              <b>{r.name}</b>
              <span className="gb-total">
                {r.total} gậy <small>({r.total - par >= 0 ? '+' : ''}
                {r.total - par})</small>
              </span>
            </li>
          ))}
        </ol>
        <div className="dialog-actions">
          <button onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Vẽ ----------
function draw(cv: HTMLCanvasElement, p: Play, cell: number, o: DrawOpts) {
  const hint = o.hint
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const scale = cv.width / (cell * COLS)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const W = cell * COLS
  const Hh = cell * ROWS
  ctx.clearRect(0, 0, W, Hh)
  // nền
  const g = ctx.createLinearGradient(0, 0, 0, Hh)
  g.addColorStop(0, '#e6f1d4')
  g.addColorStop(1, '#d3e7bd')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, Hh)
  const c = p.course
  // ô sân
  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++) {
      const s = c.cell[r][col]
      if (!s) continue
      const im = img(SURFACE[s].tile)
      const pad = cell * 0.04
      const x0 = col * cell
      const y0 = r * cell
      if (ready(im)) ctx.drawImage(im, x0 - pad, y0 - pad, cell + pad * 2, cell + pad * 2)
      else {
        ctx.fillStyle = s === 'w' || s === 'b' ? '#7cc7ea' : s === 's' ? '#ecd9a8' : '#8fc65a'
        ctx.fillRect(x0, y0, cell, cell)
      }
      if (s === 'i') {
        // băng: phủ trắng mờ lên mặt nước, vài vết nứt
        ctx.fillStyle = 'rgba(240,250,255,0.62)'
        ctx.beginPath()
        ctx.roundRect(x0 + cell * 0.06, y0 + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.16)
        ctx.fill()
        ctx.strokeStyle = 'rgba(150,200,230,0.8)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x0 + cell * 0.25, y0 + cell * 0.3)
        ctx.lineTo(x0 + cell * 0.45, y0 + cell * 0.45)
        ctx.lineTo(x0 + cell * 0.4, y0 + cell * 0.7)
        ctx.moveTo(x0 + cell * 0.45, y0 + cell * 0.45)
        ctx.lineTo(x0 + cell * 0.72, y0 + cell * 0.5)
        ctx.stroke()
      }
      const push = SURFACE[s].push
      if (push) {
        // suối cạn: nước nhạt hơn, mũi tên trôi theo dòng
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.beginPath()
        ctx.roundRect(x0 + cell * 0.06, y0 + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.16)
        ctx.fill()
        const ph = (p.t * 0.9) % 1
        ctx.save()
        ctx.translate(x0 + cell / 2, y0 + cell / 2)
        ctx.rotate(Math.atan2(push[1], push[0]))
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = Math.max(1.5, cell * 0.06)
        ctx.lineCap = 'round'
        for (const k of [-0.5, 0]) {
          const ax = (k + ph) * cell * 0.9
          ctx.globalAlpha = 1 - Math.abs(k + ph - 0.25) * 1.3
          ctx.beginPath()
          ctx.moveTo(ax - cell * 0.12, -cell * 0.14)
          ctx.lineTo(ax + cell * 0.04, 0)
          ctx.lineTo(ax - cell * 0.12, cell * 0.14)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.restore()
      }
    }
  // cầu gỗ: mỗi dải ô cầu theo cột vẽ một cây cầu xoay dọc
  const br = img('wood_bridge')
  if (ready(br))
    for (let col = 0; col < COLS; col++)
      for (let r = 0; r < ROWS; r++) {
        if (c.cell[r][col] !== 'b' || c.cell[r - 1]?.[col] === 'b') continue
        let n = 1
        while (c.cell[r + n]?.[col] === 'b') n++
        const len = (n + 0.5) * cell
        const wid = cell * 1.05
        ctx.save()
        ctx.translate((col + 0.5) * cell, (r + n / 2) * cell)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(br, -len / 2, -wid / 2, len, wid)
        ctx.restore()
      }
  // chỗ phát bóng
  const tee = img(o.tee)
  if (ready(tee) && p.strokes === 0 && p.phase === 'aim') ctx.drawImage(tee, c.tee.x * cell - cell * 0.12, c.tee.y * cell - cell * 0.05, cell * 0.24, cell * 0.4)
  // lỗ
  const hole = img('hole_plain')
  const hw = cell * 0.78
  if (ready(hole)) ctx.drawImage(hole, c.hole.x * cell - hw / 2, c.hole.y * cell - hw * 0.44, hw, hw * 0.88)
  else {
    ctx.fillStyle = '#4a3a2a'
    ctx.beginPath()
    ctx.arc(c.hole.x * cell, c.hole.y * cell, HOLE_R * cell, 0, Math.PI * 2)
    ctx.fill()
  }
  // vật cản, xếp theo chiều sâu
  const obs = [...c.def.obstacles].sort((a, b) => a.y - b.y)
  for (const o of obs) {
    const d = OBSTACLE[o.k]
    const im = img(o.k)
    if (!ready(im)) continue
    const w = d.w * cell
    const h = (w * im.naturalHeight) / im.naturalWidth
    if (o.k === 'windmill') continue // vẽ sau quả bóng để bóng chui vào đường hầm
    ctx.drawImage(im, o.x * cell - w / 2, (o.y + d.r * 0.75) * cell - h, w, h)
  }
  // cờ
  const flag = img(c.def.flag)
  if (ready(flag)) {
    const fw = cell * 0.78
    const fh = (fw * flag.naturalHeight) / flag.naturalWidth
    const near = Math.hypot(p.ball.x - c.hole.x, p.ball.y - c.hole.y) < 1.3
    ctx.globalAlpha = near ? 0.45 : 1
    ctx.drawImage(flag, c.hole.x * cell - fw * 0.42, c.hole.y * cell - fh * 0.95, fw, fh)
    ctx.globalAlpha = 1
  }
  // hiệu ứng
  for (const f of p.fx) {
    const a = 1 - (p.t - f.at) / 1.2
    ctx.globalAlpha = Math.max(0, a)
    if (f.kind === 'cloud' || f.kind === 'splash') {
      const im = img('cloud_effect')
      const w = cell * (0.8 + (1 - a) * 0.6)
      if (ready(im)) ctx.drawImage(im, f.x * cell - w / 2, f.y * cell - w * 0.45, w, w * 0.65)
      if (f.kind === 'splash') {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        for (let k = 1; k <= 2; k++) {
          ctx.beginPath()
          ctx.ellipse(f.x * cell, f.y * cell, cell * 0.25 * k * (1.4 - a), cell * 0.15 * k * (1.4 - a), 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    } else if (f.text) {
      ctx.font = `700 ${Math.round(cell * 0.38)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = '#c0392b'
      const y = (f.y - (1 - a) * 0.6) * cell
      ctx.strokeText(f.text, f.x * cell, y)
      ctx.fillText(f.text, f.x * cell, y)
    }
    ctx.globalAlpha = 1
  }
  // ngắm
  const b = p.ball
  if (p.drag && p.phase === 'aim') {
    const dx = p.drag.sx - p.drag.cx
    const dy = p.drag.sy - p.drag.cy
    const len = Math.hypot(dx, dy)
    const pw = Math.min(1, len / MAX_DRAG)
    if (pw >= 0.05) {
      const ux = dx / len
      const uy = dy / len
      const vm = vmaxOf(o.club)
      if (hint) {
        const sim = simulate(c, { x: b.x, y: b.y, vx: ux * pw * vm, vy: uy * pw * vm }, p.t + IMPACT_FRAME * FRAME_MS / 1000, 8, o.mods)
        ctx.fillStyle = sim.end === 'sink' ? 'rgba(80,170,60,0.85)' : sim.end === 'water' ? 'rgba(60,140,220,0.8)' : 'rgba(255,255,255,0.75)'
        for (const q of sim.pts) {
          ctx.beginPath()
          ctx.arc(q.x * cell, q.y * cell, cell * 0.05, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        const L = (0.9 + pw * 4.2) * (o.club === 'blue_club' ? 1.35 : 1)
        const pink = o.club === 'pink_club'
        for (let s = 0.45; s < L; s += 0.36) {
          ctx.fillStyle = pink ? `rgba(240,120,170,${0.95 - (s / L) * 0.6})` : `rgba(255,255,255,${0.95 - (s / L) * 0.6})`
          ctx.beginPath()
          ctx.arc((b.x + ux * s) * cell, (b.y + uy * s) * cell, cell * 0.065, 0, Math.PI * 2)
          ctx.fill()
        }
        const ai = img('aiming_ball')
        if (ready(ai)) {
          ctx.globalAlpha = 0.55
          const aw = cell * 0.4
          ctx.drawImage(ai, (b.x + ux * L) * cell - aw / 2, (b.y + uy * L) * cell - aw / 2, aw, aw)
          ctx.globalAlpha = 1
        }
        if (pink) {
          // gậy hồng: bóng mờ ở chỗ bóng sẽ dừng
          const sim = simulate(c, { x: b.x, y: b.y, vx: ux * pw * vm, vy: uy * pw * vm }, p.t + IMPACT_FRAME * FRAME_MS / 1000, 8, o.mods)
          const e = sim.pts[sim.pts.length - 1]
          ctx.strokeStyle = 'rgba(240,120,170,0.9)'
          ctx.setLineDash([3, 3])
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(e.x * cell, e.y * cell, cell * 0.22, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      // dây kéo phía sau bóng
      ctx.strokeStyle = pw > 0.85 ? '#e0533b' : pw > 0.5 ? '#e9a93b' : '#7fb04a'
      ctx.lineWidth = Math.max(2, cell * 0.08)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(b.x * cell, b.y * cell)
      ctx.lineTo((b.x - ux * pw * 1.6) * cell, (b.y - uy * pw * 1.6) * cell)
      ctx.stroke()
    }
  }
  // bóng
  const sp = Math.hypot(b.vx, b.vy)
  let size = BALL_R * 2.5 * cell
  if (p.phase === 'sunk') size *= Math.max(0, 1 - (p.t - p.sinkAt) * 2.2)
  if (p.phase === 'water') size *= Math.max(0, 1 - (p.t - p.sinkAt) * 2.5)
  if (size > 0.5) {
    ctx.fillStyle = 'rgba(40,60,20,0.25)'
    ctx.beginPath()
    ctx.ellipse(b.x * cell + cell * 0.04, b.y * cell + cell * 0.1, size * 0.42, size * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    const fast = img(o.ball === 'lightning_ball' ? 'golden_fast_ball' : 'blue_fast_ball')
    if (sp > VMAX * 0.62 && ready(fast)) {
      // ảnh hiệu ứng có vệt hướng về góc dưới trái, bóng ở góc trên phải
      const ang = Math.atan2(b.vy, b.vx) - Math.atan2(-0.55, 1)
      const w = cell * 1.2
      ctx.save()
      ctx.translate(b.x * cell, b.y * cell)
      ctx.rotate(ang)
      ctx.drawImage(fast, -w * 0.82, -w * 0.22, w, (w * fast.naturalHeight) / fast.naturalWidth)
      ctx.restore()
    } else {
      const bi = img(o.ball)
      if (ready(bi)) ctx.drawImage(bi, b.x * cell - size / 2, b.y * cell - size / 2, size, size)
      else {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(b.x * cell, b.y * cell, size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // cối xay gió vẽ đè lên bóng: bóng chui vào cửa, khuất trong nhà rồi ra phía sau
  for (const o of c.def.obstacles) {
    if (o.k !== 'windmill') continue
    const im = img('windmill')
    const w = OBSTACLE.windmill.w * cell
    if (ready(im)) {
      const h = (w * im.naturalHeight) / im.naturalWidth
      ctx.drawImage(im, o.x * cell - w * 0.55, (o.y + 0.62) * cell - h * 0.95, w, h)
    }
    // cửa gỗ: hạ xuống là đóng
    const k = millClosed(p.t)
    const gy = (o.y + 0.25) * cell
    ctx.fillStyle = '#6b4424'
    ctx.fillRect((o.x - 0.5) * cell, gy - cell * 0.3, cell * 0.08, cell * 0.55)
    ctx.fillRect((o.x + 0.42) * cell, gy - cell * 0.3, cell * 0.08, cell * 0.55)
    if (k > 0.02) {
      const ph = cell * 0.2
      const y = gy - cell * 0.3 + (cell * 0.3 + ph * 0) * k
      ctx.fillStyle = '#b07a45'
      ctx.strokeStyle = '#6b4424'
      ctx.lineWidth = Math.max(1, cell * 0.035)
      ctx.beginPath()
      ctx.roundRect((o.x - 0.46) * cell, y, cell * 0.92, ph, cell * 0.05)
      ctx.fill()
      ctx.stroke()
    }
    ctx.fillStyle = k > 0.5 ? '#e0533b' : '#6fbf4a'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc((o.x + 0.62) * cell, gy - cell * 0.35, cell * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}
