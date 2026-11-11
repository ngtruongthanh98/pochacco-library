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
 * Thêm một hoặc nhiều bản ghi vào tệp phân mảnh cuối (sang tệp mới khi đầy), mỗi tệp một commit.
 * Mỗi lần ghi gửi kèm sha của tệp; nếu tệp vừa bị nơi khác sửa (409/422) thì đọc lại và thử
 * tối đa 3 lần, nên không ghi đè thay đổi của thiết bị khác.
 */
export const addBooks = async (cfg: StoreConfig, newBooks: Book[], message?: string): Promise<void> => {
  const ref = cfg.branch ?? 'main'
  let pending = [...newBooks]
  for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
    const dir = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/catalog?ref=${ref}`, {
      headers: headers(cfg),
      cache: 'no-store',
    })
    const entries = dir.ok
      ? ((await dir.json()) as DirEntry[]).filter((e) => /^books-\d+\.json$/.test(e.name))
      : []
    let n = entries.map((e) => Number(e.name.slice(6, 9))).sort((a, b) => a - b).at(-1) ?? 0
    let conflict = false
    while (pending.length) {
      const path = `catalog/${shardName(n)}`
      const shard = await readShard(cfg, path, ref)
      const have = new Set(shard.books.map((b) => b.id))
      pending = pending.filter((b) => !have.has(b.id)) // đã ghi ở lần thử trước
      const room = SHARD_SIZE - shard.books.length
      if (room <= 0) {
        n++
        continue
      }
      const chunk = pending.slice(0, room)
      if (!chunk.length) break
      const msg = message ?? (chunk.length === 1 ? `Thêm sách: ${chunk[0].title}` : `Thêm ${chunk.length} sách`)
      const res = await writeShard(cfg, path, ref, [...shard.books, ...chunk], shard.sha, msg)
      if (res.ok) {
        pending = pending.slice(chunk.length)
        continue
      }
      if (res.status === 409 || res.status === 422) {
        conflict = true
        break
      }
      if (res.status === 403 || res.status === 404)
        throw new Error('Token không có quyền ghi vào repo dữ liệu (cần Contents: Read and write).')
      throw new Error(`Không lưu được (HTTP ${res.status})`)
    }
    if (!conflict) return
  }
  if (pending.length) throw new Error('Danh mục vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
}

export const addBook = (cfg: StoreConfig, book: Book) => addBooks(cfg, [book])

const listShards = async (cfg: StoreConfig, ref: string) => {
  const dir = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/catalog?ref=${ref}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (!dir.ok) throw new Error(`Không đọc được thư mục catalog (HTTP ${dir.status})`)
  return ((await dir.json()) as DirEntry[])
    .filter((e) => /^books-\d+\.json$/.test(e.name))
    .map((e) => e.path)
    .sort()
}

/**
 * Sửa hoặc xóa một bản ghi theo id: tìm tệp phân mảnh đang chứa nó, đọc kèm sha, ghi lại.
 * `change` trả về bản ghi mới, hoặc null để xóa.
 */
const modifyBook = async (
  cfg: StoreConfig,
  id: string,
  change: (old: Book) => Book | null,
  message: string,
): Promise<void> => {
  const ref = cfg.branch ?? 'main'
  for (let attempt = 0; attempt < 3; attempt++) {
    let found = false
    for (const path of await listShards(cfg, ref)) {
      const shard = await readShard(cfg, path, ref)
      const i = shard.books.findIndex((b) => b.id === id)
      if (i < 0) continue
      found = true
      const next = change(shard.books[i])
      const books = next
        ? shard.books.map((b, k) => (k === i ? next : b))
        : shard.books.filter((_, k) => k !== i)
      const res = await writeShard(cfg, path, ref, books, shard.sha, message)
      if (res.ok) return
      if (res.status === 409 || res.status === 422) break // tệp vừa đổi: đọc lại từ đầu
      if (res.status === 403 || res.status === 404)
        throw new Error('Token không có quyền ghi vào repo dữ liệu (cần Contents: Read and write).')
      throw new Error(`Không lưu được (HTTP ${res.status})`)
    }
    if (!found) throw new Error('Không tìm thấy sách này trong repo dữ liệu (có thể đã bị xóa ở nơi khác).')
  }
  throw new Error('Danh mục vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
}

export const updateBook = (cfg: StoreConfig, book: Book) =>
  modifyBook(cfg, book.id, () => book, `Sửa sách: ${book.title}`)

export const deleteBook = (cfg: StoreConfig, book: Book) =>
  modifyBook(cfg, book.id, () => null, `Xóa sách: ${book.title}`)

// ---------- Ảnh bìa (lưu trong repo dữ liệu riêng tư) ----------

const coverCache = new Map<string, Promise<string>>()

/** Tải ảnh bìa từ repo riêng tư bằng token, trả về object URL (có bộ nhớ đệm trong phiên). */
export const loadCoverUrl = (cfg: StoreConfig, path: string): Promise<string> => {
  const key = `${cfg.owner}/${cfg.repo}/${path}`
  let p = coverCache.get(key)
  if (!p) {
    const ref = cfg.branch ?? 'main'
    p = fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${ref}`, {
      headers: headers(cfg, 'application/vnd.github.raw+json'),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return URL.createObjectURL(await res.blob())
    })
    p.catch(() => coverCache.delete(key))
    coverCache.set(key, p)
  }
  return p
}

