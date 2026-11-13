// Tra thông tin một người (tác giả, nhân vật lịch sử) trên Wikidata và Wikipedia, ưu tiên tiếng Việt.
// Các API này cho phép gọi thẳng từ trình duyệt (origin=*), không cần khóa.
import { foldVi } from '../search/normalizeVi'

const WD = 'https://www.wikidata.org/w/api.php'
const wp = (lang: string) => `https://${lang}.wikipedia.org`

export type Candidate = { qid: string; label: string; description?: string; human: boolean; wikiTitle?: string }
export type WikiPerson = {
  qid: string
  label: string
  /** Tên gốc (ví dụ Karl Marx) nếu khác tên tiếng Việt */
  otherNames: string[]
  description?: string
  extract?: string
  thumb?: string
  pageUrl?: string
  pageLang?: 'vi' | 'en'
  born?: string
  died?: string
  birthPlace?: string
  deathPlace?: string
  countries: string[]
  occupations: string[]
  human: boolean
}

type Snak = { mainsnak?: { datavalue?: { value: unknown } }; rank?: string }
type Entity = {
  id: string
  labels?: Record<string, { value: string }>
  descriptions?: Record<string, { value: string }>
  aliases?: Record<string, { value: string }[]>
  claims?: Record<string, Snak[]>
  sitelinks?: Record<string, { title: string }>
}

const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as T
}
const qs = (o: Record<string, string | number>) => new URLSearchParams({ format: 'json', origin: '*', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })

const pick = (m: Record<string, { value: string }> | undefined) => m?.vi?.value ?? m?.en?.value

async function entities(ids: string[], props: string): Promise<Entity[]> {
  if (!ids.length) return []
  const j = await getJson<{ entities: Record<string, Entity> }>(`${WD}?${qs({ action: 'wbgetentities', ids: ids.slice(0, 50).join('|'), props, languages: 'vi|en', sitefilter: 'viwiki|enwiki' })}`)
  return ids.map((id) => j.entities[id]).filter((e): e is Entity => !!e && !('missing' in e))
}

const claimIds = (e: Entity, p: string): string[] =>
  (e.claims?.[p] ?? [])
    .filter((c) => c.rank !== 'deprecated')
    .map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x)

const isHuman = (e: Entity) => claimIds(e, 'P31').includes('Q5')

/** Một số tên viết theo lối phiên âm cũ trên sách Việt Nam: thêm tên quốc tế để tìm cho trúng. */
const ALIAS: Record<string, string> = {
  cmac: 'Karl Marx', cacmac: 'Karl Marx', mac: 'Karl Marx', kmac: 'Karl Marx',
  phangghen: 'Friedrich Engels', angghen: 'Friedrich Engels', fangghen: 'Friedrich Engels',
  vilenin: 'Vladimir Lenin', lenin: 'Vladimir Lenin',
  ivxtalin: 'Joseph Stalin', xtalin: 'Joseph Stalin',
  heghen: 'Georg Wilhelm Friedrich Hegel', hegel: 'Georg Wilhelm Friedrich Hegel',
  phoiobac: 'Ludwig Feuerbach', lphoiobac: 'Ludwig Feuerbach',
  canto: 'Immanuel Kant', ican: 'Immanuel Kant',
  plekhanov: 'Georgi Plekhanov', gvplekhanov: 'Georgi Plekhanov',
  evilencov: 'Evald Ilyenkov', ilencov: 'Evald Ilyenkov',
}
const aliasOf = (name: string) => ALIAS[foldVi(name).replace(/[.\s\-]/g, '')]

/** Tìm các ứng viên: kết hợp tìm trên Wikipedia tiếng Việt (bắt được cách viết kiểu "C. Mác") và Wikidata. */
export async function findCandidates(name: string): Promise<Candidate[]> {
  const terms = [...new Set([aliasOf(name), name].filter((x): x is string => !!x))]
  const ids: string[] = []
  const titleOf = new Map<string, string>()
  const push = (id?: string, title?: string) => {
    if (!id) return
    if (!ids.includes(id)) ids.push(id)
    if (title && !titleOf.has(id)) titleOf.set(id, title)
  }
  await Promise.all(
    terms.map(async (t, ti) => {
      const [wpRes, wdRes] = await Promise.allSettled([
        getJson<{ query?: { pages?: Record<string, { index: number; title: string; pageprops?: { wikibase_item?: string } }> } }>(
          `${wp('vi')}/w/api.php?${qs({ action: 'query', generator: 'search', gsrsearch: t, gsrlimit: 5, prop: 'pageprops', ppprop: 'wikibase_item' })}`,
        ),
        getJson<{ search?: { id: string }[] }>(`${WD}?${qs({ action: 'wbsearchentities', search: t, language: ti === 0 && aliasOf(name) ? 'en' : 'vi', uselang: 'vi', type: 'item', limit: 6 })}`),
      ])
      const order: [number, string, string?][] = []
      if (wpRes.status === 'fulfilled')
        for (const p of Object.values(wpRes.value.query?.pages ?? {})) if (p.pageprops?.wikibase_item) order.push([p.index, p.pageprops.wikibase_item, p.title])
      order.sort((a, b) => a[0] - b[0])
      const wdIds = wdRes.status === 'fulfilled' ? (wdRes.value.search ?? []).map((s) => s.id) : []
      // Wikidata khớp nhãn chính xác hơn, Wikipedia khớp cách viết trong bài; xen kẽ hai nguồn.
      for (let i = 0; i < Math.max(order.length, wdIds.length); i++) {
        push(wdIds[i])
        push(order[i]?.[1], order[i]?.[2])
      }
    }),
  )
  const es = await entities(ids.slice(0, 12), 'labels|descriptions|claims|sitelinks')
  const key = foldVi(aliasOf(name) ?? name)
  const cands = es.map((e) => ({
    qid: e.id,
    label: pick(e.labels) ?? e.id,
    description: pick(e.descriptions),
    human: isHuman(e),
    wikiTitle: e.sitelinks?.viwiki?.title ?? titleOf.get(e.id),
    exact: foldVi(pick(e.labels) ?? '') === key || foldVi(e.labels?.en?.value ?? '') === key,
  }))
  // Người thật lên trước; trong số đó ưu tiên trùng tên chính xác, rồi theo thứ tự tìm kiếm.
  return cands
    .map((c, i) => ({ c, s: (c.human ? 0 : 100) + (c.exact ? 0 : 10) + i * 0.1 }))
    .sort((a, b) => a.s - b.s)
    .map(({ c }) => ({ qid: c.qid, label: c.label, description: c.description, human: c.human, wikiTitle: c.wikiTitle }))
}

