// Pochacco Golf: dữ liệu sân, vật lý bóng lăn, tính điểm và lưu tiến trình.
// Đơn vị toạ độ là "ô": sân rộng 9 ô, cao 14 ô; ô (c, r) có tâm (c + 0.5, r + 0.5).

export const gAsset = (n: string) => `${import.meta.env.BASE_URL}assets/golf/${n}.webp`

export const COLS = 9
export const ROWS = 14
export const BALL_R = 0.17
export const HOLE_R = 0.26
/** Tốc độ tối đa khi kéo hết lực (ô/giây) */
export const VMAX = 17

// ---------- Mặt sân ----------
// '.' ngoài sân (tường), g cỏ, f cỏ hoa (chậm), s cát (rất chậm), w nước (phạt 1 gậy), T chỗ phát bóng, H lỗ
export type Surface = 'g' | 'f' | 's' | 'w'
export const SURFACE: Record<Surface, { name: string; tile: string; decel: number }> = {
  g: { name: 'Cỏ', tile: 'green_square', decel: 2.6 },
  f: { name: 'Cỏ hoa', tile: 'flower_grass', decel: 5.2 },
  s: { name: 'Cát', tile: 'sand_bunker', decel: 11 },
  w: { name: 'Nước', tile: 'water_tile', decel: 0 },
}

export type ObstacleKind = 'rock_cluster' | 'flower_bush' | 'rest_bench' | 'sun_umbrella' | 'wood_sign' | 'supplies_crate' | 'windmill' | 'cherry_tree' | 'orange_tree'
export const OBSTACLE: Record<ObstacleKind, { r: number; w: number; name: string }> = {
  rock_cluster: { r: 0.48, w: 1.35, name: 'Đá' },
  flower_bush: { r: 0.46, w: 1.3, name: 'Bụi hoa' },
  rest_bench: { r: 0.42, w: 1.05, name: 'Ghế nghỉ' },
  sun_umbrella: { r: 0.22, w: 1.25, name: 'Dù che nắng' },
  wood_sign: { r: 0.26, w: 1.05, name: 'Biển gỗ' },
  supplies_crate: { r: 0.42, w: 0.95, name: 'Thùng đồ' },
  windmill: { r: 0, w: 2.4, name: 'Cối xay gió' },
  cherry_tree: { r: 0.36, w: 1.2, name: 'Cây anh đào' },
  orange_tree: { r: 0.36, w: 1.2, name: 'Cây cam' },
}
export type Obstacle = { k: ObstacleKind; x: number; y: number }

export type HoleDef = {
  id: string
  name: string
  par: number
  map: string[]
  obstacles: Obstacle[]
  flag: string
  tip: string
}

export type World = { id: string; name: string; host: string; hostName: string; hello: string; holes: HoleDef[] }

const H = (id: string, name: string, par: number, flag: string, tip: string, map: string[], obstacles: Obstacle[] = []): HoleDef => ({ id, name, par, flag, tip, map, obstacles })

