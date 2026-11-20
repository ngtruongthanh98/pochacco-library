// Đọc danh sách sách điện tử người dùng nhập (theo dòng có dấu |, bảng dán từ Excel, hoặc JSON).

import type { EbookHolding } from '../types/book'
import { formatFromName, parseDriveLink, titleFromFileName, type DriveRef } from './drive'

/** Một tài liệu người dùng khai báo, trước khi ghép với thư viện. */
export type EbookDraft = {
  title: string
  link: string
  authors: string // mỗi người một dòng (theo quy ước của parseNames)
  translators: string
  publisher: string
  place: string
  year: string
  pages: string
  format?: EbookHolding['format']
}

export type ParsedDraft = { draft: EbookDraft; ref: DriveRef | null; errors: string[]; source: string }

export const emptyDraft = (): EbookDraft => ({ title: '', link: '', authors: '', translators: '', publisher: '', place: '', year: '', pages: '' })

/** Thứ tự cột khi nhập theo dòng (không tính cột link, link đặt ở cột nào cũng được). */
export const LINE_FIELDS = ['title', 'authors', 'publisher', 'year'] as const

const URL_RE = /https?:\/\/\S+/
const YEAR_RE = /^(1[5-9]\d\d|20\d\d)$/

/** Nhiều người trong một ô: ngăn bằng dấu chấm phẩy. */
const splitPeople = (s: string) =>
  s
    .split(/;|\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n')

const findRef = (s: string): DriveRef | null => {
  const url = s.match(URL_RE)?.[0]
  if (url) return parseDriveLink(url)
  return s.split(/\s+/).map(parseDriveLink).find(Boolean) ?? null
}

/** Kiểm tra một bản khai và trả về lỗi để hiển thị. */
export const checkDraft = (draft: EbookDraft, source = ''): ParsedDraft => {
  const errors: string[] = []
  const ref = draft.link.trim() ? findRef(draft.link) : null
  if (!draft.link.trim()) errors.push('Thiếu link Google Drive')
  else if (!ref) errors.push('Link không phải của Google Drive')
  else if (ref.kind === 'folder') errors.push('Đây là link thư mục, cần link của từng tệp')
  if (!draft.title.trim()) errors.push('Thiếu tên tài liệu')
  if (draft.year && !YEAR_RE.test(draft.year.trim())) errors.push('Năm không hợp lệ')
  return { draft, ref, errors, source }
}

/**
 * Mỗi dòng một tài liệu: Tên tài liệu | Tác giả | Link Drive | Nhà xuất bản | Năm.
 * Link đặt ở cột nào cũng được; các cột còn lại đọc theo thứ tự. Dán từ Excel (ngăn bằng Tab) cũng được.
 * Dòng cũ kiểu "link  Ten_tep.pdf" vẫn đọc được: phần chữ cạnh link được lấy làm tên.
 */
export const parseLines = (text: string): ParsedDraft[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : null
      const cells = (sep ? line.split(sep) : [line]).map((c) => c.trim())
      const linkAt = cells.findIndex((c) => findRef(c) || URL_RE.test(c))
      const draft = emptyDraft()
      let rest = cells
      if (linkAt >= 0) {
        const cell = cells[linkAt]
        const url = cell.match(URL_RE)?.[0] ?? cell.split(/\s+/).find((w) => parseDriveLink(w)) ?? cell
        draft.link = url
        const beside = cell.replace(url, ' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim()
        rest = cells.filter((_, i) => i !== linkAt)
        if (beside) rest = rest.length && rest[0] ? rest : [beside, ...rest.slice(1)]
      }
      // Ô năm có thể đứng ở bất cứ đâu sau tên.
      const yearAt = rest.findIndex((c, i) => i > 0 && YEAR_RE.test(c))
      if (yearAt > 0) {
        draft.year = rest[yearAt]
        rest = rest.filter((_, i) => i !== yearAt)
      }
      const [title = '', authors = '', publisher = ''] = rest
      draft.title = /\.(pdf|epub|djvu|mobi|azw3?|prc|fb2|cbz|docx?)$/i.test(title) ? titleFromFileName(title) : title
      draft.authors = splitPeople(authors)
      draft.publisher = publisher
      draft.format = formatFromName(line) ?? undefined
      return checkDraft(draft, line)
    })

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = o[k]
    if (v == null || v === '') continue
    if (Array.isArray(v)) return v.map(String).join('\n')
    return String(v).trim()
  }
  return ''
}

