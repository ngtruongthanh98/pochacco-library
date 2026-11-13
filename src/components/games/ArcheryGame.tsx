import { useCallback, useEffect, useRef, useState } from 'react'

const asset = (n: string) => `${import.meta.env.BASE_URL}assets/${n}`
const BEST_KEY = 'pochacco-library:archery-best'

type Pose = 'idle' | 'aim' | 'shoot' | 'dizzy'
type Sprite = Pose | 'target' | 'star' | 'sparkle'
type Arrow = { x: number; y: number; vx: number; vy: number; prevX: number; prevY: number; hitStar: boolean }
type Stuck = { dy: number; ang: number; t: number }
type Pop = { x: number; y: number; text: string; color: string; t: number; big?: boolean }
type Spark = { x: number; y: number; vx: number; vy: number; t: number }
type Star = { x: number; y: number; vx: number; phase: number }

const START_ARROWS = 10
const MAX_ARROWS = 15
const MAX_LEVEL = 8
const PTS_PER_LEVEL = 40

// Vòng bia, tính theo tỉ lệ khoảng cách tới tâm (đo từ hình bia).
const RINGS: { r: number; pts: number; label: string; color: string }[] = [
  { r: 0.27, pts: 10, label: 'Hồng tâm!', color: '#bf2c27' },
  { r: 0.46, pts: 6, label: 'Tuyệt!', color: '#5f7d22' },
  { r: 0.63, pts: 4, label: 'Tốt', color: '#8a6a2a' },
  { r: 0.85, pts: 2, label: 'Trúng', color: '#bf2c27' },
  { r: 1.0, pts: 1, label: 'Sượt', color: '#8a6a2a' },
]

// Vị trí trong hình (tỉ lệ 0..1 của khung vuông).
const TARGET_CX = 0.495
const TARGET_CY = 0.463
const TARGET_R = 0.37
const TARGET_FOOT = 0.978
const BOW_X = 0.8 // điểm mũi tên rời cung trên hình đang ngắm
const BOW_Y = 0.49
const FEET = 0.95

export const archeryRank = (score: number) =>
  score >= 200 ? 'Thần tiễn Pochacco' : score >= 120 ? 'Thần tiễn' : score >= 70 ? 'Xạ thủ' : score >= 30 ? 'Cung thủ khá' : 'Cung thủ tập sự'

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })

/** Mũi tên vẽ bằng tay cho hợp tông len dạ: thân gỗ, đầu hình tim, đuôi lá xanh. */
function drawArrow(ctx: CanvasRenderingContext2D, len: number) {
  const th = Math.max(2, len * 0.055)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#a8713c'
  ctx.lineWidth = th
  ctx.beginPath()
  ctx.moveTo(-len, 0)
  ctx.lineTo(-len * 0.12, 0)
  ctx.stroke()
  // đầu tim
  const s = len * 0.15
  ctx.fillStyle = '#f5ead6'
  ctx.strokeStyle = '#d9c4a0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-s * 0.35, -s * 0.2, -s * 1.1, -s * 0.75, -s * 1.15, -s * 0.2)
  ctx.bezierCurveTo(-s * 1.2, s * 0.1, -s * 1.0, s * 0.15, -s * 0.85, 0)
  ctx.bezierCurveTo(-s * 1.0, -s * 0.15, -s * 1.2, -s * 0.1, -s * 1.15, s * 0.2)
  ctx.bezierCurveTo(-s * 1.1, s * 0.75, -s * 0.35, s * 0.2, 0, 0)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e0605a'
  ctx.beginPath()
  ctx.arc(-s * 0.62, 0, s * 0.16, 0, Math.PI * 2)
  ctx.fill()
  // đuôi lá
  ctx.fillStyle = '#9fd38a'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-len * 0.8, 0)
    ctx.quadraticCurveTo(-len * 0.9, side * len * 0.16, -len * 1.02, side * len * 0.13)
    ctx.quadraticCurveTo(-len * 0.97, side * len * 0.04, -len * 0.98, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#f5ead6'
  ctx.beginPath()
  ctx.ellipse(-len * 0.94, 0, len * 0.08, th * 0.9, 0, 0, Math.PI * 2)
  ctx.fill()
}

