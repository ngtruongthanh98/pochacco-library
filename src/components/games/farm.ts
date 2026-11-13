// Luật chơi và dữ liệu của Nông trại Pochacco. Mọi thứ chạy theo giờ thật nên đóng trang rồi quay lại vẫn tiếp tục.
// Phiên bản dữ liệu 2 (thêm chuồng trại, lò bánh, điểm danh, thành tựu). Bản 1 cũ được nâng cấp tự động, giữ nguyên tiến trình.

export type CropId = 'lua' | 'carot' | 'bap' | 'cachua' | 'bingo' | 'duahau' | 'dau' | 'huongduong'
export type ProductId = 'trung' | 'sua'
export type GoodId = 'banhmi' | 'banhcarot' | 'sotcachua' | 'phomai' | 'banhbingo' | 'nuocep' | 'mutdau' | 'dauhuongduong'
export type ItemId = CropId | ProductId | GoodId

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

// ---- Chuồng trại ----
export type AnimalKind = 'ga' | 'bo'
export type AnimalDef = { kind: AnimalKind; name: string; icon: string; level: number; cost: number; max: number; eats: Partial<Record<CropId, number>>; gives: ProductId; minutes: number; xp: number }
export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  ga: { kind: 'ga', name: 'Gà mái', icon: '🐔', level: 2, cost: 60, max: 4, eats: { lua: 1 }, gives: 'trung', minutes: 20, xp: 3 },
  bo: { kind: 'bo', name: 'Bò sữa', icon: '🐄', level: 4, cost: 250, max: 3, eats: { bap: 2 }, gives: 'sua', minutes: 60, xp: 8 },
}
export type Animal = { kind: AnimalKind; readyAt: number | null; fedAt: number | null }

// ---- Lò bánh ----
export type Recipe = { id: GoodId; name: string; icon: string; level: number; needs: Partial<Record<ItemId, number>>; minutes: number; sell: number; xp: number }
export const RECIPES: Recipe[] = [
  { id: 'banhmi', name: 'Bánh mì', icon: '🍞', level: 2, needs: { lua: 3 }, minutes: 10, sell: 40, xp: 5 },
  { id: 'banhcarot', name: 'Bánh cà rốt', icon: '🧁', level: 3, needs: { carot: 2, trung: 1 }, minutes: 20, sell: 95, xp: 9 },
  { id: 'sotcachua', name: 'Sốt cà chua', icon: '🥫', level: 4, needs: { cachua: 3 }, minutes: 25, sell: 170, xp: 12 },
  { id: 'phomai', name: 'Phô mai', icon: '🧀', level: 5, needs: { sua: 2 }, minutes: 40, sell: 220, xp: 16 },
  { id: 'banhbingo', name: 'Bánh bí ngô', icon: '🥧', level: 5, needs: { bingo: 1, trung: 1, sua: 1 }, minutes: 45, sell: 260, xp: 20 },
  { id: 'nuocep', name: 'Nước ép dưa hấu', icon: '🧃', level: 6, needs: { duahau: 2 }, minutes: 30, sell: 380, xp: 24 },
  { id: 'mutdau', name: 'Mứt dâu', icon: '🍯', level: 7, needs: { dau: 3 }, minutes: 60, sell: 900, xp: 40 },
  { id: 'dauhuongduong', name: 'Dầu hướng dương', icon: '🫙', level: 8, needs: { huongduong: 2 }, minutes: 90, sell: 1250, xp: 60 },
]
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r])) as Record<GoodId, Recipe>
export type Slot = { recipe: GoodId; readyAt: number } | null
export const SLOT_COST = [0, 0, 400, 1200] // giá mở ô lò thứ 1..4

// ---- Mọi vật phẩm trong kho ----
export type ItemDef = { id: ItemId; name: string; icon: string; sell: number }
export const ITEMS: Record<ItemId, ItemDef> = {
  ...(Object.fromEntries(CROPS.map((c) => [c.id, { id: c.id, name: c.name, icon: c.icon, sell: c.sell }])) as Record<CropId, ItemDef>),
  trung: { id: 'trung', name: 'Trứng', icon: '🥚', sell: 30 },
  sua: { id: 'sua', name: 'Sữa', icon: '🥛', sell: 85 },
  ...(Object.fromEntries(RECIPES.map((r) => [r.id, { id: r.id, name: r.name, icon: r.icon, sell: r.sell }])) as Record<GoodId, ItemDef>),
}
export const ITEM_ORDER: ItemId[] = [...CROPS.map((c) => c.id), 'trung', 'sua', ...RECIPES.map((r) => r.id)]

export type Plot = { crop: CropId; plantedAt: number; readyAt: number; watered: boolean } | null
export type Order = { id: string; want: Partial<Record<ItemId, number>>; coins: number; xp: number; who: string }

