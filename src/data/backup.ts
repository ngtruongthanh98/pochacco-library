// Xuất thư viện ra Excel/CSV, tạo bản sao lưu nén (.zip) và khôi phục từ bản sao lưu.
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { categoryLabel } from './categories'
import { API, headers, SHARD_SIZE, type StoreConfig } from './githubStore'
import { bindingLabel, nameToString, type Book, type Name } from '../types/book'
import type { Excerpt } from '../types/excerpt'

// ---------- Bảng dữ liệu ----------
const TYPE_LABEL: Record<Book['type'], string> = {
  book: 'Sách',
  chapter: 'Chương sách',
  'article-journal': 'Bài tạp chí',
  'paper-conference': 'Bài hội thảo',
  thesis: 'Luận văn',
  webpage: 'Trang web',
  document: 'Tài liệu',
}
const STATUS_LABEL: Record<Book['status'], string> = { owned: 'Đang có', lent: 'Đang cho mượn', wishlist: 'Muốn mua', lost: 'Thất lạc' }
const names = (ns?: Name[]) => (ns ?? []).map(nameToString).join('; ')
const dateOnly = (s?: string) => (s ? s.slice(0, 10) : '')

type Cell = string | number | undefined
export const BOOK_COLUMNS: { head: string; width: number; get: (b: Book) => Cell }[] = [
  { head: 'Mã', width: 12, get: (b) => b.id },
  { head: 'Loại tài liệu', width: 12, get: (b) => TYPE_LABEL[b.type] ?? b.type },
  { head: 'Nhan đề', width: 40, get: (b) => b.title },
  { head: 'Phụ đề', width: 24, get: (b) => b.subtitle },
  { head: 'Nhan đề gốc', width: 24, get: (b) => b.originalTitle },
  { head: 'Tác giả', width: 24, get: (b) => names(b.authors) },
  { head: 'Dịch giả', width: 20, get: (b) => names(b.translators) },
  { head: 'Chủ biên', width: 20, get: (b) => names(b.editors) },
  { head: 'Nhà xuất bản', width: 22, get: (b) => b.publisher },
  { head: 'Đơn vị liên kết', width: 16, get: (b) => b.partner },
  { head: 'Nơi xuất bản', width: 16, get: (b) => b.place },
  { head: 'Năm', width: 7, get: (b) => b.year },
  { head: 'Lần tái bản', width: 8, get: (b) => b.edition },
  { head: 'Số trang', width: 8, get: (b) => b.pages },
  { head: 'Khổ (cm)', width: 9, get: (b) => b.sizeCm },
  { head: 'ISBN', width: 16, get: (b) => b.isbn13 ?? b.isbn10 },
  { head: 'Ngôn ngữ', width: 8, get: (b) => b.language },
  { head: 'Danh mục', width: 26, get: (b) => (b.categories ?? []).map(categoryLabel).join('; ') },
  { head: 'Chủ đề', width: 24, get: (b) => (b.subjects ?? []).join('; ') },
  { head: 'Thẻ', width: 14, get: (b) => (b.tags ?? []).join('; ') },
  { head: 'Tùng thư', width: 18, get: (b) => b.series },
  { head: 'Số trong tùng thư', width: 8, get: (b) => b.seriesNo },
  { head: 'Tạp chí / sách chứa', width: 22, get: (b) => b.containerTitle },
  { head: 'Tập', width: 6, get: (b) => b.volume },
  { head: 'Số', width: 6, get: (b) => b.issue },
  { head: 'Trang', width: 9, get: (b) => b.pageRange },
  { head: 'DOI', width: 18, get: (b) => b.doi },
  { head: 'URL', width: 24, get: (b) => b.url },
  { head: 'Trạng thái', width: 12, get: (b) => STATUS_LABEL[b.status] ?? b.status },
  { head: 'Vị trí kệ', width: 10, get: (b) => [...new Set(b.holdings.flatMap((h) => (h.kind === 'print' && h.location ? [h.location] : [])))].join('; ') },
  { head: 'Số bản giấy', width: 8, get: (b) => b.holdings.reduce((n, h) => n + (h.kind === 'print' ? h.copies ?? 1 : 0), 0) || undefined },
  { head: 'Loại bìa', width: 12, get: (b) => [...new Set(b.holdings.flatMap((h) => (h.kind === 'print' && h.binding ? [bindingLabel(h.binding)!] : [])))].join('; ') },
  { head: 'Sách điện tử', width: 10, get: (b) => b.holdings.flatMap((h) => (h.kind === 'ebook' ? [h.format.toUpperCase()] : [])).join('; ') },
  { head: 'Cho mượn', width: 18, get: (b) => (b.loan ? `${b.loan.to} (${b.loan.date}${b.loan.due ? ` → ${b.loan.due}` : ''})` : undefined) },
  { head: 'Ghi chú', width: 30, get: (b) => b.notes },
  { head: 'Mô tả', width: 40, get: (b) => b.description },
  { head: 'Ngày thêm', width: 11, get: (b) => dateOnly(b.createdAt) },
  { head: 'Ngày sửa', width: 11, get: (b) => dateOnly(b.updatedAt) },
]
const EXCERPT_COLUMNS = (byId: Map<string, Book>): { head: string; width: number; get: (e: Excerpt) => Cell }[] => [
  { head: 'Sách', width: 36, get: (e) => byId.get(e.bookId)?.title ?? e.bookId },
  { head: 'Tác giả', width: 22, get: (e) => names(byId.get(e.bookId)?.authors) },
  { head: 'Trang', width: 8, get: (e) => e.page },
  { head: 'Đoạn trích', width: 80, get: (e) => e.text },
  { head: 'Chủ đề', width: 22, get: (e) => (e.topics ?? []).join('; ') },
  { head: 'Ghi chú', width: 30, get: (e) => e.note },
  { head: 'Ngày thêm', width: 11, get: (e) => dateOnly(e.createdAt) },
]

