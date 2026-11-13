// Luật chơi và dữ liệu của Nông trại Pochacco. Cây lớn theo giờ thật nên đóng trang rồi quay lại vẫn chín.

export type CropId = 'lua' | 'carot' | 'bap' | 'cachua' | 'bingo' | 'duahau' | 'dau' | 'huongduong'
export type Crop = { id: CropId; name: string; icon: string; level: number; seed: number; sell: number; minutes: number; xp: number }

export const CROPS: Crop[] = [
  { id: 'lua', name: 'Lúa', icon: '🌾', level: 1, seed: 2, sell: 5, minutes: 1, xp: 1 },
  { id: 'carot', name: 'Cà rốt', icon: '🥕', level: 1, seed: 5, sell: 12, minutes: 3, xp: 2 },
  { id: 'bap', name: 'Bắp', icon: '🌽', level: 2, seed: 10, sell: 28, minutes: 10, xp: 4 },
  { id: 'cachua', name: 'Cà chua', icon: '🍅', level: 3, seed: 15, sell: 45, minutes: 20, xp: 6 },
  { id: 'bingo', name: 'Bí ngô', icon: '🎃', level: 4, seed: 25, sell: 90, minutes: 45, xp: 10 },
  { id: 'duahau', name: 'Dưa hấu', icon: '🍉', level: 5, seed: 40, sell: 160, minutes: 90, xp: 15 },
  { id: 'dau', name: 'Dâu tây', icon: '🍓', level: 6, seed: 60, sell: 260, minutes: 180, xp: 25 },
  { id: 'huongduong', name: 'Hướng dương', icon: '🌻', level: 8, seed: 100, sell: 520, minutes: 360, xp: 45 },
]
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<CropId, Crop>

export type Plot = { crop: CropId; plantedAt: number; readyAt: number; watered: boolean } | null
export type Order = { id: string; want: Partial<Record<CropId, number>>; coins: number; xp: number; who: string }

export type Farm = {
  v: 1
  coins: number
  xp: number
  size: 3 | 4 | 5
  plots: Plot[]
  inv: Partial<Record<CropId, number>>
  orders: Order[]
  stats: { harvested: number; delivered: number; earned: number }
  savedAt: number
}

export const EXPAND: Record<4 | 5, { level: number; cost: number }> = { 4: { level: 3, cost: 300 }, 5: { level: 6, cost: 1500 } }

/** Kinh nghiệm cần để lên từ cấp n lên n+1. */
export const xpFor = (lv: number) => Math.round(10 * Math.pow(lv, 1.6))
export function levelOf(xp: number) {
  let lv = 1
  let rest = xp
  while (rest >= xpFor(lv)) rest -= xpFor(lv++)
  return { lv, into: rest, need: xpFor(lv) }
}

const WHO = ['Cô giáo Lan', 'Bác bán sách đầu ngõ', 'Bạn Mèo Mun', 'Chị Thỏ Bông', 'Ông Gấu nhà bên', 'Thủ thư Pochacco', 'Bé Vịt Vàng', 'Quán chè cô Ba']
const rid = () => Math.random().toString(36).slice(2, 8)

export function newOrder(xp: number): Order {
  const lv = levelOf(xp).lv
  const pool = CROPS.filter((c) => c.level <= lv)
  const kinds = 1 + Math.floor(Math.random() * Math.min(3, pool.length))
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, kinds)
  const want: Partial<Record<CropId, number>> = {}
  let value = 0
  let x = 0
  for (const c of picks) {
    const n = 1 + Math.floor(Math.random() * (c.minutes <= 3 ? 6 : c.minutes <= 20 ? 4 : 2))
    want[c.id] = n
    value += c.sell * n
    x += c.xp * n
  }
  return { id: rid(), want, coins: Math.round(value * 1.45), xp: Math.round(x * 1.5) + 2, who: WHO[Math.floor(Math.random() * WHO.length)] }
}

export function newFarm(): Farm {
  return {
    v: 1,
    coins: 30,
    xp: 0,
    size: 3,
    plots: Array(9).fill(null),
    inv: {},
    orders: [newOrder(0), newOrder(0), newOrder(0)],
    stats: { harvested: 0, delivered: 0, earned: 0 },
    savedAt: Date.now(),
  }
}

/** Kiểm tra dữ liệu đọc về (localStorage hoặc repo); hỏng thì trả null. */
export function parseFarm(raw: unknown): Farm | null {
  const f = raw as Farm
  if (!f || f.v !== 1 || typeof f.coins !== 'number' || !Array.isArray(f.plots) || ![3, 4, 5].includes(f.size)) return null
  if (f.plots.length !== f.size * f.size) return null
  for (const p of f.plots) if (p && !(p.crop in CROP)) return null
  return { ...f, inv: f.inv ?? {}, orders: Array.isArray(f.orders) && f.orders.length ? f.orders : [newOrder(f.xp), newOrder(f.xp), newOrder(f.xp)], stats: f.stats ?? { harvested: 0, delivered: 0, earned: 0 } }
}

/** Mở rộng ruộng giữ nguyên các ô cũ ở góc trên trái. */
export function expandPlots(plots: Plot[], from: number, to: number): Plot[] {
  const out: Plot[] = Array(to * to).fill(null)
  for (let r = 0; r < from; r++) for (let c = 0; c < from; c++) out[r * to + c] = plots[r * from + c]
  return out
}

export const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} giây`
  const m = Math.ceil(s / 60)
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  return `${h} giờ${m % 60 ? ` ${m % 60} phút` : ''}`
}
