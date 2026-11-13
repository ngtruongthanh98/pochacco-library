// Luật chơi và dữ liệu của Nông trại Pochacco. Mọi thứ chạy theo giờ thật nên đóng trang rồi quay lại vẫn tiếp tục.
// Phiên bản dữ liệu 3: thêm vườn cây ăn quả, vật nuôi mới, máy xay và khung dệt, ao cá, phân bón và hạng sao,
// xe giao hàng, sự kiện theo mùa, cấp tới 15. Bản 1 và 2 cũ được nâng cấp tự động, giữ nguyên tiến trình.

export type CropId =
  | 'lua' | 'carot' | 'bap' | 'cachua' | 'bingo' | 'duahau' | 'dau' | 'ot' | 'huongduong' | 'mia' | 'caphe' | 'nam' | 'sen'
  | 'ladong' | 'dauxanh'
export type ProductId = 'trung' | 'sua' | 'len' | 'trungvit' | 'matong'
export type FruitId = 'xoai' | 'cam' | 'buoi'
export type FishId = 'ca' | 'cachep'
export type GoodId =
  | 'banhmi' | 'banhcarot' | 'sotcachua' | 'phomai' | 'banhbingo' | 'nuocep' | 'mutdau' | 'dauhuongduong'
  | 'botmi' | 'botbap' | 'duong' | 'goixoai' | 'banhbap' | 'nuoccam' | 'cafesua' | 'canuong' | 'cheboi' | 'canhchua'
  | 'banhbonglan' | 'launam' | 'trasen' | 'khanlen' | 'aolen' | 'gioqua' | 'banhchung' | 'banhtrungthu' | 'com'
export type ItemId = CropId | ProductId | FruitId | FishId | GoodId
export type EventId = 'tet' | 'trungthu' | 'muagat'

export type Crop = { id: CropId; name: string; icon: string; level: number; seed: number; sell: number; minutes: number; xp: number; event?: EventId }
export const CROPS: Crop[] = [
  { id: 'lua', name: 'Lúa', icon: '🌾', level: 1, seed: 2, sell: 5, minutes: 1, xp: 1 },
  { id: 'carot', name: 'Cà rốt', icon: '🥕', level: 1, seed: 5, sell: 12, minutes: 3, xp: 2 },
  { id: 'bap', name: 'Bắp', icon: '🌽', level: 2, seed: 10, sell: 28, minutes: 10, xp: 4 },
  { id: 'cachua', name: 'Cà chua', icon: '🍅', level: 3, seed: 15, sell: 45, minutes: 20, xp: 6 },
  { id: 'bingo', name: 'Bí ngô', icon: '🎃', level: 4, seed: 25, sell: 90, minutes: 45, xp: 10 },
  { id: 'duahau', name: 'Dưa hấu', icon: '🍉', level: 5, seed: 40, sell: 160, minutes: 90, xp: 15 },
  { id: 'dau', name: 'Dâu tây', icon: '🍓', level: 6, seed: 60, sell: 260, minutes: 180, xp: 25 },
  { id: 'ot', name: 'Ớt', icon: '🌶️', level: 7, seed: 50, sell: 220, minutes: 120, xp: 20 },
  { id: 'huongduong', name: 'Hướng dương', icon: '🌻', level: 8, seed: 100, sell: 520, minutes: 360, xp: 45 },
  { id: 'mia', name: 'Mía', icon: '🎋', level: 9, seed: 70, sell: 300, minutes: 240, xp: 32 },
  { id: 'caphe', name: 'Cà phê', icon: '🫘', level: 11, seed: 160, sell: 820, minutes: 420, xp: 65 },
  { id: 'nam', name: 'Nấm', icon: '🍄', level: 13, seed: 200, sell: 1000, minutes: 480, xp: 80 },
  { id: 'sen', name: 'Hoa sen', icon: '🪷', level: 15, seed: 300, sell: 1600, minutes: 720, xp: 120 },
  // Cây chỉ gieo được trong sự kiện
  { id: 'ladong', name: 'Lá dong', icon: '🍃', level: 1, seed: 4, sell: 10, minutes: 5, xp: 2, event: 'tet' },
  { id: 'dauxanh', name: 'Đậu xanh', icon: '🫛', level: 1, seed: 4, sell: 12, minutes: 8, xp: 2, event: 'trungthu' },
]
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<CropId, Crop>
/** Tám loại cây gốc, dùng cho thành tựu "Vườn đủ loại". */
export const BASE_CROPS: CropId[] = ['lua', 'carot', 'bap', 'cachua', 'bingo', 'duahau', 'dau', 'huongduong']