// ---------- CSV ----------
const csvCell = (v: Cell) => {
  if (v === undefined || v === '') return ''
  const s = String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** CSV có BOM để Excel đọc đúng tiếng Việt. */
export function booksToCsv(books: Book[]): string {
  const rows = [BOOK_COLUMNS.map((c) => c.head), ...books.map((b) => BOOK_COLUMNS.map((c) => c.get(b)))]
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

// ---------- XLSX (tự dựng, không cần thư viện lớn) ----------
const xmlEsc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colName = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
type Sheet = { name: string; widths: number[]; rows: Cell[][] }
function sheetXml(sh: Sheet) {
  const rows = sh.rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${colName(ci)}${ri + 1}`
          const style = ri === 0 ? ' s="1"' : ''
          if (v === undefined || v === '') return ri === 0 ? `<c r="${ref}"${style}/>` : ''
          if (typeof v === 'number') return `<c r="${ref}"${style}><v>${v}</v></c>`
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')
  const last = `${colName(sh.widths.length - 1)}${sh.rows.length}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows}</sheetData>
<autoFilter ref="A1:${last}"/>
</worksheet>`
}
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const files: Zippable = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((s, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEsc(s.name)}'!$A$1:$${colName(s.widths.length - 1)}$${s.rows.length}</definedName>`).join('')}</definedNames></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBF2C27"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
  }
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))))
  return zipSync(files, { level: 6 })
}

export function libraryXlsx(books: Book[], excerpts: Excerpt[]): Uint8Array {
  const byId = new Map(books.map((b) => [b.id, b]))
  const ex = EXCERPT_COLUMNS(byId)
  const sorted = [...books].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
  return buildXlsx([
    { name: 'Sách', widths: BOOK_COLUMNS.map((c) => c.width), rows: [BOOK_COLUMNS.map((c) => c.head), ...sorted.map((b) => BOOK_COLUMNS.map((c) => c.get(b)))] },
    { name: 'Trích dẫn', widths: ex.map((c) => c.width), rows: [ex.map((c) => c.head), ...excerpts.map((e) => ex.map((c) => c.get(e)))] },
  ])
}

