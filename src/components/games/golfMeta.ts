// Pochacco Golf: cửa hàng, caddie, giải đấu, nhiệm vụ và quà mỗi ngày.
import { NO_MODS, WORLDS, type GolfSave, type Mods, type TourState } from './golf'

// ---------- Bạn bè ----------
export const FRIEND: Record<string, { name: string; perk?: string }> = {
  white_sheep: { name: 'Cừu Trắng', perk: 'Cát bớt cản: bóng trong cát chỉ chậm một nửa.' },
  pink_bunny: { name: 'Thỏ Hồng', perk: 'Cỏ hoa, lá thu không làm bóng chậm nữa.' },
  blue_otter_costume: { name: 'Rái Cá Xanh', perk: 'Lần đầu rơi xuống nước ở mỗi lỗ không bị phạt gậy.' },
  dark_sheep: { name: 'Cừu Đen', perk: 'Tuyết không làm bóng lún, lăn như trên cỏ.' },
  mint_bow: { name: 'Bé Nơ Mint' },
  brown_haired_boy: { name: 'Cậu Bé Tóc Nâu' },
  soccer_ball: { name: 'Anh Bóng Đá' },
}
/** Đối thủ trong giải của từng khu: chủ sân và khách mời; độ giỏi là xác suất đánh dưới/đúng/trên par */
export const TOUR_RIVALS: Record<string, { id: string; skill: [number, number, number] }[]> = {
  w1: [{ id: 'white_sheep', skill: [0.1, 0.5, 0.4] }, { id: 'mint_bow', skill: [0.05, 0.45, 0.5] }],
  w2: [{ id: 'pink_bunny', skill: [0.15, 0.5, 0.35] }, { id: 'brown_haired_boy', skill: [0.1, 0.5, 0.4] }],
  w3: [{ id: 'blue_otter_costume', skill: [0.2, 0.5, 0.3] }, { id: 'soccer_ball', skill: [0.15, 0.45, 0.4] }],
  w4: [
    { id: 'dark_sheep', skill: [0.25, 0.5, 0.25] },
    { id: 'mint_bow', skill: [0.2, 0.5, 0.3] },
    { id: 'brown_haired_boy', skill: [0.2, 0.45, 0.35] },
  ],
}
export const caddieMods = (caddie: string | null): Mods => ({
  ...NO_MODS,
  sand: caddie === 'white_sheep' ? 0.5 : 1,
  rough: caddie === 'pink_bunny' ? 0.5 : 1,
  snow: caddie === 'dark_sheep' ? 0.33 : 1,
})

export function newTour(worldId: string): TourState {
  const w = WORLDS.find((x) => x.id === worldId)!
  return {
    world: worldId,
    idx: 0,
    hearts: 3,
    mine: [],
    rivals: TOUR_RIVALS[worldId].map((r) => ({
      id: r.id,
      scores: w.holes.map((h) => {
        const x = Math.random()
        return h.par + (x < r.skill[0] ? -1 : x < r.skill[0] + r.skill[1] ? 0 : Math.random() < 0.75 ? 1 : 2)
      }),
    })),
  }
}
export const tourTotal = (xs: number[], n = xs.length) => xs.slice(0, n).reduce((a, b) => a + b, 0)
export const TOUR_WIN = { coins: 200, gems: 5 }

