// Đọc link Google Drive mà người dùng dán vào (không cần kết nối Drive API).

import type { EbookHolding } from '../types/book'

export type DriveRef = { id: string; kind: 'file' | 'folder' | 'doc' }

const ID = '([A-Za-z0-9_-]{20,})'

/** Nhận các dạng link Drive phổ biến; trả về null nếu không phải link Drive. */
export const parseDriveLink = (text: string): DriveRef | null => {
  const s = text.trim()
  let m = s.match(new RegExp(`drive\\.google\\.com/(?:drive/(?:u/\\d+/)?)?folders/${ID}`))
  if (m) return { id: m[1], kind: 'folder' }
  m = s.match(new RegExp(`docs\\.google\\.com/(?:document|spreadsheets|presentation)/d/${ID}`))
  if (m) return { id: m[1], kind: 'doc' }
  m = s.match(new RegExp(`drive\\.google\\.com/file/(?:u/\\d+/)?d/${ID}`))
  if (m) return { id: m[1], kind: 'file' }
  m = s.match(new RegExp(`drive\\.google\\.com/(?:open|uc|thumbnail)\\?(?:[^#]*&)?id=${ID}`))
  if (m) return { id: m[1], kind: 'file' }
  if (new RegExp(`^${ID}$`).test(s) && s.length >= 25) return { id: s, kind: 'file' }
  return null
}

export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

export const guessFormat = (name: string): EbookHolding['format'] => {
  const m = name.toLowerCase().match(/\.(pdf|epub|djvu)\b/)
  return (m?.[1] as EbookHolding['format']) ?? 'pdf'
}

/** Bỏ phần mở rộng và ký tự nối trong tên tệp để làm nhan đề gợi ý. */
export const titleFromFileName = (name: string) =>
  name
    .replace(/\.(pdf|epub|djvu|mobi|azw3|docx?)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

export type PastedLine = { raw: string; ref: DriveRef | null; text: string }

/**
 * Mỗi dòng một link; phần chữ còn lại trên dòng (trước hoặc sau link, ngăn bằng |, tab, dấu gạch)
 * được coi là tên sách hoặc tên tệp.
 */
export const parsePasted = (text: string): PastedLine[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const url = raw.match(/https?:\/\/\S+/)?.[0]
      const ref = parseDriveLink(url ?? raw.split(/[\s|\t]+/).find((w) => parseDriveLink(w)) ?? raw)
      const rest = (url ? raw.replace(url, ' ') : ref ? raw.replace(ref.id, ' ') : raw)
        .replace(/^[\s|\t:–—-]+|[\s|\t:–—-]+$/g, '')
        .trim()
      return { raw, ref, text: titleFromFileName(rest) }
    })
