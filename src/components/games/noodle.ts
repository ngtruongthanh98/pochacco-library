// Luật chơi và dữ liệu của Tiệm mì cay Pochacco. Người chơi là chủ tiệm: nhận đơn, bỏ topping,
// chọn cấp độ cay, canh lửa múc mì, rửa bát; hết ca thì dùng xu nâng cấp tiệm, dùng kim cương mua đồ trang trí theo mùa.
import { TET_DAYS, TRUNGTHU_DAYS } from './farm'

export const nAsset = (n: string) => `${import.meta.env.BASE_URL}assets/noodle/${n}.webp`

// ---- Topping ----
export type TopId = 'trung' | 'xucxich' | 'caithia' | 'cavien' | 'nam' | 'dauhu' | 'ot' | 'kimchi' | 'tom' | 'thitbo'
export type Topping = { id: TopId; name: string; unlock: number; price: number }
export const TOPPINGS: Topping[] = [
  { id: 'trung', name: 'Trứng ốp la', unlock: 0, price: 6 },
  { id: 'xucxich', name: 'Xúc xích', unlock: 0, price: 6 },
  { id: 'caithia', name: 'Cải thìa', unlock: 0, price: 4 },
  { id: 'cavien', name: 'Chả cá viên', unlock: 0, price: 6 },
  { id: 'nam', name: 'Nấm hương', unlock: 60, price: 7 },
  { id: 'dauhu', name: 'Đậu hũ', unlock: 90, price: 6 },
  { id: 'ot', name: 'Ớt tươi', unlock: 130, price: 4 },
  { id: 'kimchi', name: 'Kim chi', unlock: 180, price: 8 },
  { id: 'tom', name: 'Tôm', unlock: 260, price: 12 },
  { id: 'thitbo', name: 'Thịt bò', unlock: 360, price: 14 },
]
export const TOP = Object.fromEntries(TOPPINGS.map((t) => [t.id, t])) as Record<TopId, Topping>
export const SPICE_NAMES = ['Không cay', 'Cay nhẹ', 'Hơi cay', 'Cay vừa', 'Khá cay', 'Cay nhiều', 'Rất cay', 'Cay xé lưỡi']

// ---- Khách ----
export type CustKind = 'cuu' | 'haicau' | 'aomua' | 'hong' | 'plot' | 'cuuxam' | 'ngu' | 'banh'
export type Mood = 'arrive' | 'wait' | 'worried' | 'angry' | 'happy'
/** Tư thế theo tâm trạng: số thứ tự hình trong bộ 9 tư thế (kh-<id>-<số>.webp). */
type Poses = Record<Exclude<Mood, 'happy'>, number> & { happy: number[] }
export type CustDef = { img: string; label: string; fixed: boolean; poses?: Poses }
export const CUST: Record<CustKind, CustDef> = {
  cuu: { img: 'kh-cuu', label: 'Em Bé Dê', fixed: true },
  haicau: { img: 'kh-haicau', label: 'Hải Cẩu', fixed: false },
  aomua: { img: 'kh-aomua', label: 'Pochacco áo mưa', fixed: false },
  hong: { img: 'kh-hong', label: 'Em Bé Hồng', fixed: true, poses: { arrive: 0, wait: 3, worried: 5, angry: 4, happy: [1, 2, 8] } },
  plot: { img: 'kh-plot', label: 'Em Bé Plot', fixed: true, poses: { arrive: 0, wait: 7, worried: 3, angry: 4, happy: [1, 5, 8] } },
  cuuxam: { img: 'kh-cuuxam', label: 'Em Bé Cừu', fixed: true, poses: { arrive: 1, wait: 0, worried: 5, angry: 4, happy: [2, 7, 8] } },
  ngu: { img: 'kh-ngu', label: 'Em Bé Đi Ngủ', fixed: true, poses: { arrive: 0, wait: 5, worried: 4, angry: 3, happy: [7, 2] } },
  banh: { img: 'kh-banh', label: 'Em Bé Trái Banh', fixed: true, poses: { arrive: 0, wait: 3, worried: 7, angry: 2, happy: [1, 4, 8] } },
}
/** Khách ăn tại quán (khách mang về luôn là Pochacco áo mưa). */
export const DINE_IN: CustKind[] = ['cuu', 'haicau', 'hong', 'plot', 'cuuxam', 'ngu', 'banh']
/** Tên hình của khách theo tâm trạng; seed chọn một trong các tư thế vui. */
export function custImg(kind: CustKind, mood: Mood, seed = 0) {
  const d = CUST[kind]
  if (!d.poses) return d.img
  const k = mood === 'happy' ? d.poses.happy[seed % d.poses.happy.length] : d.poses[mood]
  return `${d.img}-${k}`
}
/** Lời khách nói khi rời quán. */
export const SAY_HAPPY = ['Ngon quá!', 'Cay đã luôn!', 'Mai mình lại tới!', 'Đúng ý quá!']
export const SAY_SAD = ['Hừm…', 'Chờ lâu quá à…', 'Chưa đúng món rồi…']
/** Chủ tiệm. */
export const OWNER = 'Em Bé Nơ'
/** Tên tiệm, ghi trên bảng hiệu. */
export const SHOP_NAME = 'Nơ'
/** Tên ngẫu nhiên cho khách không có tên riêng (các Em Bé luôn mang tên mình). */
export const NAMES = ['Bạn Hải Cẩu', 'Anh Áo Mưa', 'Chị Mây', 'Cô Bé Tóc Xù', 'Chú Gấu Nâu', 'Bạn Mèo Mun', 'Bé Thỏ Trắng', 'Anh Shipper', 'Cô giáo Lan']