// ---------- Cửa hàng ----------
export type ShopKind = 'ball' | 'club' | 'tee' | 'bag'
export type ShopItem = { id: string; kind: ShopKind; name: string; price: number; gem?: boolean; perk?: string; level?: number }
export const SHOP: ShopItem[] = [
  { id: 'plain_ball', kind: 'ball', name: 'Bóng trắng', price: 0 },
  { id: 'star_ball', kind: 'ball', name: 'Bóng ngôi sao', price: 120 },
  { id: 'heart_ball', kind: 'ball', name: 'Bóng trái tim', price: 120 },
  { id: 'paw_ball', kind: 'ball', name: 'Bóng dấu chân', price: 150 },
  { id: 'bow_ball', kind: 'ball', name: 'Bóng nơ xanh', price: 150 },
  { id: 'snowflake_ball', kind: 'ball', name: 'Bóng bông tuyết', price: 200, level: 3 },
  { id: 'lightning_ball', kind: 'ball', name: 'Bóng tia chớp', price: 6, gem: true, perk: 'Đánh mạnh có vệt lửa vàng' },
  { id: 'rainbow_ball', kind: 'ball', name: 'Bóng cầu vồng', price: 10, gem: true, level: 5 },
  { id: 'iron_club', kind: 'club', name: 'Gậy sắt', price: 0, perk: 'Gậy cơ bản' },
  { id: 'wood_club', kind: 'club', name: 'Gậy gỗ', price: 300, perk: 'Lực tối đa mạnh hơn 12%' },
  { id: 'blue_club', kind: 'club', name: 'Gậy xanh', price: 350, level: 3, perk: 'Đường ngắm dài hơn' },
  { id: 'pink_club', kind: 'club', name: 'Gậy hồng', price: 400, level: 4, perk: 'Đường ngắm màu hồng, có bóng mờ ở điểm dừng' },
  { id: 'gold_club', kind: 'club', name: 'Gậy vàng', price: 20, gem: true, level: 6, perk: 'Gợi ý đường bóng từ gậy thứ 2' },
  { id: 'mint_tee', kind: 'tee', name: 'Tee bạc hà', price: 0 },
  { id: 'beige_tee', kind: 'tee', name: 'Tee gỗ', price: 40 },
  { id: 'coral_tee', kind: 'tee', name: 'Tee san hô', price: 60 },
  { id: 'paw_tee', kind: 'tee', name: 'Tee dấu chân', price: 80 },
  { id: 'star_tee', kind: 'tee', name: 'Tee ngôi sao', price: 3, gem: true },
  { id: 'mint_golf_bag', kind: 'bag', name: 'Túi nơ mint', price: 0 },
  { id: 'blue_golf_bag', kind: 'bag', name: 'Túi dấu chân xanh', price: 250 },
  { id: 'pink_golf_bag', kind: 'bag', name: 'Túi trái tim hồng', price: 250 },
  { id: 'sheep_golf_bag', kind: 'bag', name: 'Túi cừu bông', price: 8, gem: true },
]
export const KIND_LABEL: Record<ShopKind, string> = { ball: 'Bóng', club: 'Gậy', tee: 'Cọc tee', bag: 'Túi gậy' }

// ---------- Nhiệm vụ mỗi ngày ----------
export type HoleEvent = { strokes: number; par: number; water: number; stars: number; tour: boolean }
export const TASKS: { id: string; text: string; goal: number; inc: (e: HoleEvent) => number }[] = [
  { id: 'play5', text: 'Chơi 5 lỗ', goal: 5, inc: () => 1 },
  { id: 'birdie', text: 'Ghi 1 birdie (dưới par) trở lên', goal: 1, inc: (e) => (e.strokes < e.par ? 1 : 0) },
  { id: 'dry3', text: 'Qua 3 lỗ không rơi xuống nước', goal: 3, inc: (e) => (e.water === 0 ? 1 : 0) },
  { id: 'star2', text: 'Đạt 3 sao ở 2 lỗ', goal: 2, inc: (e) => (e.stars === 3 ? 1 : 0) },
  { id: 'par4', text: 'Đánh par hoặc tốt hơn ở 4 lỗ', goal: 4, inc: (e) => (e.strokes <= e.par ? 1 : 0) },
  { id: 'tour3', text: 'Đánh 3 lỗ trong giải đấu', goal: 3, inc: (e) => (e.tour ? 1 : 0) },
  { id: 'play8', text: 'Chơi 8 lỗ', goal: 8, inc: () => 1 },
]
export const TASK_REWARD = 30
export const TASK_BONUS_GEMS = 2
export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
/** Ba nhiệm vụ cố định theo ngày */
export function dailyFor(s: GolfSave): GolfSave['daily'] {
  const date = todayKey()
  if (s.daily.date === date && s.daily.tasks.length) return s.daily
  const pool = [...TASKS]
  const picks: string[] = []
  let h = hash(date)
  while (picks.length < 3) {
    const i = h % pool.length
    picks.push(pool[i].id)
    pool.splice(i, 1)
    h = hash(String(h))
  }
  return { ...s.daily, date, tasks: picks.map((id) => ({ id, prog: 0, done: false })), bonus: false }
}
export const GIFT = (streak: number) => (streak % 7 === 0 ? { coins: 50, gems: 5 } : { coins: 20 + Math.min(30, streak * 5), gems: 0 })
