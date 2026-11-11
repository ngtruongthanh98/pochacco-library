/** Chuẩn hóa tiếng Việt để tìm kiếm không dấu: chữ thường, bỏ dấu, đ -> d. */
export const foldVi = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

/** Chuẩn hóa ISBN về dạng chỉ chữ số (giữ X cuối của ISBN-10). */
export const normalizeIsbn = (s: string): string => s.replace(/[^0-9Xx]/g, '').toUpperCase()
