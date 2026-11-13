import { useCallback, useEffect, useRef, useState } from 'react'
import { readConfigFile, writeConfigFile } from '../../data/configStore'
import type { StoreConfig } from '../../data/githubStore'
import {
  ALL_HOLES, BALL_R, COLS, HOLE_R, OBSTACLE, ROWS, SURFACE, VMAX, WORLDS,
  coinsFor, gAsset, levelOf, millClosed, moving, newGolf, parseCourse, parseGolf, resultName, simulate, starsFor, step, unlocked,
  type Ball, type Course, type GolfSave,
} from './golf'

const LOCAL_KEY = 'pochacco-library:golf'
const CLOUD_FILE = 'golf'
const CLOUD_DELAY = 20_000
const SWING_FRAMES = Array.from({ length: 12 }, (_, i) => `swing_${String(i + 1).padStart(2, '0')}`)
const FRAME_MS = 45
const IMPACT_FRAME = 6
const HINT_AFTER = 4
const MAX_DRAG = 3.2 // ô

type Fx = { kind: 'cloud' | 'splash' | 'text'; x: number; y: number; at: number; text?: string }
type Play = {
  course: Course
  ball: Ball
  t: number
  strokes: number
  from: { x: number; y: number }
  phase: 'aim' | 'swing' | 'roll' | 'water' | 'sunk'
  swingAt: number
  pending: { vx: number; vy: number } | null
  sinkAt: number
  fx: Fx[]
  drag: { sx: number; sy: number; cx: number; cy: number } | null
}
type Result = { holeIdx: number; strokes: number; par: number; name: string; stars: number; coins: number; gems: number; best: boolean; prevBest?: number }

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