// ---- Chuồng trại ----
export type AnimalKind = 'ga' | 'bo' | 'cuu' | 'vit' | 'ong'
export type AnimalDef = { kind: AnimalKind; name: string; icon: string; level: number; cost: number; max: number; eats: Partial<Record<CropId, number>>; gives: ProductId; minutes: number; xp: number }
export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  ga: { kind: 'ga', name: 'Gà mái', icon: '🐔', level: 2, cost: 60, max: 4, eats: { lua: 1 }, gives: 'trung', minutes: 20, xp: 3 },
  bo: { kind: 'bo', name: 'Bò sữa', icon: '🐄', level: 4, cost: 250, max: 3, eats: { bap: 2 }, gives: 'sua', minutes: 60, xp: 8 },
  cuu: { kind: 'cuu', name: 'Cừu', icon: '🐑', level: 6, cost: 500, max: 3, eats: { bap: 1, carot: 2 }, gives: 'len', minutes: 90, xp: 14 },
  vit: { kind: 'vit', name: 'Vịt', icon: '🦆', level: 8, cost: 350, max: 4, eats: { lua: 2 }, gives: 'trungvit', minutes: 40, xp: 6 },
  ong: { kind: 'ong', name: 'Tổ ong', icon: '🐝', level: 10, cost: 900, max: 3, eats: { huongduong: 1 }, gives: 'matong', minutes: 150, xp: 40 },
}
export type Animal = { kind: AnimalKind; readyAt: number | null; fedAt: number | null }

// ---- Vườn cây ăn quả: trồng một lần, hái nhiều lần ----
export type TreeKind = FruitId
export type TreeDef = { kind: TreeKind; name: string; tree: string; icon: string; level: number; cost: number; first: number; cycle: number; yield: number; sell: number; xp: number }
export const TREES: Record<TreeKind, TreeDef> = {
  xoai: { kind: 'xoai', name: 'Xoài', tree: '🌳', icon: '🥭', level: 9, cost: 500, first: 240, cycle: 180, yield: 3, sell: 150, xp: 12 },
  cam: { kind: 'cam', name: 'Cam', tree: '🌳', icon: '🍊', level: 11, cost: 700, first: 300, cycle: 240, yield: 4, sell: 170, xp: 14 },
  buoi: { kind: 'buoi', name: 'Bưởi', tree: '🌳', icon: '🍈', level: 12, cost: 1000, first: 360, cycle: 300, yield: 3, sell: 300, xp: 22 },
}
export type Tree = { kind: TreeKind; plantedAt: number; since: number; readyAt: number; picks: number }
export const ORCHARD_LEVEL = 9
export const TREE_SLOT_COST = [0, 0, 800, 1500, 3000, 5000] // ô vườn thứ 1..6

// ---- Ao cá ----
export const POND_LEVEL = 11
export const BAIT_MAX = 6
export const BAIT_MIN = 10 // phút hồi một mồi
export const FISH: Record<FishId, { name: string; icon: string; sell: number; xp: number }> = {
  ca: { name: 'Cá rô', icon: '🐟', sell: 120, xp: 8 },
  cachep: { name: 'Cá chép', icon: '🐠', sell: 320, xp: 20 },
}

