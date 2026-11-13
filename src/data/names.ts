import type { Name } from '../types/book'

/** Mỗi dòng một người. "Họ, Tên" (có dấu phẩy) cho tên nước ngoài; không dấu phẩy thì giữ nguyên thứ tự. */
export const parseNames = (text: string): Name[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(',')
      if (i > 0) {
        const family = l.slice(0, i).trim()
        const given = l.slice(i + 1).trim()
        return given ? { family, given } : { family }
      }
      return { literal: l }
    })

export const namesToText = (ns?: Name[]) =>
  (ns ?? []).map((n) => ('literal' in n ? n.literal : n.given ? `${n.family}, ${n.given}` : `${n.family},`)).join('\n')
