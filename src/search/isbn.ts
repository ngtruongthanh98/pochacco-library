import { normalizeIsbn } from './normalizeVi'

const isValid13 = (s: string) =>
  /^97[89]\d{10}$/.test(s) &&
  [...s].reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0

const isValid10 = (s: string) =>
  /^\d{9}[\dX]$/.test(s) &&
  [...s].reduce((sum, d, i) => sum + (d === 'X' ? 10 : Number(d)) * (10 - i), 0) % 11 === 0

const to13 = (isbn10: string) => {
  const core = '978' + isbn10.slice(0, 9)
  const sum = [...core].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0)
  return core + ((10 - (sum % 10)) % 10)
}

export type IsbnResult =
  | { ok: true; isbn13: string; isbn10?: string }
  | { ok: false; message: string }

/** Nhận ISBN-10 hoặc ISBN-13 (có hoặc không gạch), kiểm tra số kiểm tra, trả về dạng chuẩn. */
export const parseIsbn = (raw: string): IsbnResult => {
  const s = normalizeIsbn(raw)
  if (s.length === 13) return isValid13(s) ? { ok: true, isbn13: s } : { ok: false, message: 'ISBN-13 sai số kiểm tra.' }
  if (s.length === 10) return isValid10(s) ? { ok: true, isbn13: to13(s), isbn10: s } : { ok: false, message: 'ISBN-10 sai số kiểm tra.' }
  return { ok: false, message: 'ISBN phải có 10 hoặc 13 chữ số.' }
}