const blobToB64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** Ghi (hoặc thay) ảnh bìa vào repo dữ liệu, trả về giá trị cho trường `cover`. */
export const uploadCover = async (cfg: StoreConfig, bookId: string, blob: Blob, title: string) => {
  const ref = cfg.branch ?? 'main'
  const path = `covers/${bookId}.jpg`
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`
  const head = await fetch(`${url}?ref=${ref}`, { headers: headers(cfg), cache: 'no-store' })
  const sha = head.ok ? ((await head.json()) as { sha: string }).sha : undefined
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Ảnh bìa: ${title}`, branch: ref, content: await blobToB64(blob), ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) throw new Error(`Không tải được ảnh bìa lên (HTTP ${res.status})`)
  coverCache.delete(`${cfg.owner}/${cfg.repo}/${path}`)
  return `repo:${path}`
}

/** Thu nhỏ ảnh chụp về cạnh dài 900px, nén JPEG để repo gọn (thường 60-150 KB). */
export const prepareCover = async (file: File): Promise<Blob> => {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không xử lý được ảnh'))), 'image/jpeg', 0.82),
  )
}

/**
 * Ghi gộp: sửa các bản ghi đã có (theo id) và thêm bản ghi mới trong một lượt,
 * mỗi tệp phân mảnh thay đổi là một commit. Gặp xung đột thì đọc lại và thử lại.
 */
export const saveBatch = async (cfg: StoreConfig, adds: Book[], updates: Book[], message: string): Promise<void> => {
  const ref = cfg.branch ?? 'main'
  for (let attempt = 0; attempt < 3; attempt++) {
    const paths = await listShards(cfg, ref)
    if (!paths.length) paths.push(`catalog/${shardName(0)}`)
    const shards = await Promise.all(paths.map(async (p) => ({ path: p, ...(await readShard(cfg, p, ref)) })))
    const byId = new Map(updates.map((b) => [b.id, b]))
    const existing = new Set(shards.flatMap((s) => s.books.map((b) => b.id)))
    const changed = new Map<string, Book[]>()
    for (const s of shards) {
      if (s.books.some((b) => byId.has(b.id))) changed.set(s.path, s.books.map((b) => byId.get(b.id) ?? b))
    }
    let pending = adds.filter((b) => !existing.has(b.id))
    let n = Number(paths.at(-1)!.slice(-8, -5))
    while (pending.length) {
      const path = `catalog/${shardName(n)}`
      const base = changed.get(path) ?? shards.find((s) => s.path === path)?.books ?? []
      const room = SHARD_SIZE - base.length
      if (room <= 0) {
        n++
        continue
      }
      changed.set(path, [...base, ...pending.slice(0, room)])
      pending = pending.slice(room)
    }
    let conflict = false
    for (const [path, books] of changed) {
      const sha = shards.find((s) => s.path === path)?.sha ?? null
      const res = await writeShard(cfg, path, ref, books, sha, message)
      if (res.ok) continue
      if (res.status === 409 || res.status === 422) {
        conflict = true
        break
      }
      if (res.status === 403 || res.status === 404)
        throw new Error('Token không có quyền ghi vào repo dữ liệu (cần Contents: Read and write).')
      throw new Error(`Không lưu được (HTTP ${res.status})`)
    }
    if (!conflict) return
    // Một phần có thể đã ghi; lần thử sau đọc lại nên bản ghi đã có sẽ được bỏ qua hoặc ghi đè đúng.
  }
  throw new Error('Danh mục vừa bị thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
}