// ---------- Tải tệp về máy ----------
export function downloadBytes(data: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([typeof data === 'string' ? data : (data as BlobPart)], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---------- Sao lưu nén ----------
type DirEntry = { name: string; path: string; type: string }
const listDir = async (cfg: StoreConfig, path: string): Promise<DirEntry[]> => {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Không đọc được thư mục ${path} (HTTP ${res.status})`)
  return (await res.json()) as DirEntry[]
}
const readRaw = async (cfg: StoreConfig, path: string): Promise<Uint8Array> => {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, {
    headers: headers(cfg, 'application/vnd.github.raw+json'),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Không đọc được ${path} (HTTP ${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

export type BackupManifest = { app: 'pochacco-library'; kind: 'backup'; createdAt: string; books: number; excerpts: number; covers: number; files: number }

/**
 * Gom toàn bộ dữ liệu của repo (danh mục sách, trích dẫn, cấu hình, schema; tùy chọn kèm ảnh bìa) thành một tệp .zip
 * giữ đúng cấu trúc thư mục của repo, để khôi phục được vào app hoặc tạo lại repo mới.
 */
export async function buildBackup(cfg: StoreConfig, opts: { covers: boolean }, progress?: (msg: string) => void): Promise<{ zip: Uint8Array; manifest: BackupManifest }> {
  const files: Zippable = {}
  let books = 0
  let excerpts = 0
  let covers = 0
  const dirs = ['catalog', 'excerpts', 'config', 'schema', 'vocab', ...(opts.covers ? ['covers'] : [])]
  for (const d of dirs) {
    progress?.(`Đang đọc ${d}…`)
    const stack = [d]
    while (stack.length) {
      const path = stack.pop()!
      for (const e of await listDir(cfg, path)) {
        if (e.type === 'dir') stack.push(e.path)
        else if (e.type === 'file') {
          const data = await readRaw(cfg, e.path)
          files[e.path] = d === 'covers' ? [data, { level: 0 }] : data
          if (d === 'catalog' && e.name.endsWith('.json')) books += (JSON.parse(new TextDecoder().decode(data)) as unknown[]).length
          if (d === 'excerpts' && e.name.endsWith('.json')) excerpts += (JSON.parse(new TextDecoder().decode(data)) as unknown[]).length
          if (d === 'covers') covers++
        }
      }
    }
  }
  const manifest: BackupManifest = { app: 'pochacco-library', kind: 'backup', createdAt: new Date().toISOString(), books, excerpts, covers, files: Object.keys(files).length }
  files['backup-info.json'] = strToU8(JSON.stringify(manifest, null, 2))
  progress?.('Đang nén…')
  return { zip: zipSync(files, { level: 6 }), manifest }
}

/** Đọc một bản sao lưu (.zip của app, .zip tải từ GitHub, hoặc tệp .json danh mục). */
export function readBackup(name: string, bytes: Uint8Array): { books: Book[]; excerpts: Excerpt[]; createdAt?: string } {
  if (/\.json$/i.test(name)) {
    const data = JSON.parse(new TextDecoder().decode(bytes))
    return { books: Array.isArray(data) ? data : data.books ?? [], excerpts: data.excerpts ?? [] }
  }
  const files = unzipSync(bytes)
  const books: Book[] = []
  const excerpts: Excerpt[] = []
  let createdAt: string | undefined
  for (const [path, data] of Object.entries(files)) {
    // Bản zip của GitHub có thêm một thư mục gốc phía trước
    const p = path.replace(/^[^/]+\/(?=(catalog|excerpts)\/)/, '')
    const text = () => new TextDecoder().decode(data)
    if (/^catalog\/books-\d+\.json$/.test(p)) books.push(...(JSON.parse(text()) as Book[]))
    else if (/^excerpts\/excerpts-\d+\.json$/.test(p)) excerpts.push(...(JSON.parse(text()) as Excerpt[]))
    else if (/(^|\/)backup-info\.json$/.test(path)) createdAt = (JSON.parse(text()) as BackupManifest).createdAt
  }
  if (!books.length) throw new Error('Không thấy danh mục sách trong tệp này (cần tệp .zip sao lưu của thư viện).')
  return { books, excerpts, createdAt }
}

/** So sánh bản sao lưu với dữ liệu hiện tại. */
export function diffBackup(current: Book[], backup: Book[], curEx: Excerpt[], bakEx: Excerpt[]) {
  const cur = new Map(current.map((b) => [b.id, b]))
  const missing = backup.filter((b) => !cur.has(b.id))
  const changed = backup.filter((b) => cur.has(b.id) && JSON.stringify(cur.get(b.id)) !== JSON.stringify(b))
  const newer = current.filter((b) => !backup.some((x) => x.id === b.id))
  const exIds = new Set(curEx.map((e) => e.id))
  const missingEx = bakEx.filter((e) => !exIds.has(e.id))
  return { missing, changed, newer, missingEx }
}

export const SHARD = SHARD_SIZE

/** Đọc danh sách các bản sao lưu tự động hằng tuần (GitHub Releases của repo dữ liệu). */
export async function listCloudBackups(cfg: StoreConfig): Promise<{ name: string; date: string; url: string; size: number }[]> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/releases?per_page=20`, { headers: headers(cfg), cache: 'no-store' })
  if (!res.ok) return []
  const rel = (await res.json()) as { tag_name: string; name: string; created_at: string; html_url: string; assets: { size: number }[] }[]
  return rel
    .filter((r) => r.tag_name.startsWith('backup-'))
    .map((r) => ({ name: r.name || r.tag_name, date: r.created_at, url: r.html_url, size: r.assets.reduce((n, a) => n + a.size, 0) }))
}
