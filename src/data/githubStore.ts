import type { Book } from '../types/book'

export type StoreConfig = {
  owner: string
  repo: string
  token: string
  branch?: string
}

const API = 'https://api.github.com'
const SETTINGS_KEY = 'pochacco-library:settings'

export const loadConfig = (): StoreConfig | null => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as StoreConfig) : null
  } catch {
    return null
  }
}

export const saveConfig = (cfg: StoreConfig) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg))
  } catch {
    /* trình duyệt chặn bộ nhớ: bỏ qua */
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