// ---- Nâng cấp tiệm (giá theo cấp kế tiếp) ----
export type UpgradeId = 'stoves' | 'bowls' | 'seats' | 'price' | 'fire'
export const UPGRADES: Record<UpgradeId, { name: string; icon: string; desc: string; cost: number[] }> = {
  stoves: { name: 'Thêm bếp', icon: 'chu-nau', desc: 'Nấu nhiều tô cùng lúc', cost: [350, 1200] },
  bowls: { name: 'Thêm bát', icon: 'wash', desc: 'Thêm 2 bát sạch đầu ca', cost: [120, 240, 400] },
  seats: { name: 'Ghế chờ', icon: 'heart', desc: 'Thêm một chỗ chờ, khách kiên nhẫn hơn 15%', cost: [250, 700] },
  price: { name: 'Thực đơn mới', icon: 'ticket', desc: 'Giá mỗi tô tăng 10%', cost: [300, 700, 1500] },
  fire: { name: 'Bếp to lửa', icon: 'spice', desc: 'Mì chín nhanh hơn 20%', cost: [500] },
}

// ---- Mùa và đồ trang trí ----
export type SeasonId = 'tet' | 'val' | 'summer' | 'rain' | 'hal' | 'mid' | 'xmas' | 'winter'
export type DecorDef = { id: string; name: string; gems: number; wide?: boolean }
export type SeasonDef = { id: SeasonId; name: string; note: string; badge: string; tint: string; decor: DecorDef[] }
const d = (season: string, list: [string, string, number, boolean?][]): DecorDef[] => list.map(([k, name, gems, wide]) => ({ id: `${season}-${k}`, name, gems, wide }))
export const SEASONS: Record<SeasonId, SeasonDef> = {
  tet: {
    id: 'tet', name: 'Tết Nguyên đán', note: 'Khách đi chơi Tết ghé ăn mì lấy may.', badge: 'Huy hiệu Mì cay đón Tết', tint: '#fde3df',
    decor: d('tet', [['lixi', 'Bao lì xì', 6], ['thoivang', 'Thỏi vàng', 8], ['canhdao', 'Cành đào', 10], ['denlong', 'Đèn lồng đỏ', 8], ['daulan', 'Đầu lân', 14], ['dayphao', 'Dây pháo', 10], ['nutthat', 'Nút thắt may mắn', 8], ['mamquyt', 'Mâm quýt', 12]]),
  },
  val: {
    id: 'val', name: 'Lễ Tình nhân', note: 'Các cặp đôi rủ nhau đi ăn mì cay.', badge: 'Huy hiệu Mì cay tình yêu', tint: '#fde4ec',
    decor: d('val', [['bongbay', 'Bóng bay trái tim', 6], ['dayno', 'Dây nơ hồng', 8, true], ['vehen', 'Vé hẹn ăn mì', 6], ['moctim', 'Móc khóa tô mì', 8], ['socola', 'Hộp sô-cô-la', 8], ['huyhieutim', 'Huy hiệu mũi tên', 8], ['bohoa', 'Bó hoa hồng', 10], ['banhen', 'Bàn hẹn hò', 16]]),
  },
  summer: {
    id: 'summer', name: 'Mùa hè', note: 'Trời nóng mà vẫn mê mì cay.', badge: 'Huy hiệu Mì cay mùa hè', tint: '#e3f4f7',
    decor: d('summer', [['quat', 'Quạt nan hải cẩu', 8], ['dabao', 'Ly đá bào', 6], ['bongbien', 'Bóng biển', 6], ['mattroi', 'Mặt trời Pochacco', 10], ['voso', 'Vỏ sò ngọc trai', 10], ['bangla', 'Bảng lá', 8], ['dayden', 'Dây đèn mùa hè', 10, true]]),
  },
  rain: {
    id: 'rain', name: 'Mùa mưa', note: 'Mưa lạnh, ai cũng thèm một tô mì nóng.', badge: 'Huy hiệu Mì cay ngày mưa', tint: '#e2ecf6',
    decor: d('rain', [['o', 'Chiếc ô xanh', 6], ['daymua', 'Dây giọt mưa', 8, true], ['vungnuoc', 'Vũng nước', 4], ['sapao', 'Sạp áo mưa', 14], ['bienbao', 'Biển "Sàn trơn"', 6], ['ung', 'Đôi ủng vàng', 8], ['bangmay', 'Bảng mây', 8]]),
  },
  hal: {
    id: 'hal', name: 'Halloween', note: 'Đêm hội hóa trang, mì cay đỏ rực như vạc phù thủy.', badge: 'Huy hiệu Mì cay Halloween', tint: '#efe5f6',
    decor: d('hal', [['bingomi', 'Bí ngô mì cay', 8], ['daydoi', 'Dây dơi tím', 8, true], ['denma', 'Đèn ma nhỏ', 6], ['giokeo', 'Giỏ kẹo bí ngô', 8], ['vacmi', 'Vạc mì phù thủy', 12], ['bangtrang', 'Bảng trăng khuyết', 8], ['meobep', 'Mèo đầu bếp', 14], ['mangnhen', 'Mạng nhện góc quầy', 6]]),
  },
  mid: {
    id: 'mid', name: 'Tết Trung thu', note: 'Rước đèn xong, cả nhóm kéo nhau đi ăn mì.', badge: 'Huy hiệu Mì cay Trung thu', tint: '#fff1d6',
    decor: d('mid', [['banhtt', 'Bánh trung thu', 6], ['denlong', 'Đèn lồng thỏ', 8], ['thongoc', 'Thỏ ngọc', 10], ['denongsao', 'Đèn ông sao', 6], ['khungtrang', 'Khung ngắm trăng', 12], ['amtra', 'Ấm trà thưởng trăng', 8], ['maytrang', 'Mây treo trăng', 10], ['mamco', 'Mâm cỗ trông trăng', 14]]),
  },
  xmas: {
    id: 'xmas', name: 'Giáng sinh', note: 'Ông già Noel cũng ghé ăn một tô cay xé lưỡi.', badge: 'Huy hiệu Mì cay Giáng sinh', tint: '#e6f2e3',
    decor: d('xmas', [['caythong', 'Cây thông Noel', 14], ['bangnoel', 'Bảng Noel', 8, true], ['hopqua', 'Hộp quà', 6], ['keogay', 'Kẹo gậy', 6], ['vonghoa', 'Vòng hoa chuông', 10], ['mocmi', 'Móc treo tô mì', 8], ['tatnoel', 'Tất Noel', 6], ['dayden', 'Dây đèn ngôi sao', 10, true]]),
  },
  winter: {
    id: 'winter', name: 'Mùa đông', note: 'Gió bấc về, tô mì cay ấm cả người.', badge: 'Huy hiệu Mì cay mùa đông', tint: '#eaf1f8',
    decor: d('winter', [['bangtuyet', 'Bảng bông tuyết', 8], ['khanlen', 'Khăn len Pochacco', 10, true], ['cacao', 'Ca cao nóng', 6], ['nguoituyet', 'Người tuyết ăn mì', 12], ['cuaso', 'Cửa sổ tuyết', 12], ['gangtay', 'Đôi găng len', 6], ['thamtuyet', 'Thảm tuyết', 6], ['losuoi', 'Lò sưởi', 14]]),
  },
}
export const ALL_DECOR: DecorDef[] = Object.values(SEASONS).flatMap((s) => s.decor)
export const DECOR = Object.fromEntries(ALL_DECOR.map((x) => [x.id, x])) as Record<string, DecorDef>
export const BADGE_GOAL = 30 // số tô bán trong mùa để nhận huy hiệu
export const MAX_SHOWN = 4