// ---- Xưởng: lò bánh, máy xay, khung dệt ----
export type Station = 'lo' | 'xay' | 'det'
export const STATIONS: Record<Station, { name: string; icon: string; level: number; slotCost: number[] }> = {
  lo: { name: 'Lò bánh', icon: '🍞', level: 2, slotCost: [0, 0, 400, 1200] },
  xay: { name: 'Máy xay', icon: '⚙️', level: 10, slotCost: [0, 900, 2500] },
  det: { name: 'Khung dệt', icon: '🧵', level: 12, slotCost: [0, 1500, 4000] },
}
export type Recipe = { id: GoodId; name: string; icon: string; level: number; station: Station; needs: Partial<Record<ItemId, number>>; minutes: number; sell: number; xp: number; event?: EventId }
export const RECIPES: Recipe[] = [
  { id: 'banhmi', name: 'Bánh mì', icon: '🍞', level: 2, station: 'lo', needs: { lua: 3 }, minutes: 10, sell: 40, xp: 5 },
  { id: 'banhcarot', name: 'Bánh cà rốt', icon: '🧁', level: 3, station: 'lo', needs: { carot: 2, trung: 1 }, minutes: 20, sell: 95, xp: 9 },
  { id: 'sotcachua', name: 'Sốt cà chua', icon: '🥫', level: 4, station: 'lo', needs: { cachua: 3 }, minutes: 25, sell: 170, xp: 12 },
  { id: 'phomai', name: 'Phô mai', icon: '🧀', level: 5, station: 'lo', needs: { sua: 2 }, minutes: 40, sell: 220, xp: 16 },
  { id: 'banhbingo', name: 'Bánh bí ngô', icon: '🥧', level: 5, station: 'lo', needs: { bingo: 1, trung: 1, sua: 1 }, minutes: 45, sell: 260, xp: 20 },
  { id: 'nuocep', name: 'Nước ép dưa hấu', icon: '🧃', level: 6, station: 'lo', needs: { duahau: 2 }, minutes: 30, sell: 380, xp: 24 },
  { id: 'mutdau', name: 'Thạch dâu', icon: '🍮', level: 7, station: 'lo', needs: { dau: 3 }, minutes: 60, sell: 900, xp: 40 },
  { id: 'dauhuongduong', name: 'Dầu hướng dương', icon: '🫙', level: 8, station: 'lo', needs: { huongduong: 2 }, minutes: 90, sell: 1250, xp: 60 },
  { id: 'goixoai', name: 'Gỏi xoài', icon: '🥗', level: 9, station: 'lo', needs: { xoai: 2, ot: 1 }, minutes: 30, sell: 680, xp: 30 },
  { id: 'banhbap', name: 'Bánh bắp', icon: '🌮', level: 10, station: 'lo', needs: { botbap: 2, trung: 1 }, minutes: 30, sell: 380, xp: 22 },
  { id: 'nuoccam', name: 'Nước cam', icon: '🍹', level: 11, station: 'lo', needs: { cam: 3 }, minutes: 25, sell: 680, xp: 30 },
  { id: 'cafesua', name: 'Cà phê sữa', icon: '☕', level: 11, station: 'lo', needs: { caphe: 1, sua: 1, duong: 1 }, minutes: 40, sell: 1700, xp: 70 },
  { id: 'canuong', name: 'Cá nướng', icon: '🍢', level: 11, station: 'lo', needs: { ca: 2, ot: 1 }, minutes: 30, sell: 640, xp: 32 },
  { id: 'cheboi', name: 'Chè bưởi', icon: '🍧', level: 12, station: 'lo', needs: { buoi: 2, duong: 1 }, minutes: 45, sell: 1350, xp: 55 },
  { id: 'canhchua', name: 'Canh chua cá', icon: '🍲', level: 12, station: 'lo', needs: { ca: 2, cachua: 2, ot: 1 }, minutes: 40, sell: 780, xp: 38 },
  { id: 'banhbonglan', name: 'Bánh bông lan', icon: '🍰', level: 13, station: 'lo', needs: { botmi: 2, trungvit: 3, duong: 1 }, minutes: 60, sell: 1000, xp: 50 },
  { id: 'launam', name: 'Lẩu nấm', icon: '🫕', level: 13, station: 'lo', needs: { nam: 2, ca: 1, ot: 1 }, minutes: 70, sell: 3000, xp: 110 },
  { id: 'trasen', name: 'Trà sen mật ong', icon: '🍵', level: 15, station: 'lo', needs: { sen: 2, matong: 1 }, minutes: 90, sell: 5200, xp: 180 },
  // Máy xay
  { id: 'botmi', name: 'Bột mì', icon: '🧂', level: 10, station: 'xay', needs: { lua: 4 }, minutes: 15, sell: 45, xp: 4 },
  { id: 'botbap', name: 'Bột bắp', icon: '🫓', level: 10, station: 'xay', needs: { bap: 3 }, minutes: 20, sell: 120, xp: 8 },
  { id: 'duong', name: 'Đường mía', icon: '🍬', level: 10, station: 'xay', needs: { mia: 1 }, minutes: 45, sell: 400, xp: 16 },
  // Khung dệt
  { id: 'khanlen', name: 'Khăn len', icon: '🧣', level: 12, station: 'det', needs: { len: 3 }, minutes: 60, sell: 680, xp: 34 },
  { id: 'aolen', name: 'Áo len', icon: '🧥', level: 13, station: 'det', needs: { len: 5 }, minutes: 120, sell: 1150, xp: 60 },
  { id: 'gioqua', name: 'Giỏ quà nông trại', icon: '🎁', level: 14, station: 'det', needs: { khanlen: 1, matong: 1, banhbonglan: 1 }, minutes: 90, sell: 3400, xp: 140 },
  // Món sự kiện
  { id: 'banhchung', name: 'Bánh chưng', icon: '🟩', level: 1, station: 'lo', needs: { lua: 4, ladong: 2 }, minutes: 60, sell: 120, xp: 12, event: 'tet' },
  { id: 'banhtrungthu', name: 'Bánh trung thu', icon: '🥮', level: 2, station: 'lo', needs: { lua: 2, dauxanh: 2, trung: 1 }, minutes: 40, sell: 150, xp: 14, event: 'trungthu' },
  { id: 'com', name: 'Cốm mới', icon: '🍚', level: 1, station: 'lo', needs: { lua: 6 }, minutes: 20, sell: 75, xp: 8, event: 'muagat' },
]
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r])) as Record<GoodId, Recipe>
export type Slot = { recipe: GoodId; readyAt: number } | null
/** Giữ tên cũ cho lò bánh. */
export const SLOT_COST = STATIONS.lo.slotCost

// ---- Phân bón, hạng sao ----
export const FERT_LEVEL = 7
export const FERT_PACK = { n: 5, cost: 100 }
export const TIER_MUL = [1, 1.25, 1.6] // thường, bạc, vàng
export const TIER_ICON = ['', '🥈', '🥇']
/** Gieo có phân: 15% thường, 50% bạc, 35% vàng. Không phân: 12% bạc. */
export const rollTier = (fert: boolean) => {
  const r = Math.random()
  return fert ? (r < 0.35 ? 2 : r < 0.85 ? 1 : 0) : r < 0.12 ? 1 : 0
}

