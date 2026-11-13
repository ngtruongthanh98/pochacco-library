// Tiền Việt Nam: đọc chuỗi người dùng gõ ("120.000", "120k", "1,2tr", "85 000đ") và định dạng lại.
export function parseVnd(raw: string): number | undefined | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/(đ|₫|vnd|vnđ|dong|đồng)$/u, '')
  if (!s) return undefined
  const m = /^(\d+(?:[.,]\d+)*)(k|ng|nghìn|ngàn|tr|triệu|m)?$/u.exec(s)
  if (!m) return null
  let num = m[1]
  const unit = m[2]
  if (unit) {
    // Có đơn vị: dấu phẩy hoặc chấm là phần thập phân ("1,2tr").
    const v = Number(num.replace(',', '.'))
    if (!isFinite(v)) return null
    return Math.round(v * (unit.startsWith('t') || unit === 'm' ? 1_000_000 : 1000))
  }
  // Không đơn vị: dấu chấm, phẩy là phân cách hàng nghìn.
  num = num.replace(/[.,]/g, '')
  const v = Number(num)
  return isFinite(v) ? v : null
}
export const fmtVnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`
/** Gọn: 1,2 tr; 850 k */
export const fmtVndShort = (n: number) =>
  n >= 1_000_000 ? `${(Math.round(n / 100_000) / 10).toLocaleString('vi-VN')} tr` : n >= 1000 ? `${Math.round(n / 1000).toLocaleString('vi-VN')}k` : `${n}đ`
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const SHOP_DEFAULTS = ['Fahasa', 'Tiki', 'Shopee', 'Oreka', 'Chợ Tốt', 'Nhà sách Phương Nam', 'Đường sách Nguyễn Văn Bình', 'Hội sách', 'Sách cũ ven đường']