const DAY = 86_400_000
const mid = (iso: string) => {
  const [y, m, dd] = iso.split('-').map(Number)
  return new Date(y, m - 1, dd).getTime()
}
/** Mùa đang diễn ra theo lịch thật (lễ ưu tiên hơn mùa thời tiết). */
export function seasonAt(t = Date.now()): { def: SeasonDef; key: string; end: number } {
  const now = new Date(t)
  const y = now.getFullYear()
  const mo = now.getMonth() + 1
  const da = now.getDate()
  const md = mo * 100 + da
  const mk = (id: SeasonId, end: number, key = `${id}-${y}`) => ({ def: SEASONS[id], key, end })
  for (const iso of TET_DAYS) {
    const x = mid(iso)
    if (t >= x - 14 * DAY && t < x + 8 * DAY) return mk('tet', x + 8 * DAY, `tet-${iso.slice(0, 4)}`)
  }
  for (const iso of TRUNGTHU_DAYS) {
    const x = mid(iso)
    if (t >= x - 14 * DAY && t < x + 4 * DAY) return mk('mid', x + 4 * DAY)
  }
  if (md >= 207 && md <= 215) return mk('val', new Date(y, 1, 16).getTime())
  if (md >= 1020 && md <= 1101) return mk('hal', new Date(y, 10, 2).getTime())
  if (md >= 1215 && md <= 1226) return mk('xmas', new Date(y, 11, 27).getTime())
  if (mo === 12 || mo <= 2) return mk('winter', mo === 12 ? new Date(y + 1, 2, 1).getTime() : new Date(y, 2, 1).getTime(), `winter-${mo === 12 ? y : y - 1}`)
  if (mo >= 6 && mo <= 8) return mk('summer', new Date(y, 8, 1).getTime())
  if (mo === 5) return mk('rain', new Date(y, 5, 1).getTime(), `rain-${y}a`)
  if (mo >= 9 && mo <= 11) return mk('rain', new Date(y, 11, 1).getTime())
  return mk('rain', new Date(y, 4, 1).getTime(), `spring-${y}`) // tháng 3, 4: mưa xuân
}

