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
// '.' ngoài sân (tường), g cỏ, f cỏ hoa (chậm), s cát (rất chậm), w nước (phạt 1 gậy), T chỗ phát bóng, H lỗ,
// p cỏ anh đào, a lá thu (chậm), n tuyết (lún), i băng (trơn), o đường đá (nhanh), b cầu gỗ qua nước,
// > < ^ v suối cạn: không chìm nhưng đẩy bóng theo dòng
export type Surface = 'g' | 'f' | 's' | 'w' | 'p' | 'a' | 'n' | 'i' | 'o' | 'b' | '>' | '<' | '^' | 'v'
export type Rough = 'sand' | 'rough' | 'snow' | null
export const SURFACE: Record<Surface, { name: string; tile: string; decel: number; rough?: Rough; push?: [number, number] }> = {
  g: { name: 'Cỏ', tile: 'green_square', decel: 2.6 },
  f: { name: 'Cỏ hoa', tile: 'flower_grass', decel: 5.2, rough: 'rough' },
  s: { name: 'Cát', tile: 'sand_bunker', decel: 11, rough: 'sand' },
  w: { name: 'Nước', tile: 'water_tile', decel: 0 },
  p: { name: 'Cỏ anh đào', tile: 'spring_tile', decel: 2.8 },
  a: { name: 'Lá thu', tile: 'autumn_tile', decel: 5, rough: 'rough' },
  n: { name: 'Tuyết', tile: 'snow_tile', decel: 8, rough: 'snow' },
  i: { name: 'Băng', tile: 'water_tile', decel: 0.55 },
  o: { name: 'Đường đá', tile: 'stone_tile', decel: 1.9 },
  b: { name: 'Cầu gỗ', tile: 'water_tile', decel: 2.6 },
  '>': { name: 'Suối', tile: 'water_tile', decel: 1.4, push: [1, 0] },
  '<': { name: 'Suối', tile: 'water_tile', decel: 1.4, push: [-1, 0] },
  '^': { name: 'Suối', tile: 'water_tile', decel: 1.4, push: [0, -1] },
  v: { name: 'Suối', tile: 'water_tile', decel: 1.4, push: [0, 1] },
}
const SURF_CHARS = new Set(Object.keys(SURFACE))
export const STREAM_PUSH = 7.5
/** Lợi thế của caddie: nhân độ cản của từng loại mặt sân */
export type Mods = { sand: number; rough: number; snow: number; vmax: number }
export const NO_MODS: Mods = { sand: 1, rough: 1, snow: 1, vmax: 1 }

