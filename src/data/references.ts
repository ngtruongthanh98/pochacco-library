// Tạo danh mục tài liệu tham khảo theo nhiều kiểu trích dẫn, và kiểm tra thông tin còn thiếu của từng cuốn.
import type { Book, Name } from '../types/book'
import { foldVi } from '../search/normalizeVi'
import { withNxb } from './publisherPlace'

export type StyleId = 'vn' | 'apa' | 'chicago' | 'mla' | 'harvard' | 'bibtex'
export const STYLES: { id: StyleId; label: string; note: string }[] = [
  { id: 'vn', label: 'Kiểu Việt Nam', note: 'Theo quy định trình bày luận văn và nhiều tạp chí trong nước: Tác giả (năm), Tên sách, Nxb, Nơi xuất bản.' },
  { id: 'apa', label: 'APA 7', note: 'Tác giả (Năm). Tên sách. Nhà xuất bản.' },
  { id: 'chicago', label: 'Chicago', note: 'Chicago 17, kiểu ghi chú – thư mục (bibliography).' },
  { id: 'mla', label: 'MLA 9', note: 'Tác giả. Tên sách. Nhà xuất bản, Năm.' },
  { id: 'harvard', label: 'Harvard', note: 'Tác giả (Năm) Tên sách. Nơi xuất bản: Nhà xuất bản.' },
  { id: 'bibtex', label: 'BibTeX', note: 'Dùng cho LaTeX, nhập vào Zotero, Mendeley, EndNote.' },
]

/** Một mục trích dẫn là dãy đoạn chữ; đoạn {i} in nghiêng. */
export type Seg = string | { i: string }
export type Issue = { level: 'error' | 'warn'; field: string; text: string }

// ---------- Tên người ----------
const VN_SURNAMES = new Set(
  'nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly truong dinh lam mai trinh doan luong cao ha quach ta tong to chu chau la thai kieu van dao tieu luu khuc lai giang quang hua ton thich'.split(' '),
)
const hasVnMarks = (s: string) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s)
/** Tên ghi nguyên văn có phải tên người Việt (hoặc pháp danh) không. */
const looksVietnamese = (s: string) => hasVnMarks(s) || VN_SURNAMES.has(foldVi(s.split(/\s+/)[0] ?? ''))
const ORG_WORDS = /\b(bo|ban|vien|hoi|truong|dai hoc|nha xuat ban|nxb|trung tam|uy ban|tong cuc|cuc|so|university|institute|ministry|association|committee|press|office|council|center|centre)\b/
const looksOrg = (s: string) => ORG_WORDS.test(foldVi(s))

const initials = (given?: string) =>
  (given ?? '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ')
const initialsTight = (given?: string) => initials(given).replace(/\s+/g, '')

/** "Họ, T. Đ." cho tên tách họ/tên; tên nguyên văn giữ nguyên. */
const famInit = (n: Name) => ('literal' in n ? n.literal : [n.family, initials(n.given)].filter(Boolean).join(', '))
const famGiven = (n: Name) => ('literal' in n ? n.literal : [n.family, n.given].filter(Boolean).join(', '))
const givenFam = (n: Name) => ('literal' in n ? n.literal : [n.given, n.family].filter(Boolean).join(' '))
const lastName = (n: Name) => ('literal' in n ? n.literal : n.family)

