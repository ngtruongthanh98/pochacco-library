// Tách thông tin sách từ đoạn chữ chép ở các trang bán sách / tra cứu Việt Nam:
// bảng "Thông tin chi tiết" của Fahasa, Tiki, Vinabook…; một dòng kết quả tra cứu của Cục Xuất bản (ppdvn.gov.vn);
// hoặc trang thông tin xuất bản in ở cuối sách. Chỉ nhận những gì đọc ra được chắc chắn, không đoán.
import { foldVi } from '../search/normalizeVi'

export type Parsed = {
  title?: string
  authors?: string[]
  translators?: string[]
  editors?: string[]
  publisher?: string
  partner?: string
  place?: string
  year?: string
  pages?: string
  sizeCm?: string
  isbn?: string
  language?: string
  description?: string
}

type Key = keyof Parsed

// Nhãn (đã bỏ dấu, chữ thường) → trường. Thứ tự quan trọng: nhãn dài/cụ thể đặt trước.
const LABELS: [RegExp, Key][] = [
  [/^(ten sach|ten xuat ban pham|ten an pham|ten san pham|nhan de)$/, 'title'],
  [/^(nguoi dich|dich gia|bien dich|dich)$/, 'translators'],
  [/^(chu bien|bien soan|tuyen chon|bien tap noi dung)$/, 'editors'],
  [/^(tac gia|tac gia\/chu bien|tac gia, chu bien|tac gia hoac chu bien|author)$/, 'authors'],
  [/^(nxb|nha xuat ban|nha xb|publisher)$/, 'publisher'],
  [/^(ten nha cung cap|nha cung cap|cong ty phat hanh|doi tac lien ket|don vi lien ket|nha phat hanh)$/, 'partner'],
  [/^(nam xb|nam xuat ban|ngay xuat ban|nam phat hanh|xuat ban nam)$/, 'year'],
  [/^(so trang|so trang sach)$/, 'pages'],
  [/^(kich thuoc bao bi|kich thuoc|kho sach|kho)$/, 'sizeCm'],
  [/^(isbn|ma isbn|ma so isbn|ma hang|ma san pham|sku|barcode)$/, 'isbn'],
  [/^(ngon ngu|language)$/, 'language'],
  [/^(noi xuat ban|noi xb)$/, 'place'],
  [/^(mo ta|mo ta san pham|gioi thieu sach|gioi thieu|noi dung)$/, 'description'],
]

const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()
const fold = (s: string) => foldVi(clean(s)).replace(/[:：]+$/, '').trim()

const labelOf = (s: string): Key | null => {
  const f = fold(s)
  if (!f || f.length > 40) return null
  for (const [re, k] of LABELS) if (re.test(f)) return k
  return null
}

/** "Nhà Xuất Bản Hội Nhà Văn" → "NXB Hội Nhà Văn"; "NXB. Trẻ" → "NXB Trẻ". */
export const normalizePublisher = (s: string) =>
  clean(s)
    .replace(/^nh[àa]\s+xu[ấa]t\s+b[ảa]n\s*/i, 'NXB ')
    .replace(/^nxb\.?\s*/i, 'NXB ')
    .replace(/\s+/g, ' ')
    .trim()

/** Lấy ISBN 10/13 đầu tiên trong chuỗi (bỏ gạch, khoảng trắng). */
export const findIsbn = (s: string) => {
  const m = s.replace(/[‐-―]/g, '-').match(/\b(97[89][\d -]{10,16}\d|\d[\d -]{8,11}[\dXx])\b/)
  if (!m) return undefined
  const d = m[1].replace(/[ -]/g, '')
  if (d.length === 13) return /^97[89]/.test(d) ? d : undefined
  return d.length === 10 ? d.toUpperCase() : undefined
}

