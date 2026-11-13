import { API, b64ToUtf8, headers, utf8ToB64, type StoreConfig } from './githubStore'

/** Đọc một tệp cấu hình JSON trong repo dữ liệu (config/<name>.json). Chưa có thì trả null. */
export async function readConfigFile<T>(cfg: StoreConfig, name: string): Promise<{ sha: string; data: T } | null> {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/config/${name}.json?ref=${ref}`, {
    headers: headers(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Không đọc được config/${name}.json (HTTP ${res.status})`)
  const j = (await res.json()) as { sha: string; content: string }
  return { sha: j.sha, data: JSON.parse(b64ToUtf8(j.content)) as T }
}

export async function writeConfigFile(cfg: StoreConfig, name: string, data: unknown, sha: string | null, message: string): Promise<string> {
  const ref = cfg.branch ?? 'main'
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/config/${name}.json`, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, branch: ref, content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'), ...(sha ? { sha } : {}) }),
  })
  if (res.status === 409 || res.status === 422) throw new Error('Tệp cấu hình vừa được thay đổi ở nơi khác. Tải lại trang rồi thử lại.')
  if (res.status === 403 || res.status === 404) throw new Error('Token không có quyền ghi vào repo dữ liệu.')
  if (!res.ok) throw new Error(`Không lưu được cấu hình (HTTP ${res.status})`)
  return ((await res.json()) as { content: { sha: string } }).content.sha
}

export type ReaderConfig = { driveApiKey?: string }

/** Địa chỉ tải nội dung tệp Drive qua API (hỗ trợ CORS và tải từng đoạn). Tệp phải chia sẻ "Bất kỳ ai có đường liên kết". */
export const driveMediaUrl = (fileId: string, key: string) =>
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`

/** Kiểm tra khóa: đọc tên và dung lượng một tệp. */
export async function testDriveKey(key: string, fileId: string): Promise<{ name: string; size?: number }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,size&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
  )
  if (!res.ok) throw new Error(await driveErrorText(res))
  const j = (await res.json()) as { name: string; size?: string }
  return { name: j.name, size: j.size ? Number(j.size) : undefined }
}

export async function driveErrorText(res: Response): Promise<string> {
  let reason = ''
  try {
    const j = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[] } }
    reason = j.error?.errors?.[0]?.reason ?? j.error?.message ?? ''
  } catch {
    /* bỏ qua */
  }
  if (res.status === 404 || reason === 'notFound')
    return 'Google Drive không cho đọc tệp này. Hãy chia sẻ tệp ở chế độ "Bất kỳ ai có đường liên kết" (Người xem).'
  if (/keyInvalid|API key not valid/i.test(reason) || res.status === 400) return 'Khóa API không hợp lệ.'
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason)) return 'Khóa API chưa được bật Google Drive API trong Google Cloud.'
  if (/referer|Referer|API_KEY_HTTP_REFERRER_BLOCKED/i.test(reason)) return 'Khóa API đang chặn trang này. Thêm địa chỉ trang web vào danh sách Website restrictions của khóa.'
  if (res.status === 403) return `Google Drive từ chối truy cập (${reason || 'HTTP 403'}).`
  return `Lỗi Google Drive (HTTP ${res.status}${reason ? `: ${reason}` : ''}).`
}

export type DriveMeta = { name: string; mimeType: string; size?: number }

/** Tên, kiểu và dung lượng thật của tệp trên Drive (để chọn đúng trình đọc dù định dạng khai báo sai). */
export async function driveFileMeta(fileId: string, key: string): Promise<DriveMeta> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
  )
  if (!res.ok) throw new Error(await driveErrorText(res))
  const j = (await res.json()) as { name: string; mimeType: string; size?: string }
  return { name: j.name, mimeType: j.mimeType, size: j.size ? Number(j.size) : undefined }
}

/** Trình đọc phù hợp: pdf (PDF.js), book (EPUB, MOBI, AZW, AZW3, PRC, FB2, CBZ), hoặc null (để Drive xem). */
export function readerKind(meta: DriveMeta): 'pdf' | 'book' | null {
  const n = meta.name.toLowerCase()
  if (meta.mimeType === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if (/\.(epub|mobi|azw3?|prc|kf8|fb2|fbz|cbz)$/.test(n)) return 'book'
  if (/epub|mobipocket|kindle|fictionbook|x-cbz/.test(meta.mimeType)) return 'book'
  return null
}
