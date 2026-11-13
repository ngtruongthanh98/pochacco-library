import { useCallback, useEffect, useRef, useState } from 'react'

const asset = (n: string) => `${import.meta.env.BASE_URL}assets/${n}`
const BEST_KEY = 'pochacco-library:game-best'

type Kind = 'book-red' | 'book-green' | 'book-open' | 'star-gold' | 'star-red' | 'bow' | 'ink'
type Item = { kind: Kind; x: number; y: number; vy: number; size: number; rot: number; vr: number }
type Pop = { x: number; y: number; text: string; color: string; t: number }
type Spark = { x: number; y: number; vx: number; vy: number; t: number }

// Điểm, tỉ lệ xuất hiện, và có mất mạng khi rơi xuống đất hay không.
const KINDS: Record<Kind, { pts: number; weight: number; mustCatch: boolean; size: number }> = {
  'book-red': { pts: 1, weight: 34, mustCatch: true, size: 1 },
  'book-green': { pts: 1, weight: 30, mustCatch: true, size: 1 },
  'book-open': { pts: 2, weight: 14, mustCatch: true, size: 1.05 },
  'star-gold': { pts: 5, weight: 6, mustCatch: false, size: 0.8 },
  'star-red': { pts: 10, weight: 2.5, mustCatch: false, size: 0.8 },
  bow: { pts: 0, weight: 2.5, mustCatch: false, size: 0.85 },
  ink: { pts: 0, weight: 11, mustCatch: false, size: 0.8 },
}
const MAX_LIVES = 5

export const rankOf = (score: number) =>
  score >= 250 ? 'Đại thủ thư' : score >= 150 ? 'Thủ thư trưởng' : score >= 80 ? 'Thủ thư lành nghề' : score >= 30 ? 'Thủ thư tập sự' : 'Bạn đọc mới'

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })

/** Vẽ giọt mực (vật cản) bằng đường cong, không cần hình. */
function drawInk(ctx: CanvasRenderingContext2D, r: number, t: number) {
  ctx.beginPath()
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
    const rr = r * (0.82 + 0.18 * Math.sin(a * 3 + t * 4))
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr + (a > Math.PI * 1.25 && a < Math.PI * 1.75 ? -r * 0.35 : 0)
    if (a === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#2b2440'
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.12)
  ctx.strokeStyle = '#120e1f'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2)
  ctx.fill()
}