/** "20.5 x 14 x 1.5 cm" → "14 x 20.5"; "Khổ 16x24cm" → "16 x 24". Lấy hai cạnh lớn nhất (rộng x cao). */
export const normalizeSize = (s: string) => {
  const nums = [...s.replace(/,/g, '.').matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((n) => n > 3 && n < 60)
  if (nums.length < 2) return undefined
  const two = [...nums].sort((a, b) => b - a).slice(0, 2).sort((a, b) => a - b)
  return two.map((n) => String(n).replace('.', ',')).join(' x ')
}

const yearOf = (s: string) => {
  const m = s.match(/\b(1[5-9]\d\d|20\d\d)\b/)
  return m ? m[1] : undefined
}

const splitPeople = (s: string) =>
  clean(s)
    .split(/\s*(?:,|;|\s-\s|\s&\s|\s+và\s+|\n)\s*/i)
    .map((x) => x.replace(/\((?:dịch|chủ biên|biên soạn|tác giả)\)/gi, '').trim())
    .filter((x) => x && x.length < 80 && !/^(nhiều tác giả|nhiều người dịch|đang cập nhật)$/i.test(x))

const LANG: Record<string, string> = { 'tieng viet': 'vi', 'tieng anh': 'en', 'tieng phap': 'fr', 'tieng trung': 'zh', 'tieng nhat': 'ja', 'tieng han': 'ko', 'tieng duc': 'de', 'tieng nga': 'ru' }

function setField(out: Parsed, k: Key, raw: string) {
  const v = clean(raw)
  if (!v || /^(đang cập nhật|không có|n\/a|-)$/i.test(v)) return
  switch (k) {
    case 'authors':
    case 'translators':
    case 'editors': {
      const ps = splitPeople(v)
      if (ps.length) out[k] = [...(out[k] ?? []), ...ps.filter((p) => !(out[k] ?? []).includes(p))]
      break
    }
    case 'publisher':
      out.publisher ??= normalizePublisher(v)
      break
    case 'year':
      out.year ??= yearOf(v)
      break
    case 'pages': {
      const m = v.match(/\d{1,5}/)
      if (m) out.pages ??= m[0]
      break
    }
    case 'sizeCm':
      out.sizeCm ??= normalizeSize(v)
      break
    case 'isbn':
      out.isbn ??= findIsbn(v)
      break
    case 'language':
      out.language ??= LANG[foldVi(v)] ?? undefined
      break
    case 'description':
      if (v.length > 30) out.description ??= v
      break
    default:
      out[k] ??= v as never
  }
}

/** Một dòng kết quả tra cứu của Cục Xuất bản: ISBN | Tên | Tác giả | Dịch giả | Số lượng | Tự XB | Đối tác | Số XNĐKXB */
function parsePpdvnRow(cells: string[], out: Parsed) {
  const i = cells.findIndex((c) => findIsbn(c))
  if (i < 0 || cells.length - i < 4) return false
  const conf = cells.find((c) => /\/CXBIPH\//i.test(c))
  if (!conf) return false
  out.isbn ??= findIsbn(cells[i])
  if (cells[i + 1]) out.title ??= clean(cells[i + 1])
  if (cells[i + 2]) setField(out, 'authors', cells[i + 2])
  if (cells[i + 3] && !/^\d+$/.test(clean(cells[i + 3]))) setField(out, 'translators', cells[i + 3])
  const partner = cells.slice(i + 4).find((c) => clean(c).length > 3 && !/^\d+$/.test(clean(c)) && !/CXBIPH/i.test(c) && !/^(x|có|không)$/i.test(clean(c)))
  if (partner) out.partner ??= clean(partner)
  // Số xác nhận dạng 4922-2020/CXBIPH/3-148/DHCT: năm đăng ký xuất bản.
  out.year ??= conf.match(/-(\d{4})\//)?.[1]
  return true
}

export function parseBookText(text: string): Parsed {
  const out: Parsed = {}
  const lines = text.replace(/\r/g, '').split('\n')

  // 1) Dòng bảng có tab: "Nhãn<TAB>Giá trị" hoặc cả một hàng kết quả nhiều cột.
  for (const line of lines) {
    const cells = line.split('\t').map(clean).filter(Boolean)
    if (cells.length >= 5 && parsePpdvnRow(cells, out)) continue
    if (cells.length >= 2) {
      const k = labelOf(cells[0])
      if (k) setField(out, k, cells.slice(1).join(' '))
    }
  }

  // 2) "Nhãn: giá trị" trên cùng dòng.
  for (const line of lines) {
    const m = line.match(/^\s*([^:：\t]{2,40})[:：]\s*(.+)$/)
    if (!m) continue
    const k = labelOf(m[1])
    if (k) setField(out, k, m[2])
  }

  // 3) Nhãn một dòng, giá trị ở dòng kế tiếp (chép bảng thường ra kiểu này trên điện thoại).
  for (let i = 0; i < lines.length - 1; i++) {
    const k = labelOf(lines[i])
    if (!k || !clean(lines[i + 1])) continue
    if (labelOf(lines[i + 1])) continue
    if (k === 'description') {
      // Mô tả: gom các dòng tiếp theo cho tới khi gặp nhãn khác.
      const buf: string[] = []
      for (let j = i + 1; j < lines.length && !labelOf(lines[j]); j++) buf.push(lines[j])
      setField(out, 'description', buf.join('\n').replace(/\n{3,}/g, '\n\n'))
    } else setField(out, k, lines[i + 1])
  }

  // 4) Trang thông tin xuất bản in trong sách.
  const all = clean(text.replace(/\n/g, ' \n '))
  out.isbn ??= findIsbn(text.match(/ISBN[^\n]*/i)?.[0] ?? '')
  if (!out.publisher) {
    const m = text.match(/^\s*(NH[ÀA] XU[ẤA]T B[ẢA]N [^\n]{2,60})$/m)
    if (m) out.publisher = normalizePublisher(m[1].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()))
  }
  if (!out.sizeCm) {
    const m = text.match(/kh[ổo]\s*[:.]?\s*(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?)\s*cm/i)
    if (m) out.sizeCm = normalizeSize(m[1])
  }
  if (!out.year) {
    const conf = text.match(/\d{2,6}-(\d{4})\/CXBIPH/i)
    const nop = text.match(/n[ộo]p\s+l[ưu]u\s+chi[ểe]u[^\n]{0,40}?(\d{4})/i)
    out.year = conf?.[1] ?? nop?.[1]
  }
  if (!out.pages) {
    const m = all.match(/(\d{2,5})\s*(?:trang|tr\.)\b/i)
    if (m) out.pages = m[1]
  }
  return out
}

export const FIELD_LABEL: Record<Key, string> = {
  title: 'Nhan đề',
  authors: 'Tác giả',
  translators: 'Dịch giả',
  editors: 'Chủ biên, biên soạn',
  publisher: 'Nhà xuất bản',
  partner: 'Đơn vị liên kết',
  place: 'Nơi xuất bản',
  year: 'Năm',
  pages: 'Số trang',
  sizeCm: 'Khổ (cm)',
  isbn: 'ISBN',
  language: 'Ngôn ngữ',
  description: 'Mô tả',
}
