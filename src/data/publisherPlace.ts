// Gợi ý nơi xuất bản theo tên nhà xuất bản: ưu tiên cách anh đã ghi trong thư viện, sau đó tới bảng các NXB phổ biến.
import type { Book } from '../types/book'
import { foldVi } from '../search/normalizeVi'

/** Chuẩn hóa tên NXB để so: bỏ dấu, bỏ chữ "Nxb"/"Nhà xuất bản", gộp TP.HCM. */
export const pubKey = (p: string) =>
  foldVi(p)
    .replace(/\b(nha xuat ban|nxb)\b\.?/g, ' ')
    .replace(/\b(thanh pho ho chi minh|tp\.?\s*ho chi minh|tp\.?\s*hcm|tphcm)\b/g, 'tphcm')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const HN = 'Hà Nội'
const HCM = 'TP. Hồ Chí Minh'
/** Trụ sở chính của các nhà xuất bản hay gặp (theo tên đã chuẩn hóa). */
const KNOWN: Record<string, string> = {
  'chinh tri quoc gia': HN,
  'chinh tri quoc gia su that': HN,
  'su that': HN,
  'chinh tri hanh chinh': HN,
  'ly luan chinh tri': HN,
  'khoa hoc xa hoi': HN,
  'khoa hoc va ky thuat': HN,
  'tu dien bach khoa': HN,
  'giao duc': HN,
  'giao duc viet nam': HN,
  'dai hoc quoc gia ha noi': HN,
  'dai hoc su pham': HN,
  'dai hoc kinh te quoc dan': HN,
  'bach khoa ha noi': HN,
  'the gioi': HN,
  'tri thuc': HN,
  'van hoc': HN,
  'hoi nha van': HN,
  'kim dong': HN,
  'lao dong': HN,
  'thanh nien': HN,
  'phu nu': HN,
  'phu nu viet nam': HN,
  'ton giao': HN,
  'hong duc': HN,
  'dan tri': HN,
  'thong ke': HN,
  'tu phap': HN,
  'tai chinh': HN,
  'cong an nhan dan': HN,
  'quan doi nhan dan': HN,
  'ha noi': HN,
  'van hoa thong tin': HN,
  'van hoa dan toc': HN,
  'my thuat': HN,
  'am nhac': HN,
  'san khau': HN,
  'xay dung': HN,
  'nong nghiep': HN,
  'y hoc': HN,
  'thong tin va truyen thong': HN,
  'cong thuong': HN,
  'dai hoc quoc gia tphcm': HCM,
  'tong hop tphcm': HCM,
  tre: HCM,
  'van hoa van nghe': HCM,
  'van hoa van nghe tphcm': HCM,
  'van hoa sai gon': HCM,
  'van nghe tphcm': HCM,
  'kinh te tphcm': HCM,
  'dai hoc kinh te tphcm': HCM,
  'phuong dong': HCM,
  'da nang': 'Đà Nẵng',
  'thuan hoa': 'Huế',
  'dai hoc hue': 'Huế',
  'dai hoc can tho': 'Cần Thơ',
  'dai hoc thai nguyen': 'Thái Nguyên',
  'nghe an': 'Nghệ An',
  'dong nai': 'Đồng Nai',
}

export type PlaceHint = { place: string; from: 'library' | 'known'; count: number }

/** Bảng gợi ý tính từ cả thư viện: mỗi NXB lấy nơi xuất bản hay dùng nhất. */
export function placeIndex(books: Book[]): Map<string, PlaceHint> {
  const tally = new Map<string, Map<string, number>>()
  for (const b of books) {
    if (!b.publisher || !b.place) continue
    const k = pubKey(b.publisher)
    const m = tally.get(k) ?? new Map<string, number>()
    m.set(b.place, (m.get(b.place) ?? 0) + 1)
    tally.set(k, m)
  }
  const out = new Map<string, PlaceHint>()
  for (const [k, m] of tally) {
    const [place, count] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    out.set(k, { place, from: 'library', count })
  }
  return out
}

/** Gợi ý nơi xuất bản cho một NXB (null nếu không biết). */
export function suggestPlace(publisher: string | undefined, index: Map<string, PlaceHint>): PlaceHint | null {
  if (!publisher?.trim()) return null
  const k = pubKey(publisher)
  const lib = index.get(k)
  if (lib) return lib
  const known = KNOWN[k] ?? KNOWN[k.replace(/ viet nam$/, '')]
  return known ? { place: known, from: 'known', count: 0 } : null
}

/** Tên NXB theo cách ghi trong tài liệu tham khảo tiếng Việt: "Nxb Chính trị quốc gia". */
export const withNxb = (p: string) => (/^(nxb|nhà xuất bản|nha xuat ban)\b/i.test(p.trim()) ? p.trim().replace(/^NXB\b/, 'Nxb') : `Nxb ${p.trim()}`)