export type Farm = {
  v: 2
  coins: number
  xp: number
  size: 3 | 4 | 5
  plots: Plot[]
  inv: Partial<Record<ItemId, number>>
  orders: Order[]
  animals: Animal[]
  slots: Slot[]
  daily: { last: string; streak: number }
  achievements: string[]
  planted: CropId[]
  stats: { harvested: number; delivered: number; earned: number; crafted: number; collected: number }
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

// ---- Thời tiết theo ngày (mọi máy cùng một thời tiết) ----
export const today = (t = Date.now()) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
export type Weather = { id: 'nang' | 'mua' | 'gio' | 'dep'; icon: string; name: string; note: string; sellBonus: number }
export function weatherOf(day = today()): Weather {
  const r = hash(day) % 10
  if (r < 3) return { id: 'mua', icon: '🌧️', name: 'Mưa', note: 'Trời mưa: cây gieo hôm nay được tưới sẵn.', sellBonus: 0 }
  if (r < 5) return { id: 'nang', icon: '☀️', name: 'Nắng đẹp', note: 'Chợ đông khách: bán được thêm 10%.', sellBonus: 0.1 }
  if (r < 6) return { id: 'gio', icon: '🍃', name: 'Gió mát', note: 'Gà và bò vui vẻ: sản phẩm chuồng được gấp đôi kinh nghiệm.', sellBonus: 0 }
  return { id: 'dep', icon: '⛅', name: 'Trời dịu', note: 'Một ngày yên bình ở nông trại.', sellBonus: 0 }
}

// ---- Đơn hàng ----
const WHO = ['Cô giáo Lan', 'Bác bán sách đầu ngõ', 'Bạn Mèo Mun', 'Chị Thỏ Bông', 'Ông Gấu nhà bên', 'Thủ thư Pochacco', 'Bé Vịt Vàng', 'Quán chè cô Ba']
const rid = () => Math.random().toString(36).slice(2, 8)

export function newOrder(xp: number): Order {
  const lv = levelOf(xp).lv
  const pool: { id: ItemId; sell: number; xp: number; slow: number }[] = [
    ...CROPS.filter((c) => c.level <= lv).map((c) => ({ id: c.id as ItemId, sell: c.sell, xp: c.xp, slow: c.minutes })),
    ...(lv >= ANIMALS.ga.level ? [{ id: 'trung' as ItemId, sell: 30, xp: 3, slow: 20 }] : []),
    ...(lv >= ANIMALS.bo.level ? [{ id: 'sua' as ItemId, sell: 85, xp: 8, slow: 60 }] : []),
    ...RECIPES.filter((r) => r.level <= lv).map((r) => ({ id: r.id as ItemId, sell: r.sell, xp: r.xp, slow: r.minutes + 30 })),
  ]
  const kinds = 1 + Math.floor(Math.random() * Math.min(3, pool.length))
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, kinds)
  const want: Partial<Record<ItemId, number>> = {}
  let value = 0
  let x = 0
  for (const c of picks) {
    const n = 1 + Math.floor(Math.random() * (c.slow <= 3 ? 6 : c.slow <= 20 ? 4 : 2))
    want[c.id] = n
    value += c.sell * n
    x += c.xp * n
  }
  return { id: rid(), want, coins: Math.round(value * 1.45), xp: Math.round(x * 1.5) + 2, who: WHO[Math.floor(Math.random() * WHO.length)] }
}

// ---- Thành tựu ----
export type Achievement = { id: string; name: string; icon: string; desc: string; reward: number; test: (f: Farm) => boolean }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-harvest', name: 'Mùa đầu tiên', icon: '🌾', desc: 'Thu hoạch lần đầu', reward: 10, test: (f) => f.stats.harvested >= 1 },
  { id: 'harvest-100', name: 'Tay nhà nông', icon: '🧺', desc: 'Thu hoạch 100 lần', reward: 150, test: (f) => f.stats.harvested >= 100 },
  { id: 'harvest-500', name: 'Đồng lúa bội thu', icon: '🏆', desc: 'Thu hoạch 500 lần', reward: 600, test: (f) => f.stats.harvested >= 500 },
  { id: 'orders-10', name: 'Hàng xóm tin cậy', icon: '📦', desc: 'Giao 10 đơn hàng', reward: 120, test: (f) => f.stats.delivered >= 10 },
  { id: 'orders-50', name: 'Nhà cung cấp số 1', icon: '🚚', desc: 'Giao 50 đơn hàng', reward: 500, test: (f) => f.stats.delivered >= 50 },
  { id: 'first-egg', name: 'Quả trứng đầu tiên', icon: '🥚', desc: 'Nhặt sản phẩm từ chuồng lần đầu', reward: 20, test: (f) => f.stats.collected >= 1 },
  { id: 'first-bake', name: 'Thợ làm bánh', icon: '🍞', desc: 'Làm xong món đầu tiên ở lò bánh', reward: 30, test: (f) => f.stats.crafted >= 1 },
  { id: 'craft-50', name: 'Bếp trưởng', icon: '🥐', desc: 'Làm 50 món ở lò bánh', reward: 400, test: (f) => f.stats.crafted >= 50 },
  { id: 'coins-1000', name: 'Hũ xu đầy', icon: '🪙', desc: 'Có 1.000 xu cùng lúc', reward: 50, test: (f) => f.coins >= 1000 },
  { id: 'level-5', name: 'Nông dân lành nghề', icon: '⭐', desc: 'Đạt cấp 5', reward: 100, test: (f) => levelOf(f.xp).lv >= 5 },
  { id: 'level-10', name: 'Chủ trang trại', icon: '🌟', desc: 'Đạt cấp 10', reward: 500, test: (f) => levelOf(f.xp).lv >= 10 },
  { id: 'field-5', name: 'Cánh đồng rộng', icon: '🗺️', desc: 'Mở rộng ruộng lên 5×5', reward: 200, test: (f) => f.size >= 5 },
  { id: 'all-crops', name: 'Vườn đủ loại', icon: '🌈', desc: 'Trồng đủ 8 loại cây', reward: 300, test: (f) => CROPS.every((c) => f.planted.includes(c.id)) },
  { id: 'streak-7', name: 'Chăm chỉ cả tuần', icon: '📅', desc: 'Điểm danh 7 ngày liền', reward: 200, test: (f) => f.daily.streak >= 7 },
]