// ---- Xe giao hàng ----
export const TRUCK_LEVEL = 8
export const TRUCK2_LEVEL = 14
export type Trip = { order: Order; leftAt: number; backAt: number } | null

// ---- Sự kiện theo mùa (theo lịch thật) ----
export type Decor = { id: string; name: string; icon: string; cost: number }
export type EventDef = { id: EventId; name: string; icon: string; blurb: string; who: string; crop?: CropId; recipe: GoodId; decor: Decor[]; harvestXp?: number }
export const EVENTS: Record<EventId, EventDef> = {
  tet: {
    id: 'tet', name: 'Tết Nguyên đán', icon: '🧧', who: 'Ông đồ đầu làng',
    blurb: 'Gieo lá dong, gói bánh chưng ở lò bánh, trang hoàng nông trại đón xuân.',
    crop: 'ladong', recipe: 'banhchung',
    decor: [{ id: 'caumai', name: 'Cây mai vàng', icon: '🌼', cost: 800 }, { id: 'caudoi', name: 'Câu đối đỏ', icon: '🧧', cost: 300 }],
  },
  trungthu: {
    id: 'trungthu', name: 'Tết Trung thu', icon: '🏮', who: 'Chú Cuội',
    blurb: 'Gieo đậu xanh, làm bánh trung thu, treo đèn lồng chờ trăng rằm.',
    crop: 'dauxanh', recipe: 'banhtrungthu',
    decor: [{ id: 'denlong', name: 'Đèn lồng', icon: '🏮', cost: 300 }, { id: 'mamco', name: 'Mâm cỗ trông trăng', icon: '🎑', cost: 800 }],
  },
  muagat: {
    id: 'muagat', name: 'Mùa gặt', icon: '🌾', who: 'Bác nông dân làng bên',
    blurb: 'Tháng mười một vào mùa: thu hoạch được thêm 50% kinh nghiệm, làm cốm mới từ lúa non.',
    recipe: 'com', harvestXp: 0.5,
    decor: [{ id: 'giomua', name: 'Giỏ mừng mùa', icon: '🧺', cost: 300 }, { id: 'trau', name: 'Chú trâu cày', icon: '🐃', cost: 900 }],
  },
}
export const TET_DAYS = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23', '2032-02-11']
export const TRUNGTHU_DAYS = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01', '2032-09-19']
const DAY = 86_400_000
const atMidnight = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
export type ActiveEvent = EventDef & { start: number; end: number }
/** Sự kiện đang diễn ra lúc t (giờ máy người chơi), hoặc null. */
export function activeEvent(t = Date.now()): ActiveEvent | null {
  for (const iso of TET_DAYS) {
    const d = atMidnight(iso)
    if (t >= d - 14 * DAY && t < d + 8 * DAY) return { ...EVENTS.tet, start: d - 14 * DAY, end: d + 8 * DAY }
  }
  for (const iso of TRUNGTHU_DAYS) {
    const d = atMidnight(iso)
    if (t >= d - 14 * DAY && t < d + 4 * DAY) return { ...EVENTS.trungthu, start: d - 14 * DAY, end: d + 4 * DAY }
  }
  const now = new Date(t)
  if (now.getMonth() === 10) {
    const start = new Date(now.getFullYear(), 10, 1).getTime()
    return { ...EVENTS.muagat, start, end: new Date(now.getFullYear(), 11, 1).getTime() }
  }
  return null
}
export const ALL_DECOR: Decor[] = Object.values(EVENTS).flatMap((e) => e.decor)

// ---- Mọi vật phẩm trong kho ----
export type ItemDef = { id: ItemId; name: string; icon: string; sell: number; level: number; event?: EventId; tiered?: boolean }
const PRODUCT: Record<ProductId, { name: string; icon: string; sell: number }> = {
  trung: { name: 'Trứng gà', icon: '🥚', sell: 30 },
  sua: { name: 'Sữa', icon: '🥛', sell: 85 },
  len: { name: 'Len', icon: '🧶', sell: 160 },
  trungvit: { name: 'Trứng vịt', icon: '🪺', sell: 70 },
  matong: { name: 'Mật ong', icon: '🍯', sell: 820 },
}
export const ITEMS: Record<ItemId, ItemDef> = {
  ...(Object.fromEntries(CROPS.map((c) => [c.id, { id: c.id, name: c.name, icon: c.icon, sell: c.sell, level: c.level, event: c.event, tiered: true }])) as Record<CropId, ItemDef>),
  ...(Object.fromEntries(
    (Object.keys(PRODUCT) as ProductId[]).map((id) => [id, { id, ...PRODUCT[id], level: Object.values(ANIMALS).find((a) => a.gives === id)!.level }]),
  ) as Record<ProductId, ItemDef>),
  ...(Object.fromEntries(Object.values(TREES).map((t) => [t.kind, { id: t.kind, name: t.name, icon: t.icon, sell: t.sell, level: t.level, tiered: true }])) as Record<FruitId, ItemDef>),
  ...(Object.fromEntries((Object.keys(FISH) as FishId[]).map((id) => [id, { id, name: FISH[id].name, icon: FISH[id].icon, sell: FISH[id].sell, level: POND_LEVEL, tiered: true }])) as unknown as Record<FishId, ItemDef>),
  ...(Object.fromEntries(RECIPES.map((r) => [r.id, { id: r.id, name: r.name, icon: r.icon, sell: r.sell, level: r.level, event: r.event }])) as Record<GoodId, ItemDef>),
}
export const ITEM_ORDER: ItemId[] = [
  ...CROPS.map((c) => c.id),
  ...(Object.keys(TREES) as FruitId[]),
  ...(Object.keys(FISH) as FishId[]),
  ...(Object.keys(PRODUCT) as ProductId[]),
  ...RECIPES.map((r) => r.id),
]