// ---- Dữ liệu lưu ----
export type Shop = {
  v: 1
  coins: number
  gems: number
  day: number
  best: number
  served: number
  perfect: number
  earned: number
  lost: number
  tops: TopId[]
  up: Record<UpgradeId, number>
  decor: string[]
  shown: string[]
  badges: SeasonId[]
  seasonServed: Record<string, number>
  savedAt: number
}
export function newShop(): Shop {
  return {
    v: 1, coins: 0, gems: 0, day: 1, best: 0, served: 0, perfect: 0, earned: 0, lost: 0,
    tops: TOPPINGS.filter((t) => t.unlock === 0).map((t) => t.id),
    up: { stoves: 0, bowls: 0, seats: 0, price: 0, fire: 0 },
    decor: [], shown: [], badges: [], seasonServed: {}, savedAt: Date.now(),
  }
}
export function parseShop(raw: unknown): Shop | null {
  const s = raw as Partial<Shop> | null
  if (!s || s.v !== 1 || typeof s.coins !== 'number') return null
  const base = newShop()
  return {
    ...base, ...s,
    tops: Array.isArray(s.tops) ? s.tops.filter((t) => t in TOP) : base.tops,
    up: { ...base.up, ...(s.up ?? {}) },
    decor: Array.isArray(s.decor) ? s.decor.filter((x) => x in DECOR) : [],
    shown: Array.isArray(s.shown) ? s.shown.filter((x) => x in DECOR).slice(0, MAX_SHOWN) : [],
    badges: Array.isArray(s.badges) ? s.badges : [],
    seasonServed: s.seasonServed ?? {},
    savedAt: typeof s.savedAt === 'number' ? s.savedAt : 0,
  } as Shop
}