/** Thưởng điểm danh theo chuỗi ngày (tối đa ở ngày thứ 7; tròn tuần được thêm 50 xu). */
export const dailyReward = (streak: number) => ({ coins: 15 * Math.min(streak, 7) + (streak % 7 === 0 ? 50 : 0), xp: 2 * Math.min(streak, 7) })

export function newFarm(): Farm {
  return {
    v: 2,
    coins: 30,
    xp: 0,
    size: 3,
    plots: Array(9).fill(null),
    inv: {},
    orders: [newOrder(0), newOrder(0), newOrder(0)],
    animals: [],
    slots: [null, null],
    daily: { last: '', streak: 0 },
    achievements: [],
    planted: [],
    stats: { harvested: 0, delivered: 0, earned: 0, crafted: 0, collected: 0 },
    savedAt: Date.now(),
  }
}

/** Kiểm tra dữ liệu đọc về (máy hoặc repo); nâng cấp bản 1 lên bản 2. Hỏng thì trả null. */
export function parseFarm(raw: unknown): Farm | null {
  const f = raw as (Omit<Partial<Farm>, 'v'> & { v?: number }) | null
  if (!f || (f.v !== 1 && f.v !== 2) || typeof f.coins !== 'number' || !Array.isArray(f.plots) || ![3, 4, 5].includes(f.size as number)) return null
  if (f.plots.length !== (f.size as number) ** 2) return null
  for (const p of f.plots) if (p && !(p.crop in CROP)) return null
  const xp = typeof f.xp === 'number' ? f.xp : 0
  const plantedFromPlots = f.plots.filter(Boolean).map((p) => p!.crop)
  return {
    v: 2,
    coins: f.coins,
    xp,
    size: f.size as 3 | 4 | 5,
    plots: f.plots as Plot[],
    inv: f.inv ?? {},
    orders: Array.isArray(f.orders) && f.orders.length ? f.orders : [newOrder(xp), newOrder(xp), newOrder(xp)],
    animals: Array.isArray(f.animals) ? f.animals.filter((a) => a && a.kind in ANIMALS) : [],
    slots: Array.isArray(f.slots) && f.slots.length >= 2 ? f.slots.map((s) => (s && s.recipe in RECIPE ? s : null)) : [null, null],
    daily: f.daily ?? { last: '', streak: 0 },
    achievements: Array.isArray(f.achievements) ? f.achievements : [],
    planted: Array.isArray(f.planted) ? f.planted : [...new Set(plantedFromPlots)],
    stats: { harvested: 0, delivered: 0, earned: 0, crafted: 0, collected: 0, ...(f.stats ?? {}) },
    savedAt: typeof f.savedAt === 'number' ? f.savedAt : 0,
  }
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

export const has = (inv: Farm['inv'], needs: Partial<Record<ItemId, number>>) => Object.entries(needs).every(([k, n]) => (inv[k as ItemId] ?? 0) >= (n ?? 0))
export const take = (inv: Farm['inv'], needs: Partial<Record<ItemId, number>>) => {
  const out = { ...inv }
  for (const [k, n] of Object.entries(needs)) out[k as ItemId] = (out[k as ItemId] ?? 0) - (n ?? 0)
  return out
}
export const needsText = (needs: Partial<Record<ItemId, number>>) =>
  Object.entries(needs)
    .map(([k, n]) => `${n} ${ITEMS[k as ItemId].icon}`)
    .join(' + ')