export type Plot = { crop: CropId; plantedAt: number; readyAt: number; watered: boolean; fert?: boolean } | null
export type Order = { id: string; want: Partial<Record<ItemId, number>>; gold?: Partial<Record<ItemId, number>>; coins: number; xp: number; who: string; event?: EventId; hours?: number }
/** Số lượng theo hạng: [bạc, vàng]; phần còn lại trong inv là hàng thường. */
export type Tiers = Partial<Record<ItemId, [number, number]>>

export type Farm = {
  v: 3
  coins: number
  xp: number
  size: 3 | 4 | 5
  plots: Plot[]
  inv: Partial<Record<ItemId, number>>
  q: Tiers
  orders: Order[]
  animals: Animal[]
  slots: Slot[] // lò bánh
  mill: Slot[]
  loom: Slot[]
  trees: (Tree | null)[]
  fert: number
  useFert: boolean
  bait: { n: number; at: number }
  trucks: Trip[]
  bigOrder: Order | null
  decor: string[]
  daily: { last: string; streak: number }
  achievements: string[]
  planted: CropId[]
  stats: { harvested: number; delivered: number; earned: number; crafted: number; collected: number; fruits: number; fished: number; trips: number; gold: number; woven: number }
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

/** Những thứ mở thêm ở mỗi cấp (ngoài cây, vật nuôi, món). */
export const FEATURES: { level: number; text: string }[] = [
  { level: FERT_LEVEL, text: '🧪 Phân bón và hàng có sao' },
  { level: TRUCK_LEVEL, text: '🚚 Xe giao hàng' },
  { level: ORCHARD_LEVEL, text: '🌳 Vườn cây ăn quả' },
  { level: STATIONS.xay.level, text: '⚙️ Máy xay' },
  { level: POND_LEVEL, text: '🎣 Ao cá' },
  { level: STATIONS.det.level, text: '🧵 Khung dệt' },
  { level: TRUCK2_LEVEL, text: '🚚 Xe thứ hai' },
]
export function unlocksBetween(lo: number, hi: number) {
  const inRange = (l: number) => l > lo && l <= hi
  return [
    ...FEATURES.filter((f) => inRange(f.level)).map((f) => f.text),
    ...CROPS.filter((c) => !c.event && inRange(c.level)).map((c) => `${c.icon} ${c.name}`),
    ...Object.values(TREES).filter((t) => inRange(t.level)).map((t) => `${t.icon} cây ${t.name}`),
    ...Object.values(ANIMALS).filter((a) => inRange(a.level)).map((a) => `${a.icon} ${a.name}`),
    ...RECIPES.filter((r) => !r.event && inRange(r.level)).map((r) => `${r.icon} ${r.name}`),
  ]
}
/** Mốc mở khóa kế tiếp, để người chơi luôn có mục tiêu gần. */
export function nextUnlock(lv: number) {
  for (let l = lv + 1; l <= 15; l++) {
    const u = unlocksBetween(l - 1, l)
    if (u.length) return { level: l, items: u }
  }
  return null
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
  if (r < 3) return { id: 'mua', icon: '🌧️', name: 'Mưa', note: 'Trời mưa: cây gieo hôm nay được tưới sẵn, cá cắn câu nhiều hơn.', sellBonus: 0 }
  if (r < 5) return { id: 'nang', icon: '☀️', name: 'Nắng đẹp', note: 'Chợ đông khách: bán được thêm 10%.', sellBonus: 0.1 }
  if (r < 6) return { id: 'gio', icon: '🍃', name: 'Gió mát', note: 'Vật nuôi vui vẻ: sản phẩm chuồng được gấp đôi kinh nghiệm.', sellBonus: 0 }
  return { id: 'dep', icon: '⛅', name: 'Trời dịu', note: 'Một ngày yên bình ở nông trại.', sellBonus: 0 }
}

// ---- Đơn hàng ----
const WHO = ['Cô giáo Lan', 'Bác bán sách đầu ngõ', 'Bạn Mèo Mun', 'Chị Thỏ Bông', 'Ông Gấu nhà bên', 'Thủ thư Pochacco', 'Bé Vịt Vàng', 'Quán chè cô Ba']
const rid = () => Math.random().toString(36).slice(2, 8)
const minutesOf = (id: ItemId): number => {
  if (id in CROP) return CROP[id as CropId].minutes
  if (id in RECIPE) return RECIPE[id as GoodId].minutes + 30
  if (id in TREES) return TREES[id as FruitId].cycle / 3
  if (id in FISH) return 20
  return Object.values(ANIMALS).find((a) => a.gives === id)?.minutes ?? 30
}
const xpOf = (id: ItemId): number => {
  if (id in CROP) return CROP[id as CropId].xp
  if (id in RECIPE) return RECIPE[id as GoodId].xp
  if (id in TREES) return TREES[id as FruitId].xp
  if (id in FISH) return FISH[id as FishId].xp
  return Object.values(ANIMALS).find((a) => a.gives === id)?.xp ?? 3
}
const orderPool = (lv: number) => ITEM_ORDER.filter((id) => !ITEMS[id].event && ITEMS[id].level <= lv)

/** Đơn hàng thường; trong sự kiện có lúc là đơn sự kiện (thưởng ×1,5). Từ cấp phân bón, có đơn đòi hàng sao vàng. */
export function newOrder(xp: number, ev: EventId | null = null): Order {
  const lv = levelOf(xp).lv
  const pool = orderPool(lv)
  const evItem = ev ? EVENTS[ev].recipe : null
  const isEvent = !!evItem && ITEMS[evItem].level <= lv && Math.random() < 0.45
  const kinds = isEvent ? Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * Math.min(3, pool.length))
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, kinds)
  if (isEvent) picks.unshift(evItem!)
  const want: Partial<Record<ItemId, number>> = {}
  let value = 0
  let x = 0
  for (const id of picks) {
    const slow = minutesOf(id)
    const n = 1 + Math.floor(Math.random() * (slow <= 3 ? 6 : slow <= 20 ? 4 : 2))
    want[id] = n
    value += ITEMS[id].sell * n
    x += xpOf(id) * n
  }
  let gold: Order['gold']
  let mul = 1.45
  if (!isEvent && lv >= FERT_LEVEL && Math.random() < 0.3) {
    const tiered = picks.filter((id) => ITEMS[id].tiered && id in CROP)
    if (tiered.length) {
      const id = tiered[0]
      gold = { [id]: Math.min(want[id]!, 2) }
      mul = 1.9
    }
  }
  if (isEvent) mul = 2.2
  return {
    id: rid(), want, gold, coins: Math.round(value * mul), xp: Math.round(x * (isEvent ? 2 : 1.5)) + 2,
    who: isEvent ? EVENTS[ev!].who : WHO[Math.floor(Math.random() * WHO.length)], event: isEvent ? ev! : undefined,
  }
}

