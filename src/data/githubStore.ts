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
