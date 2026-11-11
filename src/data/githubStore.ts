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
  })
  if (!dir.ok) throw new Error(`Không đọc được thư mục catalog (HTTP ${dir.status})`)
  const entries = ((await dir.json()) as DirEntry[]).filter(
    (e) => e.type === 'file' && /^books-\d+\.json$/.test(e.name),
  )
  const shards = await Promise.all(
    entries.map(async (e) => {
      const res = await fetch(
        `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${e.path}?ref=${ref}`,
        { headers: headers(cfg, 'application/vnd.github.raw+json') },
      )
      if (!res.ok) throw new Error(`Không đọc được ${e.path} (HTTP ${res.status})`)
      return (await res.json()) as Book[]
    }),
  )
  return shards.flat()
}
