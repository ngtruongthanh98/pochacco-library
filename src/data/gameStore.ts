import { API, b64ToUtf8, headers, utf8ToB64, type StoreConfig } from './githubStore'

/**
 * Tiến trình trò chơi lưu ở một repo riêng (mặc định: <tên repo dữ liệu bỏ đuôi -data>-game-data,
 * tức pochacco-library-game-data), trong thư mục saves/<name>.json. Dùng chung chủ sở hữu và token với repo dữ liệu.
 * Tách riêng để các lần game tự lưu không lẫn vào lịch sử và không kích hoạt kiểm tra catalog của repo dữ liệu sách.
 */
export const gameRepoOf = (cfg: StoreConfig) => cfg.gameRepo || `${cfg.repo.replace(/-data$/, '')}-game-data`

const url = (cfg: StoreConfig, name: string) => `${API}/repos/${cfg.owner}/${gameRepoOf(cfg)}/contents/saves/${name}.json`

const noAccess = (cfg: StoreConfig) =>
  `Token chưa có quyền với repo ${gameRepoOf(cfg)}. Thêm repo này vào token (Contents: Read and write); tiến trình vẫn lưu trên máy này.`

/** Đọc tiến trình của một trò chơi. Chưa có tệp thì trả null. */
export async function readGameFile<T>(cfg: StoreConfig, name: string): Promise<{ sha: string; data: T } | null> {
  const res = await fetch(`${url(cfg, name)}?ref=main`, { headers: headers(cfg), cache: 'no-store' })
  if (res.status === 404) {
    // Phân biệt "chưa có tệp" với "token không thấy repo"
    const repo = await fetch(`${API}/repos/${cfg.owner}/${gameRepoOf(cfg)}`, { headers: headers(cfg), cache: 'no-store' })
    if (repo.status === 404 || repo.status === 403) throw new Error(noAccess(cfg))
    return null
  }
  if (res.status === 403) throw new Error(noAccess(cfg))
  if (!res.ok) throw new Error(`Không đọc được saves/${name}.json (HTTP ${res.status})`)
  const j = (await res.json()) as { sha: string; content: string }
  return { sha: j.sha, data: JSON.parse(b64ToUtf8(j.content)) as T }
}

/** Ghi tiến trình của một trò chơi; trả về sha mới. */
export async function writeGameFile(cfg: StoreConfig, name: string, data: unknown, sha: string | null, message: string): Promise<string> {
  const res = await fetch(url(cfg, name), {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, branch: 'main', content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'), ...(sha ? { sha } : {}) }),
  })
  if (res.status === 409 || res.status === 422) throw new Error('Tiến trình vừa được lưu từ nơi khác. Tải lại trang rồi thử lại.')
  if (res.status === 403 || res.status === 404) throw new Error(noAccess(cfg))
  if (!res.ok) throw new Error(`Không lưu được tiến trình (HTTP ${res.status})`)
  return ((await res.json()) as { content: { sha: string } }).content.sha
}