export default function GolfGame({ cfg }: { cfg: StoreConfig }) {
  const [save, setSave] = useState<GolfSave>(() => loadLocal() ?? newGolf())
  const saveRef = useRef(save)
  saveRef.current = save
  const shaRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const [loaded, setLoaded] = useState(false)

  const world = WORLDS[0]
  const [view, setView] = useState<'lobby' | 'play'>('lobby')
  const [holeIdx, setHoleIdx] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [, force] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [power, setPower] = useState(0)
  const play = useRef<Play | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const cellRef = useRef(36)

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

  // Tải trước ảnh
  useEffect(() => {
    const names = [
      ...Object.values(SURFACE).map((s) => s.tile), 'hole_plain', 'mint_tee', 'cloud_effect', 'blue_fast_ball', 'aiming_ball', 'plain_ball',
      ...Object.keys(OBSTACLE), ...ALL_HOLES.map((h) => h.flag), ...SWING_FRAMES, 'ready', 'address_ball', 'follow_through', 'victory_trophy', 'idle',
    ]
    for (const n of names) img(n)
  }, [])

  // ---------- Bắt đầu một lỗ ----------
  const startHole = (i: number) => {
    const course = parseCourse(world.holes[i])
    play.current = {
      course,
      ball: { x: course.tee.x, y: course.tee.y, vx: 0, vy: 0 },
      t: 0,
      strokes: 0,
      from: { ...course.tee },
      phase: 'aim',
      swingAt: 0,
      pending: null,
      sinkAt: 0,
      fx: [],
      drag: null,
    }
    setHoleIdx(i)
    setResult(null)
    setShowHint(false)
    setPower(0)
    setView('play')
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
    const strokes = p.strokes
    const prev = saveRef.current.best[def.id]
    const stars = starsFor(strokes, def.par)
    const prevStars = saveRef.current.stars[def.id] ?? 0
    // Thưởng đủ khi lần đầu qua lỗ hoặc phá kỷ lục, chơi lại thì thưởng ít.
    const improved = prev === undefined || strokes < prev
    const coins = improved ? coinsFor(strokes, def.par) : 5
    const gems = strokes === 1 && prev !== 1 ? 3 : 0
    update((s) => ({
      ...s,
      coins: s.coins + coins,
      gems: s.gems + gems,
      xp: s.xp + 10 + Math.max(0, def.par - strokes + 1) * 5,
      best: { ...s.best, [def.id]: prev === undefined ? strokes : Math.min(prev, strokes) },
      stars: { ...s.stars, [def.id]: Math.max(prevStars, stars) },
      holeInOnes: s.holeInOnes + (strokes === 1 ? 1 : 0),
      played: s.played + 1,
    }))
    setResult({ holeIdx: world.holes.indexOf(def), strokes, par: def.par, name: resultName(strokes, def.par), stars, coins, gems, best: improved && prev !== undefined, prevBest: prev })
  }, [world])

  // ---------- Vòng lặp: vật lý + vẽ ----------
  useEffect(() => {
    if (!inPlay) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const p = play.current
      const cv = canvasRef.current
      if (p && cv) {
        const dt = Math.min(0.05, (now - last) / 1000)
        p.t += dt
        // Cú đánh: chờ tới khung chạm bóng rồi mới cho bóng lăn
        if (p.phase === 'swing' && p.pending && now - p.swingAt >= IMPACT_FRAME * FRAME_MS) {
          p.ball.vx = p.pending.vx
          p.ball.vy = p.pending.vy
          p.pending = null
          p.phase = 'roll'
        }
        if (p.phase === 'roll' || (p.phase === 'swing' && !p.pending)) {
          p.phase = 'roll'
          const sub = 4
          for (let k = 0; k < sub; k++) {
            const ev = step(p.course, p.ball, dt / sub, p.t)
            if (ev === 'sand') p.fx.push({ kind: 'cloud', x: p.ball.x, y: p.ball.y, at: p.t })
            if (ev === 'water') {
              p.phase = 'water'
              p.strokes += 1
              p.fx.push({ kind: 'splash', x: p.ball.x, y: p.ball.y, at: p.t }, { kind: 'text', x: p.ball.x, y: p.ball.y - 0.4, at: p.t, text: 'Tõm! +1 gậy' })
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
          if (p.phase === 'roll' && !moving(p.ball)) {
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
        draw(cv, p, cellRef.current, now, showHintRef.current, saveRef.current.ball)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inPlay, finishHole])
  const showHintRef = useRef(false)
  showHintRef.current = showHint

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
    p.pending = { vx: (dx / len) * pw * VMAX, vy: (dy / len) * pw * VMAX }
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

  const lv = levelOf(save.xp)
  const totalStars = world.holes.reduce((s, h) => s + (save.stars[h.id] ?? 0), 0)
  const nextIdx = world.holes.findIndex((h, i) => unlocked(save, world, i) && !save.best[h.id])
  const allDone = world.holes.every((h) => save.best[h.id])
  const totalBest = allDone ? world.holes.reduce((s, h) => s + save.best[h.id], 0) : 0
  const totalPar = world.holes.reduce((s, h) => s + h.par, 0)

  // ---------- Sảnh ----------
  if (view === 'lobby')
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
        <div className="golf-host">
          <img src={gAsset(world.host)} alt={world.hostName} />
          <div className="golf-say">
            <b>
              {world.hostName} · {world.name}
            </b>
            <span>{allDone ? `Bạn đã đi hết ${world.holes.length} lỗ với ${totalBest} gậy (par ${totalPar}). Thử phá kỷ lục từng lỗ nhé!` : world.hello}</span>
          </div>
        </div>
        <div className="golf-meta muted small">
          {totalStars}/{world.holes.length * 3} sao · {save.holeInOnes} lần hole-in-one · đã chơi {save.played} lỗ
        </div>
        <div className="golf-holes">
          {world.holes.map((h, i) => {
            const open = unlocked(save, world, i)
            const st = save.stars[h.id] ?? 0
            return (
              <button key={h.id} className={`golf-hole ${open ? '' : 'locked'} ${save.best[h.id] ? 'done' : ''}`} disabled={!open} onClick={() => startHole(i)}>
                <img src={gAsset(open ? h.flag : 'hole_plain')} alt="" />
                <b>Lỗ {i + 1}</b>
                <span className="gh-name">{h.name}</span>
                <span className="gh-par">
                  Par {h.par}
                  {save.best[h.id] ? ` · tốt nhất ${save.best[h.id]}` : ''}
                </span>
                <span className="gh-stars" aria-label={`${st} sao`}>
                  {[0, 1, 2].map((k) => (
                    <span key={k} className={k < st ? 'on' : ''}>
                      ★
                    </span>
                  ))}
                </span>
                {!open && <span className="gh-lock">🔒</span>}
              </button>
            )
          })}
        </div>
        <button className="golf-play" onClick={() => startHole(nextIdx >= 0 ? nextIdx : 0)}>
          <img src={gAsset('play_button')} alt="" />
          {nextIdx >= 0 ? `Chơi lỗ ${nextIdx + 1}` : 'Chơi lại từ lỗ 1'}
        </button>
        <p className="muted small golf-help">
          Cách chơi: chạm vào sân rồi <b>kéo ngược</b> lại như kéo ná, kéo càng xa càng mạnh, thả tay để đánh. Bóng nảy vào tường được. Cát làm bóng chậm, rơi xuống nước bị phạt 1
          gậy. Không giới hạn số gậy, cứ thong thả.
        </p>
      </div>
    )

  // ---------- Đang chơi ----------
  const def = world.holes[holeIdx]
  const strokes = p?.strokes ?? 0
  const canHint = strokes >= HINT_AFTER
  return (
    <div className="golf playing">
      <div className="golf-hud">
        <button className="golf-icon-btn" onClick={() => setView('lobby')} aria-label="Về sảnh">
          <img src={gAsset('pause_button')} alt="" />
        </button>
        <div className="golf-hud-mid">
          <b>
            Lỗ {holeIdx + 1}: {def.name}
          </b>
          <span>
            Par {def.par} · Gậy <b className={strokes > def.par ? 'over' : ''}>{strokes}</b>
            {save.best[def.id] ? ` · tốt nhất ${save.best[def.id]}` : ''}
          </span>
        </div>
        <button className="secondary small-btn" onClick={() => startHole(holeIdx)}>
          Đánh lại
        </button>
      </div>
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
            <div className="gh-stars big">
              {[0, 1, 2].map((k) => (
                <span key={k} className={k < result.stars ? 'on' : ''}>
                  ★
                </span>
              ))}
            </div>
            <p className="golf-reward">
              <img src={gAsset('coin_icon')} alt="" /> +{result.coins}
              {result.gems > 0 && (
                <>
                  {' '}
                  <img src={gAsset('gem_icon')} alt="" /> +{result.gems}
                </>
              )}
            </p>
            <div className="golf-result-actions">
              {result.holeIdx + 1 < world.holes.length ? (
                <button onClick={() => startHole(result.holeIdx + 1)}>Lỗ tiếp theo</button>
              ) : (
                <button onClick={() => setView('lobby')}>Xong {world.name}!</button>
              )}
              <button className="secondary" onClick={() => startHole(result.holeIdx)}>
                Chơi lại lỗ này
              </button>
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

// ---------- Vẽ ----------
function draw(cv: HTMLCanvasElement, p: Play, cell: number, now: number, hint: boolean, ballName: string) {
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
      if (ready(im)) ctx.drawImage(im, col * cell - pad, r * cell - pad, cell + pad * 2, cell + pad * 2)
      else {
        ctx.fillStyle = s === 'w' ? '#7cc7ea' : s === 's' ? '#ecd9a8' : '#8fc65a'
        ctx.fillRect(col * cell, r * cell, cell, cell)
      }
    }
  // chỗ phát bóng
  const tee = img('mint_tee')
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
      if (hint) {
        const sim = simulate(c, { x: b.x, y: b.y, vx: ux * pw * VMAX, vy: uy * pw * VMAX }, p.t + IMPACT_FRAME * FRAME_MS / 1000)
        ctx.fillStyle = sim.end === 'sink' ? 'rgba(80,170,60,0.85)' : sim.end === 'water' ? 'rgba(60,140,220,0.8)' : 'rgba(255,255,255,0.75)'
        for (const q of sim.pts) {
          ctx.beginPath()
          ctx.arc(q.x * cell, q.y * cell, cell * 0.05, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        const L = 0.9 + pw * 4.2
        for (let s = 0.45; s < L; s += 0.36) {
          ctx.fillStyle = `rgba(255,255,255,${0.95 - (s / L) * 0.6})`
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
    const fast = img('blue_fast_ball')
    if (sp > VMAX * 0.62 && ready(fast)) {
      // ảnh hiệu ứng có vệt hướng về góc dưới trái, bóng ở góc trên phải
      const ang = Math.atan2(b.vy, b.vx) - Math.atan2(-0.55, 1)
      const w = cell * 1.2
      ctx.save()
      ctx.translate(b.x * cell, b.y * cell)
      ctx.rotate(ang)
      ctx.drawImage(fast, -w * 0.82, -w * 0.22, w, (w * 75) / 129)
      ctx.restore()
    } else {
      const bi = img(ballName)
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
  void now
}