export default function ArcheryGame() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sprites = useRef<Partial<Record<Sprite, HTMLImageElement>>>({})
  const [phase, setPhase] = useState<'ready' | 'play' | 'pause' | 'over'>('ready')
  const [hud, setHud] = useState({ score: 0, arrows: START_ARROWS, level: 1, wind: 0, combo: 0 })
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0) || 0)
  const [newBest, setNewBest] = useState(false)
  const [stats, setStats] = useState({ shots: 0, hits: 0, bulls: 0 })
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const g = useRef({
    w: 0,
    h: 0,
    time: 0,
    last: 0,
    score: 0,
    arrows: START_ARROWS,
    lvl: 1,
    wind: 0,
    combo: 0,
    shots: 0,
    hits: 0,
    bulls: 0,
    // ngắm
    aiming: false,
    angle: 0.32, // radian, hướng lên là dương
    power: 0,
    dragFrom: null as null | { x: number; y: number },
    charging: false,
    chargeT: 0,
    // trạng thái
    flying: null as Arrow | null,
    cooldown: 0,
    pose: 'idle' as Pose,
    poseT: 0,
    stuck: [] as Stuck[],
    pops: [] as Pop[],
    sparks: [] as Spark[],
    star: null as Star | null,
    starIn: 6,
    // bia
    tx: 0.78,
    tyBase: 0,
    bobPhase: 0,
    wobble: 0,
    streaks: [] as { x: number; y: number; len: number }[],
  })

  useEffect(() => {
    const files: [Sprite, string][] = [
      ['idle', 'archery/idle.webp'],
      ['aim', 'archery/aim.webp'],
      ['shoot', 'archery/shoot.webp'],
      ['dizzy', 'archery/dizzy.webp'],
      ['target', 'archery/target.webp'],
      ['star', 'game/star-gold.webp'],
      ['sparkle', 'game/sparkle.webp'],
    ]
    files.forEach(([k, f]) => void loadImg(asset(f)).then((i) => (sprites.current[k] = i)))
  }, [])

  const reset = useCallback(() => {
    Object.assign(g.current, {
      time: 0, score: 0, arrows: START_ARROWS, lvl: 1, wind: 0, combo: 0, shots: 0, hits: 0, bulls: 0,
      aiming: false, angle: 0.32, power: 0, dragFrom: null, charging: false, chargeT: 0,
      flying: null, cooldown: 0, pose: 'idle', poseT: 0, stuck: [], pops: [], sparks: [], star: null, starIn: 6,
      tx: 0.78, bobPhase: 0, wobble: 0,
    })
    setHud({ score: 0, arrows: START_ARROWS, level: 1, wind: 0, combo: 0 })
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

  // Thông số phụ thuộc kích thước khung
  const geo = () => {
    const { w, h } = g.current
    const ground = h * 0.9
    const S = h * 0.48 // cỡ hình Pochacco
    const px = w * 0.005
    const py = ground - S * FEET
    const R = h * Math.max(0.085, 0.15 - 0.01 * (g.current.lvl - 1))
    const T = R / TARGET_R
    const grav = h * 2.2
    const vmax = Math.sqrt(1.15 * w * grav)
    return { w, h, ground, S, px, py, lx: px + S * BOW_X, ly: py + S * BOW_Y, R, T, grav, vmax, unit: Math.min(w, h * 1.4) / 16 }
  }

  const canShoot = () => {
    const s = g.current
    return phaseRef.current === 'play' && !s.flying && s.cooldown <= 0 && s.arrows > 0
  }

  const fire = () => {
    const s = g.current
    if (!canShoot() || s.power < 0.08) {
      s.aiming = false
      s.charging = false
      s.power = 0
      return
    }
    const { lx, ly, vmax } = geo()
    const v = vmax * (0.3 + 0.7 * s.power)
    s.flying = { x: lx, y: ly, prevX: lx, prevY: ly, vx: Math.cos(s.angle) * v, vy: -Math.sin(s.angle) * v, hitStar: false }
    s.arrows -= 1
    s.shots += 1
    s.aiming = false
    s.charging = false
    s.power = 0
    s.pose = 'shoot'
    s.poseT = 0.45
    setHud((hd) => ({ ...hd, arrows: s.arrows }))
  }

  // Điều khiển: kéo ngược để ngắm và thả để bắn; phím ↑ ↓ chỉnh góc, giữ Space để lấy lực.
  useEffect(() => {
    const el = wrapRef.current!
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const updateDrag = (p: { x: number; y: number }) => {
      const s = g.current
      if (!s.dragFrom) return
      const dx = s.dragFrom.x - p.x
      const dy = s.dragFrom.y - p.y
      const dist = Math.hypot(dx, dy)
      s.power = Math.min(1, dist / (Math.min(s.w, s.h) * 0.42))
      if (dist > 4) s.angle = Math.max(-0.35, Math.min(1.35, Math.atan2(-dy, Math.max(1, dx))))
    }
    const onDown = (e: PointerEvent) => {
      if (!canShoot()) return
      const s = g.current
      s.dragFrom = local(e)
      s.aiming = true
      s.power = 0
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (g.current.dragFrom) updateDrag(local(e))
    }
    const onUp = (e: PointerEvent) => {
      const s = g.current
      if (!s.dragFrom) return
      updateDrag(local(e))
      s.dragFrom = null
      fire()
    }
    const onCancel = () => {
      const s = g.current
      s.dragFrom = null
      s.aiming = false
      s.power = 0
    }
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase()
      const s = g.current
      if (down && (k === 'escape' || k === 'p')) {
        setPhase((p) => (p === 'play' ? 'pause' : p === 'pause' ? 'play' : p))
        return
      }
      if (phaseRef.current !== 'play') {
        if (down && (k === ' ' || k === 'enter')) {
          e.preventDefault()
          if (phaseRef.current === 'pause') setPhase('play')
          else start()
        }
        return
      }
      if (k === 'arrowup' || k === 'w') {
        if (down) s.angle = Math.min(1.35, s.angle + 0.04)
      } else if (k === 'arrowdown' || k === 's') {
        if (down) s.angle = Math.max(-0.35, s.angle - 0.04)
      } else if (k === ' ' || k === 'enter') {
        if (down && !e.repeat && canShoot()) {
          s.charging = true
          s.aiming = true
          s.chargeT = 0
        } else if (!down && s.charging) fire()
      } else return
      e.preventDefault()
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    const onHide = () => document.hidden && setPhase((p) => (p === 'play' ? 'pause' : p))
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('keydown', kd)
    el.addEventListener('keyup', ku)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
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

    const nextArrowSetup = () => {
      // Sau mỗi phát: gió đổi, bia đổi chỗ ở cấp cao
      const lv = s.lvl
      if (lv >= 3) {
        const m = Math.min(3, lv - 2)
        s.wind = Math.round((Math.random() * 2 - 1) * m)
      } else s.wind = 0
      if (lv >= 4) s.tx = 0.6 + Math.random() * 0.28
      setHud((hd) => ({ ...hd, wind: s.wind }))
    }

    const targetPos = (d: ReturnType<typeof geo>) => {
      const tx = d.w * s.tx
      const standY = d.ground - (TARGET_FOOT - TARGET_CY) * d.T
      if (s.lvl < 2) return { tx, ty: standY, floating: false }
      const amp = Math.min(d.h * 0.24, d.h * 0.07 * (s.lvl - 1))
      const mid = Math.min(standY - amp * 0.2, d.h * 0.5)
      return { tx, ty: mid + Math.sin(s.bobPhase) * amp, floating: true }
    }

    const land = (ok: boolean) => {
      s.flying = null
      s.cooldown = 0.55
      if (!ok) {
        s.combo = 0
        s.pose = 'dizzy'
        s.poseT = 0.9
      }
      nextArrowSetup()
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000)
      s.last = now
      s.time += dt
      const d = geo()
      const { w, h, ground, unit } = d
      s.bobPhase += dt * (0.9 + 0.18 * s.lvl)
      s.cooldown = Math.max(0, s.cooldown - dt)
      s.poseT = Math.max(0, s.poseT - dt)
      s.wobble = Math.max(0, s.wobble - dt * 2.5)
      if (s.poseT <= 0) s.pose = s.aiming ? 'aim' : 'idle'
      if (s.charging) {
        s.chargeT += dt
        const c = (s.chargeT / 1.1) % 2
        s.power = c < 1 ? c : 2 - c
      }
      const { tx, ty, floating } = targetPos(d)
      let changed = false

      // Sao thưởng bay ngang từ cấp 2
      if (s.lvl >= 2 && !s.star) {
        s.starIn -= dt
        if (s.starIn <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1
          s.star = { x: dir > 0 ? w * 0.25 : w * 0.62, y: h * (0.15 + Math.random() * 0.3), vx: dir * w * 0.07, phase: 0 }
        }
      }
      if (s.star) {
        s.star.x += s.star.vx * dt
        s.star.phase += dt * 3
        if (s.star.x < w * 0.2 || s.star.x > w * 0.66) {
          s.star = null
          s.starIn = 5 + Math.random() * 6
        }
      }

      // Mũi tên bay
      const a = s.flying
      if (a) {
        const steps = 3
        for (let i = 0; i < steps && s.flying; i++) {
          const sdt = dt / steps
          a.prevX = a.x
          a.prevY = a.y
          a.vx += s.wind * d.grav * 0.045 * sdt
          a.vy += d.grav * sdt
          a.x += a.vx * sdt
          a.y += a.vy * sdt
          // trúng sao
          if (s.star && !a.hitStar && Math.hypot(a.x - s.star.x, a.y - s.star.y) < unit * 0.7) {
            a.hitStar = true
            s.score += 5
            s.pops.push({ x: s.star.x, y: s.star.y, text: 'Sao +5', color: '#c98a12', t: 1 })
            for (let k = 0; k < 10; k++) s.sparks.push({ x: s.star.x, y: s.star.y, vx: (Math.random() - 0.5) * unit * 8, vy: (Math.random() - 0.5) * unit * 8, t: 0.8 })
            s.star = null
            s.starIn = 7 + Math.random() * 6
            changed = true
          }
          // cắt qua mặt bia
          if (a.prevX < tx && a.x >= tx) {
            const f = (tx - a.prevX) / (a.x - a.prevX)
            const yAt = a.prevY + (a.y - a.prevY) * f
            const off = Math.abs(yAt - ty) / d.R
            if (off <= 1) {
              const ring = RINGS.find((r) => off <= r.r)!
              s.combo += 1
              s.hits += 1
              const bonus = s.combo >= 3 ? s.combo - 2 : 0
              s.score += ring.pts + bonus
              s.stuck.push({ dy: yAt - ty, ang: Math.atan2(a.vy, a.vx), t: s.time })
              if (s.stuck.length > 7) s.stuck.shift()
              s.wobble = 1
              s.pops.push({ x: tx, y: ty - d.R * 1.15, text: `${ring.label} +${ring.pts}`, color: ring.color, t: 1, big: ring.pts === 10 })
              if (bonus) s.pops.push({ x: tx, y: ty - d.R * 1.15 - unit * 0.6, text: `Liên tiếp ×${s.combo} +${bonus}`, color: '#5f7d22', t: 1.1 })
              if (ring.pts === 10) {
                s.bulls += 1
                if (s.arrows < MAX_ARROWS) {
                  s.arrows += 1
                  s.pops.push({ x: tx, y: ty + d.R * 1.3, text: '+1 mũi tên', color: '#5f7d22', t: 1.2 })
                }
                for (let k = 0; k < 12; k++) s.sparks.push({ x: tx, y: yAt, vx: (Math.random() - 0.5) * unit * 9, vy: (Math.random() - 0.7) * unit * 9, t: 0.9 })
              }
              const lv = Math.min(MAX_LEVEL, 1 + Math.floor(s.score / PTS_PER_LEVEL))
              if (lv > s.lvl) {
                s.lvl = lv
                s.pops.push({ x: w / 2, y: h * 0.18, text: `Lên cấp ${lv}!`, color: '#bf2c27', t: 1.6, big: true })
              }
              changed = true
              land(true)
              break
            }
          }
          // rơi đất hoặc bay khỏi khung
          if (a.y > ground + unit * 0.2 || a.x > w + unit * 2 || a.x < -unit * 2) {
            s.pops.push({ x: Math.min(w - unit, Math.max(unit, a.x)), y: Math.min(ground, a.y) - unit * 0.4, text: 'Trượt rồi…', color: '#7a6a5a', t: 1 })
            changed = true
            land(false)
            break
          }
        }
      }

      // ===== Vẽ =====
      ctx.clearRect(0, 0, w, h)
      // vệt gió
      if (s.wind !== 0) {
        while (s.streaks.length < 7) s.streaks.push({ x: Math.random() * w, y: Math.random() * h * 0.75, len: unit * (0.8 + Math.random()) })
        ctx.strokeStyle = 'rgba(150, 180, 140, 0.35)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        for (const st of s.streaks) {
          st.x += s.wind * w * 0.12 * dt
          if (st.x > w + st.len) st.x = -st.len
          if (st.x < -st.len) st.x = w + st.len
          ctx.beginPath()
          ctx.moveTo(st.x, st.y)
          ctx.lineTo(st.x + st.len * Math.sign(s.wind), st.y)
          ctx.stroke()
        }
      }
      // bãi cỏ
      ctx.fillStyle = '#cfe6ae'
      ctx.fillRect(0, ground, w, h - ground)
      ctx.fillStyle = '#b5d68c'
      ctx.beginPath()
      ctx.moveTo(0, ground)
      for (let x = 0; x <= w; x += unit * 0.5) ctx.quadraticCurveTo(x + unit * 0.25, ground - unit * 0.18, x + unit * 0.5, ground)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fill()

      // bia
      const timg = sprites.current.target
      ctx.save()
      ctx.translate(tx, ty)
      const wob = Math.sin(s.wobble * 18) * s.wobble * 0.06
      ctx.rotate(wob)
      if (timg) {
        if (floating) {
          // dây treo cho bia bay
          ctx.strokeStyle = 'rgba(168, 113, 60, 0.6)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(0, -d.R * 1.1)
          ctx.lineTo(0, -ty - 10)
          ctx.stroke()
        }
        if (floating) ctx.drawImage(timg, 0, 0, timg.width, timg.height * 0.845, -TARGET_CX * d.T, -TARGET_CY * d.T, d.T, d.T * 0.845)
        else ctx.drawImage(timg, -TARGET_CX * d.T, -TARGET_CY * d.T, d.T, d.T)
      }
      // tên cắm trên bia
      for (const st of s.stuck) {
        ctx.save()
        ctx.translate(0, st.dy)
        ctx.rotate(st.ang - wob)
        drawArrow(ctx, unit * 1.5)
        ctx.restore()
      }
      ctx.restore()

      // sao thưởng
      const simg = sprites.current.star
      if (s.star && simg) {
        const sz = unit * 1.1 * (1 + Math.sin(s.star.phase) * 0.08)
        ctx.drawImage(simg, s.star.x - sz / 2, s.star.y - sz / 2 + Math.sin(s.star.phase * 0.7) * unit * 0.2, sz, sz)
      }

      // Pochacco
      const pimg = sprites.current[s.pose] ?? sprites.current.idle
      if (pimg) ctx.drawImage(pimg, d.px, d.py, d.S, d.S)

      // đường ngắm (ngắn dần theo cấp, không tính gió)
      if (s.aiming && !s.flying && s.power > 0.02) {
        const v = d.vmax * (0.3 + 0.7 * s.power)
        let x = d.lx
        let y = d.ly
        let vx = Math.cos(s.angle) * v
        let vy = -Math.sin(s.angle) * v
        const span = s.lvl <= 1 ? 1.0 : s.lvl === 2 ? 0.6 : s.lvl === 3 ? 0.42 : 0.28
        ctx.fillStyle = 'rgba(191, 44, 39, 0.55)'
        for (let t = 0, i = 0; t < span; t += 0.05, i++) {
          x += vx * 0.05
          y += vy * 0.05
          vy += d.grav * 0.05
          if (y > ground) break
          ctx.globalAlpha = 1 - t / span
          ctx.beginPath()
          ctx.arc(x, y, Math.max(2, unit * 0.09 - i * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        // thanh lực
        const bw = d.S * 0.7
        const bx = d.px + d.S * 0.15
        const by = d.py - unit * 0.1
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(bx, by, bw, unit * 0.22)
        ctx.fillStyle = s.power > 0.85 ? '#bf2c27' : s.power > 0.5 ? '#e9a93b' : '#8cbf6a'
        ctx.fillRect(bx, by, bw * s.power, unit * 0.22)
        ctx.strokeStyle = '#d9c4a0'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, unit * 0.22)
      }

      // mũi tên đang bay
      if (s.flying) {
        ctx.save()
        ctx.translate(s.flying.x, s.flying.y)
        ctx.rotate(Math.atan2(s.flying.vy, s.flying.vx))
        drawArrow(ctx, unit * 1.5)
        ctx.restore()
      }

      // tia lấp lánh
      const sp = sprites.current.sparkle
      s.sparks = s.sparks.filter((p) => {
        p.t -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += unit * 12 * dt
        if (sp) {
          ctx.globalAlpha = Math.max(0, p.t / 0.9)
          ctx.drawImage(sp, p.x - unit * 0.2, p.y - unit * 0.2, unit * 0.4, unit * 0.4)
          ctx.globalAlpha = 1
        }
        return p.t > 0
      })
      // chữ nổi
      ctx.textAlign = 'center'
      s.pops = s.pops.filter((p) => {
        p.t -= dt * 0.9
        ctx.font = `800 ${Math.round(unit * (p.big ? 0.62 : 0.4))}px system-ui, sans-serif`
        ctx.globalAlpha = Math.max(0, Math.min(1, p.t))
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(255, 250, 242, 0.9)'
        const yy = p.y - (1 - p.t) * unit * 0.9
        ctx.strokeText(p.text, p.x, yy)
        ctx.fillStyle = p.color
        ctx.fillText(p.text, p.x, yy)
        ctx.globalAlpha = 1
        return p.t > 0
      })

      if (changed) setHud({ score: s.score, arrows: s.arrows, level: s.lvl, wind: s.wind, combo: s.combo })
      if (s.arrows <= 0 && !s.flying && s.cooldown <= 0 && s.pops.length === 0) {
        if (s.score > best) {
          localStorage.setItem(BEST_KEY, String(s.score))
          setBest(s.score)
          setNewBest(true)
        }
        setStats({ shots: s.shots, hits: s.hits, bulls: s.bulls })
        setPhase('over')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const windText = hud.level < 3 ? null : hud.wind === 0 ? 'Lặng gió' : `Gió ${hud.wind > 0 ? '→' : '←'} ${Math.abs(hud.wind)}`
  const endImg = newBest && hud.score > 0 ? 'podium' : hud.score < 30 ? 'dizzy' : 'idle'

  return (
    <div className="catch archery">
      <div className="catch-hud">
        <span className="hud-score">
          Điểm <b>{hud.score}</b>
        </span>
        <span className="hud-arrows" aria-label={`Còn ${hud.arrows} mũi tên`}>
          <img src={asset('archery/bow-arrow.webp')} alt="" /> × <b>{hud.arrows}</b>
        </span>
        <span className="muted">Cấp {hud.level}</span>
        {windText && <span className={`hud-wind ${hud.wind ? 'on' : ''}`}>{windText}</span>}
        {hud.combo >= 2 && <span className="hud-combo">Liên tiếp ×{hud.combo}</span>}
        <span className="muted">Kỷ lục {best}</span>
        {(phase === 'play' || phase === 'pause') && (
          <button className="pg" onClick={() => setPhase(phase === 'play' ? 'pause' : 'play')} aria-label={phase === 'play' ? 'Tạm dừng' : 'Chơi tiếp'}>
            {phase === 'play' ? '❚❚' : '▶'}
          </button>
        )}
      </div>
      <div className="catch-stage archery-stage" ref={wrapRef} tabIndex={0} aria-label="Khung trò chơi Pochacco bắn cung">
        <canvas ref={canvasRef} />
        {phase !== 'play' && (
          <div className="catch-overlay">
            {phase === 'ready' && (
              <>
                <img className="archery-hero" src={asset('archery/sit.webp')} alt="" />
                <h3>Pochacco bắn cung</h3>
                <ul className="catch-rules">
                  <li>
                    <img src={asset('archery/target.webp')} alt="" /> Hồng tâm 10 · vòng xanh 6 · vòng kem 4 · vòng đỏ 2 · mép 1
                  </li>
                  <li>
                    <img src={asset('archery/bow-arrow.webp')} alt="" /> Có {START_ARROWS} mũi tên; trúng hồng tâm được thêm 1 mũi.
                  </li>
                  <li>
                    <img src={asset('game/star-gold.webp')} alt="" /> Bắn trúng sao bay ngang +5. Trúng liên tiếp từ 3 phát có thưởng.
                  </li>
                  <li className="extra">Lên cấp thì bia bay lên xuống, nhỏ dần, có gió và đường ngắm ngắn lại.</li>
                </ul>
                <p className="muted small hint-touch">Chạm giữ, kéo ngược về sau rồi thả để bắn.</p>
                <p className="muted small hint-desk">Bấm giữ rồi kéo ngược về sau như kéo dây cung, thả ra để bắn. Bàn phím: ↑ ↓ chỉnh góc, giữ Space lấy lực, thả để bắn.</p>
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
                <img className="archery-hero" src={asset(`archery/${endImg}.webp`)} alt="" />
                <h3>{newBest && hud.score > 0 ? 'Kỷ lục mới!' : 'Hết tên rồi'}</h3>
                <p className="catch-final">
                  <b>{hud.score}</b> điểm · {archeryRank(hud.score)}
                </p>
                <p className="muted small">
                  Trúng {stats.hits}/{stats.shots} phát{stats.bulls ? ` · ${stats.bulls} hồng tâm` : ''} · Kỷ lục của bạn: {best} điểm
                </p>
                <button onClick={start}>Chơi lại</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