const fmtTime = (v: unknown): string | undefined => {
  const t = v as { time?: string; precision?: number } | undefined
  if (!t?.time) return
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(t.time)
  if (!m) return
  const bc = m[1] === '-'
  const y = Number(m[2])
  const tail = bc ? ' TCN' : ''
  const p = t.precision ?? 9
  if (p >= 11) return `${m[4]}/${m[3]}/${y}${tail}`
  if (p === 10) return `${m[3]}/${y}${tail}`
  if (p === 9) return `${y}${tail}`
  if (p === 8) return `thập niên ${Math.floor(y / 10) * 10}${tail}`
  return `thế kỷ ${Math.ceil(y / 100)}${tail}`
}
const timeOf = (e: Entity, p: string) => fmtTime(e.claims?.[p]?.find((c) => c.rank !== 'deprecated')?.mainsnak?.datavalue?.value)

const CACHE = 'pochacco-library:wiki:'
const TTL = 30 * 24 * 3600 * 1000

export async function loadPerson(qid: string): Promise<WikiPerson> {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE + qid) ?? 'null') as { at: number; v: WikiPerson } | null
    if (c && Date.now() - c.at < TTL) return c.v
  } catch {
    /* bỏ qua */
  }
  const [e] = await entities([qid], 'labels|descriptions|aliases|claims|sitelinks')
  if (!e) throw new Error('Không tìm thấy mục này trên Wikidata.')
  const refIds = [...new Set([...claimIds(e, 'P19'), ...claimIds(e, 'P20'), ...claimIds(e, 'P27').slice(0, 3), ...claimIds(e, 'P106').slice(0, 5)])]
  const refs = new Map((await entities(refIds, 'labels')).map((x) => [x.id, pick(x.labels) ?? x.id]))
  const lbl = (ids: string[]) => [...new Set(ids.map((i) => refs.get(i)).filter((x): x is string => !!x))]

  const site = e.sitelinks?.viwiki ? { lang: 'vi' as const, title: e.sitelinks.viwiki.title } : e.sitelinks?.enwiki ? { lang: 'en' as const, title: e.sitelinks.enwiki.title } : null
  let extract: string | undefined, thumb: string | undefined, pageUrl: string | undefined
  if (site) {
    try {
      const s = await getJson<{ extract?: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page?: string } } }>(
        `${wp(site.lang)}/api/rest_v1/page/summary/${encodeURIComponent(site.title.replace(/ /g, '_'))}`,
      )
      extract = s.extract
      thumb = s.thumbnail?.source
      pageUrl = s.content_urls?.desktop?.page
    } catch {
      /* vẫn hiện phần Wikidata */
    }
    pageUrl ??= `${wp(site.lang)}/wiki/${encodeURIComponent(site.title.replace(/ /g, '_'))}`
  }
  if (!thumb) {
    const img = (e.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined) ?? undefined
    if (img) thumb = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(img)}?width=320`
  }
  const label = pick(e.labels) ?? qid
  const v: WikiPerson = {
    qid,
    label,
    otherNames: [...new Set([e.labels?.en?.value, ...(e.aliases?.vi ?? []).map((a) => a.value)].filter((x): x is string => !!x && x !== label))].slice(0, 6),
    description: pick(e.descriptions),
    extract,
    thumb,
    pageUrl,
    pageLang: site?.lang,
    born: timeOf(e, 'P569'),
    died: timeOf(e, 'P570'),
    birthPlace: lbl(claimIds(e, 'P19'))[0],
    deathPlace: lbl(claimIds(e, 'P20'))[0],
    countries: lbl(claimIds(e, 'P27').slice(0, 3)),
    occupations: lbl(claimIds(e, 'P106').slice(0, 5)),
    human: isHuman(e),
  }
  try {
    localStorage.setItem(CACHE + qid, JSON.stringify({ at: Date.now(), v }))
  } catch {
    /* bộ nhớ đầy thì thôi */
  }
  return v
}

export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`