export type ObstacleKind = 'rock_cluster' | 'flower_bush' | 'rest_bench' | 'sun_umbrella' | 'wood_sign' | 'supplies_crate' | 'windmill' | 'cherry_tree' | 'orange_tree' | 'bamboo' | 'stone_lantern' | 'snow_pine' | 'stone_moai' | 'waterwheel'
export const OBSTACLE: Record<ObstacleKind, { r: number; w: number; name: string }> = {
  rock_cluster: { r: 0.48, w: 1.35, name: 'Đá' },
  flower_bush: { r: 0.46, w: 1.3, name: 'Bụi hoa' },
  rest_bench: { r: 0.42, w: 1.05, name: 'Ghế nghỉ' },
  sun_umbrella: { r: 0.22, w: 1.25, name: 'Dù che nắng' },
  wood_sign: { r: 0.26, w: 1.05, name: 'Biển gỗ' },
  supplies_crate: { r: 0.42, w: 0.95, name: 'Thùng đồ' },
  windmill: { r: 0, w: 2.4, name: 'Cối xay gió' },
  cherry_tree: { r: 0.34, w: 1.35, name: 'Cây anh đào' },
  orange_tree: { r: 0.34, w: 1.35, name: 'Cây cam' },
  bamboo: { r: 0.28, w: 0.95, name: 'Tre' },
  stone_lantern: { r: 0.3, w: 0.95, name: 'Đèn đá' },
  snow_pine: { r: 0.3, w: 1.05, name: 'Thông tuyết' },
  stone_moai: { r: 0.36, w: 1.0, name: 'Tượng đá' },
  waterwheel: { r: 0, w: 1.4, name: 'Guồng nước' },
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
  {
    id: 'w2',
    name: 'Vườn Anh Đào',
    host: 'pink_bunny',
    hostName: 'Thỏ Hồng',
    hello: 'Vườn anh đào nhiều suối lắm! Đi qua cầu gỗ cho khỏi rơi xuống nước nha. Cầu không có lan can đâu đó.',
    holes: [
      H('w2-1', 'Lối hoa anh đào', 2, 'heart_flag', 'Hai cây anh đào chắn lối, đánh lách qua giữa.', [
        '.........', '..ppppp..', '..ppHpp..', '..ppppp..', '..ppppp..', '..ppppp..', '..ppppp..',
        '..ppppp..', '..ppppp..', '..ppppp..', '..ppppp..', '..ppTpp..', '..ppppp..', '.........',
      ], [{ k: 'cherry_tree', x: 3.0, y: 6.5 }, { k: 'cherry_tree', x: 6.0, y: 8.6 }]),
      H('w2-2', 'Cây cầu nhỏ', 3, 'star_flag', 'Suối chắn ngang, cầu nằm chính giữa. Đánh thẳng và đừng lệch.', [
        '.........', '..ppppp..', '..ppHpp..', '..ppppp..', '..ppppp..', '..wwbww..', '..wwbww..',
        '..ppppp..', '..ppppp..', '..ppppp..', '..ppppp..', '..ppTpp..', '..ppppp..', '.........',
      ]),
      H('w2-3', 'Rừng tre', 3, 'blue_flag', 'Các khóm tre đứng so le. Tìm đường chéo trống.', [
        '.........', '.ppppppp.', '.pHppppp.', '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppppppp.',
        '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppppppp.', '.pppppTp.', '.ppppppp.', '.........',
      ], [
        { k: 'bamboo', x: 2.5, y: 5.6 }, { k: 'bamboo', x: 4.5, y: 7.6 }, { k: 'bamboo', x: 6.5, y: 5.6 },
        { k: 'bamboo', x: 3.5, y: 9.6 }, { k: 'bamboo', x: 5.0, y: 3.6 },
      ]),
      H('w2-4', 'Hai cây cầu', 3, 'red_flag', 'Hồ rộng, cầu ở hai mép. Qua cầu trái rồi đánh chéo lên.', [
        '.........', '.ppppppp.', '.ppppHpp.', '.ppppppp.', '.bwwwwwb.', '.bwwwwwb.', '.bwwwwwb.',
        '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppTpppp.', '.ppppppp.', '.........',
      ]),
      H('w2-5', 'Đèn đá', 2, 'yellow_flag', 'Hai ngọn đèn đá canh lỗ, khe giữa vừa một quả bóng.', [
        '.........', '.........', '..ppppp..', '..ppppp..', '..ppHpp..', '..ppppp..', '..ppppp..',
        '..ppppp..', '..ppppp..', '..ppppp..', '..ppTpp..', '..ppppp..', '.........', '.........',
      ], [{ k: 'stone_lantern', x: 3.75, y: 6.0 }, { k: 'stone_lantern', x: 5.25, y: 6.0 }]),
      H('w2-6', 'Ao sen', 3, 'heart_flag', 'Ao giữa sân. Đi vòng bên phải rồi bẻ sang trái.', [
        '.........', '.ppppppp.', '.pHppppp.', '.ppppppp.', '.ppwwwpp.', '.ppwwwpp.', '.ppwwwpp.',
        '.ppwwwpp.', '.ppwwwpp.', '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppppppT.', '.........',
      ], [{ k: 'cherry_tree', x: 6.6, y: 3.4 }]),
      H('w2-7', 'Cầu góc vườn', 3, 'star_flag', 'Rẽ trái rồi qua cầu. Cầu hẹp, đánh nhẹ tay.', [
        '.........', '.ppppp...', '.pHppp...', '.ppppp...', '.wwbww...', '.ppppppp.', '.ppppppp.',
        '.....ppp.', '.....ppp.', '.....ppp.', '.....ppp.', '.....pTp.', '.....ppp.', '.........',
      ], [{ k: 'stone_lantern', x: 1.6, y: 6.2 }]),
      H('w2-8', 'Mê cung tre', 4, 'checkered_flag', 'Đường vòng chữ S. Dội tường để bẻ góc nhanh hơn.', [
        '.........', '.ppppppp.', '.pHp.ppp.', '.ppp.ppp.', '.ppp.ppp.', '.....ppp.', '.ppppppp.',
        '.ppppppp.', '.ppp.....', '.ppp.....', '.ppp.ppp.', '.ppppppp.', '.ppppTpp.', '.........',
      ], [{ k: 'bamboo', x: 4.5, y: 6.9 }]),
      H('w2-9', 'Đảo hoa', 3, 'heart_flag', 'Lỗ nằm trên đảo giữa hồ, chỉ có một cây cầu.', [
        '.........', '.wwwwwww.', '.wpppppw.', '.wppHppw.', '.wpppppw.', '.wwwbwww.', '.ppppppp.',
        '.ppppppp.', '.ppppppp.', '.ppppppp.', '.ppppppp.', '.pppTppp.', '.ppppppp.', '.........',
      ], [{ k: 'cherry_tree', x: 2.3, y: 8.2 }, { k: 'cherry_tree', x: 6.7, y: 8.2 }]),
    ],
  },
  {
    id: 'w3',
    name: 'Rừng Thu',
    host: 'blue_otter_costume',
    hostName: 'Rái Cá Xanh',
    hello: 'Rừng Thu có suối cạn: bóng không chìm nhưng bị dòng nước cuốn đi. Lá rụng làm bóng chậm lại đó!',
    holes: [
      H('w3-1', 'Thảm lá vàng', 2, 'yellow_flag', 'Thảm lá làm bóng chậm, đánh mạnh hơn một chút.', [
        '.........', '..ggggg..', '..ggHgg..', '..ggggg..', '..aaaaa..', '..aaaaa..', '..ggggg..',
        '..ggggg..', '..ggggg..', '..ggggg..', '..ggggg..', '..ggTgg..', '..ggggg..', '.........',
      ]),
      H('w3-2', 'Dòng suối', 3, 'blue_flag', 'Suối chảy sang phải sẽ cuốn bóng đi. Ngắm lệch trái bù lại.', [
        '.........', '.ggggggg.', '.gHggggg.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.>>>>>>>.',
        '.>>>>>>>.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.gggggTg.', '.ggggggg.', '.........',
      ], [{ k: 'waterwheel', x: 0.5, y: 7.2 }]),
      H('w3-3', 'Guồng nước', 3, 'star_flag', 'Dòng suối giữa sân chảy về phía lỗ. Thả bóng vào suối là được đưa đi.', [
        '.........', '..ggggg..', '..ggHgg..', '..ggggg..', '..gg^gg..', '..gg^gg..', '..gg^gg..',
        '..gg^gg..', '..aa^aa..', '..aa^aa..', '..ggggg..', '..ggTgg..', '..ggggg..', '.........',
      ], [{ k: 'waterwheel', x: 7.4, y: 8.5 }]),
      H('w3-4', 'Đống thùng', 3, 'red_flag', 'Thùng đồ khắp nơi. Nhìn kỹ khe hở.', [
        '.........', '.ggggggg.', '.ggggHgg.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.ggggggg.',
        '.ggggggg.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.gTggggg.', '.ggggggg.', '.........',
      ], [
        { k: 'supplies_crate', x: 2.5, y: 7.5 }, { k: 'supplies_crate', x: 4.5, y: 6.5 }, { k: 'supplies_crate', x: 6.5, y: 7.5 },
        { k: 'supplies_crate', x: 3.5, y: 4.5 }, { k: 'supplies_crate', x: 5.5, y: 9.5 },
      ]),
      H('w3-5', 'Suối chắn lỗ', 3, 'checkered_flag', 'Suối ngay trước lỗ cuốn bóng sang trái. Bù hướng sang phải.', [
        '.........', '.ggggggg.', '.gggHggg.', '.ggggggg.', '.<<<<<<<.', '.ggggggg.', '.ggggggg.',
        '.aaaaaaa.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.gggTggg.', '.ggggggg.', '.........',
      ], [{ k: 'waterwheel', x: 8.4, y: 4.6 }]),
      H('w3-6', 'Vườn cam', 3, 'yellow_flag', 'Cây cam và lá rụng khắp vườn.', [
        '.........', '.ggggggg.', '.gggggHg.', '.ggggggg.', '.gaggaag.', '.ggggggg.', '.ggggggg.',
        '.gaggaag.', '.ggggggg.', '.ggggggg.', '.ggggggg.', '.gTggggg.', '.ggggggg.', '.........',
      ], [
        { k: 'orange_tree', x: 3.0, y: 5.6 }, { k: 'orange_tree', x: 6.0, y: 5.1 }, { k: 'orange_tree', x: 2.6, y: 8.6 },
        { k: 'orange_tree', x: 5.0, y: 8.1 }, { k: 'orange_tree', x: 4.0, y: 3.1 },
      ]),
      H('w3-7', 'Suối ngược', 4, 'star_flag', 'Hai con suối chảy xuống, đẩy bóng lùi lại. Đánh đủ lực để vượt.', [
        '.........', '.ggg.....', '.gHg.....', '.ggg.....', '.vvv.....', '.ggggggg.', '.ggggggg.',
        '.....vvv.', '.....ggg.', '.....ggg.', '.ggggggg.', '.ggggggg.', '.gTg.....', '.........',
      ]),
      H('w3-8', 'Ba ngả', 3, 'red_flag', 'Ba lối hẹp, lối giữa bị biển gỗ chắn ở đầu.', [
        '.........', '..ggggg..', '..ggHgg..', '..ggggg..', '..g.g.g..', '..g.g.g..', '..g.g.g..',
        '..ggggg..', '..aaaaa..', '..ggggg..', '..ggggg..', '..ggTgg..', '..ggggg..', '.........',
      ], [{ k: 'wood_sign', x: 4.5, y: 7.75 }]),
      H('w3-9', 'Ngã ba suối', 3, 'checkered_flag', 'Hai dòng suối gặp nhau rồi chảy lên lỗ. Coi chừng ao nước phía dưới.', [
        '.........', '..ggggg..', '..ggHgg..', '..ggggg..', '..>>^<<..', '..>>^<<..', '..ggggg..',
        '..gwwwg..', '..gwwwg..', '..ggggg..', '..ggggg..', '..ggTgg..', '..ggggg..', '.........',
      ], [{ k: 'waterwheel', x: 1.4, y: 5.2 }, { k: 'orange_tree', x: 7.6, y: 9.0 }]),
    ],
  },
  {
    id: 'w4',
    name: 'Đảo Tuyết',
    host: 'dark_sheep',
    hostName: 'Cừu Đen',
    hello: 'Lạnh quá đi! Tuyết làm bóng lún, còn băng thì trơn tuột. Đường đá lăn nhanh lắm, nhẹ tay thôi.',
    holes: [
      H('w4-1', 'Đường đá', 2, 'blue_flag', 'Đi theo đường đá giữa, tuyết hai bên làm bóng lún.', [
        '.........', '..nnnnn..', '..nnHnn..', '..nnonn..', '..nnonn..', '..nnonn..', '..nnonn..',
        '..nnonn..', '..nnonn..', '..nnonn..', '..nnonn..', '..nnTnn..', '..nnnnn..', '.........',
      ]),
      H('w4-2', 'Sân băng', 2, 'star_flag', 'Băng trơn, bóng trượt rất xa. Đánh thật nhẹ.', [
        '.........', '.nnnnnnn.', '.nnnHnnn.', '.nnnnnnn.', '.iiiiiii.', '.iiiiiii.', '.iiiiiii.',
        '.iiiiiii.', '.iiiiiii.', '.nnnnnnn.', '.nnnnnnn.', '.nnnTnnn.', '.nnnnnnn.', '.........',
      ]),
      H('w4-3', 'Rừng thông', 3, 'red_flag', 'Đường đá ngoằn ngoèo giữa rừng thông. Đi trên đá cho nhanh.', [
        '.........', '.nnnnnnn.', '.nHnnnnn.', '.nonnnnn.', '.nooooon.', '.nnnnnon.', '.nnnnnon.',
        '.nooooon.', '.nonnnnn.', '.nonnnnn.', '.nooooon.', '.nnnnnon.', '.nnnnnTn.', '.........',
      ], [{ k: 'snow_pine', x: 3.5, y: 5.6 }, { k: 'snow_pine', x: 4.5, y: 8.6 }, { k: 'snow_pine', x: 3.5, y: 11.4 }]),
      H('w4-4', 'Hồ đóng băng', 3, 'heart_flag', 'Mặt hồ có mấy lỗ băng thủng. Rơi vào là bị phạt.', [
        '.........', '.iiiiiii.', '.iiiiHii.', '.iiwiiii.', '.iiiiiwi.', '.iwiiiii.', '.iiiiwii.',
        '.iiiiiii.', '.iiwiiii.', '.iiiiiwi.', '.iiiiiii.', '.iTiiiii.', '.iiiiiii.', '.........',
      ]),
      H('w4-5', 'Tượng đá', 3, 'yellow_flag', 'Ba tượng đá canh sân, dải tuyết ngang giữa làm bóng lún.', [
        '.........', '.ooooooo.', '.oooHooo.', '.ooooooo.', '.ooooooo.', '.nnnnnnn.', '.nnnnnnn.',
        '.ooooooo.', '.ooooooo.', '.ooooooo.', '.ooooooo.', '.oooTooo.', '.ooooooo.', '.........',
      ], [{ k: 'stone_moai', x: 3.5, y: 3.7 }, { k: 'stone_moai', x: 5.5, y: 3.7 }, { k: 'stone_moai', x: 4.5, y: 8.6 }]),
      H('w4-6', 'Dốc tuyết', 3, 'blue_flag', 'Hai mảng băng giữa đồi tuyết. Băng giúp bóng đi xa.', [
        '.........', '..nnnnn..', '..nnHnn..', '..nnnnn..', '..niiin..', '..niiin..', '..nnnnn..',
        '..nnnnn..', '..niiin..', '..niiin..', '..nnnnn..', '..nnTnn..', '..nnnnn..', '.........',
      ]),
      H('w4-7', 'Cầu băng', 3, 'star_flag', 'Kênh nước chắn ngang, cầu ở bên phải.', [
        '.........', '.iiiiiii.', '.iHiiiii.', '.iiiiiii.', '.wwwwbww.', '.wwwwbww.', '.iiiiiii.',
        '.iiiiiii.', '.nnnnnnn.', '.nnnnnnn.', '.ooooooo.', '.oooooTo.', '.ooooooo.', '.........',
      ], [{ k: 'snow_pine', x: 2.0, y: 9.0 }]),
      H('w4-8', 'Mê cung tuyết', 4, 'checkered_flag', 'Mê cung nhiều loại mặt sân. Đi trái rồi sang phải.', [
        '.........', '.ooooooo.', '.oHo.ooo.', '.oon.noo.', '.nnn.nnn.', '.....iii.', '.iiiiiii.',
        '.iiiiiii.', '.iii.....', '.nnn.nnn.', '.nnn.nnn.', '.ooooooo.', '.oooTooo.', '.........',
      ]),
      H('w4-9', 'Đỉnh tuyết', 3, 'checkered_flag', 'Lỗ cuối cùng: băng, hố nước và hai tượng đá. Bình tĩnh nhé!', [
        '.........', '..ooooo..', '..ooHoo..', '..ooooo..', '..iiiii..', '..iwiwi..', '..iiiii..',
        '..wiiiw..', '..iiiii..', '..nnnnn..', '..nnnnn..', '..nnTnn..', '..nnnnn..', '.........',
      ], [{ k: 'stone_moai', x: 3.0, y: 3.5 }, { k: 'stone_moai', x: 6.0, y: 3.5 }]),
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
      return SURF_CHARS.has(ch) ? (ch as Surface) : null
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
export function step(c: Course, b: Ball, dt: number, t: number, mods: Mods = NO_MODS): StepEvent {
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
  // Ma sát, có tính lợi thế caddie
  const sd = SURFACE[surf]
  const mul = sd.rough === 'sand' ? mods.sand : sd.rough === 'rough' ? mods.rough : sd.rough === 'snow' ? mods.snow : 1
  const dec = sd.decel * mul + 0.35 * sp
  // Suối cạn đẩy bóng theo dòng
  if (sd.push) {
    b.vx += sd.push[0] * STREAM_PUSH * dt
    b.vy += sd.push[1] * STREAM_PUSH * dt
  }
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
  // Bóng tựa vào bờ suối thì cho dừng hẳn, khỏi rung mãi
  if (s2 && SURFACE[s2].push && ev === 'wall' && sp2 < 1.6) {
    b.vx = 0
    b.vy = 0
    return ev
  }
  if (s2 && s2 !== surf && (SURFACE[s2].rough === 'sand' || SURFACE[s2].rough === 'snow')) ev = 'sand'
  if (sp2 < 0.06 && !SURFACE[s2 ?? 'g'].push) {
    b.vx = 0
    b.vy = 0
  }
  return ev
}
export const moving = (b: Ball) => b.vx !== 0 || b.vy !== 0

/** Mô phỏng nhanh cả đường bóng (dùng cho gợi ý đường đi). */
export function simulate(c: Course, start: Ball, t0: number, maxT = 8, mods: Mods = NO_MODS): { pts: { x: number; y: number }[]; end: 'sink' | 'water' | 'stop' } {
  const b = { ...start }
  const pts = [{ x: b.x, y: b.y }]
  const dt = 1 / 120
  for (let t = 0; t < maxT; t += dt) {
    const ev = step(c, b, dt, t0 + t, mods)
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
  /** Đồ đã mua (bóng, gậy, cọc tee, túi) */
  owned: string[]
  equip: { ball: string; club: string; tee: string; bag: string }
  /** Bạn bè đã thắng giải: có thể làm caddie */
  caddies: string[]
  caddie: string | null
  daily: { date: string; tasks: { id: string; prog: number; done: boolean }[]; bonus: boolean; gift: string; streak: number }
  tour: TourState | null
  tourWins: Record<string, number>
  savedAt: number
}
export type TourState = { world: string; idx: number; hearts: number; mine: number[]; rivals: { id: string; scores: number[] }[] }
export const DEFAULT_EQUIP = { ball: 'plain_ball', club: 'iron_club', tee: 'mint_tee', bag: 'mint_golf_bag' }
export const newGolf = (): GolfSave => ({
  v: 1, coins: 0, gems: 0, xp: 0, best: {}, stars: {}, holeInOnes: 0, played: 0, ball: 'plain_ball',
  owned: Object.values(DEFAULT_EQUIP), equip: { ...DEFAULT_EQUIP }, caddies: [], caddie: null,
  daily: { date: '', tasks: [], bonus: false, gift: '', streak: 0 }, tour: null, tourWins: {}, savedAt: 0,
})
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
    owned: Array.isArray(s.owned) ? [...new Set([...Object.values(DEFAULT_EQUIP), ...s.owned])] : Object.values(DEFAULT_EQUIP),
    equip: { ...DEFAULT_EQUIP, ...(s.equip && typeof s.equip === 'object' ? s.equip : {}) },
    caddies: Array.isArray(s.caddies) ? s.caddies : [],
    caddie: typeof s.caddie === 'string' ? s.caddie : null,
    daily: s.daily && typeof s.daily === 'object' && Array.isArray(s.daily.tasks) ? s.daily : { date: '', tasks: [], bonus: false, gift: '', streak: 0 },
    tour: s.tour && typeof s.tour === 'object' && Array.isArray(s.tour.mine) ? s.tour : null,
    tourWins: s.tourWins && typeof s.tourWins === 'object' ? s.tourWins : {},
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
export const worldOpen = (s: GolfSave, wi: number) => wi === 0 || WORLDS[wi - 1].holes.every((h) => s.best[h.id])
export const unlocked = (s: GolfSave, w: World, i: number) => worldOpen(s, WORLDS.indexOf(w)) && (i === 0 || !!s.best[w.holes[i - 1].id])