const joinAnd = (xs: string[], and: string, serial = true) =>
  xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} ${and} ${xs[1]}` : `${xs.slice(0, -1).join(', ')}${serial ? ',' : ''} ${and} ${xs[xs.length - 1]}`

const creators = (b: Book) => (b.authors?.length ? { names: b.authors, editors: false } : { names: b.editors ?? [], editors: !!b.editors?.length })

/** Khóa sắp xếp: người Việt xếp theo tên (chữ cuối), người nước ngoài theo họ, tổ chức theo chữ đầu. */
export function sortKey(b: Book, style: StyleId): string {
  const n = creators(b).names[0]
  if (!n) return foldVi(b.title)
  if ('literal' in n) {
    const words = n.literal.trim().split(/\s+/)
    if (style === 'vn' && words.length > 1 && looksVietnamese(n.literal) && !looksOrg(n.literal))
      return foldVi(`${words[words.length - 1]} ${words.slice(0, -1).join(' ')}`)
    return foldVi(n.literal)
  }
  return foldVi(`${n.family} ${n.given ?? ''}`)
}

// ---------- Tiện ích chung ----------
const pagesOf = (r?: string) => r?.trim().replace(/\s*-\s*/g, '–')
const titleFull = (b: Book) => (b.subtitle ? `${b.title}: ${b.subtitle}` : b.title)
const isVi = (b: Book) => !b.language || b.language === 'vi'
const ord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

// ---------- Kiểu Việt Nam ----------
function vnAuthor(n: Name) {
  return 'literal' in n ? n.literal : [n.family, initialsTight(n.given)].filter(Boolean).join(' ')
}
function vn(b: Book): Seg[] {
  const c = creators(b)
  const who = c.names.map(vnAuthor).join(', ')
  const yr = b.year ? String(b.year) : 'không rõ năm'
  const head = who ? `${who}${c.editors ? ' (chủ biên)' : ''} (${yr}), ` : `(${yr}), `
  const tr = b.translators?.length ? `${b.translators.map(givenFam).join(', ')} dịch` : ''
  const ed = b.edition && b.edition > 1 ? `tái bản lần ${b.edition - 1}` : ''
  const vol = b.volume ? `t.${b.volume}` : b.seriesNo !== undefined && b.series ? `t.${b.seriesNo}` : ''
  const pp = b.pageRange ? `tr. ${pagesOf(b.pageRange)}` : ''
  // Sách tiếng Việt ghi "Nxb ..." theo quy định trình bày
  const publisher = b.publisher && isVi(b) && b.type !== 'thesis' ? withNxb(b.publisher) : b.publisher
  const pub = [publisher, b.place].filter(Boolean).join(', ')
  switch (b.type) {
    case 'chapter':
      return [head, `“${titleFull(b)}”, trong: `, ...(b.editors?.length ? [`${b.editors.map(vnAuthor).join(', ')} (chủ biên), `] : []), { i: b.containerTitle ?? '' }, end(`, ${[pub, pp].filter(Boolean).join(', ')}`)]
    case 'article-journal':
      return [head, `“${titleFull(b)}”, `, { i: b.containerTitle ?? '' }, end(`, ${[b.volume ? `tập ${b.volume}` : '', b.issue ? `số ${b.issue}` : '', pp].filter(Boolean).join(', ')}`)]
    case 'paper-conference':
      return [head, `“${titleFull(b)}”, `, { i: b.containerTitle ?? b.eventTitle ?? '' }, end(`, ${[pub, pp].filter(Boolean).join(', ')}`)]
    case 'thesis':
      return [head, { i: titleFull(b) }, end(`, ${[b.genre ?? 'Luận văn', b.publisher, b.place].filter(Boolean).join(', ')}`)]
    case 'webpage':
      return [head, `“${titleFull(b)}”, `, end([b.containerTitle, b.url].filter(Boolean).join(', '))]
    default:
      return [head, { i: titleFull(b) }, end(['', vol, tr, ed, publisher, b.place].filter((x, k) => k === 0 || x).join(', ').replace(/^, /, ', '))]
  }
}

// ---------- APA 7 ----------
function apaNames(ns: Name[]) {
  const xs = ns.map(famInit)
  if (xs.length <= 1) return xs.join('')
  if (xs.length <= 20) return `${xs.slice(0, -1).join(', ')}, & ${xs[xs.length - 1]}`
  return `${xs.slice(0, 19).join(', ')}, . . . ${xs[xs.length - 1]}`
}
function apa(b: Book): Seg[] {
  const c = creators(b)
  const yr = b.year ? String(b.year) : 'n.d.'
  const who = c.names.length ? `${apaNames(c.names)}${c.editors ? (c.names.length > 1 ? ' (Eds.)' : ' (Ed.)') : ''}` : ''
  const head: Seg[] = who ? [`${end(who)} (${yr}). `] : []
  const tail = (title: Seg[]): Seg[] => (who ? [...head, ...title] : [...title, ` (${yr}).`])
  const link = b.doi ? ` https://doi.org/${b.doi.replace(/^https?:\/\/doi\.org\//, '')}` : b.url && b.type === 'webpage' ? ` ${b.url}` : ''
  const extras = [b.edition && b.edition > 1 ? `${ord(b.edition)} ed.` : '', b.volume ? `Vol. ${b.volume}` : '', b.translators?.length ? `${b.translators.map((n) => ('literal' in n ? n.literal : `${initials(n.given)} ${n.family}`.trim())).join(', ')}, Trans.` : '']
    .filter(Boolean)
    .join('; ')
  switch (b.type) {
    case 'chapter':
      return [...tail([`${titleFull(b)}. `]), `In ${b.editors?.length ? `${joinAnd(b.editors.map(givenFam), '&', true)} (${b.editors.length > 1 ? 'Eds.' : 'Ed.'}), ` : ''}`, { i: b.containerTitle ?? '' }, `${b.pageRange ? ` (pp. ${pagesOf(b.pageRange)})` : ''}. ${b.publisher ? end(b.publisher) : ''}${link}`]
    case 'article-journal':
      return [...tail([`${end(titleFull(b))} `]), { i: b.containerTitle ?? '' }, ...(b.volume ? [', ', { i: b.volume }] : []), `${b.issue ? `(${b.issue})` : ''}${b.pageRange ? `, ${pagesOf(b.pageRange)}` : ''}.${link}`]
    case 'paper-conference':
      return [...tail([`${end(titleFull(b))} `]), 'In ', { i: b.containerTitle ?? b.eventTitle ?? '' }, `${b.pageRange ? ` (pp. ${pagesOf(b.pageRange)})` : ''}. ${b.publisher ? end(b.publisher) : ''}${link}`]
    case 'thesis':
      return [...tail([{ i: titleFull(b) }]), ` [${b.genre ?? 'Thesis'}, ${b.publisher ?? ''}].${link}`]
    case 'webpage':
      return [...tail([{ i: titleFull(b) }]), `. ${b.containerTitle ? end(b.containerTitle) : ''}${link}`]
    default:
      return [...tail([{ i: titleFull(b) }]), `${extras ? ` (${extras})` : ''}. ${b.publisher ? end(b.publisher) : ''}${link}`]
  }
}