export const WORLDS: World[] = [
  {
    id: 'w1',
    name: 'Đồi Cỏ Xanh',
    host: 'white_sheep',
    hostName: 'Cừu Trắng',
    hello: 'Chào mừng tới Đồi Cỏ Xanh! Kéo ngược từ quả bóng như kéo ná, thả tay là Pochacco đánh. Cát thì bóng chậm lắm nha.',
    holes: [
      H('w1-1', 'Đường thẳng tắp', 2, 'red_flag', 'Kéo ngược xuống dưới rồi thả, lực vừa phải là vào.', [
        '.........',
        '...ggg...',
        '...gHg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...ggg...',
        '...gTg...',
        '...ggg...',
        '.........',
      ]),
      H('w1-2', 'Khúc quanh', 3, 'yellow_flag', 'Bóng nảy vào tường được: đánh chéo cho bóng dội qua góc.', [
        '.........',
        '.gggg....',
        '.gHgg....',
        '.gggg....',
        '.gggg....',
        '.ggggggg.',
        '.ggggggg.',
        '.....ggg.',
        '.....ggg.',
        '.....ggg.',
        '.....ggg.',
        '.....gTg.',
        '.....ggg.',
        '.........',
      ]),
      H('w1-3', 'Bãi cát nhỏ', 3, 'blue_flag', 'Bãi cát giữa sân làm bóng gần như dừng lại. Đi vòng hai bên cho chắc.', [
        '.........',
        '..ggggg..',
        '..ggHgg..',
        '..ggggg..',
        '..ggggg..',
        '..gssSg..'.replace('S', 's'),
        '..gsssg..',
        '..gsssg..',
        '..ggggg..',
        '..ggggg..',
        '..ggggg..',
        '..ggTgg..',
        '..ggggg..',
        '.........',
      ], [{ k: 'rock_cluster', x: 4.5, y: 4.2 }]),
      H('w1-4', 'Ziczac', 3, 'star_flag', 'Hai khúc cua liên tiếp. Cỏ hoa ở mép làm bóng chậm, tránh nó.', [
        '.........',
        '.ggg.....',
        '.gHg.....',
        '.gggffff.',
        '.ggggggg.',
        '.ffffggg.',
        '.....ggg.',
        '.....ggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggg.....',
        '.gTg.....',
        '.ggg.....',
        '.........',
      ]),
      H('w1-5', 'Vườn hoa tròn', 2, 'heart_flag', 'Lỗ nằm giữa vòng bụi hoa. Tìm khe hở giữa các bụi.', [
        '.........',
        '.fffffff.',
        '.fgggggf.',
        '.fgggggf.',
        '.fggHggf.',
        '.fgggggf.',
        '.fgggggf.',
        '.fgggggf.',
        '.fgggggf.',
        '.fgggggf.',
        '.fgggggf.',
        '.fggTggf.',
        '.fffffff.',
        '.........',
      ], [
        { k: 'flower_bush', x: 3.2, y: 3.4 },
        { k: 'flower_bush', x: 5.8, y: 3.4 },
        { k: 'flower_bush', x: 3.0, y: 5.8 },
        { k: 'flower_bush', x: 6.0, y: 5.8 },
        { k: 'wood_sign', x: 4.5, y: 7.4 },
      ]),
      H('w1-6', 'Hai lối đi', 3, 'checkered_flag', 'Lối trái hẹp mà nhanh, lối phải rộng nhưng có cát. Chọn đường nào cũng được.', [
        '.........',
        '..ggggg..',
        '..ggHgg..',
        '..ggggg..',
        '..g...g..',
        '..g...s..',
        '..g...s..',
        '..g...g..',
        '..g..gg..',
        '..ggggg..',
        '..ggggg..',
        '..ggTgg..',
        '..ggggg..',
        '.........',
      ]),
      H('w1-7', 'Góc nghỉ chân', 3, 'red_flag', 'Ghế và dù chắn ngang. Dội bóng vào tường bên phải để vòng qua.', [
        '.........',
        '.ggggggg.',
        '.gHggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.ggggggg.',
        '.gggggTg.',
        '.ggggggg.',
        '.........',
      ], [
        { k: 'rest_bench', x: 2.0, y: 6.6 },
        { k: 'rest_bench', x: 3.0, y: 6.6 },
        { k: 'sun_umbrella', x: 4.1, y: 6.7 },
        { k: 'supplies_crate', x: 5.1, y: 6.6 },
        { k: 'rock_cluster', x: 3.2, y: 3.6 },
      ]),
      H('w1-8', 'Cầu cá vàng', 3, 'yellow_flag', 'Ao nước nằm giữa sân, rơi xuống là bị phạt 1 gậy. Đi theo bờ cỏ.', [
        '.........',
        '.ggggggg.',
        '.gHggggg.',
        '.ggggggg.',
        '.ggwwwgg.',
        '.ggwwwgg.',
        '.ggwwwgg.',
        '.ggggggg.',
        '.ffggggg.',
        '.ggggggg.',
        '.ggggwww.',
        '.ggggwww.',
        '.gTggggg.',
        '.........',
      ], [{ k: 'flower_bush', x: 6.4, y: 7.6 }]),
      H('w1-9', 'Cối xay gió', 3, 'checkered_flag', 'Cửa cối xay đóng mở theo nhịp. Canh lúc cửa mở rồi đánh thẳng qua.', [
        '.........',
        '..ggggg..',
        '..ggHgg..',
        '..ggggg..',
        '..ggggg..',
        '....g....',
        '....g....',
        '....g....',
        '..ggggg..',
        '..ggggg..',
        '..ggggg..',
        '..ggTgg..',
        '..ggggg..',
        '.........',
      ], [{ k: 'windmill', x: 4.5, y: 6.5 }]),
    ],
  },
]
export const ALL_HOLES = WORLDS.flatMap((w) => w.holes)

