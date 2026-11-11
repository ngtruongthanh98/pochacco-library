import type { Book } from '../types/book'

export type StoreConfig = {
  owner: string
  repo: string
  token: string
  branch?: string
}

const API = 'https://api.github.com'
const SESSION_KEY = 'pochacco-library:session'

/** Phiên đăng nhập: mặc định chỉ sống trong tab (sessionStorage); "ghi nhớ" thì lưu localStorage. */
export const loadConfig = (): StoreConfig | null => {
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = store().getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw) as StoreConfig
    } catch {
      /* bộ nhớ trình duyệt bị chặn */
    }
  }
  return null
}

export const saveConfig = (cfg: StoreConfig, remember = false) => {
  clearConfig()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(cfg))
  } catch {
    /* bộ nhớ trình duyệt bị chặn: phiên chỉ còn trong bộ nhớ tạm */
  }
}

export const clearConfig = () => {
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      store().removeItem(SESSION_KEY)
    } catch {
      /* bỏ qua */
    }
  }
}

const headers = (cfg: StoreConfig, accept = 'application/vnd.github+json') => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
})

type DirEntry = { name: string; path: string; sha: string; type: string }

/** Đọc toàn bộ các tệp catalog/books-*.json trong repo dữ liệu. */
export const fetchCatalog = async (cfg: StoreConfig): Promise<Book[]> => {
  const ref = cfg.branch ?? 'main'
  const dir = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/catalog?ref=${ref}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (!dir.ok) throw new Error(`Không đọc được thư mục catalog (HTTP ${dir.status})`)
  const entries = ((await dir.json()) as DirEntry[]).filter(
    (e) => e.type === 'file' && /^books-\d+\.json$/.test(e.name),
  )
  const shards = await Promise.all(
    entries.map(async (e) => {
      const res = await fetch(
        `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${e.path}?ref=${ref}`,
        { headers: headers(cfg, 'application/vnd.github.raw+json'), cache: 'no-store' },
      )
      if (!res.ok) throw new Error(`Không đọc được ${e.path} (HTTP ${res.status})`)
      return (await res.json()) as Book[]
    }),
  )
  return shards.flat()
}

// ---------- Ghi dữ liệu ----------

export const SHARD_SIZE = 1000

const utf8ToB64 = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const b64ToUtf8 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

const shardName = (n: number) => `books-${String(n).padStart(3, '0')}.json`

type FileRead = { sha: string | null; books: Book[] }

const readShard = async (cfg: StoreConfig, path: string, ref: string): Promise<FileRead> => {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) return { sha: null, books: [] }
  if (!res.ok) throw new Error(`Không đọc được ${path} (HTTP ${res.status})`)
  const j = (await res.json()) as { sha: string; content: string }
  return { sha: j.sha, books: JSON.parse(b64ToUtf8(j.content)) as Book[] }
}

const writeShard = async (
  cfg: StoreConfig,
  path: string,
  ref: string,
  books: Book[],
  sha: string | null,
  message: string,
) =>
  fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      branch: ref,
      content: utf8ToB64(JSON.stringify(books, null, 2) + '\n'),
      ...(sha ? { sha } : {}),
    }),
  })

/**
 * Thêm một bản ghi vào tệp phân mảnh cuối cùng (tạo tệp mới khi đầy).
 * Mỗi lần ghi gửi kèm sha của tệp; nếu tệp vừa bị nơi khác sửa (409/422),
 * đọc lại và thử thêm, tối đa 3 lần, nên không ghi đè thay đổi của thiết bị khác.
 */
export const addBook = async (cfg: StoreConfig, book: Book): Promise<void> => {
  const ref = cfg.branch ?? 'main'
  for (let attempt = 0; attempt < 3; attempt++) {
    const dir = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/catalog?ref=${ref}`, {
      headers: headers(cfg),
      cache: 'no-store',
    })
    const entries = dir.ok
      ? ((await dir.json()) as DirEntry[]).filter((e) => /^books-\d+\.json$/.test(e.name))
      : []
    const last = entries.map((e) => Number(e.name.slice(6, 9))).sort((a, b) => a - b).at(-1) ?? 0
    let path = `catalog/${shardName(last)}`
    let shard = await readShard(cfg, path, ref)
    if (shard.books.some((b) => b.id === book.id)) return // đã ghi ở lần thử trước
    if (shard.books.length >= SHARD_SIZE) {
      path = `catalog/${shardName(last + 1)}`
      shard = await readShard(cfg, path, ref)
    }
    const res = await writeShard(cfg, path, ref, [...shard.books, book], shard.sha, `Thêm sách: ${book.title}`)
    if (res.ok) return
    if (res.status === 409 || res.status === 422) continue
    if (res.status === 403 || res.status === 404)
      throw new Error('Token không có quyền ghi vào repo dữ liệu (cần Contents: Read and write).')
    throw new Error(`Không lưu được (HTTP ${res.status})`)
  }
  throw new Error('Danh mục vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
}