// ---- Thông số một ca bán ----
export const SHIFT_SECONDS = 150
export const stovesOf = (s: Shop) => 1 + s.up.stoves
export const bowlsOf = (s: Shop) => 4 + 2 * s.up.bowls
export const seatsOf = (s: Shop) => 3 + s.up.seats
export const cookMsOf = (s: Shop) => Math.round(5200 * (s.up.fire ? 0.8 : 1))
export const patienceMs = (s: Shop) => Math.round(Math.max(30, 52 - s.day * 0.8) * 1000 * (1 + 0.15 * s.up.seats))
export const spawnGap = (day: number) => Math.max(4.5, 10 - day * 0.35) * 1000 * (0.7 + Math.random() * 0.6)
export const maxToppings = (day: number) => Math.min(4, 2 + Math.floor(day / 3))

export type Order = { tops: TopId[]; spice: number; takeaway: boolean }
export function newOrder(s: Shop): Order {
  const n = 1 + Math.floor(Math.random() * Math.min(maxToppings(s.day), s.tops.length))
  const tops = [...s.tops].sort(() => Math.random() - 0.5).slice(0, n)
  const r = Math.random()
  const spice = r < 0.12 ? 0 : r < 0.75 ? 1 + Math.floor(Math.random() * 4) : 5 + Math.floor(Math.random() * 3)
  return { tops, spice, takeaway: Math.random() < 0.22 }
}

/** Giá gốc của một tô theo đơn. */
export const basePrice = (s: Shop, o: Order) => Math.round((20 + o.tops.reduce((a, t) => a + TOP[t].price, 0) + 2 * o.spice) * (1 + 0.1 * s.up.price) * (o.takeaway ? 1.2 : 1))

/** Đánh giá tô mì: topping, độ cay, độ chín. Trả về số sao 0–3 và lời nhận xét. */
export function judge(o: Order, tops: TopId[], spice: number, cooked: number) {
  const want = new Set(o.tops)
  const got = new Set(tops)
  const hit = [...got].filter((t) => want.has(t)).length
  const union = new Set([...want, ...got]).size
  const topScore = union ? hit / union : 1
  const diff = Math.abs(spice - o.spice)
  const spiceScore = diff === 0 ? 1 : diff === 1 ? 0.5 : 0
  const cookScore = cooked >= 0.85 && cooked <= 1.08 ? 1 : cooked >= 0.65 && cooked <= 1.25 ? 0.55 : 0.15
  const total = topScore * 0.4 + spiceScore * 0.25 + cookScore * 0.35
  const stars = total >= 0.92 ? 3 : total >= 0.7 ? 2 : total >= 0.45 ? 1 : 0
  const notes: string[] = []
  if (topScore < 1) notes.push(hit < want.size ? 'thiếu topping' : 'thừa topping')
  if (diff) notes.push(spice > o.spice ? 'cay quá' : 'chưa đủ cay')
  if (cookScore < 1) notes.push(cooked < 0.85 ? 'mì còn sống' : 'mì bị nhũn')
  return { stars, notes }
}

export const shopRank = (served: number) =>
  served >= 1500 ? 'Tiệm mì huyền thoại' : served >= 600 ? 'Tiệm mì nổi tiếng' : served >= 250 ? 'Tiệm mì đông khách' : served >= 80 ? 'Tiệm mì có tiếng' : 'Tiệm mì mới mở'