// ---------- Sân đã phân tích ----------
export type Course = {
  def: HoleDef
  cell: (Surface | null)[][]
  tee: { x: number; y: number }
  hole: { x: number; y: number }
}
export function parseCourse(def: HoleDef): Course {
  let tee = { x: 4.5, y: 12.5 }
  let hole = { x: 4.5, y: 2.5 }
  const cell = def.map.map((row, r) =>
    [...row.padEnd(COLS, '.')].slice(0, COLS).map((ch, c) => {
      if (ch === 'T') {
        tee = { x: c + 0.5, y: r + 0.5 }
        return 'g' as Surface
      }
      if (ch === 'H') {
        hole = { x: c + 0.5, y: r + 0.5 }
        return 'g' as Surface
      }
      return ch === 'g' || ch === 'f' || ch === 's' || ch === 'w' ? (ch as Surface) : null
    }),
  )
  return { def, cell, tee, hole }
}
export const surfaceAt = (c: Course, x: number, y: number): Surface | null => c.cell[Math.floor(y)]?.[Math.floor(x)] ?? null

// ---------- Cối xay gió: cửa đóng mở theo nhịp ----------
export const MILL_PERIOD = 2.6
/** 0 = mở hẳn, 1 = đóng hẳn */
export const millClosed = (t: number) => {
  const p = (t % MILL_PERIOD) / MILL_PERIOD
  // mở 45% thời gian, đóng 35%, chuyển 10% mỗi chiều
  if (p < 0.45) return 0
  if (p < 0.55) return (p - 0.45) / 0.1
  if (p < 0.9) return 1
  return 1 - (p - 0.9) / 0.1
}

// ---------- Vật lý ----------
export type Ball = { x: number; y: number; vx: number; vy: number }
export type StepEvent = 'wall' | 'obstacle' | 'water' | 'sink' | 'sand' | null

type Box = { x0: number; y0: number; x1: number; y1: number }
/** Các khối cứng: ô ngoài sân và thân cối xay (trừ lối cửa khi mở) */
function solidBoxes(c: Course, t: number, near: { x: number; y: number }): Box[] {
  const out: Box[] = []
  const cx = Math.floor(near.x)
  const cy = Math.floor(near.y)
  for (let r = cy - 1; r <= cy + 1; r++)
    for (let col = cx - 1; col <= cx + 1; col++) if (!c.cell[r]?.[col]) out.push({ x0: col, y0: r, x1: col + 1, y1: r + 1 })
  for (const o of c.def.obstacles)
    if (o.k === 'windmill') {
      // Bóng chui qua đường hầm dưới cối xay; cửa gỗ ở ngưỡng cửa đóng mở theo nhịp.
      const k = millClosed(t)
      if (k > 0.5) out.push({ x0: o.x - 0.5, y0: o.y + 0.25, x1: o.x + 0.5, y1: o.y + 0.45 })
    }
  return out
}

/** Một bước vật lý dt giây. Trả về sự kiện va chạm (để phát âm thanh, hiệu ứng). */
export function step(c: Course, b: Ball, dt: number, t: number): StepEvent {
  let ev: StepEvent = null
  const sp = Math.hypot(b.vx, b.vy)
  const surf = surfaceAt(c, b.x, b.y) ?? 'g'
  // Hút nhẹ vào lỗ khi đi chậm gần miệng lỗ
  const dx = c.hole.x - b.x
  const dy = c.hole.y - b.y
  const dh = Math.hypot(dx, dy)
  if (dh < HOLE_R + 0.25 && sp < 4.5) {
    b.vx += (dx / dh) * 6 * dt
    b.vy += (dy / dh) * 6 * dt
  }
  // Ma sát
  const dec = SURFACE[surf].decel + 0.35 * sp
  if (sp > 0) {
    const ns = Math.max(0, sp - dec * dt)
    b.vx *= ns / sp
    b.vy *= ns / sp
  }
  b.x += b.vx * dt
  b.y += b.vy * dt

  // Tường và khối cứng
  for (const k of solidBoxes(c, t, b)) {
    const px = Math.max(k.x0, Math.min(b.x, k.x1))
    const py = Math.max(k.y0, Math.min(b.y, k.y1))
    const ox = b.x - px
    const oy = b.y - py
    const d = Math.hypot(ox, oy)
    if (d < BALL_R && d > 1e-6) {
      const nx = ox / d
      const ny = oy / d
      b.x = px + nx * BALL_R
      b.y = py + ny * BALL_R
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0) {
        b.vx -= 1.75 * vn * nx
        b.vy -= 1.75 * vn * ny
        ev = 'wall'
      }
    } else if (d <= 1e-6) {
      // tâm bóng lọt vào trong khối: đẩy ra theo trục gần nhất
      const opts = [
        { d: b.x - k.x0, nx: -1, ny: 0 },
        { d: k.x1 - b.x, nx: 1, ny: 0 },
        { d: b.y - k.y0, nx: 0, ny: -1 },
        { d: k.y1 - b.y, nx: 0, ny: 1 },
      ].sort((a, z) => a.d - z.d)[0]
      b.x += opts.nx * (opts.d + BALL_R)
      b.y += opts.ny * (opts.d + BALL_R)
      if (opts.nx) b.vx = Math.abs(b.vx) * opts.nx * 0.75
      if (opts.ny) b.vy = Math.abs(b.vy) * opts.ny * 0.75
      ev = 'wall'
    }
  }
  // Vật cản tròn
  for (const o of c.def.obstacles) {
    const r = OBSTACLE[o.k].r
    if (!r) continue
    const ox = b.x - o.x
    const oy = b.y - o.y
    const d = Math.hypot(ox, oy)
    if (d < r + BALL_R && d > 1e-6) {
      const nx = ox / d
      const ny = oy / d
      b.x = o.x + nx * (r + BALL_R)
      b.y = o.y + ny * (r + BALL_R)
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0) {
        b.vx -= 1.7 * vn * nx
        b.vy -= 1.7 * vn * ny
        ev = 'obstacle'
      }
    }
  }
  // Lỗ: vào khi đủ gần và đủ chậm; nhanh quá thì bóng chạy qua miệng lỗ
  const sp2 = Math.hypot(b.vx, b.vy)
  if (Math.hypot(c.hole.x - b.x, c.hole.y - b.y) < HOLE_R * 0.8 && sp2 < 7.5) return 'sink'
  const s2 = surfaceAt(c, b.x, b.y)
  if (s2 === 'w') return 'water'
  if (s2 === 's' && surf !== 's') ev = 'sand'
  if (sp2 < 0.06) {
    b.vx = 0
    b.vy = 0
  }
  return ev
}
export const moving = (b: Ball) => b.vx !== 0 || b.vy !== 0