// ---------- Chicago 17 (thư mục) ----------
function chicagoNames(ns: Name[]) {
  const xs = ns.map((n, k) => (k === 0 ? famGiven(n) : givenFam(n)))
  return ns.length > 10 ? `${xs.slice(0, 7).join(', ')}, et al.` : joinAnd(xs, 'and')
}
function chicago(b: Book): Seg[] {
  const c = creators(b)
  const who = c.names.length ? `${end(`${chicagoNames(c.names)}${c.editors ? `, ${c.names.length > 1 ? 'eds' : 'ed'}` : ''}`)} ` : ''
  const yr = b.year ? String(b.year) : 'n.d.'
  const tr = b.translators?.length ? ` Translated by ${joinAnd(b.translators.map(givenFam), 'and')}.` : ''
  const ed = b.edition && b.edition > 1 ? ` ${ord(b.edition)} ed.` : ''
  const pubLine = `${[b.place, b.publisher].filter(Boolean).join(': ')}${b.place || b.publisher ? ', ' : ''}${yr}.`
  switch (b.type) {
    case 'chapter':
      return [who, `“${end(titleFull(b))}” In `, { i: b.containerTitle ?? '' }, `${b.editors?.length ? `, edited by ${joinAnd(b.editors.map(givenFam), 'and')}` : ''}${b.pageRange ? `, ${pagesOf(b.pageRange)}` : ''}. ${pubLine}`]
    case 'article-journal':
      return [who, `“${end(titleFull(b))}” `, { i: b.containerTitle ?? '' }, `${b.volume ? ` ${b.volume}` : ''}${b.issue ? `, no. ${b.issue}` : ''} (${yr})${b.pageRange ? `: ${pagesOf(b.pageRange)}` : ''}.${b.doi ? ` https://doi.org/${b.doi}.` : ''}`]
    case 'thesis':
      return [who, `“${end(titleFull(b))}” ${[b.genre ?? 'Thesis', b.publisher, yr].filter(Boolean).join(', ')}.`]
    case 'webpage':
      return [who, `“${end(titleFull(b))}” ${b.containerTitle ? end(b.containerTitle) + ' ' : ''}${b.url ?? ''}`]
    default:
      return [who, { i: end(titleFull(b)) }, `${tr}${ed} ${pubLine}`]
  }
}

// ---------- MLA 9 ----------
function mlaNames(ns: Name[]) {
  if (ns.length === 0) return ''
  if (ns.length === 1) return famGiven(ns[0])
  if (ns.length === 2) return `${famGiven(ns[0])}, and ${givenFam(ns[1])}`
  return `${famGiven(ns[0])}, et al.`
}
function mla(b: Book): Seg[] {
  const c = creators(b)
  const who = c.names.length ? `${end(`${mlaNames(c.names)}${c.editors ? `, ${c.names.length > 1 ? 'editors' : 'editor'}` : ''}`)} ` : ''
  const yr = b.year ? String(b.year) : ''
  const tr = b.translators?.length ? ` Translated by ${joinAnd(b.translators.map(givenFam), 'and')},` : ''
  switch (b.type) {
    case 'chapter':
      return [who, `“${end(titleFull(b))}” `, { i: b.containerTitle ?? '' }, `,${b.editors?.length ? ` edited by ${joinAnd(b.editors.map(givenFam), 'and')},` : ''} ${[b.publisher, yr].filter(Boolean).join(', ')}${b.pageRange ? `, pp. ${pagesOf(b.pageRange)}` : ''}.`]
    case 'article-journal':
      return [who, `“${end(titleFull(b))}” `, { i: b.containerTitle ?? '' }, `${b.volume ? `, vol. ${b.volume}` : ''}${b.issue ? `, no. ${b.issue}` : ''}${yr ? `, ${yr}` : ''}${b.pageRange ? `, pp. ${pagesOf(b.pageRange)}` : ''}.`]
    default:
      return [who, { i: end(titleFull(b)) }, `${tr} ${[b.edition && b.edition > 1 ? `${ord(b.edition)} ed.` : '', b.publisher, yr].filter(Boolean).join(', ')}.`]
  }
}

// ---------- Harvard ----------
function harvard(b: Book): Seg[] {
  const c = creators(b)
  const xs = c.names.map((n) => ('literal' in n ? n.literal : `${n.family}, ${initialsTight(n.given)}`))
  const who = xs.length ? `${joinAnd(xs, 'and', false)}${c.editors ? ` (${xs.length > 1 ? 'eds.' : 'ed.'})` : ''} ` : ''
  const yr = `(${b.year ?? 'n.d.'}) `
  const tr = b.translators?.length ? ` Translated by ${joinAnd(b.translators.map(givenFam), 'and')}.` : ''
  const ed = b.edition && b.edition > 1 ? ` ${ord(b.edition)} edn.` : ''
  const pub = [b.place, b.publisher].filter(Boolean).join(': ')
  switch (b.type) {
    case 'chapter':
      return [who, yr, `‘${titleFull(b)}’, in `, { i: b.containerTitle ?? '' }, `. ${pub ? end(pub) : ''}${b.pageRange ? ` pp. ${pagesOf(b.pageRange)}.` : ''}`]
    case 'article-journal':
      return [who, yr, `‘${titleFull(b)}’, `, { i: b.containerTitle ?? '' }, `${b.volume ? `, ${b.volume}` : ''}${b.issue ? `(${b.issue})` : ''}${b.pageRange ? `, pp. ${pagesOf(b.pageRange)}` : ''}.`]
    default:
      return [who, yr, { i: end(titleFull(b)) }, `${tr}${ed} ${pub ? end(pub) : ''}`]
  }
}

// ---------- BibTeX ----------
const ascii = (s: string) => foldVi(s).replace(/[^a-z0-9]/g, '')
export function bibKey(b: Book) {
  const n = creators(b).names[0]
  const who = n ? ascii(lastName(n).split(/\s+/).pop() ?? '') : 'anon'
  const word = foldVi(b.title).split(/\s+/).find((w) => w.length > 3) ?? 'tailieu'
  return `${who}${b.year ?? ''}${ascii(word)}`
}
const bibName = (n: Name) => ('literal' in n ? `{${n.literal}}` : [n.family, n.given].filter(Boolean).join(', '))
function bibtex(b: Book, key: string): string {
  const typ = b.type === 'chapter' ? 'incollection' : b.type === 'article-journal' ? 'article' : b.type === 'paper-conference' ? 'inproceedings' : b.type === 'thesis' ? (/(tiến sĩ|phd|doctor)/i.test(b.genre ?? '') ? 'phdthesis' : 'mastersthesis') : b.type === 'webpage' ? 'misc' : 'book'
  const f: [string, string | number | undefined][] = [
    ['author', b.authors?.length ? b.authors.map(bibName).join(' and ') : undefined],
    ['editor', b.editors?.length ? b.editors.map(bibName).join(' and ') : undefined],
    ['translator', b.translators?.length ? b.translators.map(bibName).join(' and ') : undefined],
    ['title', `{${b.title}}`],
    ['subtitle', b.subtitle],
    [typ === 'article' ? 'journal' : 'booktitle', b.type === 'book' || b.type === 'thesis' || b.type === 'webpage' ? undefined : b.containerTitle],
    ['edition', b.edition],
    ['volume', b.volume],
    ['number', b.issue],
    ['pages', b.pageRange?.replace(/\s*[–-]\s*/g, '--')],
    [typ.endsWith('thesis') ? 'school' : 'publisher', b.publisher],
    ['address', b.place],
    ['year', b.year],
    ['isbn', b.isbn13 ?? b.isbn10],
    ['doi', b.doi],
    ['url', b.url],
    ['language', ({ vi: 'vietnamese', en: 'english', fr: 'french', de: 'german', ru: 'russian', zh: 'chinese', ja: 'japanese' } as Record<string, string>)[b.language ?? ''] ?? b.language],
  ]
  const body = f.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `  ${k} = {${v}}`).join(',\n')
  return `@${typ}{${key},\n${body}\n}`
}