/** Đơn lớn chở bằng xe: số lượng gấp ba, thưởng gấp đôi, xe đi về 1–4 giờ. */
export function newBigOrder(xp: number): Order {
  const lv = levelOf(xp).lv
  const pool = orderPool(lv).filter((id) => minutesOf(id) >= 3)
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2))
  const want: Partial<Record<ItemId, number>> = {}
  let value = 0
  let x = 0
  for (const id of picks) {
    const slow = minutesOf(id)
    const n = (slow <= 20 ? 6 : slow <= 90 ? 4 : 2) + Math.floor(Math.random() * 3)
    want[id] = n
    value += ITEMS[id].sell * n
    x += xpOf(id) * n
  }
  const hours = Math.min(4, 1 + Math.floor(value / 2500))
  return { id: rid(), want, coins: Math.round(value * 1.45 * 2), xp: Math.round(x * 2.2) + 10, who: 'Chợ đầu mối thị trấn', hours }
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
  { id: 'first-bake', name: 'Thợ làm bánh', icon: '🍞', desc: 'Làm xong món đầu tiên ở xưởng', reward: 30, test: (f) => f.stats.crafted >= 1 },
  { id: 'craft-50', name: 'Bếp trưởng', icon: '🥐', desc: 'Làm 50 món ở xưởng', reward: 400, test: (f) => f.stats.crafted >= 50 },
  { id: 'coins-1000', name: 'Hũ xu đầy', icon: '🪙', desc: 'Có 1.000 xu cùng lúc', reward: 50, test: (f) => f.coins >= 1000 },
  { id: 'level-5', name: 'Nông dân lành nghề', icon: '⭐', desc: 'Đạt cấp 5', reward: 100, test: (f) => levelOf(f.xp).lv >= 5 },
  { id: 'level-10', name: 'Chủ trang trại', icon: '🌟', desc: 'Đạt cấp 10', reward: 500, test: (f) => levelOf(f.xp).lv >= 10 },
  { id: 'field-5', name: 'Cánh đồng rộng', icon: '🗺️', desc: 'Mở rộng ruộng lên 5×5', reward: 200, test: (f) => f.size >= 5 },
  { id: 'all-crops', name: 'Vườn đủ loại', icon: '🌈', desc: 'Trồng đủ 8 loại cây gốc', reward: 300, test: (f) => BASE_CROPS.every((c) => f.planted.includes(c)) },
  { id: 'streak-7', name: 'Chăm chỉ cả tuần', icon: '📅', desc: 'Điểm danh 7 ngày liền', reward: 200, test: (f) => f.daily.streak >= 7 },
  { id: 'gold-20', name: 'Nông sản hạng vàng', icon: '🥇', desc: 'Thu 20 nông sản sao vàng', reward: 250, test: (f) => f.stats.gold >= 20 },
  { id: 'first-fruit', name: 'Trái ngọt đầu mùa', icon: '🥭', desc: 'Hái quả lần đầu', reward: 60, test: (f) => f.stats.fruits >= 1 },
  { id: 'trips-10', name: 'Bác tài chăm chỉ', icon: '🛻', desc: 'Hoàn thành 10 chuyến xe', reward: 300, test: (f) => f.stats.trips >= 10 },
  { id: 'fish-20', name: 'Cần thủ', icon: '🎣', desc: 'Câu được 20 con cá', reward: 250, test: (f) => f.stats.fished >= 20 },
  { id: 'loom-first', name: 'Thợ dệt', icon: '🧣', desc: 'Dệt xong món đầu tiên', reward: 100, test: (f) => f.stats.woven >= 1 },
  { id: 'decor-3', name: 'Nông trại rộn ràng', icon: '🎊', desc: 'Có 3 món trang trí sự kiện', reward: 200, test: (f) => f.decor.length >= 3 },
  { id: 'level-15', name: 'Đại điền chủ', icon: '👑', desc: 'Đạt cấp 15', reward: 1500, test: (f) => levelOf(f.xp).lv >= 15 },
]

