import type { Excerpt } from '../types/excerpt'
import { API, b64ToUtf8, headers, utf8ToB64, type StoreConfig } from './githubStore'

const DIR = 'excerpts'
const SIZE = 2000
const name = (n: number) => `${DIR}/excerpts-${String(n).padStart(3, '0')}.json`

type Shard = { path: string; sha: string | null; items: Excerpt[] }

const listShards = async (cfg: StoreConfig): Promise<string[]> => {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${DIR}?ref=${ref}`, { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Không đọc được thư mục trích dẫn (HTTP ${res.status})`)
  const dir = (await res.json()) as { name: string; path: string; type: string }[]
  return dir.filter((d) => d.type === 'file' && /^excerpts-\d{3}\.json$/.test(d.name)).map((d) => d.path).sort()
}

const readShard = async (cfg: StoreConfig, path: string): Promise<Shard> => {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) return { path, sha: null, items: [] }
  if (!res.ok) throw new Error(`Không đọc được ${path} (HTTP ${res.status})`)
  const j = (await res.json()) as { sha: string; content: string }
  const items = JSON.parse(b64ToUtf8(j.content)) as Excerpt[]
  return { path, sha: j.sha, items: Array.isArray(items) ? items : [] }
}

export const fetchExcerpts = async (cfg: StoreConfig): Promise<Excerpt[]> => {
  const paths = await listShards(cfg)
  const shards = await Promise.all(paths.map((p) => readShard(cfg, p)))
  return shards.flatMap((s) => s.items)
}

/**
 * Thêm / sửa / xóa trích dẫn. Mỗi tệp thay đổi là một commit, gửi kèm sha;
 * nếu tệp vừa bị nơi khác sửa thì đọc lại và thử lại (tối đa 3 lần).
 */
export const saveExcerpts = async (
  cfg: StoreConfig,
  change: { upserts?: Excerpt[]; removeIds?: string[] },
  message: string,
): Promise<void> => {
  const ref = cfg.branch ?? 'main'
  const upserts = change.upserts ?? []
  const remove = new Set(change.removeIds ?? [])
  for (let attempt = 0; attempt < 3; attempt++) {
    const paths = await listShards(cfg)
    if (!paths.length) paths.push(name(0))
    const shards = await Promise.all(paths.map((p) => readShard(cfg, p)))
    const byId = new Map(upserts.map((e) => [e.id, e]))
    const placed = new Set<string>()
    const changed = new Map<string, Excerpt[]>()
    for (const s of shards) {
      let dirty = false
      const items = s.items.flatMap((e) => {
        if (remove.has(e.id)) {
          dirty = true
          return []
        }
        const u = byId.get(e.id)
        if (u) {
          placed.add(e.id)
          dirty = true
          return [u]
        }
        return [e]
      })
      if (dirty) changed.set(s.path, items)
    }
    let pending = upserts.filter((e) => !placed.has(e.id))
    let n = Number(paths.at(-1)!.slice(-8, -5))
    while (pending.length) {
      const path = name(n)
      const base = changed.get(path) ?? shards.find((s) => s.path === path)?.items ?? []
      const room = SIZE - base.length
      if (room <= 0) {
        n++
        continue
      }
      changed.set(path, [...base, ...pending.slice(0, room)])
      pending = pending.slice(room)
    }
    let conflict = false
    for (const [path, items] of changed) {
      const sha = shards.find((s) => s.path === path)?.sha ?? null
      const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
        method: 'PUT',
        headers: { ...headers(cfg), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          branch: ref,
          content: utf8ToB64(JSON.stringify(items, null, 2) + '\n'),
          ...(sha ? { sha } : {}),
        }),
      })
      if (res.ok) continue
      if (res.status === 409 || res.status === 422) {
        conflict = true
        break
      }
      if (res.status === 403 || res.status === 404)
        throw new Error('Token không có quyền ghi vào repo dữ liệu (cần Contents: Read and write).')
      throw new Error(`Không lưu được trích dẫn (HTTP ${res.status})`)
    }
    if (!conflict) return
  }
  throw new Error('Trích dẫn vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
}