// ---------- Trích dẫn trong bài ----------
export function inText(b: Book, style: StyleId): string {
  const c = creators(b).names
  const ln = c.map((n) => ('literal' in n ? n.literal : n.family))
  const yr = b.year ?? (style === 'vn' ? 'k.n.' : 'n.d.')
  if (style === 'mla') return `(${ln.length > 2 ? `${ln[0]} et al.` : ln.join(' and ') || b.title})`
  if (style === 'vn') return `(${ln.length > 2 ? `${ln[0]} và cs.` : ln.join(' và ') || b.title}, ${yr})`
  const amp = style === 'apa' ? '&' : 'and'
  const who = ln.length > 2 ? `${ln[0]} et al.` : ln.join(` ${amp} `) || b.title
  return style === 'chicago' || style === 'harvard' ? `(${who} ${yr})` : `(${who}, ${yr})`
}

// ---------- Kiểm tra thiếu thông tin ----------
/** Thông tin còn thiếu của một cuốn theo kiểu trích dẫn đã chọn. error: kiểu này bắt buộc; warn: nên bổ sung. */
export function checkBook(b: Book, style: StyleId): Issue[] {
  const out: Issue[] = []
  const need = (ok: unknown, field: string, text: string, level: Issue['level'] = 'error') => !ok && out.push({ level, field, text })
  const c = creators(b)
  need(c.names.length, 'authors', 'tác giả (hoặc chủ biên)', 'warn')
  need(b.year, 'year', 'năm xuất bản')
  const placeNeeded = style === 'vn' || style === 'chicago' || style === 'harvard'
  switch (b.type) {
    case 'chapter':
      need(b.containerTitle, 'containerTitle', 'tên sách chứa chương')
      need(b.publisher, 'publisher', 'nhà xuất bản')
      need(b.pageRange, 'pageRange', 'số trang của chương', 'warn')
      need(b.editors?.length, 'editors', 'chủ biên của sách', 'warn')
      if (placeNeeded) need(b.place, 'place', 'nơi xuất bản', style === 'vn' ? 'error' : 'warn')
      break
    case 'article-journal':
      need(b.containerTitle, 'containerTitle', 'tên tạp chí')
      need(b.volume || b.issue, 'issue', 'tập hoặc số tạp chí', 'warn')
      need(b.pageRange, 'pageRange', 'số trang của bài', 'warn')
      if (style === 'apa') need(b.doi || b.url, 'doi', 'DOI', 'warn')
      break
    case 'paper-conference':
      need(b.containerTitle || b.eventTitle, 'containerTitle', 'tên kỷ yếu hoặc hội thảo')
      need(b.publisher, 'publisher', 'đơn vị xuất bản kỷ yếu', 'warn')
      need(b.pageRange, 'pageRange', 'số trang của bài', 'warn')
      break
    case 'thesis':
      need(b.publisher, 'publisher', 'trường cấp bằng')
      need(b.genre, 'genre', 'loại luận văn (thạc sĩ, tiến sĩ…)', 'warn')
      break
    case 'webpage':
      need(b.url, 'url', 'địa chỉ trang web')
      break
    default:
      need(b.publisher, 'publisher', 'nhà xuất bản')
      if (placeNeeded) need(b.place, 'place', 'nơi xuất bản', style === 'vn' || style === 'harvard' ? 'error' : 'warn')
  }
  if (b.originalTitle && !b.translators?.length && b.language !== 'en') need(false, 'translators', 'người dịch (sách có nhan đề gốc)', 'warn')
  if (style !== 'bibtex') {
    const foreign = [...(b.authors ?? []), ...(b.editors ?? [])].find((n) => 'literal' in n && n.literal.trim().includes(' ') && !looksVietnamese(n.literal) && !looksOrg(n.literal))
    if (foreign && 'literal' in foreign)
      out.push({ level: 'warn', field: 'authors', text: `tên “${foreign.literal}” nên nhập dạng “Họ, Tên” để viết tắt đúng` })
  }
  return out
}