/** Thưởng điểm danh theo chuỗi ngày (tối đa ở ngày thứ 7; tròn tuần được thêm 50 xu). */
export const dailyReward = (streak: number) => ({ coins: 15 * Math.min(streak, 7) + (streak % 7 === 0 ? 50 : 0), xp: 2 * Math.min(streak, 7) })

const emptyStats = (): Farm['stats'] => ({ harvested: 0, delivered: 0, earned: 0, crafted: 0, collected: 0, fruits: 0, fished: 0, trips: 0, gold: 0, woven: 0 })

export function newFarm(): Farm {
  return {
    v: 3,
    coins: 30,
    xp: 0,
    size: 3,
    plots: Array(9).fill(null),
    inv: {},
    q: {},
    orders: [newOrder(0), newOrder(0), newOrder(0)],
    animals: [],
    slots: [null, null],
    mill: [null],
    loom: [null],
    trees: [null, null],
    fert: 0,
    useFert: true,
    bait: { n: BAIT_MAX, at: Date.now() },
    trucks: [null],
    bigOrder: null,
    decor: [],
    daily: { last: '', streak: 0 },
    achievements: [],
    planted: [],
    stats: emptyStats(),
    savedAt: Date.now(),
  }
}

const slotsOk = (a: unknown, min: number): Slot[] =>
  Array.isArray(a) && a.length >= min ? a.map((s: Slot) => (s && s.recipe in RECIPE ? s : null)) : Array(min).fill(null)

