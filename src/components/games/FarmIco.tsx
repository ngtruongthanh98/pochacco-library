/** Hình vẽ len cho nông trại; món nào chưa có hình thì dùng emoji. */
const ART = new Set(
  [
    // cây trồng
    'lua carot bap cachua bingo duahau dau ot huongduong mia caphe nam sen ladong dauxanh',
    // cây ăn quả và quả
    'xoai cam buoi cay-xoai cay-cam cay-buoi',
    'raumuong khoailang dauphong dautam che thom caloc trungcut suade',
    'chuoi dua vai saurieng cay-chuoi cay-dua cay-vai cay-saurieng cut de tam kentam uom totam',
    'raumuongxao khoainuong trungcutnuong phomaide keodauphong chuoinuong keodua traxanh trasua',
    'nuocthom chevai calocnuong kemsaurieng khanlua aodai',
    // vật nuôi, sản phẩm, cá, ao
    'ga trung bo sua cuu len vit trungvit ong matong ca cachep moi phao',
    // xưởng và món
    'lo xay det botmi botbap duong khanlen aolen gioqua banhchung banhtrungthu com',
    'banhmi banhcarot sotcachua phomai banhbingo nuocep mutdau dauhuongduong goixoai',
    'banhbap nuoccam cafesua canuong cheboi canhchua banhbonglan launam trasen',
    // trang trí, vật dụng, hạng, thời tiết
    'caumai caudoi denlong mamco giomua trau xu tuoi phanbon xe xe2 bac vang w-mua w-nang w-gio w-dep',
    // thành tựu
    'a-first-harvest a-harvest-100 a-harvest-500 a-orders-10 a-orders-50 a-first-egg a-first-bake a-craft-50 a-coins-1000 a-level-5',
    'a-level-10 a-field-5 a-all-crops a-streak-7 a-gold-20 a-first-fruit a-trips-10 a-fish-20 a-loom-first a-decor-3 a-level-15',
  ]
    .join(' ')
    .split(' '),
)
const art = (id: string) => `${import.meta.env.BASE_URL}assets/farm/${id}.webp`

export function Ico({ id, e }: { id: string; e: string }) {
  if (!ART.has(id)) return <>{e}</>
  return <img className="farm-ico" src={art(id)} alt={e} draggable={false} />
}

/** Chân dung khách đặt hàng theo tên. */
const WHO: Record<string, string> = {
  'Cô giáo Lan': 'k-colan',
  'Bác bán sách đầu ngõ': 'k-bacsach',
  'Bạn Mèo Mun': 'k-meomun',
  'Chị Thỏ Bông': 'k-thobong',
  'Ông Gấu nhà bên': 'k-onggau',
  'Thủ thư Pochacco': 'k-pochacco',
  'Bé Vịt Vàng': 'k-vitvang',
  'Quán chè cô Ba': 'k-coba',
}
export function Who({ name }: { name: string }) {
  const id = WHO[name]
  return id ? <img className="farm-ava" src={art(id)} alt="" draggable={false} /> : null
}