// ---------- Tạo danh mục ----------
export type RefEntry = { book: Book; segs: Seg[]; text: string; html: string; inText: string; issues: Issue[]; vi: boolean }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Dọn khoảng trắng và dấu câu lặp sinh ra khi thiếu trường. */
const tidy = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').replace(/,\s*,/g, ',').replace(/\.(<\/i>)?\s*\./g, '.$1').replace(/,\s*\./g, '.').trim()
const toText = (segs: Seg[]) => tidy(segs.map((s) => (typeof s === 'string' ? s : s.i)).join(''))
const toHtml = (segs: Seg[]) => tidy(segs.map((s) => (typeof s === 'string' ? esc(s) : s.i ? `<i>${esc(s.i)}</i>` : '')).join(''))

export function buildReferences(books: Book[], style: StyleId): RefEntry[] {
  const fn = style === 'apa' ? apa : style === 'chicago' ? chicago : style === 'mla' ? mla : style === 'harvard' ? harvard : vn
  const sorted = [...books].sort((a, b) => sortKey(a, style).localeCompare(sortKey(b, style), 'vi') || (a.year ?? 0) - (b.year ?? 0))
  // Kiểu Việt Nam: tài liệu tiếng Việt trước, tiếng nước ngoài sau
  if (style === 'vn') sorted.sort((a, b) => Number(!isVi(a)) - Number(!isVi(b)))
  const keys = new Map<string, number>()
  return sorted.map((b) => {
    if (style === 'bibtex') {
      let key = bibKey(b)
      const n = keys.get(key) ?? 0
      keys.set(key, n + 1)
      if (n) key += String.fromCharCode(97 + n)
      const t = bibtex(b, key)
      return { book: b, segs: [t], text: t, html: esc(t), inText: `\\cite{${key}}`, issues: checkBook(b, style), vi: isVi(b) }
    }
    const segs = fn(b)
    return { book: b, segs, text: toText(segs), html: toHtml(segs), inText: inText(b, style), issues: checkBook(b, style), vi: isVi(b) }
  })
}