const FORMATS: EbookHolding['format'][] = ['pdf', 'epub', 'mobi', 'djvu', 'other']

/** JSON: một mảng đối tượng (hoặc { "books": [...] }). Tên khóa tiếng Anh hoặc tiếng Việt không dấu đều được. */
export const parseJson = (text: string): { items: ParsedDraft[]; error?: string } => {
  if (!text.trim()) return { items: [] }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { items: [], error: `JSON chưa đúng cú pháp: ${(e as Error).message}` }
  }
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { books?: unknown }).books) ? (data as { books: unknown[] }).books : data && typeof data === 'object' ? [data] : null
  if (!list) return { items: [], error: 'JSON cần là một mảng các đối tượng sách' }
  return {
    items: list.map((x, i) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return checkDraft(emptyDraft(), `Phần tử ${i + 1} không phải đối tượng`)
      const o = x as Record<string, unknown>
      const format = pick(o, 'format', 'dinhDang').toLowerCase() as EbookHolding['format']
      const draft: EbookDraft = {
        title: pick(o, 'title', 'ten', 'tenTaiLieu', 'name'),
        link: pick(o, 'link', 'url', 'drive'),
        authors: splitPeople(pick(o, 'authors', 'author', 'tacGia')),
        translators: splitPeople(pick(o, 'translators', 'translator', 'dichGia')),
        publisher: pick(o, 'publisher', 'nxb', 'nhaXuatBan'),
        place: pick(o, 'place', 'noiXuatBan'),
        year: pick(o, 'year', 'nam'),
        pages: pick(o, 'pages', 'soTrang').replace(/\D/g, ''),
        ...(FORMATS.includes(format) ? { format } : {}),
      }
      return checkDraft(draft, `#${i + 1}`)
    }),
  }
}

export const JSON_SAMPLE = `[
  {
    "title": "Phê phán lý tính thuần túy",
    "authors": ["Immanuel Kant"],
    "translators": ["Bùi Văn Nam Sơn"],
    "link": "https://drive.google.com/file/d/.../view",
    "publisher": "Nhà xuất bản Văn học",
    "year": 2004
  },
  {
    "title": "Thắng pháp tập yếu luận",
    "link": "https://drive.google.com/file/d/.../view"
  }
]`

export const LINE_SAMPLE = `Phê phán lý tính thuần túy | Immanuel Kant | https://drive.google.com/file/d/.../view | Nhà xuất bản Văn học | 2004
Thắng pháp tập yếu luận | | https://drive.google.com/file/d/.../view
Tư bản, Quyển 1 | C. Mác | https://drive.google.com/file/d/.../view | Nhà xuất bản Chính trị quốc gia Sự thật`

/** Chuyển bản khai về JSON (để người dùng sửa tiếp ở tab JSON). */
export const draftsToJson = (ds: EbookDraft[]) =>
  JSON.stringify(
    ds.map((d) => ({
      title: d.title,
      ...(d.authors ? { authors: d.authors.split('\n') } : {}),
      ...(d.translators ? { translators: d.translators.split('\n') } : {}),
      link: d.link,
      ...(d.publisher ? { publisher: d.publisher } : {}),
      ...(d.place ? { place: d.place } : {}),
      ...(d.year ? { year: Number(d.year) || d.year } : {}),
      ...(d.pages ? { pages: Number(d.pages) } : {}),
      ...(d.format ? { format: d.format } : {}),
    })),
    null,
    2,
  )