export default function CatchGame() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const catcherRef = useRef<HTMLDivElement>(null)
  const sprites = useRef<Partial<Record<Kind | 'sparkle', HTMLImageElement>>>({})
  const [phase, setPhase] = useState<'ready' | 'play' | 'pause' | 'over'>('ready')
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 })
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0) || 0)
  const [newBest, setNewBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Trạng thái trò chơi để trong ref, chỉ đẩy lên React khi điểm/mạng đổi.
  const g = useRef({
    items: [] as Item[],
    pops: [] as Pop[],
    sparks: [] as Spark[],
    x: 0.5, // vị trí Pochacco (0..1)
    target: 0.5,
    keys: { left: false, right: false },
    score: 0,
    lives: 3,
    time: 0,
    spawnIn: 0.6,
    hurt: 0,
    last: 0,
    lvl: 1,
    w: 0,
    h: 0,
  })

  useEffect(() => {
    const names: (Kind | 'sparkle')[] = ['book-red', 'book-green', 'book-open', 'star-gold', 'star-red', 'bow', 'sparkle']
    names.forEach((n) => void loadImg(asset(`game/${n}.webp`)).then((i) => (sprites.current[n] = i)))
  }, [])

  const reset = useCallback(() => {
    Object.assign(g.current, { items: [], pops: [], sparks: [], x: 0.5, target: 0.5, score: 0, lives: 3, time: 0, spawnIn: 0.6, hurt: 0, last: 0, lvl: 1 })
    setHud({ score: 0, lives: 3, level: 1 })
    setNewBest(false)
  }, [])

  const start = () => {
    reset()
    setPhase('play')
    wrapRef.current?.focus({ preventScroll: true })
    wrapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // Kích thước khung
  useEffect(() => {
    const el = wrapRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = el.clientWidth
      const h = el.clientHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      cv.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.current.w = w
      g.current.h = h
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    return () => ro.disconnect()
  }, [])

  // Điều khiển: chuột/chạm kéo, phím mũi tên hoặc A/D, Esc/P để tạm dừng
  useEffect(() => {
    const el = wrapRef.current!
    const setTarget = (clientX: number) => {
      const r = el.getBoundingClientRect()
      g.current.target = Math.min(0.96, Math.max(0.04, (clientX - r.left) / r.width))
    }
    const onMove = (e: PointerEvent) => {
      if (phaseRef.current === 'play') setTarget(e.clientX)
    }
    const onDown = (e: PointerEvent) => {
      if (phaseRef.current === 'play') {
        setTarget(e.clientX)
        el.setPointerCapture?.(e.pointerId)
      }
    }
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') g.current.keys.left = down
      else if (k === 'arrowright' || k === 'd') g.current.keys.right = down
      else if (down && (k === 'escape' || k === 'p')) {
        setPhase((p) => (p === 'play' ? 'pause' : p === 'pause' ? 'play' : p))
        return
      } else if (down && (k === ' ' || k === 'enter') && phaseRef.current !== 'play') {
        e.preventDefault()
        if (phaseRef.current === 'pause') setPhase('play')
        else start()
        return
      } else return
      e.preventDefault()
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    const onHide = () => document.hidden && setPhase((p) => (p === 'play' ? 'pause' : p))
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('keydown', kd)
    el.addEventListener('keyup', ku)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('keydown', kd)
      el.removeEventListener('keyup', ku)
      document.removeEventListener('visibilitychange', onHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Vòng lặp chính
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    const s = g.current
    s.last = performance.now()
    const ctx = canvasRef.current!.getContext('2d')!
    const pick = (): Kind => {
      const pool = (Object.keys(KINDS) as Kind[]).filter((k) => k !== 'ink' || s.time > 8)
      const total = pool.reduce((a, k) => a + KINDS[k].weight, 0)
      let r = Math.random() * total
      for (const k of pool) if ((r -= KINDS[k].weight) <= 0) return k
      return 'book-red'
    }
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000)
      s.last = now
      s.time += dt
      const { w, h } = s
      const level = 1 + Math.floor(s.time / 15)
      const unit = Math.min(w, h * 1.2) / 9 // cỡ chuẩn của một cuốn sách
      const catcherW = unit * 2.4
      // Tay Pochacco ở khoảng giữa hình; hình vuông, đặt cách đáy 2%.
      const catcherY = h * 0.98 - catcherW * 0.55

      // Di chuyển Pochacco
      const keyDir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0)
      if (keyDir) s.target = Math.min(0.96, Math.max(0.04, s.target + keyDir * dt * 0.95))
      s.x += (s.target - s.x) * Math.min(1, dt * 14)
      if (catcherRef.current) {
        catcherRef.current.style.transform = `translateX(${s.x * w - catcherW / 2}px) scaleX(${s.target < s.x - 0.002 ? -1 : 1})`
        catcherRef.current.style.width = `${catcherW}px`
        catcherRef.current.classList.toggle('hurt', s.hurt > 0)
      }
      s.hurt = Math.max(0, s.hurt - dt)

      // Sinh vật rơi; nhanh dần theo thời gian
      s.spawnIn -= dt
      if (s.spawnIn <= 0) {
        const kind = pick()
        const size = unit * KINDS[kind].size
        s.items.push({ kind, size, x: size / 2 + Math.random() * (w - size), y: -size, vy: h * (0.26 + 0.035 * (level - 1)) * (0.85 + Math.random() * 0.3), rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 1.6 })
        s.spawnIn = Math.max(0.32, 0.95 - (level - 1) * 0.07) * (0.7 + Math.random() * 0.6)
      }

      let changed = false
      const left = s.x * w - catcherW * 0.4
      const right = s.x * w + catcherW * 0.4
      s.items = s.items.filter((it) => {
        it.y += it.vy * dt
        it.rot += it.vr * dt
        const meta = KINDS[it.kind]
        // Chạm tay Pochacco
        if (it.y + it.size * 0.3 >= catcherY && it.y - it.size * 0.3 <= catcherY + unit * 0.6 && it.x >= left && it.x <= right) {
          if (it.kind === 'ink') {
            s.lives -= 1
            s.hurt = 0.6
            s.pops.push({ x: it.x, y: catcherY, text: 'Bẩn sách! −1 ♥', color: '#3a2f5a', t: 1 })
          } else if (it.kind === 'bow') {
            s.lives = Math.min(MAX_LIVES, s.lives + 1)
            s.pops.push({ x: it.x, y: catcherY, text: '+1 ♥', color: '#bf2c27', t: 1 })
          } else {
            s.score += meta.pts
            s.pops.push({ x: it.x, y: catcherY, text: `+${meta.pts}`, color: meta.pts >= 5 ? '#c98a12' : '#615e29', t: 1 })
            if (meta.pts >= 5) for (let i = 0; i < 8; i++) s.sparks.push({ x: it.x, y: catcherY, vx: (Math.random() - 0.5) * unit * 6, vy: -Math.random() * unit * 6, t: 0.8 })
          }
          changed = true
          return false
        }
        // Rơi xuống đất
        if (it.y - it.size > h) {
          if (meta.mustCatch) {
            s.lives -= 1
            s.hurt = 0.4
            s.pops.push({ x: it.x, y: h - unit * 0.4, text: 'Rơi sách! −1 ♥', color: '#bf2c27', t: 1 })
            changed = true
          }
          return false
        }
        return true
      })

      // Vẽ
      ctx.clearRect(0, 0, w, h)
      // sàn thảm đỏ
      ctx.fillStyle = 'rgba(191, 44, 39, 0.9)'
      ctx.beginPath()
      ctx.ellipse(w / 2, h + unit * 0.2, w * 0.62, unit * 0.75, 0, Math.PI, 0)
      ctx.fill()
      ctx.strokeStyle = '#e9a93b'
      ctx.lineWidth = 3
      ctx.stroke()
      for (const it of s.items) {
        ctx.save()
        ctx.translate(it.x, it.y)
        ctx.rotate(it.rot)
        if (it.kind === 'ink') drawInk(ctx, it.size * 0.45, s.time)
        else {
          const img = sprites.current[it.kind]
          if (img) {
            const sc = it.size / Math.max(img.width, img.height)
            ctx.drawImage(img, (-img.width * sc) / 2, (-img.height * sc) / 2, img.width * sc, img.height * sc)
          }
        }
        ctx.restore()
      }
      const sp = sprites.current.sparkle
      s.sparks = s.sparks.filter((p) => {
        p.t -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += unit * 12 * dt
        if (sp) {
          ctx.globalAlpha = Math.max(0, p.t / 0.8)
          ctx.drawImage(sp, p.x - unit * 0.18, p.y - unit * 0.18, unit * 0.36, unit * 0.36)
          ctx.globalAlpha = 1
        }
        return p.t > 0
      })
      ctx.textAlign = 'center'
      ctx.font = `800 ${Math.round(unit * 0.38)}px system-ui, sans-serif`
      s.pops = s.pops.filter((p) => {
        p.t -= dt * 1.2
        ctx.globalAlpha = Math.max(0, p.t)
        ctx.fillStyle = p.color
        ctx.fillText(p.text, p.x, p.y - (1 - p.t) * unit * 1.2)
        ctx.globalAlpha = 1
        return p.t > 0
      })

      if (changed || level !== s.lvl) {
        s.lvl = level
        setHud({ score: s.score, lives: Math.max(0, s.lives), level })
      }
      if (s.lives <= 0) {
        if (s.score > best) {
          localStorage.setItem(BEST_KEY, String(s.score))
          setBest(s.score)
          setNewBest(true)
        }
        setPhase('over')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="catch">
      <div className="catch-hud">
        <span className="hud-score">
          Điểm <b>{hud.score}</b>
        </span>
        <span className="hud-lives" aria-label={`Còn ${hud.lives} mạng`}>
          {Array.from({ length: Math.max(3, hud.lives) }, (_, i) => (
            <span key={i} className={i < hud.lives ? 'heart on' : 'heart'}>
              ♥
            </span>
          ))}
        </span>
        <span className="muted">Cấp {hud.level}</span>
        <span className="muted">Kỷ lục {best}</span>
        {(phase === 'play' || phase === 'pause') && (
          <button className="pg" onClick={() => setPhase(phase === 'play' ? 'pause' : 'play')} aria-label={phase === 'play' ? 'Tạm dừng' : 'Chơi tiếp'}>
            {phase === 'play' ? '❚❚' : '▶'}
          </button>
        )}
      </div>
      <div className="catch-stage" ref={wrapRef} tabIndex={0} aria-label="Khung trò chơi Pochacco hứng sách">
        <canvas ref={canvasRef} />
        <div className="catcher" ref={catcherRef} aria-hidden="true">
          <picture>
            <source srcSet={asset('anim-carry-still.webp')} media="(prefers-reduced-motion: reduce)" />
            <img src={asset('anim-carry.webp')} alt="" draggable={false} />
          </picture>
        </div>
        {phase !== 'play' && (
          <div className="catch-overlay">
            {phase === 'ready' && (
              <>
                <h3>Pochacco hứng sách</h3>
                <ul className="catch-rules">
                  <li>
                    <img src={asset('game/book-red.webp')} alt="" /> <img src={asset('game/book-green.webp')} alt="" /> sách: +1 · <img src={asset('game/book-open.webp')} alt="" /> sách mở: +2
                  </li>
                  <li>
                    <img src={asset('game/star-gold.webp')} alt="" /> sao vàng +5 · <img src={asset('game/star-red.webp')} alt="" /> sao đỏ +10 · <img src={asset('game/bow.webp')} alt="" /> nơ: thêm mạng
                  </li>
                  <li>Đừng để sách rơi xuống đất, và né giọt mực đen nhé!</li>
                </ul>
                <p className="muted small">Rê chuột hoặc kéo ngón tay; trên máy tính dùng ← → hoặc A D. Esc để tạm dừng.</p>
                <button onClick={start}>Bắt đầu</button>
              </>
            )}
            {phase === 'pause' && (
              <>
                <h3>Tạm dừng</h3>
                <button onClick={() => { setPhase('play'); wrapRef.current?.focus() }}>Chơi tiếp</button>
              </>
            )}
            {phase === 'over' && (
              <>
                <h3>{newBest ? 'Kỷ lục mới!' : 'Hết lượt rồi'}</h3>
                <p className="catch-final">
                  <b>{hud.score}</b> điểm · {rankOf(hud.score)}
                </p>
                <p className="muted small">Kỷ lục của bạn: {best} điểm</p>
                <button onClick={start}>Chơi lại</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