/** Kiểm tra dữ liệu đọc về (máy hoặc repo); nâng cấp bản 1, 2 lên bản 3. Hỏng thì trả null. */
export function parseFarm(raw: unknown): Farm | null {
  const f = raw as (Omit<Partial<Farm>, 'v'> & { v?: number }) | null
  if (!f || (f.v !== 1 && f.v !== 2 && f.v !== 3) || typeof f.coins !== 'number' || !Array.isArray(f.plots) || ![3, 4, 5].includes(f.size as number)) return null
  if (f.plots.length !== (f.size as number) ** 2) return null
  for (const p of f.plots) if (p && !(p.crop in CROP)) return null
  const xp = typeof f.xp === 'number' ? f.xp : 0
  const plantedFromPlots = f.plots.filter(Boolean).map((p) => p!.crop)
  const inv: Farm['inv'] = {}
  for (const [k, n] of Object.entries(f.inv ?? {})) if (k in ITEMS && typeof n === 'number' && n > 0) inv[k as ItemId] = n
  const q: Tiers = {}
  for (const [k, v] of Object.entries(f.q ?? {})) {
    if (!(k in inv) || !Array.isArray(v)) continue
    const g = Math.min(v[1] ?? 0, inv[k as ItemId]!)
    const s = Math.min(v[0] ?? 0, inv[k as ItemId]! - g)
    if (s || g) q[k as ItemId] = [s, g]
  }
  return {
    v: 3,
    coins: f.coins,
    xp,
    size: f.size as 3 | 4 | 5,
    plots: f.plots as Plot[],
    inv,
    q,
    orders: (() => {
      const ok = Array.isArray(f.orders) ? f.orders.filter((o) => o && Object.keys(o.want ?? {}).every((k) => k in ITEMS)) : []
      while (ok.length < 3) ok.push(newOrder(xp))
      return ok
    })(),
    animals: Array.isArray(f.animals) ? f.animals.filter((a) => a && a.kind in ANIMALS) : [],
    slots: slotsOk(f.slots, 2),
    mill: slotsOk(f.mill, 1),
    loom: slotsOk(f.loom, 1),
    trees: Array.isArray(f.trees) && f.trees.length >= 2 ? f.trees.map((t) => (t && t.kind in TREES ? t : null)) : [null, null],
    fert: typeof f.fert === 'number' ? f.fert : 0,
    useFert: f.useFert ?? true,
    bait: f.bait && typeof f.bait.n === 'number' ? f.bait : { n: BAIT_MAX, at: Date.now() },
    trucks: Array.isArray(f.trucks) && f.trucks.length ? f.trucks : [null],
    bigOrder: f.bigOrder ?? null,
    decor: Array.isArray(f.decor) ? f.decor : [],
    daily: f.daily ?? { last: '', streak: 0 },
    achievements: Array.isArray(f.achievements) ? f.achievements : [],
    planted: Array.isArray(f.planted) ? f.planted : [...new Set(plantedFromPlots)],
    stats: { ...emptyStats(), ...(f.stats ?? {}) },
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

// ---- Kho có hạng sao ----
/** Số hàng thường, bạc, vàng của một món. */
export const tiersOf = (f: Pick<Farm, 'inv' | 'q'>, id: ItemId) => {
  const n = f.inv[id] ?? 0
  const [s, g] = f.q[id] ?? [0, 0]
  return { all: n, normal: n - s - g, silver: s, gold: g }
}
export const has = (inv: Farm['inv'], needs: Partial<Record<ItemId, number>>) => Object.entries(needs).every(([k, n]) => (inv[k as ItemId] ?? 0) >= (n ?? 0))
export const hasGold = (f: Pick<Farm, 'inv' | 'q'>, gold?: Partial<Record<ItemId, number>>) =>
  !gold || Object.entries(gold).every(([k, n]) => tiersOf(f, k as ItemId).gold >= (n ?? 0))
/** Lấy hàng ra khỏi kho: hàng sao vàng bắt buộc lấy trước, còn lại lấy hàng thường trước rồi tới bạc, vàng. */
export function takeItems(f: Pick<Farm, 'inv' | 'q'>, needs: Partial<Record<ItemId, number>>, gold: Partial<Record<ItemId, number>> = {}) {
  const inv = { ...f.inv }
  const q: Tiers = { ...f.q }
  for (const [k, need] of Object.entries(needs)) {
    const id = k as ItemId
    let { normal, silver, gold: g } = tiersOf({ inv, q }, id)
    let rest = need ?? 0
    const mustGold = Math.min(gold[id] ?? 0, rest)
    g -= mustGold
    rest -= mustGold
    const a = Math.min(rest, normal)
    normal -= a
    rest -= a
    const b = Math.min(rest, silver)
    silver -= b
    rest -= b
    g -= Math.min(rest, g)
    inv[id] = normal + silver + g
    if (silver || g) q[id] = [silver, g]
    else delete q[id]
  }
  return { inv, q }
}
/** Thêm hàng vào kho theo hạng (0 thường, 1 bạc, 2 vàng). */
export function addItem(f: Pick<Farm, 'inv' | 'q'>, id: ItemId, n: number, tier = 0) {
  const inv = { ...f.inv, [id]: (f.inv[id] ?? 0) + n }
  const q = { ...f.q }
  if (tier) {
    const [s, g] = q[id] ?? [0, 0]
    q[id] = tier === 2 ? [s, g + n] : [s + n, g]
  }
  return { inv, q }
}
/** Giữ tên cũ cho chỗ chỉ cần trừ số lượng. */
export const take = (inv: Farm['inv'], needs: Partial<Record<ItemId, number>>) => takeItems({ inv, q: {} }, needs).inv

export const needsText = (needs: Partial<Record<ItemId, number>>) =>
  Object.entries(needs)
    .map(([k, n]) => `${n} ${ITEMS[k as ItemId].icon}`)
    .join(' + ')

/** Mồi câu hiện có (hồi 1 mồi mỗi BAIT_MIN phút, tối đa BAIT_MAX). */
export function baitNow(b: Farm['bait'], t = Date.now()) {
  if (b.n >= BAIT_MAX) return { n: BAIT_MAX, at: t, nextIn: 0 }
  const step = BAIT_MIN * 60_000
  const k = Math.floor((t - b.at) / step)
  const n = Math.min(BAIT_MAX, b.n + k)
  const at = n >= BAIT_MAX ? t : b.at + k * step
  return { n, at, nextIn: n >= BAIT_MAX ? 0 : at + step - t }
}