/** Mô phỏng nhanh cả đường bóng (dùng cho gợi ý đường đi). */
export function simulate(c: Course, start: Ball, t0: number, maxT = 8): { pts: { x: number; y: number }[]; end: 'sink' | 'water' | 'stop' } {
  const b = { ...start }
  const pts = [{ x: b.x, y: b.y }]
  const dt = 1 / 120
  for (let t = 0; t < maxT; t += dt) {
    const ev = step(c, b, dt, t0 + t)
    if (ev === 'sink') return { pts: [...pts, { ...c.hole }], end: 'sink' }
    if (ev === 'water') return { pts: [...pts, { x: b.x, y: b.y }], end: 'water' }
    if (Math.round(t * 120) % 6 === 0) pts.push({ x: b.x, y: b.y })
    if (!moving(b)) break
  }
  pts.push({ x: b.x, y: b.y })
  return { pts, end: 'stop' }
}

// ---------- Tính điểm ----------
export function resultName(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole-in-one!'
  const d = strokes - par
  if (d <= -3) return 'Albatross!'
  if (d === -2) return 'Eagle!'
  if (d === -1) return 'Birdie!'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  if (d === 2) return 'Double bogey'
  return `+${d}`
}
export const starsFor = (strokes: number, par: number) => (strokes === 1 || strokes < par ? 3 : strokes === par ? 2 : 1)
export const coinsFor = (strokes: number, par: number) => (strokes === 1 ? 60 : strokes < par ? 35 : strokes === par ? 20 : strokes === par + 1 ? 12 : 6)

// ---------- Lưu tiến trình ----------
export type GolfSave = {
  v: 1
  coins: number
  gems: number
  xp: number
  best: Record<string, number>
  stars: Record<string, number>
  holeInOnes: number
  played: number
  ball: string
  savedAt: number
}
export const newGolf = (): GolfSave => ({ v: 1, coins: 0, gems: 0, xp: 0, best: {}, stars: {}, holeInOnes: 0, played: 0, ball: 'plain_ball', savedAt: 0 })
export function parseGolf(raw: unknown): GolfSave | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<GolfSave>
  if (s.v !== 1) return null
  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0)
  return {
    v: 1,
    coins: num(s.coins),
    gems: num(s.gems),
    xp: num(s.xp),
    best: s.best && typeof s.best === 'object' ? s.best : {},
    stars: s.stars && typeof s.stars === 'object' ? s.stars : {},
    holeInOnes: num(s.holeInOnes),
    played: num(s.played),
    ball: typeof s.ball === 'string' ? s.ball : 'plain_ball',
    savedAt: num(s.savedAt),
  }
}
export const levelOf = (xp: number) => {
  let lv = 1
  let need = 60
  let rest = xp
  while (rest >= need) {
    rest -= need
    lv++
    need = Math.round(need * 1.25)
  }
  return { lv, into: rest, need }
}
/** Lỗ đã mở: lỗ đầu mỗi khu, hoặc lỗ ngay trước đã hoàn thành. */
export const unlocked = (s: GolfSave, w: World, i: number) => i === 0 || !!s.best[w.holes[i - 1].id]
